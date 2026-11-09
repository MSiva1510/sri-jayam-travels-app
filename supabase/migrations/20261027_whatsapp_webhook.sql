-- ─────────────────────────────────────────────────────────────────────────────
-- WhatsApp Cloud API webhook storage (netlify/functions/whatsapp-webhook.js).
--
--   1. whatsapp_inbound_messages — customer messages Meta delivers to us.
--      Unique wamid makes Meta's retries no-ops. Staff (is_staff) can read;
--      only the service role (the webhook) writes.
--   2. whatsapp_apply_status(wamid, status, at, error) — applies a delivery
--      receipt to communication_logs (matched on provider_message_id).
--      communication_logs.status only allows pending / processing / delivered
--      / failed / retrying / cancelled, so Meta's statuses map as:
--        sent      → processing (only from pending/retrying), sent_at
--        delivered → delivered, delivered_at
--        read      → delivered, delivered_at, metadata.read_at
--        failed    → failed, failed_at, failure_reason (never over delivered)
--      metadata.wa_status keeps Meta's own value and never moves backwards
--      (receipts can arrive out of order). Execute: service_role only.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.whatsapp_inbound_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wamid           text NOT NULL UNIQUE,
  from_phone      text NOT NULL,
  contact_name    text,
  phone_number_id text,
  message_type    text NOT NULL DEFAULT 'unknown',
  text_body       text,
  payload         jsonb,
  received_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  handled_at      timestamptz
);

CREATE INDEX IF NOT EXISTS whatsapp_inbound_messages_received_idx
  ON public.whatsapp_inbound_messages (received_at DESC);

ALTER TABLE public.whatsapp_inbound_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_inbound_messages FROM anon;
GRANT SELECT, UPDATE ON public.whatsapp_inbound_messages TO authenticated;

DROP POLICY IF EXISTS whatsapp_inbound_staff_read ON public.whatsapp_inbound_messages;
CREATE POLICY whatsapp_inbound_staff_read
  ON public.whatsapp_inbound_messages FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS whatsapp_inbound_staff_update ON public.whatsapp_inbound_messages;
CREATE POLICY whatsapp_inbound_staff_update
  ON public.whatsapp_inbound_messages FOR UPDATE TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE OR REPLACE FUNCTION public.whatsapp_status_rank(p_status text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_status WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2 WHEN 'read' THEN 3 ELSE 0 END
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_apply_status(
  p_wamid  text,
  p_status text,
  p_at     timestamptz DEFAULT now(),
  p_error  text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows integer;
BEGIN
  IF p_status NOT IN ('sent', 'delivered', 'read', 'failed') OR coalesce(p_wamid, '') = '' THEN
    RETURN 0;
  END IF;

  UPDATE public.communication_logs l SET
    status = CASE
      WHEN p_status IN ('delivered', 'read')                  THEN 'delivered'
      WHEN p_status = 'failed' AND l.status <> 'delivered'    THEN 'failed'
      WHEN p_status = 'sent' AND l.status IN ('pending', 'retrying') THEN 'processing'
      ELSE l.status
    END,
    sent_at = CASE WHEN p_status <> 'failed' THEN coalesce(l.sent_at, p_at) ELSE l.sent_at END,
    delivered_at = CASE WHEN p_status IN ('delivered', 'read')
                        THEN coalesce(l.delivered_at, p_at) ELSE l.delivered_at END,
    failed_at = CASE WHEN p_status = 'failed' AND l.status <> 'delivered'
                     THEN p_at ELSE l.failed_at END,
    failure_reason = CASE WHEN p_status = 'failed' AND l.status <> 'delivered'
                          THEN left(coalesce(p_error, 'failed'), 500) ELSE l.failure_reason END,
    metadata = coalesce(l.metadata, '{}'::jsonb)
      || jsonb_build_object('wa_status',
           CASE WHEN p_status = 'failed' THEN
                  CASE WHEN l.status = 'delivered' THEN l.metadata->>'wa_status' ELSE 'failed' END
                WHEN public.whatsapp_status_rank(l.metadata->>'wa_status') >= public.whatsapp_status_rank(p_status)
                  THEN l.metadata->>'wa_status'
                ELSE p_status END)
      || CASE WHEN p_status = 'read' AND l.metadata->>'read_at' IS NULL
              THEN jsonb_build_object('read_at', p_at) ELSE '{}'::jsonb END
  WHERE l.channel = 'whatsapp' AND l.provider_message_id = p_wamid;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END $$;

REVOKE ALL ON FUNCTION public.whatsapp_apply_status(text, text, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_apply_status(text, text, timestamptz, text) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- WhatsApp bot, inbox and trip messages (netlify/functions/whatsapp-*.js).
--
--   1. whatsapp_conversations — one row per customer phone: bot state, when
--      the customer last wrote (24 h reply window), unread count, "needs
--      staff" flag and bot pause (staff took over).
--   2. whatsapp_outbound_messages — every message we send (bot, staff, trip
--      templates). UNIQUE (booking_id, kind) stops a trip message going out
--      twice; wamid links Meta's delivery receipts.
--   3. whatsapp_touch_conversation(phone, direction, name) — upsert used by
--      the functions; whatsapp_apply_outbound_status(wamid, status, error)
--      applies receipts (never moves backwards). Service role only.
--   4. Trigger on public.bookings → pg_net POST to /api/whatsapp/notify when
--      status / driver / vehicle changes to an active or finished state, so
--      the web, manager app and driver app all send trip messages without
--      any app change. URL + secret come from Supabase Vault
--      ('whatsapp_notify_url', 'whatsapp_notify_secret'); while they are
--      missing the trigger does nothing. It can never block a booking write.
--
-- Staff (is_staff) can read everything and update conversations (mark read);
-- all writes of messages go through the service role. Re-runnable.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_net not available: %', SQLERRM;
END $$;

-- ── 1. Conversations ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  phone             text PRIMARY KEY,
  contact_name      text,
  state             text,
  data              jsonb NOT NULL DEFAULT '{}'::jsonb,
  bot_paused_until  timestamptz,
  needs_staff       boolean NOT NULL DEFAULT false,
  unread            integer NOT NULL DEFAULT 0,
  last_inbound_at   timestamptz,
  last_outbound_at  timestamptz,
  last_message_at   timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_conversations_last_idx
  ON public.whatsapp_conversations (last_message_at DESC);

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_conversations FROM anon;
GRANT SELECT, UPDATE ON public.whatsapp_conversations TO authenticated;

DROP POLICY IF EXISTS whatsapp_conversations_staff_read ON public.whatsapp_conversations;
CREATE POLICY whatsapp_conversations_staff_read
  ON public.whatsapp_conversations FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS whatsapp_conversations_staff_update ON public.whatsapp_conversations;
CREATE POLICY whatsapp_conversations_staff_update
  ON public.whatsapp_conversations FOR UPDATE TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ── 2. Outbound messages ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_outbound_messages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wamid          text UNIQUE,
  to_phone       text NOT NULL,
  kind           text NOT NULL,
  body           text,
  template_name  text,
  booking_id     uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  status         text NOT NULL DEFAULT 'queued'
                 CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed')),
  error          text,
  sent_by        uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Plain (not partial) so PostgREST on_conflict=booking_id,kind can use it;
-- rows without a booking have NULL booking_id and never conflict.
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_outbound_booking_kind_key
  ON public.whatsapp_outbound_messages (booking_id, kind);
CREATE INDEX IF NOT EXISTS whatsapp_outbound_phone_idx
  ON public.whatsapp_outbound_messages (to_phone, created_at DESC);

ALTER TABLE public.whatsapp_outbound_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_outbound_messages FROM anon;
GRANT SELECT ON public.whatsapp_outbound_messages TO authenticated;

DROP POLICY IF EXISTS whatsapp_outbound_staff_read ON public.whatsapp_outbound_messages;
CREATE POLICY whatsapp_outbound_staff_read
  ON public.whatsapp_outbound_messages FOR SELECT TO authenticated
  USING (public.is_staff());

-- ── 3. Functions for the Netlify functions (service role) ───────────────────
CREATE OR REPLACE FUNCTION public.whatsapp_touch_conversation(
  p_phone        text,
  p_direction    text,
  p_contact_name text DEFAULT NULL
)
RETURNS SETOF public.whatsapp_conversations
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.whatsapp_conversations AS c
    (phone, contact_name, unread, last_inbound_at, last_outbound_at, last_message_at)
  VALUES (
    p_phone,
    nullif(trim(p_contact_name), ''),
    CASE WHEN p_direction = 'in' THEN 1 ELSE 0 END,
    CASE WHEN p_direction = 'in' THEN now() END,
    CASE WHEN p_direction = 'out' THEN now() END,
    now()
  )
  ON CONFLICT (phone) DO UPDATE SET
    contact_name     = coalesce(excluded.contact_name, c.contact_name),
    unread           = c.unread + excluded.unread,
    last_inbound_at  = coalesce(excluded.last_inbound_at, c.last_inbound_at),
    last_outbound_at = coalesce(excluded.last_outbound_at, c.last_outbound_at),
    last_message_at  = now()
  RETURNING *
$$;

REVOKE ALL ON FUNCTION public.whatsapp_touch_conversation(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_touch_conversation(text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.whatsapp_apply_outbound_status(
  p_wamid  text,
  p_status text,
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

  UPDATE public.whatsapp_outbound_messages m SET
    status = CASE
      WHEN p_status = 'failed' THEN
        CASE WHEN m.status IN ('delivered', 'read') THEN m.status ELSE 'failed' END
      WHEN m.status = 'failed' THEN p_status
      WHEN public.whatsapp_status_rank(p_status) > public.whatsapp_status_rank(m.status) THEN p_status
      ELSE m.status
    END,
    error = CASE WHEN p_status = 'failed' AND m.status NOT IN ('delivered', 'read')
                 THEN left(coalesce(p_error, 'failed'), 500) ELSE m.error END,
    updated_at = now()
  WHERE m.wamid = p_wamid;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END $$;

REVOKE ALL ON FUNCTION public.whatsapp_apply_outbound_status(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_apply_outbound_status(text, text, text) TO service_role;

-- ── 4. Booking changes → /api/whatsapp/notify ───────────────────────────────
CREATE OR REPLACE FUNCTION public.whatsapp_booking_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url    text;
  v_secret text;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status    IS NOT DISTINCT FROM OLD.status
     AND NEW.driver_id IS NOT DISTINCT FROM OLD.driver_id
     AND NEW.vehicle_id IS NOT DISTINCT FROM OLD.vehicle_id THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('approved', 'confirmed', 'assigned', 'started', 'completed', 'closed') THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'whatsapp_notify_url';
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'whatsapp_notify_secret';
  IF coalesce(v_url, '') = '' OR coalesce(v_secret, '') = '' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_url,
    body    := jsonb_build_object('booking_id', NEW.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-Sjt-Notify-Secret', v_secret),
    timeout_milliseconds := 8000
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- WhatsApp must never stop a booking from saving.
  RAISE WARNING 'whatsapp_booking_changed: %', SQLERRM;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.whatsapp_booking_changed() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_whatsapp_booking_changed ON public.bookings;
CREATE TRIGGER trg_whatsapp_booking_changed
  AFTER INSERT OR UPDATE OF status, driver_id, vehicle_id ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.whatsapp_booking_changed();

-- ── 5. Realtime for the inboxes ─────────────────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RETURN;
  END IF;
  FOREACH t IN ARRAY ARRAY['whatsapp_conversations', 'whatsapp_outbound_messages', 'whatsapp_inbound_messages'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

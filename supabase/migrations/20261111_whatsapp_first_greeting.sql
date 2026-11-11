ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS welcome_checked_at timestamptz;

UPDATE public.whatsapp_conversations
SET welcome_checked_at = coalesce(last_inbound_at, created_at, now())
WHERE welcome_checked_at IS NULL;

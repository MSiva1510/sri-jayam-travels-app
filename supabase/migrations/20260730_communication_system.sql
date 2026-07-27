-- ─────────────────────────────────────────────────────────────────────
-- SRI JAYAM TRAVELS – DAY 30: COMMUNICATION & NOTIFICATION SYSTEM
-- Run this in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────

-- ── 1. Communication logs — every sent message recorded ──────
CREATE TABLE IF NOT EXISTS public.communication_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Who
  recipient_id      TEXT,
  recipient_type    TEXT NOT NULL CHECK (recipient_type IN ('admin','manager','driver','customer','system')),
  recipient_name    TEXT,
  recipient_contact TEXT,                              -- phone / email / device_token
  -- What
  channel           TEXT NOT NULL CHECK (channel IN ('in_app','whatsapp','sms','push','webhook','email')),
  category          TEXT NOT NULL DEFAULT 'general',  -- booking,trip,expense,payroll,vehicle,attendance,hr,system
  event_type        TEXT,                              -- BOOKING_CREATED, TRIP_ASSIGNED, etc.
  subject           TEXT,
  body              TEXT,
  template_id       TEXT,
  template_data     JSONB DEFAULT '{}'::jsonb,
  -- Delivery
  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','delivered','failed','retrying','cancelled')),
  priority          TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('critical','high','medium','low','information')),
  provider          TEXT,                              -- whatsapp_cloud_api, twilio, msg91, etc.
  provider_message_id TEXT,
  -- Timestamps
  scheduled_at      TIMESTAMP WITH TIME ZONE,
  sent_at           TIMESTAMP WITH TIME ZONE,
  delivered_at      TIMESTAMP WITH TIME ZONE,
  failed_at         TIMESTAMP WITH TIME ZONE,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Error handling
  failure_reason    TEXT,
  retry_count       INTEGER DEFAULT 0,
  max_retries       INTEGER DEFAULT 3,
  retry_history     JSONB DEFAULT '[]'::jsonb,
  -- Context
  related_entity_type TEXT,
  related_entity_id   TEXT,
  metadata          JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_comm_logs_recipient  ON public.communication_logs(recipient_id);
CREATE INDEX IF NOT EXISTS idx_comm_logs_channel    ON public.communication_logs(channel);
CREATE INDEX IF NOT EXISTS idx_comm_logs_status     ON public.communication_logs(status);
CREATE INDEX IF NOT EXISTS idx_comm_logs_category   ON public.communication_logs(category);
CREATE INDEX IF NOT EXISTS idx_comm_logs_created_at ON public.communication_logs(created_at DESC);

ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY comm_logs_all ON public.communication_logs FOR ALL USING (true);

-- ── 2. Communication queue — for async / scheduled delivery ──
CREATE TABLE IF NOT EXISTS public.communication_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id          UUID REFERENCES public.communication_logs(id) ON DELETE CASCADE,
  channel         TEXT NOT NULL,
  priority        TEXT NOT NULL DEFAULT 'medium',
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','delivered','failed','retrying','cancelled')),
  scheduled_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at    TIMESTAMP WITH TIME ZONE,
  retry_count     INTEGER DEFAULT 0,
  max_retries     INTEGER DEFAULT 3,
  next_retry_at   TIMESTAMP WITH TIME ZONE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comm_queue_status     ON public.communication_queue(status);
CREATE INDEX IF NOT EXISTS idx_comm_queue_scheduled  ON public.communication_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_comm_queue_channel    ON public.communication_queue(channel);

ALTER TABLE public.communication_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY comm_queue_all ON public.communication_queue FOR ALL USING (true);

-- ── 3. Notification preferences per user ─────────────────────
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Channel toggles
  in_app_enabled        BOOLEAN DEFAULT true,
  whatsapp_enabled      BOOLEAN DEFAULT false,
  sms_enabled           BOOLEAN DEFAULT false,
  push_enabled          BOOLEAN DEFAULT false,
  email_enabled         BOOLEAN DEFAULT false,
  -- Category toggles
  booking_notifications  BOOLEAN DEFAULT true,
  trip_notifications     BOOLEAN DEFAULT true,
  expense_notifications  BOOLEAN DEFAULT true,
  payroll_notifications  BOOLEAN DEFAULT true,
  vehicle_notifications  BOOLEAN DEFAULT true,
  attendance_notifications BOOLEAN DEFAULT true,
  document_notifications  BOOLEAN DEFAULT true,
  system_notifications   BOOLEAN DEFAULT true,
  -- Quiet hours
  quiet_hours_enabled   BOOLEAN DEFAULT false,
  quiet_hours_start     TIME DEFAULT '22:00',
  quiet_hours_end       TIME DEFAULT '07:00',
  -- Contact details for channels
  whatsapp_number       TEXT,
  sms_number            TEXT,
  push_token            TEXT,
  email_address         TEXT,
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_prefs_own ON public.notification_preferences FOR ALL USING (true);

-- ── 4. Provider configuration (admin-managed) ────────────────
CREATE TABLE IF NOT EXISTS public.communication_providers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel         TEXT NOT NULL,   -- whatsapp, sms, push, webhook, email
  provider_name   TEXT NOT NULL,   -- twilio, msg91, whatsapp_cloud_api, etc.
  is_active       BOOLEAN DEFAULT false,
  is_default      BOOLEAN DEFAULT false,
  config          JSONB DEFAULT '{}'::jsonb,  -- encrypted config keys reference only
  test_mode       BOOLEAN DEFAULT true,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.communication_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY comm_providers_admin ON public.communication_providers FOR ALL USING (true);

-- Seed default provider records (not active — just registered)
INSERT INTO public.communication_providers (channel, provider_name, is_active, is_default, test_mode) VALUES
  ('whatsapp', 'whatsapp_cloud_api', false, false, true),
  ('whatsapp', 'twilio',             false, false, true),
  ('whatsapp', 'gupshup',            false, false, true),
  ('whatsapp', 'interakt',           false, false, true),
  ('whatsapp', 'aisensy',            false, false, true),
  ('whatsapp', 'wati',               false, false, true),
  ('whatsapp', '360dialog',          false, false, true),
  ('sms',      'twilio',             false, false, true),
  ('sms',      'msg91',              false, false, true),
  ('sms',      'fast2sms',           false, false, true),
  ('sms',      'textlocal',          false, false, true),
  ('push',     'fcm',                false, false, true),
  ('push',     'apns',               false, false, true),
  ('webhook',  'generic_rest',       false, false, true)
ON CONFLICT DO NOTHING;

-- ── 5. Analytics summary view ─────────────────────────────────
CREATE OR REPLACE VIEW public.communication_analytics AS
SELECT
  channel,
  category,
  status,
  COUNT(*)                                        AS total,
  COUNT(*) FILTER (WHERE status = 'delivered')    AS delivered,
  COUNT(*) FILTER (WHERE status = 'failed')       AS failed,
  COUNT(*) FILTER (WHERE status = 'pending')      AS pending,
  AVG(retry_count)                                AS avg_retries,
  DATE_TRUNC('day', created_at)                   AS day
FROM public.communication_logs
GROUP BY channel, category, status, DATE_TRUNC('day', created_at);

-- ── 6. Helper: update notification preferences timestamp ──────
CREATE OR REPLACE FUNCTION public.touch_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notif_prefs_updated ON public.notification_preferences;
CREATE TRIGGER trg_notif_prefs_updated
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_notification_preferences();

SELECT 'Day 30 communication system migration complete' AS result;

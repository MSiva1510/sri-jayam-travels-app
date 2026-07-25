-- ─────────────────────────────────────────────────────────────────────
-- SRI JAYAM TRAVELS – DAY 29 ERP BUSINESS COMPLETION
-- Run this in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────

-- ── 1. Expand booking lifecycle statuses ─────────────────────
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_status_check
  CHECK (status IN (
    'draft','pending','approved','confirmed','assigned',
    'started','paused','completed','closed','cancelled'
  ));

-- Add workflow tracking columns
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS approved_by       TEXT,
  ADD COLUMN IF NOT EXISTS approved_at       TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS remarks           TEXT,
  ADD COLUMN IF NOT EXISTS last_modified_by  TEXT,
  ADD COLUMN IF NOT EXISTS approval_history  JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS driver_name       TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_reg       TEXT;

-- ── 2. Booking approval log ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.booking_approvals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  action       TEXT NOT NULL,
  from_status  TEXT,
  to_status    TEXT,
  actor_name   TEXT,
  actor_role   TEXT,
  remarks      TEXT,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_booking_approvals_booking ON public.booking_approvals(booking_id);
ALTER TABLE public.booking_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY booking_approvals_all ON public.booking_approvals FOR ALL USING (true);

-- ── 3. Enhance notifications ──────────────────────────────────
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS status       TEXT DEFAULT 'unread'
    CHECK (status IN ('unread','read','archived','dismissed')),
  ADD COLUMN IF NOT EXISTS category     TEXT DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS priority     TEXT DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high','urgent')),
  ADD COLUMN IF NOT EXISTS icon         TEXT,
  ADD COLUMN IF NOT EXISTS action_url   TEXT,
  ADD COLUMN IF NOT EXISTS archived_at  TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_notifications_status   ON public.notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_category ON public.notifications(category);

-- ── 4. Enhance documents ──────────────────────────────────────
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS title         TEXT,
  ADD COLUMN IF NOT EXISTS category      TEXT,
  ADD COLUMN IF NOT EXISTS doc_type      TEXT,
  ADD COLUMN IF NOT EXISTS expiry_date   DATE,
  ADD COLUMN IF NOT EXISTS reminder_date DATE,
  ADD COLUMN IF NOT EXISTS status        TEXT DEFAULT 'active'
    CHECK (status IN ('active','expired','expiring_soon','pending')),
  ADD COLUMN IF NOT EXISTS notes         TEXT,
  ADD COLUMN IF NOT EXISTS driver_id     UUID REFERENCES public.drivers(id),
  ADD COLUMN IF NOT EXISTS vehicle_id    UUID REFERENCES public.vehicles(id),
  ADD COLUMN IF NOT EXISTS customer_id   UUID REFERENCES public.customers(id),
  ADD COLUMN IF NOT EXISTS booking_id    UUID REFERENCES public.bookings(id),
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_documents_expiry   ON public.documents(expiry_date);
CREATE INDEX IF NOT EXISTS idx_documents_driver   ON public.documents(driver_id);
CREATE INDEX IF NOT EXISTS idx_documents_vehicle  ON public.documents(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_documents_customer ON public.documents(customer_id);

-- ── 5. Enhance settlements (payroll) ─────────────────────────
ALTER TABLE public.settlements
  ADD COLUMN IF NOT EXISTS trip_count         INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trip_allowance     DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS night_allowance    DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fuel_incentive     DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS performance_bonus  DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS penalty            DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS advance            DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approved_by        TEXT,
  ADD COLUMN IF NOT EXISTS approved_at        TIMESTAMP WITH TIME ZONE;

-- ── 6. Vehicle service schedule ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.vehicle_service (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id        UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  service_type      TEXT NOT NULL DEFAULT 'general',
  service_date      DATE NOT NULL,
  next_service_date DATE,
  service_km        DECIMAL(10,2),
  next_service_km   DECIMAL(10,2),
  cost              DECIMAL(10,2),
  vendor            TEXT,
  notes             TEXT,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vehicle_service_vehicle ON public.vehicle_service(vehicle_id);
ALTER TABLE public.vehicle_service ENABLE ROW LEVEL SECURITY;
CREATE POLICY vehicle_service_all ON public.vehicle_service FOR ALL USING (true);

-- ── 7. Trip timeline extra event types ───────────────────────
-- (no schema change needed – event_type is free text)

-- ── 8. Trigger: auto-status on notification read ─────────────
CREATE OR REPLACE FUNCTION public.set_notification_read_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_read = true AND OLD.is_read = false THEN
    NEW.status   := 'read';
    NEW.read_at  := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_notification_read ON public.notifications;
CREATE TRIGGER trg_notification_read
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_notification_read_status();

-- ── 9. Document expiry refresh function ──────────────────────
CREATE OR REPLACE FUNCTION public.refresh_document_status()
RETURNS void AS $$
BEGIN
  UPDATE public.documents SET status = CASE
    WHEN expiry_date IS NULL                                THEN 'active'
    WHEN expiry_date <  CURRENT_DATE                        THEN 'expired'
    WHEN expiry_date <= CURRENT_DATE + INTERVAL '30 days'  THEN 'expiring_soon'
    ELSE 'active'
  END;
END;
$$ LANGUAGE plpgsql;

-- ── 10. Add new timeline event types ─────────────────────────
-- (audit_logs table accepts free text actions – no change needed)

SELECT 'Day 29 migration complete' AS result;

-- ─────────────────────────────────────────────────────────────────────
-- SRI JAYAM TRAVELS – DAY 34: FLEET ALERT & EVENT MANAGEMENT SYSTEM
-- ─────────────────────────────────────────────────────────────────────
--
-- Creates the fleet_alerts table for storing fleet alerts and events
--

-- ── 1. fleet_alerts table ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fleet_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id      UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  driver_id       UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  alert_type      TEXT NOT NULL CHECK (alert_type IN (
    'overspeed', 'long_idle', 'vehicle_offline', 'gps_offline',
    'ignition_on', 'ignition_off', 'low_battery', 'maintenance_due',
    'emergency', 'custom', 'geofence_entry', 'geofence_exit',
    'harsh_braking', 'harsh_acceleration'
  )),
  priority        TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low', 'information')),
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'in_progress', 'resolved', 'closed')),
  title           TEXT NOT NULL,
  description     TEXT,
  location        JSONB, -- Stores latitude, longitude, address, etc.
  speed_kmh       DOUBLE PRECISION, -- For overspeed alerts
  duration_minutes DOUBLE PRECISION, -- For idle alerts
  detected_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  acknowledged_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at     TIMESTAMP WITH TIME ZONE,
  notes           TEXT,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.fleet_alerts ENABLE ROW LEVEL SECURITY;

-- Policies for fleet_alerts
-- Admins and managers can see all alerts
CREATE POLICY fleet_alerts_manager_all ON public.fleet_alerts FOR SELECT
  USING (auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'manager')));

-- Drivers can see alerts related to their vehicles
CREATE POLICY fleet_alerts_driver_own ON public.fleet_alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.drivers
      WHERE drivers.user_id = auth.uid()
      AND (
        fleet_alerts.vehicle_id = drivers.vehicle_id
        OR fleet_alerts.driver_id = drivers.id
      )
    )
  );

-- Admins and managers can insert alerts (typically done by system)
CREATE POLICY fleet_alerts_manager_insert ON public.fleet_alerts FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'manager')));

-- Admins and managers can update alerts
CREATE POLICY fleet_alerts_manager_update ON public.fleet_alerts FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'manager')))
  WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'manager')));

-- Admins and managers can delete alerts
CREATE POLICY fleet_alerts_manager_delete ON public.fleet_alerts FOR DELETE
  USING (auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'manager')));

SELECT 'Day 34 migration complete: fleet_alerts table created' AS result;
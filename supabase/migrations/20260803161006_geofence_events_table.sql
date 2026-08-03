-- ─────────────────────────────────────────────────────────────────────
-- SRI JAYAM TRAVELS – DAY 35: GEOFENCE EVENTS TABLE
-- ─────────────────────────────────────────────────────────────────────
--
-- Creates the geofence_events table for storing geofence entry/exit events
--

-- ── 1. geofence_events table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.geofence_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id         UUID NOT NULL REFERENCES public.geofence_zones(id) ON DELETE CASCADE,
  vehicle_id      UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  driver_id       UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  event_type      TEXT NOT NULL CHECK (event_type IN ('entry', 'exit')),
  timestamp       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  duration_minutes DOUBLE PRECISION, -- Time spent in zone in minutes (for exit events)
  entered_at      TIMESTAMP WITH TIME ZONE, -- When entered the zone
  exited_at       TIMESTAMP WITH TIME ZONE, -- When exited the zone
  notes           TEXT,

  -- Audit fields
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.geofence_events ENABLE ROW LEVEL SECURITY;

-- Policies for geofence_events
-- Admins and managers can see all geofence events
CREATE POLICY geofence_events_manager_all ON public.geofence_events FOR SELECT
  USING (auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'manager')));

-- Drivers can see geofence events related to their vehicles
CREATE POLICY geofence_events_driver_own ON public.geofence_events FOR SELECT
  USING (
    vehicle_id IN (
      SELECT v.id FROM public.vehicles v
      JOIN public.drivers d ON v.current_driver = d.id
      WHERE d.user_id = auth.uid()
    )
    OR
    driver_id IN (
      SELECT id FROM public.drivers WHERE user_id = auth.uid()
    )
  );

-- Admins and managers can insert geofence events (typically done by system)
CREATE POLICY geofence_events_manager_insert ON public.geofence_events FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'manager')));

-- Admins and managers can update geofence events
CREATE POLICY geofence_events_manager_update ON public.geofence_events FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'manager')))
  WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'manager')));

-- Admins and managers can delete geofence events
CREATE POLICY geofence_events_manager_delete ON public.geofence_events FOR DELETE
  USING (auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'manager')));

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_geofence_events_zone_id ON public.geofence_events(zone_id);
CREATE INDEX IF NOT EXISTS idx_geofence_events_vehicle_id ON public.geofence_events(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_geofence_events_driver_id ON public.geofence_events(driver_id);
CREATE INDEX IF NOT EXISTS idx_geofence_events_event_type ON public.geofence_events(event_type);
CREATE INDEX IF NOT EXISTS idx_geofence_events_timestamp ON public.geofence_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_geofence_events_zone_timestamp ON public.geofence_events(zone_id, timestamp DESC);

-- Add helpful comments
COMMENT ON TABLE public.geofence_events IS 'Geofence entry/exit events for zone tracking';
COMMENT ON COLUMN public.geofence_events.event_type IS 'Type of geofence event: entry or exit';
COMMENT ON COLUMN public.geofence_events.duration_minutes IS 'Duration inside zone in minutes (calculated for exit events)';
COMMENT ON COLUMN public.geofence_events.entered_at IS 'Timestamp when entered the zone';
COMMENT ON COLUMN public.geofence_events.exited_at IS 'Timestamp when exited the zone';

SELECT 'Day 35 migration complete: geofence_events table created' AS result;
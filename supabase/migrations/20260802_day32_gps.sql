-- ─────────────────────────────────────────────────────────────
-- SRI JAYAM TRAVELS – DAY 32: GPS HISTORY & LIVE FLEET DASHBOARD
-- ─────────────────────────────────────────────────────────────
--
-- Creates the four tables referenced by the Day 31+ codebase but
-- never migrated, plus the IMEI column on vehicles, dedup indexes,
-- and the new role_permissions rows that gate the /fleet routes.
--
-- Rule: NO new tables beyond what the existing code references.
-- Rule: NO RLS re-enable on tables that already have RLS.

-- ── 1. gps_tracking (per-vehicle polling snapshots) ───────────
CREATE TABLE IF NOT EXISTS public.gps_tracking (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id  UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  trip_id     UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  driver_id   UUID REFERENCES public.drivers(id)  ON DELETE SET NULL,
  latitude    DOUBLE PRECISION NOT NULL,
  longitude   DOUBLE PRECISION NOT NULL,
  accuracy    DOUBLE PRECISION,
  speed_kmh   DOUBLE PRECISION,
  bearing     DOUBLE PRECISION,
  altitude    DOUBLE PRECISION,
  address     TEXT,
  ignition    BOOLEAN,
  status      TEXT,                                       -- 'moving' | 'stopped' | 'offline'
  odometer    DOUBLE PRECISION,
  timestamp   TIMESTAMP WITH TIME ZONE NOT NULL,
  raw         JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.gps_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY gps_tracking_all ON public.gps_tracking FOR ALL USING (true);

-- Dedup index — service rounds timestamp to the minute before insert
-- and uses ON CONFLICT (vehicle_id, timestamp) DO NOTHING.
CREATE UNIQUE INDEX IF NOT EXISTS idx_gps_tracking_dedup
  ON public.gps_tracking (vehicle_id, timestamp);

-- Read path index for "latest per vehicle"
CREATE INDEX IF NOT EXISTS idx_gps_tracking_vehicle_ts
  ON public.gps_tracking (vehicle_id, timestamp DESC);

-- ── 2. driver_status ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.driver_status (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id         UUID UNIQUE REFERENCES public.drivers(id) ON DELETE CASCADE,
  status            TEXT,                                   -- available|driving|passenger_onboard|break|offline
  current_trip_id   UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  latitude          DOUBLE PRECISION,
  longitude         DOUBLE PRECISION,
  speed_kmh         DOUBLE PRECISION,
  last_heartbeat    TIMESTAMP WITH TIME ZONE,
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.driver_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY driver_status_all ON public.driver_status FOR ALL USING (true);

-- ── 3. vehicle_status ──────────────────────────────────────────
-- Original code reads: vehicle_id, status, assigned_driver_id,
-- current_trip_id, last_km_reading, fuel_level, updated_at.
-- Day 32 adds three non-conflicting GPS-only columns (last_gps_at,
-- last_lat, last_lng). Booking lifecycle still owns the `status`
-- column; the GPS sync service writes only the last_* fields.
CREATE TABLE IF NOT EXISTS public.vehicle_status (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id          UUID UNIQUE REFERENCES public.vehicles(id) ON DELETE CASCADE,
  status              TEXT DEFAULT 'available',             -- available|in_use|maintenance|offline
  assigned_driver_id  UUID REFERENCES public.drivers(id)  ON DELETE SET NULL,
  current_trip_id     UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  last_km_reading     DOUBLE PRECISION,
  fuel_level          DOUBLE PRECISION,
  last_gps_at         TIMESTAMP WITH TIME ZONE,             -- Day 32
  last_lat            DOUBLE PRECISION,                     -- Day 32
  last_lng            DOUBLE PRECISION,                     -- Day 32
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.vehicle_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY vehicle_status_all ON public.vehicle_status FOR ALL USING (true);

-- ── 4. vehicle_assignments (day-by-day driver↔vehicle handoffs)
CREATE TABLE IF NOT EXISTS public.vehicle_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_reg     TEXT NOT NULL,
  vehicle_type    TEXT,
  vehicle_model   TEXT,
  driver_id       UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  driver_name     TEXT,
  assigned_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  assigned_time   TEXT,
  assigned_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  released_date   DATE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.vehicle_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY vehicle_assignments_all ON public.vehicle_assignments FOR ALL USING (true);
CREATE INDEX IF NOT EXISTS idx_vehicle_assignments_date
  ON public.vehicle_assignments (assigned_date DESC);

-- ── 5. vehicles.imei — KingsTrack keys devices by IMEI ─────────
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS imei TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_imei
  ON public.vehicles (imei)
  WHERE imei IS NOT NULL;

-- ── 6. role_permissions seeds for /fleet + /fleet/settings ─────
-- /fleet          — admin + manager  (view_fleet)
-- /fleet/settings — admin only       (manage_gps)
INSERT INTO public.role_permissions (role, permission, is_allowed) VALUES
  ('admin','view_fleet',   true),
  ('manager','view_fleet', true),
  ('driver','view_fleet',  false),
  ('admin','manage_gps',   true),
  ('manager','manage_gps', false),
  ('driver','manage_gps',  false)
ON CONFLICT (role, permission) DO NOTHING;

SELECT 'Day 32 migration complete' AS result;
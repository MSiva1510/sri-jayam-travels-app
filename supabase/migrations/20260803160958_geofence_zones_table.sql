-- ─────────────────────────────────────────────────────────────────────
-- SRI JAYAM TRAVELS – DAY 35: GEOFENCE ZONES TABLE
-- ─────────────────────────────────────────────────────────────────────
--
-- Creates the geofence_zones table for storing geofence definitions
--

-- ── 1. geofence_zones table ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.geofence_zones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  type            TEXT NOT NULL CHECK (type IN (
    'circle', 'polygon', 'office', 'garage', 'airport',
    'customer', 'warehouse', 'custom'
  )),
  -- For circle type: center coordinates and radius
  center_lat      DOUBLE PRECISION,  -- Latitude of center point
  center_lng      DOUBLE PRECISION,  -- Longitude of center point
  radius_meters   DOUBLE PRECISION,  -- Radius in meters (for circle type)

  -- For polygon type: array of latitude/longitude points
  -- Stored as JSONB array of objects: [{lat: number, lng: number}, ...]
  coordinates     JSONB,             -- Polygon vertices or other shape definition

  -- Metadata
  is_active       BOOLEAN DEFAULT true,
  tags            TEXT[],            -- Tags for categorization (e.g., ['high-priority', 'restricted'])

  -- Audit fields
  created_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.geofence_zones ENABLE ROW LEVEL SECURITY;

-- Policies for geofence_zones
-- Admins and managers can see all geofence zones
CREATE POLICY geofence_zones_manager_all ON public.geofence_zones FOR SELECT
  USING (auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'manager')));

-- Drivers can see geofence zones related to their assigned vehicles/customers
CREATE POLICY geofence_zones_driver_own ON public.geofence_zones FOR SELECT
  USING (
    -- Simple approach: drivers can see all active geofence zones for now
    -- In a more complex implementation, this would be based on their assignments
    is_active = true
  );

-- Admins and managers can insert geofence zones
CREATE POLICY geofence_zones_manager_insert ON public.geofence_zones FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'manager')));

-- Admins and managers can update geofence zones
CREATE POLICY geofence_zones_manager_update ON public.geofence_zones FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'manager')))
  WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'manager')));

-- Admins and managers can delete geofence zones
CREATE POLICY geofence_zones_manager_delete ON public.geofence_zones FOR DELETE
  USING (auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'manager')));

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_geofence_zones_type ON public.geofence_zones(type);
CREATE INDEX IF NOT EXISTS idx_geofence_zones_is_active ON public.geofence_zones(is_active);
CREATE INDEX IF NOT EXISTS idx_geofence_zones_name ON public.geofence_zones(name);
CREATE INDEX IF NOT EXISTS idx_geofence_zones_created_at ON public.geofence_zones(created_at DESC);

-- Add helpful comments
COMMENT ON TABLE public.geofence_zones IS 'Geofence zone definitions for location-based alerts and tracking';
COMMENT ON COLUMN public.geofence_zones.type IS 'Type of geofence: circle, polygon, or named location types';
COMMENT ON COLUMN public.geofence_zones.center_lat IS 'Latitude of center point (for circle type)';
COMMENT ON COLUMN public.geofence_zones.center_lng IS 'Longitude of center point (for circle type)';
COMMENT ON COLUMN public.geofence_zones.radius_meters IS 'Radius in meters (for circle type)';
COMMENT ON COLUMN public.geofence_zones.coordinates IS 'JSONB array of lat/lng points for polygon definition';

SELECT 'Day 35 migration complete: geofence_zones table created' AS result;
-- ─────────────────────────────────────────────────────────────────────
-- SRI JAYAM TRAVELS – DAY 34: GEOFENCE FOUNDATION
-- ─────────────────────────────────────────────────────────────────────
--
-- Creates the geofences table for storing geofence definitions
-- This is the foundation for future geofence detection implementation
--

-- ── 1. geofences table ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.geofences (
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
ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;

-- Policies for geofences
-- Admins and managers can see all geofences
CREATE POLICY geofences_manager_all ON public.geofences FOR SELECT
  USING (auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'manager')));

-- Drivers can see geofences related to their assigned vehicles/customers
CREATE POLICY geofences_driver_own ON public.geofences FOR SELECT
  USING (
    -- Simple approach: drivers can see all active geofences for now
    -- In a more complex implementation, this would be based on their assignments
    is_active = true
  );

-- Admins and managers can insert geofences
CREATE POLICY geofences_manager_insert ON public.geofences FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'manager')));

-- Admins and managers can update geofences
CREATE POLICY geofences_manager_update ON public.geofences FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'manager')))
  WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'manager')));

-- Admins and managers can delete geofences
CREATE POLICY geofences_manager_delete ON public.geofences FOR DELETE
  USING (auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'manager')));

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_geofences_type ON public.geofences(type);
CREATE INDEX IF NOT EXISTS idx_geofences_is_active ON public.geofences(is_active);
CREATE INDEX IF NOT EXISTS idx_geofences_name ON public.geofences(name);
CREATE INDEX IF NOT EXISTS idx_geofences_created_at ON public.geofences(created_at DESC);

-- Add helpful comments
COMMENT ON TABLE public.geofences IS 'Geofence definitions for location-based alerts and tracking';
COMMENT ON COLUMN public.geofences.type IS 'Type of geofence: circle, polygon, or named location types';
COMMENT ON COLUMN public.geofences.center_lat IS 'Latitude of center point (for circle type)';
COMMENT ON COLUMN public.geofences.center_lng IS 'Longitude of center point (for circle type)';
COMMENT ON COLUMN public.geofences.radius_meters IS 'Radius in meters (for circle type)';
COMMENT ON COLUMN public.geofences.coordinates IS 'JSONB array of lat/lng points for polygon definition';

SELECT 'Day 34 migration complete: geofences table created' AS result;
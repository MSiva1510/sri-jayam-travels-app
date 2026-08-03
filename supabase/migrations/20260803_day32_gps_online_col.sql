-- ─────────────────────────────────────────────────────────────
-- DAY 32 FIX: Add gps_online column to gps_tracking
-- KingsTrack GPS field: 'A' = Active/Valid, 'V' = Void/No fix
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.gps_tracking
  ADD COLUMN IF NOT EXISTS gps_online BOOLEAN;

CREATE INDEX IF NOT EXISTS idx_gps_tracking_gps_online
  ON public.gps_tracking (vehicle_id, timestamp DESC)
  WHERE gps_online = true;

SELECT 'Day 32 gps_online column added' AS result;

-- Sri Jayam Travels — trip charge columns on bookings
-- Bata goes straight to the driver (never company money), toll/fuel/
-- parking/extras are trip costs. The app reads/writes these columns and
-- retries without them if this migration hasn't been applied yet, but
-- apply it so bata actually persists.
--
-- Apply once in Supabase → SQL Editor. Idempotent (safe to re-run).

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS bata    numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS toll    numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS petrol  numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parking numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extras  numeric NOT NULL DEFAULT 0;

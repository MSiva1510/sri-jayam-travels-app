-- Sri Jayam Travels — per-trip driver allowance (salary) on bookings
-- The manager sets a variable allowance per trip at booking/approval time
-- (e.g. Rs. 1000 for a 300 km run). Monthly payroll = SUM(allowance) salary
-- + SUM(bata) customer extra. No incentives, no deductions.
--
-- Apply once in Supabase → SQL Editor. Idempotent (safe to re-run).

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS driver_allowance numeric NOT NULL DEFAULT 0;

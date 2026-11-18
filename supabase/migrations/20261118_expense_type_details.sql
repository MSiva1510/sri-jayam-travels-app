-- Sri Jayam Travels — expense type-specific detail columns
--
-- The New Expense form already collects extra details for Parking, Toll,
-- Driver Bata and Maintenance. The expenses table had no columns for them,
-- so those values were dropped by the repository whitelist on save. This
-- migration adds nullable columns so they persist without changing defaults,
-- constraints or any existing expense row.
--
-- Apply once in Supabase → SQL Editor. Idempotent (safe to re-run).

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS parking_location     text,
  ADD COLUMN IF NOT EXISTS parking_duration     numeric,
  ADD COLUMN IF NOT EXISTS toll_name            text,
  ADD COLUMN IF NOT EXISTS toll_route           text,
  ADD COLUMN IF NOT EXISTS bata_driver          text,
  ADD COLUMN IF NOT EXISTS bata_trip            text,
  ADD COLUMN IF NOT EXISTS maintenance_vendor   text,
  ADD COLUMN IF NOT EXISTS maintenance_invoice  text;

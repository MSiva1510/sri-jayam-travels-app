-- Persist the compliance and service fields already editable in the
-- Add / Edit Vehicle modal. The repository reads/writes these columns after
-- this migration is applied and falls back to the legacy column set before it.
-- Every new column is nullable, so existing vehicles are unaffected.

ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS insurance_provider text;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS permit_number text;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS permit_expiry date;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS fitness_cert_number text;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS pollution_cert_number text;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS last_service_date date;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS next_service_date date;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS next_service_km integer;

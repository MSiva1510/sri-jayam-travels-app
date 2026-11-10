-- ─────────────────────────────────────────────────────────────────────────────
-- Add VIP / Frequent / Blacklisted flags to customers table
--
-- These are manual flags set by staff in the Customers page. Auto-derived
-- flags (VIP by spend, Frequent by trip count) are computed on read and never
-- stored here.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS is_vip boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_frequent_traveller boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_blacklisted boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_customers_is_vip ON public.customers (is_vip);
CREATE INDEX IF NOT EXISTS idx_customers_is_frequent_traveller ON public.customers (is_frequent_traveller);
CREATE INDEX IF NOT EXISTS idx_customers_is_blacklisted ON public.customers (is_blacklisted);

-- ─────────────────────────────────────────────────────────────────────────────
-- Remove anonymous customer profile lookup
--
-- The public booking portal no longer pre-fills a customer name from a mobile
-- number. Allowing an unauthenticated caller to resolve any mobile number to
-- a name/VIP flag enabled customer enumeration, so the RPC is removed rather
-- than left callable. Public booking writes still go through
-- public.public_create_booking and are unaffected.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.public_get_customer_profile(text) FROM anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;
DROP FUNCTION IF EXISTS public.public_get_customer_profile(text);

-- ─────────────────────────────────────────────────────────────────────────────
-- Public customer profile lookup for the website booking portal
--
--   public_get_customer_profile(mobile) — SECURITY DEFINER RPC that lets an
--   unauthenticated portal visitor look up their own customer record by mobile
--   number. Returns only name + flags (is_vip, is_frequent_traveller) — never
--   internal IDs, addresses, or other PII. Used by PublicBooking.jsx to pre-fill
--   the booking form and show a "Welcome back" badge for registered customers.
--
--   Granted to anon so the public portal can call it without a session.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.public_get_customer_profile(p_mobile text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mobile text := regexp_replace(COALESCE(p_mobile, ''), '\D', '', 'g');
  v_row    record;
BEGIN
  IF v_mobile !~ '^[6-9][0-9]{9}$' THEN
    RAISE EXCEPTION 'A valid 10-digit mobile number is required' USING ERRCODE = '22023';
  END IF;

  SELECT name, is_vip, is_frequent_traveller, type, status
  INTO v_row
  FROM public.customers
  WHERE primary_mobile = v_mobile
     OR mobile = v_mobile
     OR alternate_mobile = v_mobile
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'name', v_row.name,
    'type', v_row.type,
    'status', v_row.status,
    'is_vip', v_row.is_vip,
    'is_frequent_traveller', v_row.is_frequent_traveller
  );
END;
$$;

REVOKE ALL ON FUNCTION public.public_get_customer_profile(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_get_customer_profile(text) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- Public login-page stats.
-- The login page is unauthenticated and anon has no table access (see
-- 20260915_security_hardening.sql), so the three headline numbers are
-- exposed through one read-only SECURITY DEFINER function that returns
-- aggregate counts only — never rows.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.public_login_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'active_vehicles', (SELECT count(*) FROM public.vehicles
                         WHERE COALESCE(status, 'active') NOT IN ('inactive', 'retired', 'sold')),
    'active_drivers',  (SELECT count(*) FROM public.drivers
                         WHERE COALESCE(status, 'available') NOT IN ('inactive', 'offline', 'terminated')),
    -- Indian financial year: 1 April → 31 March
    'trips_fy',        (SELECT count(*) FROM public.bookings
                         WHERE status NOT IN ('cancelled', 'draft')
                           AND start_date >= make_date(
                                 CASE WHEN extract(month FROM current_date) >= 4
                                      THEN extract(year FROM current_date)::int
                                      ELSE extract(year FROM current_date)::int - 1 END, 4, 1))
  )
$$;

REVOKE ALL ON FUNCTION public.public_login_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_login_stats() TO anon, authenticated;

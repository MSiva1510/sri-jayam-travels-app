-- ─────────────────────────────────────────────────────────────────────
-- SECURITY HARDENING — replaces the "FOR ALL USING (true)" policies from
-- 20260810_supabase_app_facing_rls.sql.
--
-- Before this migration the anon key (shipped in the browser bundle) could
-- read and write EVERY table, including profiles (role escalation), settings
-- (GPS vendor credentials) and customers (phone-number enumeration).
--
-- After this migration:
--   * anon      → no table access at all; only public_create_booking() RPC
--   * driver    → operational tables; own profile; read role_permissions
--   * manager   → operational tables + read settings; read all profiles
--   * admin     → everything (settings, role_permissions, backups, profiles)
--   * role/status on profiles can only be changed by an admin (trigger)
-- ─────────────────────────────────────────────────────────────────────

-- ── 0. Drop every existing policy in public first ────────────────────
-- (an older is_staff() helper exists on the live DB and old policies
--  depend on it; policies are recreated in section 3)
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;
DROP FUNCTION IF EXISTS public.is_staff();
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.app_role();

-- ── 1. Role helper functions ─────────────────────────────────────────
-- SECURITY DEFINER so they can read profiles without recursing through
-- the profiles RLS policy (which is what caused the old "stack depth" bug).

CREATE OR REPLACE FUNCTION public.app_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND COALESCE(p.status, 'active') = 'active'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.app_role() = 'admin', false)
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.app_role() IN ('admin', 'manager'), false)
$$;

REVOKE ALL ON FUNCTION public.app_role()  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin()  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_staff()  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

-- ── 2. Lock anon out of the whole public schema ──────────────────────
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
-- Functions: PostgREST exposes every function as an RPC. Strip PUBLIC/anon
-- execute from all of them; signed-in users keep execute; the two public
-- RPCs are re-granted explicitly at the end of this file.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon;
-- anon still needs schema usage to call the public booking RPC
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- ── 3. Re-create policies for every table in public ──────────────────
DO $$
DECLARE
  t          record;
  pol        text;
  tbl        text;
  admin_only text[] := ARRAY[
    'settings', 'role_permissions', 'backup_config', 'backup_history',
    'communication_providers'
  ];
  -- Written by any signed-in user, readable only by admins
  append_only text[] := ARRAY['audit_logs', 'session_log', 'error_log'];
BEGIN
  FOR t IN
    SELECT c.relname AS name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')          -- ordinary + partitioned tables
      AND c.relname NOT LIKE 'pg_%'
      AND c.relname <> 'schema_migrations'
  LOOP
    tbl := t.name;

    -- Drop every existing policy (including the old *_app_all ones)
    FOR pol IN
      SELECT p.polname FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, tbl);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tbl);

    IF tbl = 'profiles' THEN
      -- Everyone sees their own row; staff see everyone
      EXECUTE $p$CREATE POLICY profiles_select ON public.profiles
        FOR SELECT TO authenticated
        USING (id = auth.uid() OR public.is_staff())$p$;
      -- Only admins create accounts (adminCreateUser runs under the admin session)
      EXECUTE $p$CREATE POLICY profiles_insert ON public.profiles
        FOR INSERT TO authenticated
        WITH CHECK (public.is_admin())$p$;
      -- Users edit their own row (role/status guarded by trigger below); admins edit all
      EXECUTE $p$CREATE POLICY profiles_update ON public.profiles
        FOR UPDATE TO authenticated
        USING (id = auth.uid() OR public.is_admin())
        WITH CHECK (id = auth.uid() OR public.is_admin())$p$;
      EXECUTE $p$CREATE POLICY profiles_delete ON public.profiles
        FOR DELETE TO authenticated
        USING (public.is_admin())$p$;

    ELSIF tbl = ANY(admin_only) THEN
      -- Staff may read (managers need GPS/app settings on /fleet); admins write.
      -- role_permissions is readable by every signed-in user (PermissionEngine boot).
      EXECUTE format($p$CREATE POLICY %I ON public.%I
        FOR SELECT TO authenticated
        USING (%s)$p$,
        tbl || '_select', tbl,
        CASE WHEN tbl = 'role_permissions' THEN 'public.app_role() IS NOT NULL' ELSE 'public.is_staff()' END);
      EXECUTE format($p$CREATE POLICY %I ON public.%I
        FOR INSERT TO authenticated WITH CHECK (public.is_admin())$p$, tbl || '_insert', tbl);
      EXECUTE format($p$CREATE POLICY %I ON public.%I
        FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())$p$, tbl || '_update', tbl);
      EXECUTE format($p$CREATE POLICY %I ON public.%I
        FOR DELETE TO authenticated USING (public.is_admin())$p$, tbl || '_delete', tbl);

    ELSIF tbl = ANY(append_only) THEN
      EXECUTE format($p$CREATE POLICY %I ON public.%I
        FOR SELECT TO authenticated USING (public.is_admin())$p$, tbl || '_select', tbl);
      EXECUTE format($p$CREATE POLICY %I ON public.%I
        FOR INSERT TO authenticated WITH CHECK (public.app_role() IS NOT NULL)$p$, tbl || '_insert', tbl);
      -- admins may resolve error_log entries / prune logs
      EXECUTE format($p$CREATE POLICY %I ON public.%I
        FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())$p$, tbl || '_update', tbl);
      EXECUTE format($p$CREATE POLICY %I ON public.%I
        FOR DELETE TO authenticated USING (public.is_admin())$p$, tbl || '_delete', tbl);

    ELSE
      -- Operational tables (bookings, customers, drivers, vehicles, attendance,
      -- expenses, gps_tracking, notifications ...): any active signed-in user.
      -- app_role() returns NULL for deactivated/unknown profiles → denied.
      EXECUTE format($p$CREATE POLICY %I ON public.%I
        FOR ALL TO authenticated
        USING (public.app_role() IS NOT NULL)
        WITH CHECK (public.app_role() IS NOT NULL)$p$, tbl || '_authenticated_all', tbl);
    END IF;
  END LOOP;
END $$;

-- Views (e.g. system_health_summary) are not covered by the loop above
DO $$
DECLARE v record;
BEGIN
  FOR v IN
    SELECT table_name FROM information_schema.views WHERE table_schema = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', v.table_name);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', v.table_name);
  END LOOP;
END $$;

-- ── 4. Guard privileged profile columns ──────────────────────────────
-- A user may edit their own name/phone/avatar but never their role or status.
CREATE OR REPLACE FUNCTION public.profiles_guard_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- auth.uid() IS NULL → service role / SQL editor / dashboard: allowed.
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Only an administrator can create profiles'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Only an administrator can change role or status'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_guard_privileged ON public.profiles;
CREATE TRIGGER trg_profiles_guard_privileged
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_privileged_columns();
REVOKE ALL ON FUNCTION public.profiles_guard_privileged_columns() FROM PUBLIC, anon, authenticated;

-- ── 5. Public booking RPC (the ONLY thing anon may call) ─────────────
-- Replaces direct anon INSERTs into bookings/customers and the anon
-- customer lookup-by-mobile that leaked customer names.
CREATE OR REPLACE FUNCTION public.public_create_booking(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name        text  := left(btrim(COALESCE(payload->>'name', '')), 120);
  v_mobile      text  := regexp_replace(COALESCE(payload->>'mobile', ''), '\D', '', 'g');
  v_type        text  := payload->>'type';
  v_start_date  date;
  v_start_time  text  := left(COALESCE(payload->>'start_time', ''), 10);
  v_pickup      text  := left(COALESCE(payload->>'pickup', ''), 500);
  v_drop        text  := left(COALESCE(payload->>'drop', ''), 500);
  v_type_data   jsonb := COALESCE(payload->'type_data', '{}'::jsonb);
  v_ref         text;
  v_booking_id  text;
  v_customer_id uuid;
  v_recent      int;
BEGIN
  -- ── validation ──
  IF length(v_name) < 2 THEN
    RAISE EXCEPTION 'Name is required' USING ERRCODE = '22023';
  END IF;
  IF v_mobile !~ '^[6-9][0-9]{9}$' THEN
    RAISE EXCEPTION 'A valid 10-digit mobile number is required' USING ERRCODE = '22023';
  END IF;
  IF v_type IS NULL OR v_type NOT IN
     ('one_way','round_trip','multi_loc','local_visit','multi_day','self_drive') THEN
    RAISE EXCEPTION 'Invalid trip type' USING ERRCODE = '22023';
  END IF;
  BEGIN
    v_start_date := (payload->>'start_date')::date;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Invalid travel date' USING ERRCODE = '22023';
  END;
  IF v_start_date IS NULL OR v_start_date < current_date THEN
    RAISE EXCEPTION 'Travel date cannot be in the past' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_type_data) <> 'object' OR length(v_type_data::text) > 4000 THEN
    RAISE EXCEPTION 'Invalid booking details' USING ERRCODE = '22023';
  END IF;

  -- ── crude abuse limit: max 5 public bookings per mobile per hour ──
  SELECT count(*) INTO v_recent
  FROM public.bookings
  WHERE customer_contact = v_mobile
    AND created_at > now() - interval '1 hour'
    AND COALESCE(type_data->>'source', '') = 'public_portal';
  IF v_recent >= 5 THEN
    RAISE EXCEPTION 'Too many booking requests. Please call us directly.' USING ERRCODE = '54000';
  END IF;

  -- ── customer: reuse by mobile, otherwise create (never returned to caller) ──
  SELECT id INTO v_customer_id
  FROM public.customers
  WHERE primary_mobile = v_mobile
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (customer_id, name, type, status, primary_mobile, mobile, phone, notes, is_active)
    VALUES ('CUST-' || to_char(now(), 'YYMMDD') || '-' || lpad((floor(random()*10000))::int::text, 4, '0'),
            v_name, 'individual', 'active', v_mobile, v_mobile, v_mobile, 'Auto-created from public booking portal.', true)
    RETURNING id INTO v_customer_id;
  END IF;

  -- ── booking ──
  v_ref        := 'SJT-' || to_char(now(), 'YYMMDD') || '-' || lpad((floor(random()*9000)+1000)::int::text, 4, '0');
  v_booking_id := 'BK-' || right((floor(extract(epoch FROM now())*1000))::bigint::text, 6);

  INSERT INTO public.bookings (
    booking_id, booking_number, type, status,
    customer_id, customer_name, customer_contact,
    pickup_location, drop_location, start_date, start_time,
    total_fare, notes, type_data, created_by, created_at, updated_at
  ) VALUES (
    v_booking_id, v_ref, v_type, 'draft',
    v_customer_id, v_name, v_mobile,
    NULLIF(v_pickup, ''), NULLIF(v_drop, ''), v_start_date, NULLIF(v_start_time, ''),
    0,
    'Public booking via portal. Customer: ' || v_name || ' (' || v_mobile || ')',
    v_type_data || jsonb_build_object('source', 'public_portal', 'created_by', 'public'),
    'public', now(), now()
  );

  RETURN jsonb_build_object('booking_number', v_ref);
END;
$$;

REVOKE ALL ON FUNCTION public.public_create_booking(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_create_booking(jsonb) TO anon, authenticated;

-- ── 6. Storage: avatars + documents buckets are for signed-in users only ─
-- Only policies that mention these two buckets are replaced; any other
-- bucket's policies are left untouched.
DO $$
DECLARE pol record;
BEGIN
  IF to_regclass('storage.objects') IS NULL THEN RETURN; END IF;

  FOR pol IN
    SELECT p.polname
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage' AND c.relname = 'objects'
      AND (
        COALESCE(pg_get_expr(p.polqual, p.polrelid), '')      ~ '''(avatars|documents)'''
        OR COALESCE(pg_get_expr(p.polwithcheck, p.polrelid), '') ~ '''(avatars|documents)'''
        OR p.polname ~* '^sjt_'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.polname);
  END LOOP;

  EXECUTE $p$CREATE POLICY sjt_app_buckets_select ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id IN ('avatars', 'documents') AND public.app_role() IS NOT NULL)$p$;
  EXECUTE $p$CREATE POLICY sjt_app_buckets_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id IN ('avatars', 'documents') AND public.app_role() IS NOT NULL)$p$;
  EXECUTE $p$CREATE POLICY sjt_app_buckets_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id IN ('avatars', 'documents') AND public.app_role() IS NOT NULL)
    WITH CHECK (bucket_id IN ('avatars', 'documents') AND public.app_role() IS NOT NULL)$p$;
  EXECUTE $p$CREATE POLICY sjt_app_buckets_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id IN ('avatars', 'documents') AND (owner = auth.uid() OR public.is_staff()))$p$;
END $$;

-- ── 7. Public RPCs (the only functions anon may call) ─────────────────
GRANT EXECUTE ON FUNCTION public.public_create_booking(jsonb) TO anon, authenticated;
DO $$ BEGIN
  IF to_regprocedure('public.public_login_stats()') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.public_login_stats() TO anon, authenticated;
  END IF;
END $$;

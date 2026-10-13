-- Sri Jayam Travels — fix public_create_booking for time-typed start_time.
--
-- The live bookings.start_time column is `time without time zone`, but the
-- function inserted the raw text variable, which fails with 42804
-- ("column is of type time without time zone but expression is of type text")
-- for every website booking that includes a pickup time. Cast safely and
-- report a clean validation error (22023) on garbage input instead.
--
-- Apply in Supabase Dashboard → SQL editor (or via `supabase db push`).

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
  v_start_time_t time := NULL;
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
  IF NULLIF(v_start_time, '') IS NOT NULL THEN
    BEGIN
      v_start_time_t := NULLIF(v_start_time, '')::time;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Invalid time format (use HH:MM)' USING ERRCODE = '22023';
    END;
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
    NULLIF(v_pickup, ''), NULLIF(v_drop, ''), v_start_date, v_start_time_t,
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

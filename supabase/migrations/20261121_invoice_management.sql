-- ─────────────────────────────────────────────────────────────────────
-- INVOICE MANAGEMENT — issuance metadata + customer payments.
--
-- This migration is additive only. It does NOT touch bookings or
-- public.manager_non_trip_invoices: trip invoices continue to be rendered
-- from completed/closed bookings and manual bills/quotations continue to
-- live in the existing manager_non_trip_invoices table. The two tables
-- below only record issuance + payment state for those documents.
--
-- Anon has no table access. Authenticated users get SELECT only where allowed
-- (admin / manager / roles permitted to manage invoices); every mutation goes
-- through the SECURITY DEFINER RPCs below.
-- ─────────────────────────────────────────────────────────────────────

-- ── 1. Tables ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.invoice_records (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number   text NOT NULL UNIQUE,
  source_type      text NOT NULL,
  source_id        text NOT NULL,
  booking_id       uuid NULL,
  customer_name    text NOT NULL,
  customer_contact text NULL,
  total_amount     numeric(12,2) NOT NULL,
  status           text NOT NULL DEFAULT 'pending',
  invoice_date     date NOT NULL DEFAULT CURRENT_DATE,
  due_date         date NULL,
  idempotency_key  text NULL UNIQUE,
  created_by       uuid NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_records_source_type_check
    CHECK (source_type IN ('booking', 'manual', 'quotation')),
  CONSTRAINT invoice_records_total_amount_check
    CHECK (total_amount >= 0),
  CONSTRAINT invoice_records_status_check
    CHECK (status IN ('draft', 'pending', 'partial', 'paid', 'cancelled')),
  CONSTRAINT invoice_records_source_unique UNIQUE (source_type, source_id)
);

CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      uuid NOT NULL REFERENCES public.invoice_records(id) ON DELETE CASCADE,
  amount          numeric(12,2) NOT NULL,
  method          text NOT NULL,
  reference       text NULL,
  payment_date    date NOT NULL DEFAULT CURRENT_DATE,
  status          text NOT NULL DEFAULT 'recorded',
  idempotency_key text NULL UNIQUE,
  created_by      uuid NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_payments_amount_check CHECK (amount > 0),
  CONSTRAINT invoice_payments_method_check
    CHECK (method IN ('Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Other')),
  CONSTRAINT invoice_payments_status_check CHECK (status IN ('recorded', 'reversed', 'refunded'))
);

-- Keep the check constraint current when this migration is re-applied.
ALTER TABLE public.invoice_payments DROP CONSTRAINT IF EXISTS invoice_payments_status_check;
ALTER TABLE public.invoice_payments ADD CONSTRAINT invoice_payments_status_check
  CHECK (status IN ('recorded', 'reversed', 'refunded'));

CREATE INDEX IF NOT EXISTS invoice_payments_invoice_id_idx
  ON public.invoice_payments (invoice_id);

-- ── 2. Permission helper ────────────────────────────────────────────
-- Defined before the SELECT policies so a role allowed to write through the
-- RPCs can also read the records it creates.

CREATE OR REPLACE FUNCTION public.can_manage_invoices()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND COALESCE(p.status, 'active') = 'active'
      AND p.role = 'admin'
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.role_permissions rp ON rp.role = p.role
    WHERE p.id = auth.uid()
      AND COALESCE(p.status, 'active') = 'active'
      AND rp.permission = 'generate_invoice'
      AND COALESCE(rp.is_allowed, false) = true
  )
  -- PermissionEngine enables generate_invoice for accountants by default.
  -- An explicit role_permissions row can still turn it off.
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND COALESCE(p.status, 'active') = 'active'
      AND p.role = 'accountant'
      AND NOT EXISTS (
        SELECT 1
        FROM public.role_permissions rp
        WHERE rp.role = 'accountant'
          AND rp.permission = 'generate_invoice'
          AND COALESCE(rp.is_allowed, true) = false
      )
  )
$$;

REVOKE ALL ON FUNCTION public.can_manage_invoices() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_invoices() TO authenticated;

-- ── 3. Row level security ───────────────────────────────────────────
-- Admin/manager may read, as may any role the write RPCs allow to manage
-- invoices (for example an accountant with generate_invoice). There are
-- deliberately no INSERT/UPDATE/DELETE policies and no table-level write
-- grants for authenticated users.

ALTER TABLE public.invoice_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.invoice_records FROM PUBLIC, anon;
REVOKE ALL ON public.invoice_payments FROM PUBLIC, anon;
GRANT SELECT ON public.invoice_records TO authenticated;
GRANT SELECT ON public.invoice_payments TO authenticated;

DROP POLICY IF EXISTS invoice_records_select_staff ON public.invoice_records;
CREATE POLICY invoice_records_select_staff ON public.invoice_records
  FOR SELECT TO authenticated
  USING (public.app_role() IN ('admin', 'manager') OR public.can_manage_invoices());

DROP POLICY IF EXISTS invoice_payments_select_staff ON public.invoice_payments;
CREATE POLICY invoice_payments_select_staff ON public.invoice_payments
  FOR SELECT TO authenticated
  USING (public.app_role() IN ('admin', 'manager') OR public.can_manage_invoices());

-- ── 4. Timestamp helpers ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.invoice_records_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

-- A payment insert refreshes its invoice even when the status does not
-- change (for example a draft or cancelled invoice).
CREATE OR REPLACE FUNCTION public.invoice_payments_touch_invoice_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.invoice_records
     SET updated_at = now()
   WHERE id = NEW.invoice_id;
  RETURN NEW;
END
$$;

-- A reversal/refund must also recompute the invoice status. Recorded payments
-- are the only ones that count; history rows are kept for audit.
CREATE OR REPLACE FUNCTION public.invoice_payments_recompute_invoice_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id  uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.invoice_id ELSE NEW.invoice_id END;
  v_total       numeric(12,2);
  v_status      text;
  v_paid        numeric(14,2);
  v_new_status  text;
BEGIN
  SELECT total_amount, status INTO v_total, v_status
    FROM public.invoice_records
   WHERE id = v_invoice_id;
  IF NOT FOUND OR v_status IN ('draft', 'cancelled') THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(amount), 0)
    INTO v_paid
    FROM public.invoice_payments
   WHERE invoice_id = v_invoice_id
     AND status = 'recorded';

  IF v_paid >= v_total THEN
    v_new_status := 'paid';
  ELSIF v_paid > 0 THEN
    v_new_status := 'partial';
  ELSE
    v_new_status := 'pending';
  END IF;

  UPDATE public.invoice_records
     SET status = v_new_status
   WHERE id = v_invoice_id
     AND status NOT IN ('draft', 'cancelled');
  RETURN NULL;
END
$$;

REVOKE ALL ON FUNCTION public.invoice_records_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invoice_payments_touch_invoice_record() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invoice_payments_recompute_invoice_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS invoice_records_set_updated_at ON public.invoice_records;
CREATE TRIGGER invoice_records_set_updated_at
  BEFORE UPDATE ON public.invoice_records
  FOR EACH ROW EXECUTE FUNCTION public.invoice_records_set_updated_at();

DROP TRIGGER IF EXISTS invoice_payments_touch_invoice_record ON public.invoice_payments;
CREATE TRIGGER invoice_payments_touch_invoice_record
  AFTER INSERT ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.invoice_payments_touch_invoice_record();

DROP TRIGGER IF EXISTS invoice_payments_recompute_status ON public.invoice_payments;
CREATE TRIGGER invoice_payments_recompute_status
  AFTER INSERT OR UPDATE OF status OR DELETE ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.invoice_payments_recompute_invoice_status();

-- ── 5. Write RPCs ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_invoice_record(
  p_invoice_number   text,
  p_source_type      text,
  p_source_id        text,
  p_booking_id       uuid DEFAULT NULL,
  p_customer_name    text DEFAULT NULL,
  p_customer_contact text DEFAULT NULL,
  p_total_amount     numeric DEFAULT NULL,
  p_invoice_date     date DEFAULT CURRENT_DATE,
  p_due_date         date DEFAULT NULL,
  p_status           text DEFAULT 'pending',
  p_idempotency_key  text DEFAULT NULL,
  p_subtotal         numeric DEFAULT 0,
  p_discount         numeric DEFAULT 0,
  p_tax_percent      numeric DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source_type     text := lower(btrim(p_source_type));
  v_status          text := lower(btrim(p_status));
  v_invoice_number  text := btrim(p_invoice_number);
  v_source_id       text := btrim(p_source_id);
  v_customer_name   text := btrim(p_customer_name);
  v_idempotency_key text := nullif(btrim(p_idempotency_key), '');
  v_expected_total  numeric(14,2);
  v_existing_id     uuid;
  v_booking_id      uuid := p_booking_id;
  v_booking_no      text;
  v_booking_status  text;
BEGIN
  IF NOT public.can_manage_invoices() THEN
    RAISE EXCEPTION 'Not authorized to generate invoices'
      USING ERRCODE = '42501';
  END IF;

  IF v_source_type IS NULL OR v_source_type NOT IN ('booking', 'manual', 'quotation') THEN
    RAISE EXCEPTION 'Invalid invoice source type: %', p_source_type
      USING ERRCODE = '22023';
  END IF;
  IF v_invoice_number IS NULL OR v_invoice_number = '' THEN
    RAISE EXCEPTION 'Invoice number is required' USING ERRCODE = '22023';
  END IF;
  IF v_source_id IS NULL OR v_source_id = '' THEN
    RAISE EXCEPTION 'Invoice source id is required' USING ERRCODE = '22023';
  END IF;
  IF v_customer_name IS NULL OR v_customer_name = '' THEN
    RAISE EXCEPTION 'Customer name is required' USING ERRCODE = '22023';
  END IF;
  IF p_total_amount IS NULL OR p_total_amount < 0 THEN
    RAISE EXCEPTION 'Invoice total amount must be zero or greater'
      USING ERRCODE = '22023';
  END IF;

  -- Trip invoices are only legal for real completed/closed bookings. The UI
  -- uses the same rule, but a direct RPC caller must not be able to bill a
  -- cancelled, ongoing or invented trip.
  IF v_source_type = 'booking' THEN
    SELECT b.id, b.booking_no::text, lower(btrim(b.status))
      INTO v_booking_id, v_booking_no, v_booking_status
      FROM public.bookings b
     WHERE (p_booking_id IS NOT NULL AND b.id = p_booking_id)
        OR (p_booking_id IS NULL AND b.booking_no::text = v_source_id)
     LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Booking % does not exist',
        COALESCE(p_booking_id::text, v_source_id)
        USING ERRCODE = '23503';
    END IF;
    IF v_booking_status NOT IN ('completed', 'closed') THEN
      RAISE EXCEPTION 'Booking % is not completed and cannot be invoiced',
        COALESCE(v_booking_no, v_booking_id::text)
        USING ERRCODE = '22023';
    END IF;
    IF v_source_id NOT IN (v_booking_id::text, COALESCE(v_booking_no, '')) THEN
      RAISE EXCEPTION 'Invoice source id % does not match booking %',
        v_source_id, v_booking_id
        USING ERRCODE = '22023';
    END IF;
  ELSE
    v_booking_id := NULL;
  END IF;

  -- The breakdown is mandatory for positive-value documents so a caller
  -- cannot bypass the computed-total check by sending p_subtotal = 0.
  IF p_total_amount > 0 AND COALESCE(p_subtotal, 0) <= 0 THEN
    RAISE EXCEPTION 'Invoice subtotal is required to validate the total'
      USING ERRCODE = '22023';
  END IF;
  IF COALESCE(p_subtotal, 0) > 0 THEN
    v_expected_total := round(
      (p_subtotal - greatest(0, COALESCE(p_discount, 0))) *
        (1 + COALESCE(p_tax_percent, 0) / 100.0),
      2
    );
    IF round(p_total_amount, 2) <> v_expected_total THEN
      RAISE EXCEPTION 'Invoice total % does not match computed total %',
        p_total_amount, v_expected_total
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_status IS NULL OR v_status NOT IN ('draft', 'pending', 'partial', 'paid', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid invoice status: %', p_status
      USING ERRCODE = '22023';
  END IF;
  -- Issuance always starts as pending; clients cannot mint paid/draft rows.
  v_status := 'pending';
  IF p_invoice_date IS NULL THEN
    RAISE EXCEPTION 'Invoice date is required' USING ERRCODE = '22023';
  END IF;
  IF p_due_date IS NOT NULL AND p_due_date < p_invoice_date THEN
    RAISE EXCEPTION 'Due date cannot be before the invoice date'
      USING ERRCODE = '22023';
  END IF;

  IF v_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_id
      FROM public.invoice_records
     WHERE idempotency_key = v_idempotency_key;
    IF FOUND THEN
      RETURN v_existing_id;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.invoice_records WHERE invoice_number = v_invoice_number) THEN
    RAISE EXCEPTION 'Invoice number % already exists', v_invoice_number
      USING ERRCODE = '23505';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM public.invoice_records
     WHERE source_type = v_source_type AND source_id = v_source_id
  ) THEN
    RAISE EXCEPTION 'An invoice already exists for % %', v_source_type, v_source_id
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.invoice_records (
    invoice_number, source_type, source_id, booking_id,
    customer_name, customer_contact, total_amount, status,
    invoice_date, due_date, idempotency_key, created_by
  ) VALUES (
    v_invoice_number, v_source_type, v_source_id, v_booking_id,
    v_customer_name, nullif(btrim(p_customer_contact), ''), round(p_total_amount, 2), v_status,
    p_invoice_date, p_due_date, v_idempotency_key, auth.uid()
  )
  RETURNING id INTO v_existing_id;

  RETURN v_existing_id;
END
$$;

CREATE OR REPLACE FUNCTION public.record_invoice_payment(
  p_invoice_id      uuid,
  p_amount          numeric,
  p_method          text,
  p_reference       text DEFAULT NULL,
  p_payment_date    date DEFAULT CURRENT_DATE,
  p_idempotency_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_idempotency_key text := nullif(btrim(p_idempotency_key), '');
  v_existing_id     uuid;
  v_total_amount    numeric(12,2);
  v_invoice_status  text;
  v_paid_amount     numeric(14,2);
  v_new_status      text;
  v_payment_id      uuid;
BEGIN
  IF NOT public.can_manage_invoices() THEN
    RAISE EXCEPTION 'Not authorized to record invoice payments'
      USING ERRCODE = '42501';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero'
      USING ERRCODE = '22023';
  END IF;
  IF p_method IS NULL OR btrim(p_method) NOT IN ('Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Other') THEN
    RAISE EXCEPTION 'Invalid payment method: %', p_method
      USING ERRCODE = '22023';
  END IF;

  SELECT total_amount, status
    INTO v_total_amount, v_invoice_status
    FROM public.invoice_records
   WHERE id = p_invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice % does not exist', p_invoice_id
      USING ERRCODE = '23503';
  END IF;

  IF v_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_id
      FROM public.invoice_payments
     WHERE idempotency_key = v_idempotency_key;
    IF FOUND THEN
      RETURN v_existing_id;
    END IF;
  END IF;

  -- Revalidate the outstanding balance server-side; the UI guard is only a
  -- convenience. Reversed/refunded rows are already excluded from this sum.
  SELECT COALESCE(SUM(amount), 0)
    INTO v_paid_amount
    FROM public.invoice_payments
   WHERE invoice_id = p_invoice_id
     AND status = 'recorded';
  IF round(v_paid_amount + p_amount, 2) > round(v_total_amount, 2) THEN
    RAISE EXCEPTION 'Payment amount % exceeds the outstanding balance %',
      p_amount, round(v_total_amount - v_paid_amount, 2)
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.invoice_payments (
    invoice_id, amount, method, reference, payment_date,
    status, idempotency_key, created_by
  ) VALUES (
    p_invoice_id, p_amount, btrim(p_method),
    nullif(btrim(p_reference), ''), p_payment_date,
    'recorded', v_idempotency_key, auth.uid()
  )
  RETURNING id INTO v_payment_id;

  -- Draft and cancelled invoices are never promoted by a payment.
  IF v_invoice_status NOT IN ('draft', 'cancelled') THEN
    SELECT COALESCE(SUM(amount), 0)
      INTO v_paid_amount
      FROM public.invoice_payments
     WHERE invoice_id = p_invoice_id
       AND status = 'recorded';

    IF v_paid_amount >= v_total_amount THEN
      v_new_status := 'paid';
    ELSIF v_paid_amount > 0 THEN
      v_new_status := 'partial';
    ELSE
      v_new_status := 'pending';
    END IF;

    UPDATE public.invoice_records
       SET status = v_new_status
     WHERE id = p_invoice_id
       AND status NOT IN ('draft', 'cancelled');
  END IF;

  RETURN v_payment_id;
END
$$;

REVOKE ALL ON FUNCTION public.create_invoice_record(text, text, text, uuid, text, text, numeric, date, date, text, text, numeric, numeric, numeric)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_invoice_payment(uuid, numeric, text, text, date, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_invoice_record(text, text, text, uuid, text, text, numeric, date, date, text, text, numeric, numeric, numeric)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_invoice_payment(uuid, numeric, text, text, date, text)
  TO authenticated;

// ─────────────────────────────────────────────────────────────────────────────
// invoice_management.test.mjs — SQL tests for
// migrations/20261121_invoice_management.sql. Runs the migration on PGlite
// over a Supabase-like scaffold (anon / authenticated, auth.uid(), profiles,
// role_permissions) and checks tables, RLS, RPC validation, idempotency,
// totals and payment status transitions.
//
//   cd supabase/tests && npm install && npm test
// ─────────────────────────────────────────────────────────────────────────────
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const MIGRATION = readFileSync(
  new URL('../migrations/20261121_invoice_management.sql', import.meta.url),
  'utf8',
)

const db = new PGlite()

const ADMIN = '11111111-1111-1111-1111-111111111111'
const MGR   = '22222222-2222-2222-2222-222222222222'
const DRIVER = '33333333-3333-3333-3333-333333333333'
const ACCOUNTANT = '44444444-4444-4444-4444-444444444444'
const BOOK_DONE = '55555555-5555-5555-5555-555555555555'
const BOOK_ONGOING = '66666666-6666-6666-6666-666666666666'
const BOOK_CANCELLED = '77777777-7777-7777-7777-777777777777'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

await db.exec(`
  DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth, public TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;

  CREATE TABLE public.profiles (
    id uuid PRIMARY KEY,
    role text NOT NULL,
    status text NOT NULL DEFAULT 'active'
  );
  CREATE TABLE public.role_permissions (
    role text NOT NULL,
    permission text NOT NULL,
    is_allowed boolean NOT NULL DEFAULT false
  );
  CREATE TABLE public.bookings (
    id uuid PRIMARY KEY,
    booking_no text NOT NULL UNIQUE,
    status text NOT NULL
  );
  INSERT INTO public.bookings (id, booking_no, status) VALUES
    ('${BOOK_DONE}', 'BK-DONE', 'completed'),
    ('${BOOK_ONGOING}', 'BK-ONGOING', 'started'),
    ('${BOOK_CANCELLED}', 'BK-CANCELLED', 'cancelled');

  CREATE OR REPLACE FUNCTION public.app_role()
  RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT p.role
      FROM public.profiles p
     WHERE p.id = auth.uid()
       AND COALESCE(p.status, 'active') = 'active'
     LIMIT 1
  $$;
  REVOKE ALL ON FUNCTION public.app_role() FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.app_role() TO authenticated;

  INSERT INTO public.profiles (id, role, status) VALUES
    ('${ADMIN}', 'admin', 'active'),
    ('${MGR}', 'manager', 'active'),
    ('${DRIVER}', 'driver', 'active'),
    ('${ACCOUNTANT}', 'accountant', 'active');
  -- Accountants can manage invoices by default in PermissionEngine; no
  -- role_permissions row is inserted so the default is exercised. The manager
  -- is denied until the authorization test explicitly grants the permission.
`)

let passed = 0
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ok  ', name) }
  catch (e) { console.log('  FAIL', name, '\n       ', e.message); process.exitCode = 1 }
}

const one = async (sql, params = []) => (await db.query(sql, params)).rows[0]
const as = async (uid, role) => db.exec(
  `RESET ROLE; SELECT set_config('test.uid', '${uid ?? ''}', false);${role ? ` SET ROLE ${role};` : ''}`,
)
const reset = () => db.exec('RESET ROLE')
const rejects = async (fn, re) => {
  let err
  try { await fn() } catch (e) { err = e }
  assert.ok(err, 'expected an error')
  assert.match(err.message, re)
}

const createInvoice = async (overrides = {}) => {
  const o = {
    invoiceNumber: 'INV-DEFAULT',
    sourceType: 'manual',
    sourceId: 'SRC-DEFAULT',
    bookingId: null,
    customerName: 'Test Customer',
    customerContact: null,
    totalAmount: 100,
    invoiceDate: '2026-11-21',
    dueDate: null,
    status: 'pending',
    idempotencyKey: null,
    subtotal: null,
    discount: null,
    taxPercent: null,
    ...overrides,
  }
  // The app always sends the itemised subtotal. Keep the helper realistic so
  // tests only omit it when explicitly exercising that validation rule.
  if (overrides.subtotal === undefined) o.subtotal = o.totalAmount
  if (overrides.discount === undefined) o.discount = 0
  if (overrides.taxPercent === undefined) o.taxPercent = 0
  const { rows } = await db.query(`
    SELECT public.create_invoice_record(
      p_invoice_number   := $1,
      p_source_type      := $2,
      p_source_id        := $3,
      p_booking_id       := $4,
      p_customer_name    := $5,
      p_customer_contact := $6,
      p_total_amount     := $7,
      p_invoice_date     := $8,
      p_due_date         := $9,
      p_status           := $10,
      p_idempotency_key  := $11,
      p_subtotal         := $12,
      p_discount         := $13,
      p_tax_percent      := $14
    ) AS id
  `, [
    o.invoiceNumber, o.sourceType, o.sourceId, o.bookingId,
    o.customerName, o.customerContact, o.totalAmount, o.invoiceDate,
    o.dueDate, o.status, o.idempotencyKey, o.subtotal, o.discount, o.taxPercent,
  ])
  return rows[0].id
}

const recordPayment = async (overrides = {}) => {
  const o = {
    invoiceId: null,
    amount: 10,
    method: 'Cash',
    reference: null,
    paymentDate: '2026-11-21',
    idempotencyKey: null,
    ...overrides,
  }
  const { rows } = await db.query(`
    SELECT public.record_invoice_payment(
      p_invoice_id      := $1,
      p_amount          := $2,
      p_method          := $3,
      p_reference       := $4,
      p_payment_date    := $5,
      p_idempotency_key := $6
    ) AS id
  `, [o.invoiceId, o.amount, o.method, o.reference, o.paymentDate, o.idempotencyKey])
  return rows[0].id
}

const count = async (sql, params = []) => {
  const row = await one(`SELECT count(*)::int AS n ${sql}`, params)
  return row.n
}

const tableExists = (name) => one(`
  SELECT 1 AS ok FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = $1
`, [name])
const functionExists = (name, nargs) => one(`
  SELECT 1 AS ok
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = $1 AND p.pronargs = $2
`, [name, nargs])
const hasFnPriv = (role, name, nargs) => one(`
  SELECT has_function_privilege('${role}', p.oid, 'EXECUTE') AS ok
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = '${name}' AND p.pronargs = ${nargs}
`)
const hasTablePriv = (role, table, priv) => one(`
  SELECT has_table_privilege('${role}', 'public.${table}', '${priv}') AS ok
`)

const TABLES = ['invoice_records', 'invoice_payments']

await test('migration applies', () => db.exec(MIGRATION))
await test('migration is re-runnable', () => db.exec(MIGRATION))

await test('tables, RPCs, index and triggers exist', async () => {
  for (const table of TABLES) assert.ok(await tableExists(table), `missing ${table}`)
  assert.ok(await functionExists('can_manage_invoices', 0))
  assert.ok(await functionExists('create_invoice_record', 14))
  assert.ok(await functionExists('record_invoice_payment', 6))
  assert.ok(await one(`
    SELECT 1 AS ok FROM pg_indexes
    WHERE schemaname='public' AND tablename='invoice_payments'
      AND indexname='invoice_payments_invoice_id_idx'
  `))
  for (const trigger of [
    'invoice_records_set_updated_at',
    'invoice_payments_touch_invoice_record',
    'invoice_payments_recompute_status',
  ]) {
    assert.ok(await one(`SELECT 1 AS ok FROM pg_trigger WHERE tgname=$1`, [trigger]), trigger)
  }
})

await test('anon has no table or RPC privileges', async () => {
  for (const table of TABLES) {
    for (const priv of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      assert.equal((await hasTablePriv('anon', table, priv)).ok, false, `${table}.${priv}`)
    }
  }
  assert.equal((await hasFnPriv('anon', 'can_manage_invoices', 0)).ok, false)
  assert.equal((await hasFnPriv('anon', 'create_invoice_record', 14)).ok, false)
  assert.equal((await hasFnPriv('anon', 'record_invoice_payment', 6)).ok, false)
})

await test('authenticated has SELECT only; no direct table writes', async () => {
  for (const table of TABLES) {
    assert.equal((await hasTablePriv('authenticated', table, 'SELECT')).ok, true)
    for (const priv of ['INSERT', 'UPDATE', 'DELETE']) {
      assert.equal((await hasTablePriv('authenticated', table, priv)).ok, false, `${table}.${priv}`)
    }
  }
  assert.equal((await hasFnPriv('authenticated', 'can_manage_invoices', 0)).ok, true)
  assert.equal((await hasFnPriv('authenticated', 'create_invoice_record', 14)).ok, true)
  assert.equal((await hasFnPriv('authenticated', 'record_invoice_payment', 6)).ok, true)

  await as(ADMIN, 'authenticated')
  await rejects(() => db.query(`
    INSERT INTO public.invoice_records
      (invoice_number, source_type, source_id, customer_name, total_amount)
    VALUES ('DIRECT-1', 'booking', 'DIRECT-1', 'Direct', 1)
  `), /permission denied/i)
  await reset()
})

let adminInvoice
await test('admin creates an invoice; idempotency and duplicates behave', async () => {
  await as(ADMIN, 'authenticated')
  adminInvoice = await createInvoice({
    invoiceNumber: 'INV-1001',
    sourceId: 'BK-1001',
    customerName: 'Ravi',
    totalAmount: 1000,
    idempotencyKey: 'inv-idem-1',
  })
  assert.match(adminInvoice, UUID_RE)

  const replayed = await createInvoice({
    invoiceNumber: 'INV-1002',
    sourceId: 'BK-1002',
    customerName: 'Someone Else',
    totalAmount: 999,
    idempotencyKey: 'inv-idem-1',
  })
  assert.equal(replayed, adminInvoice)
  assert.equal(await count('FROM public.invoice_records'), 1)

  await rejects(() => createInvoice({
    invoiceNumber: 'INV-1001', sourceId: 'BK-1003', idempotencyKey: 'inv-idem-2',
  }), /already exists/i)
  await rejects(() => createInvoice({
    invoiceNumber: 'INV-1004', sourceId: 'BK-1001', idempotencyKey: 'inv-idem-3',
  }), /already exists/i)
  await reset()
})

await test('invoice field validation rejects bad input', async () => {
  await as(ADMIN, 'authenticated')
  await rejects(() => createInvoice({
    invoiceNumber: 'INV-BAD-1', sourceType: 'trip', sourceId: 'BAD-1',
  }), /Invalid invoice source type/i)
  await rejects(() => createInvoice({
    invoiceNumber: '   ', sourceId: 'BAD-2',
  }), /Invoice number is required/i)
  await rejects(() => createInvoice({
    invoiceNumber: 'INV-BAD-3', sourceId: '   ',
  }), /source id is required/i)
  await rejects(() => createInvoice({
    invoiceNumber: 'INV-BAD-4', sourceId: 'BAD-4', customerName: '   ',
  }), /Customer name is required/i)
  await rejects(() => createInvoice({
    invoiceNumber: 'INV-BAD-5', sourceId: 'BAD-5', totalAmount: -1,
  }), /zero or greater/i)
  await rejects(() => createInvoice({
    invoiceNumber: 'INV-BAD-6', sourceId: 'BAD-6', status: 'settled',
  }), /Invalid invoice status/i)
  await rejects(() => createInvoice({
    invoiceNumber: 'INV-BAD-7', sourceId: 'BAD-7',
    invoiceDate: '2026-11-21', dueDate: '2026-11-20',
  }), /Due date cannot be before/i)

  // A caller cannot mint an already-settled invoice by supplying a status.
  const forced = await createInvoice({
    invoiceNumber: 'INV-FORCED', sourceId: 'FORCED', status: 'paid',
  })
  assert.equal((await one('SELECT status FROM public.invoice_records WHERE id=$1', [forced])).status, 'pending')
  await reset()
})

await test('booking invoices require a real completed/closed booking', async () => {
  await as(ADMIN, 'authenticated')
  assert.ok(await createInvoice({
    invoiceNumber: 'INV-BOOK-ID', sourceType: 'booking',
    sourceId: BOOK_DONE, bookingId: BOOK_DONE, totalAmount: 500,
  }))
  assert.ok(await createInvoice({
    invoiceNumber: 'INV-BOOK-REF', sourceType: 'booking',
    sourceId: 'BK-DONE', bookingId: null, totalAmount: 300,
  }))
  await rejects(() => createInvoice({
    invoiceNumber: 'INV-BOOK-ONGOING', sourceType: 'booking',
    sourceId: BOOK_ONGOING, bookingId: BOOK_ONGOING, totalAmount: 100,
  }), /not completed/i)
  await rejects(() => createInvoice({
    invoiceNumber: 'INV-BOOK-CANCELLED', sourceType: 'booking',
    sourceId: BOOK_CANCELLED, bookingId: BOOK_CANCELLED, totalAmount: 100,
  }), /not completed/i)
  await rejects(() => createInvoice({
    invoiceNumber: 'INV-BOOK-UNKNOWN', sourceType: 'booking',
    sourceId: '99999999-9999-4999-8999-999999999999',
    bookingId: '99999999-9999-4999-8999-999999999999', totalAmount: 100,
  }), /does not exist/i)
  await rejects(() => createInvoice({
    invoiceNumber: 'INV-BOOK-MISMATCH', sourceType: 'booking',
    sourceId: 'WRONG-REF', bookingId: BOOK_DONE, totalAmount: 100,
  }), /does not match booking/i)
  await reset()
})

await test('server-side total check accepts a matching bill and rejects a tampered one', async () => {
  await as(ADMIN, 'authenticated')
  // (1000 - 100) * 1.10 = 990
  const billId = await createInvoice({
    invoiceNumber: 'INV-BILL-1',
    sourceId: 'MAN-1001',
    sourceType: 'manual',
    customerName: 'Kumar',
    totalAmount: 990,
    subtotal: 1000,
    discount: 100,
    taxPercent: 10,
    idempotencyKey: 'bill-idem-1',
  })
  const bill = await one('SELECT total_amount FROM public.invoice_records WHERE id=$1', [billId])
  assert.equal(Number(bill.total_amount), 990)

  await rejects(() => createInvoice({
    invoiceNumber: 'INV-BILL-2',
    sourceId: 'MAN-1002',
    sourceType: 'manual',
    customerName: 'Kumar',
    totalAmount: 1200,
    subtotal: 1000,
    discount: 100,
    taxPercent: 10,
    idempotencyKey: 'bill-idem-2',
  }), /does not match computed total/i)

  // A final total without the breakdown cannot bypass the computed check.
  await rejects(() => createInvoice({
    invoiceNumber: 'INV-NO-SUBTOTAL', sourceId: 'LEGACY-1', totalAmount: 500,
    subtotal: null,
  }), /subtotal is required/i)
  await reset()
})

await test('payment validation rejects bad amounts, methods and missing invoices', async () => {
  await as(ADMIN, 'authenticated')
  await rejects(() => recordPayment({
    invoiceId: adminInvoice, amount: 0, method: 'Cash', idempotencyKey: 'pay-bad-0',
  }), /greater than zero/i)
  await rejects(() => recordPayment({
    invoiceId: adminInvoice, amount: -5, method: 'Cash', idempotencyKey: 'pay-bad-neg',
  }), /greater than zero/i)
  await rejects(() => recordPayment({
    invoiceId: adminInvoice, amount: 10, method: 'Cash on delivery', idempotencyKey: 'pay-bad-method',
  }), /Invalid payment method/i)
  await rejects(() => recordPayment({
    invoiceId: '99999999-9999-4999-8999-999999999999', amount: 10, method: 'UPI',
  }), /does not exist/i)
  await reset()
})

await test('full payment marks an invoice paid; partial payment marks it partial', async () => {
  await as(ADMIN, 'authenticated')
  const fullInvoice = await createInvoice({
    invoiceNumber: 'INV-FULL', sourceId: 'BK-FULL', totalAmount: 1000,
  })
  await recordPayment({ invoiceId: fullInvoice, amount: 1000, method: 'Cash', idempotencyKey: 'pay-full' })
  assert.equal((await one('SELECT status FROM public.invoice_records WHERE id=$1', [fullInvoice])).status, 'paid')

  const partialInvoice = await createInvoice({
    invoiceNumber: 'INV-PARTIAL', sourceId: 'BK-PARTIAL', totalAmount: 1000,
  })
  await recordPayment({ invoiceId: partialInvoice, amount: 250, method: 'UPI', idempotencyKey: 'pay-partial' })
  assert.equal((await one('SELECT status FROM public.invoice_records WHERE id=$1', [partialInvoice])).status, 'partial')
  await recordPayment({ invoiceId: partialInvoice, amount: 750, method: 'Bank Transfer', idempotencyKey: 'pay-rest' })
  assert.equal((await one('SELECT status FROM public.invoice_records WHERE id=$1', [partialInvoice])).status, 'paid')
  await reset()
})

await test('draft and cancelled invoices are never promoted by payments', async () => {
  await as(ADMIN, 'authenticated')
  const draft = await createInvoice({
    invoiceNumber: 'INV-DRAFT', sourceId: 'BK-DRAFT', totalAmount: 500,
  })
  const cancelled = await createInvoice({
    invoiceNumber: 'INV-CANCEL', sourceId: 'BK-CANCEL', totalAmount: 500,
  })
  // Issuance never creates these states directly; simulate a later audit
  // action to prove payments do not promote them.
  await reset()
  await db.query(`UPDATE public.invoice_records SET status='draft' WHERE id=$1`, [draft])
  await db.query(`UPDATE public.invoice_records SET status='cancelled' WHERE id=$1`, [cancelled])
  await as(ADMIN, 'authenticated')
  await recordPayment({ invoiceId: draft, amount: 500, method: 'Cash', idempotencyKey: 'pay-draft' })
  await recordPayment({ invoiceId: cancelled, amount: 500, method: 'Cash', idempotencyKey: 'pay-cancel' })
  assert.equal((await one('SELECT status FROM public.invoice_records WHERE id=$1', [draft])).status, 'draft')
  assert.equal((await one('SELECT status FROM public.invoice_records WHERE id=$1', [cancelled])).status, 'cancelled')
  await reset()
})

await test('a repeated payment idempotency key creates only one payment', async () => {
  await as(ADMIN, 'authenticated')
  const invoice = await createInvoice({
    invoiceNumber: 'INV-DEDUPE', sourceId: 'BK-DEDUPE', totalAmount: 1000,
  })
  const first = await recordPayment({
    invoiceId: invoice, amount: 100, method: 'Cheque', idempotencyKey: 'pay-rapid',
  })
  const second = await recordPayment({
    invoiceId: invoice, amount: 100, method: 'Cheque', idempotencyKey: 'pay-rapid',
  })
  assert.equal(second, first)
  assert.equal(await count("FROM public.invoice_payments WHERE idempotency_key = 'pay-rapid'"), 1)
  assert.equal((await one('SELECT status FROM public.invoice_records WHERE id=$1', [invoice])).status, 'partial')
  await reset()
})

await test('reversed and refunded payments stay in history but are excluded from the balance', async () => {
  await as(ADMIN, 'authenticated')
  const invoice = await createInvoice({
    invoiceNumber: 'INV-REVERSAL', sourceId: 'BK-REVERSAL', totalAmount: 1000,
  })
  await recordPayment({ invoiceId: invoice, amount: 400, method: 'UPI', idempotencyKey: 'pay-kept' })
  await recordPayment({ invoiceId: invoice, amount: 300, method: 'Cash', idempotencyKey: 'pay-reversed' })
  await recordPayment({ invoiceId: invoice, amount: 300, method: 'Cheque', idempotencyKey: 'pay-refunded' })
  await reset()

  // Auditors can mark a recorded payment as returned without deleting it.
  await db.query(`UPDATE public.invoice_payments SET status = 'reversed' WHERE idempotency_key = 'pay-reversed'`)
  await db.query(`UPDATE public.invoice_payments SET status = 'refunded' WHERE idempotency_key = 'pay-refunded'`)

  assert.equal(await count('FROM public.invoice_payments WHERE invoice_id = $1', [invoice]), 3)
  assert.equal((await one('SELECT status FROM public.invoice_records WHERE id=$1', [invoice])).status, 'partial')

  await as(ADMIN, 'authenticated')
  await recordPayment({ invoiceId: invoice, amount: 600, method: 'Cash', idempotencyKey: 'pay-after-reversal' })
  assert.equal((await one('SELECT status FROM public.invoice_records WHERE id=$1', [invoice])).status, 'paid')
  await reset()
})

await test('payments beyond the outstanding balance are rejected server-side', async () => {
  await as(ADMIN, 'authenticated')
  const invoice = await createInvoice({
    invoiceNumber: 'INV-OVERPAY', sourceId: 'BK-OVERPAY', totalAmount: 100,
  })
  await recordPayment({ invoiceId: invoice, amount: 60, method: 'UPI', idempotencyKey: 'pay-overpay-first' })
  await rejects(() => recordPayment({
    invoiceId: invoice, amount: 50, method: 'Cash', idempotencyKey: 'pay-overpay-too-much',
  }), /exceeds the outstanding balance/i)
  await rejects(() => recordPayment({
    invoiceId: invoice, amount: 40.01, method: 'Cash', idempotencyKey: 'pay-overpay-paisa',
  }), /exceeds the outstanding balance/i)
  assert.equal(await count('FROM public.invoice_payments WHERE invoice_id = $1', [invoice]), 1)
  await recordPayment({ invoiceId: invoice, amount: 40, method: 'Cash', idempotencyKey: 'pay-overpay-rest' })
  assert.equal((await one('SELECT status FROM public.invoice_records WHERE id=$1', [invoice])).status, 'paid')
  await reset()
})

await test('payment insert refreshes invoice updated_at', async () => {
  await as(ADMIN, 'authenticated')
  const invoice = await createInvoice({
    invoiceNumber: 'INV-TOUCH', sourceId: 'BK-TOUCH', totalAmount: 100,
  })
  const before = (await one('SELECT updated_at FROM public.invoice_records WHERE id=$1', [invoice])).updated_at
  await new Promise((resolve) => setTimeout(resolve, 10))
  await recordPayment({ invoiceId: invoice, amount: 10, method: 'Other', idempotencyKey: 'pay-touch' })
  const after = (await one('SELECT updated_at FROM public.invoice_records WHERE id=$1', [invoice])).updated_at
  assert.ok(after > before, 'updated_at did not advance')
  await reset()
})

await test('manager without generate_invoice is denied; granting it and admin access work', async () => {
  await as(MGR, 'authenticated')
  await rejects(() => createInvoice({
    invoiceNumber: 'INV-MGR-DENIED', sourceId: 'MGR-DENIED', totalAmount: 100,
  }), /Not authorized to generate invoices/i)
  await rejects(() => recordPayment({
    invoiceId: adminInvoice, amount: 1, method: 'Cash', idempotencyKey: 'pay-mgr-denied',
  }), /Not authorized to record invoice payments/i)
  await reset()

  await db.query(`
    INSERT INTO public.role_permissions (role, permission, is_allowed)
    VALUES ('manager', 'generate_invoice', true)
  `)

  await as(MGR, 'authenticated')
  assert.ok(await createInvoice({
    invoiceNumber: 'INV-MGR-OK', sourceId: 'MGR-OK', totalAmount: 200,
  }))
  await reset()

  await as(ACCOUNTANT, 'authenticated')
  assert.ok(await createInvoice({
    invoiceNumber: 'INV-ACCOUNTANT-OK', sourceId: 'ACCOUNTANT-OK', totalAmount: 150,
  }))
  await reset()

  await as(ADMIN, 'authenticated')
  assert.ok(await createInvoice({
    invoiceNumber: 'INV-ADMIN-OK', sourceId: 'ADMIN-OK', totalAmount: 300,
  }))
  await reset()
})

await test('admin and manager can read invoices; other roles cannot', async () => {
  await as(ADMIN, 'authenticated')
  assert.ok((await db.query('SELECT * FROM public.invoice_records')).rows.length > 0)
  await as(MGR, 'authenticated')
  assert.ok((await db.query('SELECT * FROM public.invoice_records')).rows.length > 0)
  await as(ACCOUNTANT, 'authenticated')
  assert.ok((await db.query('SELECT * FROM public.invoice_records')).rows.length > 0)
  await as(DRIVER, 'authenticated')
  assert.equal((await db.query('SELECT * FROM public.invoice_records')).rows.length, 0)
  await reset()
})

await test('anon cannot call the mutation RPCs or read the tables', async () => {
  await as(null, 'anon')
  await rejects(() => createInvoice({
    invoiceNumber: 'INV-ANON', sourceId: 'ANON', totalAmount: 10,
  }), /permission denied/i)
  await rejects(() => db.query('SELECT * FROM public.invoice_records'), /permission denied/i)
  await rejects(() => db.query('SELECT * FROM public.invoice_payments'), /permission denied/i)
  await reset()
})

console.log(`\n${passed} invoice management SQL checks passed`)

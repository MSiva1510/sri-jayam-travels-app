// ─────────────────────────────────────────────────────────────────────────────
// expense_type_details.test.mjs — SQL tests for
// migrations/20261118_expense_type_details.sql. Runs the migration on PGlite
// over a scaffold shaped like the live expenses table and checks that the
// type-specific fields persist without touching existing rows.
//
//   cd supabase/tests && npm install && npm test
// ─────────────────────────────────────────────────────────────────────────────
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const MIGRATION = readFileSync(
  new URL('../migrations/20261118_expense_type_details.sql', import.meta.url),
  'utf8'
)

const db = new PGlite()

await db.exec(`
  CREATE TABLE public.expenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_no text NOT NULL,
    type text,
    amount numeric NOT NULL DEFAULT 0,
    expense_date date,
    description text,
    driver_name text,
    vehicle_reg text,
    trip_ref text,
    status text DEFAULT 'pending',
    odometer_km numeric,
    litres_filled numeric,
    fuel_station text,
    fuel_rate numeric,
    receipt_url text,
    receipt_name text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
  INSERT INTO public.expenses (expense_no, type, amount, expense_date, description)
    VALUES ('EXP-2611-0001', 'fuel', 2500, '2026-11-18', 'Old fuel bill');
`)

let passed = 0
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ok  ', name) }
  catch (e) { console.log('  FAIL', name, '\n       ', e.message); process.exitCode = 1 }
}
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0]

await test('migration applies', () => db.exec(MIGRATION))
await test('migration is re-runnable', () => db.exec(MIGRATION))

const DETAIL_COLUMNS = [
  'parking_location', 'parking_duration', 'toll_name', 'toll_route',
  'bata_driver', 'bata_trip', 'maintenance_vendor', 'maintenance_invoice',
]

await test('all eight detail columns exist and are nullable', async () => {
  const { rows } = await db.query(`
    SELECT column_name, is_nullable, data_type
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='expenses'
  `)
  const columns = Object.fromEntries(rows.map(r => [r.column_name, r]))
  for (const column of DETAIL_COLUMNS) {
    assert.ok(columns[column], `missing ${column}`)
    assert.equal(columns[column].is_nullable, 'YES', `${column} should be nullable`)
  }
  assert.equal(columns.parking_duration.data_type, 'numeric')
})

await test('existing expense rows are untouched', async () => {
  const row = await one(`SELECT expense_no, type, amount, description FROM public.expenses`)
  assert.equal(row.expense_no, 'EXP-2611-0001')
  assert.equal(row.type, 'fuel')
  assert.equal(Number(row.amount), 2500)
  assert.equal(row.description, 'Old fuel bill')
})

await test('detail values round-trip for each expense type', async () => {
  const { rows } = await db.query(`
    INSERT INTO public.expenses
      (expense_no, type, amount, parking_location, parking_duration,
       toll_name, toll_route, bata_driver, bata_trip,
       maintenance_vendor, maintenance_invoice)
    VALUES
      ('EXP-2611-0002', 'parking', 120, 'Airport', 3.5, NULL, NULL, NULL, NULL, NULL, NULL),
      ('EXP-2611-0003', 'toll', 200, NULL, NULL, 'Tindivanam Toll', 'ECR Chennai', NULL, NULL, NULL, NULL),
      ('EXP-2611-0004', 'bata', 900, NULL, NULL, NULL, NULL, 'Ravi', 'BK-1001', NULL, NULL),
      ('EXP-2611-0005', 'maintenance', 4500, NULL, NULL, NULL, NULL, NULL, NULL, 'Jayam Workshop', 'INV-42')
    RETURNING expense_no, parking_location, parking_duration, toll_name,
              toll_route, bata_driver, bata_trip, maintenance_vendor, maintenance_invoice
  `)

  assert.equal(rows.length, 4)
  assert.equal(rows[0].parking_location, 'Airport')
  assert.equal(Number(rows[0].parking_duration), 3.5)
  assert.equal(rows[1].toll_name, 'Tindivanam Toll')
  assert.equal(rows[1].toll_route, 'ECR Chennai')
  assert.equal(rows[2].bata_driver, 'Ravi')
  assert.equal(rows[2].bata_trip, 'BK-1001')
  assert.equal(rows[3].maintenance_vendor, 'Jayam Workshop')
  assert.equal(rows[3].maintenance_invoice, 'INV-42')
})

console.log(`\n${passed} expense detail SQL checks passed`)

// ─────────────────────────────────────────────────────────────────────────────
// vehicle_compliance_fields.test.mjs — SQL tests for
// migrations/20261119_vehicle_compliance_fields.sql. Runs the migration on
// PGlite over a scaffold shaped like the live vehicles table and checks that
// the compliance fields now editable in the modal persist without touching
// existing rows.
//
//   cd supabase/tests && npm install && npm test
// ─────────────────────────────────────────────────────────────────────────────
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const MIGRATION = readFileSync(
  new URL('../migrations/20261119_vehicle_compliance_fields.sql', import.meta.url),
  'utf8'
)

const db = new PGlite()

// The columns below already existed before this migration; the repository's
// legacy select list proves it. Only the compliance columns are missing.
await db.exec(`
  CREATE TABLE public.vehicles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id text,
    registration text,
    vehicle_type text,
    model text,
    year integer,
    color text,
    fuel_type text,
    status text DEFAULT 'active',
    current_km integer DEFAULT 0,
    insurance_number text,
    insurance_expiry date,
    fitness_cert_expiry date,
    pollution_cert_expiry date,
    last_service_km integer,
    engine_number text,
    imei text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
  INSERT INTO public.vehicles
    (vehicle_id, registration, vehicle_type, model, year, color, fuel_type, status,
     current_km, insurance_number, last_service_km)
  VALUES
    ('VEH-1001', 'PY01CY1255', '4+1 Sedan', 'Dzire', 2022, 'White', 'Diesel',
     'active', 150734, 'TATA-AIG-PY01CY1255', 145000);
`)

let passed = 0
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ok  ', name) }
  catch (e) { console.log('  FAIL', name, '\n       ', e.message); process.exitCode = 1 }
}
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0]

await test('migration applies', () => db.exec(MIGRATION))
await test('migration is re-runnable', () => db.exec(MIGRATION))

const NEW_COLUMNS = {
  insurance_provider: 'text',
  permit_number: 'text',
  permit_expiry: 'date',
  fitness_cert_number: 'text',
  pollution_cert_number: 'text',
  last_service_date: 'date',
  next_service_date: 'date',
  next_service_km: 'integer',
}

await test('all compliance columns exist, are nullable and have the expected types', async () => {
  const { rows } = await db.query(`
    SELECT column_name, is_nullable, data_type
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vehicles'
  `)
  const columns = Object.fromEntries(rows.map(r => [r.column_name, r]))
  for (const [column, type] of Object.entries(NEW_COLUMNS)) {
    assert.ok(columns[column], `missing ${column}`)
    assert.equal(columns[column].is_nullable, 'YES', `${column} should be nullable`)
    assert.equal(columns[column].data_type, type, `${column} should be ${type}`)
  }
})

await test('existing vehicle rows are untouched', async () => {
  const row = await one(`SELECT vehicle_id, registration, current_km, insurance_number, last_service_km FROM public.vehicles`)
  assert.equal(row.vehicle_id, 'VEH-1001')
  assert.equal(row.registration, 'PY01CY1255')
  assert.equal(Number(row.current_km), 150734)
  assert.equal(row.insurance_number, 'TATA-AIG-PY01CY1255')
  assert.equal(Number(row.last_service_km), 145000)

  const blank = await one(`
    SELECT insurance_provider, permit_number, permit_expiry, fitness_cert_number,
           pollution_cert_number, last_service_date, next_service_date, next_service_km
    FROM public.vehicles WHERE vehicle_id = 'VEH-1001'
  `)
  for (const value of Object.values(blank)) assert.equal(value, null)
})

await test('every field the modal edits round-trips', async () => {
  const row = await one(`
    INSERT INTO public.vehicles
      (vehicle_id, registration, vehicle_type, model, year, color, fuel_type, status,
       current_km, insurance_provider, insurance_number, insurance_expiry,
       permit_number, permit_expiry, fitness_cert_number, fitness_cert_expiry,
       pollution_cert_number, pollution_cert_expiry, last_service_date, last_service_km,
       next_service_date, next_service_km)
    VALUES
      ('VEH-1002', 'PY01AB1234', '7+1 SUV', 'Innova Crysta', 2024, 'Silver', 'Diesel',
       'maintenance', 50000, 'TATA AIG', 'POL-7788', '2027-03-15',
       'KL/PERMIT/0099', '2027-06-30', 'FC-1234', '2029-06-10',
       'PUC-5678', '2026-12-20', '2026-09-01', 48000,
       '2026-12-01', 55000)
    RETURNING insurance_provider, insurance_number, insurance_expiry, permit_number,
              permit_expiry, fitness_cert_number, fitness_cert_expiry,
              pollution_cert_number, pollution_cert_expiry, last_service_date,
              last_service_km, next_service_date, next_service_km
  `)

  assert.equal(row.insurance_provider, 'TATA AIG')
  assert.equal(row.insurance_number, 'POL-7788')
  assert.equal(row.insurance_expiry.toISOString().slice(0, 10), '2027-03-15')
  assert.equal(row.permit_number, 'KL/PERMIT/0099')
  assert.equal(row.permit_expiry.toISOString().slice(0, 10), '2027-06-30')
  assert.equal(row.fitness_cert_number, 'FC-1234')
  assert.equal(row.fitness_cert_expiry.toISOString().slice(0, 10), '2029-06-10')
  assert.equal(row.pollution_cert_number, 'PUC-5678')
  assert.equal(row.pollution_cert_expiry.toISOString().slice(0, 10), '2026-12-20')
  assert.equal(row.last_service_date.toISOString().slice(0, 10), '2026-09-01')
  assert.equal(Number(row.last_service_km), 48000)
  assert.equal(row.next_service_date.toISOString().slice(0, 10), '2026-12-01')
  assert.equal(Number(row.next_service_km), 55000)
})

await test('clearing a numeric or date field stores NULL, never an empty string', async () => {
  const row = await one(`
    UPDATE public.vehicles
    SET next_service_km = NULL, next_service_date = NULL, permit_number = NULL
    WHERE vehicle_id = 'VEH-1002'
    RETURNING next_service_km, next_service_date, permit_number
  `)
  assert.equal(row.next_service_km, null)
  assert.equal(row.next_service_date, null)
  assert.equal(row.permit_number, null)
})

console.log(`\n${passed} vehicle compliance SQL checks passed`)

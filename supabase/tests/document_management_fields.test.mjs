// ─────────────────────────────────────────────────────────────────────────────
// document_management_fields.test.mjs — SQL tests for
// migrations/20261120_document_management_fields.sql. Runs the additive
// migration on PGlite over a scaffold shaped like the live documents table.
//
//   cd supabase/tests && npm install && npm test
// ─────────────────────────────────────────────────────────────────────────────
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const MIGRATION = readFileSync(
  new URL('../migrations/20261120_document_management_fields.sql', import.meta.url),
  'utf8'
)

const db = new PGlite()

// Columns that already existed before the redesign. The migration must not
// rename, replace or backfill any of them.
await db.exec(`
  CREATE TABLE public.documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id text UNIQUE,
    document_type text,
    related_entity text,
    title text,
    category text,
    doc_type text,
    status text,
    driver_id uuid,
    vehicle_id uuid,
    customer_id uuid,
    expiry_date date,
    reminder_date date,
    notes text,
    file_name text,
    file_url text,
    file_size integer,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
  INSERT INTO public.documents
    (document_id, document_type, related_entity, title, category, doc_type, status,
     expiry_date, notes, file_name, file_url, file_size)
  VALUES
    ('DOC-1001', 'license', 'driver', 'Legacy licence', 'driver', 'license',
     'active', '2027-01-01', 'DL-1234', 'licence.pdf',
     'https://signed.example/legacy', 2048);
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
  document_number: 'text',
  issuing_authority: 'text',
  issue_date: 'date',
  reminder_enabled: 'boolean',
  reminder_interval: 'integer',
  tags: 'ARRAY',
  back_file_url: 'text',
  back_file_name: 'text',
  back_file_size: 'bigint',
  file_path: 'text',
  back_file_path: 'text',
}

await test('every new column exists with the expected type', async () => {
  const { rows } = await db.query(`
    SELECT column_name, is_nullable, data_type
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='documents'
  `)
  const columns = Object.fromEntries(rows.map(r => [r.column_name, r]))
  for (const [column, type] of Object.entries(NEW_COLUMNS)) {
    assert.ok(columns[column], `missing ${column}`)
    assert.equal(columns[column].data_type, type, `${column} should be ${type}`)
  }
})

await test('existing documents are untouched and new columns are NULL', async () => {
  const row = await one(`SELECT * FROM public.documents WHERE document_id = 'DOC-1001'`)
  assert.equal(row.title, 'Legacy licence')
  assert.equal(row.doc_type, 'license')
  assert.equal(row.status, 'active')
  assert.equal(row.file_url, 'https://signed.example/legacy')
  assert.equal(Number(row.file_size), 2048)
  for (const column of Object.keys(NEW_COLUMNS)) {
    assert.equal(row[column], null, `${column} must not be backfilled`)
  }
})

await test('every field the modal edits round-trips', async () => {
  const row = await one(`
    INSERT INTO public.documents
      (document_id, category, doc_type, title, document_number, issuing_authority,
       issue_date, expiry_date, reminder_date, reminder_enabled, reminder_interval,
       tags, notes, file_url, file_name, file_size, file_path,
       back_file_url, back_file_name, back_file_size, back_file_path)
    VALUES
      ('DOC-1002', 'vehicle', 'insurance', 'Insurance 2026', 'INS-9', 'LIC',
       '2026-01-02', '2027-01-02', '2026-12-03', true, 15,
       ARRAY['fleet','insurance'], 'Reviewed', 'https://signed.example/front',
       'front.pdf', 4096, 'vehicle/front.pdf',
       'https://signed.example/back', 'back.pdf', 2048, 'vehicle/back.pdf')
    RETURNING document_number, issuing_authority, issue_date, reminder_enabled,
              reminder_interval, tags, file_path, back_file_url, back_file_name,
              back_file_size, back_file_path
  `)
  assert.equal(row.document_number, 'INS-9')
  assert.equal(row.issuing_authority, 'LIC')
  assert.equal(row.issue_date.toISOString().slice(0, 10), '2026-01-02')
  assert.equal(row.reminder_enabled, true)
  assert.equal(Number(row.reminder_interval), 15)
  assert.deepEqual(row.tags, ['fleet', 'insurance'])
  assert.equal(row.file_path, 'vehicle/front.pdf')
  assert.equal(row.back_file_url, 'https://signed.example/back')
  assert.equal(row.back_file_name, 'back.pdf')
  assert.equal(Number(row.back_file_size), 2048)
  assert.equal(row.back_file_path, 'vehicle/back.pdf')
})

await test('clearing optional fields stores NULL, never an empty string', async () => {
  const row = await one(`
    UPDATE public.documents
    SET document_number = NULL, issuing_authority = NULL, reminder_enabled = NULL,
        reminder_interval = NULL, tags = NULL, back_file_url = NULL,
        back_file_name = NULL, back_file_size = NULL, back_file_path = NULL
    WHERE document_id = 'DOC-1002'
    RETURNING document_number, issuing_authority, reminder_enabled, reminder_interval,
              tags, back_file_url, back_file_name, back_file_size, back_file_path
  `)
  for (const value of Object.values(row)) assert.equal(value, null)
})

console.log(`\n${passed} document management SQL checks passed`)

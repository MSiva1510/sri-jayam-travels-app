// ─────────────────────────────────────────────────────────────────────────────
// public_customer_profile_removal.test.mjs — SQL test for
// migrations/20261120_revoke_public_customer_profile.sql. Runs the migration
// on PGlite with a stub of the old anonymous lookup RPC.
//
//   cd supabase/tests && npm install && npm test
// ─────────────────────────────────────────────────────────────────────────────
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const MIGRATION = readFileSync(
  new URL('../migrations/20261120_revoke_public_customer_profile.sql', import.meta.url),
  'utf8',
)

const db = new PGlite()

await db.exec(`
  DO $$ BEGIN
    CREATE ROLE anon;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN
    CREATE ROLE authenticated;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  CREATE OR REPLACE FUNCTION public.public_get_customer_profile(p_mobile text)
  RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$ SELECT jsonb_build_object('found', false) $$;
  GRANT EXECUTE ON FUNCTION public.public_get_customer_profile(text) TO anon, authenticated;
`)

let passed = 0
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ok  ', name) }
  catch (e) { console.log('  FAIL', name, '\n       ', e.message); process.exitCode = 1 }
}

const functionExists = async () => {
  const { rows } = await db.query(`
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'public_get_customer_profile'
      AND p.pronargs = 1
  `)
  return rows.length > 0
}

await test('anonymous lookup exists before the migration', async () => {
  assert.equal(await functionExists(), true)
})

await test('migration removes the anonymous lookup', async () => {
  await db.exec(MIGRATION)
  assert.equal(await functionExists(), false)
})

await test('migration is re-runnable', async () => {
  await db.exec(MIGRATION)
  assert.equal(await functionExists(), false)
})

console.log(`\n${passed} public customer profile removal SQL checks passed`)

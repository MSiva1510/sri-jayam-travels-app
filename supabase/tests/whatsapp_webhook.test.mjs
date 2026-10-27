// ─────────────────────────────────────────────────────────────────────────────
// whatsapp_webhook.test.mjs — SQL tests for migrations/20261027_whatsapp_webhook.sql.
// PGlite (real Postgres in WebAssembly) over a scaffold mirroring the live
// communication_logs table and its status CHECK (2026-10-27).
//
//   cd supabase/tests && npm install && npm test
// ─────────────────────────────────────────────────────────────────────────────
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const MIGRATION = readFileSync(
  new URL('../migrations/20261027_whatsapp_webhook.sql', import.meta.url), 'utf8')

const db = new PGlite()
const ADMIN = '33333333-3333-3333-3333-333333333333'
const DRIVER = '11111111-1111-1111-1111-111111111111'

await db.exec(`
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
  CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;

  CREATE TABLE profiles (id uuid PRIMARY KEY, role text);
  INSERT INTO profiles VALUES ('${ADMIN}', 'admin'), ('${DRIVER}', 'driver');
  CREATE FUNCTION public.is_staff() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
    $$ SELECT coalesce((SELECT role IN ('admin','manager') FROM profiles WHERE id = auth.uid()), false) $$;
  GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

  -- Mirrors live public.communication_logs (relevant columns + status CHECK).
  CREATE TABLE communication_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    channel text CHECK (channel IN ('in_app','whatsapp','sms','push','webhook','email')),
    status text CHECK (status IN ('pending','processing','delivered','failed','retrying','cancelled')),
    provider_message_id text, sent_at timestamptz, delivered_at timestamptz,
    failed_at timestamptz, failure_reason text, metadata jsonb);
`)

let passed = 0
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ok  ', name) }
  catch (e) { console.log('  FAIL', name, '\n       ', e.message); process.exitCode = 1 }
}
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0]
const as = (uid, role) => db.exec(`RESET ROLE; SELECT set_config('test.uid', '${uid ?? ''}', false);${role ? ` SET ROLE ${role};` : ''}`)
const apply = (wamid, status, at = '2026-10-27T10:00:00Z', err = null) =>
  one(`SELECT public.whatsapp_apply_status($1, $2, $3::timestamptz, $4) AS n`, [wamid, status, at, err]).then(r => r.n)
const log = id => one(`SELECT * FROM communication_logs WHERE provider_message_id = $1`, [id])
const seed = (id, status = 'pending', channel = 'whatsapp') =>
  db.query(`INSERT INTO communication_logs (channel, status, provider_message_id) VALUES ($1, $2, $3)`, [channel, status, id])
const rejects = async (fn, re) => {
  let err; try { await fn() } catch (e) { err = e }
  assert.ok(err, 'expected an error'); assert.match(err.message, re)
}

await test('migration applies and is re-runnable', async () => {
  await db.exec(MIGRATION); await db.exec(MIGRATION)
})

await test('sent → processing + sent_at; delivered → delivered + delivered_at', async () => {
  await as(null); await seed('w1')
  assert.equal(await apply('w1', 'sent', '2026-10-27T10:00:00Z'), 1)
  let l = await log('w1')
  assert.equal(l.status, 'processing'); assert.ok(l.sent_at); assert.equal(l.metadata.wa_status, 'sent')
  await apply('w1', 'delivered', '2026-10-27T10:00:05Z')
  l = await log('w1')
  assert.equal(l.status, 'delivered'); assert.ok(l.delivered_at); assert.equal(l.metadata.wa_status, 'delivered')
})

await test('read keeps status delivered (CHECK-safe) and records read_at', async () => {
  await apply('w1', 'read', '2026-10-27T10:01:00Z')
  const l = await log('w1')
  assert.equal(l.status, 'delivered'); assert.equal(l.metadata.wa_status, 'read'); assert.ok(l.metadata.read_at)
})

await test('out-of-order receipts never move backwards', async () => {
  await apply('w1', 'sent', '2026-10-27T09:59:00Z')
  await apply('w1', 'delivered')
  const l = await log('w1')
  assert.equal(l.status, 'delivered'); assert.equal(l.metadata.wa_status, 'read')
})

await test('failed sets failure details, but never overrides a delivered message', async () => {
  await seed('w2')
  await apply('w2', 'failed', '2026-10-27T10:02:00Z', '131026 · Message undeliverable')
  const f = await log('w2')
  assert.equal(f.status, 'failed'); assert.ok(f.failed_at); assert.match(f.failure_reason, /131026/)
  await apply('w1', 'failed', '2026-10-27T10:03:00Z', 'late failure')
  const d = await log('w1')
  assert.equal(d.status, 'delivered'); assert.equal(d.failure_reason, null); assert.equal(d.metadata.wa_status, 'read')
})

await test('unknown wamid, other channels and bad statuses change nothing', async () => {
  await seed('sms1', 'pending', 'sms')
  assert.equal(await apply('nope', 'delivered'), 0)
  assert.equal(await apply('sms1', 'delivered'), 0)
  assert.equal((await log('sms1')).status, 'pending')
  assert.equal(await apply('w2', 'deleted'), 0)
})

await test('inbound messages: duplicate wamid is ignored (Meta retries)', async () => {
  const ins = `INSERT INTO whatsapp_inbound_messages (wamid, from_phone, text_body) VALUES ('in1', '9198', 'hi')
               ON CONFLICT (wamid) DO NOTHING`
  await db.exec(ins); await db.exec(ins)
  assert.equal((await one(`SELECT count(*)::int AS n FROM whatsapp_inbound_messages`)).n, 1)
})

await test('only service_role can apply statuses', async () => {
  await as(ADMIN, 'authenticated'); await rejects(() => apply('w2', 'sent'), /permission denied/)
  await as(null, 'anon');           await rejects(() => apply('w2', 'sent'), /permission denied/)
  await as(null, 'service_role');   assert.equal(await apply('w2', 'sent'), 1)
  await db.exec('RESET ROLE')
})

await test('inbound messages: staff read, drivers and anon do not', async () => {
  await as(ADMIN, 'authenticated')
  assert.equal((await one(`SELECT count(*)::int AS n FROM whatsapp_inbound_messages`)).n, 1)
  await as(DRIVER, 'authenticated')
  assert.equal((await one(`SELECT count(*)::int AS n FROM whatsapp_inbound_messages`)).n, 0)
  await as(null, 'anon')
  await rejects(() => db.query(`SELECT * FROM whatsapp_inbound_messages`), /permission denied/)
  await db.exec('RESET ROLE')
})

console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`)

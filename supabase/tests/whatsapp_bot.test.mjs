// ─────────────────────────────────────────────────────────────────────────────
// whatsapp_bot.test.mjs — SQL tests for migrations/20261030_whatsapp_bot.sql.
// PGlite (real Postgres in WebAssembly). pg_net and Supabase Vault do not
// exist here, so `net.http_post` and `vault.decrypted_secrets` are stubbed:
// the stub records each call so the bookings trigger can be checked.
//
//   cd supabase/tests && npm install && npm test
// ─────────────────────────────────────────────────────────────────────────────
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const read = f => readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8')
const WEBHOOK = read('20261027_whatsapp_webhook.sql')
const MIGRATION = read('20261030_whatsapp_bot.sql')

const db = new PGlite()
const ADMIN = '33333333-3333-3333-3333-333333333333'
const DRIVER = '11111111-1111-1111-1111-111111111111'
const D1 = 'dddddddd-0000-4000-8000-000000000001'
const D2 = 'dddddddd-0000-4000-8000-000000000002'

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

  CREATE TABLE communication_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), channel text, status text,
    provider_message_id text, sent_at timestamptz, delivered_at timestamptz,
    failed_at timestamptz, failure_reason text, metadata jsonb);

  -- Mirrors the live bookings columns the trigger reads.
  CREATE TABLE drivers (id uuid PRIMARY KEY, name text, phone text);
  INSERT INTO drivers VALUES ('${D1}', 'Ramanan', '9876543210'), ('${D2}', 'Bala', '9000000001');
  CREATE TABLE bookings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), booking_number text UNIQUE,
    status text CHECK (status IN ('draft','pending','approved','confirmed','assigned','started','completed','closed','cancelled')),
    driver_id uuid REFERENCES drivers(id), vehicle_id uuid, notes text);
  GRANT SELECT, INSERT, UPDATE ON bookings TO authenticated;

  -- Stubs for Supabase Vault and pg_net.
  CREATE SCHEMA vault;
  CREATE TABLE vault.decrypted_secrets (name text PRIMARY KEY, decrypted_secret text);
  CREATE SCHEMA net;
  CREATE TABLE net.calls (url text, body jsonb, headers jsonb);
  CREATE TABLE net.fail (on_ boolean);
  CREATE FUNCTION net.http_post(url text, body jsonb, headers jsonb, timeout_milliseconds int)
  RETURNS bigint LANGUAGE plpgsql AS $$
  BEGIN
    IF EXISTS (SELECT 1 FROM net.fail) THEN RAISE EXCEPTION 'network down'; END IF;
    INSERT INTO net.calls VALUES (url, body, headers);
    RETURN 1;
  END $$;
`)

let passed = 0
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ok  ', name) }
  catch (e) { console.log('  FAIL', name, '\n       ', e.message); process.exitCode = 1 }
}
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0]
const all = async (sql, p = []) => (await db.query(sql, p)).rows
const as = (uid, role) => db.exec(`RESET ROLE; SELECT set_config('test.uid', '${uid ?? ''}', false);${role ? ` SET ROLE ${role};` : ''}`)
const rejects = async (fn, re) => {
  let err; try { await fn() } catch (e) { err = e }
  assert.ok(err, 'expected an error'); assert.match(err.message, re)
}
const calls = () => all(`SELECT body->>'booking_id' AS id, headers->>'X-Sjt-Notify-Secret' AS secret, url FROM net.calls`)

await test('migration applies on top of the webhook migration and is re-runnable', async () => {
  await db.exec(WEBHOOK)
  await db.exec(MIGRATION); await db.exec(MIGRATION)
})

await test('touch_conversation: counts unread in, keeps the name, stamps both directions', async () => {
  await as(null)
  let c = await one(`SELECT * FROM whatsapp_touch_conversation('917305581235', 'in', 'Mani')`)
  assert.equal(c.unread, 1); assert.equal(c.contact_name, 'Mani'); assert.ok(c.last_inbound_at)
  c = await one(`SELECT * FROM whatsapp_touch_conversation('917305581235', 'in', NULL)`)
  assert.equal(c.unread, 2); assert.equal(c.contact_name, 'Mani')
  c = await one(`SELECT * FROM whatsapp_touch_conversation('917305581235', 'out')`)
  assert.equal(c.unread, 2); assert.ok(c.last_outbound_at)
})

await test('outbound receipts: forward only; failed never over delivered; failed can recover', async () => {
  await db.exec(`INSERT INTO whatsapp_outbound_messages (wamid, to_phone, kind, status) VALUES
    ('o1', '91', 'bot', 'sent'), ('o2', '91', 'bot', 'queued')`)
  const apply = (w, s, e = null) => one(`SELECT whatsapp_apply_outbound_status($1, $2, $3) AS n`, [w, s, e]).then(r => r.n)
  const st = async w => (await one(`SELECT status, error FROM whatsapp_outbound_messages WHERE wamid = $1`, [w]))
  assert.equal(await apply('o1', 'read'), 1); assert.equal((await st('o1')).status, 'read')
  await apply('o1', 'delivered'); assert.equal((await st('o1')).status, 'read')
  await apply('o1', 'failed', 'x'); assert.equal((await st('o1')).status, 'read')
  await apply('o2', 'failed', '131026 · undeliverable')
  assert.deepEqual(await st('o2'), { status: 'failed', error: '131026 · undeliverable' })
  await apply('o2', 'delivered'); assert.equal((await st('o2')).status, 'delivered')
  assert.equal(await apply('o3', 'sent'), 0)
  assert.equal(await apply('o1', 'deleted'), 0)
})

await test('one trip message per booking + kind', async () => {
  await db.exec(`INSERT INTO bookings (id, booking_number, status) VALUES ('aaaaaaaa-0000-4000-8000-000000000001', 'B1', 'pending')`)
  await db.exec(`INSERT INTO whatsapp_outbound_messages (booking_id, to_phone, kind) VALUES ('aaaaaaaa-0000-4000-8000-000000000001', '91', 'customer_confirmed')`)
  await rejects(() => db.exec(`INSERT INTO whatsapp_outbound_messages (booking_id, to_phone, kind) VALUES ('aaaaaaaa-0000-4000-8000-000000000001', '91', 'customer_confirmed')`), /duplicate key/)
  // Messages without a booking (bot / staff) never conflict.
  await db.exec(`INSERT INTO whatsapp_outbound_messages (to_phone, kind) VALUES ('91', 'bot'), ('91', 'bot')`)
})

await test('trigger is silent until the Vault secrets exist', async () => {
  await db.exec(`UPDATE bookings SET status = 'approved' WHERE booking_number = 'B1'`)
  assert.equal((await calls()).length, 0)
  await db.exec(`INSERT INTO vault.decrypted_secrets VALUES
    ('whatsapp_notify_url', 'https://site.test/api/whatsapp/notify'), ('whatsapp_notify_secret', 's3cret')`)
})

await test('trigger posts on approve / driver / vehicle / finish, not on other edits or pending', async () => {
  await db.exec(`INSERT INTO bookings (id, booking_number, status) VALUES ('bbbbbbbb-0000-4000-8000-000000000002', 'B2', 'pending')`)
  assert.equal((await calls()).length, 0, 'pending insert')
  await db.exec(`UPDATE bookings SET status = 'approved' WHERE booking_number = 'B2'`)
  await db.exec(`UPDATE bookings SET notes = 'call first' WHERE booking_number = 'B2'`)
  await db.exec(`UPDATE bookings SET driver_id = '${D1}', status = 'assigned' WHERE booking_number = 'B2'`)
  await db.exec(`UPDATE bookings SET driver_id = '${D2}' WHERE booking_number = 'B2'`)
  await db.exec(`UPDATE bookings SET status = 'completed' WHERE booking_number = 'B2'`)
  await db.exec(`UPDATE bookings SET status = 'cancelled' WHERE booking_number = 'B1'`)
  const c = await calls()
  assert.equal(c.length, 4)
  assert.ok(c.every(x => x.id === 'bbbbbbbb-0000-4000-8000-000000000002'))
  assert.equal(c[0].secret, 's3cret'); assert.equal(c[0].url, 'https://site.test/api/whatsapp/notify')
  await db.exec(`INSERT INTO bookings (booking_number, status) VALUES ('B3', 'confirmed')`)
  assert.equal((await calls()).length, 5, 'insert already confirmed')
})

await test('a network error never blocks the booking update', async () => {
  await db.exec(`INSERT INTO net.fail VALUES (true)`)
  await db.exec(`UPDATE bookings SET status = 'closed' WHERE booking_number = 'B2'`)
  assert.equal((await one(`SELECT status FROM bookings WHERE booking_number = 'B2'`)).status, 'closed')
  await db.exec(`DELETE FROM net.fail`)
})

await test('RLS: staff read + mark read; drivers and anon see nothing; nobody but the service role writes messages', async () => {
  await as(ADMIN, 'authenticated')
  assert.equal((await all(`SELECT phone FROM whatsapp_conversations`)).length, 1)
  assert.ok((await all(`SELECT id FROM whatsapp_outbound_messages`)).length > 0)
  await db.exec(`UPDATE whatsapp_conversations SET unread = 0`)
  await rejects(() => db.exec(`INSERT INTO whatsapp_outbound_messages (to_phone, kind) VALUES ('91', 'staff')`), /permission denied/)
  await rejects(() => db.exec(`SELECT * FROM whatsapp_touch_conversation('91', 'in')`), /permission denied/)
  await rejects(() => db.exec(`SELECT whatsapp_apply_outbound_status('o1', 'read')`), /permission denied/)

  await as(DRIVER, 'authenticated')
  assert.equal((await all(`SELECT phone FROM whatsapp_conversations`)).length, 0)
  assert.equal((await all(`SELECT id FROM whatsapp_outbound_messages`)).length, 0)
  await as(null, 'anon')
  await rejects(() => db.exec(`SELECT * FROM whatsapp_conversations`), /permission denied/)
  await as(null)
  assert.equal((await one(`SELECT unread FROM whatsapp_conversations`)).unread, 0)
})

console.log(`\n${passed} passed`)

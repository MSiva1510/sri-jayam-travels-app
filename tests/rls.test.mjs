// RLS contract tests: runs the security-hardening migration against an
// in-process Postgres (PGlite) with a mock of Supabase's auth schema and
// asserts the access matrix for anon / driver / manager / admin.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const MIGRATION = new URL('../supabase/migrations/20260915_security_hardening.sql', import.meta.url)

const ADMIN   = '00000000-0000-0000-0000-000000000001'
const MANAGER = '00000000-0000-0000-0000-000000000002'
const DRIVER  = '00000000-0000-0000-0000-000000000003'

const SETUP = `
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
GRANT anon, authenticated TO postgres;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_user::text $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated;
CREATE TABLE public.profiles(id uuid PRIMARY KEY, email text, full_name text, role text, phone text, avatar_url text, status text DEFAULT 'active', created_at timestamptz DEFAULT now(), updated_at timestamptz);
CREATE TABLE public.customers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id text, mobile text, phone text, name text, type text, status text, primary_mobile text, notes text, is_active bool, created_at timestamptz DEFAULT now());
CREATE TABLE public.bookings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), booking_id text, booking_number text, type text, status text DEFAULT 'draft', customer_id uuid, created_by text, customer_name text, customer_contact text, pickup_location text, drop_location text, start_date date, start_time text, total_fare numeric, notes text, type_data jsonb, created_at timestamptz DEFAULT now(), updated_at timestamptz);
CREATE TABLE public.settings(id serial PRIMARY KEY, setting_key text, setting_value text);
CREATE TABLE public.role_permissions(role text, permission text, is_allowed bool, PRIMARY KEY(role,permission));
CREATE TABLE public.audit_logs(id serial PRIMARY KEY, action text);
CREATE TABLE public.drivers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text);
CREATE VIEW public.system_health_summary AS SELECT count(*) AS n FROM public.drivers;
CREATE SCHEMA storage; CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(), bucket_id text, name text, owner uuid);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO anon, authenticated; GRANT ALL ON storage.objects TO anon, authenticated;
CREATE POLICY trip_documents_select ON storage.objects FOR SELECT USING (bucket_id = 'trip-documents' AND auth.role() = 'authenticated');
-- the pre-hardening state: wide open + a legacy helper that old policies depend on
CREATE FUNCTION public.is_staff() RETURNS text LANGUAGE sql AS $$ SELECT 'old' $$;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_app_all ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY drivers_legacy ON public.drivers FOR SELECT USING (public.is_staff() = 'x');
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
INSERT INTO public.profiles(id,email,full_name,role) VALUES
 ('${ADMIN}','admin@x','Admin','admin'), ('${MANAGER}','mgr@x','Mgr','manager'), ('${DRIVER}','drv@x','Drv','driver');
INSERT INTO public.settings(setting_key,setting_value) VALUES ('company_id','SECRET');
INSERT INTO public.customers(customer_id,name,primary_mobile) VALUES ('C1','Existing Cust','9876543210');
`

let db
const as = async (role, uid, sql) => {
  await db.exec(`SET ROLE ${role}; ${uid ? `SET request.jwt.claim.sub = '${uid}';` : ''}`)
  try { return await db.query(sql) }
  finally { await db.exec('RESET request.jwt.claim.sub; RESET ROLE;') }
}
const denied = async (role, uid, sql, re = /permission denied|row-level security|Only an administrator/) =>
  assert.rejects(() => as(role, uid, sql), re)

before(async () => {
  db = new PGlite()
  await db.exec(SETUP)
  await db.exec(readFileSync(MIGRATION, 'utf8'))
})
after(() => db.close())

test('anon cannot read or write any table or view', async () => {
  for (const t of ['profiles', 'customers', 'settings', 'bookings', 'system_health_summary']) {
    await denied('anon', null, `SELECT count(*) FROM public.${t}`)
  }
  await denied('anon', null, `INSERT INTO public.profiles(id, role) VALUES ('${ADMIN.replace(/1$/, '9')}', 'admin')`)
})

test('anon can create a public booking (validated, customer reused, never returned)', async () => {
  const r = await as('anon', null, `SELECT public.public_create_booking('{"name":"Ravi Kumar","mobile":"9876543210","type":"one_way","start_date":"2099-01-01","pickup":"A","drop":"B"}') AS r`)
  assert.match(r.rows[0].r.booking_number, /^SJT-\d{6}-\d{4}$/)
  const rows = await db.query(`SELECT customer_id IS NOT NULL AS linked, type_data->>'source' AS src, status, created_by FROM public.bookings`)
  assert.deepEqual(rows.rows[0], { linked: true, src: 'public_portal', status: 'draft', created_by: 'public' })
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.customers')).rows[0].n, 1, 'existing customer reused')
  await denied('anon', null, `SELECT public.public_create_booking('{"name":"X","mobile":"123","type":"one_way","start_date":"2099-01-01"}')`, /Name is required/)
  await denied('anon', null, `SELECT public.public_create_booking('{"name":"Bad","mobile":"9000000001","type":"hack","start_date":"2099-01-01"}')`, /Invalid trip type/)
  await denied('anon', null, `SELECT public.public_create_booking('{"name":"Bad","mobile":"9000000001","type":"one_way","start_date":"2000-01-01"}')`, /in the past/)
})

test('driver: own profile only, no settings, cannot escalate', async () => {
  assert.equal((await as('authenticated', DRIVER, 'SELECT count(*)::int AS n FROM public.profiles')).rows[0].n, 1)
  assert.equal((await as('authenticated', DRIVER, 'SELECT count(*)::int AS n FROM public.settings')).rows[0].n, 0)
  await as('authenticated', DRIVER, `UPDATE public.profiles SET phone = '123' WHERE id = auth.uid()`)
  await denied('authenticated', DRIVER, `UPDATE public.profiles SET role = 'admin' WHERE id = auth.uid()`)
  await denied('authenticated', DRIVER, `INSERT INTO public.profiles(id, role) VALUES ('${ADMIN.replace(/1$/, '9')}', 'admin')`)
  await denied('authenticated', DRIVER, `INSERT INTO public.settings(setting_key, setting_value) VALUES ('x', 'y')`)
  await as('authenticated', DRIVER, `INSERT INTO public.audit_logs(action) VALUES ('driver_event')`)
  assert.equal((await as('authenticated', DRIVER, 'SELECT count(*)::int AS n FROM public.audit_logs')).rows[0].n, 0, 'logs are write-only for drivers')
  assert.equal((await as('authenticated', DRIVER, 'SELECT count(*)::int AS n FROM public.bookings')).rows[0].n, 1, 'operational tables readable')
})

test('manager: reads everything, cannot write settings or escalate', async () => {
  assert.equal((await as('authenticated', MANAGER, 'SELECT count(*)::int AS n FROM public.profiles')).rows[0].n, 3)
  assert.equal((await as('authenticated', MANAGER, 'SELECT count(*)::int AS n FROM public.settings')).rows[0].n, 1)
  const upd = await as('authenticated', MANAGER, `UPDATE public.settings SET setting_value = 'pwn'`)
  assert.equal(upd.affectedRows, 0)
  await denied('authenticated', MANAGER, `UPDATE public.profiles SET role = 'admin' WHERE id = auth.uid()`)
})

test('admin: full control', async () => {
  const NEW = ADMIN.replace(/1$/, '4')
  await as('authenticated', ADMIN, `INSERT INTO public.profiles(id, email, role) VALUES ('${NEW}', 'n@x', 'manager')`)
  await as('authenticated', ADMIN, `UPDATE public.profiles SET role = 'driver' WHERE id = '${NEW}'`)
  await as('authenticated', ADMIN, `UPDATE public.settings SET setting_value = 'changed'`)
  assert.equal((await as('authenticated', ADMIN, 'SELECT count(*)::int AS n FROM public.audit_logs')).rows[0].n, 1)
})

test('deactivated user sees nothing', async () => {
  await db.exec(`UPDATE public.profiles SET status = 'inactive' WHERE id = '${DRIVER}'`)
  assert.equal((await as('authenticated', DRIVER, 'SELECT count(*)::int AS n FROM public.bookings')).rows[0].n, 0)
})

test('storage: unrelated bucket policies survive, app buckets added', async () => {
  const r = await db.query(`SELECT polname FROM pg_policy WHERE polrelid = 'storage.objects'::regclass ORDER BY 1`)
  const names = r.rows.map(x => x.polname)
  assert.ok(names.includes('trip_documents_select'))
  assert.ok(names.includes('sjt_app_buckets_select'))
})

test('anon may execute only the two public RPCs', async () => {
  const r = await db.query(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND has_function_privilege('anon', p.oid, 'EXECUTE') ORDER BY 1`)
  assert.deepEqual(r.rows.map(x => x.proname), ['public_create_booking'])
})

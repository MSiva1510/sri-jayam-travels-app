# Security Hardening — 2026-09-15

Risk audit of the web app (`src/`, `supabase/`, `netlify/`) and the fixes applied.
Every item below is **fixed in code**; items marked ⚠️ also need a one-time
deployment action from you (listed at the bottom).

## Risk register

| # | Severity | Risk | Fix |
|---|----------|------|-----|
| 1 | **Critical** | `20260810_supabase_app_facing_rls.sql` gave `anon` **full read/write on every table** via `FOR ALL USING (true)`. The anon key ships in the JS bundle, so anyone could dump customers/bookings/profiles, read GPS vendor credentials in `settings`, rewrite `role_permissions`, or insert a `profiles` row with `role='admin'`. | ⚠️ `supabase/migrations/20260915_security_hardening.sql` — anon has zero table access; per-role policies (admin / manager / driver); deactivated profiles get nothing. |
| 2 | **Critical** | Privilege escalation: `adminCreateUser()` called `signUp()` (which **swaps the client session to the new user**) and then inserted the profile row — i.e. the new user inserted their own profile. Combined with #1, any self-registered user could create an admin profile. | `src/repositories/authRepository.js` — admin session is restored **before** the profile insert; DB trigger `profiles_guard_privileged_columns` blocks non-admins from creating profiles or changing `role`/`status` even if the client is bypassed. |
| 3 | **High** | Public booking page (`/book`) ran as anon and (a) **looked up customers by phone number** — enumeration of customer names, (b) inserted directly into `bookings`/`customers`. | `src/pages/PublicBooking.jsx` now calls one `SECURITY DEFINER` RPC, `public_create_booking(jsonb)`, which validates input, rate-limits (5/mobile/hour), reuses-or-creates the customer server-side and never returns customer data. The "Welcome back, {name}" lookup is removed. |
| 4 | **High** | `/api/gps-proxy` (Netlify function + Vite dev middleware) was **unauthenticated** — an open relay to the GPS vendor for anyone on the internet. | `netlify/functions/_lib/verifySupabaseUser.js` — requires a valid Supabase JWT **and** an active `admin`/`manager` profile; body size cap; vendor method restricted to GET/POST. `kingsTrackProvider.js` sends the `Authorization: Bearer` header. Same check wired into `vite.config.js` so dev matches prod. |
| 5 | **Medium** | Storage buckets `avatars` / `documents` had no app-owned policies (whatever was in the dashboard, likely permissive). | Migration §6: bucket-scoped policies for signed-in users only; delete limited to owner or staff. Other buckets untouched. |
| 6 | **Low** | `.gitignore` contained a merge-conflict marker (`<<<<<<< HEAD`), so `.env.*.local`, `build/`, `.dart_tool/` were **not** ignored. | Rewritten; `*.backup` files also ignored. |

### Policy model after the migration

| Table group | anon | driver | manager | admin |
|---|---|---|---|---|
| `profiles` | – | own row (name/phone/avatar only) | read all, edit own | full |
| `settings`, `backup_*`, `communication_providers` | – | – | read | full |
| `role_permissions` | – | read | read | full |
| `audit_logs`, `session_log`, `error_log` | – | insert | insert | full |
| everything else (bookings, customers, drivers, vehicles, attendance, expenses, gps_tracking, notifications, …) | – | full | full | full |
| `public_create_booking()` RPC | ✔ | ✔ | ✔ | ✔ |
| storage `avatars`/`documents` | – | read/write, delete own | full | full |

The Flutter driver app uses only "everything else" tables + own profile + the two
buckets, so it keeps working unchanged.

### Verification done

* Migration executed against a real Postgres (PGlite) with a mocked `auth.uid()`
  and the app's tables: 40 assertions (anon denied everywhere, RPC validation,
  driver/manager/admin boundaries, escalation blocked, deactivated user sees
  nothing, storage policy replacement) — all pass.
* Netlify proxy handler tested with mocked Supabase responses: 401 no token,
  401 bad token, 403 driver, 200 staff, 400 SSRF target, 400 bad method, 405 GET.
* `npm run build` — clean.

## ⚠️ Deployment steps (one time)

1. **Apply the migration** in the Supabase SQL editor for project
   `qxirmjvbufxxlkogelfj`: paste `supabase/migrations/20260915_security_hardening.sql`
   and run. It is idempotent (safe to re-run).
   *Do this together with deploying the web build* — the old `/book` page
   would stop working against the new policies, and the new page needs the RPC.
2. **Netlify env** — the proxy needs `SUPABASE_URL` and `SUPABASE_ANON_KEY`
   (it also falls back to `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, which
   are already set for the build, so no change is required if those exist).
3. **Supabase Auth → Providers → Email**: keep "Allow new users to sign up"
   ON (the admin *Create user* flow uses `signUp`). A self-registered user now
   gets **no profile** and is rejected at login ("User profile not found").
   Optionally turn on "Confirm email" — the admin flow still works.
4. Check `Authentication → Policies` in the dashboard afterwards; the only
   remaining policies on app tables should be the ones named in the migration.

## Still open (not code — decisions for you)

* Per-driver row scoping (a driver can currently read other drivers' bookings /
  attendance, same as before). Needs a `driver_id ↔ auth user` link that the
  schema doesn't have yet.
* The mobile app hard-codes the anon key (`supabase_config.dart`). Harmless now
  that anon has no data access, but `--dart-define` injection is still cleaner.
* Rotate the GPS vendor credentials stored in `settings` — they were readable by
  anyone until the migration is applied.

## Applied to production

- `20260915_public_login_stats.sql` — applied 2026-09-15 (via SQL editor)
- `20260915_security_hardening.sql` — applied 2026-09-15 (via SQL editor). Post-check: 67 policies, 0 anon/public policies, 0 anon table grants, anon can execute only `public_create_booking` + `public_login_stats`.

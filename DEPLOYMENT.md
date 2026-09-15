# Deployment Runbook — Sri Jayam Travels

| Component | Where | How it deploys |
|---|---|---|
| Web ERP (React/Vite) | Netlify | `git push main` → Netlify builds `npm run build`, publishes `dist/` |
| `/api/gps-proxy` | Netlify Function | bundled from `netlify/functions/gps-proxy.js` on the same deploy |
| Database / Auth / Storage | Supabase project `qxirmjvbufxxlkogelfj` | SQL migrations in `supabase/migrations/`, applied by hand in the SQL editor |
| Driver app (Flutter) | Android APK | `flutter build apk --release` (see Mobile) |

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Netlify build env, `.env.local` | Supabase project URL (public) |
| `VITE_SUPABASE_ANON_KEY` | Netlify build env, `.env.local` | Publishable key — safe to ship; anon has **no table access** (see SECURITY_HARDENING.md) |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Netlify (optional) | Used by the GPS proxy to verify user JWTs; falls back to the `VITE_` values |
| `GPS_PROXY_ALLOWED_HOSTS` | Netlify (optional) | Comma-separated vendor hosts the proxy may relay to. Default `mvt.apmkingstrack.com` |
| `VITE_GPS_MOCK` | local only | `true` → fleet page uses 3 mock vehicles, never hits the vendor |

Never put the **service-role** key anywhere in this repo or in `VITE_*` variables — it bypasses RLS.

## Standard release (web)

1. `npm run check` locally (build + tests). CI runs the same on every PR.
2. If the release includes a file in `supabase/migrations/`:
   - open Supabase → SQL Editor → paste the file → Run;
   - re-run `npm run test:rls` locally beforehand (it executes the hardening migration in an in-process Postgres).
   - **Order matters**: apply the migration, then deploy the web build within the same window. The public booking page and login stats depend on RPCs that the migrations create.
3. Merge to `main` → Netlify deploys. Watch the deploy log for the `gps-proxy` function bundling step.
4. Smoke test on production:
   - `/login` shows the three stat cards with numbers (proves `public_login_stats` works);
   - `/book` submit returns an `SJT-…` reference;
   - sign in as admin → `/fleet` → "Sync now" succeeds (proves the proxy accepts the JWT);
   - open DevTools → Network → confirm no `4xx` from `*.supabase.co` on normal pages.

## Rollback

- **Web**: Netlify → Deploys → pick the previous deploy → *Publish deploy*. Instant.
- **Migration**: the hardening migration is idempotent and additive-on-rerun; there is no "undo" script by design (undoing it re-opens the DB to anon). If a policy blocks a legitimate flow, fix the policy in a new migration rather than dropping RLS.
- **Function**: rolls back together with the web deploy.

## Mobile (Flutter)

- The APK ships the publishable anon key in `lib/core/config/supabase_config.dart`. Inject it with `--dart-define=SUPABASE_ANON_KEY=…` before a store release.
- `android/app/build.gradle.kts` still signs **release** builds with the debug keystore (`TODO` on line 30). Before any Play Store upload: create a keystore, add `android/key.properties` (git-ignored) and a `signingConfigs.release` block.
- Realtime for `notifications` is not enabled in the Supabase publication yet; the app degrades to manual refresh.

## Secrets & rotation

- The GPS vendor `company_id` / `user_id` in the `settings` table were readable by anyone before 2026-09-15. Rotate them with the vendor, then update via `/fleet/settings`.
- Supabase anon key: publishable by design; rotate only if the project's service-role key is ever exposed (rotate both from Project Settings → API).

## Observability

- Netlify: Functions → `gps-proxy` → logs (auth failures are returned as 401/403 JSON, not thrown).
- Supabase: Logs → Postgres for `permission denied` spikes after a deploy (means a client path is hitting a table its role can't see).
- App: `error_log` table (insert-only for users, readable by admins in `/admin/health`).

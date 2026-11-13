# Deployment Runbook — Sri Jayam Travels

| Component | Where | How it deploys |
|---|---|---|
| Web ERP (React/Vite) | Vercel | `git push main` → Vercel builds `npm run build`, publishes `dist/` |
| `/api/gps-proxy` | Vercel Function | bundled from `vercel/functions/gps-proxy.js` on the same deploy |
| `/api/whatsapp/webhook` | Vercel Function | Meta Cloud API callback; bundled from `vercel/functions/whatsapp-webhook.js` |
| `/api/whatsapp/notify` | Vercel Function | trip template messages; bundled from `vercel/functions/whatsapp-notify.js` |
| `/api/whatsapp/send` | Vercel Function | inbox replies / bot resume; bundled from `vercel/functions/whatsapp-send.js` |
| Database / Auth / Storage | Supabase project `qxirmjvbufxxlkogelfj` | SQL migrations in `supabase/migrations/`, applied by hand in the SQL editor |
| Driver app (Flutter) | Android APK | `flutter build apk --release` (see Mobile) |

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Vercel build env, `.env.local` | Supabase project URL (public) |
| `VITE_SUPABASE_ANON_KEY` | Vercel build env, `.env.local` | Publishable key — safe to ship; anon has **no table access** (see SECURITY_HARDENING.md) |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Vercel (optional) | Used by the functions to verify user JWTs; falls back to the `VITE_` values |
| `GPS_PROXY_ALLOWED_HOSTS` | Vercel (optional) | Comma-separated vendor hosts the proxy may relay to. Default `mvt.apmkingstrack.com` |
| `WHATSAPP_VERIFY_TOKEN` | Vercel (server only) | Meta callback verification token |
| `WHATSAPP_APP_SECRET` | Vercel (server only) | Verifies `X-Hub-Signature-256` on webhook POSTs |
| `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` | Vercel (server only) | Cloud API sending |
| `WHATSAPP_NOTIFY_SECRET` | Vercel (server only) | Shared secret for booking triggers calling `/api/whatsapp/notify` |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (server only) | Functions' DB access (bypasses RLS — never ship to the browser) |
| `VITE_GPS_MOCK` | local only | `true` → fleet page uses 3 mock vehicles, never hits the vendor |

Never put the **service-role** key anywhere in this repo or in `VITE_*` variables — it bypasses RLS.

## Standard release (web)

1. `npm run check` locally (build + tests). CI runs the same on every PR.
2. If the release includes a file in `supabase/migrations/`:
   - open Supabase → SQL Editor → paste the file → Run;
   - re-run `npm run test:rls` locally beforehand (it executes the hardening migration in an in-process Postgres).
   - **Order matters**: apply the migration, then deploy the web build within the same window. The public booking page and login stats depend on RPCs that the migrations create.
3. Merge to `main` → Vercel deploys. Watch the deploy log for the `gps-proxy` and `whatsapp-*` function bundling steps.
4. Smoke test on production:
   - `/login` shows the three stat cards with numbers (proves `public_login_stats` works);
   - `/book` submit returns an `SJT-…` reference;
   - sign in as admin → `/fleet` → "Sync now" succeeds (proves the proxy accepts the JWT);
   - open DevTools → Network → confirm no `4xx` from `*.supabase.co` on normal pages.

## Rollback

- **Web**: Vercel → Deployments → pick the previous deploy → *Promote to Production*. Instant.
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

- Vercel: Project → Functions → logs (auth failures are returned as 401/403 JSON, not thrown).
- Supabase: Logs → Postgres for `permission denied` spikes after a deploy (means a client path is hitting a table its role can't see).
- App: `error_log` table (insert-only for users, readable by admins in `/admin/health`).

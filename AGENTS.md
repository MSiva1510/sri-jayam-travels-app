# AGENTS.md — Sri Jayam Travels

## Verify first
- Node 22 (`.nvmrc`; `engines: >=20.19 <25`). CI uses `npm ci`, not `npm install`.
- Scripts: `npm run dev`, `npm run build`, `npm run preview`, `npm test`, `npm run test:rls`, `npm run test:e2e`, `npm run check` (= build + test). There is no lint/typecheck script; `tsconfig.json` is editor-only (`noEmit`).
- Focused test: `node --test tests/<name>.test.mjs`. Root `npm test` includes `tests/rls.test.mjs` (PGlite, no Docker) but **not** `supabase/tests/`.
- Browser smoke tests: `npx playwright install chromium` once, then `npm run test:e2e`. They render the real modals from `e2e/modal-harness.html` with inert callbacks; no Supabase env or app auth needed.
- SQL migration tests are a separate package: `cd supabase/tests && npm install && npm test` (PGlite).
- CI (`.github/workflows/ci.yml`): prod `npm audit --audit-level=high`, build, tests, secret guards. Mobile `flutter analyze/test` is advisory (`continue-on-error: true`) due pre-existing errors.
- Prefer Serena for symbol-level navigation; keep reads targeted.

## Architecture
- Vite + React 18 SPA: `src/main.jsx` → `src/App.jsx` (react-router). `vercel.json` rewrites all routes to `/index.html`; output is `dist/`.
- Server logic lives in `vercel/functions/*` using `{ statusCode, headers, body }`. Files under `api/` are thin Vercel wrappers via `server/vercelAdapter.js`.
- Dev server mirrors only `/api/gps-proxy` and `/api/whatsapp/send` in `vite.config.js`; other API routes are production-only locally.
- `vite.config.js` excludes `maplibre-gl` from the dep optimizer on purpose (its worker bundle breaks dev). Do not remove that.
- Data path: pages → `src/data/*Data.js` (cached facades) → `src/repositories/*Repository.js` (Supabase). `src/lib/supabase.js` is `null` without `VITE_` env, so tests degrade to offline fallbacks.
- `tripRepository.toDbBooking()` whitelists booking columns; unknown top-level fields are dropped on Supabase. Add new fields there or nest them in `type_data`.
- `normalizeBooking()` in `src/data/tripTypes.js` is the canonical camelCase booking view. Keep both camelCase and DB `snake_case` aliases when changing booking fields.
- Booking statuses are constrained in `supabase/migrations/20260820_fix_bookings_status_constraint.sql`; workflow transitions live in `WORKFLOW_TRANSITIONS` in `src/data/tripTypes.js`.
- Public booking writes through the `public.public_create_booking` RPC, which validates type/time and rejects past dates. Do not replace it with a direct table insert.

## Environment & deploy
- Copy `.env.example` → `.env.local`. Never commit `.env*`, the service-role key, or JWT-like secrets; CI greps `src`, `vercel`, and `mobile/lib`.
- Anon key is publishable by design; anon has no table access. Service-role is server-only (Vercel functions).
- Deploy is Vercel-only: push `main` → `npm run build` → `dist`. Watch function bundling for `gps-proxy` and `whatsapp-*`.
- Supabase migrations in `supabase/migrations/` are applied manually in the SQL editor; apply them before the web build when RPCs are involved. There is no rollback script by design.
- `20261118_expense_type_details.sql` must be applied before Parking/Toll/Bata/Maintenance detail fields persist; reads/writes fall back safely until then.
- `VITE_OCR_PROVIDER` must be set at build time to enable `/api/ocr/extract`; `OPENAI_API_KEY` is server-only. `VITE_GPS_MOCK` is local-only.
- Flutter app lives in `mobile/`; release APK still uses the debug keystore until `android/key.properties` is added.

## UI conventions
- Theme tokens live in `src/index.css` (`--ap-surface`, `--ap-surface-2`, `--ap-border`, `--ap-text-*`, `--ap-accent`, `--ap-radius-*`, `--ap-motion-*`). `.dark` is toggled by `AppContext`.
- Reuse `src/components/ui/` primitives (`Button`, `Field`, `ModalOverlay`, `IconButton`, `Callout`, `StatusPill`, `Surface`, `LocationPicker`, etc.) before adding packages. `components.json` exists but its shadcn paths are blank and no shadcn packages are installed.
- `ModalOverlay` portals to `document.body`; use it for dialogs. `LocationPicker` supports typed text, maps links, live location, and the OSM marker; pass `showLabel={false}` when the parent already renders a label.
- Expected bar: premium Apple-inspired iOS/macOS light/dark UI, consistent tokens, responsive, accessible, no generic template look.

## Guardrails
- Preserve Supabase queries/RLS, booking fields, and status workflow. No schema change without explicit justification and a migration.
- Never remove existing features without approval. No mock data in production.
- Run `npm run check` after changes; add `npm run test:rls` for auth/policy changes and `supabase/tests` for SQL function changes.

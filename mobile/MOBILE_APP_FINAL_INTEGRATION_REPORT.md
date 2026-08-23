# MOBILE APP FINAL INTEGRATION REPORT

**Project:** Sri Jayam Travels — Driver Mobile App (`mobile/`)
**Branch:** `mobile-integration-local` (local only — nothing pushed)
**Starting commit:** `c3aac43` ("day 48 + extra", on `main`)
**Date:** 2026-08-23

---

## STATUS: PARTIAL → see "Remaining issues" for the two items that require
## physical-device / backend action. All code work is COMPLETE and green.

---

## Current Architecture

Every module follows the same layering — no screen touches Supabase directly:

```
Screen
  ↓ Provider (Riverpod StateNotifier)
  ↓ Service (business rules, error mapping)
  ↓ Repository (only Supabase access)
  ↓ Supabase (Postgres + RLS, Storage, Realtime)
```

Module inventory after integration:

| Module | Model | Repository | Service | Provider | Screen(s) |
|---|---|---|---|---|---|
| Auth/Session | UserProfile, DriverProfile | auth_repository | auth_service | auth_provider | login, forgot_password, unauthorized, no_connection |
| Dashboard | — | — | — | derived selectors | driver_home |
| Trips | TripModel | trip_repository | trip_service | trip_provider | trips, trip_details, trip_map |
| Bookings | BookingModel | booking_repository | booking_service | booking_provider | bookings, booking_details |
| Attendance | AttendanceModel | attendance_repository | attendance_service | attendance_provider | attendance, history |
| GPS | GpsPosition | gps_repository | location_service, gps_tracking_service | gps_provider | (map = trip_map) |
| Documents | DriverDocument | document_repository | document_service | document_provider | documents |
| **Notifications (NEW)** | AppNotification | notification_repository | notification_service | notification_provider | notifications |
| **Communication (NEW)** | CommunicationResult | — | communication_service | (screen-level) | messages |
| **Settings (NEW)** | AppThemeMode | SharedPreferences | theme_controller | theme_provider | settings |

## Authentication

- Email + password via Supabase (`signInWithPassword`). Show/hide password,
  validation, loading spinner, friendly error banner.
- Forgot-password flow sends a real reset email.
- No mock/demo/default credentials anywhere (verified by scan).
- Roles: `driver` required; admin/manager allowed by `_allowedRoles` but the
  app is driver-oriented; everyone else lands on Access Denied.

## Session

- Startup: initialize Supabase → restore session → load profile → load driver
  (`profile_id` FK fast-path with email fallback) → Driver Home.
- **No `session.isExpired` check** — SDK auto-refresh handles token rotation;
  network failure on restore shows the Retry (no-connection) screen, NOT a
  false "session expired".
- Remote sign-out / refresh-token revocation handled via `onAuthStateChange`.

## Logout (full teardown)

Central hook in `main.dart` `_AuthGuard` fires on ANY transition out of
authenticated state:

1. GPS: stream subscription + sync timer killed immediately, bounded flush.
2. Notifications realtime channel removed, cached rows cleared (**new**).
3. ALL module providers invalidated (trips, bookings, attendance, documents,
   counts) so no data leaks across accounts (**new**).
4. Supabase signed out; go_router redirect forces Login for every protected
   route — back button cannot restore Driver Home.

## Driver Profile

Real data from `drivers` table (verified columns only): name, email, phone,
driver ID, address, city, DOB, joined date, license number/expiry (+ expired /
expiring-soon warning), Aadhaar, emergency contact, notes, photo/avatar.
Empty fields show placeholders — no fake values.

## Dashboard

Driver name/photo/status header, greeting, date, attendance quick-action card
(check-in/out inline), GPS status card with live trip-tracking banner,
Documents entry, Messages entry (**new**, with unread badge), Today's Trips +
Active Bookings stat cards, quick nav, upcoming trips/bookings previews.
Loading/empty/error states throughout.

## Bookings

RLS-enforced list (Active/Upcoming/Past tabs), detail view with vehicle JOIN
and stops. Financial columns never requested. Defence-in-depth ownership check
in service layer on top of RLS.

## Trips

Today's trips + full history, detail view with route/customer/vehicle/stops/
notes. Status values mirror the Web ERP exactly: `draft | assigned | started |
completed | cancelled` (drivers never see drafts).

## Trip Workflow

`assigned → started → completed`, guarded in the service layer:
start only when assigned, complete only when started, other drivers' trips
blocked even if RLS ever passed them. Unit-tested.

## Attendance

Check-in / check-out against the shared `attendance` table using Web ERP
formats (`HH:MM` TEXT times, `"X hours Y minutes"`). Guards prevent duplicate
check-in, checkout-without-check-in, duplicate check-out (unit-tested).
History grouped by month.

## GPS

Single tracking system: geolocator stream → quality gates (sanity, accuracy ≤
100 m, min interval, min distance) → upsert into shared `gps_tracking`
(UNIQUE(vehicle_id, timestamp) dedup) → offline queue with automatic retry.
Foreground-only by design; pause/resume on app lifecycle.

### CRITICAL BUG FOUND & FIXED (by new unit tests)

`GpsTrackingService.startTracking()` created the `ActiveTripContext` but never
stored it in `state.context`. Consequences before this fix:
- `isTracking` was always `false` after start,
- live position handling bailed out at its first guard,
- pause/resume were no-ops,
- `stopTracking()` early-returned, so trip completion/logout did NOT stop the
  stream or timer through the normal path,
- dashboard/trip-screen "live tracking" banners could never appear.

Fix: session context is stored in state immediately when created
(`lib/services/gps_tracking_service.dart`). Covered by 13 new GPS tests.

## Map

flutter_map + OpenStreetMap tiles (no paid API). Shows current marker, route
polyline (stored gps_tracking rows merged with live points), status overlay
(lat/lng/accuracy/speed/updated), recenter FAB, graceful degradation when GPS
or tiles are unavailable.

## Documents / Camera

Camera or gallery capture → magic-byte validation (JPEG/PNG/PDF, ≤5 MB) →
upload to the existing `documents` Storage bucket under
`driver-documents/<driverId>/…` → row insert writing both modern and legacy
columns (web-compatible). View/delete/metadata-edit with ownership checks.
No new bucket.

## Notifications (NEW MODULE)

Backed by the EXISTING Web ERP `notifications` table (schema verified from
`src/services/notificationService.js`; keyed strictly by `user_id` = auth.uid).

- List (unread/read), unread badge derived from the list (zero extra queries),
  mark-one-read, mark-all-read, pull-to-refresh.
- First realtime consumer of this table anywhere: single Supabase Realtime
  channel filtered by `user_id` for INSERT/UPDATE. If realtime is not enabled
  server-side, the app degrades silently to pull-to-refresh.
- Channel removed + state cleared on logout.
- Honest empty state — no seeded/fake rows. NOTE: today the Web ERP only
  writes self-notifications for acting staff; until the backend starts
  targeting drivers, drivers will legitimately see an empty feed.

## Communication (NEW MODULE)

Provider-independent foundation per spec:
`Flutter → CommunicationService → (future Edge Function) → provider`.
No WhatsApp credentials or private API calls in the APK. `whatsAppReady` is
false, so sending returns `CommunicationNotConfigured` and the UI shows
**"WhatsApp integration coming soon"** — success is never faked. Enabling
later requires only flipping readiness to a backend config check + invoking an
Edge Function that holds keys server-side.

## WhatsApp Readiness

Mirrors web reality: web adapters are TODO stubs too; wa.me deep links exist on
web but mobile intentionally does NOT fake delivery. Templates/engine exist
server-side (`communication_logs`, providers tables) for the future function.

## Branding / App Icon

- SVG logo on splash/login (`assets/images/logo.svg`), consistent blue identity
  seeded from `#1565C0`.
- Android launcher icons verified for mdpi→xxxhdpi including adaptive
  foreground layers; label "Sri Jayam Travels".

## Theme / UI Fixes

- Light/dark/system all functional; Settings screen persists choice via
  SharedPreferences (single source of truth — no second theme system).
- Existing design direction preserved; no redesign.
- New screens reuse the established Card/ListTile/status-badge language,
  Material 3, SafeArea-aware layouts.

## Security

- Scan for `service_role|api_key|secret|password=` across `lib/`: clean.
- Only the publishable anon key ships (safe by design); rotation comment kept.
- No mock/dummy/demo business data in production code.
- RLS never bypassed; every query additionally scoped client-side
  (`user_id`, `driver_id`) with service-layer ownership checks.

## RLS

Relies on existing server policies (bookings_driver_own, attendance_driver_own_*,
documents, blanket app policy for notifications). No client-side impersonation,
no service role.

## Real-device Testing

**NOT performed in this environment** — no physical Android device/emulator is
attached to this machine (`flutter build apk --debug` succeeded; install/run
steps of the E2E checklist remain for the developer). See Remaining issues.

## Build Result

| Step | Result |
|---|---|
| `flutter clean && flutter pub get` | PASS |
| `flutter analyze` | PASS — No issues found |
| `flutter test` | PASS — 39/39 (was 1 test; +38 new) |
| `flutter build apk --debug` | PASS — `build\app\outputs\flutter-apk\app-debug.apk` |

## Known Limitations

1. Foreground-only GPS (documented design decision; battery-first).
2. Notifications realtime depends on the table being added to the Supabase
   realtime publication; without it the feature degrades to manual refresh.
3. Backend currently never targets drivers in `notifications` (web self-addresses
   staff) — driver feed will be empty until TRIP_ASSIGNED etc. write
   `user_id = <driver's auth uid>` rows. Client is ready.
4. WhatsApp/SMS/push disabled until a server-side provider is configured.
5. iOS folder exists but was not validated (project targets Android first).

## Remaining Issues (real, actionable)

1. **Physical-device E2E run** (Step 30–31 checklist): install
   `app-debug.apk`, verify launch→login→session→logout→back-button, GPS while
   physically moving, camera capture/upload on hardware.
2. **Backend**: add `notifications` to the realtime publication AND start
   writing driver-targeted rows (`user_id` of the driver's auth user) on
   trip assignment — then the badge/feed light up with zero app changes.
3. Optional hardening: replace hardcoded anon key with `--dart-define` env
   injection before store release.

## Recommended Next Step

Wire the backend side of driver notifications (realtime publication +
driver-targeted inserts from the trip-assignment flow), then run the
physical-device E2E checklist on a real phone with a real assigned trip.

---

## File Reporting (per spec)

### NEW FILES
- `mobile/lib/models/app_notification.dart` — notification model (verified schema)
- `mobile/lib/repositories/notification_repository.dart` — Supabase + realtime channel
- `mobile/lib/services/notification_service.dart` — guards + friendly errors
- `mobile/lib/providers/notification_provider.dart` — state, unread selector, teardown
- `mobile/lib/screens/driver/notifications_screen.dart` — feed UI
- `mobile/lib/services/communication_service.dart` — provider-independent comm layer
- `mobile/lib/screens/driver/communication_screen.dart` — Messages hub (WhatsApp soon)
- `mobile/lib/providers/theme_provider.dart` — persisted theme mode
- `mobile/lib/screens/driver/settings_screen.dart` — appearance/about/logout
- `mobile/test/auth_error_mapping_test.dart` — network-vs-expiry regression guard
- `mobile/test/attendance_service_test.dart` — duplicate-check guards
- `mobile/test/trip_service_test.dart` — access control + lifecycle transitions
- `mobile/test/gps_tracking_service_test.dart` — full GPS lifecycle (found the bug)
- `mobile/test/notification_module_test.dart` — service guards + unread derivation
- `mobile/MOBILE_APP_FINAL_INTEGRATION_REPORT.md` — this report

### CHANGED FILES
- `mobile/pubspec.yaml` — shared_preferences promoted to runtime dep
- `mobile/pubspec.lock` — resolution update from the above
- `mobile/lib/core/config/supabase_config.dart` — + notificationsTable constant
- `mobile/lib/main.dart` — theme mode wiring; central logout teardown now also
  clears notifications + invalidates all module providers
- `mobile/lib/navigation/app_router.dart` — + notifications/messages/settings routes
- `mobile/lib/screens/driver/driver_home_screen.dart` — bell w/ unread badge,
  Messages card, lazy notification bootstrap
- `mobile/lib/screens/driver/driver_profile_screen.dart` — Settings card
- `mobile/lib/services/gps_tracking_service.dart` — **CRITICAL FIX**: store
  ActiveTripContext in state at session start (isTracking/pause/resume/stop
  and live-update pipeline now actually function)

### DELETED FILES
None

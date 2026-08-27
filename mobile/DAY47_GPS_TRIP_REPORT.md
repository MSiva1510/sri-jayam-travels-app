# DAY 47 — Flutter GPS + Live Trip Tracking + Map

**Project:** Sri Jayam Travels ERP — Phase 2 (Flutter Driver App)
**Starting commit:** `6080cd7` (branch `backup/fleet-audit-2026-08-20`)
**Date:** 2026-08-22

---

## 1. Starting State (Day 46 reuse)

Day 46 already delivered and was REUSED, not rewritten:

| Existing piece | Reuse |
|---|---|
| `lib/services/location_service.dart` — permission flow + single fix | Extended with `getPositionStream()` + `distanceBetween()` |
| `lib/models/gps_position.dart` | Extended with `speedKmh` + `isValid` guards |
| `lib/repositories/gps_repository.dart` — stub | Implemented against verified schema |
| geolocator ^13.0.4 in pubspec | Kept |
| Manifest permissions (`ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`) | Kept — foreground only |
| Auth/session restore fix (Day 46), login, router, driver screens | Untouched |

## 2. GPS Architecture

```
Driver Login
  → Driver Home
  → Assigned Trip (bookings, RLS-filtered)
  → Trip Details
  → START TRIP
      ├─ requestPermission() + GPS-enabled check   ← pre-flight BEFORE DB write
      ├─ bookings.status = 'started'               ← EXISTING workflow (RLS)
      └─ GpsTrackingService.startTracking()
            ├─ initial fix persisted immediately
            ├─ geolocator stream (OS distanceFilter = 20 m)
            └─ per-fix gates: valid → accuracy ≤ 100 m → ≥10 s interval → ≥25 m moved
  → Phone GPS
      → LocationService.getPositionStream()
      → GpsTrackingService.handleLocationUpdate()
      → GpsRepository.saveLocation()  (upsert, UNIQUE(vehicle_id,timestamp))
      → Supabase gps_tracking         ← SAME table as Web ERP
  → Trip Map (flutter_map / OpenStreetMap)
  → STOP TRIP
      ├─ final fix fetched + persisted (8 s bounded)
      ├─ listeners + sync timer cancelled FIRST
      ├─ pending queue flushed (6 s bounded)
      └─ bookings.status = 'completed'             ← EXISTING workflow (RLS)
```

## 3. Actual Supabase Tables & Columns Used

Verified from Web ERP source (`src/repositories/gpsHistoryRepository.js`,
`src/data/tripTypes.js`, `src/data/attendanceData.js`) — nothing invented:

### gps_tracking (INSERT target)
```
vehicle_id  UUID    required (UNIQUE together with timestamp)
trip_id     text    nullable
driver_id   UUID    nullable
latitude    double  required
longitude   double  required
accuracy    double  metres
speed_kmh   double  (m/s × 3.6)
bearing     double  degrees
gps_online  boolean true → phone fix
timestamp   timestamptz ISO-8601 UTC
raw         jsonb   {source:'flutter_driver_app'}
```

### bookings (trip source of truth)
```
id, booking_number, status, driver_id (UUID→drivers), driver_name (TEXT fallback),
vehicle_id (UUID→vehicles), vehicle_reg, pickup_location, drop_location,
start_date, start_time, total_km, type_data …
Workflow used: assigned → started → completed (matches Web ERP WORKFLOW_TRANSITIONS)
```

### drivers
```
id (UUID PK), driver_id ("DRV-001"), profile_id (UUID → auth.users.id, Day 42 FK),
name, status …   ← NO user_id column (never assumed)
```

## 4. Relationship Resolution (no manual entry)

```
Supabase session user (auth.users.id)
  → profiles.id
  → drivers.profile_id        (loaded by existing AuthService)
  → DriverProfile.id          (= drivers.id = bookings.driver_id)
Trip fetched under RLS ("bookings_driver_own")
  → trip.vehicle_id           (vehicles.id — direct FK on the booking)
  → trip.driver_id            (defence-in-depth re-check vs DriverProfile.id)
GPS row written with trip.vehicle_id + trip.id + trip.driver_id
```

The driver never enters vehicle ID / IMEI / driver ID anywhere.
(IMEI lives on `vehicles.imei` for external tracker feeds; irrelevant to phone GPS.)

## 5. Location Permissions

- Manifest: `ACCESS_FINE_LOCATION` + `ACCESS_COARSE_LOCATION` (foreground).
- Requested at START TRIP via existing `LocationService.requestPermission()`.
- Permanently-denied → user guided to OS settings; trip is NOT started.
- No background permission requested; none claimed.

## 6. Tracking Frequency (configurable)

`GpsTrackingConfig` (lib/services/gps_tracking_service.dart):

| Knob | Default | Purpose |
|---|---|---|
| `osDistanceFilterM` | 20 m | OS-level wake threshold (battery) |
| `minInterval` | 10 s | min time between accepted fixes |
| `minDistanceM` | 25 m | min real movement between accepted fixes |
| `maxAccuracyM` | 100 m | discard junk fixes |
| `syncTickInterval` | 30 s | offline-queue retry cadence |
| `maxQueueSize` | 500 | in-memory pending cap (oldest dropped) |

A stationary device produces ~0 uploads; driving produces roughly one point
per 25 m — battery/network friendly.

## 7. Map Implementation

- `flutter_map 8.3.1` + `latlong2` (OpenStreetMap tiles, free, no API keys).
- Shows: live position marker, route polyline (stored points + live points
  merged), attribution widget.
- Recenter FAB; auto-follow cancels when user pans manually.
- Handles: no GPS data yet ("Waiting for first GPS fix…"), tracking off,
  offline queue notice. Tile/network failures degrade gracefully (no crash).

## 8. Foreground / Background Behavior

**Foreground-only. Documented honestly:** when Android backgrounds the app,
the geolocator stream stops (no foreground service). The app pauses tracking
on `paused/hidden` lifecycle and resumes on `resumed`; context and queue are
preserved. Real background tracking would require a foreground service +
`ACCESS_BACKGROUND_LOCATION` — deliberately NOT implemented or claimed.

## 9. Network Failure Behavior

Failed uploads are NEVER reported as success:
- point goes to an in-memory queue; UI shows "GPS temporarily offline — N
  point(s) will sync automatically";
- retries run every 30 s while tracking, once on resume, and once (bounded
  6 s) during STOP;
- DB-level dedup (`ON CONFLICT (vehicle_id,timestamp) DO NOTHING`) means a
  retry can never create duplicate rows;
- queue is memory-only (clean pending-sync interface; full offline store is
  explicitly out of scope today). Points still queued when the process dies
  are lost — documented limitation.

## 10. Duplicate Protection

- single stream subscription (cancel-before-subscribe pattern);
- guarded `_busy` flag around start/stop;
- `isTracking` no-op guards on start/pause/resume;
- periodic sync timer cancelled on stop/dispose/logout;
- in-session identical-timestamp skip;
- DB UNIQUE(vehicle_id,timestamp) upsert dedup.

## 11. Logout / Session Expiry

Central auth listener (main.dart `_AuthGuard`): any transition from
authenticated → not-authenticated calls `disposeSession()` which:
1. cancels the position subscription immediately,
2. cancels the sync timer,
3. clears queue/context/state.
Covers manual logout, remote sign-out and token revocation. No GPS request
can survive logout.

## 12. Security / RLS

- Mobile writes only `{vehicle_id, trip_id, driver_id}` taken from the
  RLS-fetched trip object — a driver cannot address another vehicle/driver.
- Trip ownership re-checked client-side (`getTripById` compares
  `driver_id`/`driver_name`) before any status change.
- RLS untouched and remains enabled; no policy bypassed; anon key only.
- ⚠️ Verify on the LIVE database that `gps_tracking` has an INSERT policy for
  the driver role (Web ERP inserts through the same browser-authed client,
  so an insert path exists; if it is admin-only, add a policy allowing
  drivers to insert rows where `driver_id = get_driver_id()`).

## 13. Real-Device Test Results

**NOT PERFORMED — no physical Android device was attached to this machine**
(`flutter devices`: Windows/Chrome/Edge only; adb unavailable). The debug APK
builds cleanly; install and verify manually:

```
flutter install --debug        # or: adb install build\app\outputs\flutter-apk\app-debug.apk
```

Checklist: login → session restore → open assigned trip → allow location →
START TRIP → move 100–500 m → observe points on map → COMPLETE TRIP →
confirm tracking stops → logout → confirm no GPS activity.

## 14. Files Created

| Path | Purpose |
|---|---|
| `lib/services/gps_tracking_service.dart` | tracking engine: start/stop/pause/resume, quality gates, offline queue |
| `lib/providers/gps_provider.dart` | Riverpod wiring (app-lifetime service) |
| `lib/screens/driver/trip_map_screen.dart` | OSM live trip map |
| `DAY47_GPS_TRIP_REPORT.md` | this document |

## 15. Files Modified

| Path | Change |
|---|---|
| `pubspec.yaml` / `pubspec.lock` | + flutter_map 8.3.1, latlong2; + shared_preferences (dev, for widget test) |
| `lib/core/config/supabase_config.dart` | + `gpsTrackingTable` constant |
| `lib/models/gps_position.dart` | + `speedKmh`, `isValid` |
| `lib/repositories/gps_repository.dart` | stub → full saveLocation/Batch, getLatestLocation, getTripLocations |
| `lib/services/location_service.dart` | + `getPositionStream(distanceFilterM:)`, `distanceBetween()` |
| `lib/repositories/trip_repository.dart` | + `markStarted`, `markCompleted` (status-only updates) |
| `lib/services/trip_service.dart` | + `startTrip`, `completeTrip` (+ invalidTransition error code) |
| `lib/providers/trip_provider.dart` | TripDetailNotifier + startTrip/completeTrip |
| `lib/screens/driver/trip_details_screen.dart` | START TRIP / STOP TRIP actions, live-GPS banner, retry-GPS card, map link |
| `lib/navigation/app_router.dart` | + `/driver/trips/:id/map` route |
| `lib/main.dart` | auth-transition GPS teardown + app-lifecycle pause/resume |
| `test/widget_test.dart` | fixed pre-existing broken test (was missing ProviderScope/Supabase init) |

## 16. Files Deleted

None.

## 17. Tests Executed

| Command | Result |
|---|---|
| `flutter pub get` | PASS |
| `flutter analyze` | PASS — 0 errors; 3 warnings remain, all pre-existing Day 46 files (attendance_screen, driver_bookings_screen, driver_home_screen), intentionally untouched |
| `flutter test` | PASS (1/1) |
| `flutter build apk --debug` | PASS — `build/app/outputs/flutter-apk/app-debug.apk` |
| Physical device | NOT PERFORMED (see §13) |

## 18. Known Issues / Remaining

1. Physical-device verification pending (§13 checklist).
2. `gps_tracking` INSERT RLS policy for drivers should be confirmed on the
   live DB (§12).
3. Offline queue is memory-only by design; durable offline store is future
   work (interface ready via `syncPendingLocations()`).
4. Background tracking intentionally not implemented (§8).
5. Pre-existing analyzer warnings in three Day 46 screens left untouched.

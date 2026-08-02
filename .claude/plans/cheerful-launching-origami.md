# Day 32 — GPS History & Live Fleet Dashboard

## Context

Day 32 builds the operator-facing GPS & Live Fleet Dashboard for the Sri Jayam Travels ERP. The user requires that the work reuse existing tables (`gps_tracking`, `driver_status`, `vehicle_status`, `settings`) — no new dedicated GPS tables — and follow a layered architecture **Repository → Service → Context → Page → Provider** so a future GPS vendor only needs a new `Provider` adapter file.

Verification of the codebase surfaced four real problems before any code is written:

1. `gps_tracking`, `driver_status`, `vehicle_status`, `vehicle_assignments` are referenced in code but never created by any migration in `supabase/migrations/`. Per the user's confirmation, a Day 32 migration will create them.
2. `vehicles` has no `imei` column. The KingsTrack API keys devices by IMEI, so the same migration adds `imei TEXT UNIQUE`.
3. The `settings` table has two competing column conventions: `key/value` (old) vs `setting_key`/`setting_value` (Day 31 + adminRepository). Day 32 GPS settings will commit to `setting_key`/`setting_value` and `category='gps'`.
4. `leaflet`/`react-leaflet` are not installed. They are added to `package.json` once (and only once) and grouped into one Vite manual chunk.

Outcome: an admin/manager can visit `/fleet` to see a live map, KPI tiles, vehicle list with search + filters, manual sync, and GPS provider health; and visit `/fleet/settings` to configure the KingsTrack endpoint. Drivers are unaffected.

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│ Page (Fleet.jsx, FleetSettings.jsx)                                    │
│   uses useGpsHistory() → no fetchFleet() calls                         │
└──────────────────────────────┬─────────────────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────────────────┐
│ Context (GpsHistoryContext.jsx)                                        │
│   { provider, health, fleet, lastPoll, lastSuccess, lastError,         │
│     responseTimeMs, start(), stop(), syncNow() }                       │
└──────────────────────────────┬─────────────────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────────────────┐
│ Service (gpsSyncService.js)                                            │
│   start() / stop() / syncNow()                                         │
│   Polling interval from gps_poll_interval_seconds.                      │
│   Tab-visibility pause; logout cleanup; exponential backoff on errors. │
└──────────────────┬─────────────────────────┬───────────────────────────┘
                   │                         │
┌──────────────────▼────────────┐  ┌──────────▼────────────────────────┐
│ Provider (gpsProvider/factory)│  │ Repository (gpsHistoryRepository,│
│  KingsTrackProvider (today)   │  │   gpsSettingsRepository,         │
│  FutureProvider (tomorrow)    │  │   vehicleStatusData,             │
│  — implements fetchFleet(),   │  │   driverStatusData)              │
│    healthCheck(),             │  │                                  │
│    normalizeResponse()        │  │   Reuses gps_tracking, settings, │
│                               │  │   vehicle_status, driver_status. │
└───────────────────────────────┘  └──────────────────────────────────┘
```

Future swap = add `src/services/gpsProvider/<name>Provider.js` implementing the interface + register in the factory. Zero changes to Context/Page/Repository/Service.

---

## Decisions Locked With User

| Question | Answer |
|---|---|
| GPS settings keys | Brief's 8 keys verbatim: `provider`, `api_url`, `company_id`, `user_id`, `refresh_interval`, `timeout`, `retry_count`, `enabled` |
| Auto-start polling | Only when `/fleet` is mounted (Context initializes polling on mount, stops on unmount + on tab hidden) |
| Schema gap | Create all 4 missing tables + IMEI column in `supabase/migrations/20260802_day32_gps.sql` |

---

## Files to CREATE

### SQL migration
- `supabase/migrations/20260802_day32_gps.sql`
  - Creates `gps_tracking` (UUID PK, `vehicle_id` FK→vehicles, `trip_id` FK→bookings NULL, `driver_id` FK→drivers NULL, `latitude`, `longitude`, `accuracy`, `speed_kmh`, `bearing`, `altitude`, `address`, `ignition` BOOL, `status` TEXT, `odometer`, `timestamp`, `raw` JSONB, `created_at`).
  - Creates `driver_status` (UUID PK, `driver_id` FK UNIQUE, `status` TEXT, `current_trip_id` FK→bookings NULL, `latitude`, `longitude`, `speed_kmh`, `last_heartbeat`, `updated_at`).
  - Creates `vehicle_status` (UUID PK, `vehicle_id` FK UNIQUE, `status` TEXT, `assigned_driver_id` FK→drivers NULL, `current_trip_id` FK→bookings NULL, `last_km_reading`, `last_gps_at` TIMESTAMPTZ NULL, `last_lat` DOUBLE PRECISION NULL, `last_lng` DOUBLE PRECISION NULL, `updated_at`).
  - Creates `vehicle_assignments` (UUID PK, `vehicle_reg`, `vehicle_type`, `vehicle_model`, `driver_id` FK, `driver_name`, `assigned_date`, `assigned_time`, `assigned_at`, `released_date`, `created_at`).
  - `ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS imei TEXT UNIQUE;`
  - `CREATE UNIQUE INDEX IF NOT EXISTS idx_gps_tracking_dedup ON public.gps_tracking (vehicle_id, timestamp);` — for O(1) dedup.
  - `CREATE INDEX IF NOT EXISTS idx_gps_tracking_vehicle_ts ON public.gps_tracking (vehicle_id, timestamp DESC);`
  - All four tables get RLS enabled + permissive `FOR ALL USING (true)` policies (matching the rest of the codebase convention).
  - `INSERT INTO public.role_permissions (role, permission, is_allowed) VALUES ('admin','view_fleet',true),('manager','view_fleet',true),('driver','view_fleet',false),('admin','manage_gps',true),('manager','manage_gps',false),('driver','manage_gps',false) ON CONFLICT (role,permission) DO NOTHING;`

### Provider layer
- `src/services/gpsProvider/index.js`
  - Exports `createGpsProvider(providerName, settings)` → returns `{ name, fetchFleet(), healthCheck(), normalizeResponse() }`.
  - Validates `providerName ∈ { 'kingstrack' }` for now; future providers register here.
  - JSDoc interface contract.

- `src/services/gpsProvider/kingsTrackProvider.js`
  - Defaults to `https://mvt.apmkingstrack.com/fleettracking/api/live/json`.
  - `fetchFleet()`: POSTs `{ company_id, user_id }` to the API; wraps with `withTimeout(ms = settings.timeout * 1000)`; returns `{ ok, raw, error }`.
  - `healthCheck()`: HEAD-style ping with a tiny payload, returns `{ ok, latencyMs, error }`.
  - `normalizeResponse(raw)`: maps KingsTrack `{ Vehicle, Latitude, Longitude, Address, Speed, Timestamp, GPS, Ignition, Status, Odometer }` into the canonical `{ imei, registration, lat, lng, address, speed_kmh, ignition, status, timestamp, odometer }`. Adds `_epoch = Math.floor(new Date(timestamp).getTime()/60000)*60000` (rounded minute, used for dedup).
  - Honors `import.meta.env.VITE_GPS_MOCK === 'true'` → returns 3 mock vehicles so dev/CI never hit the real endpoint.

### Repository layer
- `src/repositories/gpsHistoryRepository.js` (new)
  - `getAll({ since, until, vehicleId, limit })` → reads `gps_tracking` with optional filters.
  - `getLatestForVehicle(vehicleId)` → top 1 by `timestamp DESC`.
  - `getLatestForFleet()` → `select('vehicle_id, MAX(timestamp) AS last_at, AVG(speed_kmh) AS avg_speed')` GROUP BY `vehicle_id` for KPIs.
  - `insertSnapshot(snapshot)` → upsert with `ON CONFLICT (vehicle_id, timestamp) DO NOTHING` (uses the new UNIQUE index) + returns `{ inserted: bool }`.
  - `insertBatch(snapshots)` → single multi-row INSERT with same ON CONFLICT; batch size 100.
  - All Supabase calls wrapped in `withTimeout(..., 10_000, null)`.

- `src/repositories/gpsSettingsRepository.js` (new)
  - Pattern mirrors `adminRepository` (factory-of-repos).
  - `getAll()` → `select * where category='gps'` from `settings`.
  - `getAsObject()` → returns `{ provider, api_url, ... }` shape.
  - `set(key, value)` → upsert `{ setting_key: key, setting_value: JSON.stringify(value), category: 'gps', is_sensitive: <true for tokens/credentials, else false>, updated_by, description }`.
  - `setMany({ provider, api_url, ... })` → loops `set()`; calls `cacheClear('gps_settings')`.
  - Commits to **Day 31 column convention (`setting_key`/`setting_value`)**.

### Service layer
- `src/services/gpsSyncService.js` (new)
  - Module-singleton (no React). API:
    - `start()` — installs `setInterval(syncNow, settings.refresh_interval * 1000)`; also registers `visibilitychange` listener that pauses when `document.hidden`.
    - `stop()` — clears interval + visibility listener. Idempotent.
    - `syncNow()` — calls `provider.fetchFleet()` → `provider.normalizeResponse()` → for each normalized snapshot, resolves `registration → vehicle_id` via `vehicleRepository.getAll()` (cached 60 s) → calls `gpsHistoryRepository.insertBatch()` → updates `vehicle_status.last_gps_at/last_lat/last_lng` (NOT `status` — booking lifecycle owns that) → updates `driver_status` if a driver_id is mapped.
  - Records health into an in-memory `health` object: `{ lastPoll, lastSuccess, lastError, responseTimeMs, ok }`.
  - On provider failure: exponential backoff (1s, 2s, 4s, 8s, cap 30s); writes to `error_log` via `errorLogRepository` after the second consecutive failure.
  - Calls `addAuditEvent('GPS_SYNC_FAILED', {...})` on persistent errors and `addAuditEvent('GPS_SETTINGS_UPDATED', { diff })` from the settings save path.

### Context layer
- `src/context/GpsHistoryContext.jsx` (new)
  - State: `{ provider, health, fleet, vehicleStatuses, loading, error, syncNow, start, stop }`.
  - On mount (only when used inside `/fleet` or `/fleet/settings`):
    1. Loads GPS settings → instantiates provider via factory.
    2. Calls `gpsSyncService.start()` and subscribes to its health emitter (simple EventTarget or pub/sub).
    3. Loads latest fleet snapshot from `gpsHistoryRepository.getLatestForFleet()` for KPIs.
  - On unmount: calls `gpsSyncService.stop()` and clears subscription. Prevents cross-user leaks.
  - Exposes `useGpsHistory()` hook.

### Page layer
- `src/pages/Fleet.jsx` (new — `/fleet`)
  - Top: `<PageHeader title="Live Fleet Dashboard" subtitle="Real-time vehicle tracking" action={<SyncButton onClick={syncNow}/>} />`
  - KPI row: 8 `<StatCard>` tiles (Online, Moving, Stopped, Offline, GPS Online, GPS Offline, Avg Speed, Last Sync). All reuse `StatCard` from `components/ui/`.
  - Search bar (`<FleetSearch />`) + filter chips (`<FleetFilters />`).
  - Two-column layout:
    - Left (60%): `<FleetMap />` — Leaflet map.
    - Right (40%): `<FleetVehicleList />` — table/list.
  - Bottom: `<GpsHealthCard />`.
  - If user is admin: `<GpsDebugPanel />` below health card.
  - Role gate: admin + manager (`view_fleet`).

- `src/pages/FleetSettings.jsx` (new — `/fleet/settings`)
  - Mirrors `pages/Settings.jsx` structure exactly: `PageHeader`, `SectionCard`, `Field`, `Toggle`, toast, error banner, Save/Reset row.
  - 8 fields, one `<SectionCard title="GPS Provider">`: `provider` (select kingstrack), `api_url` (text), `company_id`, `user_id`, `refresh_interval` (number, seconds), `timeout` (number, seconds), `retry_count` (number), `enabled` (toggle).
  - Sensitive fields (`company_id`, `user_id`) get `type="password"` + `is_sensitive=true` in the repo write.
  - Save → `gpsSettingsRepository.setMany()` → `cacheClear('gps_settings')` → `addAuditEvent('GPS_SETTINGS_UPDATED', { diff })` → toast.
  - "Test Connection" button → calls `provider.healthCheck()` for a live ping.
  - Role gate: admin only (`manage_gps`).

### Component layer
- `src/components/fleet/FleetMap.jsx` (new)
  - Uses `react-leaflet` (`MapContainer`, `TileLayer`, `Marker`, `Popup`, `useMap`).
  - OSM tiles (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`).
  - For dark mode, swap tile URL to CartoDB Dark (`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`). Uses `useApp()` dark mode flag.
  - Marker icons: pre-baked divIcon HTML with status-coloured dots (moving/stopped/offline). NO `hue-rotate` CSS.
  - "Fit all vehicles" button → calls `map.fitBounds(bounds)` via `useMap`.
  - Click marker → `<Popup>` with vehicle details.

- `src/components/fleet/FleetVehicleList.jsx` (new)
  - Columns: Registration, Driver, Speed, Status, GPS, Ignition, Address, Last Update.
  - Click row → opens `<FleetVehicleDetail>` side panel.

- `src/components/fleet/FleetVehicleDetail.jsx` (new)
  - Slide-over panel (Tailwind `fixed right-0 top-0 h-full w-96`).
  - All vehicle fields + mini-map with the single vehicle.
  - "Open in Maps" link → uses `buildMapsUrl` from `utils/locationUtils.js`.

- `src/components/fleet/FleetFilters.jsx` (new)
  - Toggle chips: Moving, Stopped, Offline, GPS ON, GPS OFF, Ignition ON, Ignition OFF.
  - Active state = filled; inactive = outlined. Uses `Badge` styling extended via inline classes (no `Badge.jsx` API change).

- `src/components/fleet/FleetSearch.jsx` (new)
  - Single text input, debounced 250 ms, searches across registration, IMEI, driver name.

- `src/components/gps/GpsHealthCard.jsx` (new — placed in `components/gps/` to match the existing `components/gps/` convention, NOT a new `components/admin/` dir).
  - Status (Connected/Disconnected/Degraded), Last Sync, Last Error, API Response Time, "Sync Now" button.
  - Uses `useGpsHistory()`.

- `src/components/gps/GpsDebugPanel.jsx` (new)
  - Admin only (gate inside component via `useAuth().isAdmin`).
  - JSON dump: latest API response (truncated to 2 KB), vehicle count, last poll, last success, last failure, error stack.

---

## Files to MODIFY

- `package.json` — add `"leaflet": "^1.9.4"` and `"react-leaflet": "^4.2.1"` to `dependencies`. No dev-deps needed.
- `vite.config.js` — extend `manualChunks` to add:
  ```js
  if (id.includes('leaflet') || id.includes('react-leaflet')) return 'leaflet'
  ```
- `src/main.jsx` — add `import 'leaflet/dist/leaflet.css';` and Leaflet default-icon fix:
  ```js
  import L from 'leaflet'
  import iconUrl from 'leaflet/dist/images/marker-icon.png'
  import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
  import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
  L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })
  ```
- `src/App.jsx` —
  - Add imports: `Fleet`, `FleetSettings`.
  - Add routes `/fleet` (admin+manager) and `/fleet/settings` (admin only).
  - Wrap protected admin/manager shell in `<GpsHistoryProvider>` (so polling auto-pauses when navigating away — provider actually only starts when a child page mounts `useGpsHistory()`).
- `src/components/layout/Sidebar.jsx` —
  - Add `Navigation` icon import.
  - Insert into `NAV_ITEMS` (admin+manager, `perm: 'view_fleet'`): `{ to: '/fleet', label: 'Live Fleet', icon: Navigation, roles: ['admin','manager'], perm: 'view_fleet' }`.
  - Insert into `BOTTOM_ITEMS` (admin only): `{ to: '/fleet/settings', label: 'GPS Settings', icon: Settings, roles: ['admin'] }`.
- `src/components/layout/Topbar.jsx` —
  - Add two `PAGE_TITLES` entries: `/fleet` (`'Live Fleet'`, `'Real-time vehicle tracking'`) and `/fleet/settings` (`'GPS Settings'`, `'Configure GPS provider'`).
- `src/repositories/index.js` — export the new repos alongside existing two.
- `src/data/vehicleStatusData.js` — keep booking-lifecycle writes intact; do NOT add a third writer for `status`. The Day 32 migration adds `last_gps_at`/`last_lat`/`last_lng`; the GPS sync service writes only those.
- `src/data/driverStatusData.js` — leave alone; orchestrator writes `last_heartbeat`/`latitude`/`longitude` only when `driver_id` is mappable.
- `src/context/AuthContext.jsx` — no change needed (`can('view_fleet')` and `can('manage_gps')` already route through `permissionEngine` which reads `role_permissions`; the Day 32 migration seeds the new rows).

---

## Files NOT modified (explicitly out of scope)

- `src/pages/driver/LiveLocation.jsx` — uses an inline SVG map; not Leaflet. Day 32 leaves it alone (false-edit flagged in critique).
- `src/data/gpsHistoryData.js` — kept as back-compat shim for the existing per-trip route recording. Day 32 adds new `gpsHistoryRepository` for fleet polling; legacy file still works for the driver trip routes.
- `src/data/attendanceData.js` — Day 32 is not a cleanup task for attendance. (Pre-existing dual-write casing stays.)
- `.env.local` — unchanged. `.env` already gitignored; `.env.local` being tracked is a separate concern.

---

## Sequencing (build order)

1. **SQL migration** `20260832_day32_gps.sql` — run against Supabase.
2. **`package.json` + `vite.config.js` + `main.jsx`** — install leaflet and register icons.
3. **Provider layer** — `gpsProvider/index.js` + `kingsTrackProvider.js` with mock mode.
4. **Repository layer** — `gpsHistoryRepository` (read + insertBatch with dedup), `gpsSettingsRepository` (key/value on `settings`).
5. **Service layer** — `gpsSyncService` (polling, visibility-pause, backoff, audit logs).
6. **Context** — `GpsHistoryContext`.
7. **Settings page** (`/fleet/settings`) — fastest visual win; no map, no live data.
8. **Components** — `FleetSearch`, `FleetFilters`, `FleetVehicleList`, `FleetVehicleDetail`, `FleetMap`.
9. **Dashboard page** (`/fleet`) — composes the above + StatCard row + GpsHealthCard + GpsDebugPanel.
10. **App.jsx + Sidebar + Topbar wiring.**
11. **Build cleanup** — `npm run build`, fix warnings, manual-chunk verify.

---

## Verification

End-to-end manual test (admin user):

1. `npm install` (picks up leaflet + react-leaflet).
2. Apply `supabase/migrations/20260802_day32_gps.sql` against the project (one-shot script via `psql` or Supabase SQL editor).
3. `npm run dev` and log in as `admin@srijayam.local`.
4. Open `/fleet/settings` → fill in 8 keys → "Test Connection" → green toast. Refresh page; values persist.
5. Open `/fleet`:
   - KPI tiles show counts that match the GPS responses.
   - Search "TN-01" filters to that vehicle.
   - Filter "Moving" hides stopped/offline vehicles.
   - Markers appear on map; clicking opens Popup with details.
   - Clicking the row opens the side panel.
   - Dark mode toggling re-tiles the map (CartoDB Dark vs OSM).
6. Reload the page → fleet still loads from cached `gpsHistoryRepository.getLatestForFleet()`.
7. `npm run build` → no chunk > 1000 KB warning; `leaflet` chunk exists as separate file.
8. Logout → polling stops (no console activity in background tab).

Smoke tests for the provider layer (run via `node --experimental-vm-modules` is overkill; verify by toggling `VITE_GPS_MOCK=true` and confirming `KingsTrackProvider.fetchFleet()` returns 3 mock vehicles without hitting the network).

Audit-log spot check: `select * from audit_logs where module='security' or action like 'GPS_%'` shows entries for settings changes and persistent sync failures.

Production-readiness estimate: **75–80 %** at end of Day 32 (no route replay, no geofence, no analytics — explicitly out of scope; map clustering > 500 vehicles deferred).
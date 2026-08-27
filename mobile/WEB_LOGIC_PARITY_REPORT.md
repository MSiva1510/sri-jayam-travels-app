# WEB LOGIC PARITY REPORT
## Sri Jayam Travels — Flutter Mobile vs React Web ERP

**Generated:** 2026-08-26
**Status:** INCOMPLETE — Significant gaps identified

---

## EXECUTIVE SUMMARY

The Flutter mobile app has been developed with a modern architecture (Repository → Service → Provider → UI) but has **significant parity gaps** with the React Web ERP business logic. Many screens reference non-existent models, missing providers, and incomplete business logic implementations.

---

## FEATURE-BY-FEATURE COMPARISON

### 1. TRIP STATUS WORKFLOW

| Aspect | Web ERP (React) | Mobile (Flutter) | MISMATCH | REQUIRED FIX |
|--------|----------------|------------------|----------|--------------|
| Status Values | `draft`, `pending`, `approved`, `confirmed`, `assigned`, `started`, `completed`, `closed`, `cancelled` | `draft`, `assigned`, `started`, `completed`, `cancelled` | **MISSING:** `pending`, `approved`, `confirmed`, `closed` | Add missing statuses to TripModel; update workflow transitions |
| Workflow Transitions | Full 9-state machine with role-based actions | Simplified 5-state (assigned → started → completed) | **INCOMPLETE** | Implement full WORKFLOW_TRANSITIONS from web |
| Status Labels | Web: "In Progress" for `started` | Mobile: "In Progress" for `started` | MATCH | — |
| Status Colors | Web: Amber pulse for `started` | Mobile: Green for `started` | **MISMATCH** | Align color semantics |

### 2. BOOKING STATUS

| Aspect | Web ERP | Mobile | MISMATCH | REQUIRED FIX |
|--------|---------|--------|----------|--------------|
| Status Values | 9 states (draft→cancelled) | Not implemented as separate entity | **MISSING** | Create BookingModel with full status enum |
| Booking Number Format | `BK-{YY}{MM}-{4digits}` | Not implemented | **MISSING** | Port generateBookingNumber() |
| Approval Workflow | draft → pending → approved → assigned | Not implemented | **MISSING** | Port approval logic |

### 3. DRIVER ASSIGNMENT RULES

| Aspect | Web ERP | Mobile | MISMATCH | REQUIRED FIX |
|--------|---------|--------|----------|--------------|
| Availability Check | `getDriverAvailability()` checks leave + conflicts | Not implemented | **MISSING** | Port availability logic to DriverService |
| Conflict Detection | Same driver + same date + assigned/started | Not enforced in mobile | **MISSING** | Add validation in assignDriver() |
| Leave Status | `on-leave` blocks assignment | Not modeled | **MISSING** | Add leave status to DriverProfile |

### 4. VEHICLE ASSIGNMENT RULES

| Aspect | Web ERP | Mobile | MISMATCH | REQUIRED FIX |
|--------|---------|--------|----------|--------------|
| Availability Check | `getVehicleAvailability()` checks maintenance + conflicts | Vehicle model created but logic missing | **PARTIAL** | Implement VehicleService.getAvailability() |
| Maintenance Status | `maintenance` blocks assignment | Vehicle model has status but no enforcement | **PARTIAL** | Add validation in assignVehicle() |
| Conflict Detection | Same vehicle + same date + assigned/started | Not enforced | **MISSING** | Add validation |

### 5. GPS / LOCATION

| Aspect | Web ERP | Mobile | MISMATCH | REQUIRED FIX |
|--------|---------|--------|----------|--------------|
| GPS Provider | KingsTrackProvider (external) | Native geolocator | **DIFFERENT SOURCE** | Document architectural difference |
| Background Tracking | Not implemented | Foreground only (documented) | MATCH | — |
| GPS Data Schema | `gps_tracking` table (shared) | Same table, same schema | MATCH | — |
| Offline Queue | Web: not applicable | Mobile: in-memory queue with retry | **MOBILE ENHANCEMENT** | Document as mobile-specific |

### 6. ATTENDANCE

| Aspect | Web ERP | Mobile | MISMATCH | REQUIRED FIX |
|--------|---------|--------|----------|--------------|
| Check-in/out | Implemented | Implemented | MATCH | — |
| Working Hours Calculation | Implemented | Implemented | MATCH | — |
| Half-day Support | Implemented | Implemented | MATCH | — |

### 7. NOTIFICATIONS

| Aspect | Web ERP | Mobile | MISMATCH | REQUIRED FIX |
|--------|---------|--------|----------|--------------|
| Realtime | Polling via event bus | Supabase Realtime | **DIFFERENT APPROACH** | Document; both functional |
| Unread Count | In-memory | DB query + realtime | **DIFFERENT** | Align if needed |
| Deep Links | Implemented | Not implemented | **MISSING** | Add navigation from notification tap |

### 8. DOCUMENTS

| Aspect | Web ERP | Mobile | MISMATCH | REQUIRED FIX |
|--------|---------|--------|----------|--------------|
| Upload | Implemented | Implemented | MATCH | — |
| Document Types | License, Badge, etc. | Same | MATCH | — |
| Expiry Tracking | Implemented | Not implemented | **MISSING** | Add expiry alerts |

### 9. ALERTS

| Aspect | Web ERP | Mobile | MISMATCH | REQUIRED FIX |
|--------|---------|--------|----------|--------------|
| Categories | trip, gps, vehicle, driver, document, system | Same | MATCH | — |
| Priorities | critical, high, medium, low | Same | MATCH | — |
| Realtime | Polling | Supabase Realtime | **DIFFERENT** | Document |
| Acknowledge/Resolve | Implemented | Implemented | MATCH | — |

### 10. ROLE-BASED ACCESS

| Aspect | Web ERP | Mobile | MISMATCH | REQUIRED FIX |
|--------|---------|--------|----------|--------------|
| Driver | Own trips, GPS, attendance, docs | Same | MATCH | — |
| Manager | Fleet, all trips, assignments, alerts | Partial (many screens placeholder) | **INCOMPLETE** | Implement missing manager screens |
| Admin | Full web only | Web-only screen shown | MATCH | — |

---

## CRITICAL MISSING MODELS / PROVIDERS

| Missing Item | Impact | Location |
|--------------|--------|----------|
| `BookingModel` | Booking workflow incomplete | New file needed |
| `allTripModelsProvider` | Manager screens broken | trip_provider.dart |
| `Vehicle.isAvailable` getter | Fleet filtering broken | vehicle.dart |
| `Vehicle.currentDriver` | Fleet display broken | vehicle.dart |
| `Vehicle.lastGpsUpdate` | Fleet display broken | vehicle.dart |
| `Vehicle.speed` | Fleet display broken | vehicle.dart |
| `TripModel.scheduledDate` | Manager trip filtering broken | trip.dart |
| `TripModel.statusDisplay` | Status badges broken | trip.dart |
| `TripModel.scheduledTime` | Trip display broken | trip.dart |
| `TripModel.tripType` | Trip type display broken | trip.dart |
| `TripModel.fare` | Trip display broken | trip.dart |
| `TripModel.isPendingAssignment` | Assignment logic broken | trip.dart |
| `DriverProfile.isAvailable` | Assignment validation broken | driver_profile.dart |
| `supabaseClientProvider` | All repositories broken | providers.dart |
| `vehiclesTable` in SupabaseConfig | Vehicle repo broken | supabase_config.dart |
| `fleetAlertsTable` in SupabaseConfig | Alert repo broken | supabase_config.dart |

---

## ARCHITECTURAL DIFFERENCES (BY DESIGN)

| Aspect | Web ERP | Mobile | Rationale |
|--------|---------|--------|-----------|
| State Management | React Context + localStorage | Riverpod | Platform-appropriate |
| Realtime | Polling / Event Bus | Supabase Realtime | Mobile: push notifications |
| GPS Source | External (KingsTrack) | Native (geolocator) | Mobile: native GPS |
| Background Tracking | N/A | Foreground only | Battery preservation |
| Offline Support | N/A | In-memory queue | Mobile: network resilience |

---

## RECOMMENDED PRIORITY FIXES

### P0 (Blockers)
1. Fix `providers.dart` barrel export — all providers unresolved
2. Add missing table names to `SupabaseConfig`
3. Implement missing TripModel getters (`scheduledDate`, `statusDisplay`, etc.)
4. Implement missing Vehicle getters (`isAvailable`, `currentDriver`, etc.)
5. Fix `providers.dart` import paths
6. Resolve duplicate `UnauthorizedScreen` (web_only_screen.dart + unauthorized_screen.dart)

### P1 (Critical Features)
1. Implement full booking workflow (9 statuses)
2. Add driver/vehicle availability validation
3. Implement missing manager screens (Bookings, Drivers, Vehicles, Documents, etc.)
4. Add PrimaryButton/SecondaryButton to app_buttons.dart
5. Fix app_router.dart imports and route constants

### P2 (Polish)
1. Align status colors with web
2. Add deep link handling for notifications
3. Implement document expiry tracking
4. Add comprehensive test coverage
5. Theme testing (light/dark/system)

---

## VERIFICATION CHECKLIST

- [ ] Flutter analyze passes
- [ ] Flutter test passes
- [ ] Flutter build apk --debug succeeds
- [ ] Driver: Login → Dashboard → Trips → Trip Details → GPS → Attendance → Documents → Profile → Logout
- [ ] Manager: Login → Dashboard → Fleet → Vehicles → Trips → Bookings → Drivers → Alerts → Profile → Logout
- [ ] Admin: Web-only screen shown on mobile login
- [ ] Light/Dark/System themes work on all screens
- [ ] Realtime updates work (trips, fleet, alerts, notifications)
- [ ] GPS tracking starts/stops with trip lifecycle
- [ ] Logout cleans up all subscriptions and GPS

---

**CONCLUSION:** The mobile app has a solid architectural foundation but requires **substantial implementation work** to achieve parity with the Web ERP business logic. Estimated effort: 3-4 weeks of focused development to close all P0/P1 gaps.
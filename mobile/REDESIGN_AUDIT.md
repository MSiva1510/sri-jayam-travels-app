# SRI JAYAM TRAVELS — MOBILE REDESIGN AUDIT

**Generated:** 2026-08-25
**Starting Commit:** d5802a4 (day 49)
**Current Branch:** main

---

## 1. REACT WEB APPLICATION AUDIT

### 1.1 Architecture Overview

The React web app (`src/`) is a **Vite + React 18** SPA with:
- **Supabase** as backend (PostgreSQL + Auth + Realtime)
- **React Router v6** for navigation
- **Context API** for state management (Auth, RideLifecycle, Communication, FleetAnalytics, GPSHistory, Admin)
- **Custom Repository Pattern** for data access
- **Tailwind CSS** for styling
- **Lucide React** for icons

### 1.2 Authentication & Authorization

| Component | File | Notes |
|-----------|------|-------|
| Auth Repository | `src/repositories/authRepository.js` | Supabase Auth + `public.profiles` table |
| Auth Context | `src/context/AuthContext.jsx` | Session restore, login, logout, permissions |
| Permission Engine | `src/security/PermissionEngine.js` | Granular named permissions + legacy module matrix |
| Session Manager | `src/security/SessionManager.js` | Timeout handling, activity tracking |

**Roles:** `admin`, `manager`, `driver`
**Profile Table:** `profiles` (id, email, full_name, role, phone, avatar_url, status)
**Driver Table:** `drivers` (id, driver_id, profile_id, name, email, phone, status, license, vehicle assignment, etc.)

**Role Routes (Web):**
- Admin: Full access including `/admin/*`, `/settings`, `/reports`, `/invoices`, `/audit-log`
- Manager: `/`, `/trips`, `/create-trip`, `/customers`, `/expenses`, `/drivers`, `/vehicles`, `/attendance`, `/profile`, `/payroll`, `/fleet`, `/gps-history`, `/fleet-analytics`, `/admin/users`
- Driver: `/driver`, `/assigned-trips`, `/ride-history`, `/driver-profile`, `/live-location`, `/payslips`

### 1.3 Core Domain Modules

| Module | Repository | Service | Key Pages | Mobile Relevance |
|--------|------------|---------|-----------|------------------|
| **Bookings/Trips** | `tripRepository.js` | `dataService.js` | `Trips.jsx`, `CreateTrip.jsx`, `DriverDashboard.jsx`, `AssignedTrips.jsx` | HIGH — Core for both Driver & Manager |
| **Drivers** | `driverRepository.js` | — | `Drivers.jsx`, `DriverProfile.jsx` | HIGH — Manager views, Driver self-view |
| **Vehicles** | `vehicleRepository.js` | — | `Vehicles.jsx`, `Fleet.jsx` | HIGH — Manager fleet, Driver assigned vehicle |
| **Fleet/GPS** | `gpsSettingsRepository.js`, `gpsHistoryRepository.js`, `geofenceRepository.js`, `fleetAlertRepository.js` | `gpsSyncService.js`, `geofenceService.js`, `gpsReplayService.js` | `Fleet.jsx`, `LiveLocation.jsx`, `GpsHistory.jsx`, `RouteReplay.jsx` | HIGH — Live Fleet (Manager), GPS Tracking (Driver) |
| **Attendance** | `attendanceRepository.js` | — | `Attendance.jsx`, `DriverDashboard.jsx` | HIGH — Driver check-in/out, Manager monitoring |
| **Documents** | (via `documents` table) | — | `Documents.jsx`, `DriverDocumentsScreen` (mobile) | MEDIUM — Driver docs, Vehicle docs |
| **Expenses** | `expenseRepository.js` | — | `Expenses.jsx` | MEDIUM — Manager approval, Driver submission (future) |
| **Payroll/Settlements** | `payrollRepository.js` | — | `Payroll.jsx` | LOW — Manager only, web-focused |
| **Customers** | `customerRepository.js` | — | `Customers.jsx` | MEDIUM — Manager booking creation |
| **Communications** | `communicationRepository.js` | `communicationService.js` | `Communications.jsx`, `CommunicationSettings.jsx` | MEDIUM — In-app notifications, WhatsApp/call |
| **Notifications** | `notificationService.js` | — | (integrated in Dashboard) | HIGH — Unified inbox for both roles |
| **Reports/Analytics** | `fleetAnalyticsRepository.js` | — | `Reports.jsx`, `FleetAnalytics.jsx` | LOW — Manager summaries only on mobile |

### 1.4 Database Schema (from migrations & repositories)

**Key Tables:**
- `profiles` — Auth user profiles with role
- `drivers` — Driver details, license, vehicle assignment, status
- `vehicles` — Fleet vehicles, registration, status, documents expiry
- `bookings` — Trips/bookings (status: draft, pending, approved, confirmed, assigned, started, completed, closed, cancelled)
- `vehicle_assignments` — Driver ↔ Vehicle assignments
- `attendance` — Driver check-in/out records
- `documents` — Driver & vehicle documents
- `expenses` — Trip expenses
- `settlements` / `trip_payslips` — Payroll
- `notifications` — System notifications
- `fleet_alerts` — GPS/vehicle alerts
- `gps_tracking` — Live GPS positions
- `geofences` / `geofence_zones` / `geofence_events` — Geofencing
- `audit_logs` — Activity audit
- `settings` — App settings
- `role_permissions` — Granular permissions

**RLS:** All tables have permissive policies (`app_all` policy allowing all operations for anon/authenticated). Business logic enforced in application layer.

### 1.5 Driver Web Experience (Current)

**Pages:**
1. `/driver` — `DriverDashboard.jsx` — Today's trips, active ride lifecycle, GPS, quick actions, stats, vehicle info
2. `/assigned-trips` — `AssignedTrips.jsx` — List of assigned trips with filters
3. `/ride-history` — `RideHistory.jsx` — Completed trips history
4. `/driver-profile` — `DriverProfile.jsx` — Profile, documents, vehicle
5. `/live-location` — `LiveLocation.jsx` — GPS tracking map

**Key Components:**
- `ActiveTripCard` — Ride lifecycle controls (start, pause, resume, end)
- `GPSStatusCard` — GPS permission/status display
- `RideLifecycleContext` — Shared state across driver pages
- `useGPS` hook — Browser Geolocation API wrapper

### 1.6 Manager/Admin Web Experience (Current)

**Dashboard (`/`)** — KPIs, booking overview, fleet stats, attendance, live fleet board, fleet alerts, recent activity

**Key Manager Pages:**
- `/trips` — Full booking management (CRUD, assignment, status workflow)
- `/create-trip` — Multi-step booking creation
- `/fleet` — Live fleet map with vehicle markers, filters
- `/vehicles` — Vehicle CRUD, documents, maintenance
- `/drivers` — Driver management, attendance, documents
- `/attendance` — Daily attendance grid
- `/expenses` — Expense approval
- `/documents` — Document expiry tracking
- `/communications` — Broadcast messages
- `/payroll` — Settlement management
- `/reports` — Financial analytics (Admin only)
- `/fleet-analytics` — Fleet performance charts

---

## 2. FLUTTER MOBILE APP AUDIT (Current State)

### 2.1 Architecture

```
mobile/lib/
├── main.dart                 # App entry, theme, auth guard, GPS lifecycle
├── core/
│   ├── auth/auth_state.dart  # Sealed AuthState classes
│   ├── config/supabase_config.dart
│   └── errors/
├── models/                   # UserProfile, DriverProfile, Trip, Booking, Attendance, etc.
├── repositories/             # Auth, Trip, Booking, Attendance, Document, GPS, Notification
├── services/                 # Auth, Trip, Booking, Attendance, Document, GPS Tracking, Location, Notification, Communication
├── providers/                # Riverpod providers for all modules
├── navigation/
│   └── app_router.dart       # GoRouter with role-based redirect
├── screens/
│   ├── auth/                 # Login, ForgotPassword, Unauthorized, NoConnection
│   └── driver/               # 12 driver screens
└── widgets/driver/           # TripCard, BookingCard
```

### 2.2 Current Mobile Features (Driver Only)

| Screen | File | Status |
|--------|------|--------|
| Login | `login_screen.dart` | ✅ Complete |
| Forgot Password | `forgot_password_screen.dart` | ✅ Complete |
| Driver Home | `driver_home_screen.dart` | ✅ Complete |
| Driver Trips | `driver_trips_screen.dart` | ✅ Complete |
| Trip Details | `trip_details_screen.dart` | ✅ Complete |
| Trip Map | `trip_map_screen.dart` | ✅ Complete |
| Driver Bookings | `driver_bookings_screen.dart` | ✅ Complete |
| Booking Details | `booking_details_screen.dart` | ✅ Complete |
| Attendance | `attendance_screen.dart` | ✅ Complete |
| Attendance History | `attendance_history_screen.dart` | ✅ Complete |
| Driver Documents | `driver_documents_screen.dart` | ✅ Complete |
| Notifications | `notifications_screen.dart` | ✅ Complete |
| Communication | `communication_screen.dart` | ✅ Complete |
| Driver Profile | `driver_profile_screen.dart` | ✅ Complete |
| Settings | `settings_screen.dart` | ✅ Complete |

### 2.3 Missing Manager Mobile Screens

**No Manager screens exist currently.** All mobile routes are driver-only.

### 2.4 Current Auth Flow

```
Launch → Supabase Init → Restore Session → Load Profile → Check Role
  → Driver → Driver Shell (bottom nav: Home, Trips, GPS, Alerts, Profile)
  → Manager → UNAUTHORIZED (blocked)
  → Admin → UNAUTHORIZED (blocked)
```

**Issue:** Manager and Admin roles are rejected at router level (`!profile.isDriver ? AppRoutes.unauthorized : null`)

### 2.5 Theme System

- **Light Theme:** Material3, seed color `#1565C0` (Blue)
- **Dark Theme:** Auto-generated from seed (not customized)
- **Theme Mode:** System / Light / Dark via `ThemeProvider`
- **Issues:** No semantic tokens, no brand colors, dark theme is generic Material3

---

## 3. DRIVER DESIGN ZIP AUDIT

### 3.1 Design System (from `modern_mobility/DESIGN.md`)

**Colors:**
- Primary: Deep Navy `#0F172A` (authority, stability)
- Background: `#F8F9FF` (soft neutral)
- Surface: White `#FFFFFF` with subtle shadows
- Status: Green (Active), Amber (Warning), Red (Emergency), Blue (Info)

**Typography:** Plus Jakarta Sans
- Display: 28-36px
- Headline: 20-24px
- Body: 14-18px
- Label: 12px
- Caption: 11px

**Spacing:** 8px base grid, 16px gutters, 20px container margins

**Shapes:** 20px radius (cards), 12px (buttons), 8px (inputs), pill (badges)

**Elevation:** Tonal layering + ambient shadows (Level 0-2)

### 3.2 Driver Screens in ZIP (14 screens)

| Screen | Folder | Key UI Elements |
|--------|--------|-----------------|
| Driver Home Dashboard | `driver_home_dashboard` | Greeting, stats cards, active ride card, GPS areas, quick actions, today's schedule, vehicle strip |
| Driver Trips List | `driver_trips_list` | Tabbed (Today/Upcoming/Completed), trip cards with status pills, fare, route |
| Trip Details Assignment | `trip_details_assignment` | Trip info, customer, route, vehicle, driver assignment UI, map preview |
| Driver Attendance Status | `driver_attendance_status` | Check-in/out button, working hours, status badge, history link |
| Driver Document Center | `driver_document_center` | Document categories, expiry badges, upload/replace actions |
| Driver Profile Settings | `driver_profile_settings` | Avatar, info, appearance (theme), notifications, support, logout |
| Notifications Center | `notifications_center` | Unified inbox, priority badges, read/unread, categories |
| Live Fleet Map View | `live_fleet_map_view` | Map-first, vehicle markers, filters (All/Moving/Stopped/On Trip/Available/Offline/Alert) |
| Create New Booking Form | `create_new_booking_form` | Multi-section: Customer, Route, Schedule, Vehicle Requirement, Trip Details, Notes |
| Trips List Overview | `trips_list_overview` | Manager view: tabs, search, filters, bulk actions, assignment workflow |
| Pre-trip Vehicle Checklist | `pre_trip_vehicle_checklist` | Inspection checklist, photo upload, submit |
| Report Vehicle Issue | `report_vehicle_issue` | Issue type, description, photo, priority, submit |
| SOS Emergency Assistance | `sos_emergency_assistance` | Panic button, location sharing, emergency contacts |
| Modern Mobility | `modern_mobility` | Design system documentation |

### 3.3 Design Observations

**Good:**
- Consistent 8pt grid, Plus Jakarta Sans, semantic status colors
- Card-based layout with 20px radius, ambient shadows
- Bottom sheets for mobile selections
- Map-first fleet view with custom markers
- Clear visual hierarchy for trip status

**Inconsistencies/Gaps:**
- Some screens use different card padding (16px vs 20px)
- Primary button height varies (48px spec vs implementation)
- No dark theme variants shown in screenshots
- Manager screens (Live Fleet, Trips Overview, Create Booking) use slightly different visual density
- SOS screen has unique red-heavy palette not in design system

---

## 4. MANAGER FIGMA AUDIT

**Figma URL:** https://www.figma.com/design/NWDMP436ohcSqSAqFtAyMf/Manager-SJT?node-id=0-1&t=3hFPoUuJTuvFiPzi-1

*Note: Figma content not directly accessible. Mapping based on React Manager pages and Driver ZIP Manager screens.*

### 4.1 Expected Manager Mobile Screens (from React + ZIP)

| Module | Web Source | ZIP Reference | Mobile Screens Needed |
|--------|------------|---------------|----------------------|
| Dashboard | `Dashboard.jsx` | `live_fleet_map_view`, `trips_list_overview` | Home (KPIs + Live Fleet preview + Alerts) |
| Live Fleet | `Fleet.jsx` + `LiveFleetBoard` | `live_fleet_map_view` | Fleet Map, Vehicle Details |
| Trips/Bookings | `Trips.jsx`, `CreateTrip.jsx` | `trips_list_overview`, `create_new_booking_form`, `trip_details_assignment` | Trip List, Trip Details, Create/Edit Booking, Assignment Flow |
| Drivers | `Drivers.jsx` | — | Driver List, Driver Details |
| Vehicles | `Vehicles.jsx` | — | Vehicle List, Vehicle Details |
| Attendance | `Attendance.jsx` | `driver_attendance_status` | Attendance Monitor |
| Alerts | `fleetAlertRepository` + Dashboard | `notifications_center` | Alert Inbox, Alert Details |
| Documents | `Documents.jsx` | `driver_document_center` | Document Dashboard (Driver + Vehicle) |
| Maintenance | — | `pre_trip_vehicle_checklist`, `report_vehicle_issue` | Maintenance List, Report Issue |
| Expenses | `Expenses.jsx` | — | Expense Summary, Approvals |
| Reports | `Reports.jsx`, `FleetAnalytics.jsx` | — | Mobile Summaries (Charts/Cards) |
| Profile/Settings | `Profile.jsx`, `Settings.jsx` | `driver_profile_settings` | Profile, Appearance, Notifications, Support, Logout |

---

## 5. GAP ANALYSIS

### 5.1 Mobile vs Web Feature Parity

| Feature | Web (Driver) | Mobile (Driver) | Web (Manager) | Mobile (Manager) |
|---------|--------------|-----------------|---------------|------------------|
| Authentication | ✅ | ✅ | ✅ | ❌ Blocked |
| Trip/Booking List | ✅ | ✅ | ✅ | ❌ |
| Trip Details | ✅ | ✅ | ✅ | ❌ |
| Trip Map/GPS | ✅ | ✅ | ✅ | ❌ |
| Ride Lifecycle (Start/Pause/End) | ✅ | ✅ | — | — |
| Attendance (Check-in/out) | ✅ | ✅ | ✅ Monitor | ❌ |
| Documents | ✅ | ✅ | ✅ | ❌ |
| Notifications | ✅ | ✅ | ✅ | ❌ |
| Communication | ✅ | ✅ | ✅ | ❌ |
| Profile/Settings | ✅ | ✅ | ✅ | ❌ |
| Live Fleet Map | — | — | ✅ | ❌ |
| Vehicle Management | — | — | ✅ | ❌ |
| Driver Management | — | — | ✅ | ❌ |
| Booking Creation | — | — | ✅ | ❌ |
| Assignment Workflow | — | — | ✅ | ❌ |
| Expense Management | — | — | ✅ | ❌ |
| Reports/Analytics | — | — | ✅ | ❌ |
| Maintenance | — | — | Partial | ❌ |
| SOS/Emergency | — | — | — | ❌ (ZIP only) |
| Pre-trip Inspection | — | — | — | ❌ (ZIP only) |

### 5.2 Critical Issues to Address

1. **No Manager Mobile Experience** — Entire manager role blocked at router
2. **Admin Mobile Access** — Admin correctly blocked but needs friendly message
3. **No Shared Design System** — Current mobile uses generic Material3, not Sri Jayam brand
4. **No Shared App Shell** — Each screen builds own header/navigation
5. **Dark Theme Incomplete** — Auto-generated, not brand-aware
6. **Dead-end Screens** — Several screens lack cross-navigation (e.g., Alert → Trip → Map)
7. **Role Routing Hardcoded** — Only driver routes defined in `app_router.dart`

---

## 6. RECOMMENDED ARCHITECTURE FOR REDESIGN

### 6.1 Role-Based Routing

```
Login → Auth → Load Profile → Resolve Role
  ├─ Driver → DriverShell (Home, Trips, GPS, Alerts, Profile)
  ├─ Manager → ManagerShell (Home, Fleet, Trips, Alerts, Profile)
  └─ Admin → WebOnlyScreen ("Admin access on web") + Logout
```

### 6.2 Shared Design System Structure

```
mobile/lib/core/theme/
├── app_colors.dart        # Semantic color tokens (Light + Dark)
├── app_typography.dart    # Plus Jakarta Sans scale
├── app_spacing.dart       # 8pt grid system
├── app_radius.dart        # Border radius scale
├── app_shadows.dart       # Elevation system
├── app_theme.dart         # ThemeData builders
└── app_theme_controller.dart # ThemeMode persistence
```

### 6.3 Shared App Shell

```
AppShell
├── AppHeader (Dashboard variant / Inner-page variant)
├── PageBody (with SafeArea)
└── AppBottomNavigation (Role-configurable destinations)
```

### 6.4 Data Architecture

```
UI (Screens)
    ↓
Providers (Riverpod StateNotifier)
    ↓
Services (Business Logic)
    ↓
Repositories (Supabase Queries)
    ↓
Supabase Client
```

---

## 7. FILES CHANGED / UNTRACKED

**Current Git Status:** Clean (no uncommitted changes)
**Uncommitted Files:** None
**Safety Branch:** Not created yet (recommended before major changes)

---

## 8. NEXT STEPS

1. ✅ **Phase 0** — Safety check complete
2. 🔄 **Phase 1** — This audit document complete
3. ⏳ **Phase 2** — Driver ZIP audit complete (documented above)
4. ⏳ **Phase 3** — Manager Figma mapping (documented above, needs MANAGER_FIGMA_MAPPING.md)
5. ⏳ **Phase 4** — WEB_TO_MOBILE_MATRIX.md
6. ⏳ **Phase 5** — Remove Admin from mobile (add WebOnlyScreen)
7. ⏳ **Phase 6** — Implement role routing (DriverShell + ManagerShell)
8. ⏳ **Phase 7** — Build shared design system
9. ⏳ **Phase 8** — Build shared AppShell
10. ⏳ **Phase 9** — Build shared component library
11. ⏳ **Phase 10** — Implement Driver screens per ZIP
12. ⏳ **Phase 11** — Implement Manager screens per Figma/React
13. ⏳ **Phase 12** — Create MOBILE_WIREFRAME.md
14. ⏳ **Phase 13** — Cross-screen wireframe rules
15. ⏳ **Phase 14** — Auth fixes (network differentiation, logout teardown)
16. ⏳ **Phases 15-27** — Implementation, testing, build, documentation

---

## 9. SOURCE FILES REFERENCE

**React Web:**
- `src/App.jsx` — Route definitions, role guards
- `src/context/AuthContext.jsx` — Auth state, permissions
- `src/repositories/*.js` — Data access layer
- `src/services/*.js` — Business logic
- `src/pages/driver/*.jsx` — Driver web pages
- `src/pages/*.jsx` — Manager/Admin pages

**Supabase:**
- `supabase/migrations/*.sql` — Schema, RLS

**Flutter Mobile:**
- `mobile/lib/main.dart` — App entry, theme, auth guard
- `mobile/lib/navigation/app_router.dart` — Routes, redirects
- `mobile/lib/providers/auth_provider.dart` — Auth state management
- `mobile/lib/services/auth_service.dart` — Auth business logic
- `mobile/lib/repositories/auth_repository.dart` — Auth data access
- `mobile/lib/models/user_profile.dart` — Role detection
- `mobile/lib/screens/driver/*.dart` — Driver screens

**Design References:**
- `stitch_sri_jayam_mobility_solution/.../driver_*.png` + `code.html` — Driver UI
- `stitch_sri_jayam_mobility_solution/.../live_fleet_map_view.png` — Manager fleet
- `stitch_sri_jayam_mobility_solution/.../trips_list_overview.png` — Manager trips
- `stitch_sri_jayam_mobility_solution/.../create_new_booking_form.png` — Manager booking
- `stitch_sri_jayam_mobility_solution/.../modern_mobility/DESIGN.md` — Design system spec
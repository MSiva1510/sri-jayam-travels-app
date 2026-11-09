# MANAGER FIGMA MAPPING — MOBILE REDESIGN

**Figma URL:** https://www.figma.com/design/NWDMP436ohcSqSAqFtAyMf/Manager-SJT?node-id=0-1&t=3hFPoUuJTuvFiPzi-1
**Source:** React Web Manager Pages + Driver ZIP Manager Screens
**Date:** 2026-08-25

---

## FIGMA FRAME → MOBILE ROUTE → FLUTTER SCREEN MAPPING

| # | Figma Frame / Module | Mobile Route | Flutter Screen | React Feature Source | Supabase Source | Implementation Status |
|---|---------------------|--------------|----------------|---------------------|-----------------|----------------------|
| 1 | **Manager Home / Dashboard** | `/manager` | `ManagerHomeScreen` | `Dashboard.jsx` (KPIs, LiveFleetBoard, FleetAlerts, Today's Schedule) | `bookings`, `vehicles`, `drivers`, `attendance`, `fleet_alerts`, `gps_tracking` | ❌ Not Started |
| 2 | **Live Fleet Map** | `/manager/fleet` | `LiveFleetScreen` | `Fleet.jsx`, `LiveFleetBoard` | `vehicles`, `gps_tracking`, `vehicle_assignments`, `drivers` | ❌ Not Started |
| 3 | **Vehicle Details** | `/manager/fleet/:vehicleId` | `VehicleDetailsScreen` | `Vehicles.jsx` (detail view), `Fleet.jsx` (map click) | `vehicles`, `vehicle_assignments`, `drivers`, `bookings`, `documents`, `gps_tracking` | ❌ Not Started |
| 4 | **Trips List** | `/manager/trips` | `ManagerTripsScreen` | `Trips.jsx` | `bookings` (with driver/vehicle joins) | ❌ Not Started |
| 5 | **Trip Details (Manager)** | `/manager/trips/:tripId` | `ManagerTripDetailsScreen` | `Trips.jsx` (detail), `CreateTrip.jsx` (edit) | `bookings`, `drivers`, `vehicles`, `customers` | ❌ Not Started |
| 6 | **Assign Driver** | `/manager/trips/:tripId/assign-driver` | `AssignDriverScreen` | `Trips.jsx` (assignment modal) | `bookings`, `drivers` (available filter) | ❌ Not Started |
| 7 | **Assign Vehicle** | `/manager/trips/:tripId/assign-vehicle` | `AssignVehicleScreen` | `Trips.jsx` (assignment modal) | `bookings`, `vehicles` (available filter) | ❌ Not Started |
| 8 | **Bookings List** | `/manager/bookings` | `ManagerBookingsScreen` | `Trips.jsx` (pending/confirmed tabs), `CreateTrip.jsx` | `bookings` (status: draft, pending, approved, confirmed) | ❌ Not Started |
| 9 | **Booking Details** | `/manager/bookings/:bookingId` | `ManagerBookingDetailsScreen` | `Trips.jsx`, `CreateTrip.jsx` | `bookings`, `customers`, `drivers`, `vehicles` | ❌ Not Started |
| 10 | **Create/Edit Booking** | `/manager/bookings/new` / `:id/edit` | `CreateBookingScreen` | `CreateTrip.jsx` (multi-step) | `bookings`, `customers`, `drivers`, `vehicles` | ❌ Not Started |
| 11 | **Drivers List** | `/manager/drivers` | `ManagerDriversScreen` | `Drivers.jsx` | `drivers`, `profiles`, `vehicle_assignments`, `attendance` | ❌ Not Started |
| 12 | **Driver Details** | `/manager/drivers/:driverId` | `ManagerDriverDetailsScreen` | `Drivers.jsx` (detail), `DriverProfile.jsx` | `drivers`, `profiles`, `vehicle_assignments`, `attendance`, `documents`, `bookings` | ❌ Not Started |
| 13 | **Vehicles List** | `/manager/vehicles` | `ManagerVehiclesScreen` | `Vehicles.jsx` | `vehicles`, `vehicle_assignments`, `drivers`, `documents` | ❌ Not Started |
| 14 | **Vehicle Details (Manager)** | `/manager/vehicles/:vehicleId` | `ManagerVehicleDetailsScreen` | `Vehicles.jsx` (detail) | `vehicles`, `vehicle_assignments`, `drivers`, `documents`, `bookings` | ❌ Not Started |
| 15 | **Attendance Monitor** | `/manager/attendance` | `ManagerAttendanceScreen` | `Attendance.jsx` | `attendance`, `drivers`, `profiles` | ❌ Not Started |
| 16 | **Alerts Inbox** | `/manager/alerts` | `ManagerAlertsScreen` | `Dashboard.jsx` (FleetAlerts section), `fleetAlertRepository` | `fleet_alerts`, `vehicles`, `drivers`, `bookings` | ❌ Not Started |
| 17 | **Alert Details** | `/manager/alerts/:alertId` | `ManagerAlertDetailsScreen` | `fleetAlertRepository` | `fleet_alerts`, related entities | ❌ Not Started |
| 18 | **Documents Dashboard** | `/manager/documents` | `ManagerDocumentsScreen` | `Documents.jsx` | `documents` (driver + vehicle), `drivers`, `vehicles` | ❌ Not Started |
| 19 | **Maintenance** | `/manager/maintenance` | `ManagerMaintenanceScreen` | `Vehicles.jsx` (maintenance tab), ZIP: `pre_trip_vehicle_checklist`, `report_vehicle_issue` | `vehicles`, `maintenance_records` (if exists) | ❌ Not Started |
| 20 | **Expenses** | `/manager/expenses` | `ManagerExpensesScreen` | `Expenses.jsx` | `expenses`, `bookings`, `drivers`, `vehicles` | ❌ Not Started |
| 21 | **Reports Summary** | `/manager/reports` | `ManagerReportsScreen` | `Reports.jsx`, `FleetAnalytics.jsx` | `bookings`, `expenses`, `settlements`, `vehicles`, `drivers` | ❌ Not Started |
| 22 | **Notifications** | `/manager/notifications` | `ManagerNotificationsScreen` | `Communications.jsx`, `notificationService.js` | `notifications` | ❌ Not Started |
| 23 | **Profile** | `/manager/profile` | `ManagerProfileScreen` | `Profile.jsx` | `profiles` | ❌ Not Started |
| 24 | **Settings** | `/manager/settings` | `ManagerSettingsScreen` | `Settings.jsx` (limited), `CommunicationSettings.jsx` | `settings`, `profiles` | ❌ Not Started |
| 25 | **SOS / Emergency** | `/manager/sos` | `ManagerSosScreen` | ZIP: `sos_emergency_assistance` | `drivers`, `gps_tracking`, `fleet_alerts` | ❌ Not Started |

---

## FIGMA DESIGN SYSTEM ALIGNMENT

### Colors (from DESIGN.md + Figma)
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| Primary | `#0F172A` (Deep Navy) | `#EAF1FF` | Primary actions, headers, brand |
| Surface | `#FFFFFF` | `#1E2A3A` | Cards, sheets |
| Surface Container | `#F8F9FF` | `#263548` | Secondary surfaces |
| On Surface | `#0B1C30` | `#EAF1FF` | Primary text |
| On Surface Variant | `#45464D` | `#B0B8C8` | Secondary text |
| Outline | `#76777D` | `#6A7282` | Borders, dividers |
| Success | `#059669` | `#34D399` | Active, completed |
| Warning | `#D97706` | `#FBBF24` | Pending, attention |
| Danger | `#DC2626` | `#F87171` | Critical, cancelled |
| Info | `#2563EB` | `#60A5FA` | Info, navigation |

### Typography (Plus Jakarta Sans)
| Style | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| Display Large | 28px | 700 | 36px | Screen titles |
| Headline Medium | 20px | 600 | 28px | Section headers |
| Headline Small | 18px | 600 | 24px | Card titles |
| Body Large | 16px | 400 | 24px | Primary content |
| Body Medium | 14px | 400 | 20px | Standard text |
| Label Medium | 12px | 600 | 16px | Buttons, chips |
| Caption | 11px | 500 | 14px | Metadata, timestamps |

### Spacing (8pt Grid)
| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Internal element spacing |
| sm | 8px | Default gap |
| md | 16px | Card padding, screen margins |
| lg | 24px | Section spacing |
| xl | 32px | Major section breaks |
| container | 20px | Screen horizontal margins |

### Border Radius
| Token | Value | Usage |
|-------|-------|-------|
| sm | 4px | Inputs, small chips |
| md | 8px | Buttons |
| lg | 12px | Primary buttons |
| xl | 20px | Cards, bottom sheets |
| full | 9999px | Pills, badges, avatars |

### Elevation
| Level | Shadow | Usage |
|-------|--------|-------|
| 0 | None | Base background |
| 1 | `0 4px 15px rgba(0,0,0,0.04)` | Cards, containers |
| 2 | `0 8px 25px rgba(0,0,0,0.08)` | Modals, bottom sheets, dropdowns |

---

## MANAGER MOBILE NAVIGATION STRUCTURE

### Bottom Navigation (5 tabs)
```
┌─────────┬─────────┬─────────┬─────────┬─────────┐
│  Home   │  Fleet  │  Trips  │ Alerts  │ Profile │
│ 🏠      │ 🗺️      │ 📋      │ 🔔      │ 👤      │
└─────────┴─────────┴─────────┴─────────┴─────────┘
```

### Contextual Navigation (from Home/Dashboard)
- **Home** → Live Fleet preview (tap → Full Fleet Map)
- **Home** → Today's Trips (tap → Trips List)
- **Home** → Pending Assignments (tap → Trips List filtered)
- **Home** → Fleet Alerts (tap → Alerts Inbox)
- **Home** → Quick Actions → Create Booking / Assign Driver / Assign Vehicle
- **Fleet** → Vehicle Marker → Vehicle Details
- **Vehicle Details** → Driver → Driver Details
- **Vehicle Details** → Current Trip → Trip Details
- **Trips** → Trip Row → Trip Details → Assign Driver/Vehicle
- **Drivers** → Driver Row → Driver Details
- **Vehicles** → Vehicle Row → Vehicle Details
- **Alerts** → Alert Row → Alert Details → Related Entity

---

## PERMISSION MATRIX (Manager Mobile)

| Permission | Web Source | Mobile Screen | Required |
|------------|------------|---------------|----------|
| `view_dashboard` | `can('trips')` | ManagerHomeScreen | ✅ Yes |
| `view_fleet` | `can('vehicles')` | LiveFleetScreen | ✅ Yes |
| `view_trips` | `can('trips')` | ManagerTripsScreen | ✅ Yes |
| `create_booking` | `can('trips')` | CreateBookingScreen | ✅ Yes |
| `assign_driver` | `can('trips')` | AssignDriverScreen | ✅ Yes |
| `assign_vehicle` | `can('trips')` | AssignVehicleScreen | ✅ Yes |
| `view_drivers` | `can('drivers')` | ManagerDriversScreen | ✅ Yes |
| `view_vehicles` | `can('vehicles')` | ManagerVehiclesScreen | ✅ Yes |
| `view_attendance` | `can('attendance')` | ManagerAttendanceScreen | ✅ Yes |
| `view_alerts` | `can('fleetAlerts')` | ManagerAlertsScreen | ✅ Yes |
| `view_documents` | `can('vehicles')` | ManagerDocumentsScreen | ✅ Yes |
| `view_expenses` | `can('expenses')` | ManagerExpensesScreen | ⚠️ If supported |
| `view_reports` | `can('profitReports')` | ManagerReportsScreen | ⚠️ Summary only |
| `manage_settings` | `isAdmin` | ManagerSettingsScreen | ❌ Limited |

---

## DATA REQUIREMENTS PER SCREEN

### ManagerHomeScreen
- Today's bookings count (startDate = today)
- Active trips count (status = started)
- Pending assignments count (status = confirmed/assigned, no driver)
- Available vehicles count (status = active, no current assignment)
- Drivers online/available count
- Fleet alerts (critical/high priority, unresolved)
- Live fleet preview (5-10 vehicles with GPS)

### LiveFleetScreen
- All vehicles with: reg, type, status, driver, current trip, GPS coords, speed, ignition, last update
- Filters: All, Moving, Stopped, On Trip, Available, Offline, Alert
- Realtime GPS updates via Supabase Realtime on `gps_tracking`

### VehicleDetailsScreen
- Vehicle: reg, model, type, status, fuel, km, documents (insurance, permit, FC, PUC expiry)
- Current assignment: driver, trip
- GPS: current location, speed, ignition, last update
- Actions: View Trip, Contact Driver, View on Map

### ManagerTripsScreen
- Tabs: Today, Upcoming, Active, Completed, Pending Assignment
- Search, filter by status, driver, vehicle, type
- Pull-to-refresh, infinite scroll

### ManagerTripDetailsScreen
- Full booking data: customer, route, schedule, vehicle, driver, fare, notes
- Status workflow actions (if permitted): Assign Driver, Assign Vehicle, Start Trip, Complete Trip
- Contact driver, view on map

### AssignDriverScreen / AssignVehicleScreen
- Filtered list (available: not on trip, active status, valid license/docs)
- Show: name, phone, current status, assigned vehicle, rating
- Confirm → Update booking → Notify driver (realtime/notification)

### ManagerAttendanceScreen
- Today summary: Present, Absent, Late, On Leave, Half-day
- Driver list with status, check-in time, working hours
- Tap driver → Attendance history (if needed)

### ManagerAlertsScreen
- Priority groups: Critical, High, Medium, Low
- Categories: Trip, GPS, Vehicle, Driver, Document, System
- Actions: Acknowledge, Resolve, View Related Entity

### ManagerDocumentsScreen
- Tabs: Driver Documents, Vehicle Documents
- Filter: Expiring (30 days), Expired, Valid
- Tap → Document details, download, notify driver

### ManagerReportsScreen
- **NOT** desktop reports — mobile summaries only
- Cards: Trips this month, Fleet utilization, Driver performance, Expense summary
- Compact charts (bar, donut) where meaningful

---

## IMPLEMENTATION PRIORITY

### Phase 1 (Core Manager Shell)
1. ManagerHomeScreen
2. ManagerShell (AppShell with Manager BottomNav)
3. Role routing (Driver/Manager/Admin)

### Phase 2 (Fleet & Trips)
4. LiveFleetScreen + VehicleDetailsScreen
5. ManagerTripsScreen + ManagerTripDetailsScreen
6. AssignDriverScreen + AssignVehicleScreen

### Phase 3 (Bookings & Operations)
7. ManagerBookingsScreen + CreateBookingScreen
6. ManagerAttendanceScreen
7. ManagerAlertsScreen

### Phase 4 (Supporting Modules)
8. ManagerDriversScreen + ManagerDriverDetailsScreen
9. ManagerVehiclesScreen + ManagerVehicleDetailsScreen
10. ManagerDocumentsScreen
11. ManagerNotificationsScreen

### Phase 5 (Advanced)
12. ManagerExpensesScreen (if backend supports)
13. ManagerMaintenanceScreen (if backend supports)
14. ManagerReportsScreen (summaries)
15. ManagerSosScreen
16. ManagerProfileScreen + ManagerSettingsScreen

---

## CROSS-SCREEN CONNECTIONS (No Dead Ends)

| From Screen | Action | To Screen | Data Passed |
|-------------|--------|-----------|-------------|
| ManagerHomeScreen | Tap Live Fleet preview | LiveFleetScreen | — |
| ManagerHomeScreen | Tap "X trips need assignment" | ManagerTripsScreen | Filter: `status=assigned, driver=null` |
| ManagerHomeScreen | Tap Alert card | ManagerAlertDetailsScreen | Alert ID |
| LiveFleetScreen | Tap Vehicle marker | VehicleDetailsScreen | Vehicle ID |
| VehicleDetailsScreen | Tap "View Trip" | ManagerTripDetailsScreen | Trip ID |
| VehicleDetailsScreen | Tap "Contact Driver" | Phone/Chat | Driver phone |
| VehicleDetailsScreen | Tap Driver name | ManagerDriverDetailsScreen | Driver ID |
| ManagerTripsScreen | Tap Trip row | ManagerTripDetailsScreen | Trip ID |
| ManagerTripDetailsScreen | Tap "Assign Driver" | AssignDriverScreen | Trip ID |
| ManagerTripDetailsScreen | Tap "Assign Vehicle" | AssignVehicleScreen | Trip ID |
| ManagerTripDetailsScreen | Tap Driver | ManagerDriverDetailsScreen | Driver ID |
| ManagerTripDetailsScreen | Tap Vehicle | ManagerVehicleDetailsScreen | Vehicle ID |
| AssignDriverScreen | Select Driver → Confirm | ManagerTripDetailsScreen | Updated Trip |
| AssignVehicleScreen | Select Vehicle → Confirm | ManagerTripDetailsScreen | Updated Trip |
| ManagerDriversScreen | Tap Driver | ManagerDriverDetailsScreen | Driver ID |
| ManagerDriverDetailsScreen | Tap Current Trip | ManagerTripDetailsScreen | Trip ID |
| ManagerDriverDetailsScreen | Tap Assigned Vehicle | ManagerVehicleDetailsScreen | Vehicle ID |
| ManagerVehiclesScreen | Tap Vehicle | ManagerVehicleDetailsScreen | Vehicle ID |
| ManagerAlertsScreen | Tap Alert | ManagerAlertDetailsScreen | Alert ID |
| ManagerAlertDetailsScreen | Tap Related Vehicle | VehicleDetailsScreen | Vehicle ID |
| ManagerAlertDetailsScreen | Tap Related Driver | ManagerDriverDetailsScreen | Driver ID |
| ManagerAlertDetailsScreen | Tap Related Trip | ManagerTripDetailsScreen | Trip ID |
| ManagerDocumentsScreen | Tap Document | DocumentViewer | Document ID |
| ManagerNotificationsScreen | Tap Notification | Relevant Screen | Deep link data |

---

## NOTES

1. **Figma not directly accessible** — Mapping based on React Manager pages + Driver ZIP Manager screens (Live Fleet, Trips Overview, Create Booking, Trip Details Assignment)
2. **Supabase Realtime** required for Live Fleet GPS updates and Alert notifications
3. **Permission checks** at Service layer, not UI — UI shows/hides based on `can()` provider
4. **No Admin mobile screens** — Admin gets WebOnlyScreen with logout option
5. **Design System** — Single shared system for Driver + Manager (see DESIGN.md)
6. **Dark Theme** — Must be true dark, not inverted light (see DESIGN.md tokens)
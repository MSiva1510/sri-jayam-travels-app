# WEB → MOBILE FEATURE MATRIX

**Source:** React Web App (`src/`) → Flutter Mobile (`mobile/lib/`)
**Roles:** DRIVER, MANAGER (ADMIN = WEB ONLY)
**Date:** 2026-08-25

---

## MATRIX LEGEND

| Column | Meaning |
|--------|---------|
| **Web Feature** | React page/module name |
| **Mobile Role** | DRIVER / MANAGER / NONE (Admin) |
| **Mobile Screen** | Flutter screen name (planned or existing) |
| **Data Source** | Supabase table(s) |
| **Repository** | Dart repository class |
| **Service** | Dart service class |
| **Permission** | Required permission string |
| **Status** | EXISTING / REQUIRED / ENHANCE / DEFER |

---

## AUTHENTICATION & PROFILE

| Web Feature | Mobile Role | Mobile Screen | Data Source | Repository | Service | Permission | Status |
|-------------|-------------|---------------|-------------|------------|---------|------------|--------|
| Login | DRIVER + MANAGER | `LoginScreen` | `auth.users` + `profiles` | `AuthRepository` | `AuthService` | — | EXISTING |
| Forgot Password | DRIVER + MANAGER | `ForgotPasswordScreen` | `auth.users` | `AuthRepository` | `AuthService` | — | EXISTING |
| Session Restore | DRIVER + MANAGER | (Automatic) | `auth.users` + `profiles` | `AuthRepository` | `AuthService` | — | EXISTING |
| Logout | DRIVER + MANAGER | (Action) | — | `AuthRepository` | `AuthService` | — | EXISTING |
| Profile View | DRIVER | `DriverProfileScreen` | `profiles` + `drivers` | `AuthRepository` | `AuthService` | — | EXISTING |
| Profile View | MANAGER | `ManagerProfileScreen` | `profiles` | `AuthRepository` | `AuthService` | — | REQUIRED |
| Profile Edit | DRIVER | `DriverProfileScreen` (edit) | `profiles` | `AuthRepository` | `AuthService` | `update_profile` | EXISTING |
| Profile Edit | MANAGER | `ManagerProfileScreen` (edit) | `profiles` | `AuthRepository` | `AuthService` | `update_profile` | REQUIRED |
| Change Password | DRIVER + MANAGER | Settings → Change Password | `auth.users` | `AuthRepository` | `AuthService` | — | REQUIRED |
| Admin User Management | ADMIN | **NONE (WEB ONLY)** | `profiles` + `auth.users` | — | — | `user_management` | N/A |

---

## BOOKINGS / TRIPS

| Web Feature | Mobile Role | Mobile Screen | Data Source | Repository | Service | Permission | Status |
|-------------|-------------|---------------|-------------|------------|---------|------------|--------|
| **Driver: Today's Trips** | DRIVER | `DriverHomeScreen` (section) | `bookings` (driver_id, start_date=today) | `TripRepository` | `TripService` | `view_own_trips` | EXISTING |
| **Driver: Trip List** | DRIVER | `DriverTripsScreen` | `bookings` (driver_id) | `TripRepository` | `TripService` | `view_own_trips` | EXISTING |
| **Driver: Trip Details** | DRIVER | `TripDetailsScreen` | `bookings` + `customers` + `vehicles` | `TripRepository` | `TripService` | `view_own_trips` | EXISTING |
| **Driver: Trip Map** | DRIVER | `TripMapScreen` | `bookings` + `gps_tracking` | `TripRepository` + `GpsRepository` | `TripService` + `GpsTrackingService` | `view_own_trips` | EXISTING |
| **Driver: Start Trip** | DRIVER | `TripDetailsScreen` → Action | `bookings` (status: pending→started) | `TripRepository` | `TripService` | `start_trip` | EXISTING |
| **Driver: Pause/Resume** | DRIVER | `TripDetailsScreen` → Action | `bookings` + RideLifecycleContext | `TripRepository` | `TripService` | `manage_own_trip` | EXISTING |
| **Driver: Complete Trip** | DRIVER | `TripDetailsScreen` → Action | `bookings` (status: started→completed) | `TripRepository` | `TripService` | `complete_trip` | EXISTING |
| **Driver: Cancel Trip** | DRIVER | `TripDetailsScreen` → Action | `bookings` (status: →cancelled) | `TripRepository` | `TripService` | `cancel_trip` | EXISTING |
| **Driver: Ride History** | DRIVER | `DriverTripsScreen` (Completed tab) | `bookings` (status=completed) | `TripRepository` | `TripService` | `view_own_trips` | EXISTING |
| **Manager: All Trips** | MANAGER | `ManagerTripsScreen` | `bookings` (all) | `TripRepository` | `TripService` | `view_trips` | REQUIRED |
| **Manager: Trip Details** | MANAGER | `ManagerTripDetailsScreen` | `bookings` + joins | `TripRepository` | `TripService` | `view_trips` | REQUIRED |
| **Manager: Create Booking** | MANAGER | `CreateBookingScreen` | `bookings` + `customers` + `drivers` + `vehicles` | `TripRepository` + `CustomerRepository` + `DriverRepository` + `VehicleRepository` | `TripService` | `create_booking` | REQUIRED |
| **Manager: Edit Booking** | MANAGER | `CreateBookingScreen` (edit mode) | `bookings` | `TripRepository` | `TripService` | `edit_booking` | REQUIRED |
| **Manager: Assign Driver** | MANAGER | `AssignDriverScreen` | `bookings` + `drivers` (available) | `TripRepository` + `DriverRepository` | `TripService` | `assign_driver` | REQUIRED |
| **Manager: Assign Vehicle** | MANAGER | `AssignVehicleScreen` | `bookings` + `vehicles` (available) | `TripRepository` + `VehicleRepository` | `TripService` | `assign_vehicle` | REQUIRED |
| **Manager: Update Trip Status** | MANAGER | `ManagerTripDetailsScreen` → Actions | `bookings` | `TripRepository` | `TripService` | `manage_trip` | REQUIRED |
| **Manager: Booking List (Pending)** | MANAGER | `ManagerBookingsScreen` | `bookings` (draft, pending, approved, confirmed) | `TripRepository` | `TripService` | `view_bookings` | REQUIRED |
| **Manager: Booking Approval** | MANAGER | `ManagerBookingDetailsScreen` | `bookings` + `booking_approvals` | `TripRepository` | `TripService` | `approve_booking` | REQUIRED |
| **Customer: Public Booking** | NONE | **NONE (PUBLIC WEB)** | `bookings` | — | — | — | N/A |

---

## FLEET / GPS / LIVE TRACKING

| Web Feature | Mobile Role | Mobile Screen | Data Source | Repository | Service | Permission | Status |
|-------------|-------------|---------------|-------------|------------|---------|------------|--------|
| **Driver: GPS Status** | DRIVER | `DriverHomeScreen` (section) | `gps_tracking` (own) | `GpsRepository` | `GpsTrackingService` + `LocationService` | `gps_tracking` | EXISTING |
| **Driver: Live Location** | DRIVER | `TripMapScreen` | `gps_tracking` (own trip) | `GpsRepository` | `GpsTrackingService` | `gps_tracking` | EXISTING |
| **Driver: GPS History** | DRIVER | `TripMapScreen` (history) | `gps_tracking` (history) | `GpsRepository` | `GpsTrackingService` | `gps_tracking` | EXISTING |
| **Manager: Live Fleet Map** | MANAGER | `LiveFleetScreen` | `vehicles` + `gps_tracking` + `vehicle_assignments` | `VehicleRepository` + `GpsRepository` | `GpsTrackingService` | `view_fleet` | REQUIRED |
| **Manager: Vehicle Details** | MANAGER | `VehicleDetailsScreen` / `ManagerVehicleDetailsScreen` | `vehicles` + `gps_tracking` + `vehicle_assignments` | `VehicleRepository` + `GpsRepository` | `GpsTrackingService` | `view_fleet` | REQUIRED |
| **Manager: GPS History** | MANAGER | `GpsHistoryScreen` (if needed) | `gps_tracking` (history) | `GpsRepository` | `GpsTrackingService` | `view_gps_history` | DEFER |
| **Manager: Route Replay** | MANAGER | `RouteReplayScreen` (if needed) | `gps_tracking` (trip) | `GpsRepository` | `GpsReplayService` | `view_gps_history` | DEFER |
| **Manager: Geofences** | MANAGER | `GeofenceScreen` (if needed) | `geofences` + `geofence_zones` | `GeofenceRepository` | `GeofenceService` | `manage_geofences` | DEFER |
| **Manager: Fleet Alerts** | MANAGER | `ManagerAlertsScreen` | `fleet_alerts` | `FleetAlertRepository` | `AlertService` | `view_fleet_alerts` | REQUIRED |

---

## ATTENDANCE

| Web Feature | Mobile Role | Mobile Screen | Data Source | Repository | Service | Permission | Status |
|-------------|-------------|---------------|-------------|------------|---------|------------|--------|
| **Driver: Check In** | DRIVER | `AttendanceScreen` | `attendance` | `AttendanceRepository` | `AttendanceService` | `attendance_self` | EXISTING |
| **Driver: Check Out** | DRIVER | `AttendanceScreen` | `attendance` | `AttendanceRepository` | `AttendanceService` | `attendance_self` | EXISTING |
| **Driver: Working Hours** | DRIVER | `AttendanceScreen` | `attendance` | `AttendanceRepository` | `AttendanceService` | `attendance_self` | EXISTING |
| **Driver: Attendance History** | DRIVER | `AttendanceHistoryScreen` | `attendance` | `AttendanceRepository` | `AttendanceService` | `attendance_self` | EXISTING |
| **Manager: Today's Attendance** | MANAGER | `ManagerAttendanceScreen` | `attendance` (today) + `drivers` | `AttendanceRepository` + `DriverRepository` | `AttendanceService` | `view_attendance` | REQUIRED |
| **Manager: Attendance Monitor** | MANAGER | `ManagerAttendanceScreen` (list) | `attendance` + `drivers` | `AttendanceRepository` + `DriverRepository` | `AttendanceService` | `view_attendance` | REQUIRED |
| **Manager: Attendance History** | MANAGER | `ManagerAttendanceScreen` (history tab) | `attendance` | `AttendanceRepository` | `AttendanceService` | `view_attendance` | REQUIRED |
| **Admin: Attendance Config** | ADMIN | **NONE (WEB ONLY)** | `attendance` + `settings` | — | — | `manage_attendance` | N/A |

---

## DOCUMENTS

| Web Feature | Mobile Role | Mobile Screen | Data Source | Repository | Service | Permission | Status |
|-------------|-------------|---------------|-------------|------------|---------|------------|--------|
| **Driver: Own Documents** | DRIVER | `DriverDocumentsScreen` | `documents` (driver_id) | `DocumentRepository` | `DocumentService` | `view_own_documents` | EXISTING |
| **Driver: Upload/Replace** | DRIVER | `DriverDocumentsScreen` → Action | `documents` + Storage | `DocumentRepository` | `DocumentService` | `manage_own_documents` | EXISTING |
| **Driver: Document Expiry** | DRIVER | `DriverDocumentsScreen` (badges) | `documents` (expiry_date) | `DocumentRepository` | `DocumentService` | `view_own_documents` | EXISTING |
| **Manager: All Documents** | MANAGER | `ManagerDocumentsScreen` | `documents` (driver + vehicle) | `DocumentRepository` | `DocumentService` | `view_documents` | REQUIRED |
| **Manager: Expiry Dashboard** | MANAGER | `ManagerDocumentsScreen` (tabs) | `documents` | `DocumentRepository` | `DocumentService` | `view_documents` | REQUIRED |
| **Manager: Vehicle Documents** | MANAGER | `ManagerVehicleDetailsScreen` → Documents | `documents` (vehicle_id) | `DocumentRepository` | `DocumentService` | `view_documents` | REQUIRED |
| **Admin: Document Config** | ADMIN | **NONE (WEB ONLY)** | `documents` + `settings` | — | — | `manage_documents` | N/A |

---

## DRIVERS (Manager View)

| Web Feature | Mobile Role | Mobile Screen | Data Source | Repository | Service | Permission | Status |
|-------------|-------------|---------------|-------------|------------|---------|------------|--------|
| **Manager: Driver List** | MANAGER | `ManagerDriversScreen` | `drivers` + `profiles` + `vehicle_assignments` | `DriverRepository` | `DriverService` | `view_drivers` | REQUIRED |
| **Manager: Driver Details** | MANAGER | `ManagerDriverDetailsScreen` | `drivers` + `profiles` + `vehicle_assignments` + `attendance` + `documents` + `bookings` | `DriverRepository` + `VehicleRepository` + `AttendanceRepository` + `DocumentRepository` + `TripRepository` | `DriverService` | `view_drivers` | REQUIRED |
| **Manager: Driver Availability** | MANAGER | `ManagerDriverDetailsScreen` (status) | `drivers` (status) + `vehicle_assignments` | `DriverRepository` | `DriverService` | `view_drivers` | REQUIRED |
| **Manager: Create Driver** | ADMIN | **NONE (WEB ONLY)** | `drivers` + `profiles` + `auth.users` | — | — | `create_driver` | N/A |
| **Manager: Edit Driver** | ADMIN | **NONE (WEB ONLY)** | `drivers` + `profiles` | — | — | `edit_driver` | N/A |

---

## VEHICLES (Manager View)

| Web Feature | Mobile Role | Mobile Screen | Data Source | Repository | Service | Permission | Status |
|-------------|-------------|---------------|-------------|------------|---------|------------|--------|
| **Manager: Vehicle List** | MANAGER | `ManagerVehiclesScreen` | `vehicles` + `vehicle_assignments` | `VehicleRepository` | `VehicleService` | `view_vehicles` | REQUIRED |
| **Manager: Vehicle Details** | MANAGER | `ManagerVehicleDetailsScreen` | `vehicles` + `vehicle_assignments` + `drivers` + `bookings` + `documents` | `VehicleRepository` + `DriverRepository` + `TripRepository` + `DocumentRepository` | `VehicleService` | `view_vehicles` | REQUIRED |
| **Manager: Vehicle Status** | MANAGER | `ManagerVehicleDetailsScreen` (status) | `vehicles` (status) | `VehicleRepository` | `VehicleService` | `view_vehicles` | REQUIRED |
| **Manager: Create Vehicle** | ADMIN | **NONE (WEB ONLY)** | `vehicles` | — | — | `create_vehicle` | N/A |
| **Manager: Edit Vehicle** | ADMIN | **NONE (WEB ONLY)** | `vehicles` | — | — | `edit_vehicle` | N/A |

---

## EXPENSES

| Web Feature | Mobile Role | Mobile Screen | Data Source | Repository | Service | Permission | Status |
|-------------|-------------|---------------|-------------|------------|---------|------------|--------|
| **Manager: Expense List** | MANAGER | `ManagerExpensesScreen` | `expenses` | `ExpenseRepository` | `ExpenseService` | `view_expenses` | REQUIRED* |
| **Manager: Approve Expense** | MANAGER | `ManagerExpensesScreen` → Action | `expenses` (status: submitted→approved) | `ExpenseRepository` | `ExpenseService` | `approve_expense` | REQUIRED* |
| **Driver: Submit Expense** | DRIVER | `DriverExpensesScreen` (future) | `expenses` | `ExpenseRepository` | `ExpenseService` | `submit_expense` | DEFER |
| *Depends on backend support | | | | | | | |

---

## MAINTENANCE

| Web Feature | Mobile Role | Mobile Screen | Data Source | Repository | Service | Permission | Status |
|-------------|-------------|---------------|-------------|------------|---------|------------|--------|
| **Manager: Maintenance List** | MANAGER | `ManagerMaintenanceScreen` | `vehicles` (status=maintenance) + `maintenance_records` | `VehicleRepository` (+ `MaintenanceRepository` if exists) | `VehicleService` | `view_maintenance` | REQUIRED* |
| **Manager: Report Issue** | MANAGER | `ReportIssueScreen` | `maintenance_records` | `MaintenanceRepository` | `MaintenanceService` | `report_maintenance` | REQUIRED* |
| **Driver: Pre-trip Checklist** | DRIVER | `PreTripChecklistScreen` (from ZIP) | `inspection_records` | `InspectionRepository` | `InspectionService` | `vehicle_inspection` | DEFER |
| **Driver: Report Issue** | DRIVER | `ReportIssueScreen` (from ZIP) | `maintenance_records` | `MaintenanceRepository` | `MaintenanceService` | `report_maintenance` | DEFER |
| *Depends on backend support | | | | | | | |

---

## REPORTS / ANALYTICS

| Web Feature | Mobile Role | Mobile Screen | Data Source | Repository | Service | Permission | Status |
|-------------|-------------|---------------|-------------|------------|---------|------------|--------|
| **Manager: Trip Summary** | MANAGER | `ManagerReportsScreen` | `bookings` (aggregated) | `TripRepository` | `ReportService` | `view_reports` | REQUIRED |
| **Manager: Fleet Summary** | MANAGER | `ManagerReportsScreen` | `vehicles` + `gps_tracking` (aggregated) | `VehicleRepository` + `GpsRepository` | `ReportService` | `view_reports` | REQUIRED |
| **Manager: Driver Summary** | MANAGER | `ManagerReportsScreen` | `drivers` + `bookings` + `attendance` (aggregated) | `DriverRepository` + `TripRepository` + `AttendanceRepository` | `ReportService` | `view_reports` | REQUIRED |
| **Manager: Expense Summary** | MANAGER | `ManagerReportsScreen` | `expenses` (aggregated) | `ExpenseRepository` | `ReportService` | `view_reports` | REQUIRED* |
| **Admin: Financial Reports** | ADMIN | **NONE (WEB ONLY)** | `bookings` + `expenses` + `settlements` | — | — | `view_financial_reports` | N/A |
| **Admin: Payroll Reports** | ADMIN | **NONE (WEB ONLY)** | `settlements` + `trip_payslips` | — | — | `view_payroll` | N/A |

---

## NOTIFICATIONS / ALERTS / COMMUNICATION

| Web Feature | Mobile Role | Mobile Screen | Data Source | Repository | Service | Permission | Status |
|-------------|-------------|---------------|-------------|------------|---------|------------|--------|
| **Unified Inbox** | DRIVER + MANAGER | `NotificationsScreen` / `ManagerAlertsScreen` | `notifications` + `fleet_alerts` | `NotificationRepository` + `FleetAlertRepository` | `NotificationService` + `AlertService` | `view_notifications` | EXISTING (Driver) / REQUIRED (Manager) |
| **Trip Assignment Push** | DRIVER | `NotificationsScreen` → TripDetails | `notifications` (type=trip_assignment) | `NotificationRepository` | `NotificationService` | — | EXISTING |
| **Trip Update Push** | DRIVER | `NotificationsScreen` → TripDetails | `notifications` (type=trip_update) | `NotificationRepository` | `NotificationService` | — | EXISTING |
| **Document Expiry Push** | DRIVER + MANAGER | `NotificationsScreen` → Documents | `notifications` (type=document_expiry) | `NotificationRepository` | `NotificationService` | — | REQUIRED |
| **Vehicle Warning Push** | DRIVER + MANAGER | `NotificationsScreen` → Vehicle | `notifications` (type=vehicle_warning) | `NotificationRepository` | `NotificationService` | — | REQUIRED |
| **Manager Instruction** | DRIVER | `NotificationsScreen` → Communication | `notifications` (type=manager_message) | `NotificationRepository` | `NotificationService` | — | EXISTING |
| **SOS Alert** | DRIVER + MANAGER | `SosScreen` / `ManagerAlertsScreen` | `fleet_alerts` (type=sos) | `FleetAlertRepository` | `AlertService` | `sos` | REQUIRED (from ZIP) |
| **Call Driver** | MANAGER | `ManagerDriverDetailsScreen` → Action | `drivers` (phone) | `DriverRepository` | `CommunicationService` | `contact_driver` | REQUIRED |
| **WhatsApp Driver** | MANAGER | `ManagerDriverDetailsScreen` → Action | `drivers` (phone) | `DriverRepository` | `CommunicationService` | `contact_driver` | REQUIRED* |
| **In-app Message** | MANAGER | `CommunicationsScreen` | `communications` | `CommunicationRepository` | `CommunicationService` | `send_communication` | REQUIRED* |
| *WhatsApp/In-app depends on backend integration | | | | | | | |

---

## SETTINGS

| Web Feature | Mobile Role | Mobile Screen | Data Source | Repository | Service | Permission | Status |
|-------------|-------------|---------------|-------------|------------|---------|------------|--------|
| **Appearance (Theme)** | DRIVER + MANAGER | `SettingsScreen` / `ManagerSettingsScreen` | Local (SharedPreferences) | — | `ThemeProvider` | — | EXISTING (Driver) / REQUIRED (Manager) |
| **Notifications Toggle** | DRIVER + MANAGER | `SettingsScreen` / `ManagerSettingsScreen` | Local + `profiles` (notification_prefs) | `AuthRepository` | `AuthService` | — | REQUIRED |
| **Support / Help** | DRIVER + MANAGER | `SettingsScreen` / `ManagerSettingsScreen` | Static | — | — | — | REQUIRED |
| **About / Version** | DRIVER + MANAGER | `SettingsScreen` / `ManagerSettingsScreen` | `package_info_plus` | — | — | — | REQUIRED |
| **Admin: System Settings** | ADMIN | **NONE (WEB ONLY)** | `settings` | — | — | `manage_settings` | N/A |
| **Admin: Fleet Settings** | ADMIN | **NONE (WEB ONLY)** | `settings` (fleet) | — | — | `manage_fleet_settings` | N/A |
| **Admin: GPS Settings** | ADMIN | **NONE (WEB ONLY)** | `gps_settings` | — | — | `manage_gps` | N/A |
| **Admin: Communication Settings** | ADMIN | **NONE (WEB ONLY)** | `settings` (communication) | — | — | `manage_communication` | N/A |
| **Admin: Security Settings** | ADMIN | **NONE (WEB ONLY)** | `settings` (security) + `audit_logs` | — | — | `manage_security` | N/A |
| **Admin: Backup/Database** | ADMIN | **NONE (WEB ONLY)** | `backup_config` + `backup_history` | — | — | `manage_backup` | N/A |

---

## ADMIN-ONLY FEATURES (WEB ONLY — NO MOBILE)

| Web Feature | React Page | Supabase Tables | Mobile Action |
|-------------|------------|-----------------|---------------|
| User Management | `UserManagement.jsx` | `profiles`, `auth.users`, `role_permissions` | Show WebOnlyScreen |
| Role Manager | `RoleManager.jsx` | `role_permissions` | Show WebOnlyScreen |
| System Health | `SystemHealth.jsx` | `backup_history`, `error_log` | Show WebOnlyScreen |
| Backup Manager | `BackupManager.jsx` | `backup_config`, `backup_history` | Show WebOnlyScreen |
| Security Settings | `SecuritySettings.jsx` | `settings`, `audit_logs` | Show WebOnlyScreen |
| Database Status | `DatabaseStatus.jsx` | (Supabase meta) | Show WebOnlyScreen |
| Invoices | `Invoices.jsx` | `invoices` | Show WebOnlyScreen |
| Reports (Financial) | `Reports.jsx` | `bookings`, `expenses`, `settlements` | Show WebOnlyScreen |
| Audit Log | `AuditLog.jsx` | `audit_logs` | Show WebOnlyScreen |
| Settings (Full) | `Settings.jsx` | `settings` | Show WebOnlyScreen |
| Payroll (Full) | `Payroll.jsx` | `settlements`, `trip_payslips` | Show WebOnlyScreen |
| Fleet Settings | `FleetSettings.jsx` | `gps_settings`, `geofences` | Show WebOnlyScreen |

---

## SUMMARY BY ROLE

### DRIVER MOBILE (Current + Enhancements)
| Status | Count |
|--------|-------|
| EXISTING | 15 screens |
| REQUIRED (enhancements) | 5 screens (Theme, Notifications, Settings, SOS, Inspection) |
| DEFER | 3 screens (Expenses, Maintenance, Route Replay) |

### MANAGER MOBILE (All New)
| Status | Count |
|--------|-------|
| REQUIRED (Core) | 18 screens |
| REQUIRED* (If backend supports) | 4 screens |
| DEFER | 3 screens |

### ADMIN MOBILE
| Status | Count |
|--------|-------|
| NONE (WEB ONLY) | 12+ features |
| WebOnlyScreen | 1 screen |

---

## REPOSITORY & SERVICE CLASSES NEEDED

### Existing (Driver)
- `AuthRepository` / `AuthService` ✅
- `TripRepository` / `TripService` ✅
- `BookingRepository` / `BookingService` ✅
- `AttendanceRepository` / `AttendanceService` ✅
- `DocumentRepository` / `DocumentService` ✅
- `GpsRepository` / `GpsTrackingService` / `LocationService` ✅
- `NotificationRepository` / `NotificationService` ✅
- `CommunicationService` ✅

### Needed for Manager
- `DriverRepository` / `DriverService` (extend existing)
- `VehicleRepository` / `VehicleService` (new)
- `CustomerRepository` / `CustomerService` (new)
- `ExpenseRepository` / `ExpenseService` (new, if backend)
- `FleetAlertRepository` / `AlertService` (new)
- `ReportService` (new, aggregates)
- `MaintenanceRepository` / `MaintenanceService` (new, if backend)
- `InspectionRepository` / `InspectionService` (new, if backend)

---

## PERMISSION STRINGS (for `can()` provider)

```
# Driver
view_own_trips
start_trip
manage_own_trip
complete_trip
cancel_trip
attendance_self
view_own_documents
manage_own_documents
gps_tracking
view_notifications
sos

# Manager
view_trips
create_booking
edit_booking
assign_driver
assign_vehicle
manage_trip
view_bookings
approve_booking
view_fleet
view_drivers
view_vehicles
view_attendance
view_fleet_alerts
view_documents
view_expenses
approve_expense
view_reports
contact_driver
send_communication
view_maintenance
report_maintenance
```

---

## IMPLEMENTATION ORDER (Dependencies)

1. **Auth & Role Routing** → `AuthRepository`, `AuthService`, `app_router.dart` (role guards)
2. **Shared Design System** → `core/theme/*`, `AppShell`, `AppHeader`, `AppBottomNavigation`
3. **Driver Shell** → `DriverHomeScreen` (enhance), `DriverTripsScreen`, `TripDetailsScreen`
4. **Manager Shell** → `ManagerHomeScreen`, `ManagerTripsScreen`, `LiveFleetScreen`
5. **Assignment Flow** → `AssignDriverScreen`, `AssignVehicleScreen`
6. **Booking Creation** → `CreateBookingScreen`
7. **Supporting Screens** → Drivers, Vehicles, Attendance, Alerts, Documents
8. **Reports & Settings** → `ManagerReportsScreen`, `ManagerSettingsScreen`
9. **Advanced** → SOS, Maintenance, Inspection, Expenses (if backend)
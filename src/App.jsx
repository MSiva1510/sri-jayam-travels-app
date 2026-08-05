import ErrorBoundary from './components/ErrorBoundary'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider }           from './context/AppContext'
import { AuthProvider }          from './context/AuthContext'
import { RideLifecycleProvider } from './context/RideLifecycleContext'
import { CommunicationProvider } from './context/CommunicationContext'
import { AdminProvider }         from './context/AdminContext'
import { GpsHistoryProvider }    from './context/GpsHistoryContext'
import AppShell                  from './components/layout/AppShell'
import ProtectedRoute            from './components/auth/ProtectedRoute'

// Public
import Login           from './pages/Login'
import Unauthorized    from './pages/Unauthorized'
import PublicBooking   from './pages/PublicBooking'

// Admin + Manager pages
import Dashboard       from './pages/Dashboard'
import Invoices        from './pages/Invoices'
import Trips           from './pages/Trips'
import CreateTrip      from './pages/CreateTrip'
import Customers       from './pages/Customers'
import Expenses        from './pages/Expenses'
import Drivers         from './pages/Drivers'
import Vehicles        from './pages/Vehicles'
import Settings        from './pages/Settings'
import UserManagement   from './pages/admin/UserManagement'
import RoleManager      from './pages/admin/RoleManager'
import SystemHealth     from './pages/admin/SystemHealth'
import BackupManager    from './pages/admin/BackupManager'
import SecuritySettings from './pages/admin/SecuritySettings'
import DatabaseStatus   from './pages/admin/DatabaseStatus'
import Attendance      from './pages/Attendance'
import Profile         from './pages/Profile'
import Payroll         from './pages/Payroll'
import Reports         from './pages/Reports'
import Documents       from './pages/Documents'
import AuditLog        from './pages/AuditLog'
import Communications       from './pages/Communications'
import CommunicationSettings from './pages/CommunicationSettings'
import Fleet            from './pages/Fleet'
import FleetSettings    from './pages/FleetSettings'
import GpsHistory       from './pages/GpsHistory'
import RouteReplay      from './pages/RouteReplay'
import FleetAnalytics   from './pages/FleetAnalytics'
import { FleetAnalyticsProvider } from './context/FleetAnalyticsContext'

// Driver pages
import DriverDashboard from './pages/driver/DriverDashboard'
import AssignedTrips   from './pages/driver/AssignedTrips'
import RideHistory     from './pages/driver/RideHistory'
import DriverProfile   from './pages/driver/DriverProfile'
import LiveLocation    from './pages/driver/LiveLocation'

function DriverShell({ children }) {
  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <RideLifecycleProvider>{children}</RideLifecycleProvider>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
    <AppProvider>
      <AuthProvider>
        <CommunicationProvider>
        <AdminProvider>
        <Routes>
          {/* Public */}
          <Route path="/login"        element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/book"         element={<PublicBooking />} />

          {/* Protected shell */}
          <Route element={<ProtectedRoute><GpsHistoryProvider><AppShell /></GpsHistoryProvider></ProtectedRoute>}>
            {/* Admin + Manager */}
            <Route path="/"            element={<ProtectedRoute allowedRoles={['admin','manager']}><Dashboard /></ProtectedRoute>} />
            <Route path="/invoices"    element={<ProtectedRoute allowedRoles={['admin']}><Invoices /></ProtectedRoute>} />
            <Route path="/trips"       element={<ProtectedRoute allowedRoles={['admin','manager']}><Trips /></ProtectedRoute>} />
            <Route path="/create-trip" element={<ProtectedRoute allowedRoles={['admin','manager']}><CreateTrip /></ProtectedRoute>} />
            <Route path="/customers"   element={<ProtectedRoute allowedRoles={['admin','manager']}><Customers /></ProtectedRoute>} />
            <Route path="/expenses"    element={<ProtectedRoute allowedRoles={['admin','manager']}><Expenses /></ProtectedRoute>} />
            <Route path="/drivers"     element={<ProtectedRoute allowedRoles={['admin','manager']}><Drivers /></ProtectedRoute>} />
            <Route path="/vehicles"    element={<ProtectedRoute allowedRoles={['admin','manager']}><Vehicles /></ProtectedRoute>} />
            <Route path="/settings"    element={<ProtectedRoute allowedRoles={['admin']}><Settings /></ProtectedRoute>} />
            {/* Fix 2: /attendance locked to admin + manager only */}
            <Route path="/attendance"  element={<ProtectedRoute allowedRoles={['admin','manager']}><Attendance /></ProtectedRoute>} />
            <Route path="/profile"     element={<ProtectedRoute allowedRoles={['admin','manager']}><Profile /></ProtectedRoute>} />
            <Route path="/documents"              element={<ProtectedRoute allowedRoles={['admin','manager']}><Documents /></ProtectedRoute>} />
            <Route path="/communications"          element={<ProtectedRoute allowedRoles={['admin','manager']}><Communications /></ProtectedRoute>} />
            <Route path="/communications-settings" element={<ProtectedRoute allowedRoles={['admin','manager']}><CommunicationSettings /></ProtectedRoute>} />
            <Route path="/payroll"                 element={<ProtectedRoute allowedRoles={['admin','manager']}><Payroll /></ProtectedRoute>} />
            <Route path="/reports"                 element={<ProtectedRoute allowedRoles={['admin']}><Reports /></ProtectedRoute>} />
            <Route path="/audit-log"               element={<ProtectedRoute allowedRoles={['admin']}><AuditLog /></ProtectedRoute>} />
            {/* Day 32: GPS / Live Fleet */}
            <Route path="/fleet"                   element={<ProtectedRoute allowedRoles={['admin','manager']}><Fleet /></ProtectedRoute>} />
            <Route path="/fleet/settings"          element={<ProtectedRoute allowedRoles={['admin']}><FleetSettings /></ProtectedRoute>} />
            {/* Day 33: GPS History + Route Replay */}
            <Route path="/gps-history"        element={<ProtectedRoute allowedRoles={['admin','manager']}><GpsHistory /></ProtectedRoute>} />
            <Route path="/gps-history/replay" element={<ProtectedRoute allowedRoles={['admin','manager']}><RouteReplay /></ProtectedRoute>} />
            {/* Day 36: Fleet Analytics */}
            <Route path="/fleet-analytics"    element={<ProtectedRoute allowedRoles={['admin','manager']}><FleetAnalyticsProvider><FleetAnalytics /></FleetAnalyticsProvider></ProtectedRoute>} />
            <Route path="/admin/database-status" element={<ProtectedRoute allowedRoles={['admin']}><DatabaseStatus /></ProtectedRoute>} />
            <Route path="/admin/users"           element={<ProtectedRoute allowedRoles={['admin','manager']}><UserManagement /></ProtectedRoute>} />
            <Route path="/admin/roles"           element={<ProtectedRoute allowedRoles={['admin']}><RoleManager /></ProtectedRoute>} />
            <Route path="/admin/health"          element={<ProtectedRoute allowedRoles={['admin']}><SystemHealth /></ProtectedRoute>} />
            <Route path="/admin/backup"          element={<ProtectedRoute allowedRoles={['admin']}><BackupManager /></ProtectedRoute>} />
            <Route path="/admin/security"        element={<ProtectedRoute allowedRoles={['admin']}><SecuritySettings /></ProtectedRoute>} />

            {/* Driver — Fix 2: no /attendance route for drivers */}
            <Route path="/driver"          element={<DriverShell><DriverDashboard /></DriverShell>} />
            <Route path="/assigned-trips"  element={<DriverShell><AssignedTrips /></DriverShell>}   />
            <Route path="/ride-history"    element={<DriverShell><RideHistory /></DriverShell>}     />
            <Route path="/driver-profile"  element={<DriverShell><DriverProfile /></DriverShell>}   />
            <Route path="/live-location"   element={<DriverShell><LiveLocation /></DriverShell>}    />
            <Route path="/payslips"       element={<DriverShell><Payroll /></DriverShell>}          />

            {/* Legacy */}
            <Route path="/my-trips" element={<Navigate to="/driver" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </AdminProvider>
        </CommunicationProvider>
      </AuthProvider>
    </AppProvider>
    </ErrorBoundary>
  )
}

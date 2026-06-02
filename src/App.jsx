import { Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider }            from './context/AppContext'
import { AuthProvider }           from './context/AuthContext'
import { RideLifecycleProvider }  from './context/RideLifecycleContext'
import AppShell                   from './components/layout/AppShell'
import ProtectedRoute             from './components/auth/ProtectedRoute'

// Public
import Login            from './pages/Login'
import Unauthorized     from './pages/Unauthorized'

// Admin + Manager
import Dashboard        from './pages/Dashboard'
import Invoices         from './pages/Invoices'
import Trips            from './pages/Trips'
import CreateTrip       from './pages/CreateTrip'
import Customers        from './pages/Customers'
import Expenses         from './pages/Expenses'
import Drivers          from './pages/Drivers'
import Vehicles         from './pages/Vehicles'
import Settings         from './pages/Settings'

// Driver
import DriverDashboard  from './pages/driver/DriverDashboard'
import AssignedTrips    from './pages/driver/AssignedTrips'
import RideHistory      from './pages/driver/RideHistory'
import DriverProfile    from './pages/driver/DriverProfile'
import LiveLocation     from './pages/driver/LiveLocation'

// ── Driver shell — wraps all driver routes with lifecycle context ──
function DriverShell({ children }) {
  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <RideLifecycleProvider>
        {children}
      </RideLifecycleProvider>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AuthProvider>
        <Routes>

          {/* ── Public ──────────────────────────────────── */}
          <Route path="/login"        element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* ── Protected shell ─────────────────────────── */}
          <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>

            {/* Admin + Manager */}
            <Route path="/"            element={<ProtectedRoute allowedRoles={['admin','manager']}><Dashboard /></ProtectedRoute>} />
            <Route path="/invoices"    element={<ProtectedRoute allowedRoles={['admin','manager']}><Invoices /></ProtectedRoute>} />
            <Route path="/trips"       element={<ProtectedRoute allowedRoles={['admin','manager']}><Trips /></ProtectedRoute>} />
            <Route path="/create-trip" element={<ProtectedRoute allowedRoles={['admin','manager']}><CreateTrip /></ProtectedRoute>} />
            <Route path="/customers"   element={<ProtectedRoute allowedRoles={['admin','manager']}><Customers /></ProtectedRoute>} />
            <Route path="/expenses"    element={<ProtectedRoute allowedRoles={['admin','manager']}><Expenses /></ProtectedRoute>} />
            <Route path="/drivers"     element={<ProtectedRoute allowedRoles={['admin','manager']}><Drivers /></ProtectedRoute>} />
            <Route path="/vehicles"    element={<ProtectedRoute allowedRoles={['admin','manager']}><Vehicles /></ProtectedRoute>} />
            <Route path="/settings"    element={<ProtectedRoute allowedRoles={['admin']}><Settings /></ProtectedRoute>} />

            {/* ── Driver — all share one RideLifecycleProvider ── */}
            <Route path="/driver"          element={<DriverShell><DriverDashboard /></DriverShell>} />
            <Route path="/assigned-trips"  element={<DriverShell><AssignedTrips /></DriverShell>} />
            <Route path="/ride-history"    element={<DriverShell><RideHistory /></DriverShell>} />
            <Route path="/driver-profile"  element={<DriverShell><DriverProfile /></DriverShell>} />
            <Route path="/live-location"   element={<DriverShell><LiveLocation /></DriverShell>} />

            {/* Legacy */}
            <Route path="/my-trips" element={<Navigate to="/driver" replace />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </AppProvider>
  )
}

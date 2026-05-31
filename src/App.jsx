import { Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider }    from './context/AppContext'
import { AuthProvider }   from './context/AuthContext'
import AppShell           from './components/layout/AppShell'
import ProtectedRoute     from './components/auth/ProtectedRoute'

// ── Public pages ─────────────────────────────────────────────
import Login              from './pages/Login'
import Unauthorized       from './pages/Unauthorized'

// ── Admin + Manager pages ────────────────────────────────────
import Dashboard          from './pages/Dashboard'
import Invoices           from './pages/Invoices'
import Trips              from './pages/Trips'
import CreateTrip         from './pages/CreateTrip'
import Customers          from './pages/Customers'
import Expenses           from './pages/Expenses'
import Drivers            from './pages/Drivers'
import Vehicles           from './pages/Vehicles'
import Settings           from './pages/Settings'

// ── Driver pages ─────────────────────────────────────────────
import DriverDashboard    from './pages/driver/DriverDashboard'
import AssignedTrips      from './pages/driver/AssignedTrips'
import RideHistory        from './pages/driver/RideHistory'
import DriverProfile      from './pages/driver/DriverProfile'

export default function App() {
  return (
    <AppProvider>
      <AuthProvider>
        <Routes>

          {/* ── Public ─────────────────────────────────── */}
          <Route path="/login"        element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* ── Protected shell ────────────────────────── */}
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            {/* Admin + Manager */}
            <Route path="/"             element={<ProtectedRoute allowedRoles={['admin','manager']}><Dashboard /></ProtectedRoute>} />
            <Route path="/invoices"     element={<ProtectedRoute allowedRoles={['admin','manager']}><Invoices /></ProtectedRoute>} />
            <Route path="/trips"        element={<ProtectedRoute allowedRoles={['admin','manager']}><Trips /></ProtectedRoute>} />
            <Route path="/create-trip"  element={<ProtectedRoute allowedRoles={['admin','manager']}><CreateTrip /></ProtectedRoute>} />
            <Route path="/customers"    element={<ProtectedRoute allowedRoles={['admin','manager']}><Customers /></ProtectedRoute>} />
            <Route path="/expenses"     element={<ProtectedRoute allowedRoles={['admin','manager']}><Expenses /></ProtectedRoute>} />
            <Route path="/drivers"      element={<ProtectedRoute allowedRoles={['admin','manager']}><Drivers /></ProtectedRoute>} />
            <Route path="/vehicles"     element={<ProtectedRoute allowedRoles={['admin','manager']}><Vehicles /></ProtectedRoute>} />

            {/* Admin only */}
            <Route path="/settings"     element={<ProtectedRoute allowedRoles={['admin']}><Settings /></ProtectedRoute>} />

            {/* Driver */}
            <Route path="/driver"          element={<ProtectedRoute allowedRoles={['driver']}><DriverDashboard /></ProtectedRoute>} />
            <Route path="/assigned-trips"  element={<ProtectedRoute allowedRoles={['driver']}><AssignedTrips /></ProtectedRoute>} />
            <Route path="/ride-history"    element={<ProtectedRoute allowedRoles={['driver']}><RideHistory /></ProtectedRoute>} />
            <Route path="/driver-profile"  element={<ProtectedRoute allowedRoles={['driver']}><DriverProfile /></ProtectedRoute>} />

            {/* Legacy redirect */}
            <Route path="/my-trips"     element={<Navigate to="/driver" replace />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </AuthProvider>
    </AppProvider>
  )
}

import { Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider }       from './context/AppContext'
import { AuthProvider }      from './context/AuthContext'
import AppShell              from './components/layout/AppShell'
import ProtectedRoute        from './components/auth/ProtectedRoute'
import Login                 from './pages/Login'
import Unauthorized          from './pages/Unauthorized'
import Dashboard             from './pages/Dashboard'
import Invoices              from './pages/Invoices'
import Customers             from './pages/Customers'
import Expenses              from './pages/Expenses'
import Drivers               from './pages/Drivers'
import Vehicles              from './pages/Vehicles'
import Settings              from './pages/Settings'
import DriverTrips           from './pages/DriverTrips'

export default function App() {
  return (
    <AppProvider>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login"        element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Protected shell — all authenticated users can reach this */}
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            {/* Admin + Manager */}
            <Route
              path="/"
              element={
                <ProtectedRoute allowedRoles={['admin', 'manager']}>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/invoices"
              element={
                <ProtectedRoute allowedRoles={['admin', 'manager']}>
                  <Invoices />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers"
              element={
                <ProtectedRoute allowedRoles={['admin', 'manager']}>
                  <Customers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/expenses"
              element={
                <ProtectedRoute allowedRoles={['admin', 'manager']}>
                  <Expenses />
                </ProtectedRoute>
              }
            />
            <Route
              path="/drivers"
              element={
                <ProtectedRoute allowedRoles={['admin', 'manager']}>
                  <Drivers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/vehicles"
              element={
                <ProtectedRoute allowedRoles={['admin', 'manager']}>
                  <Vehicles />
                </ProtectedRoute>
              }
            />

            {/* Admin only */}
            <Route
              path="/settings"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Settings />
                </ProtectedRoute>
              }
            />

            {/* Driver only */}
            <Route
              path="/my-trips"
              element={
                <ProtectedRoute allowedRoles={['driver']}>
                  <DriverTrips />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </AppProvider>
  )
}
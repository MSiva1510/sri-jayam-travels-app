// ─── Auth Context ─────────────────────────────────────────────
// Single source of truth: Supabase auth.users + public.profiles
// No MOCK_USERS. No localStorage fallback. No hardcoded credentials.

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { autoCheckIn, autoCheckOut } from '../data/attendanceData'
import { authRepository }            from '../repositories/authRepository'

// ── Role permission matrix ─────────────────────────────────────
export const ROLE_PERMISSIONS = {
  admin: {
    trips: true, vehicles: true, customers: true, expenses: true, invoices: true,
    reports: true, settings: true, drivers: true, attendance: true, userManagement: true,
    revenueDashboard: true, profitReports: true, financialAnalytics: true,
    expenseReports: true, invoiceManagement: true,
  },
  manager: {
    trips: true, vehicles: true, customers: true, expenses: true, invoices: false,
    reports: false, settings: false, drivers: true, attendance: true, userManagement: false,
    revenueDashboard: false, profitReports: false, financialAnalytics: false,
    expenseReports: false, invoiceManagement: false,
  },
  driver: {
    trips: false, vehicles: false, customers: false, expenses: false,
    invoices: false, reports: false, settings: false, drivers: false,
    attendance: false, userManagement: false,
    revenueDashboard: false, profitReports: false, financialAnalytics: false,
    expenseReports: false, invoiceManagement: false,
    viewOwnPayslips: true, viewOwnEarnings: true,
    viewPayrollDashboard: false, viewExpenseAnalytics: false,
  },
}

export const ROLE_ROUTES = {
  admin:   ['/', '/invoices', '/customers', '/expenses', '/drivers', '/vehicles',
             '/settings', '/trips', '/create-trip', '/attendance', '/profile',
             '/payroll', '/reports', '/admin/database-status', '/admin/users'],
  manager: ['/', '/customers', '/expenses', '/drivers', '/vehicles', '/trips',
             '/create-trip', '/attendance', '/profile', '/payroll'],
  driver:  ['/driver', '/assigned-trips', '/ride-history', '/driver-profile',
             '/live-location', '/payslips'],
}

export const ROLE_LABELS = { admin: 'Administrator', manager: 'Manager', driver: 'Driver' }

export const ROLE_COLORS = {
  admin:   { bg: 'bg-violet-100 dark:bg-violet-900/40', text: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-500' },
  manager: { bg: 'bg-blue-100 dark:bg-blue-900/40',     text: 'text-blue-700 dark:text-blue-300',     dot: 'bg-blue-500'   },
  driver:  { bg: 'bg-teal-100 dark:bg-teal-900/40',     text: 'text-teal-700 dark:text-teal-300',     dot: 'bg-teal-500'   },
}

// ── Map public.profiles row → app user object ──────────────────
function profileToUser(authUser, profile) {
  if (!profile) return null
  return {
    id:         profile.id,
    email:      profile.email || authUser?.email || '',
    name:       profile.full_name,
    role:       profile.role,
    phone:      profile.phone  || '',
    avatar_url: profile.avatar_url || null,
    status:     profile.status || 'active',
    lastLogin:  new Date().toISOString(),
  }
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [initialized, setInitialized] = useState(false)
  const [user,        setUser]        = useState(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [loginError,  setLoginError]  = useState('')

  // ── Listen to Supabase auth state changes ─────────────────
  // This fires on: page load (session restore), sign in, sign out, token refresh
  useEffect(() => {
    const unsubscribe = authRepository.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          const profile = await authRepository.getProfile(session.user.id)
          if (profile && profile.status === 'active') {
            setUser(profileToUser(session.user, profile))
          } else if (!profile) {
            // Profile missing — show error, do not auto-create
            console.warn('[AuthContext] No profile found for', session.user.email)
            setUser(null)
            setLoginError('User profile not found. Please contact Administrator.')
          } else {
            // Account deactivated
            await authRepository.signOut()
            setUser(null)
            setLoginError('Your account has been deactivated. Contact Administrator.')
          }
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
      } else if (event === 'INITIAL_SESSION') {
        // Supabase fires this on first load with existing session
        if (session?.user) {
          const profile = await authRepository.getProfile(session.user.id)
          if (profile && profile.status === 'active') {
            setUser(profileToUser(session.user, profile))
          } else {
            setUser(null)
          }
        } else {
          setUser(null)
        }
        setInitialized(true)
      }

      if (event !== 'INITIAL_SESSION') {
        setInitialized(true)
      }
    })

    return unsubscribe
  }, [])

  // ── Login ────────────────────────────────────────────────
  const login = useCallback(async ({ email, password }) => {
    setAuthLoading(true)
    setLoginError('')

    try {
      const { user: authUser } = await authRepository.signIn({ email, password })

      // Fetch profile from public.profiles
      const profile = await authRepository.getProfile(authUser.id)

      if (!profile) {
        await authRepository.signOut()
        setLoginError('User profile not found. Please contact Administrator.')
        setAuthLoading(false)
        return false
      }

      if (profile.status !== 'active') {
        await authRepository.signOut()
        setLoginError('Your account has been deactivated. Contact Administrator.')
        setAuthLoading(false)
        return false
      }

      // Auto check-in for drivers (non-blocking — don't hold up login)
      if (profile.role === 'driver') {
        autoCheckIn(profile.full_name, '').catch(err =>
          console.error('[AuthContext] auto check-in failed:', err))
      }

      const sessionUser = profileToUser(authUser, profile)
      setUser(sessionUser)
      setAuthLoading(false)
      return true

    } catch (err) {
      console.error('[AuthContext] login error:', err)
      const msg = err.message?.includes('Invalid login credentials')
        ? 'Invalid email or password.'
        : err.message?.includes('Email not confirmed')
        ? 'Email not confirmed. Check your inbox or contact Administrator.'
        : 'Login failed. Please try again.'
      setLoginError(msg)
      setAuthLoading(false)
      return false
    }
  }, [])

  // ── Logout ────────────────────────────────────────────────
  const logout = useCallback(async () => {
    if (user?.role === 'driver') {
      autoCheckOut(user.name).catch(err =>
        console.error('[AuthContext] auto check-out failed:', err))
    }
    try {
      await authRepository.signOut()
    } catch (err) {
      console.error('[AuthContext] logout error:', err)
    }
    setUser(null)
  }, [user])

  // ── Password reset ─────────────────────────────────────────
  const sendPasswordReset = useCallback(async (email) => {
    await authRepository.sendPasswordReset(email)
  }, [])

  // ── Permission helper ─────────────────────────────────────
  const can = useCallback((permission) => {
    if (!user) return false
    return ROLE_PERMISSIONS[user.role]?.[permission] ?? false
  }, [user])

  const isAdmin   = user?.role === 'admin'
  const isManager = user?.role === 'manager'
  const isDriver  = user?.role === 'driver'

  return (
    <AuthContext.Provider value={{
      user, initialized, authLoading, loginError, setLoginError,
      login, logout, sendPasswordReset, can,
      isAdmin, isManager, isDriver,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
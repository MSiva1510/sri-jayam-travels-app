// ─── Auth Context ─────────────────────────────────────────────
// Single source of truth: Supabase auth.users + public.profiles
// Day 31: integrated with PermissionEngine + SessionManager

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { autoCheckIn, autoCheckOut } from '../data/attendanceData'
import { authRepository }            from '../repositories/authRepository'
import { permissionEngine, bootPermissions } from '../security/PermissionEngine'
import { sessionManager }            from '../security/SessionManager'
import { addAuditEvent }             from '../data/auditLogData'

// ── Legacy module permission matrix (backward compat) ─────────
export const ROLE_PERMISSIONS = {
  admin: {
    trips:true, vehicles:true, customers:true, expenses:true, invoices:true,
    reports:true, settings:true, drivers:true, attendance:true, userManagement:true,
    revenueDashboard:true, profitReports:true, financialAnalytics:true,
    expenseReports:true, invoiceManagement:true,
  },
  manager: {
    trips:true, vehicles:true, customers:true, expenses:true, invoices:false,
    reports:false, settings:false, drivers:true, attendance:true, userManagement:false,
    revenueDashboard:false, profitReports:false, financialAnalytics:false,
    expenseReports:false, invoiceManagement:false,
  },
  driver: {
    trips:false, vehicles:false, customers:false, expenses:false,
    invoices:false, reports:false, settings:false, drivers:false,
    attendance:false, userManagement:false,
    revenueDashboard:false, profitReports:false, financialAnalytics:false,
    expenseReports:false, invoiceManagement:false,
    viewOwnPayslips:true, viewOwnEarnings:true,
    viewPayrollDashboard:false, viewExpenseAnalytics:false,
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

export const ROLE_LABELS = { admin:'Administrator', manager:'Manager', driver:'Driver' }

export const ROLE_COLORS = {
  admin:   { bg:'bg-violet-100 dark:bg-violet-900/40', text:'text-violet-700 dark:text-violet-300', dot:'bg-violet-500' },
  manager: { bg:'bg-blue-100 dark:bg-blue-900/40',     text:'text-blue-700 dark:text-blue-300',     dot:'bg-blue-500'   },
  driver:  { bg:'bg-teal-100 dark:bg-teal-900/40',     text:'text-teal-700 dark:text-teal-300',     dot:'bg-teal-500'   },
}

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

  // Boot permission engine on mount
  useEffect(() => { bootPermissions() }, [])

  // Set session timeout handler
  useEffect(() => {
    sessionManager.onTimeout(() => {
      logout()
      window.location.href = '/login?reason=timeout'
    })
  }, [])

  useEffect(() => {
    const unsubscribe = authRepository.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          const profile = await authRepository.getProfile(session.user.id)
          if (profile && profile.status === 'active') {
            const u = profileToUser(session.user, profile)
            setUser(u)
          } else if (!profile) {
            setUser(null)
            setLoginError('User profile not found. Please contact Administrator.')
          } else {
            await authRepository.signOut()
            setUser(null)
            setLoginError('Your account has been deactivated. Contact Administrator.')
          }
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
      } else if (event === 'INITIAL_SESSION') {
        if (session?.user) {
          const profile = await authRepository.getProfile(session.user.id)
          if (profile && profile.status === 'active') {
            const u = profileToUser(session.user, profile)
            setUser(u)
            sessionManager.start(u)
          } else {
            setUser(null)
          }
        } else {
          setUser(null)
        }
        setInitialized(true)
      }
      if (event !== 'INITIAL_SESSION') setInitialized(true)
    })
    return unsubscribe
  }, [])

  const login = useCallback(async ({ email, password }) => {
    setAuthLoading(true)
    setLoginError('')
    try {
      const { user: authUser } = await authRepository.signIn({ email, password })
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
      if (profile.role === 'driver') {
        autoCheckIn(profile.full_name, '').catch(() => {})
      }
      const sessionUser = profileToUser(authUser, profile)
      setUser(sessionUser)
      // Start session tracking
      sessionManager.start(sessionUser)
      // Audit log
      addAuditEvent('USER_LOGIN', {
        description: `${profile.full_name} (${profile.role}) logged in`,
        module: 'security', severity: 'info',
      })
      setAuthLoading(false)
      return true
    } catch (err) {
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

  const logout = useCallback(async () => {
    if (user?.role === 'driver') {
      autoCheckOut(user.name).catch(() => {})
    }
    addAuditEvent('USER_LOGOUT', {
      description: `${user?.name || 'Unknown'} logged out`,
      module: 'security', severity: 'info',
    })
    sessionManager.end('logout')
    try { await authRepository.signOut() } catch {}
    setUser(null)
  }, [user])

  const sendPasswordReset = useCallback(async (email) => {
    await authRepository.sendPasswordReset(email)
  }, [])

  // Granular permission check via PermissionEngine
  const can = useCallback((permission) => {
    if (!user) return false
    // Try new granular engine first
    const granular = permissionEngine.can(user.role, permission)
    // Fall back to legacy module matrix
    if (granular === false && ROLE_PERMISSIONS[user.role]?.[permission] !== undefined) {
      return ROLE_PERMISSIONS[user.role][permission]
    }
    return granular
  }, [user])

  // Check granular named permission
  const canDo = useCallback((namedPermission) => {
    if (!user) return false
    return permissionEngine.can(user.role, namedPermission)
  }, [user])

  const isAdmin   = user?.role === 'admin'
  const isManager = user?.role === 'manager'
  const isDriver  = user?.role === 'driver'

  return (
    <AuthContext.Provider value={{
      user, initialized, authLoading, loginError, setLoginError,
      login, logout, sendPasswordReset,
      can, canDo,
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

// ── Role permission matrix ─────────────────────────────────────

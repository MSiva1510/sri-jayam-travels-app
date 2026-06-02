import { createContext, useContext, useState, useEffect, useCallback } from 'react'

export const MOCK_USERS = [
  { id:1, name:'Arjun Sharma',    email:'admin@srijayamtravels.in',    username:'admin',        password:'admin123',   role:'admin',   phone:'+91 94423 37470', joined:'Jan 2022' },
  { id:2, name:'Kavitha Rajan',   email:'manager@srijayamtravels.in',  username:'manager',      password:'manager123', role:'manager', phone:'+91 98765 43210', joined:'Mar 2022' },
  { id:3, name:'Ramanan',         email:'ramanan@srijayamtravels.in',  username:'ramanan',      password:'driver123',  role:'driver',  phone:'8754914315', vehicle:'PY01CY1255', vehicleType:'4+1 Sedan', joined:'Jan 2022' },
  { id:4, name:'Babu',            email:'babu@srijayamtravels.in',     username:'babu',         password:'driver123',  role:'driver',  phone:'9894403206', vehicle:'PY01DF1255', vehicleType:'4+1 Sedan', joined:'Mar 2021' },
  { id:5, name:'Rajasekharan',    email:'raja@srijayamtravels.in',     username:'rajasekharan', password:'driver123',  role:'driver',  phone:'6383401383', vehicle:'PY01VF1255', vehicleType:'7+1 SUV',   joined:'Sep 2022' },
]

// ── Fix 3: Explicit permission matrix per role ─────────────────
// true = can access, false = blocked
export const ROLE_PERMISSIONS = {
  admin: {
    trips:              true,
    vehicles:           true,
    customers:          true,
    expenses:           true,
    invoices:           true,
    reports:            true,
    settings:           true,
    drivers:            true,
    attendance:         true,
    // Financial sections
    revenueDashboard:   true,
    profitReports:      true,
    financialAnalytics: true,
    expenseReports:     true,
    invoiceManagement:  true,
  },
  manager: {
    trips:              true,
    vehicles:           true,
    customers:          true,
    expenses:           true,    // view only — no financial analytics
    invoices:           false,   // cannot manage invoices
    reports:            false,   // no financial reports
    settings:           false,
    drivers:            true,
    attendance:         true,    // can view all driver attendance
    // Financial sections — BLOCKED for manager
    revenueDashboard:   false,
    profitReports:      false,
    financialAnalytics: false,
    expenseReports:     false,
    invoiceManagement:  false,
  },
  driver: {
    trips:              false,
    vehicles:           false,
    customers:          false,
    expenses:           false,
    invoices:           false,
    reports:            false,
    settings:           false,
    drivers:            false,
    attendance:         true,    // own attendance only
    // Financial — all blocked
    revenueDashboard:   false,
    profitReports:      false,
    financialAnalytics: false,
    expenseReports:     false,
    invoiceManagement:  false,
  },
}

export const ROLE_ROUTES = {
  admin:   ['/', '/invoices', '/customers', '/expenses', '/drivers', '/vehicles', '/settings', '/trips', '/create-trip', '/attendance', '/profile'],
  manager: ['/', '/customers', '/expenses', '/drivers', '/vehicles', '/trips', '/create-trip', '/attendance', '/profile'],
  driver:  ['/driver', '/assigned-trips', '/ride-history', '/driver-profile', '/live-location', '/attendance'],
}

export const ROLE_LABELS = { admin:'Administrator', manager:'Manager', driver:'Driver' }

export const ROLE_COLORS = {
  admin:   { bg:'bg-violet-100 dark:bg-violet-900/40', text:'text-violet-700 dark:text-violet-300', dot:'bg-violet-500' },
  manager: { bg:'bg-blue-100 dark:bg-blue-900/40',     text:'text-blue-700 dark:text-blue-300',     dot:'bg-blue-500'   },
  driver:  { bg:'bg-teal-100 dark:bg-teal-900/40',     text:'text-teal-700 dark:text-teal-300',     dot:'bg-teal-500'   },
}

const SESSION_KEY = 'sjt_auth_session'

function readStorage() {
  try { const ss = sessionStorage.getItem(SESSION_KEY); if (ss) return JSON.parse(ss) } catch {}
  try { const ls = localStorage.getItem(SESSION_KEY);   if (ls) return JSON.parse(ls) } catch {}
  return null
}
function writeSession(user)    { try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(user)) } catch {} }
function writePersistent(user) { try { localStorage.setItem(SESSION_KEY, JSON.stringify(user))   } catch {} }
function clearAllStorage()     { try { sessionStorage.removeItem(SESSION_KEY) } catch {}; try { localStorage.removeItem(SESSION_KEY) } catch {} }

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [initialized, setInitialized] = useState(false)
  const [user,        setUser]        = useState(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [loginError,  setLoginError]  = useState('')

  useEffect(() => {
    const stored = readStorage()
    if (stored?.id && stored?.role) {
      const live = MOCK_USERS.find(u => u.id === stored.id)
      if (live) {
        const { password: _p, ...safe } = live
        const restored = { ...safe, lastLogin: stored.lastLogin }
        setUser(restored)
        writeSession(restored)
      } else { clearAllStorage() }
    }
    setInitialized(true)
  }, [])

  const login = useCallback(async ({ username, password, remember }) => {
    setAuthLoading(true)
    setLoginError('')
    await new Promise(r => setTimeout(r, 700))
    const found = MOCK_USERS.find(
      u => (u.username === username.trim().toLowerCase() || u.email === username.trim().toLowerCase()) && u.password === password
    )
    if (!found) { setLoginError('Invalid username or password.'); setAuthLoading(false); return false }
    const { password: _p, ...safeUser } = found
    const sessionUser = { ...safeUser, lastLogin: new Date().toISOString() }
    setUser(sessionUser)
    writeSession(sessionUser)
    if (remember) writePersistent(sessionUser)
    setAuthLoading(false)
    return true
  }, [])

  const logout = useCallback(() => { setUser(null); clearAllStorage() }, [])

  // ── Permission helper ──────────────────────────────────────
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
      login, logout, can,
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

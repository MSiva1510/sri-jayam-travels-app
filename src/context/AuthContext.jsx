import { createContext, useContext, useState, useEffect, useCallback } from 'react'

// ─────────────────────────────────────────────────────────────
//  Mock user database
// ─────────────────────────────────────────────────────────────
export const MOCK_USERS = [
  {
    id: 1, name: 'Arjun Sharma',
    email: 'admin@srijayamtravels.in', username: 'admin', password: 'admin123',
    role: 'admin', phone: '+91 94423 37470', joined: 'Jan 2022',
  },
  {
    id: 2, name: 'Kavitha Rajan',
    email: 'manager@srijayamtravels.in', username: 'manager', password: 'manager123',
    role: 'manager', phone: '+91 98765 43210', joined: 'Mar 2022',
  },
  {
    id: 3, name: 'Ramanan',
    email: 'ramanan@srijayamtravels.in', username: 'ramanan', password: 'driver123',
    role: 'driver', phone: '8754914315', vehicle: 'PY01CY1255', vehicleType: '4+1 Sedan', joined: 'Jan 2022',
  },
  {
    id: 4, name: 'Babu',
    email: 'babu@srijayamtravels.in', username: 'babu', password: 'driver123',
    role: 'driver', phone: '9894403206', vehicle: 'PY01DF1255', vehicleType: '4+1 Sedan', joined: 'Mar 2021',
  },
  {
    id: 5, name: 'Rajasekharan',
    email: 'raja@srijayamtravels.in', username: 'rajasekharan', password: 'driver123',
    role: 'driver', phone: '6383401383', vehicle: 'PY01VF1255', vehicleType: '7+1 SUV', joined: 'Sep 2022',
  },
]

// ─────────────────────────────────────────────────────────────
//  Role → allowed route prefixes
// ─────────────────────────────────────────────────────────────
export const ROLE_ROUTES = {
  admin:   ['/', '/invoices', '/customers', '/expenses', '/drivers', '/vehicles', '/settings', '/trips', '/create-trip'],
  manager: ['/', '/invoices', '/customers', '/expenses', '/drivers', '/vehicles', '/trips', '/create-trip'],
  driver:  ['/driver', '/assigned-trips', '/ride-history', '/driver-profile', '/live-location'],
}

export const ROLE_LABELS = {
  admin:   'Administrator',
  manager: 'Manager',
  driver:  'Driver',
}

export const ROLE_COLORS = {
  admin:   { bg: 'bg-violet-100 dark:bg-violet-900/40', text: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-500' },
  manager: { bg: 'bg-blue-100 dark:bg-blue-900/40',     text: 'text-blue-700 dark:text-blue-300',     dot: 'bg-blue-500'   },
  driver:  { bg: 'bg-teal-100 dark:bg-teal-900/40',     text: 'text-teal-700 dark:text-teal-300',     dot: 'bg-teal-500'   },
}

// ─────────────────────────────────────────────────────────────
//  Storage helpers
// ─────────────────────────────────────────────────────────────
const SESSION_KEY = 'sjt_auth_session'

function readStorage() {
  // Try sessionStorage first (same-tab persistence), then localStorage (remember-me)
  try {
    const ss = sessionStorage.getItem(SESSION_KEY)
    if (ss) return JSON.parse(ss)
  } catch {}
  try {
    const ls = localStorage.getItem(SESSION_KEY)
    if (ls) return JSON.parse(ls)
  } catch {}
  return null
}

function writeSession(user) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(user)) } catch {}
}

function writePersistent(user) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(user)) } catch {}
}

function clearAllStorage() {
  try { sessionStorage.removeItem(SESSION_KEY) } catch {}
  try { localStorage.removeItem(SESSION_KEY)   } catch {}
}

// ─────────────────────────────────────────────────────────────
//  Context
// ─────────────────────────────────────────────────────────────
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // `initialized` = true once we've attempted to restore session from storage.
  // ProtectedRoute must NOT redirect until this is true.
  const [initialized, setInitialized] = useState(false)
  const [user,        setUser]        = useState(null)
  const [authLoading, setAuthLoading] = useState(false)   // login spinner
  const [loginError,  setLoginError]  = useState('')

  // ── Restore session on mount (runs once, synchronously-ish) ──
  useEffect(() => {
    const stored = readStorage()
    if (stored && stored.id && stored.role) {
      // Cross-check against MOCK_USERS to ensure user still valid
      const live = MOCK_USERS.find(u => u.id === stored.id)
      if (live) {
        const { password: _p, ...safe } = live
        const restored = { ...safe, lastLogin: stored.lastLogin }
        setUser(restored)
        writeSession(restored)   // keep sessionStorage fresh
      } else {
        // User no longer in database — clear stale token
        clearAllStorage()
      }
    }
    setInitialized(true)   // always mark done, even if no session found
  }, [])

  // ── Login ─────────────────────────────────────────────────
  const login = useCallback(async ({ username, password, remember }) => {
    setAuthLoading(true)
    setLoginError('')

    await new Promise(r => setTimeout(r, 700))   // simulate network

    const found = MOCK_USERS.find(
      u => (u.username === username.trim().toLowerCase() ||
            u.email    === username.trim().toLowerCase()) &&
           u.password  === password
    )

    if (!found) {
      setLoginError('Invalid username or password. Please try again.')
      setAuthLoading(false)
      return false
    }

    const { password: _p, ...safeUser } = found
    const sessionUser = { ...safeUser, lastLogin: new Date().toISOString() }

    setUser(sessionUser)
    writeSession(sessionUser)
    if (remember) writePersistent(sessionUser)

    setAuthLoading(false)
    return true
  }, [])

  // ── Logout ────────────────────────────────────────────────
  const logout = useCallback(() => {
    setUser(null)
    clearAllStorage()
  }, [])

  // ── Helpers ───────────────────────────────────────────────
  const isAdmin   = user?.role === 'admin'
  const isManager = user?.role === 'manager'
  const isDriver  = user?.role === 'driver'

  return (
    <AuthContext.Provider value={{
      user, initialized, authLoading, loginError, setLoginError,
      login, logout,
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

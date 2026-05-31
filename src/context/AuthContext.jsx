import { createContext, useContext, useState, useEffect, useCallback } from 'react'

// ─────────────────────────────────────────────────────────────
//  Mock user database
// ─────────────────────────────────────────────────────────────
export const MOCK_USERS = [
  {
    id: 1,
    name: 'Arjun Sharma',
    email: 'admin@srijayamtravels.in',
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    avatar: null,
    phone: '+91 94423 37470',
    joined: 'Jan 2022',
    lastLogin: null,
  },
  {
    id: 2,
    name: 'Kavitha Rajan',
    email: 'manager@srijayamtravels.in',
    username: 'manager',
    password: 'manager123',
    role: 'manager',
    avatar: null,
    phone: '+91 98765 43210',
    joined: 'Mar 2022',
    lastLogin: null,
  },
  {
    id: 3,
    name: 'Ramanan',
    email: 'ramanan@srijayamtravels.in',
    username: 'ramanan',
    password: 'driver123',
    role: 'driver',
    avatar: null,
    phone: '8754914315',
    vehicle: 'PY01CY1255',
    vehicleType: '4+1 Sedan',
    joined: 'Jan 2022',
    lastLogin: null,
  },
  {
    id: 4,
    name: 'Babu',
    email: 'babu@srijayamtravels.in',
    username: 'babu',
    password: 'driver123',
    role: 'driver',
    avatar: null,
    phone: '9894403206',
    vehicle: 'PY01DF1255',
    vehicleType: '4+1 Sedan',
    joined: 'Mar 2021',
    lastLogin: null,
  },
  {
    id: 5,
    name: 'Rajasekharan',
    email: 'raja@srijayamtravels.in',
    username: 'rajasekharan',
    password: 'driver123',
    role: 'driver',
    avatar: null,
    phone: '6383401383',
    vehicle: 'PY01VF1255',
    vehicleType: '7+1 SUV',
    joined: 'Sep 2022',
    lastLogin: null,
  },
]

// ─────────────────────────────────────────────────────────────
//  Role → allowed routes map
// ─────────────────────────────────────────────────────────────
export const ROLE_ROUTES = {
  admin: ['/', '/invoices', '/customers', '/expenses', '/drivers', '/vehicles', '/settings'],
  manager: ['/', '/invoices', '/customers', '/expenses', '/drivers', '/vehicles'],
  driver: ['/driver', '/assigned-trips', '/ride-history', '/driver-profile'],
}

export const ROLE_LABELS = {
  admin: 'Administrator',
  manager: 'Manager',
  driver: 'Driver',
}

export const ROLE_COLORS = {
  admin:   { bg: 'bg-violet-100 dark:bg-violet-900/40', text: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-500' },
  manager: { bg: 'bg-blue-100 dark:bg-blue-900/40',     text: 'text-blue-700 dark:text-blue-300',     dot: 'bg-blue-500'   },
  driver:  { bg: 'bg-teal-100 dark:bg-teal-900/40',     text: 'text-teal-700 dark:text-teal-300',     dot: 'bg-teal-500'   },
}

// ─────────────────────────────────────────────────────────────
//  Session helpers  (sessionStorage — clears on tab close)
// ─────────────────────────────────────────────────────────────
const SESSION_KEY = 'sjt_auth_session'

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // strip password before returning
    const { password: _p, ...safe } = parsed
    return safe
  } catch {
    return null
  }
}

function saveSession(user) {
  try {
    const { password: _p, ...safe } = user
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(safe))
  } catch {}
}

function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY) } catch {}
}

// ─────────────────────────────────────────────────────────────
//  Context
// ─────────────────────────────────────────────────────────────
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,        setUser]        = useState(() => loadSession())
  const [loading,     setLoading]     = useState(false)
  const [loginError,  setLoginError]  = useState('')

  // ── Login ────────────────────────────────────────────────
  const login = useCallback(async ({ username, password, remember }) => {
    setLoading(true)
    setLoginError('')

    // Simulate network delay
    await new Promise(r => setTimeout(r, 800))

    const found = MOCK_USERS.find(
      u => (u.username === username.trim().toLowerCase() || u.email === username.trim().toLowerCase())
        && u.password === password
    )

    if (!found) {
      setLoginError('Invalid username or password. Please try again.')
      setLoading(false)
      return false
    }

    const { password: _p, ...safeUser } = found
    const sessionUser = { ...safeUser, lastLogin: new Date().toISOString() }

    setUser(sessionUser)
    saveSession(sessionUser)

    // If remember-me, also persist to localStorage
    if (remember) {
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser)) } catch {}
    }

    setLoading(false)
    return true
  }, [])

  // ── Logout ───────────────────────────────────────────────
  const logout = useCallback(() => {
    setUser(null)
    clearSession()
    try { localStorage.removeItem(SESSION_KEY) } catch {}
  }, [])

  // ── Restore from localStorage on mount ──────────────────
  useEffect(() => {
    if (!user) {
      try {
        const raw = localStorage.getItem(SESSION_KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          setUser(parsed)
          saveSession(parsed)
        }
      } catch {}
    }
  }, [])

  // ── Permission helpers ───────────────────────────────────
  const can = useCallback((path) => {
    if (!user) return false
    return ROLE_ROUTES[user.role]?.includes(path) ?? false
  }, [user])

  const isAdmin   = user?.role === 'admin'
  const isManager = user?.role === 'manager'
  const isDriver  = user?.role === 'driver'

  return (
    <AuthContext.Provider value={{
      user, loading, loginError, setLoginError,
      login, logout,
      can, isAdmin, isManager, isDriver,
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

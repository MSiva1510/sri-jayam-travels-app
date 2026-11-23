// Offline harness for the dashboard-to-trips handoff. It renders the real
// Trips page with an inert admin session so Playwright can verify that the
// navigation state opens the booking modal without Supabase credentials.
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import '../src/index.css'
import { AuthContext } from '../src/context/AuthContext.jsx'
import Trips from '../src/pages/Trips.jsx'

const params = new URLSearchParams(window.location.search)
const openCreate = params.get('openCreate') === '1'

const auth = {
  user: { id: 'user-admin', name: 'Admin', email: 'admin@example.test', role: 'admin' },
  initialized: true,
  authLoading: false,
  loginError: '',
  setLoginError: () => {},
  login: async () => {},
  logout: async () => {},
  sendPasswordReset: async () => {},
  updateProfile: async () => {},
  changePassword: async () => {},
  can: () => true,
  canDo: () => true,
  isAdmin: true,
  isManager: false,
  isDriver: false,
}

function NavState() {
  const location = useLocation()
  return (
    <output id="nav-state" className="sr-only">
      {location.state?.openCreate === true ? 'openCreate' : ''}
    </output>
  )
}

createRoot(document.getElementById('root')).render(
  <AuthContext.Provider value={auth}>
    <MemoryRouter initialEntries={[
      { pathname: '/trips', state: openCreate ? { openCreate: true } : null },
    ]}>
      <NavState />
      <Trips />
    </MemoryRouter>
  </AuthContext.Provider>,
)

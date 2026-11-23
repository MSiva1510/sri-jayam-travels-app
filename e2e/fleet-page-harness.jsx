import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import '../src/index.css'
import Fleet from '../src/pages/Fleet'
import { AuthContext } from '../src/context/AuthContext'
import { GpsHistoryContext } from '../src/context/GpsHistoryContext'

const actions = { refreshes: 0 }
window.__fleetPage = actions

const minutesAgo = (n) => new Date(Date.now() - n * 60_000).toISOString()
const snapshots = [
  {
    id: 's1', registration: 'PY01CY1255', vehicle_model: 'Swift Dzire', driver_name: 'Babu',
    speed_kmh: 32, ignition: true, gps_online: true, timestamp: minutesAgo(1),
    latitude: 11.9416, longitude: 79.8083, address: 'Kamarajar Manimandapam, Puducherry',
  },
  {
    id: 's2', registration: 'PY01VF1255', vehicle_model: 'Toyota Etios', driver_name: 'Mani',
    speed_kmh: 0, ignition: false, gps_online: true, timestamp: minutesAgo(3),
    latitude: 11.9392, longitude: 79.8142, address: 'MG Road, Puducherry',
  },
  {
    id: 's3', registration: 'PY01DF1255', vehicle_model: 'Ertiga', driver_name: 'Unassigned',
    speed_kmh: 0, ignition: false, gps_online: false, timestamp: minutesAgo(26),
    latitude: 11.9301, longitude: 79.8201, address: 'Villianur, Puducherry',
  },
]

const gpsValue = {
  health: {
    ok: true, lastSuccess: minutesAgo(0.5), lastAttempt: minutesAgo(0.5),
    providerRows: 3, consecutiveFailures: 0, writeStreak: 0, refreshFailStreak: 0,
    unmatchedRegs: [], providers: [], running: true,
  },
  running: true,
  snapshots,
  settings: { refresh_interval: 60 },
  loading: false,
  error: null,
  todayDistance: 42,
  syncNow: async () => { actions.refreshes += 1; return { ok: true } },
  healthCheck: async () => ({ ok: true }),
  reloadSettings: async () => ({}),
}

function GpsHistoryStub() {
  const location = useLocation()
  return <div data-testid="gps-history-stub">GPS History {location.search}</div>
}

createRoot(document.getElementById('root')).render(
  <AuthContext.Provider value={{ user: { id: 'u1', role: 'manager' } }}>
    <GpsHistoryContext.Provider value={gpsValue}>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={
            <main className="min-h-screen bg-[var(--ap-bg)] p-4 font-sf">
              <Fleet />
            </main>
          } />
          <Route path="/gps-history" element={<GpsHistoryStub />} />
        </Routes>
      </MemoryRouter>
    </GpsHistoryContext.Provider>
  </AuthContext.Provider>,
)

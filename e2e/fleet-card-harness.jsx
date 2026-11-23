// Offline harness for the live-map vehicle card. It renders the real
// VehicleCard with inert callbacks so Playwright can verify card and button
// actions without loading the full Fleet page or GPS providers.
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import { VehicleCard } from '../src/pages/Fleet.jsx'

const actions = { views: [], locates: [] }
window.__fleetCardHarness = actions

const snapshot = {
  id: 'snapshot-1',
  registration: 'PY01CY1255',
  vehicle_model: 'Dzire',
  driver_name: 'Unassigned',
  speed_kmh: 9,
  address: 'Kamarajar Manimandapam, 1st Main Road',
  timestamp: new Date().toISOString(),
  gps_online: true,
  ignition: true,
}

createRoot(document.getElementById('root')).render(
  <main className="bg-[var(--ap-bg)] p-4 font-sf">
    <div id="fleet-card" className="max-w-md">
      <VehicleCard
        s={snapshot}
        onView={s => actions.views.push(s.registration)}
        onLocate={s => actions.locates.push(s.registration)}
      />
    </div>
  </main>,
)

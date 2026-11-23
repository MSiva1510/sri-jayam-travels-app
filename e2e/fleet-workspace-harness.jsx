import { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import FleetHeader from '../src/components/fleet/FleetHeader'
import FleetStatusStrip from '../src/components/fleet/FleetStatusStrip'
import FleetVehicleDetail from '../src/components/fleet/FleetVehicleDetail'
import RecentActivity from '../src/components/fleet/RecentActivity'
import VehicleListPanel from '../src/components/fleet/VehicleListPanel'
import SegmentedControl from '../src/components/ui/SegmentedControl'
import Surface from '../src/components/ui/Surface'
import { AuthContext } from '../src/context/AuthContext'
import { vehStatus } from '../src/components/fleet/fleetStatus'
import { BarChart2, Bell, History, List, Map as MapIcon, Navigation, ShieldCheck } from 'lucide-react'

const actions = {
  refresh: 0,
  fullscreen: 0,
  locate: [],
  history: 0,
}
window.__fleetWorkspace = actions

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

const events = [
  { id: 'e1', t: minutesAgo(2), registration: 'PY01CY1255', type: 'started', location: 'Kamarajar Manimandapam, Puducherry' },
  { id: 'e2', t: minutesAgo(4), registration: 'PY01VF1255', type: 'stopped', location: 'MG Road, Puducherry' },
  { id: 'e3', t: minutesAgo(8), registration: 'PY01DF1255', type: 'updated', location: 'Villianur, Puducherry' },
]

const TABS = [
  { key: 'map', label: 'Live Map', icon: MapIcon },
  { key: 'list', label: 'Vehicles', icon: List },
  { key: 'trips', label: 'Status', icon: Navigation },
  { key: 'geofence', label: 'Geofence', icon: ShieldCheck },
  { key: 'alerts', label: 'Alerts', icon: Bell },
  { key: 'history', label: 'History', icon: History },
  { key: 'analytics', label: 'Analytics', icon: BarChart2 },
]

function Harness() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [selected, setSelected] = useState(null)
  const [focus, setFocus] = useState(false)
  const [subtab, setSubtab] = useState('map')

  const filtered = useMemo(() => snapshots.filter(s => {
    if (status !== 'all' && vehStatus(s) !== status) return false
    const q = search.trim().toLowerCase()
    return !q || [s.registration, s.vehicle_model, s.driver_name].some(v => String(v).toLowerCase().includes(q))
  }), [search, status])

  const counts = useMemo(() => ({
    moving: snapshots.filter(s => vehStatus(s) === 'moving').length,
    stopped: snapshots.filter(s => vehStatus(s) === 'stopped').length,
    offline: snapshots.filter(s => vehStatus(s) === 'offline').length,
  }), [])

  return (
    <AuthContext.Provider value={{ user: { id: 'u1', role: 'manager' } }}>
      <main className="min-h-screen bg-[var(--ap-bg)] p-4 font-sf">
        <div className="mx-auto max-w-[1400px] space-y-4">
          <button
            id="theme-toggle"
            type="button"
            onClick={() => document.documentElement.classList.toggle('dark')}
            className="ap-focus rounded-xl border border-[var(--ap-border)] px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300"
          >
            Toggle theme
          </button>

          <FleetHeader
            lastUpdated="23 Nov 2026, 10:30 AM IST"
            countdown="Auto-sync 60s · next in 42s"
            onRefresh={() => { actions.refresh += 1 }}
            mapFocus={focus}
            onToggleMapFocus={() => { actions.fullscreen += 1; setFocus(v => !v) }}
          />
          <FleetStatusStrip
            counts={counts}
            total={snapshots.length}
            active={status}
            onChange={setStatus}
          />
          <Surface padded={false} className="p-2">
            <SegmentedControl scroll ariaLabel="Fleet workspace view" value={subtab} onChange={setSubtab} options={TABS} />
          </Surface>

          <div className={`grid min-w-0 gap-4 ${focus ? 'grid-cols-1' : 'lg:grid-cols-[minmax(0,1fr)_minmax(320px,32%)]'}`}>
            <div
              data-testid="map-area"
              className="ap-surface ap-hairline flex items-center justify-center rounded-2xl"
              style={{ height: focus ? 'calc(100vh - 230px)' : 520 }}
            >
              <span className="text-xs font-semibold text-slate-400">Map workspace</span>
            </div>
            {!focus && (
              <VehicleListPanel
                snapshots={filtered}
                search={search}
                onSearch={setSearch}
                status={status}
                onStatus={setStatus}
                selectedId={selected?.id}
                onSelect={s => actions.locate.push(s.registration)}
                onView={setSelected}
              />
            )}
          </div>

          {!focus && <RecentActivity events={events} onViewHistory={() => { actions.history += 1 }} />}

          {selected && (
            <FleetVehicleDetail
              snapshot={selected}
              onClose={() => setSelected(null)}
              onLocate={s => { actions.locate.push(s.registration); setSelected(null) }}
              onHistory={() => { actions.history += 1 }}
            />
          )}
        </div>
      </main>
    </AuthContext.Provider>
  )
}

createRoot(document.getElementById('root')).render(<Harness />)

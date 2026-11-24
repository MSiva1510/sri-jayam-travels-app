import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart2, Bell, Car, CheckCircle2, ChevronLeft, ChevronRight, Eye, History,
  List, Map as MapIcon, Navigation, Route, ShieldCheck, WifiOff,
} from 'lucide-react'
import Surface           from '../components/ui/Surface'
import SectionHeader     from '../components/ui/SectionHeader'
import SegmentedControl  from '../components/ui/SegmentedControl'
import MetricCard        from '../components/ui/MetricCard'
import StatusPill        from '../components/ui/StatusPill'
import EmptyState        from '../components/ui/EmptyState'
import Callout           from '../components/ui/Callout'
import IconButton        from '../components/ui/IconButton'
import FleetMap          from '../components/fleet/FleetMap'
import FleetHeader       from '../components/fleet/FleetHeader'
import FleetStatusStrip  from '../components/fleet/FleetStatusStrip'
import FleetVehicleDetail from '../components/fleet/FleetVehicleDetail'
import RecentActivity    from '../components/fleet/RecentActivity'
import VehicleListPanel, { FleetFilters, VehicleCard } from '../components/fleet/VehicleListPanel'
import {
  FLEET_STALE_MS, FLEET_STATUSES, fmtDT, fmtTime, mergeFleetVehicles,
  normReg, timeAgo, vehStatus,
} from '../components/fleet/fleetStatus'
import { useAuth } from '../context/AuthContext'
import { useGpsHistory }  from '../context/GpsHistoryContext'
import { gpsSyncService } from '../services/gpsSyncService'
import { loadVehicles } from '../data/vehicleData'
import { gpsHistoryRepository } from '../repositories/gpsHistoryRepository'
import { geofenceZoneRepository, geofenceEventRepository } from '../repositories/geofenceRepository'
import { fleetAlertRepository } from '../repositories/fleetAlertRepository'

// Kept exported for the offline VehicleCard harness.
export { VehicleCard }

const SUBTABS = [
  { key: 'map',       label: 'Live Map',  icon: MapIcon },
  { key: 'list',      label: 'Vehicles',  icon: List },
  { key: 'trips',     label: 'Status',    icon: Navigation },
  { key: 'geofence',  label: 'Geofence',  icon: ShieldCheck },
  { key: 'alerts',    label: 'Alerts',    icon: Bell },
  { key: 'history',   label: 'History',   icon: History },
  { key: 'analytics', label: 'Analytics', icon: BarChart2 },
]

// Integrate GPS speed over time → km (real samples only)
function distanceKm(pointsAsc) {
  let km = 0
  for (let i = 1; i < pointsAsc.length; i++) {
    const a = pointsAsc[i - 1], b = pointsAsc[i]
    const ta = new Date(a.timestamp).getTime(), tb = new Date(b.timestamp).getTime()
    const sa = Number(a.speed_kmh), sb = Number(b.speed_kmh)
    if (!Number.isFinite(ta) || !Number.isFinite(tb) || tb <= ta) continue
    if (!Number.isFinite(sa) || !Number.isFinite(sb)) continue
    km += ((sa + sb) / 2) * ((tb - ta) / 3_600_000)
  }
  return km
}

// Names fleet vehicles with no live provider feed (device/SIM/account issue).
function MissingVehiclesBanner({ health, snapshots, vehicles = [], settings }) {
  const regs = (Array.isArray(vehicles) ? vehicles : []).map(x => x.registration).filter(Boolean)
  if (!health?.ok || regs.length === 0) return null
  if ((health.providerRows ?? 0) >= regs.length) return null
  if ((health.unmatchedRegs?.length ?? 0) > 0) return null
  const live = new Set(snapshots.filter(s => {
    const ts = s.timestamp ? new Date(s.timestamp).getTime() : 0
    return ts && (Date.now() - ts) < FLEET_STALE_MS
  }).map(s => normReg(s.registration)))
  const missing = regs.filter(r => !live.has(normReg(r)))
  if (!missing.length) return null
  const acct = settings?.company_id || settings?.user_id
    ? `company_id=${settings?.company_id || '—'} user_id=${settings?.user_id || '—'}`
    : null
  return (
    <Callout tone="amber" icon={Route} className="rounded-2xl"
      title={`API returned ${health.providerRows} of ${regs.length} fleet vehicles — not reporting: ${missing.join(', ')}`}
      sub={acct
        ? `App queries ${acct} — if your working browser link uses different IDs, update them in GPS Settings. These trackers are offline at the vendor (device / SIM / account scope); the app cannot display what the API does not send.`
        : 'These trackers are offline at the vendor (device / SIM / account scope). The app cannot display what the API does not send.'}
    />
  )
}

// Isolated 1s ticker so the page and map do not re-render every second.
function SyncCountdown({ intervalSec, lastSuccess, nextRetryAt, running }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  if (running === false) return null
  const base = lastSuccess ? new Date(lastSuccess).getTime() : now
  if (!Number.isFinite(base)) return null
  const retryAt = nextRetryAt ? new Date(nextRetryAt).getTime() : 0
  const target = Math.max(base + intervalSec * 1000, Number.isFinite(retryAt) ? retryAt : 0)
  const remain = Math.round((target - now) / 1000)
  const limited = Number.isFinite(retryAt) && retryAt > base + intervalSec * 1000
  return (
    <span className="tabular-nums">
      Auto-sync {intervalSec}s{remain > 0 ? ` · next in ${remain}s${limited ? ' (rate-limited)' : ''}` : ' · syncing…'}
    </span>
  )
}

/** Derive a short activity timeline from real, per-vehicle GPS transitions. */
function deriveActivity(points = []) {
  const byVehicle = new Map()
  points.forEach(p => {
    const key = p.vehicle_id || p.registration || p.imei
    if (!key) return
    if (!byVehicle.has(key)) byVehicle.set(key, [])
    byVehicle.get(key).push(p)
  })
  const events = []
  byVehicle.forEach((pointsForVehicle, vehicleKey) => {
    const sorted = [...pointsForVehicle].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    sorted.forEach((p, i) => {
      const prev = sorted[i - 1]
      const speed = Number(p.speed_kmh ?? 0)
      const prevSpeed = prev == null ? null : Number(prev.speed_kmh ?? 0)
      const gap = prev ? new Date(p.timestamp).getTime() - new Date(prev.timestamp).getTime() : 0
      let type = 'updated'
      if (prev && gap > FLEET_STALE_MS && speed > 0) type = 'reconnected'
      else if (prev && prevSpeed === 0 && speed > 0) type = 'started'
      else if (prev && prevSpeed > 0 && speed === 0) type = 'stopped'
      const coords = [p.latitude, p.longitude].every(Number.isFinite)
        ? `${Number(p.latitude).toFixed(3)}, ${Number(p.longitude).toFixed(3)}`
        : null
      events.push({
        id: p.id || `${vehicleKey}-${i}`,
        t: p.timestamp,
        registration: p.registration || String(vehicleKey).slice(0, 8),
        type,
        location: p.address || coords || 'Location unavailable',
      })
    })
  })
  return events.sort((a, b) => new Date(b.t) - new Date(a.t)).slice(0, 5)
}

export default function Fleet() {
  const navigate = useNavigate()
  const { snapshots, fleet, loading, running, settings, health, syncNow } = useGpsHistory()
  const [subtab, setSubtab] = useState('map')
  const [search, setSearch] = useState('')
  const [statusSel, setStatusSel] = useState('all')
  const [selected, setSelected] = useState(null)
  const [locateTarget, setLocateTarget] = useState(null)
  const [snapToRoad, setSnapToRoad] = useState(false)
  const [mapFocus, setMapFocus] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState(null)
  const [fleetVehicles, setFleetVehicles] = useState([])
  const [tick, setTick] = useState(0)
  const [histPts, setHistPts] = useState([])
  const [yestKm, setYestKm] = useState(null)

  // Re-classify stale/offline state without refetching the provider.
  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 30_000); return () => clearInterval(t) }, [])

  // The vehicles table is the roster. Cached façade; no duplicate query.
  useEffect(() => {
    let live = true
    loadVehicles()
      .then(v => { if (live) setFleetVehicles(Array.isArray(v) ? v : []) })
      .catch(() => { if (live) setFleetVehicles([]) })
    return () => { live = false }
  }, [])

  // Guarantee provider auto-sync while this page is open (guarded no-op when
  // the centrally managed service is already running).
  useEffect(() => {
    gpsSyncService.start().catch(() => {})
    gpsSyncService.refreshProvider().catch(() => {})
  }, [])
  const intervalSec = Math.max(5, Number(settings?.refresh_interval ?? 60))

  const dayStart = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [tick])
  const loadHistory = useCallback(async () => {
    try {
      const [today, yest] = await Promise.all([
        gpsHistoryRepository.getHistory({ since: dayStart.toISOString(), limit: 500 }),
        gpsHistoryRepository.getHistory({
          since: new Date(dayStart.getTime() - 86400000).toISOString(),
          until: dayStart.toISOString(), limit: 1000,
        }),
      ])
      setHistPts(Array.isArray(today) ? today : [])
      const yp = Array.isArray(yest) ? yest : []
      if (yp.length) {
        const byV = new Map()
        yp.forEach(p => {
          const k = p.vehicle_id || p.registration
          if (!k) return
          if (!byV.has(k)) byV.set(k, [])
          byV.get(k).push(p)
        })
        let km = 0
        byV.forEach(arr => { km += distanceKm([...arr].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))) })
        setYestKm(km)
      } else setYestKm(null)
    } catch { setHistPts([]); setYestKm(null) }
  }, [dayStart])
  useEffect(() => { loadHistory() }, [loadHistory])

  const handleRefresh = useCallback(async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      const result = await syncNow?.()
      setRefreshError(result && result.ok === false
        ? (result.error || 'The GPS provider did not respond. Showing last known positions.')
        : null)
      await loadHistory()
    } catch (err) {
      setRefreshError(err?.message || 'Refresh failed. Showing last known positions.')
    } finally { setRefreshing(false) }
  }, [refreshing, syncNow, loadHistory])

  // Roster + live fixes. Vehicles with no GPS row are real offline entries;
  // they never inherit a fabricated position or a "stopped" state.
  const fleetSnapshots = useMemo(
    () => mergeFleetVehicles(fleetVehicles, snapshots),
    [fleetVehicles, snapshots]
  )

  const counts = useMemo(() => {
    const c = { moving: 0, stopped: 0, offline: 0 }
    fleetSnapshots.forEach(s => { c[vehStatus(s)]++ })
    return c
  }, [fleetSnapshots, tick])

  const filtered = useMemo(() => {
    const q = (search || '').trim().toLowerCase()
    return fleetSnapshots.filter(s => {
      if (statusSel !== 'all' && vehStatus(s) !== statusSel) return false
      if (q && ![s.registration, s.vehicle_model, s.model, s.driver_name, s.address, s.vehicle_id, s.imei]
        .some(v => String(v ?? '').toLowerCase().includes(q))) return false
      return true
    })
  }, [fleetSnapshots, search, statusSel, tick])

  const isFiltering = Boolean(search.trim()) || statusSel !== 'all'
  const focusIds = useMemo(
    () => isFiltering ? filtered.map(s => s.id) : null,
    [isFiltering, filtered]
  )
  const activity = useMemo(() => deriveActivity(histPts), [histPts])

  const total = fleetSnapshots.length
  const todayKm = Number(fleet.todayDistance ?? 0)
  const distDelta = yestKm != null && yestKm > 0 ? Math.round((todayKm - yestKm) / yestKm * 100) : null
  const lastUpd = fleet.lastSync ? fmtDT(fleet.lastSync) : '—'

  const connection = useMemo(() => {
    if (health?.ok === false) return { tone: 'red', label: 'Connection issue', pulse: false }
    if (health?.degraded) return { tone: 'amber', label: 'Partial connection', pulse: true }
    if (running === false) return { tone: 'amber', label: 'Tracking paused', pulse: false }
    return { tone: 'green', label: 'Connected', pulse: true }
  }, [health?.ok, health?.degraded, running])

  const filters = (
    <FleetFilters
      search={search}
      onSearch={setSearch}
      status={statusSel}
      onStatus={setStatusSel}
    />
  )

  return (
    <div className="space-y-4 animate-fade-up font-sf">
      <FleetHeader
        connection={connection}
        lastUpdated={lastUpd}
        countdown={<SyncCountdown intervalSec={intervalSec} lastSuccess={health?.lastSuccess} nextRetryAt={health?.nextRetryAt} running={running} />}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        mapFocus={mapFocus}
        onToggleMapFocus={() => setMapFocus(v => !v)}
      />

      <FleetStatusStrip counts={counts} total={total} active={statusSel} onChange={setStatusSel} />

      <div className="flex items-center gap-2 flex-wrap">
        <SegmentedControl
          scroll
          compact
          className="min-w-0 flex-1"
          ariaLabel="Fleet workspace view"
          value={subtab}
          onChange={setSubtab}
          options={SUBTABS.map(t => ({ key: t.key, label: t.label, icon: t.icon }))}
        />
      </div>

      {/* Provider/write/read diagnostics. Kept separate from movement status. */}
      {health?.ok === false && health?.lastError && (() => {
        const retryAt = health?.nextRetryAt ? new Date(health.nextRetryAt).getTime() : 0
        const limited = Number.isFinite(retryAt) && retryAt > Date.now()
        const waitS = limited ? Math.max(1, Math.ceil((retryAt - Date.now()) / 1000)) : 0
        return (
          <Callout tone="red" icon={WifiOff}
            title={`GPS sync failing: ${health.lastError}. Positions below are stale.`}
            sub={limited ? 'Vendor rate limit — retrying automatically in ~' + waitS + 's.' : 'Retrying automatically — no action needed.'} />
        )
      })()}
      {health?.ok && (health?.writeStreak ?? 0) >= 3 && (
        <Callout tone="amber" icon={WifiOff}
          title={`GPS provider is reachable but ${health?.lastWrite?.skipped ?? 0} row${(health?.lastWrite?.skipped ?? 0) !== 1 ? 's' : ''} failed to save — check gps_tracking table permissions (RLS).`} />
      )}
      {refreshError && (
        <Callout tone="red" icon={WifiOff}
          title="Manual refresh failed"
          sub={refreshError}
          actionLabel="Dismiss"
          onAction={() => setRefreshError(null)}
        />
      )}
      {(health?.refreshFailStreak ?? 0) >= 2 && (
        <Callout tone="amber"
          title={`Live view not refreshing${health?.refreshError ? `: ${health.refreshError}` : ''}. Data below may be stale.`}
          actionLabel="Reload Page"
          onAction={() => window.location.reload()}
        />
      )}
      {health?.unmatchedRegs?.length > 0 && (
        <Callout tone="amber"
          title={`API returned ${health.providerRows} vehicle${health.providerRows !== 1 ? 's' : ''} · ${health.unmatchedRegs.length} not matched to fleet: ${health.unmatchedRegs.join(', ')}`}
          sub="Check the registration / IMEI in GPS Settings and the Vehicles page." />
      )}
      <MissingVehiclesBanner health={health} snapshots={snapshots} vehicles={fleetVehicles} settings={settings} />

      {subtab === 'map' && (
        <>
          <div className={`grid min-w-0 gap-4 ${mapFocus ? 'grid-cols-1' : 'lg:grid-cols-[minmax(0,1fr)_minmax(320px,32%)]'}`}>
            <div className="min-w-0">
              <div className="relative">
                <FleetMap
                  snapshots={fleetSnapshots}
                  onSelect={setSelected}
                  locateTarget={locateTarget}
                  selectedId={selected?.id}
                  focusIds={focusIds}
                  height={mapFocus ? 'calc(100vh - 230px)' : 520}
                  snapToRoad={snapToRoad}
                />
                <div className="absolute right-3 bottom-16 z-[400] sm:bottom-3">
                  <button
                    type="button"
                    onClick={() => setSnapToRoad(v => !v)}
                    title="Snap car markers to the nearest road (display only — GPS data unchanged)"
                    aria-pressed={snapToRoad}
                    className={`ap-focus flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold shadow-lg transition-colors active:scale-95 ${
                      snapToRoad
                        ? 'border-transparent bg-[var(--ap-accent)] text-white'
                        : 'border-[var(--ap-border)] bg-[var(--ap-surface)] text-slate-700 dark:text-slate-200 hover:bg-[var(--ap-surface-2)]'
                    }`}
                  >
                    <Route size={12} /> Snap to road
                  </button>
                </div>
              </div>
            </div>
            {!mapFocus && (
              <VehicleListPanel
                snapshots={filtered}
                search={search}
                onSearch={setSearch}
                status={statusSel}
                onStatus={setStatusSel}
                selectedId={selected?.id}
                onSelect={setLocateTarget}
                onView={setSelected}
              />
            )}
          </div>
          {!mapFocus && <RecentActivity events={activity} onViewHistory={() => navigate('/gps-history')} />}
        </>
      )}

      {subtab !== 'map' && (
        <div className="space-y-4">
          <Surface padded={false} className="p-3.5">{filters}</Surface>
          {subtab === 'list' && <ListView snapshots={filtered} onSelect={setSelected} />}
          {subtab === 'trips' && <TripsView snapshots={filtered} onSelect={setSelected} />}
          {subtab === 'geofence' && <GeofenceView />}
          {subtab === 'alerts' && <AlertsView />}
          {subtab === 'history' && <HistoryView snapshots={snapshots} />}
          {subtab === 'analytics' && (
            <AnalyticsView counts={counts} total={total} todayKm={todayKm} distDelta={distDelta} fleet={fleet} />
          )}
        </div>
      )}

      {selected && (
        <FleetVehicleDetail
          snapshot={selected}
          onClose={() => setSelected(null)}
          onLocate={setLocateTarget}
          onHistory={() => {
            const params = new URLSearchParams()
            if (selected.vehicle_id) params.set('vehicleId', String(selected.vehicle_id))
            if (selected.registration) params.set('registration', String(selected.registration))
            const qs = params.toString()
            navigate(qs ? `/gps-history?${qs}` : '/gps-history')
          }}
        />
      )}
      {loading && <p className="text-center text-xs text-slate-500 dark:text-slate-400">Loading GPS data…</p>}
    </div>
  )
}

const TH = 'px-3 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap'

// ── Vehicle List view ─────────────────────────────────────────
const LIST_PAGE = 10
function ListView({ snapshots, onSelect }) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(snapshots.length / LIST_PAGE))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const rows = snapshots.slice((safePage - 1) * LIST_PAGE, safePage * LIST_PAGE)
  useEffect(() => { setPage(1) }, [snapshots.length])
  return (
    <Surface padded={false} className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-500/5 dark:bg-white/5 border-b ap-hairline">
              {['#', 'Vehicle', 'Driver', 'Speed', 'Status', 'GPS', 'Ignition', 'Updated', ''].map(h => (
                <th key={h} className={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => {
              const status = FLEET_STATUSES[vehStatus(s)] || FLEET_STATUSES.offline
              return (
                <tr key={s.id} className="border-b ap-hairline last:border-0 hover:bg-slate-500/5 dark:hover:bg-white/5 transition-colors">
                  <td className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">{(safePage - 1) * LIST_PAGE + i + 1}</td>
                  <td className="px-3 py-2.5">
                    <p className="text-xs font-sf font-semibold text-slate-900 dark:text-white whitespace-nowrap">{s.registration || '—'}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[160px]">{s.vehicle_model || s.model || 'Vehicle'}</p>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-700 dark:text-slate-200 whitespace-nowrap">{s.driver_name || '—'}</td>
                  <td className="px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">{Number(s.speed_kmh ?? 0).toFixed(0)} km/h</td>
                  <td className="px-3 py-2.5"><StatusPill tone={status.tone}>{status.label}</StatusPill></td>
                  <td className="px-3 py-2.5 text-xs font-semibold" style={{ color: s.gps_online === true ? '#10b981' : '#94a3b8' }}>{s.gps_online === true ? 'ON' : 'OFF'}</td>
                  <td className="px-3 py-2.5 text-xs font-semibold" style={{ color: s.ignition === true ? '#f59e0b' : '#94a3b8' }}>{s.ignition === true ? 'ON' : 'OFF'}</td>
                  <td className="px-3 py-2.5 text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap tabular-nums">{timeAgo(s.timestamp)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <IconButton icon={Eye} label="View details" onClick={() => onSelect?.(s)} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {snapshots.length === 0 && <EmptyState title="No vehicles match the current filters." />}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2.5 border-t ap-hairline">
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">Showing {(safePage - 1) * LIST_PAGE + 1} to {Math.min(safePage * LIST_PAGE, snapshots.length)} of {snapshots.length}</p>
          <div className="flex items-center gap-1.5">
            <IconButton icon={ChevronLeft} label="Previous" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} />
            <span className="text-xs font-semibold text-slate-900 dark:text-white tabular-nums px-1">{safePage} / {totalPages}</span>
            <IconButton icon={ChevronRight} label="Next" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} />
          </div>
        </div>
      )}
    </Surface>
  )
}

// ── Status view ───────────────────────────────────────────────
function TripsView({ snapshots, onSelect }) {
  return (
    <Surface padded={false} className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-500/5 dark:bg-white/5 border-b ap-hairline">
              {['Vehicle', 'Status', 'Speed', 'Driver', 'Last Update', ''].map(h => (
                <th key={h} className={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {snapshots.map(s => {
              const status = FLEET_STATUSES[vehStatus(s)] || FLEET_STATUSES.offline
              return (
                <tr key={s.id} className="border-b ap-hairline last:border-0 hover:bg-slate-500/5 dark:hover:bg-white/5 transition-colors">
                  <td className="px-3 py-2.5 text-xs font-sf font-semibold text-slate-900 dark:text-white whitespace-nowrap">{s.registration || '—'}</td>
                  <td className="px-3 py-2.5"><StatusPill tone={status.tone}>{status.label}</StatusPill></td>
                  <td className="px-3 py-2.5 text-xs text-slate-700 dark:text-slate-200 tabular-nums">{Number(s.speed_kmh ?? 0).toFixed(0)} km/h</td>
                  <td className="px-3 py-2.5 text-xs text-slate-700 dark:text-slate-200 whitespace-nowrap">{s.driver_name || '—'}</td>
                  <td className="px-3 py-2.5 text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap tabular-nums">{timeAgo(s.timestamp)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <IconButton icon={Eye} label="View details" onClick={() => onSelect?.(s)} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {snapshots.length === 0 && <EmptyState title="No vehicles match the current filters." />}
    </Surface>
  )
}

// ── Geofence view ─────────────────────────────────────────────
function GeofenceView() {
  const [zones, setZones] = useState(null)
  const [events, setEvents] = useState(null)
  useEffect(() => {
    let live = true
    Promise.all([
      geofenceZoneRepository.getZones({ limit: 50 }).catch(() => null),
      geofenceEventRepository.getEvents({ limit: 20 }).catch(() => null),
    ]).then(([z, e]) => {
      if (!live) return
      setZones(Array.isArray(z) ? z : (z?.data && Array.isArray(z.data) ? z.data : []))
      setEvents(Array.isArray(e) ? e : (e?.data && Array.isArray(e.data) ? e.data : []))
    })
    return () => { live = false }
  }, [])
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Surface>
        <SectionHeader className="mb-2" title={`Geofence Zones (${zones?.length ?? '…'})`} />
        {zones == null ? <EmptyState title="Loading zones…" /> : zones.length === 0 ? <EmptyState title="No geofence zones defined." description="Create zones in GPS Settings." /> : (
          <div className="space-y-2">
            {zones.map((z, i) => (
              <div key={z.id || i} className="rounded-xl border ap-hairline bg-slate-500/5 dark:bg-white/5 p-3">
                <p className="text-xs font-sf font-semibold text-slate-900 dark:text-white">{z.name || z.zone_name || `Zone ${i + 1}`}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {[z.type || z.zone_type, z.radius_m != null ? `${z.radius_m}m radius` : null, z.address || z.center_label].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
            ))}
          </div>
        )}
      </Surface>
      <Surface>
        <SectionHeader className="mb-2" title="Recent Geofence Events" />
        {events == null ? <EmptyState title="Loading events…" /> : events.length === 0 ? <EmptyState title="No entry/exit events recorded." /> : (
          <div className="space-y-2">
            {events.map((e, i) => (
              <div key={e.id || i} className="rounded-xl border ap-hairline bg-slate-500/5 dark:bg-white/5 p-3">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-sf font-semibold text-slate-900 dark:text-white flex-1 truncate">
                    {(e.event_type || e.type || 'Event').toString().replace(/_/g, ' ')}
                  </p>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">{e.timestamp || e.created_at ? fmtTime(e.timestamp || e.created_at) : ''}</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  {[e.vehicle_registration || e.registration, e.zone_name || e.zone_id, e.driver_name].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
            ))}
          </div>
        )}
      </Surface>
    </div>
  )
}

// ── Alerts view ───────────────────────────────────────────────
function AlertsView() {
  const { user } = useAuth()
  const [alerts, setAlerts] = useState(null)
  const [resolved, setResolved] = useState(null)
  const [resolvingId, setResolvingId] = useState(null)

  const load = useCallback(async (liveRef) => {
    const [activeRes, resolvedRes] = await Promise.allSettled([
      fleetAlertRepository.getActiveAlerts({ limit: 50 }),
      fleetAlertRepository.getAll({ status: ['resolved', 'closed'], limit: 20 }),
    ])
    if (liveRef && !liveRef.current) return
    setAlerts(activeRes.status === 'fulfilled' && Array.isArray(activeRes.value) ? activeRes.value : [])
    setResolved(resolvedRes.status === 'fulfilled' && Array.isArray(resolvedRes.value) ? resolvedRes.value : [])
  }, [])

  useEffect(() => {
    const liveRef = { current: true }
    load(liveRef)
    return () => { liveRef.current = false }
  }, [load])

  const handleResolve = async (alert) => {
    if (!alert?.id || resolvingId) return
    setResolvingId(alert.id)
    try {
      const updated = await fleetAlertRepository.resolve(alert.id, user?.id || user?.uid || 'system', '')
      setAlerts(prev => (prev || []).filter(a => a.id !== alert.id))
      setResolved(prev => [updated || { ...alert, status: 'resolved', resolved_at: new Date().toISOString() }, ...(prev || [])])
    } catch (err) {
      console.error('[Fleet] resolve alert failed', err)
    } finally {
      setResolvingId(null)
    }
  }

  const toneOf = (p) => p === 'critical' ? 'red' : p === 'high' ? 'amber' : 'blue'
  const alertLabel = (a) => a.title || a.alert_type || a.type || 'Fleet alert'
  const alertMeta = (a) => [
    a.vehicle_registration || a.registration,
    a.message || a.description,
    a.created_at ? timeAgo(a.created_at) : null,
  ].filter(Boolean).join(' · ') || '—'

  return (
    <div className="space-y-4">
      <Surface>
        <SectionHeader className="mb-2" title={`Active Fleet Alerts (${alerts?.length ?? '…'})`} />
        {alerts == null ? <EmptyState title="Loading alerts…" /> : alerts.length === 0 ? (
          <EmptyState icon={Bell} title="No active alerts." description="Fleet is clear." />
        ) : (
          <div className="space-y-2">
            {alerts.map((a, i) => {
              const isSos = String(a.alert_type || '').toLowerCase() === 'sos'
              return (
                <div key={a.id || i} className="flex items-center gap-3 rounded-xl border ap-hairline bg-slate-500/5 dark:bg-white/5 p-3">
                  <span className="text-lg flex-shrink-0" aria-hidden="true">{isSos ? '🆘' : '⚠️'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-sf font-semibold text-slate-900 dark:text-white truncate">{alertLabel(a)}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{alertMeta(a)}</p>
                  </div>
                  {(a.severity || a.priority) && (
                    <StatusPill tone={toneOf(a.severity || a.priority)} className="capitalize flex-shrink-0">
                      {a.severity || a.priority}
                    </StatusPill>
                  )}
                  <button
                    type="button"
                    onClick={() => handleResolve(a)}
                    disabled={resolvingId === a.id}
                    className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg border ap-hairline px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label={`Resolve ${alertLabel(a)}`}
                  >
                    <CheckCircle2 size={14} aria-hidden="true" />
                    {resolvingId === a.id ? 'Resolving…' : 'Resolve'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </Surface>

      <Surface>
        <SectionHeader className="mb-2" title={`Resolved Alert History (${resolved?.length ?? '…'})`} />
        {resolved == null ? <EmptyState title="Loading history…" /> : resolved.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="No resolved alerts yet." description="Resolved alerts will appear here." />
        ) : (
          <div className="space-y-2">
            {resolved.map((a, i) => (
              <div key={a.id || i} className="flex items-center gap-3 rounded-xl border ap-hairline bg-slate-500/5 dark:bg-white/5 p-3 opacity-80">
                <span className="text-lg flex-shrink-0" aria-hidden="true">{String(a.alert_type || '').toLowerCase() === 'sos' ? '🆘' : '✓'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-sf font-semibold text-slate-900 dark:text-white truncate">{alertLabel(a)}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {[a.vehicle_registration || a.registration, a.message || a.description, a.resolved_at ? `Resolved ${timeAgo(a.resolved_at)}` : a.created_at ? timeAgo(a.created_at) : null].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                <StatusPill tone="green" className="flex-shrink-0">Resolved</StatusPill>
              </div>
            ))}
          </div>
        )}
      </Surface>
    </div>
  )
}

// ── History view ──────────────────────────────────────────────
const HIST_PAGE = 10
function HistoryView({ snapshots }) {
  const [veh, setVeh] = useState('all')
  const [rows, setRows] = useState(null)
  const [page, setPage] = useState(1)
  const todayIso = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(todayIso)
  const ctl = 'ap-field ap-focus py-2 px-3 text-xs font-medium rounded-[10px] outline-none tabular-nums'
  useEffect(() => {
    let live = true
    setRows(null)
    gpsHistoryRepository.getHistory({ vehicleId: veh === 'all' ? undefined : veh, date, limit: 300 })
      .then(r => { if (live) setRows(Array.isArray(r) ? r : []) })
      .catch(() => { if (live) setRows([]) })
    return () => { live = false }
  }, [veh, date])
  useEffect(() => { setPage(1) }, [veh, date])
  const totalPages = Math.max(1, Math.ceil((rows || []).length / HIST_PAGE))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const pageRows = (rows || []).slice((safePage - 1) * HIST_PAGE, safePage * HIST_PAGE)
  return (
    <Surface>
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <select value={veh} onChange={e => setVeh(e.target.value)} aria-label="Vehicle filter" className={ctl}>
          <option value="all">All Vehicles</option>
          {snapshots.map(s => <option key={s.vehicle_id || s.id} value={s.vehicle_id}>{s.registration || s.vehicle_id?.slice(0, 8)}</option>)}
        </select>
        <input type="date" value={date} max={todayIso} onChange={e => setDate(e.target.value)} aria-label="Date" className={ctl} />
        <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums ml-auto">{(rows || []).length} points</span>
      </div>
      {rows == null ? <EmptyState title="Loading history…" /> : rows.length === 0 ? <EmptyState title="No GPS points for this vehicle and date." /> : (<>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b ap-hairline">
                {['Time', 'Vehicle', 'Speed', 'Ignition', 'Location'].map(h => (
                  <th key={h} className={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((p, i) => (
                <tr key={p.id || i} className="border-b ap-hairline last:border-0">
                  <td className="py-2 pr-3 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">{p.timestamp ? fmtDT(p.timestamp) : '—'}</td>
                  <td className="py-2 pr-3 text-xs font-mono text-slate-700 dark:text-slate-200 whitespace-nowrap">{p.registration || (p.vehicle_id || '').slice(0, 8)}</td>
                  <td className="py-2 pr-3 text-xs font-semibold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">{Number(p.speed_kmh ?? 0).toFixed(0)} km/h</td>
                  <td className="py-2 pr-3 text-xs font-semibold" style={{ color: p.ignition === true ? '#f59e0b' : '#94a3b8' }}>{p.ignition === true ? 'ON' : 'OFF'}</td>
                  <td className="py-2 text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[220px]">{p.address || ([p.latitude, p.longitude].every(Number.isFinite) ? `${Number(p.latitude).toFixed(4)}, ${Number(p.longitude).toFixed(4)}` : '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">Page {safePage} of {totalPages}</p>
            <div className="flex items-center gap-1.5">
              <IconButton icon={ChevronLeft} label="Previous" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} />
              <IconButton icon={ChevronRight} label="Next" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} />
            </div>
          </div>
        )}
      </>)}
    </Surface>
  )
}

// ── Analytics view ────────────────────────────────────────────
function AnalyticsView({ counts, total, todayKm, distDelta, fleet }) {
  const pct = (n) => total ? Math.round(n / total * 100) : 0
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      <MetricCard label="Fleet Utilisation" value={`${pct(counts.moving)}%`} sub="Moving right now" icon={Navigation} tone="blue" />
      <MetricCard label="Avg Speed" value={`${fleet.avgSpeed ?? 0} km/h`} sub="Moving vehicles" icon={Route} tone="teal" />
      <MetricCard label="Today's Distance" value={`${Math.round(todayKm)} km`}
        sub={distDelta == null ? 'All vehicles' : `${distDelta > 0 ? '+' : ''}${distDelta}% vs yesterday`} icon={Car} tone="violet" />
      <MetricCard label="Offline Share" value={`${pct(counts.offline)}%`} sub="Needs attention" icon={WifiOff} tone="gray" />
    </div>
  )
}

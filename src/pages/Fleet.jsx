import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Car, Truck, Pause, Clock, WifiOff, Route, RefreshCw, Search, Eye,
  LocateFixed, Expand, Bell, Map as MapIcon, List, Navigation,
  ShieldCheck, History, BarChart2, ChevronLeft, ChevronRight,
} from 'lucide-react'
import Button            from '../components/ui/Button'
import Surface           from '../components/ui/Surface'
import SectionHeader     from '../components/ui/SectionHeader'
import SegmentedControl  from '../components/ui/SegmentedControl'
import MetricCard        from '../components/ui/MetricCard'
import StatusPill        from '../components/ui/StatusPill'
import EmptyState        from '../components/ui/EmptyState'
import Callout           from '../components/ui/Callout'
import IconButton        from '../components/ui/IconButton'
import DonutChart        from '../components/ui/DonutChart'
import FleetMap          from '../components/fleet/FleetMap'
import FleetVehicleDetail from '../components/fleet/FleetVehicleDetail'
import { useGpsHistory }  from '../context/GpsHistoryContext'
import { gpsSyncService } from '../services/gpsSyncService'
import { loadVehicles } from '../data/vehicleData'
import { gpsHistoryRepository } from '../repositories/gpsHistoryRepository'
import { geofenceZoneRepository, geofenceEventRepository } from '../repositories/geofenceRepository'
import { fleetAlertRepository } from '../repositories/fleetAlertRepository'

// ── Vehicle status: single definition used everywhere on this page ──
const isRecent = (s) => {
  const ts = s.timestamp ? new Date(s.timestamp).getTime() : 0
  return ts && (Date.now() - ts) < 10 * 60_000
}
const vehStatus = (s) => {
  if (!isRecent(s)) return 'offline'
  if (Number(s.speed_kmh ?? 0) > 0) return 'moving'
  return s.ignition === true ? 'idle' : 'stopped'
}
const ST = {
  moving:  { label: 'Moving',  color: '#10b981', tone: 'green' },
  idle:    { label: 'Idle',    color: '#f59e0b', tone: 'amber' },
  stopped: { label: 'Stopped', color: '#3b82f6', tone: 'blue' },
  offline: { label: 'Offline', color: '#ef4444', tone: 'red' },
}

const fmtTime = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d) ? '—' : d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()
}
const fmtDT = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}`
}
const timeAgo = (iso) => {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return 'just now'
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

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

// Names the fleet vehicles with no live provider feed (not returned by
// the API at all — device/SIM/account issue at the vendor, not matching).
const normReg = (r) => String(r ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
function MissingVehiclesBanner({ health, snapshots, settings }) {
  const [regs, setRegs] = useState([])
  useEffect(() => {
    loadVehicles().then(v => setRegs((Array.isArray(v) ? v : []).map(x => x.registration).filter(Boolean))).catch(() => setRegs([]))
  }, [])
  if (!health?.ok || regs.length === 0) return null
  if ((health.providerRows ?? 0) >= regs.length) return null
  if ((health.unmatchedRegs?.length ?? 0) > 0) return null // covered by the mismatch banner
  const live = new Set(
    snapshots.filter(s => {
      const ts = s.timestamp ? new Date(s.timestamp).getTime() : 0
      return ts && (Date.now() - ts) < 10 * 60_000
    }).map(s => normReg(s.registration))
  )
  const missing = regs.filter(r => !live.has(normReg(r)))
  if (!missing.length) return null
  const acct = settings?.company_id || settings?.user_id
    ? `company_id=${settings?.company_id || '—'} user_id=${settings?.user_id || '—'}`
    : null
  return (
    <Callout tone="amber" icon={Route} className="rounded-2xl"
      title={`API returned ${health.providerRows} of ${regs.length} fleet vehicles — not reporting: ${missing.join(', ')}`}
      sub={acct
        ? `App queries ${acct} — if your working browser link uses different IDs, update them in GPS Settings. These trackers are offline at KingsTrack (device / SIM / account scope); the app can't display what the API doesn't send.`
        : 'These trackers are offline at KingsTrack (device / SIM / account scope). The app cannot display what the API does not send.'}
    />
  )
}

// Live countdown to the next provider sync (isolated 1s ticker so the
// page itself doesn't re-render every second). Honors vendor backoff:
// when rate-limited, counts down to the scheduled retry instead.
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
      Auto-sync {intervalSec}s{remain > 0 ? ` • next in ${remain}s${limited ? ' (rate-limited)' : ''}` : ' • syncing…'}
    </span>
  )
}

const SUBTABS = [
  { key: 'map', label: 'Live Map', icon: MapIcon },
  { key: 'list', label: 'Vehicle List', icon: List },
  { key: 'trips', label: 'Trip Status', icon: Navigation },
  { key: 'geofence', label: 'Geofence', icon: ShieldCheck },
  { key: 'alerts', label: 'Alerts', icon: Bell },
  { key: 'history', label: 'History', icon: History },
  { key: 'analytics', label: 'Analytics', icon: BarChart2 },
]

function VehicleCard({ s, selected, onView, onLocate }) {
  const st = ST[vehStatus(s)]
  return (
    <div className={`ap-surface rounded-2xl p-3.5 transition-colors ${selected ? 'ring-2 ring-blue-500/60' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-slate-500/10 text-slate-600 dark:bg-white/10 dark:text-slate-200 flex items-center justify-center flex-shrink-0">
          <Car size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-sf font-semibold tracking-wide text-slate-900 dark:text-white truncate">{s.registration || '—'}</p>
            <StatusPill tone={st.tone}>{st.label}</StatusPill>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{s.vehicle_model || s.model || 'Vehicle'}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <IconButton icon={Eye} label="View details" onClick={() => onView?.(s)} />
          <IconButton icon={LocateFixed} label="Locate on map" onClick={() => onLocate?.(s)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2.5 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="truncate">Driver: {s.driver_name || 'Unassigned'}</span>
        <span className="tabular-nums truncate">Speed: {Number(s.speed_kmh ?? 0).toFixed(0)} km/h</span>
        <span className="truncate">📍 {s.address ? s.address.split(',').slice(0, 2).join(',') : '—'}</span>
        <span className="tabular-nums truncate">🕐 {s.timestamp ? fmtDT(s.timestamp) : '—'}</span>
      </div>
    </div>
  )
}

export default function Fleet() {
  const { snapshots, fleet, syncNow, loading, running, settings, health } = useGpsHistory()
  const [subtab, setSubtab] = useState('map')
  const [search, setSearch] = useState('')
  const [statusSel, setStatusSel] = useState('all')
  const [selected, setSelected] = useState(null)
  const [locateTarget, setLocateTarget] = useState(null)
  const [layer, setLayer] = useState('map')
  const [mapFocus, setMapFocus] = useState(false)
  const [diagCopied, setDiagCopied] = useState(false)
  const [tick, setTick] = useState(0)
  const [histPts, setHistPts] = useState([])
  const [yestKm, setYestKm] = useState(null)

  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 30_000); return () => clearInterval(t) }, [])

  // Guarantee provider auto-sync while this page is open (guarded no-op
  // when the centrally managed service is already running). Interval
  // comes from GPS Settings (default 60s).
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

  const handleSync = async () => { await syncNow(); loadHistory() }

  const counts = useMemo(() => {
    const c = { moving: 0, idle: 0, stopped: 0, offline: 0 }
    snapshots.forEach(s => { c[vehStatus(s)]++ })
    return c
  }, [snapshots, tick])

  const filtered = useMemo(() => {
    const q = (search || '').trim().toLowerCase()
    return snapshots.filter(s => {
      if (statusSel !== 'all' && vehStatus(s) !== statusSel) return false
      if (q && ![s.registration, s.address, s.driver_name, s.vehicle_id, s.imei].some(v => String(v ?? '').toLowerCase().includes(q))) return false
      return true
    })
  }, [snapshots, search, statusSel, tick])

  const total = snapshots.length
  const pct = (n) => total ? `${(n / total * 100).toFixed(1)}%` : '0%'
  const todayKm = Number(fleet.todayDistance ?? 0)
  const distDelta = yestKm != null && yestKm > 0 ? Math.round((todayKm - yestKm) / yestKm * 100) : null
  const lastUpd = fleet.lastSync ? fmtDT(fleet.lastSync) : '—'

  // Recent movement: latest GPS samples today (real points, newest first)
  const movement = useMemo(() => [...histPts]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 8)
    .map(p => ({
      t: p.timestamp,
      veh: p.registration || p.vehicle_id?.slice(0, 8) || '—',
      moving: Number(p.speed_kmh ?? 0) > 0,
      idle: Number(p.speed_kmh ?? 0) === 0 && p.ignition === true,
      loc: p.address || ([p.latitude, p.longitude].every(Number.isFinite) ? `${Number(p.latitude).toFixed(3)}, ${Number(p.longitude).toFixed(3)}` : '—'),
    })), [histPts])

  // Hourly distance buckets from today's GPS samples
  const hourly = useMemo(() => {
    const buckets = Array.from({ length: 12 }, (_, i) => ({ x: `${String(i * 2).padStart(2, '0')}:00`, km: 0 }))
    const byV = new Map()
    histPts.forEach(p => {
      const k = p.vehicle_id || p.registration
      if (!k) return
      if (!byV.has(k)) byV.set(k, [])
      byV.get(k).push(p)
    })
    byV.forEach(arr => {
      const sorted = [...arr].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      for (let i = 1; i < sorted.length; i++) {
        const a = sorted[i - 1], b = sorted[i]
        const ta = new Date(a.timestamp).getTime(), tb = new Date(b.timestamp).getTime()
        const sa = Number(a.speed_kmh), sb = Number(b.speed_kmh)
        if (!Number.isFinite(ta) || !Number.isFinite(tb) || tb <= ta || !Number.isFinite(sa) || !Number.isFinite(sb)) continue
        const km = ((sa + sb) / 2) * ((tb - ta) / 3_600_000)
        const h = new Date(tb).getHours()
        buckets[Math.min(11, Math.floor(h / 2))].km += km
      }
    })
    return buckets
  }, [histPts])
  const maxHour = Math.max(...hourly.map(b => b.km), 0.01)

  const ctl = 'ap-field ap-focus py-2 px-3 text-xs font-medium rounded-[10px] outline-none tabular-nums'

  return (
    <div className="space-y-5 animate-fade-up font-sf">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Operations · GPS</p>
          <h1 className="text-[26px] font-semibold tracking-tight text-slate-900 dark:text-white">Live Fleet Tracking</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Real-time vehicle location, status and fleet operations</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="flex justify-end">
              <StatusPill tone={running === false ? 'amber' : 'green'} pulse={running !== false}>
                {running === false ? 'Tracking paused' : 'Live tracking active'}
              </StatusPill>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums mt-1">Last updated: {lastUpd}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
              <SyncCountdown intervalSec={intervalSec} lastSuccess={health?.lastSuccess} nextRetryAt={health?.nextRetryAt} running={running} />
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={async () => {
              const diag = {
                at: new Date().toISOString(),
                running,
                health,
                gpsSettings: settings ? {
                  provider: settings.provider, enabled: settings.enabled,
                  refresh_interval: settings.refresh_interval,
                  company_id: settings.company_id, user_id: settings.user_id,
                  api_url: settings.api_url,
                  vendors: (Array.isArray(settings.gps_vendors) ? settings.gps_vendors : []).map(v => ({
                    vendor: v.vendor, enabled: v.enabled, api_url: v.api_url,
                    groups: (Array.isArray(v.groups) ? v.groups : []).map(g => ({
                      label: g.label, company_id: g.company_id, user_id: g.user_id, email: g.email,
                    })),
                  })),
                  extraAccounts: (Array.isArray(settings.gps_accounts) ? settings.gps_accounts : []).map(a => ({
                    label: a.label, company_id: a.company_id, user_id: a.user_id,
                  })),
                } : null,
                snapshots: snapshots.map(s => ({
                  registration: s.registration, speed: s.speed_kmh,
                  ignition: s.ignition, gps_online: s.gps_online, timestamp: s.timestamp,
                })),
              }
              try {
                await navigator.clipboard.writeText(JSON.stringify(diag, null, 1))
                setDiagCopied(true)
                setTimeout(() => setDiagCopied(false), 2000)
              } catch {}
            }}>
            {diagCopied ? 'Copied!' : 'Diagnostics'}
          </Button>
          <Button icon={RefreshCw} size="sm" onClick={handleSync}>Sync Now</Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <MetricCard icon={Truck} label="Total Vehicles" value={total} sub="100% of fleet" tone="blue" />
        <MetricCard icon={Navigation} label="Moving" value={counts.moving} sub={pct(counts.moving)} tone="green" />
        <MetricCard icon={Pause} label="Stopped" value={counts.stopped} sub={pct(counts.stopped)} tone="teal" />
        <MetricCard icon={Clock} label="Idle" value={counts.idle} sub={pct(counts.idle)} tone="gray" />
        <MetricCard icon={WifiOff} label="Offline" value={counts.offline} sub={pct(counts.offline)} tone="red" />
        <MetricCard icon={Route} label="Today's Distance" value={`${Math.round(todayKm)} km`} sub="vs yesterday" tone="violet"
          trend={distDelta ?? undefined} trendUp={(distDelta ?? 0) >= 0} />
      </div>

      {/* Sub-tab bar + filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <SegmentedControl
          scroll
          className="flex-1 min-w-0"
          ariaLabel="Fleet view"
          value={subtab}
          onChange={setSubtab}
          options={SUBTABS.map(t => ({ key: t.key, label: t.label, icon: t.icon }))}
        />
        <select value={statusSel} onChange={e => setStatusSel(e.target.value)} aria-label="Filter by status" className={ctl}>
          <option value="all">All Status</option>
          <option value="moving">Moving</option>
          <option value="idle">Idle</option>
          <option value="stopped">Stopped</option>
          <option value="offline">Offline</option>
        </select>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vehicle, driver, route…"
            aria-label="Search vehicles" className={`${ctl} pl-8 w-52`} />
        </div>
        <IconButton icon={Expand} label={mapFocus ? 'Exit focus' : 'Expand map'} onClick={() => setMapFocus(v => !v)} />
      </div>

      {/* Provider fetch failure — the API (or proxy/credentials) is down.
          Without this, stale data looks identical to live data. */}
      {health?.ok === false && health?.lastError && (() => {
        const retryAt = health?.nextRetryAt ? new Date(health.nextRetryAt).getTime() : 0
        const limited = Number.isFinite(retryAt) && retryAt > Date.now()
        const waitS = limited ? Math.max(1, Math.ceil((retryAt - Date.now()) / 1000)) : 0
        return (
          <Callout tone="red" icon={WifiOff}
            title={`GPS sync failing: ${health.lastError}. Positions below are stale.`}
            sub={limited ? 'Vendor rate limit — auto-retry in ~' + waitS + 's. Tapping retry early extends the ban.' : undefined}
            actionLabel={limited ? `Retry in ${waitS}s` : 'Retry Sync'}
            actionDisabled={limited}
            onAction={handleSync}
          />
        )
      })()}
      {/* GPS write failure — provider OK but rows not persisting across
          consecutive syncs (RLS/policy). A single skip is normal dedup. */}
      {health?.ok && (health?.writeStreak ?? 0) >= 3 && (
        <Callout tone="amber" icon={WifiOff}
          title={`GPS provider is reachable but ${health?.lastWrite?.skipped ?? 0} row${(health?.lastWrite?.skipped ?? 0) !== 1 ? 's' : ''} failed to save — check gps_tracking table permissions (RLS).`} />
      )}
      {/* Snapshot refresh failing — provider sync may be fine but the
          page cannot read fresh rows (network/RLS). Streak-gated. */}
      {(health?.refreshFailStreak ?? 0) >= 2 && (
        <Callout tone="amber"
          title={`Live view not refreshing${health?.refreshError ? `: ${health.refreshError}` : ''}. Data below may be stale.`}
          actionLabel="Reload Page"
          onAction={() => window.location.reload()}
        />
      )}
      {/* Provider mismatch diagnostics (e.g. a vehicle the API returns
          under an unknown reg/IMEI, or stops returning at all) */}
      {health?.unmatchedRegs?.length > 0 && (
        <Callout tone="amber"
          title={`API returned ${health.providerRows} vehicle${health.providerRows !== 1 ? 's' : ''} · ${health.unmatchedRegs.length} not matched to fleet: ${health.unmatchedRegs.join(', ')}`}
          sub="Check the registration / IMEI in GPS Settings and the Vehicles page." />
      )}
      <MissingVehiclesBanner health={health} snapshots={snapshots} settings={settings} />

      {subtab === 'map' && (
        <MapView
          snapshots={filtered} total={total} counts={counts}
          selected={selected} setSelected={setSelected}
          locateTarget={locateTarget} setLocateTarget={setLocateTarget}
          layer={layer} setLayer={setLayer} mapFocus={mapFocus}
          movement={movement} hourly={hourly} maxHour={maxHour} todayKm={todayKm} distDelta={distDelta}
        />
      )}
      {subtab === 'list' && <ListView snapshots={filtered} onSelect={setSelected} />}
      {subtab === 'trips' && <TripsView snapshots={filtered} counts={counts} total={total} onSelect={setSelected} />}
      {subtab === 'geofence' && <GeofenceView />}
      {subtab === 'alerts' && <AlertsView />}
      {subtab === 'history' && <HistoryView snapshots={snapshots} />}
      {subtab === 'analytics' && <AnalyticsView snapshots={snapshots} counts={counts} total={total} todayKm={todayKm} fleet={fleet} />}

      {selected && <FleetVehicleDetail snapshot={selected} onClose={() => setSelected(null)} />}
      {loading && <p className="text-center text-xs text-slate-500 dark:text-slate-400">Loading GPS data…</p>}
    </div>
  )
}

// ── Live Map view ─────────────────────────────────────────────
function MapView({ snapshots, total, counts, selected, setSelected, locateTarget, setLocateTarget, layer, setLayer, mapFocus, movement, hourly, maxHour, todayKm, distDelta }) {
  return (
    <div className="space-y-4">
      <div className={`grid grid-cols-1 gap-4 ${mapFocus ? '' : 'lg:grid-cols-3'}`}>
        <div className={mapFocus ? '' : 'lg:col-span-2'}>
          <div className="relative">
            <FleetMap snapshots={snapshots} onSelect={setSelected} layer={layer} locateTarget={locateTarget} height={mapFocus ? 560 : 460} />
            <div className="absolute right-3 bottom-3 z-[400]">
              <SegmentedControl
                ariaLabel="Map layer"
                value={layer}
                onChange={setLayer}
                className="bg-[var(--ap-surface)]/90 shadow-lg ring-1 ring-black/5"
                options={[{ key: 'map', label: 'Map' }, { key: 'satellite', label: 'Satellite' }]}
              />
            </div>
          </div>
        </div>
        {!mapFocus && (
          <Surface padded={false} className="p-4 flex flex-col min-h-0 overflow-hidden">
            <SectionHeader className="mb-2.5" title={`Vehicles (${snapshots.length})`} />
            <div className="flex gap-1.5 flex-wrap mb-3">
              {Object.entries(ST).map(([k, v]) => (
                <StatusPill key={k} tone={v.tone}>{counts[k] ?? 0} {v.label}</StatusPill>
              ))}
            </div>
            <div className="space-y-2.5">
              {snapshots.length === 0 && (
                <EmptyState title="No vehicles match the current filters." />
              )}
              {snapshots.map(s => (
                <VehicleCard key={s.id} s={s} selected={selected?.id === s.id}
                  onView={setSelected} onLocate={setLocateTarget} />
              ))}
            </div>
          </Surface>
        )}
      </div>

      {!mapFocus && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Surface>
            <SectionHeader className="mb-2" title="Recent Movement" />
            {movement.length === 0 ? <EmptyState title="No GPS samples today yet." /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b ap-hairline">
                      {['Time', 'Vehicle', 'Event', 'Location'].map(h => (
                        <th key={h} className="py-1.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {movement.map((m, i) => (
                      <tr key={i} className="border-b ap-hairline last:border-0">
                        <td className="py-2 pr-2 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">{fmtTime(m.t)}</td>
                        <td className="py-2 pr-2 text-xs font-mono text-slate-700 dark:text-slate-200 whitespace-nowrap">{m.veh}</td>
                        <td className="py-2 pr-2 whitespace-nowrap">
                          <StatusPill tone={m.moving ? 'green' : m.idle ? 'amber' : 'blue'}>{m.moving ? 'Moving' : m.idle ? 'Idle' : 'Stopped'}</StatusPill>
                        </td>
                        <td className="py-2 text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[140px]">{m.loc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Surface>
          <Surface>
            <p className="text-sm font-sf font-semibold text-slate-900 dark:text-white mb-1">Today's Distance</p>
            <p className="text-xl font-sf font-semibold text-slate-900 dark:text-white tabular-nums">{Math.round(todayKm)} km
              {distDelta != null && <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 tabular-nums">↑ {distDelta}%</span>}
              <span className="ml-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">vs yesterday</span>
            </p>
            {hourly.every(b => b.km === 0) ? <EmptyState title="No GPS distance recorded today yet." /> : (
              <div className="flex items-end gap-1 h-28 mt-2">
                {hourly.map(b => (
                  <div key={b.x} title={`${b.x}: ${b.km.toFixed(1)} km`} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                    <div className="w-full max-w-[22px] rounded-t bg-blue-500/80" style={{ height: `${Math.max(3, maxHour ? b.km / maxHour * 100 : 0)}%` }} />
                    <span className="text-[8px] text-slate-500 dark:text-slate-400 tabular-nums">{b.x}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Distance (km) · from GPS samples</p>
          </Surface>
          <Surface>
            <p className="text-sm font-sf font-semibold text-slate-900 dark:text-white mb-2">Vehicle Status</p>
            {total === 0 ? <EmptyState title="No vehicles tracked." /> : (
              <DonutChart total={total} totalLabel="Vehicles" segments={[
                { label: 'Moving', value: counts.moving, color: '#10b981' },
                { label: 'Stopped', value: counts.stopped, color: '#3b82f6' },
                { label: 'Idle', value: counts.idle, color: '#f59e0b' },
                { label: 'Offline', value: counts.offline, color: '#ef4444' },
              ]} />
            )}
          </Surface>
        </div>
      )}
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
              const st = ST[vehStatus(s)]
              return (
                <tr key={s.id} className="border-b ap-hairline last:border-0 hover:bg-slate-500/5 dark:hover:bg-white/5 transition-colors">
                  <td className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">{(safePage - 1) * LIST_PAGE + i + 1}</td>
                  <td className="px-3 py-2.5">
                    <p className="text-xs font-sf font-semibold text-slate-900 dark:text-white whitespace-nowrap">{s.registration || '—'}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[160px]">{s.address || '—'}</p>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-700 dark:text-slate-200 whitespace-nowrap">{s.driver_name || '—'}</td>
                  <td className="px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">{Number(s.speed_kmh ?? 0).toFixed(0)} km/h</td>
                  <td className="px-3 py-2.5"><StatusPill tone={st.tone}>{st.label}</StatusPill></td>
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

// ── Trip Status view ──────────────────────────────────────────
function TripsView({ snapshots, counts, total, onSelect }) {
  return (
    <div className="space-y-4">
      <Surface>
        <SectionHeader className="mb-2" title="Fleet Status Split" />
        {total === 0 ? <EmptyState title="No vehicles tracked." /> : (
          <DonutChart total={total} totalLabel="Vehicles" segments={[
            { label: 'Moving', value: counts.moving, color: '#10b981' },
            { label: 'Idle', value: counts.idle, color: '#f59e0b' },
            { label: 'Stopped', value: counts.stopped, color: '#3b82f6' },
            { label: 'Offline', value: counts.offline, color: '#ef4444' },
          ]} />
        )}
      </Surface>
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
                const st = ST[vehStatus(s)]
                return (
                  <tr key={s.id} className="border-b ap-hairline last:border-0 hover:bg-slate-500/5 dark:hover:bg-white/5 transition-colors">
                    <td className="px-3 py-2.5 text-xs font-sf font-semibold text-slate-900 dark:text-white whitespace-nowrap">{s.registration || '—'}</td>
                    <td className="px-3 py-2.5"><StatusPill tone={st.tone}>{st.label}</StatusPill></td>
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
    </div>
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
  const [alerts, setAlerts] = useState(null)
  useEffect(() => {
    let live = true
    fleetAlertRepository.getActiveAlerts({ limit: 50 }).then(a => { if (live) setAlerts(Array.isArray(a) ? a : []) }).catch(() => { if (live) setAlerts([]) })
    return () => { live = false }
  }, [])
  const toneOf = (p) => p === 'critical' ? 'red' : p === 'high' ? 'amber' : 'blue'
  return (
    <Surface>
      <SectionHeader className="mb-2" title={`Active Fleet Alerts (${alerts?.length ?? '…'})`} />
      {alerts == null ? <EmptyState title="Loading alerts…" /> : alerts.length === 0 ? <EmptyState icon={Bell} title="No active alerts." description="Fleet is clear." /> : (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={a.id || i} className="flex items-center gap-3 rounded-xl border ap-hairline bg-slate-500/5 dark:bg-white/5 p-3">
              <span className="text-lg flex-shrink-0" aria-hidden="true">⚠️</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-sf font-semibold text-slate-900 dark:text-white truncate">
                  {a.title || a.alert_type || a.type || 'Fleet alert'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {[a.vehicle_registration || a.registration, a.message || a.description, a.created_at ? timeAgo(a.created_at) : null].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              {(a.severity || a.priority) && (
                <StatusPill tone={toneOf(a.severity || a.priority)} className="capitalize flex-shrink-0">
                  {a.severity || a.priority}
                </StatusPill>
              )}
            </div>
          ))}
        </div>
      )}
    </Surface>
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
function AnalyticsView({ snapshots, counts, total, todayKm, fleet }) {
  const pct = (n) => total ? Math.round(n / total * 100) : 0
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Fleet Utilisation" value={`${pct(counts.moving + counts.idle)}%`} sub="Moving + idle now" icon={Navigation} tone="blue" />
        <MetricCard label="Avg Speed" value={`${fleet.avgSpeed ?? 0} km/h`} sub="Moving vehicles" icon={Route} tone="teal" />
        <MetricCard label="Today's Distance" value={`${Math.round(todayKm)} km`} sub="All vehicles" icon={Car} tone="violet" />
        <MetricCard label="Offline Share" value={`${pct(counts.offline)}%`} sub="Needs attention" icon={WifiOff} tone="red" />
      </div>
      <Surface>
        <SectionHeader className="mb-2" title="Fleet Status Split" />
        {total === 0 ? <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-8">No vehicles tracked.</p> : (
          <DonutChart total={total} totalLabel="Vehicles" segments={[
            { label: 'Moving', value: counts.moving, color: '#10b981' },
            { label: 'Idle', value: counts.idle, color: '#f59e0b' },
            { label: 'Stopped', value: counts.stopped, color: '#3b82f6' },
            { label: 'Offline', value: counts.offline, color: '#ef4444' },
          ]} />
        )}
      </Surface>
    </div>
  )
}
import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Car, Truck, Pause, Clock, WifiOff, Route, RefreshCw, Search, Eye,
  LocateFixed, Expand, Bell, Map as MapIcon, List, Navigation,
  ShieldCheck, History, BarChart2, ChevronLeft, ChevronRight, X,
} from 'lucide-react'
import PageHeader         from '../components/ui/PageHeader'
import FleetSearch        from '../components/fleet/FleetSearch'
import FleetMap           from '../components/fleet/FleetMap'
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
  return ts && (Date.now() - ts) < 5 * 60_000
}
const vehStatus = (s) => {
  if (!isRecent(s)) return 'offline'
  if (Number(s.speed_kmh ?? 0) > 0) return 'moving'
  return s.ignition === true ? 'idle' : 'stopped'
}
const ST = {
  moving:  { label: 'Moving',  color: '#10b981', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  idle:    { label: 'Idle',    color: '#f59e0b', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  stopped: { label: 'Stopped', color: '#3b82f6', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  offline: { label: 'Offline', color: '#ef4444', badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
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

function Kpi({ icon, label, value, sub, tone, delta }) {
  const tiles = {
    blue: 'bg-blue-600', green: 'bg-emerald-600', navy: 'bg-blue-800',
    slate: 'bg-slate-500', red: 'bg-red-500', violet: 'bg-violet-600',
  }
  const vals = {
    blue: 'text-slate-800 dark:text-white', green: 'text-emerald-400',
    navy: 'text-slate-800 dark:text-white', slate: 'text-slate-800 dark:text-white',
    red: 'text-red-400', violet: 'text-slate-800 dark:text-white',
  }
  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0 ${tiles[tone]}`}>{icon}</div>
        {delta != null && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 tabular-nums">↑ {delta}%</span>
        )}
      </div>
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className={`text-2xl font-display font-black tabular-nums leading-tight ${vals[tone]}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function Donut({ segments, total, totalLabel }) {
  const R = 52, C = 2 * Math.PI * R
  const sum = segments.reduce((s, g) => s + g.value, 0) || 1
  let acc = 0
  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-shrink-0" style={{ width: 128, height: 128 }}>
        <svg viewBox="0 0 132 132" className="w-full h-full -rotate-90">
          <circle cx="66" cy="66" r={R} fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="16" />
          {segments.map((g, i) => {
            const frac = g.value / sum
            const el = <circle key={i} cx="66" cy="66" r={R} fill="none" stroke={g.color} strokeWidth="16"
              strokeDasharray={`${(frac * C).toFixed(1)} ${C.toFixed(1)}`} strokeDashoffset={(-acc * C).toFixed(1)} />
            acc += frac
            return el
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-display font-black tabular-nums leading-none">{total}</p>
          <p className="text-[9px] text-slate-400 mt-0.5">{totalLabel}</p>
        </div>
      </div>
      <div className="flex-1 space-y-1.5 min-w-0">
        {segments.map(g => (
          <div key={g.label} className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: g.color }} />
            <span className="text-slate-500 dark:text-slate-400 flex-1 truncate">{g.label}</span>
            <span className="font-black tabular-nums">{g.value}</span>
            <span className="font-bold tabular-nums w-11 text-right" style={{ color: g.color }}>{Math.round(g.value / sum * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyBlock({ text }) {
  return <p className="text-xs text-slate-400 text-center py-8">{text}</p>
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
      return ts && (Date.now() - ts) < 5 * 60_000
    }).map(s => normReg(s.registration))
  )
  const missing = regs.filter(r => !live.has(normReg(r)))
  if (!missing.length) return null
  const acct = settings?.company_id || settings?.user_id
    ? `company_id=${settings?.company_id || '—'} user_id=${settings?.user_id || '—'}`
    : null
  return (
    <div className="rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/15 px-4 py-3">
      <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
        API returned {health.providerRows} of {regs.length} fleet vehicles — not reporting: {missing.join(', ')}
      </p>
      {acct && (
        <p className="text-[11px] text-amber-600/80 dark:text-amber-400/70 mt-0.5 font-mono">
          App queries {acct} — if your working browser link uses different IDs, update them in GPS Settings.
        </p>
      )}
      <p className="text-[11px] text-amber-600/80 dark:text-amber-400/70 mt-0.5">
        These trackers are offline at KingsTrack (device / SIM / account scope). The app cannot display what the API doesn't send.
      </p>
    </div>
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
    <div className={`rounded-2xl border p-3.5 transition-colors ${selected ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-900/10' : 'border-slate-100 dark:border-navy-700 bg-white dark:bg-navy-900/60'}`}>
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-navy-900 dark:bg-navy-800 flex items-center justify-center flex-shrink-0">
          <Car size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-black tracking-wide truncate">{s.registration || '—'}</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${st.badge}`}>{st.label}</span>
          </div>
          <p className="text-[11px] text-slate-400 truncate">{s.vehicle_model || s.model || 'Vehicle'}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => onView?.(s)} title="View details" aria-label="View details"
            className="w-7 h-7 rounded-lg bg-navy-900 dark:bg-navy-700 flex items-center justify-center text-slate-300 hover:bg-navy-700 transition-colors"><Eye size={13} /></button>
          <button onClick={() => onLocate?.(s)} title="Locate on map" aria-label="Locate on map"
            className="w-7 h-7 rounded-lg bg-navy-900 dark:bg-navy-700 flex items-center justify-center text-slate-300 hover:bg-navy-700 transition-colors"><LocateFixed size={13} /></button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2.5 text-[11px] text-slate-400">
        <span className="truncate">👤 {s.driver_name || 'Unassigned'}</span>
        <span className="tabular-nums">◉ {Number(s.speed_kmh ?? 0).toFixed(0)} km/h</span>
        <span className="truncate">📍 {s.address ? s.address.split(',').slice(0, 2).join(',') : '—'}</span>
        <span className="tabular-nums">🕐 {s.timestamp ? fmtDT(s.timestamp) : '—'}</span>
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
  useEffect(() => { gpsSyncService.start().catch(() => {}) }, [])
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

  return (
    <div className="space-y-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display font-black text-slate-800 dark:text-white text-2xl">Live Fleet Tracking</h1>
          <p className="text-xs text-slate-400 mt-0.5">Real-time vehicle location, status and fleet operations</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className={`flex items-center gap-1.5 justify-end text-xs font-bold ${running === false ? 'text-amber-400' : 'text-emerald-400'}`}>
              <span className={`w-2 h-2 rounded-full ${running === false ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
              {running === false ? 'Tracking paused' : 'Live tracking active'}
            </p>
            <p className="text-[10px] text-slate-400 tabular-nums">Last updated: {lastUpd}</p>
            <p className="text-[10px] text-slate-400 tabular-nums">
              <SyncCountdown intervalSec={intervalSec} lastSuccess={health?.lastSuccess} nextRetryAt={health?.nextRetryAt} running={running} />
            </p>
          </div>
          <button onClick={async () => {
              const diag = {
                at: new Date().toISOString(),
                running,
                health,
                gpsSettings: settings ? {
                  provider: settings.provider, enabled: settings.enabled,
                  refresh_interval: settings.refresh_interval,
                  company_id: settings.company_id, user_id: settings.user_id,
                  api_url: settings.api_url,
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
            }} title="Copy GPS diagnostics for support"
            className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-navy-700 text-xs font-bold text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors">
            {diagCopied ? 'Copied!' : 'Diagnostics'}
          </button>
          <button onClick={handleSync}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-all shadow-md active:scale-95">
            <RefreshCw size={14} /> Sync Now
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi icon={<Truck size={16} />} label="Total Vehicles" value={total} sub="100% of fleet" tone="blue" />
        <Kpi icon={<Navigation size={16} />} label="Moving" value={counts.moving} sub={pct(counts.moving)} tone="green" />
        <Kpi icon={<Pause size={16} />} label="Stopped" value={counts.stopped} sub={pct(counts.stopped)} tone="navy" />
        <Kpi icon={<Clock size={16} />} label="Idle" value={counts.idle} sub={pct(counts.idle)} tone="slate" />
        <Kpi icon={<WifiOff size={16} />} label="Offline" value={counts.offline} sub={pct(counts.offline)} tone="red" />
        <Kpi icon={<Route size={16} />} label="Today's Distance" value={`${Math.round(todayKm)} km`} sub="vs yesterday" tone="violet" delta={distDelta} />
      </div>

      {/* Sub-tab bar + filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 bg-slate-100 dark:bg-navy-800 rounded-2xl p-1.5 overflow-x-auto no-scrollbar flex-1 min-w-0" style={{ minWidth: 0 }}>
          {SUBTABS.map(t => (
            <button key={t.key} onClick={() => setSubtab(t.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${subtab === t.key ? 'bg-navy-900 dark:bg-blue-700 text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
              <t.icon size={13} />{t.label}
            </button>
          ))}
        </div>
        <select value={statusSel} onChange={e => setStatusSel(e.target.value)}
          className="px-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-200 focus:outline-none font-bold">
          <option value="all">All Status</option>
          <option value="moving">Moving</option>
          <option value="idle">Idle</option>
          <option value="stopped">Stopped</option>
          <option value="offline">Offline</option>
        </select>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vehicle, driver, route…"
            className="pl-8 pr-3 py-2.5 w-52 text-xs rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none" />
        </div>
        <button onClick={() => setMapFocus(v => !v)} title={mapFocus ? 'Exit focus' : 'Expand map'} aria-label="Expand map"
          className="w-9 h-9 rounded-xl border border-slate-200 dark:border-navy-700 flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors flex-shrink-0">
          <Expand size={14} />
        </button>
      </div>

      {/* Provider fetch failure — the API (or proxy/credentials) is down.
          Without this, stale data looks identical to live data. */}
      {health?.ok === false && health?.lastError && (() => {
        const retryAt = health?.nextRetryAt ? new Date(health.nextRetryAt).getTime() : 0
        const limited = Number.isFinite(retryAt) && retryAt > Date.now()
        const waitS = limited ? Math.max(1, Math.ceil((retryAt - Date.now()) / 1000)) : 0
        return (
          <div className="rounded-2xl border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/15 px-4 py-3 flex items-center gap-3 flex-wrap">
            <p className="text-xs font-bold text-red-700 dark:text-red-300 flex-1 min-w-[200px]">
              GPS sync failing: {health.lastError}. Positions below are stale.
              {limited && <span className="block mt-0.5 font-semibold">Vendor rate limit — auto-retry in ~{waitS}s. Tapping retry early extends the ban.</span>}
            </p>
            <button onClick={handleSync} disabled={limited}
              title={limited ? `Retry available in ~${waitS}s` : 'Retry GPS sync now'}
              className="px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold transition-colors flex-shrink-0 enabled:hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed tabular-nums">
              {limited ? `Retry in ${waitS}s` : 'Retry Sync'}
            </button>
          </div>
        )
      })()}
      {/* GPS write failure — provider OK but rows not persisting (RLS/policy). */}
      {health?.ok && (health?.lastWrite?.skipped ?? 0) > 0 && (health?.lastWrite?.inserted ?? 0) === 0 && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/15 px-4 py-3">
          <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
            GPS provider is reachable but {health.lastWrite.skipped} row{health.lastWrite.skipped !== 1 ? 's' : ''} failed to save — check gps_tracking table permissions (RLS).
          </p>
        </div>
      )}
      {/* Provider mismatch diagnostics (e.g. a vehicle the API returns
          under an unknown reg/IMEI, or stops returning at all) */}
      {health?.unmatchedRegs?.length > 0 && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/15 px-4 py-3">
          <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
            API returned {health.providerRows} vehicle{health.providerRows !== 1 ? 's' : ''} · {health.unmatchedRegs.length} not matched to fleet: {health.unmatchedRegs.join(', ')}
          </p>
          <p className="text-[11px] text-amber-600/80 dark:text-amber-400/70 mt-0.5">
            Check the registration / IMEI in GPS Settings and the Vehicles page.
          </p>
        </div>
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
      {loading && <p className="text-center text-xs text-slate-400">Loading GPS data…</p>}
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
            <div className="absolute right-3 bottom-3 z-[400] flex items-center gap-1.5">
              <div className="flex gap-1 bg-white/95 dark:bg-navy-900/95 backdrop-blur rounded-xl p-1 shadow border border-slate-200 dark:border-navy-700">
                {[['map', 'Map'], ['satellite', 'Satellite']].map(([k, l]) => (
                  <button key={k} onClick={() => setLayer(k)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${layer === k ? 'bg-blue-600 text-white' : 'text-slate-500 dark:text-slate-300'}`}>{l}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
        {!mapFocus && (
          <div className="glass-card rounded-2xl p-4 flex flex-col min-h-0">
            <p className="text-sm font-bold text-slate-800 dark:text-white mb-2.5">🗂 Vehicles ({snapshots.length})</p>
            <div className="flex gap-1.5 flex-wrap mb-3">
              {Object.entries(ST).map(([k, v]) => (
                <span key={k} className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 tabular-nums">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: v.color }} />{counts[k] ?? 0} {v.label}
                </span>
              ))}
            </div>
            <div className="space-y-2.5">
              {snapshots.length === 0 && <p className="text-xs text-slate-400 text-center py-8">No vehicles match the current filters.</p>}
              {snapshots.map(s => (
                <VehicleCard key={s.id} s={s} selected={selected?.id === s.id}
                  onView={setSelected} onLocate={setLocateTarget} />
              ))}
            </div>
          </div>
        )}
      </div>

      {!mapFocus && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-slate-800 dark:text-white">🧭 Recent Movement</p>
            </div>
            {movement.length === 0 ? <EmptyBlock text="No GPS samples today yet." /> : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-navy-700">
                    {['Time', 'Vehicle', 'Event', 'Location'].map(h => (
                      <th key={h} className="py-1.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {movement.map((m, i) => (
                    <tr key={i} className="border-b border-slate-50 dark:border-navy-800/50 last:border-0">
                      <td className="py-2 pr-2 text-[11px] text-slate-400 tabular-nums whitespace-nowrap">{fmtTime(m.t)}</td>
                      <td className="py-2 pr-2 text-xs font-mono whitespace-nowrap">{m.veh}</td>
                      <td className="py-2 pr-2 text-xs font-bold whitespace-nowrap" style={{ color: m.moving ? '#10b981' : m.idle ? '#f59e0b' : '#3b82f6' }}>
                        ● {m.moving ? 'Moving' : m.idle ? 'Idle' : 'Stopped'}
                      </td>
                      <td className="py-2 text-[11px] text-slate-400 truncate max-w-[140px]">{m.loc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-sm font-bold text-slate-800 dark:text-white mb-1">📊 Today's Distance</p>
            <p className="text-xl font-display font-black tabular-nums">{Math.round(todayKm)} km
              {distDelta != null && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">↑ {distDelta}%</span>}
              <span className="ml-1.5 text-[10px] font-bold text-slate-400">vs yesterday</span>
            </p>
            {hourly.every(b => b.km === 0) ? <EmptyBlock text="No GPS distance recorded today yet." /> : (
              <div className="flex items-end gap-1 h-28 mt-2">
                {hourly.map(b => (
                  <div key={b.x} title={`${b.x}: ${b.km.toFixed(1)} km`} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                    <div className="w-full max-w-[22px] rounded-t bg-blue-500" style={{ height: `${Math.max(3, maxHour ? b.km / maxHour * 100 : 0)}%` }} />
                    <span className="text-[8px] text-slate-400 tabular-nums">{b.x}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-slate-400 mt-1">■ Distance (km) · from GPS samples</p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-sm font-bold text-slate-800 dark:text-white mb-2">🎯 Vehicle Status</p>
            {total === 0 ? <EmptyBlock text="No vehicles tracked." /> : (
              <Donut total={total} totalLabel="Vehicles" segments={[
                { label: 'Moving', value: counts.moving, color: '#10b981' },
                { label: 'Stopped', value: counts.stopped, color: '#3b82f6' },
                { label: 'Idle', value: counts.idle, color: '#f59e0b' },
                { label: 'Offline', value: counts.offline, color: '#ef4444' },
              ]} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Vehicle List view ─────────────────────────────────────────
const LIST_PAGE = 10
function ListView({ snapshots, onSelect }) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(snapshots.length / LIST_PAGE))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const rows = snapshots.slice((safePage - 1) * LIST_PAGE, safePage * LIST_PAGE)
  useEffect(() => { setPage(1) }, [snapshots.length])
  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/80 dark:bg-navy-900 border-b border-slate-100 dark:border-navy-700">
              {['#', 'Vehicle', 'Driver', 'Speed', 'Status', 'GPS', 'Ignition', 'Updated', ''].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => {
              const st = ST[vehStatus(s)]
              return (
                <tr key={s.id} className="border-b border-slate-50 dark:border-navy-800 hover:bg-slate-50/50 dark:hover:bg-navy-800/30 transition-colors">
                  <td className="px-3 py-2.5 text-xs text-slate-400 tabular-nums">{(safePage - 1) * LIST_PAGE + i + 1}</td>
                  <td className="px-3 py-2.5">
                    <p className="text-xs font-black tracking-wide whitespace-nowrap">{s.registration || '—'}</p>
                    <p className="text-[10px] text-slate-400 truncate max-w-[160px]">{s.address || '—'}</p>
                  </td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">{s.driver_name || '—'}</td>
                  <td className="px-3 py-2.5 text-xs font-bold tabular-nums whitespace-nowrap">{Number(s.speed_kmh ?? 0).toFixed(0)} km/h</td>
                  <td className="px-3 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${st.badge}`}>{st.label}</span></td>
                  <td className="px-3 py-2.5 text-xs font-bold" style={{ color: s.gps_online === true ? '#10b981' : '#94a3b8' }}>{s.gps_online === true ? 'ON' : 'OFF'}</td>
                  <td className="px-3 py-2.5 text-xs font-bold" style={{ color: s.ignition === true ? '#f59e0b' : '#94a3b8' }}>{s.ignition === true ? 'ON' : 'OFF'}</td>
                  <td className="px-3 py-2.5 text-[11px] text-slate-400 whitespace-nowrap tabular-nums">{timeAgo(s.timestamp)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button onClick={() => onSelect?.(s)} title="View details" aria-label="View details"
                      className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                      <Eye size={13} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {snapshots.length === 0 && <EmptyBlock text="No vehicles match the current filters." />}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2.5 border-t border-slate-100 dark:border-navy-700">
          <p className="text-xs text-slate-400 tabular-nums">Showing {(safePage - 1) * LIST_PAGE + 1} to {Math.min(safePage * LIST_PAGE, snapshots.length)} of {snapshots.length}</p>
          <div className="flex items-center gap-1.5">
            <button disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} aria-label="Previous"
              className="w-7 h-7 rounded-lg border border-slate-200 dark:border-navy-700 flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"><ChevronLeft size={13} /></button>
            <span className="text-xs font-bold tabular-nums px-1">{safePage} / {totalPages}</span>
            <button disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} aria-label="Next"
              className="w-7 h-7 rounded-lg border border-slate-200 dark:border-navy-700 flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"><ChevronRight size={13} /></button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Trip Status view ──────────────────────────────────────────
function TripsView({ snapshots, counts, total, onSelect }) {
  return (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl p-4">
        <p className="text-sm font-bold text-slate-800 dark:text-white mb-2">Fleet Status Split</p>
        {total === 0 ? <EmptyBlock text="No vehicles tracked." /> : (
          <Donut total={total} totalLabel="Vehicles" segments={[
            { label: 'Moving', value: counts.moving, color: '#10b981' },
            { label: 'Idle', value: counts.idle, color: '#f59e0b' },
            { label: 'Stopped', value: counts.stopped, color: '#3b82f6' },
            { label: 'Offline', value: counts.offline, color: '#ef4444' },
          ]} />
        )}
      </div>
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-navy-900 border-b border-slate-100 dark:border-navy-700">
                {['Vehicle', 'Status', 'Speed', 'Driver', 'Last Update', ''].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {snapshots.map(s => {
                const st = ST[vehStatus(s)]
                return (
                  <tr key={s.id} className="border-b border-slate-50 dark:border-navy-800 last:border-0 hover:bg-slate-50/50 dark:hover:bg-navy-800/30 transition-colors">
                    <td className="px-3 py-2.5 text-xs font-black tracking-wide whitespace-nowrap">{s.registration || '—'}</td>
                    <td className="px-3 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.badge}`}>{st.label}</span></td>
                    <td className="px-3 py-2.5 text-xs tabular-nums">{Number(s.speed_kmh ?? 0).toFixed(0)} km/h</td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">{s.driver_name || '—'}</td>
                    <td className="px-3 py-2.5 text-[11px] text-slate-400 whitespace-nowrap tabular-nums">{timeAgo(s.timestamp)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button onClick={() => onSelect?.(s)} title="View details" aria-label="View details"
                        className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                        <Eye size={13} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {snapshots.length === 0 && <EmptyBlock text="No vehicles match the current filters." />}
      </div>
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
      <div className="glass-card rounded-2xl p-4">
        <p className="text-sm font-bold text-slate-800 dark:text-white mb-2">🛡 Geofence Zones ({zones?.length ?? '…'})</p>
        {zones == null ? <EmptyBlock text="Loading zones…" /> : zones.length === 0 ? <EmptyBlock text="No geofence zones defined. Create zones in GPS Settings." /> : (
          <div className="space-y-2">
            {zones.map((z, i) => (
              <div key={z.id || i} className="rounded-xl border border-slate-100 dark:border-navy-700 p-3">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{z.name || z.zone_name || `Zone ${i + 1}`}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {[z.type || z.zone_type, z.radius_m != null ? `${z.radius_m}m radius` : null, z.address || z.center_label].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="glass-card rounded-2xl p-4">
        <p className="text-sm font-bold text-slate-800 dark:text-white mb-2">🚨 Recent Geofence Events</p>
        {events == null ? <EmptyBlock text="Loading events…" /> : events.length === 0 ? <EmptyBlock text="No entry/exit events recorded." /> : (
          <div className="space-y-2">
            {events.map((e, i) => (
              <div key={e.id || i} className="rounded-xl border border-slate-100 dark:border-navy-700 p-3">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200 flex-1 truncate">
                    {(e.event_type || e.type || 'Event').toString().replace(/_/g, ' ')}
                  </p>
                  <span className="text-[10px] text-slate-400 tabular-nums">{e.timestamp || e.created_at ? fmtTime(e.timestamp || e.created_at) : ''}</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                  {[e.vehicle_registration || e.registration, e.zone_name || e.zone_id, e.driver_name].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
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
  return (
    <div className="glass-card rounded-2xl p-4">
      <p className="text-sm font-bold text-slate-800 dark:text-white mb-2">🔔 Active Fleet Alerts ({alerts?.length ?? '…'})</p>
      {alerts == null ? <EmptyBlock text="Loading alerts…" /> : alerts.length === 0 ? <EmptyBlock text="No active alerts. Fleet is clear." /> : (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={a.id || i} className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-navy-700 p-3">
              <span className="text-lg flex-shrink-0">⚠️</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                  {a.title || a.alert_type || a.type || 'Fleet alert'}
                </p>
                <p className="text-[11px] text-slate-400 truncate">
                  {[a.vehicle_registration || a.registration, a.message || a.description, a.created_at ? timeAgo(a.created_at) : null].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              {(a.severity || a.priority) && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 capitalize flex-shrink-0">
                  {a.severity || a.priority}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
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
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <select value={veh} onChange={e => setVeh(e.target.value)}
          className="px-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-200 focus:outline-none font-bold">
          <option value="all">All Vehicles</option>
          {snapshots.map(s => <option key={s.vehicle_id || s.id} value={s.vehicle_id}>{s.registration || s.vehicle_id?.slice(0, 8)}</option>)}
        </select>
        <input type="date" value={date} max={todayIso} onChange={e => setDate(e.target.value)}
          className="px-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-200 focus:outline-none font-bold" />
        <span className="text-xs text-slate-400 tabular-nums ml-auto">{(rows || []).length} points</span>
      </div>
      {rows == null ? <EmptyBlock text="Loading history…" /> : rows.length === 0 ? <EmptyBlock text="No GPS points for this vehicle and date." /> : (<>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-navy-700">
                {['Time', 'Vehicle', 'Speed', 'Ignition', 'Location'].map(h => (
                  <th key={h} className="py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((p, i) => (
                <tr key={p.id || i} className="border-b border-slate-50 dark:border-navy-800/50 last:border-0">
                  <td className="py-2 pr-3 text-[11px] text-slate-400 tabular-nums whitespace-nowrap">{p.timestamp ? fmtDT(p.timestamp) : '—'}</td>
                  <td className="py-2 pr-3 text-xs font-mono whitespace-nowrap">{p.registration || (p.vehicle_id || '').slice(0, 8)}</td>
                  <td className="py-2 pr-3 text-xs font-bold tabular-nums whitespace-nowrap">{Number(p.speed_kmh ?? 0).toFixed(0)} km/h</td>
                  <td className="py-2 pr-3 text-xs font-bold" style={{ color: p.ignition === true ? '#f59e0b' : '#94a3b8' }}>{p.ignition === true ? 'ON' : 'OFF'}</td>
                  <td className="py-2 text-[11px] text-slate-400 truncate max-w-[220px]">{p.address || ([p.latitude, p.longitude].every(Number.isFinite) ? `${Number(p.latitude).toFixed(4)}, ${Number(p.longitude).toFixed(4)}` : '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-slate-400 tabular-nums">Page {safePage} of {totalPages}</p>
            <div className="flex items-center gap-1.5">
              <button disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} aria-label="Previous"
                className="w-7 h-7 rounded-lg border border-slate-200 dark:border-navy-700 flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"><ChevronLeft size={13} /></button>
              <button disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} aria-label="Next"
                className="w-7 h-7 rounded-lg border border-slate-200 dark:border-navy-700 flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"><ChevronRight size={13} /></button>
            </div>
          </div>
        )}
      </>)}
    </div>
  )
}

// ── Analytics view ────────────────────────────────────────────
function AnalyticsView({ snapshots, counts, total, todayKm, fleet }) {
  const pct = (n) => total ? Math.round(n / total * 100) : 0
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l: 'Fleet Utilisation', v: `${pct(counts.moving + counts.idle)}%`, s: 'Moving + idle now' },
          { l: 'Avg Speed', v: `${fleet.avgSpeed ?? 0} km/h`, s: 'Moving vehicles' },
          { l: "Today's Distance", v: `${Math.round(todayKm)} km`, s: 'All vehicles' },
          { l: 'Offline Share', v: `${pct(counts.offline)}%`, s: 'Needs attention' },
        ].map(k => (
          <div key={k.l} className="glass-card rounded-2xl p-4">
            <p className="text-[11px] text-slate-400">{k.l}</p>
            <p className="text-2xl font-display font-black tabular-nums">{k.v}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{k.s}</p>
          </div>
        ))}
      </div>
      <div className="glass-card rounded-2xl p-4">
        <p className="text-sm font-bold text-slate-800 dark:text-white mb-2">Fleet Status Split</p>
        {total === 0 ? <p className="text-xs text-slate-400 text-center py-8">No vehicles tracked.</p> : (
          <Donut total={total} totalLabel="Vehicles" segments={[
            { label: 'Moving', value: counts.moving, color: '#10b981' },
            { label: 'Idle', value: counts.idle, color: '#f59e0b' },
            { label: 'Stopped', value: counts.stopped, color: '#3b82f6' },
            { label: 'Offline', value: counts.offline, color: '#ef4444' },
          ]} />
        )}
      </div>
    </div>
  )
}

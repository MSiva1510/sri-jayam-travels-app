// ─── Live Fleet Board ─────────────────────────────────────────
// Vehicle-first board driven by live GPS snapshots (same auto-synced
// feed as the Live Fleet page), joined with the vehicle registry for
// model/driver names and with today's bookings for the trip column.
// No manual refresh — snapshots arrive via GpsHistoryContext.
import { useState, useEffect, useCallback } from 'react'
import { Car, MapPin, Clock, Activity, User, Navigation } from 'lucide-react'
import StatusPill from '../ui/StatusPill'
import { useGpsHistory } from '../../context/GpsHistoryContext'
import { loadDrivers } from '../../data/driverData'
import { loadVehicles } from '../../data/vehicleData'
import { loadBookings } from '../../data/tripTypes'

const norm = (r) => String(r ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')

// Same 10-minute freshness rule as the Live Fleet page.
function gpsStatusOf(s) {
  const ts = s?.timestamp ? new Date(s.timestamp).getTime() : 0
  if (!ts || Date.now() - ts > 10 * 60_000) return 'offline'
  if (Number(s.speed_kmh ?? 0) > 0) return 'moving'
  return s.ignition === true ? 'idle' : 'stopped'
}

const GPS_PILL = {
  moving:  { tone: 'green', label: 'Moving'  },
  stopped: { tone: 'blue',  label: 'Stopped' },
  idle:    { tone: 'amber', label: 'Idle'    },
  offline: { tone: 'red',   label: 'Offline' },
}

function ago(iso) {
  if (!iso) return '—'
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 0) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  return new Date(iso).toLocaleTimeString()
}

function formatDuration(isoStart) {
  if (!isoStart) return '—'
  const ms   = Date.now() - new Date(isoStart).getTime()
  if (ms < 0) return '—'
  const mins = Math.floor(ms / 60000)
  const hrs  = Math.floor(mins / 60)
  const m    = mins % 60
  return `${String(hrs).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export default function LiveFleetBoard() {
  const { snapshots } = useGpsHistory()
  const [bookings, setBookings] = useState([])
  const [drivers,  setDrivers]  = useState([])
  const [vehicles, setVehicles] = useState([])
  const [tick,     setTick]     = useState(0)

  // Registry info (names, models, trips) refreshes on its own cadence;
  // GPS positions stream in continuously via context.
  const fetchRegistry = useCallback(async () => {
    const [bk, dr, ve] = await Promise.allSettled([
      loadBookings(),
      loadDrivers(),
      loadVehicles(),
    ])
    if (bk.status === 'fulfilled') setBookings(Array.isArray(bk.value) ? bk.value : [])
    else console.error('[LiveFleetBoard] loadBookings failed:', bk.reason)
    if (dr.status === 'fulfilled') setDrivers(Array.isArray(dr.value) ? dr.value : [])
    else console.error('[LiveFleetBoard] load drivers failed:', dr.reason)
    if (ve.status === 'fulfilled') setVehicles(Array.isArray(ve.value) ? ve.value : [])
    else console.error('[LiveFleetBoard] load vehicles failed:', ve.reason)
  }, [])

  useEffect(() => {
    fetchRegistry()
    const id = setInterval(() => {
      setTick(t => t + 1)
      fetchRegistry()
    }, 30_000)
    return () => clearInterval(id)
  }, [fetchRegistry])

  const todayISO = new Date().toISOString().slice(0, 10)

  // One row per fleet vehicle: registry rows joined with their live fix,
  // plus any GPS-reporting reg not in the registry.
  const rows = (() => {
    const byReg = new Map()
    vehicles.forEach(v => {
      const key = norm(v?.reg)
      if (key && !byReg.has(key)) byReg.set(key, { vehicle: v, snapshot: null })
    })
    snapshots.forEach(s => {
      const key = norm(s?.registration || s?.vehicle_id)
      if (!key) return
      const row = byReg.get(key) || { vehicle: null }
      const prev = row.snapshot
      if (!prev || new Date(s.timestamp).getTime() > new Date(prev.timestamp).getTime()) {
        row.snapshot = s
      }
      byReg.set(key, row)
    })

    return [...byReg.entries()].map(([key, { vehicle, snapshot }]) => {
      const reg = vehicle?.reg || snapshot?.registration || key
      const driver = drivers.find(d =>
        norm(d?.vehicle || d?.vehicleReg || d?.vehicle_reg) === key
      )
      const driverName = driver?.name || driver?.full_name || 'Unassigned'
      const activeBooking = driverName !== 'Unassigned' ? bookings.find(b =>
        (b.driver || b.driver_name || '').toLowerCase() === driverName.toLowerCase() &&
        b.startDate === todayISO &&
        ['started', 'assigned', 'confirmed'].includes(b.status)
      ) : null
      const status = gpsStatusOf(snapshot)
      const area = snapshot?.address
        || ([snapshot?.latitude, snapshot?.longitude].every(Number.isFinite)
          ? `${Number(snapshot.latitude).toFixed(3)}, ${Number(snapshot.longitude).toFixed(3)}`
          : '—')
      return { key, reg, model: vehicle?.model || '', vtype: vehicle?.type || '', driverName, activeBooking, status, snapshot, area }
    })
  })()

  void tick
  const onlineCount  = rows.filter(r => r.status !== 'offline').length
  const movingCount  = rows.filter(r => r.status === 'moving').length

  return (
    <div className="ap-surface rounded-2xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[var(--ap-border)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
            <Activity size={15} className="text-white" />
          </div>
          <div>
            <h3 className="font-sf font-semibold text-slate-800 dark:text-white text-sm">Live Fleet Board</h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">{onlineCount} online · {movingCount} moving</p>
          </div>
        </div>
        <StatusPill tone={onlineCount > 0 ? 'green' : 'amber'} pulse={onlineCount > 0}>Live GPS</StatusPill>
      </div>

      {/* Table header — desktop only */}
      <div className="hidden sm:grid grid-cols-6 gap-2 px-4 py-2 bg-[var(--ap-surface-2)] text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
        <span>Vehicle</span>
        <span>Driver</span>
        <span>Current Area</span>
        <span>Current Trip</span>
        <span>Status</span>
        <span>Duration</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-[var(--ap-border)]/60">
        {rows.length === 0 && (
          <p className="px-4 py-6 text-center text-xs text-slate-400 dark:text-slate-500">No vehicles in the fleet yet.</p>
        )}
        {rows.map(({ key, reg, model, vtype, driverName, activeBooking, status, snapshot, area }) => {
          const pill = GPS_PILL[status]
          const isActive  = status === 'moving'
          const startedAt = activeBooking?.status === 'started' ? (activeBooking?.updatedAt || null) : null
          const tripId    = activeBooking?.id || null
          const speedTxt  = snapshot ? `${Number(snapshot.speed_kmh ?? 0).toFixed(0)} km/h` : '—'

          return (
            <div key={key}
              className={`px-4 py-3 transition-colors ${isActive ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
            >
              {/* Mobile */}
              <div className="flex items-start justify-between gap-2 sm:hidden">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-blue-600' : 'bg-[var(--ap-surface-2)]'}`}>
                    <Car size={15} className={isActive ? 'text-white' : 'text-slate-400'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 dark:text-white text-xs font-mono">{reg}</span>
                      <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      <User size={9} /><span>{driverName}</span>
                      <span className="mx-1">·</span>
                      <MapPin size={9} /><span className="truncate">{area}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 tabular-nums">{speedTxt} · {ago(snapshot?.timestamp)}</p>
                  </div>
                </div>
              </div>

              {/* Desktop */}
              <div className="hidden sm:grid grid-cols-6 gap-2 items-center">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-blue-600' : 'bg-[var(--ap-border)]'}`}>
                    <Car size={12} className={isActive ? 'text-white' : 'text-slate-400'} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-white text-xs font-mono leading-tight">{reg}</p>
                    <p className="text-[9px] text-slate-400">{model}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{driverName}</p>
                  <p className="text-[9px] text-slate-400">{vtype}</p>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <MapPin size={10} className="text-slate-400 flex-shrink-0" />
                    <span className="text-xs text-slate-600 dark:text-slate-300 truncate">{area}</span>
                  </div>
                  <p className="text-[9px] text-slate-400 tabular-nums mt-0.5">{speedTxt} · {ago(snapshot?.timestamp)}</p>
                </div>
                <div>
                  {tripId ? (
                    <>
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 font-mono">{tripId.slice(-10)}</span>
                      {activeBooking?.customer && (
                        <p className="text-[9px] text-slate-400 truncate max-w-[120px]">{activeBooking.customer}</p>
                      )}
                    </>
                  ) : (
                    <span className="text-[10px] text-slate-300 dark:text-slate-600">—</span>
                  )}
                </div>
                <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
                <div>
                  {startedAt ? (
                    <div className="flex items-center gap-1">
                      <Clock size={10} className="text-blue-500" />
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 font-mono">{formatDuration(startedAt)}</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-300 dark:text-slate-600">—</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="px-4 py-2 border-t border-[var(--ap-border)] bg-slate-50/50 dark:bg-[var(--ap-surface-2)]/30">
        <p className="text-[9px] text-slate-400 dark:text-slate-500">
          Auto-syncs with live GPS · fixes older than 10 min show as Offline
        </p>
      </div>
    </div>
  )
}

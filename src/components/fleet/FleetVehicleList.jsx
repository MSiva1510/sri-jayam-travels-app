// ─── Fleet Vehicle List ───────────────────────────────────────
// Tabular view of the latest GPS snapshot per vehicle. Click a
// row to open the detail side panel.

import { Gauge, Flame, MapPin, Clock, ChevronRight } from 'lucide-react'

function timeAgo(iso) {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return 'just now'
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} min ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)} h ago`
  return new Date(iso).toLocaleDateString()
}

function statusKey(snapshot) {
  const ts = snapshot.timestamp ? new Date(snapshot.timestamp).getTime() : 0
  const isRecent = ts && (Date.now() - ts) < 5 * 60_000
  if (!isRecent) return 'offline'
  const speed = Number(snapshot.speed_kmh ?? 0)
  return speed > 0 ? 'moving' : 'stopped'
}

const STATUS_BADGE = {
  moving:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  stopped: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  offline: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
}

const STATUS_LABEL = { moving: 'Moving', stopped: 'Stopped', offline: 'Offline' }

export default function FleetVehicleList({ snapshots = [], onSelect, selectedId }) {
  if (!snapshots.length) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">No vehicles match the current filters.</p>
      </div>
    )
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-12 gap-2 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50/80 dark:bg-navy-800/60 border-b border-slate-100 dark:border-navy-700">
        <div className="col-span-4">Vehicle</div>
        <div className="col-span-2 text-right">Speed</div>
        <div className="col-span-2 text-center">Status</div>
        <div className="col-span-2 text-center">GPS / Ignition</div>
        <div className="col-span-2 text-right">Last Update</div>
      </div>

      <div className="max-h-[600px] overflow-y-auto">
        {snapshots.map(s => {
          const status = statusKey(s)
          const isSelected = selectedId === s.id
          return (
            <button
              key={s.id}
              onClick={() => onSelect?.(s)}
              className={`w-full grid grid-cols-12 gap-2 px-4 py-3 text-left items-center border-b border-slate-100 dark:border-navy-700 last:border-0 transition-colors ${
                isSelected
                  ? 'bg-blue-50/60 dark:bg-blue-900/20'
                  : 'hover:bg-slate-50/60 dark:hover:bg-navy-800/40'
              }`}
            >
              <div className="col-span-4 min-w-0">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                  {s.registration || s.vehicle_id?.slice(0, 8) || '—'}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate flex items-center gap-1">
                  <MapPin size={10} />
                  {s.address || '—'}
                </p>
              </div>

              <div className="col-span-2 text-right">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-end gap-1">
                  <Gauge size={11} className="text-slate-400" />
                  {Number(s.speed_kmh ?? 0).toFixed(0)}
                  <span className="text-[10px] text-slate-400">km/h</span>
                </p>
              </div>

              <div className="col-span-2 text-center">
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${STATUS_BADGE[status]}`}>
                  {STATUS_LABEL[status]}
                </span>
              </div>

              <div className="col-span-2 flex items-center justify-center gap-1.5 text-[11px]">
                <span className={`w-1.5 h-1.5 rounded-full ${s.ignition === true ? 'bg-blue-500' : 'bg-slate-400'}`} title={`Ignition ${s.ignition === true ? 'ON' : 'OFF'}`} />
                <span className={`px-1.5 py-0.5 rounded ${s.speed_kmh > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                  {s.speed_kmh > 0 ? 'GPS' : 'noGPS'}
                </span>
                <span className={`px-1.5 py-0.5 rounded ${s.ignition === true ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                  {s.ignition === true ? <Flame size={9} className="inline" /> : 'OFF'}
                </span>
              </div>

              <div className="col-span-2 flex items-center justify-end gap-1 text-[11px] text-slate-400">
                <Clock size={10} />
                {timeAgo(s.timestamp)}
                <ChevronRight size={12} className="text-slate-300" />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
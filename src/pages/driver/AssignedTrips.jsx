import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Phone, Play, CheckCircle, Navigation,
  AlertTriangle, Clock, MapPin, Car, Filter,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { TODAY_TRIPS, TRIP_TYPES, TRIP_STATUS_CFG } from '../../data/driverData'

const FILTERS = [
  { key: 'all',       label: 'All'        },
  { key: 'pending',   label: 'Scheduled'  },
  { key: 'driving',   label: 'Active'     },
  { key: 'completed', label: 'Done'       },
]

function StatusPill({ status }) {
  const cfg = TRIP_STATUS_CFG[status] || TRIP_STATUS_CFG.pending
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${status === 'driving' ? 'animate-pulse' : ''}`} />
      {cfg.label}
    </span>
  )
}

export default function AssignedTrips() {
  const { user }  = useAuth()
  const navigate  = useNavigate()
  const driverKey = user?.username?.toLowerCase() || 'ramanan'

  const base = TODAY_TRIPS[driverKey] || []
  const [trips,  setTrips]  = useState(base)
  const [filter, setFilter] = useState('all')
  const [active, setActive] = useState(null)   // expanded trip id

  const filtered = filter === 'all' ? trips : trips.filter(t => t.status === filter)

  const totalFare = trips.reduce((s, t) => s + t.fare, 0)
  const doneCount = trips.filter(t => t.status === 'completed').length

  const startRide = (tripId) => {
    setTrips(prev => prev.map(t => t.tripId === tripId ? { ...t, status: 'driving', startTime: 'Now' } : t))
  }
  const endRide = (tripId) => {
    setTrips(prev => prev.map(t => t.tripId === tripId ? { ...t, status: 'completed', endTime: 'Now', duration: '~1h 20m' } : t))
  }

  return (
    <div className="space-y-4 max-w-lg mx-auto animate-fade-up pb-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/driver')}
                className="w-9 h-9 rounded-xl border border-slate-200 dark:border-navy-700 bg-white/60 dark:bg-navy-800/60 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors flex-shrink-0">
          <ArrowLeft size={17} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-black text-slate-800 dark:text-white text-xl">Assigned Trips</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Today · {trips.length} trips scheduled</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label:'Total Trips',   value: trips.length,    color:'text-blue-600 dark:text-blue-400'    },
          { label:'Completed',     value: doneCount,       color:'text-emerald-600 dark:text-emerald-400' },
          { label:'Total Fare',    value:`Rs. ${(totalFare/1000).toFixed(1)}k`, color:'text-navy-800 dark:text-blue-300' },
        ].map(s => (
          <div key={s.label} className="glass-card rounded-xl p-3 text-center">
            <p className={`text-lg font-display font-black ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-navy-800 rounded-xl p-1">
        {FILTERS.map(f => {
          const cnt = f.key === 'all' ? trips.length : trips.filter(t => t.status === f.key).length
          return (
            <button key={f.key} onClick={() => setFilter(f.key)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      filter === f.key
                        ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}>
              {f.label}
              {cnt > 0 && <span className={`ml-1 text-[10px] ${filter === f.key ? 'text-blue-500' : 'text-slate-400'}`}>{cnt}</span>}
            </button>
          )
        })}
      </div>

      {/* Trip list */}
      {filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center">
          <Car size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">No trips in this category</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(trip => {
            const isExpanded = active === trip.tripId
            const typeLabel  = TRIP_TYPES[trip.tripType] || trip.tripType

            return (
              <div key={trip.tripId} className="glass-card rounded-2xl overflow-hidden">
                {/* Card header */}
                <div className="flex items-center gap-3 p-4 cursor-pointer select-none"
                     onClick={() => setActive(isExpanded ? null : trip.tripId)}>
                  <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${trip.status === 'driving' ? 'bg-blue-600 animate-pulse' : 'bg-navy-900 dark:bg-navy-800'}`}>
                    <span className="text-[9px] font-bold text-blue-300 uppercase leading-none">{trip.scheduledTime.split(' ')[1]}</span>
                    <span className="text-sm font-black text-white leading-tight">{trip.scheduledTime.split(' ')[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 dark:text-white text-sm truncate">{trip.customer}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{typeLabel} · {trip.km} km</p>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      <MapPin size={9} />
                      <span className="truncate">{trip.pickup}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <StatusPill status={trip.status} />
                    <p className="text-sm font-black text-navy-800 dark:text-blue-300">Rs. {trip.fare.toLocaleString('en-IN')}</p>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-navy-700 p-4 bg-slate-50/50 dark:bg-navy-800/30 space-y-3">
                    {/* Route */}
                    <div className="flex items-stretch gap-3 bg-white dark:bg-navy-800/60 rounded-xl p-3 border border-slate-100 dark:border-navy-700">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
                        <div className="flex-1 w-0.5 border-l border-dashed border-slate-300 dark:border-navy-600" />
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Pickup</p>
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-tight">{trip.pickup}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Drop</p>
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-tight">{trip.drop}</p>
                        </div>
                      </div>
                    </div>

                    {/* Detail grid */}
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label:'Trip ID',      value: trip.tripId,  mono: true },
                        { label:'Scheduled',    value: trip.scheduledTime },
                        { label:'Trip Type',    value: typeLabel },
                        { label:'Distance',     value: `${trip.km} km` },
                        { label:'Fare',         value: `Rs. ${trip.fare.toLocaleString('en-IN')}`, highlight: true },
                        { label:'Customer Ph.', value: trip.contact },
                        ...(trip.status === 'completed' ? [
                          { label:'Start', value: trip.startTime },
                          { label:'Duration', value: trip.duration, highlight: true },
                        ] : []),
                      ].map(d => (
                        <div key={d.label} className="bg-white dark:bg-navy-800/60 rounded-xl p-2.5 border border-slate-100 dark:border-navy-700">
                          <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-0.5">{d.label}</p>
                          <p className={`text-xs font-bold leading-tight ${d.mono ? 'font-mono' : ''} ${d.highlight ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>
                            {d.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    {trip.notes && (
                      <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/15 rounded-xl px-3 py-2.5">
                        <AlertTriangle size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700 dark:text-amber-400 font-medium leading-tight">{trip.notes}</p>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <a href={`tel:${trip.contact}`}
                         className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-navy-700 bg-white/60 dark:bg-navy-800/60 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors">
                        <Phone size={13} /> Call
                      </a>
                      {trip.status === 'pending' && (
                        <button onClick={() => startRide(trip.tripId)}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 dark:bg-blue-700 dark:hover:bg-blue-600 text-white text-xs font-bold transition-all shadow-md active:scale-95">
                          <Play size={13} /> Start Ride
                        </button>
                      )}
                      {trip.status === 'driving' && (
                        <button onClick={() => endRide(trip.tripId)}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md active:scale-95">
                          <CheckCircle size={13} /> End Ride
                        </button>
                      )}
                      {trip.status === 'completed' && (
                        <div className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                          <CheckCircle size={13} /> Completed
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Filter, Search } from 'lucide-react'
import { CREATED_TRIPS, TRIP_TYPE_CONFIG, getStatusCfg, TRIP_STATUSES } from '../data/tripTypes'
import PageHeader from '../components/ui/PageHeader'
import Avatar from '../components/ui/Avatar'

function TripTypeBadge({ type }) {
  const cfg = TRIP_TYPE_CONFIG[type]
  if (!cfg) return null
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full ${cfg.badge}`}>
      <span className="text-[11px]">{cfg.icon}</span>
      {cfg.label}
    </span>
  )
}

function StatusBadge({ status }) {
  const cfg = getStatusCfg(status)
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

export default function Trips() {
  const navigate = useNavigate()
  const [search,      setSearch]      = useState('')
  const [typeFilter,  setTypeFilter]  = useState('all')
  const [statusFilter,setStatusFilter]= useState('all')

  const filtered = CREATED_TRIPS.filter(t => {
    const matchSearch = !search ||
      t.customer.toLowerCase().includes(search.toLowerCase()) ||
      t.id.toLowerCase().includes(search.toLowerCase()) ||
      (t.pickup  || t.baseLocation || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.drop || t.destination || '').toLowerCase().includes(search.toLowerCase())
    const matchType   = typeFilter   === 'all' || t.type   === typeFilter
    const matchStatus = statusFilter === 'all' || t.status === statusFilter
    return matchSearch && matchType && matchStatus
  })

  const totalFare = filtered.reduce((s, t) => s + (t.fare || 0), 0)

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Trips"
        subtitle={`${CREATED_TRIPS.length} total trips · May–June 2026`}
        action={
          <button
            onClick={() => navigate('/create-trip')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-navy-900 dark:bg-blue-700 text-white font-bold text-sm hover:bg-navy-800 dark:hover:bg-blue-600 transition-all shadow-lg hover:shadow-xl active:scale-95"
          >
            <Plus size={15} /> Create Trip
          </button>
        }
      />

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Trips',  value: CREATED_TRIPS.length,                                      color: 'text-navy-800 dark:text-blue-300'    },
          { label: 'Active',       value: CREATED_TRIPS.filter(t => t.status === 'active').length,    color: 'text-amber-600 dark:text-amber-400'   },
          { label: 'Scheduled',    value: CREATED_TRIPS.filter(t => t.status === 'scheduled' || t.status === 'confirmed').length, color:'text-blue-600 dark:text-blue-400' },
          { label: 'Total Revenue',value: `Rs. ${CREATED_TRIPS.reduce((s,t)=>s+(t.fare||0),0).toLocaleString('en-IN')}`, color:'text-emerald-600 dark:text-emerald-400' },
        ].map(s => (
          <div key={s.label} className="glass-card rounded-xl px-4 py-3">
            <p className={`text-lg font-display font-black ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2.5 items-center">
        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-navy-700 bg-white/70 dark:bg-navy-800/60 flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="text-slate-400 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search trips, customers…"
            className="bg-transparent text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none w-full font-body"
          />
        </div>

        {/* Type filter */}
        <div className="flex gap-1 bg-slate-100 dark:bg-navy-800 rounded-xl p-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${typeFilter === 'all' ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow' : 'text-slate-500 dark:text-slate-400'}`}
          >
            All Types
          </button>
          {Object.values(TRIP_TYPE_CONFIG).map(cfg => (
            <button
              key={cfg.id}
              onClick={() => setTypeFilter(cfg.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${typeFilter === cfg.id ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow' : 'text-slate-500 dark:text-slate-400'}`}
            >
              {cfg.icon} {cfg.label}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex gap-1 bg-slate-100 dark:bg-navy-800 rounded-xl p-1">
          {['all', 'scheduled', 'confirmed', 'active', 'completed', 'cancelled'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap capitalize ${statusFilter === s ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow' : 'text-slate-500 dark:text-slate-400'}`}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Trip cards */}
      {filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <p className="text-slate-400 dark:text-slate-500 text-sm font-medium">No trips match your filters</p>
          <button onClick={() => { setSearch(''); setTypeFilter('all'); setStatusFilter('all') }}
                  className="mt-3 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {filtered.map(trip => {
            const typeCfg = TRIP_TYPE_CONFIG[trip.type]
            const route = trip.pickup
              ? `${trip.pickup} → ${trip.drop || trip.destination || '—'}`
              : trip.baseLocation
              ? `Base: ${trip.baseLocation}`
              : '—'

            return (
              <div key={trip.id}
                   className="glass-card rounded-2xl overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group">
                {/* Top accent */}
                <div className={`h-1 bg-gradient-to-r ${typeCfg?.gradient}`} />

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${typeCfg?.gradient} flex items-center justify-center text-xl flex-shrink-0 shadow-md`}>
                        {typeCfg?.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-display font-black text-slate-800 dark:text-white text-sm">{trip.customer}</span>
                          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{trip.id}</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{route}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <StatusBadge status={trip.status} />
                      <TripTypeBadge type={trip.type} />
                    </div>
                  </div>

                  {/* Details row */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { label: 'Date',    value: trip.startDate },
                      { label: 'Vehicle', value: trip.vehicle || '—' },
                      { label: 'Driver',  value: trip.driver || 'Self Drive' },
                    ].map(d => (
                      <div key={d.label} className="bg-slate-50 dark:bg-navy-800/50 rounded-xl p-2 text-center">
                        <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-0.5">{d.label}</p>
                        <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">{d.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Type-specific summary */}
                  {trip.type === 'round_trip' && trip.returnDate && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-3">
                      <span className="text-emerald-500">↗</span>
                      <span>Return: {trip.returnDate} at {trip.returnTime}</span>
                    </div>
                  )}
                  {trip.type === 'local_visit' && trip.stops?.length > 0 && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-3">
                      <span className="text-violet-500">📍</span>
                      <span>{trip.stops.length} stops · {trip.waitingTime || 'waiting TBD'}</span>
                    </div>
                  )}
                  {trip.type === 'multi_day' && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-3">
                      <span className="text-amber-500">🗓</span>
                      <span>{trip.numberOfDays} days · {trip.destination}</span>
                    </div>
                  )}
                  {trip.type === 'self_drive' && trip.securityDeposit && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-3">
                      <span className="text-rose-500">🔑</span>
                      <span>Deposit: Rs. {Number(trip.securityDeposit).toLocaleString('en-IN')}</span>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-navy-700">
                    <span className="text-xs font-bold text-navy-800 dark:text-blue-300">
                      {trip.fare ? `Rs. ${trip.fare.toLocaleString('en-IN')}` : '—'}
                    </span>
                    {trip.km && <span className="text-[11px] text-slate-400 dark:text-slate-500">{trip.km} km</span>}
                    {trip.notes && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 max-w-[120px] truncate" title={trip.notes}>
                        📝 {trip.notes}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

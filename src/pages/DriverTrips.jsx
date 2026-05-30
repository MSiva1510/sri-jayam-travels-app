import { useState } from 'react'
import { MapPin, Calendar, Car, IndianRupee, Clock, ChevronDown, ChevronUp, Navigation } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { TRIPS } from '../data/mockData'
import Badge from '../components/ui/Badge'
import PageHeader from '../components/ui/PageHeader'
import Avatar from '../components/ui/Avatar'

export default function DriverTrips() {
  const { user } = useAuth()
  const [expanded, setExpanded] = useState(null)
  const [filter, setFilter] = useState('all')

  // Only show trips assigned to this driver
  const myTrips = TRIPS.filter(t => t.driver.toLowerCase() === user?.name?.toLowerCase())
  const filtered = filter === 'all' ? myTrips : myTrips.filter(t => t.status === filter)

  const totalFare = myTrips.reduce((s, t) => s + t.fare, 0)
  const totalPay  = myTrips.reduce((s, t) => s + t.bata + t.exp, 0)
  const totalKm   = myTrips.reduce((s, t) => s + t.km, 0)
  const doneCount = myTrips.filter(t => t.status === 'done').length

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="My Trips"
        subtitle={`${myTrips.length} assigned trips · May 2026`}
      />

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Trips',  value: myTrips.length, icon: Navigation, color: 'from-navy-700 to-blue-600',    sub: 'this month'   },
          { label: 'Trips Done',   value: doneCount,      icon: Calendar,   color: 'from-emerald-600 to-teal-500', sub: 'completed'    },
          { label: 'Total KM',     value: totalKm,        icon: Car,        color: 'from-violet-600 to-purple-500', sub: 'driven'       },
          { label: 'Your Pay',     value: `Rs. ${totalPay.toLocaleString('en-IN')}`, icon: IndianRupee, color: 'from-amber-500 to-orange-500', sub: 'bata + expenses' },
        ].map(s => (
          <div key={s.label} className="glass-card rounded-2xl p-4 relative overflow-hidden hover:shadow-lg transition-all">
            <div className={`absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-20 blur-xl bg-gradient-to-br ${s.color}`} />
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center mb-2.5`}>
              <s.icon size={15} className="text-white" />
            </div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">{s.label}</p>
            <p className="text-lg font-display font-black text-slate-800 dark:text-white leading-tight">{s.value}</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Driver info card ── */}
      <div className="glass-card rounded-2xl p-5 flex items-center gap-4 flex-wrap">
        <Avatar name={user?.name || ''} size={52} />
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-black text-slate-800 dark:text-white text-lg">{user?.name}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Driver · {user?.vehicleType}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="badge badge-active text-[10px]">{user?.vehicle}</span>
            <span className="badge badge-done text-[10px]">● Active</span>
          </div>
        </div>
        <div className="hidden sm:grid grid-cols-2 gap-3 text-center">
          <div className="bg-slate-50 dark:bg-navy-800/60 rounded-xl px-4 py-2.5">
            <p className="text-base font-black text-navy-800 dark:text-blue-300">Rs. {totalFare.toLocaleString('en-IN')}</p>
            <p className="text-[10px] text-slate-400">Fare collected</p>
          </div>
          <div className="bg-slate-50 dark:bg-navy-800/60 rounded-xl px-4 py-2.5">
            <p className="text-base font-black text-emerald-600 dark:text-emerald-400">Rs. {totalPay.toLocaleString('en-IN')}</p>
            <p className="text-[10px] text-slate-400">Your earnings</p>
          </div>
        </div>
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex gap-1 bg-slate-100 dark:bg-navy-800 rounded-xl p-1 w-fit">
        {[
          { key: 'all',     label: 'All',     count: myTrips.length },
          { key: 'done',    label: 'Done',    count: myTrips.filter(t => t.status === 'done').length },
          { key: 'pending', label: 'Pending', count: myTrips.filter(t => t.status === 'pending').length },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filter === f.key
                ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {f.label}
            <span className={`ml-1.5 text-[10px] ${filter === f.key ? 'text-blue-500' : 'text-slate-400'}`}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Trip cards ── */}
      {filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <Car size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">No trips found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(trip => {
            const isOpen = expanded === trip.id
            const pay    = trip.bata + trip.exp
            return (
              <div
                key={trip.id}
                className="glass-card rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-200"
              >
                {/* Trip header — always visible */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer select-none"
                  onClick={() => setExpanded(isOpen ? null : trip.id)}
                >
                  {/* Date badge */}
                  <div className="w-10 h-10 rounded-xl bg-navy-900 dark:bg-navy-800 flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-[9px] font-bold text-blue-400 uppercase leading-none">{trip.date.slice(3,6)}</span>
                    <span className="text-sm font-black text-white leading-tight">{trip.date.slice(0,2)}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 dark:text-white text-sm truncate">{trip.customer}</p>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      <MapPin size={10} className="flex-shrink-0" />
                      <span className="truncate">{trip.source} → {trip.destination}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge status={trip.status} />
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">Rs. {pay.toLocaleString('en-IN')}</p>
                      <p className="text-[10px] text-slate-400">your pay</p>
                    </div>
                    {isOpen ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                  </div>
                </div>

                {/* Expanded details */}
                {isOpen && (
                  <div className="border-t border-slate-100 dark:border-navy-700 p-4 bg-slate-50/50 dark:bg-navy-800/30">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                      {[
                        { label: 'Vehicle',      value: trip.car },
                        { label: 'Distance',     value: `${trip.km} km` },
                        { label: 'Trip Fare',    value: `Rs. ${trip.fare.toLocaleString('en-IN')}` },
                        { label: 'Toll',         value: trip.toll > 0 ? `Rs. ${trip.toll}` : '—' },
                        { label: 'Your Bata',    value: `Rs. ${trip.bata}` },
                        { label: 'Your Exp',     value: trip.exp > 0 ? `Rs. ${trip.exp}` : '—' },
                        { label: 'Total Pay',    value: `Rs. ${pay.toLocaleString('en-IN')}`, highlight: true },
                        { label: 'Invoice',      value: trip.invNo.slice(-10) },
                      ].map(d => (
                        <div key={d.label} className="bg-white dark:bg-navy-800/60 rounded-xl p-2.5 border border-slate-100 dark:border-navy-700">
                          <p className="text-[9.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-0.5">{d.label}</p>
                          <p className={`text-xs font-bold leading-tight ${d.highlight ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>
                            {d.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Route info */}
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-navy-800/60 rounded-xl p-3 border border-slate-100 dark:border-navy-700">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                        <span>{trip.source}</span>
                      </div>
                      <div className="flex-1 h-px bg-dashed border-t border-dashed border-slate-300 dark:border-navy-600" />
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                        <span>{trip.destination}</span>
                      </div>
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

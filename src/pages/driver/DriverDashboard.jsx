import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Navigation, IndianRupee, Clock, Car, CheckCircle,
  AlertTriangle, Play, History, List, Phone,
  MapPin, ChevronRight, Star, Calendar, Gauge,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import {
  TODAY_TRIPS, TODAY_DAY, DRIVER_STATUSES, TRIP_STATUS_CFG,
  TRIP_TYPES, getTodayStats, getDriverProfile, getDriverVehicle,
} from '../../data/driverData'
import Avatar from '../../components/ui/Avatar'

// ─────────────────────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────────────────────

function StatWidget({ icon: Icon, label, value, sub, gradient, pulse }) {
  return (
    <div className="glass-card rounded-2xl p-3.5 relative overflow-hidden">
      <div className={`absolute -top-5 -right-5 w-16 h-16 rounded-full opacity-15 blur-xl ${gradient}`} />
      <div className={`w-8 h-8 rounded-xl ${gradient} flex items-center justify-center mb-2 relative z-10`}>
        <Icon size={15} className="text-white" />
        {pulse && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white dark:border-navy-800 animate-pulse" />
        )}
      </div>
      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider leading-none mb-1 relative z-10">{label}</p>
      <p className="text-xl font-display font-black text-slate-800 dark:text-white leading-tight relative z-10">{value}</p>
      {sub && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 relative z-10">{sub}</p>}
    </div>
  )
}

function TripStatusPill({ status }) {
  const cfg = TRIP_STATUS_CFG[status] || TRIP_STATUS_CFG.pending
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot} ${status === 'driving' ? 'animate-pulse' : ''}`} />
      {cfg.label}
    </span>
  )
}

function QuickAction({ icon: Icon, label, sub, color, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all duration-200 active:scale-95 text-center w-full
        ${danger
          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50 hover:bg-red-100 dark:hover:bg-red-900/30'
          : 'glass-card hover:shadow-lg hover:-translate-y-0.5'
        }`}
    >
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className={`text-xs font-bold leading-tight ${danger ? 'text-red-700 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}>{label}</p>
        {sub && <p className={`text-[10px] mt-0.5 ${danger ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'}`}>{sub}</p>}
      </div>
    </button>
  )
}

function StatusModal({ current, onSelect, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:w-80 bg-white dark:bg-navy-900 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl z-10 animate-fade-up">
        <div className="w-10 h-1 bg-slate-200 dark:bg-navy-700 rounded-full mx-auto mb-4 sm:hidden" />
        <h3 className="font-display font-black text-slate-800 dark:text-white text-base mb-1">Set Your Status</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Let dispatch know your availability</p>
        <div className="space-y-2">
          {DRIVER_STATUSES.map(s => (
            <button
              key={s.key}
              onClick={() => { onSelect(s.key); onClose() }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all
                ${current === s.key
                  ? `ring-2 ${s.ring} border-transparent bg-slate-50 dark:bg-navy-800`
                  : 'border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800/50 hover:bg-slate-50 dark:hover:bg-navy-800'
                }`}
            >
              <span className={`w-3 h-3 rounded-full flex-shrink-0 ${s.dot} ${current === s.key ? 'animate-pulse' : ''}`} />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{s.label}</span>
              {current === s.key && <span className="ml-auto text-[10px] font-bold text-slate-400 dark:text-slate-500">Current</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ActiveRideBanner({ trip, onEnd }) {
  const [elapsed, setElapsed] = useState('18m')
  useEffect(() => {
    const start = Date.now() - 18 * 60 * 1000
    const tick  = () => {
      const m = Math.floor((Date.now() - start) / 60000)
      const h = Math.floor(m / 60)
      setElapsed(h > 0 ? `${h}h ${m % 60}m` : `${m}m`)
    }
    const timer = setInterval(tick, 30000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="rounded-2xl overflow-hidden shadow-xl"
         style={{ background: 'linear-gradient(135deg,#0d1b4b 0%,#1e3a8a 60%,#1d4ed8 100%)' }}>
      <div className="h-1 bg-blue-400/40 overflow-hidden relative">
        <div className="absolute inset-y-0 bg-blue-400 rounded-full" style={{ width:'40%', animation:'slideX 2s linear infinite' }} />
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-blue-300 text-xs font-bold uppercase tracking-wider">Ride in Progress</span>
          </div>
          <span className="text-white/60 text-xs font-mono">{elapsed}</span>
        </div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-white font-display font-black text-lg leading-tight truncate">{trip.customer}</p>
            <a href={`tel:${trip.contact}`} className="text-blue-300 text-xs mt-0.5 flex items-center gap-1 hover:text-blue-200">
              <Phone size={10} />{trip.contact}
            </a>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-display font-black text-white">Rs. {trip.fare.toLocaleString('en-IN')}</p>
            <p className="text-blue-300 text-[10px]">{trip.km} km</p>
          </div>
        </div>
        <div className="bg-white/8 rounded-xl p-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex flex-col items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <div className="w-0.5 h-6 bg-white/20 rounded" />
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <div>
                <p className="text-[9px] text-white/40 font-bold uppercase">Pickup</p>
                <p className="text-white text-xs font-semibold truncate">{trip.pickup}</p>
              </div>
              <div>
                <p className="text-[9px] text-white/40 font-bold uppercase">Drop</p>
                <p className="text-white text-xs font-semibold truncate">{trip.drop}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <a href={`tel:${trip.contact}`}
             className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-colors">
            <Phone size={14} /> Call Customer
          </a>
          <button onClick={onEnd}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-500/30">
            <CheckCircle size={14} /> End Ride
          </button>
        </div>
      </div>
    </div>
  )
}

function TripCard({ trip, onStart, isNext }) {
  const typeLabel = TRIP_TYPES[trip.tripType] || trip.tripType
  return (
    <div className={`glass-card rounded-2xl overflow-hidden transition-all duration-200 ${isNext ? 'ring-2 ring-blue-400/60 shadow-lg shadow-blue-500/10' : ''}`}>
      <div className={`px-4 pt-3.5 pb-2.5 flex items-center justify-between gap-2 ${isNext ? 'bg-blue-50/80 dark:bg-blue-900/20' : ''}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center ${isNext ? 'bg-blue-600' : 'bg-navy-900 dark:bg-navy-800'}`}>
            <span className="text-[9px] font-bold text-blue-300 uppercase leading-none">{trip.scheduledTime.split(' ')[1]}</span>
            <span className="text-sm font-black text-white leading-tight">{trip.scheduledTime.split(' ')[0]}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              {isNext && <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded-full uppercase tracking-wide">Next up</span>}
              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">{typeLabel}</span>
            </div>
            <p className="font-bold text-slate-800 dark:text-white text-sm leading-tight truncate">{trip.customer}</p>
          </div>
        </div>
        <TripStatusPill status={trip.status} />
      </div>

      <div className="px-4 pb-3 pt-1">
        <div className="flex items-stretch gap-2.5 mb-3">
          <div className="flex flex-col items-center gap-1 pt-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
            <div className="flex-1 w-0.5 border-l border-dashed border-slate-300 dark:border-navy-600 min-h-[14px]" />
            <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            <div>
              <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Pickup</p>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-tight truncate">{trip.pickup}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Drop</p>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-tight truncate">{trip.drop}</p>
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-base font-black text-navy-800 dark:text-blue-300">Rs. {trip.fare.toLocaleString('en-IN')}</p>
            <p className="text-[10px] text-slate-400">{trip.km} km</p>
            <p className="text-[10px] text-slate-400 font-mono">{trip.tripId}</p>
          </div>
        </div>

        {trip.notes && (
          <div className="flex items-start gap-1.5 bg-amber-50 dark:bg-amber-900/15 rounded-lg px-2.5 py-1.5 mb-3">
            <AlertTriangle size={10} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium leading-tight">{trip.notes}</p>
          </div>
        )}

        {trip.status === 'completed' && trip.duration && (
          <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 bg-emerald-50 dark:bg-emerald-900/15 rounded-xl px-3 py-2 mb-3">
            <CheckCircle size={12} className="text-emerald-500 flex-shrink-0" />
            <span>{trip.startTime} – {trip.endTime}</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 ml-auto">{trip.duration}</span>
          </div>
        )}

        <div className="flex gap-2">
          <a href={`tel:${trip.contact}`}
             className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-navy-700 bg-white/60 dark:bg-navy-800/60 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors">
            <Phone size={12} /> Call
          </a>
          {trip.status === 'pending' && (
            <button onClick={() => onStart(trip.tripId)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-navy-900 hover:bg-navy-800 dark:bg-blue-700 dark:hover:bg-blue-600 text-white text-xs font-bold transition-all shadow-md active:scale-95">
              <Play size={12} /> Start Ride
            </button>
          )}
          {trip.status === 'completed' && (
            <div className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
              <CheckCircle size={12} /> Completed
            </div>
          )}
          {trip.status === 'driving' && (
            <button onClick={() => onStart(trip.tripId)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 animate-pulse">
              <Navigation size={12} /> In Progress
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Main page
// ─────────────────────────────────────────────────────────────
export default function DriverDashboard() {
  const { user }   = useAuth()
  const navigate   = useNavigate()
  const driverKey  = user?.username?.toLowerCase() || 'ramanan'
  const driverName = user?.name || 'Ramanan'

  const profile    = getDriverProfile(driverName)
  const vehicle    = getDriverVehicle(user?.vehicle)
  const todayBase  = TODAY_TRIPS[driverKey] || []
  const stats      = getTodayStats(driverName)

  const [driverStatus,    setDriverStatus]    = useState(() => todayBase.some(t => t.status === 'driving') ? 'driving' : 'available')
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [trips,           setTrips]           = useState(todayBase)

  const activeTrip    = trips.find(t => t.status === 'driving')
  const nextTrip      = trips.find(t => t.status === 'pending')
  const currentStatus = DRIVER_STATUSES.find(s => s.key === driverStatus)

  const handleStartRide = (tripId) => {
    setTrips(prev => prev.map(t => t.tripId === tripId ? { ...t, status: 'driving', startTime: 'Now' } : t))
    setDriverStatus('driving')
  }
  const handleEndRide = () => {
    setTrips(prev => prev.map(t => t.status === 'driving' ? { ...t, status: 'completed', endTime: 'Now', duration: '~18m' } : t))
    setDriverStatus('available')
  }

  const hour     = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-4 max-w-lg mx-auto animate-fade-up pb-6">

      {/* Welcome + status */}
      <div className="glass-card rounded-2xl p-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10 blur-3xl bg-gradient-to-br from-blue-500 to-teal-400" />
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar name={driverName} size={48} />
                <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white dark:border-navy-800 ${currentStatus?.dot}`} />
              </div>
              <div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{greeting}</p>
                <h2 className="font-display font-black text-slate-800 dark:text-white text-lg leading-tight">{driverName}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Driver · {user?.vehicleType || '4+1 Sedan'}</p>
              </div>
            </div>
            <button onClick={() => setShowStatusModal(true)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 border-transparent transition-all ${currentStatus?.badge}`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${currentStatus?.dot} ${driverStatus === 'driving' ? 'animate-pulse' : ''}`} />
              <span className="text-xs font-bold whitespace-nowrap">{currentStatus?.label}</span>
            </button>
          </div>
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <Calendar size={12} /><span>{TODAY_DAY}</span>
            </div>
            <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-lg">
              <Star size={11} className="text-amber-500 fill-amber-500" />
              <span className="text-amber-700 dark:text-amber-400 font-bold text-[11px]">{profile?.rating ?? 4.8}</span>
              <span className="text-amber-600 dark:text-amber-600 text-[10px]"> rating</span>
            </div>
          </div>
        </div>
      </div>

      {/* Active ride banner */}
      {activeTrip && <ActiveRideBanner trip={activeTrip} onEnd={handleEndRide} />}

      {/* Stats */}
      <div>
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2.5 px-0.5">Today's Summary</p>
        <div className="grid grid-cols-2 gap-2.5">
          <StatWidget icon={Navigation}    label="Total Trips"    value={stats.totalTrips}    sub={`${stats.completedTrips} completed`}   gradient="bg-gradient-to-br from-navy-700 to-blue-600" />
          <StatWidget icon={IndianRupee}   label="Earnings Today" value={`Rs. ${stats.earningsToday.toLocaleString('en-IN')}`} sub="Bata + expenses" gradient="bg-gradient-to-br from-emerald-600 to-teal-500" pulse />
          <StatWidget icon={Clock}         label="Hours on Road"  value={`${stats.hoursOnRoad}h`} sub="Active time"          gradient="bg-gradient-to-br from-violet-600 to-purple-500" />
          <StatWidget icon={Car}           label="Pending Trips"  value={stats.pendingTrips}  sub="Yet to complete"           gradient="bg-gradient-to-br from-amber-500 to-orange-500" />
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2.5 px-0.5">Quick Actions</p>
        <div className="grid grid-cols-2 gap-2.5">
          <QuickAction icon={Play}          label="Start Ride"       sub={nextTrip ? nextTrip.customer : 'No pending trips'}  color="bg-gradient-to-br from-navy-700 to-blue-600"    onClick={() => nextTrip && handleStartRide(nextTrip.tripId)} />
          <QuickAction icon={List}          label="Assigned Trips"   sub={`${trips.length} trips today`}                      color="bg-gradient-to-br from-teal-600 to-cyan-500"    onClick={() => navigate('/assigned-trips')} />
          <QuickAction icon={History}       label="Ride History"     sub="Past trips & earnings"                              color="bg-gradient-to-br from-violet-600 to-purple-500" onClick={() => navigate('/ride-history')} />
          <QuickAction icon={AlertTriangle} label="Emergency"        sub="SOS — Contact office"                               color="bg-gradient-to-br from-red-600 to-rose-500"      onClick={() => window.confirm('Call Sri Jayam Travels office?\n+91 94423 37470') && window.open('tel:+919442337470')} danger />
        </div>
      </div>

      {/* Today's schedule */}
      <div>
        <div className="flex items-center justify-between mb-2.5 px-0.5">
          <div>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Today's Schedule</p>
            <p className="font-display font-black text-slate-800 dark:text-white text-sm">{trips.length} trips assigned</p>
          </div>
          <button onClick={() => navigate('/assigned-trips')}
                  className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
            View all <ChevronRight size={13} />
          </button>
        </div>
        {trips.length === 0 ? (
          <div className="glass-card rounded-2xl p-10 text-center">
            <Car size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="font-semibold text-slate-500 dark:text-slate-400 text-sm">No trips assigned for today</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Contact the office for trip assignments</p>
          </div>
        ) : (
          <div className="space-y-3">
            {trips.map((trip, i) => (
              <TripCard
                key={trip.tripId}
                trip={trip}
                onStart={handleStartRide}
                isNext={trip.status === 'pending' && i === trips.findIndex(t => t.status === 'pending')}
              />
            ))}
          </div>
        )}
      </div>

      {/* Vehicle strip */}
      {vehicle && (
        <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-navy-900 dark:bg-navy-800 flex items-center justify-center flex-shrink-0">
            <Car size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800 dark:text-white text-sm">{user?.vehicle}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{vehicle.model} · {vehicle.fuelType}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 justify-end">
              <Gauge size={12} /><span>{vehicle.km.toLocaleString()} km</span>
            </div>
            <p className={`text-[10px] font-bold mt-0.5 ${vehicle.status === 'active' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
              {vehicle.status === 'active' ? '● Ready' : '⚠ Service'}
            </p>
          </div>
        </div>
      )}

      {showStatusModal && (
        <StatusModal current={driverStatus} onSelect={setDriverStatus} onClose={() => setShowStatusModal(false)} />
      )}
    </div>
  )
}

import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Phone, Mail, Car, Star,
  Calendar, Shield, MapPin, Clock,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getDriverProfile, getDriverVehicle, getDriverHistory, getTodayStats } from '../../data/driverData'
import Avatar from '../../components/ui/Avatar'
import { loadSettlements, monthLabel, getSettlementStatusCfg } from '../../data/settlementData'

function InfoRow({ icon: Icon, label, value, highlight }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 dark:border-navy-700 last:border-0">
      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-navy-700 flex items-center justify-center flex-shrink-0">
        <Icon size={13} className="text-slate-500 dark:text-slate-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{label}</p>
        <p className={`text-sm font-semibold leading-tight ${highlight ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>
          {value}
        </p>
      </div>
    </div>
  )
}

export default function DriverProfile() {
  const [bookings,    setBookings]    = useState([])
  const [settlements, setSettlements] = useState([])
  const [payslips,    setPayslips]    = useState([])
  useEffect(() => {
    Promise.all([loadBookings(), loadSettlements(), loadTripPayslips()]).then(([b,s,p]) => {
      setBookings(Array.isArray(b) ? b : [])
      setSettlements(Array.isArray(s) ? s : [])
      setPayslips(Array.isArray(p) ? p : [])
    })
  }, [])

  const { user }  = useAuth()
  const navigate  = useNavigate()
  const profile   = getDriverProfile(user?.name)
  const vehicle   = getDriverVehicle(user?.vehicle)
  const history   = getDriverHistory(user?.name)
  const stats     = getTodayStats(user?.name)

  const totalEarnings = history.reduce((s, t) => s + t.earnings, 0)
  const totalKm       = history.reduce((s, t) => s + t.km, 0)
  const totalFare     = history.reduce((s, t) => s + t.fare, 0)

  return (
    <div className="space-y-4 max-w-7xl mx-auto animate-fade-up pb-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/driver')}
          className="w-9 h-9 rounded-xl border border-slate-200 dark:border-navy-700 bg-white/60 dark:bg-navy-800/60 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors flex-shrink-0"
        >
          <ArrowLeft size={17} />
        </button>
        <div>
          <h1 className="font-display font-black text-slate-800 dark:text-white text-xl">My Profile</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Driver account details</p>
        </div>
      </div>

      {/* Profile hero card */}
      <div className="rounded-2xl overflow-hidden shadow-xl"
           style={{ background: 'linear-gradient(135deg,#0d1b4b 0%,#1e3a8a 60%,#152a7a 100%)' }}>
        {/* Decorative dots */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5" />
          <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-white/5" />
        </div>

        <div className="relative p-5">
          <div className="flex items-start gap-4 mb-5">
            <div className="relative flex-shrink-0">
              <Avatar name={user?.name || ''} size={64} />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-400 border-2 border-navy-900 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-display font-black text-white text-xl leading-tight">{user?.name}</h2>
              <p className="text-white/60 text-sm mt-0.5">Driver · Sri Jayam Travels</p>
              <p className="text-white/40 text-xs mt-0.5 flex items-center gap-1">
                <Phone size={10} />{user?.phone}
              </p>
              <p className="text-white/40 text-xs flex items-center gap-1">
                <Mail size={10} />{user?.email}
              </p>
            </div>
            {/* Rating */}
            <div className="flex flex-col items-center gap-1 flex-shrink-0 bg-white/10 rounded-2xl px-3 py-2.5 border border-white/15">
              <Star size={16} className="text-amber-400 fill-amber-400" />
              <span className="text-xl font-black text-white">{profile?.rating ?? 4.8}</span>
              <span className="text-[9px] text-white/50 font-bold uppercase">Rating</span>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Trips',    value: profile?.trips ?? history.length },
              { label: 'KM',       value: totalKm.toLocaleString()         },
              { label: 'Earnings', value: `Rs.${(totalEarnings/1000).toFixed(1)}k` },
              { label: 'Joined',   value: profile?.joined ?? user?.joined  },
            ].map(s => (
              <div key={s.label} className="bg-white/8 rounded-xl px-2 py-2 text-center">
                <p className="text-white font-display font-black text-sm leading-tight">{s.value}</p>
                <p className="text-white/40 text-[9px] font-bold uppercase mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Vehicle card */}
      {vehicle && (
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Assigned Vehicle</p>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-navy-900 dark:bg-navy-800 flex items-center justify-center flex-shrink-0">
              <Car size={22} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-black text-slate-800 dark:text-white text-base leading-tight">{vehicle.reg}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{vehicle.model} · {vehicle.year}</p>
            </div>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${vehicle.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
              {vehicle.status === 'active' ? '● Ready' : '⚠ Service'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Type',        value: vehicle.type     },
              { label: 'Fuel',        value: vehicle.fuelType },
              { label: 'Odometer',    value: `${vehicle.km.toLocaleString()} km` },
              { label: 'Color',       value: vehicle.color    },
              { label: 'Insurance',   value: vehicle.ins      },
              { label: 'Last Service',value: vehicle.lastService },
            ].map(d => (
              <div key={d.label} className="bg-slate-50 dark:bg-navy-800/60 rounded-xl p-2.5">
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-0.5">{d.label}</p>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{d.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Personal info */}
      <div className="glass-card rounded-2xl p-4">
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Personal Details</p>
        <div>
          <InfoRow icon={Phone}    label="Mobile"          value={user?.phone}     />
          <InfoRow icon={Mail}     label="Email"           value={user?.email}     />
          <InfoRow icon={Calendar} label="Joined"          value={profile?.joined ?? user?.joined} />
          <InfoRow icon={Shield}   label="Licence No."     value={profile?.license ?? 'TN-01-2022-012345'} />
          <InfoRow icon={MapPin}   label="Base Location"   value="Puducherry, India" />
          <InfoRow icon={Car}      label="Vehicle Type"    value={user?.vehicleType ?? '4+1 Sedan'} />
        </div>
      </div>

      {/* Monthly performance */}
      <div className="glass-card rounded-2xl p-4">
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">May 2026 Performance</p>
        <div className="space-y-3">
          {[
            { label:'Trips Completed', value: `${history.filter(t=>t.status==='completed').length} / ${history.length}`, pct: Math.round((history.filter(t=>t.status==='completed').length/Math.max(history.length,1))*100), color:'bg-gradient-to-r from-emerald-500 to-teal-400' },
            { label:'Fare Collected',  value: `Rs. ${totalFare.toLocaleString('en-IN')}`, pct: 82, color:'bg-gradient-to-r from-navy-700 to-blue-500' },
            { label:'Earnings Share',  value: `${Math.round((totalEarnings/Math.max(totalFare,1))*100)}% of fare`, pct: Math.round((totalEarnings/Math.max(totalFare,1))*100), color:'bg-gradient-to-r from-violet-500 to-purple-400' },
          ].map(s => (
            <div key={s.label}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-600 dark:text-slate-300">{s.label}</span>
                <span className="font-bold text-slate-800 dark:text-white">{s.value}</span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden">
                <div className={`h-full ${s.color} rounded-full transition-all duration-700`} style={{ width: `${s.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Module 11: Payroll strip */}
      {(() => {
        const mySettlements = settlements.filter(s => s.driver === user?.name)
        if (settlements.length === 0) return null
        const latest   = settlements[0]
        const current  = settlements.find(s => {
          const now = new Date()
          return s.month === now.getMonth()+1 && s.year === now.getFullYear()
        })
        const lastPaid = settlements.find(s => s.status === 'paid')
        const stCfg    = getSettlementStatusCfg(latest.status)
        return (
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Payroll</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-50 dark:bg-navy-800/60 rounded-xl p-2.5 text-center col-span-2">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">
                  {current ? 'Current Month' : 'Latest Settlement'}
                </p>
                <p className="text-lg font-display font-black text-emerald-600 dark:text-emerald-400">
                  Rs. {(current || latest).netAmount.toLocaleString('en-IN')}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">{monthLabel((current||latest).month,(current||latest).year)}</p>
              </div>
              <div className="bg-slate-50 dark:bg-navy-800/60 rounded-xl p-2.5 text-center">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Status</p>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${stCfg.badge}`}>{stCfg.label}</span>
                {lastPaid && <p className="text-[10px] text-slate-400 mt-1">Last paid<br/>{monthLabel(lastPaid.month,lastPaid.year)}</p>}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Achievements */}
      <div className="glass-card rounded-2xl p-4">
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Achievements</p>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { icon:'🏆', label:'Top Driver',      sub:'May 2026',        earned: true },
            { icon:'⭐', label:'4.8 Rating',      sub:'Above average',   earned: true },
            { icon:'🚗', label:'1000+ KM',        sub:'This month',      earned: true },
            { icon:'⚡', label:'On-Time 100%',   sub:'All trips',       earned: false },
            { icon:'💎', label:'VIP Customer',   sub:'3+ repeat guests', earned: false },
            { icon:'🎯', label:'Zero Incidents', sub:'Safety record',    earned: true },
          ].map(a => (
            <div key={a.label} className={`rounded-xl p-3 text-center border ${a.earned ? 'bg-amber-50 dark:bg-amber-900/15 border-amber-200 dark:border-amber-800/40' : 'bg-slate-50 dark:bg-navy-800/40 border-slate-200 dark:border-navy-700 opacity-50'}`}>
              <div className="text-xl mb-1">{a.icon}</div>
              <p className={`text-[10px] font-bold leading-tight ${a.earned ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-slate-500'}`}>{a.label}</p>
              <p className="text-[9px] text-slate-400 dark:text-slate-600 mt-0.5">{a.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
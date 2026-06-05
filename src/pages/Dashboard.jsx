import {
  TrendingUp, IndianRupee, Car, Receipt,
  CheckCircle, Clock, Users, Fuel, Plus, FileText,
  ShieldOff, CalendarCheck, BookOpen,
  Zap, XCircle, AlertTriangle, Wrench, Shield,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import StatCard   from '../components/ui/StatCard'
import Avatar     from '../components/ui/Avatar'
import Badge      from '../components/ui/Badge'
import Button     from '../components/ui/Button'
import PageHeader from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import {
  TRIPS, DRIVERS, EXPENSES, VEHICLES,
  totalFare, totalNet, totalKm, totalExp,
  doneTrips, pendingTrips, monthlyFare,
} from '../data/mockData'
import { loadAttendanceToday } from '../data/attendanceData'
import { loadBookings, getStatusCfg, TRIP_TYPE_CONFIG } from '../data/tripTypes'
import { docStatus, daysLabel } from './Vehicles'

// ── Blocked section placeholder ───────────────────────────────
function AccessBlocked({ label }) {
  return (
    <div className="glass-card rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-2 min-h-[120px]">
      <ShieldOff size={22} className="text-slate-300 dark:text-slate-600" />
      <p className="text-sm font-bold text-slate-400 dark:text-slate-500">{label}</p>
      <p className="text-xs text-slate-300 dark:text-slate-600">Not available for your role</p>
    </div>
  )
}

function BarChart({ data }) {
  const max = Math.max(...data.map(d => d.fare))
  return (
    <div className="flex items-end gap-1.5 h-24 w-full">
      {data.map((d, i) => {
        const pct    = Math.round((d.fare / max) * 100)
        const isLast = i === data.length - 1
        return (
          <div key={d.month} className="flex flex-col items-center gap-1 flex-1">
            <div className="w-full relative group">
              <div className={`w-full rounded-t-md transition-all duration-500 ${isLast ? 'bg-gradient-to-t from-blue-600 to-blue-400 shadow-lg shadow-blue-500/30' : 'bg-slate-200 dark:bg-navy-700 group-hover:bg-slate-300 dark:group-hover:bg-navy-600'}`}
                   style={{ height: `${Math.max(pct * 0.88, 6)}px` }} />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-navy-900 text-white text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap pointer-events-none z-10">
                Rs. {d.fare.toLocaleString('en-IN')}
              </div>
            </div>
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">{d.month}</span>
          </div>
        )
      })}
    </div>
  )
}

function DonutRing({ pct, color, size = 110 }) {
  const r = 24, cx = 32, cy = 32, circ = 2 * Math.PI * r, dash = (pct / 100) * circ
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="-rotate-90">
      <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth="6" className="stroke-slate-200 dark:stroke-navy-700" />
      <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth="6" stroke={color}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition:'stroke-dasharray 0.6s ease' }} />
    </svg>
  )
}

export default function Dashboard() {
  const { can, isAdmin, isManager } = useAuth()
  const navigate = useNavigate()

  const todayAttendance = loadAttendanceToday()
  const presentCount    = todayAttendance.filter(a => a.status === 'present' || a.status === 'half-day').length
  const absentCount     = todayAttendance.filter(a => a.status === 'absent').length

  // ── Booking data ──────────────────────────────────────────
  const bookings         = loadBookings()
  const todayStr         = new Date().toISOString().slice(0, 10)
  const bookingToday     = bookings.filter(b => b.startDate === todayStr)
  const bookingActive    = bookings.filter(b => b.status === 'started')
  const bookingCompleted = bookings.filter(b => b.status === 'completed')
  const bookingCancelled = bookings.filter(b => b.status === 'cancelled')
  const bookingPending   = bookings.filter(b => ['draft','confirmed','assigned'].includes(b.status))

  // ── Vehicle data ──────────────────────────────────────────
  const availableVehicles   = VEHICLES.filter(v => v.status === 'active').length
  const maintenanceVehicles = VEHICLES.filter(v => v.status === 'maintenance').length
  const vehicleDocAlerts = VEHICLES.flatMap(v =>
    [
      { label:`${v.reg} Insurance`,  expiry: v.insExpiry    },
      { label:`${v.reg} Permit`,     expiry: v.permitExpiry },
      { label:`${v.reg} FC`,         expiry: v.fcExpiry     },
      { label:`${v.reg} PUC`,        expiry: v.pucExpiry    },
    ].filter(d => { const s = docStatus(d.expiry); return s.key === 'expired' || s.key === 'soon' })
     .map(d => ({ ...d, st: docStatus(d.expiry) }))
  )

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        title="Dashboard"
        subtitle="Overview — May 2026"
        action={can('trips') ? <Button icon={Plus} variant="primary" onClick={() => navigate('/trips')}>New Booking</Button> : null}
      />

      {/* ── KPI Stats ── */}
      {can('revenueDashboard') ? (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Total Fare"  value={`Rs. ${totalFare.toLocaleString('en-IN')}`}  sub={`${TRIPS.length} trips`}      icon={IndianRupee} gradient="bg-gradient-to-br from-navy-700 to-blue-600"    trend={8.4} trendUp={true}  />
          <StatCard label="Net Income"  value={`Rs. ${totalNet.toLocaleString('en-IN')}`}   sub="After trip costs"             icon={TrendingUp}  gradient="bg-gradient-to-br from-emerald-600 to-teal-500" trend={5.2} trendUp={true}  />
          <StatCard label="Total KM"    value={totalKm.toLocaleString('en-IN')}             sub="Kilometres covered"           icon={Car}         gradient="bg-gradient-to-br from-violet-600 to-purple-500"             />
          <StatCard label="Expenses"    value={`Rs. ${totalExp.toLocaleString('en-IN')}`}   sub={`${EXPENSES.length} entries`} icon={Receipt}     gradient="bg-gradient-to-br from-amber-500 to-orange-500"  trend={2.1} trendUp={false} />
        </div>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Total Trips"   value={TRIPS.length}              sub="This month"          icon={Car}         gradient="bg-gradient-to-br from-navy-700 to-blue-600"    />
          <StatCard label="Bills Done"    value={doneTrips}                 sub="Invoices generated"  icon={CheckCircle} gradient="bg-gradient-to-br from-emerald-600 to-teal-500" />
          <StatCard label="Total KM"      value={totalKm.toLocaleString()}  sub="Kilometres covered"  icon={Car}         gradient="bg-gradient-to-br from-violet-600 to-purple-500" />
          <StatCard label="Pending Bills" value={pendingTrips}              sub="Awaiting invoice"    icon={Clock}       gradient="bg-gradient-to-br from-amber-500 to-orange-500"  />
        </div>
      )}

      {/* ── Booking Widgets ── */}
      {!can('revenueDashboard') === false || can('trips') ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Booking Management</p>
              <h3 className="font-display font-black text-slate-800 dark:text-white text-lg">Booking Overview</h3>
            </div>
            <button onClick={() => navigate('/trips')}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors flex items-center gap-1">
              View all →
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label:'Total Bookings', value: bookings.length,         icon: BookOpen,    color:'text-navy-800 dark:text-blue-300',         bg:'bg-navy-50 dark:bg-navy-800/60',          onClick:()=>navigate('/trips') },
              { label:"Today's Trips",  value: bookingToday.length,     icon: CalendarCheck,color:'text-blue-600 dark:text-blue-400',        bg:'bg-blue-50 dark:bg-blue-900/20',          onClick:()=>navigate('/trips') },
              { label:'Active Trips',   value: bookingActive.length,    icon: Zap,         color:'text-amber-600 dark:text-amber-400',       bg:'bg-amber-50 dark:bg-amber-900/20',        onClick:()=>navigate('/trips') },
              { label:'Completed',      value: bookingCompleted.length, icon: CheckCircle, color:'text-emerald-600 dark:text-emerald-400',   bg:'bg-emerald-50 dark:bg-emerald-900/20',    onClick:()=>navigate('/trips') },
              { label:'Cancelled',      value: bookingCancelled.length, icon: XCircle,     color:'text-red-600 dark:text-red-400',           bg:'bg-red-50 dark:bg-red-900/20',            onClick:()=>navigate('/trips') },
            ].map(s => (
              <div key={s.label} onClick={s.onClick}
                className="glass-card rounded-2xl p-3.5 flex items-center gap-3 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 cursor-pointer">
                <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
                  <s.icon size={16} className={s.color} />
                </div>
                <div className="min-w-0">
                  <p className={`text-xl font-display font-black leading-none ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Today's bookings quick list ── */}
      {bookingToday.length > 0 && (
        <div>
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5">Today's Schedule</p>
          <div className="glass-card rounded-2xl overflow-hidden">
            {bookingToday.slice(0, 4).map((b, i) => {
              const typeCfg = TRIP_TYPE_CONFIG[b.type]
              const stCfg   = getStatusCfg(b.status)
              return (
                <div key={b.id} onClick={() => navigate('/trips')}
                  className="flex items-center gap-3 px-4 py-3 border-b border-slate-50 dark:border-navy-800 last:border-0 hover:bg-blue-50/40 dark:hover:bg-navy-800/40 transition-colors cursor-pointer">
                  <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${typeCfg?.gradient || 'from-slate-400 to-slate-500'} flex items-center justify-center text-sm flex-shrink-0`}>
                    {typeCfg?.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{b.customer}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                      {b.startTime && `${b.startTime} · `}{b.pickup}{b.drop ? ` → ${b.drop}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full ${stCfg.badge}`}>
                      <span className={`w-1 h-1 rounded-full ${stCfg.dot.replace(' animate-pulse','')}`} />
                      {stCfg.label}
                    </span>
                    {b.driver && <p className="text-[10px] text-slate-400">{b.driver}</p>}
                  </div>
                </div>
              )
            })}
            {bookingToday.length > 4 && (
              <div className="px-4 py-2.5 text-center">
                <button onClick={() => navigate('/trips')} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors">
                  +{bookingToday.length - 4} more trips today →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Pending assignments notice ── */}
      {bookingPending.filter(b => !b.driver).length > 0 && (isAdmin || isManager) && (
        <div className="flex items-center justify-between gap-3 bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/30 rounded-2xl px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
              <Users size={15} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                {bookingPending.filter(b => !b.driver).length} trip{bookingPending.filter(b => !b.driver).length !== 1 ? 's' : ''} need driver assignment
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-500">Confirmed bookings without a driver</p>
            </div>
          </div>
          <button onClick={() => navigate('/trips')}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold transition-all active:scale-95 shadow-md flex-shrink-0">
            Assign
          </button>
        </div>
      )}

      {/* ── Vehicle dashboard widgets ── */}
      {can('vehicles') && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Fleet Management</p>
              <h3 className="font-display font-black text-slate-800 dark:text-white text-lg">Vehicle Overview</h3>
            </div>
            <button onClick={() => navigate('/vehicles')}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors">
              View all →
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label:'Total Vehicles',  value: VEHICLES.length,       icon: Car,       color:'text-navy-800 dark:text-blue-300',         bg:'bg-navy-50 dark:bg-navy-800/60'        },
              { label:'Available',       value: availableVehicles,      icon: CheckCircle,color:'text-emerald-600 dark:text-emerald-400',  bg:'bg-emerald-50 dark:bg-emerald-900/20'  },
              { label:'Maintenance',     value: maintenanceVehicles,    icon: Wrench,    color:'text-red-600 dark:text-red-400',           bg:'bg-red-50 dark:bg-red-900/20'          },
              { label:'Doc Alerts',      value: vehicleDocAlerts.length,icon: AlertTriangle, color:'text-amber-600 dark:text-amber-400',  bg:'bg-amber-50 dark:bg-amber-900/20'      },
            ].map(s => (
              <div key={s.label} onClick={() => navigate('/vehicles')}
                className="glass-card rounded-2xl p-3.5 flex items-center gap-3 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 cursor-pointer">
                <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
                  <s.icon size={16} className={s.color} />
                </div>
                <div className="min-w-0">
                  <p className={`text-xl font-display font-black leading-none ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Vehicle doc expiry alert ── */}
      {vehicleDocAlerts.length > 0 && can('vehicles') && (
        <div className="bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/30 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                {vehicleDocAlerts.length} vehicle document{vehicleDocAlerts.length !== 1 ? 's' : ''} need attention
              </p>
            </div>
            <button onClick={() => navigate('/vehicles')}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold transition-all active:scale-95 shadow-md flex-shrink-0">
              Review
            </button>
          </div>
          <div className="space-y-1.5">
            {vehicleDocAlerts.slice(0, 4).map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 truncate">{a.label}</p>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${a.st.badge}`}>{a.st.label}</span>
                  <span className="text-[10px] text-amber-600 dark:text-amber-500 font-mono">{a.expiry}</span>
                </div>
              </div>
            ))}
            {vehicleDocAlerts.length > 4 && (
              <p className="text-[10px] text-amber-600 dark:text-amber-500 font-semibold pt-1">
                +{vehicleDocAlerts.length - 4} more — view all in Vehicles
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Mini stat chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:'Bills Done',    value: doneTrips,       icon: CheckCircle, color:'text-emerald-500', bg:'bg-emerald-50 dark:bg-emerald-900/20' },
          { label:'Pending Bills', value: pendingTrips,    icon: Clock,       color:'text-amber-500',   bg:'bg-amber-50 dark:bg-amber-900/20'     },
          { label:'Drivers',       value: DRIVERS.length,  icon: Users,       color:'text-blue-500',    bg:'bg-blue-50 dark:bg-blue-900/20'       },
          { label:'Vehicles',      value: VEHICLES.length, icon: Fuel,        color:'text-violet-500',  bg:'bg-violet-50 dark:bg-violet-900/20'   },
        ].map(s => (
          <div key={s.label} className="glass-card rounded-2xl p-4 flex items-center gap-3 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <s.icon size={18} className={s.color} />
            </div>
            <div>
              <p className="text-2xl font-display font-black text-slate-800 dark:text-white leading-none">{s.value}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Attendance strip ── */}
      {can('attendance') && (
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CalendarCheck size={16} className="text-navy-700 dark:text-blue-400" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Today's Attendance</p>
            </div>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {new Date().toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short' })}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label:'Present',  value: presentCount, dot:'bg-emerald-500', text:'text-emerald-600 dark:text-emerald-400' },
              { label:'Absent',   value: absentCount,  dot:'bg-red-500',     text:'text-red-600 dark:text-red-400' },
              { label:'On Leave', value: todayAttendance.filter(a=>a.status==='leave').length,    dot:'bg-amber-500', text:'text-amber-600 dark:text-amber-400' },
              { label:'Half Day', value: todayAttendance.filter(a=>a.status==='half-day').length, dot:'bg-blue-500',  text:'text-blue-600 dark:text-blue-400' },
            ].map(s => (
              <div key={s.label} className="bg-slate-50 dark:bg-navy-800/60 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1"><span className={`w-2 h-2 rounded-full ${s.dot}`} /></div>
                <p className={`text-xl font-display font-black ${s.text}`}>{s.value}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {can('revenueDashboard') ? (
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Monthly Fare</p>
                <p className="text-lg font-display font-black text-slate-800 dark:text-white">6-month trend</p>
              </div>
              <span className="badge badge-active">May</span>
            </div>
            <BarChart data={monthlyFare} />
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-navy-700 flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Total (May)</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">Rs. {totalFare.toLocaleString('en-IN')}</span>
            </div>
          </div>
        ) : (
          <AccessBlocked label="Revenue Chart" />
        )}

        {can('profitReports') ? (
          <div className="glass-card rounded-2xl p-5 flex flex-col">
            <div className="mb-4">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Profit Breakdown</p>
              <p className="text-lg font-display font-black text-slate-800 dark:text-white">Income vs Costs</p>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <div className="relative">
                <DonutRing pct={Math.round((totalNet / totalFare) * 100)} color="#10b981" />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-xl font-display font-black text-slate-800 dark:text-white">{Math.round((totalNet / totalFare) * 100)}%</p>
                  <p className="text-[10px] text-slate-400">margin</p>
                </div>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {[
                { label:'Trip Revenue', amt:totalFare, color:'bg-blue-500'    },
                { label:'Net Income',   amt:totalNet,  color:'bg-emerald-500' },
                { label:'Expenses',     amt:totalExp,  color:'bg-amber-500'   },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2"><div className={`w-2.5 h-2.5 rounded-full ${r.color}`} /><span className="text-slate-500 dark:text-slate-400">{r.label}</span></div>
                  <span className="font-bold text-slate-700 dark:text-slate-200">Rs. {r.amt.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <AccessBlocked label="Profit Reports" />
        )}

        {/* Driver pay — always visible */}
        <div className="glass-card rounded-2xl p-5">
          <div className="mb-4">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Driver Stats</p>
            <p className="text-lg font-display font-black text-slate-800 dark:text-white">Pay summary</p>
          </div>
          <div className="space-y-4">
            {DRIVERS.map(d => {
              const driverTrips = TRIPS.filter(t => t.driver === d.name)
              const farePct     = Math.round((driverTrips.reduce((s,t) => s+t.fare,0) / totalFare) * 100)
              return (
                <div key={d.id}>
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <Avatar name={d.name} size={28} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{d.name}</p>
                      <p className="text-[10px] text-slate-400">{driverTrips.length} trips</p>
                    </div>
                    {can('financialAnalytics') && (
                      <p className="text-xs font-bold text-red-500">Rs. {(d.totalBata+d.totalExp).toLocaleString('en-IN')}</p>
                    )}
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 rounded-full" style={{ width: `${farePct}%` }} />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{farePct}% of total fare</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Recent trips table ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">Recent Activity</p>
            <h3 className="font-display font-black text-slate-800 dark:text-white text-lg">Latest Trips</h3>
          </div>
          <Button icon={FileText} variant="outline" size="sm" onClick={() => navigate('/trips')}>View All</Button>
        </div>
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-navy-700 bg-slate-50/80 dark:bg-navy-800/50">
                  {['Customer','Route','Driver','KM',
                    ...(can('revenueDashboard') ? ['Fare','Net'] : []),
                    'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TRIPS.slice(0,7).map(t => (
                  <tr key={t.id} className="border-b border-slate-50 dark:border-navy-800 hover:bg-blue-50/40 dark:hover:bg-navy-800/50 transition-colors cursor-pointer" onClick={() => navigate('/trips')}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={t.customer} size={28} />
                        <div>
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">{t.customer}</p>
                          <p className="text-[10px] text-slate-400">{t.date}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">{t.source} <span className="text-slate-300 dark:text-slate-500 mx-1">→</span> {t.destination}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{t.driver}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{t.km} km</td>
                    {can('revenueDashboard') && <>
                      <td className="px-4 py-3 text-xs font-bold text-navy-800 dark:text-blue-300 whitespace-nowrap">Rs. {t.fare.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-xs font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">Rs. {t.net.toLocaleString('en-IN')}</td>
                    </>}
                    <td className="px-4 py-3"><Badge status={t.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

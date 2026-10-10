import { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, IndianRupee, Car, Receipt,
  CheckCircle, Clock, Users, Fuel, Plus, FileText,
  ShieldOff, CalendarCheck, BookOpen,
  Zap, XCircle, AlertTriangle, Wrench, Filter,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Avatar     from '../components/ui/Avatar'
import Badge      from '../components/ui/Badge'
import Button     from '../components/ui/Button'
import Surface        from '../components/ui/Surface'
import SectionHeader  from '../components/ui/SectionHeader'
import SegmentedControl from '../components/ui/SegmentedControl'
import MetricCard, { METRIC_TONES } from '../components/ui/MetricCard'
import StatusPill from '../components/ui/StatusPill'
import SparkChart from '../components/ui/SparkChart'
import EmptyState from '../components/ui/EmptyState'
import Callout    from '../components/ui/Callout'
import { useAuth } from '../context/AuthContext'
import { loadDrivers } from '../data/driverData'
import { loadVehicles } from '../data/vehicleData'
import { fleetAlertRepository } from '../repositories'
import { loadAttendanceToday }                         from '../data/attendanceData'
import { loadCustomers }                               from '../data/customerData'
import { loadExpenses, summariseByType, isThisMonth, getExpenseDate }  from '../data/expenseData'
import { loadBookings, getStatusCfg, TRIP_TYPE_CONFIG } from '../data/tripTypes'
import { loadSettlements }                             from '../data/settlementData'
import { docStatus }                                   from '../utils/vehicleUtils'
import LiveFleetBoard                                  from '../components/fleet/LiveFleetBoard'
import { loadRecentActivity, fmtAuditTime }            from '../data/auditLogData'

// ── Local date helpers (IST-safe) ─────────────────────────────
// toISOString() is UTC: at 00:00–05:30 IST it still returns yesterday /
// last month. Dashboards compare against stored local YYYY-MM-DD strings,
// so build the keys from local parts instead.
const toLocalDateStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const toLocalMonthStr = (d = new Date()) => toLocalDateStr(d).slice(0, 7)

// ── Blocked section placeholder ───────────────────────────────
function AccessBlocked({ label }) {
  return (
    <Surface className="flex items-center min-h-[160px]">
      <EmptyState
        icon={ShieldOff}
        title={label}
        description="Not available for your role"
        className="w-full"
      />
    </Surface>
  )
}

// ── Compact horizontal metric tile (booking / vehicle / section grids) ──
function MiniStat({ icon: Icon, value, label, tone = 'blue', onClick }) {
  const chip = METRIC_TONES[tone] || METRIC_TONES.blue
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`ap-surface ap-focus p-3.5 flex items-center gap-3 text-left w-full ${onClick ? 'ios-press cursor-pointer' : ''}`}
    >
      <span className={`w-9 h-9 rounded-[11px] flex items-center justify-center flex-shrink-0 ${chip}`} aria-hidden="true">
        <Icon size={16} strokeWidth={2.25} />
      </span>
      <span className="min-w-0">
        <span className="block font-sf text-xl font-semibold leading-none tracking-tight text-slate-900 dark:text-white tabular-nums">{value}</span>
        <span className="block text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-tight">{label}</span>
      </span>
    </Comp>
  )
}

// ── Profit margin donut ────────────────────────────────────────
function DonutRing({ pct, color, size = 128 }) {
  const safePct = Math.min(100, Math.max(0, Number(pct) || 0))
  const r = 24, cx = 32, cy = 32, circ = 2 * Math.PI * r, dash = (safePct / 100) * circ
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="-rotate-90" role="img" aria-label={`Profit margin ${safePct}%`}>
      <title>{safePct}% margin</title>
      <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth="6" className="stroke-slate-200 dark:stroke-navy-700" />
      <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth="6" stroke={color}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.6s ease' }} />
    </svg>
  )
}

export default function Dashboard() {
  const { can, isAdmin, isManager } = useAuth()
  const navigate = useNavigate()

  // ── Async state ───────────────────────────────────────────
  const [bookings,    setBookings]    = useState([])
  const [customers,   setCustomers]   = useState([])
  const [allExpenses, setAllExpenses] = useState([])
  const [settlements, setSettlements] = useState([])
  const [todayAttendance, setTodayAttendance] = useState([])
  const [drivers,     setDrivers]     = useState([])
  const [vehicles,    setVehicles]    = useState([])
  const [fleetAlerts, setFleetAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadErrors, setLoadErrors] = useState([])
  // ── Period selector: this month vs this year ────────────────
  const [period, setPeriod] = useState('month') // 'month' | 'year'

  // Each source loads independently — one failing table/query must not
  // blank out the rest of the dashboard. Failures are surfaced in
  // loadErrors instead of being masked with mock/local fallback data.
  const reload = useCallback(async () => {
    setLoading(true)
    const results = await Promise.allSettled([
      loadBookings(),
      loadCustomers(),
      loadExpenses(),
      loadSettlements(),
      loadAttendanceToday(),
      loadDrivers(),
      loadVehicles(),
      fleetAlertRepository.getActiveAlerts({ limit: 50 }) // Get recent active alerts
    ])
    const [bks, cust, exps, stls, att, drv, veh, alerts] = results
    const errors = []

    setBookings(    bks.status === 'fulfilled' && Array.isArray(bks.value)  ? bks.value  : [])
    setCustomers(   cust.status === 'fulfilled' && Array.isArray(cust.value) ? cust.value.filter(c => !c._deleted) : [])
    setAllExpenses( exps.status === 'fulfilled' && Array.isArray(exps.value) ? exps.value : [])
    setSettlements( stls.status === 'fulfilled' && Array.isArray(stls.value) ? stls.value : [])
    setTodayAttendance(att.status === 'fulfilled' && Array.isArray(att.value) ? att.value : [])
    setDrivers(     drv.status === 'fulfilled' && Array.isArray(drv.value)  ? drv.value  : [])
    setVehicles(    veh.status === 'fulfilled' && Array.isArray(veh.value)  ? veh.value  : [])
    setFleetAlerts( alerts.status === 'fulfilled' && Array.isArray(alerts.value) ? alerts.value : [])

    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const labels = ['bookings','customers','expenses','settlements','attendance','drivers','vehicles','fleetAlerts']
        console.error(`[Dashboard] failed to load ${labels[i]}:`, r.reason)
        errors.push(labels[i])
      }
    })
    setLoadErrors(errors)
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  // ── Attendance derived ────────────────────────────────────
  const presentCount = todayAttendance.filter(a => a.status === 'present' || a.status === 'half-day').length
  const absentCount  = todayAttendance.filter(a => a.status === 'absent').length

  // ── Booking derived ───────────────────────────────────────
  const todayStr         = toLocalDateStr()
  const thisMonthKey     = toLocalMonthStr()
  const monthBookings    = bookings.filter(b => b.startDate?.startsWith(thisMonthKey))
  const monthFare        = monthBookings.reduce((s, b) => s + (b.fare || 0), 0)
  const monthKm          = monthBookings.reduce((s, b) => s + (b.km || 0), 0)
  const monthDone        = monthBookings.filter(b => b.status === 'completed').length
  const monthPending     = monthBookings.filter(b => ['draft', 'confirmed', 'assigned'].includes(b.status)).length
  const bookingToday     = bookings.filter(b => b.startDate === todayStr)
  const bookingActive    = bookings.filter(b => b.status === 'started')
  const bookingCompleted = bookings.filter(b => b.status === 'completed')
  const bookingCancelled = bookings.filter(b => b.status === 'cancelled')
  const bookingPending   = bookings.filter(b => ['draft','confirmed','assigned'].includes(b.status))

  // ── Vehicle derived (still from static mockData) ──────────
  const availableVehicles   = vehicles.filter(v => v.status === 'active').length
  const maintenanceVehicles = vehicles.filter(v => v.status === 'maintenance').length
  const vehicleDocAlerts    = vehicles.flatMap(v =>
    [
      { label:`${v.reg} Insurance`,  expiry: v.insExpiry    },
      { label:`${v.reg} Permit`,     expiry: v.permitExpiry },
      { label:`${v.reg} FC`,         expiry: v.fcExpiry     },
      { label:`${v.reg} PUC`,        expiry: v.pucExpiry    },
    ].filter(d => { const s = docStatus(d.expiry); return s.key === 'expired' || s.key === 'soon' })
     .map(d => ({ ...d, st: docStatus(d.expiry) }))
  )

  // ── Customer derived ──────────────────────────────────────
  const thisMonthStr       = toLocalMonthStr()
  const newCustomersMonth  = customers.filter(c => c.createdAt?.startsWith(thisMonthStr)).length
  const corporateCustomers = customers.filter(c => c.type === 'corporate' || c.type === 'agent').length

  // ── Expense derived ───────────────────────────────────────
  const monthExpenses    = allExpenses.filter(e => isThisMonth(e))
  const monthExpTotal    = monthExpenses.reduce((s, e) => s + (e.amount || 0), 0)
  const monthNet         = monthFare - monthExpTotal
  const pendingApprovals = allExpenses.filter(e => e.status === 'submitted').length

  // ── Period derived (month vs year toggle) ───────────────────
  // KPIs, expense chips and the fare chart follow the selected period.
  // Queues (pending approvals, driver assignment) stay all-time on purpose.
  const periodYear       = String(new Date().getFullYear())
  const periodKey        = period === 'year' ? periodYear : toLocalMonthStr()
  const periodTag        = period === 'year' ? 'this year' : 'this month'
  const periodTagCap     = period === 'year' ? 'This Year' : 'This Month'
  const periodBookings   = bookings.filter(b => b.startDate?.startsWith(periodKey))
  const periodFare       = periodBookings.reduce((s, b) => s + (b.fare || 0), 0)
  const periodKm         = periodBookings.reduce((s, b) => s + (b.km || 0), 0)
  const periodDone       = periodBookings.filter(b => b.status === 'completed').length
  const periodPending    = periodBookings.filter(b => ['draft', 'confirmed', 'assigned'].includes(b.status)).length
  const periodCancelled  = periodBookings.filter(b => b.status === 'cancelled').length
  const periodExpenses   = allExpenses.filter(e => { const d = getExpenseDate(e); return d ? d.startsWith(periodKey) : false })
  const periodExpTotal   = periodExpenses.reduce((s, e) => s + (e.amount || 0), 0)
  const periodNet        = periodFare - periodExpTotal
  const periodCustomers  = customers.filter(c => c.createdAt?.startsWith(periodKey)).length
  const expByCategory    = summariseByType(periodExpenses).slice(0, 3)

  // ── Settlement derived ────────────────────────────────────
  const totalPayrollPaid = settlements
    .filter(s => s.status === 'paid')
    .reduce((sum, s) => sum + (s.netAmount || 0), 0)
  const settledPending  = settlements.filter(s => s.status === 'pending').length
  const settledApproved = settlements.filter(s => s.status === 'approved').length

  // ── Revenue KPIs ──────────────────────────────────────────
  const totalFare = bookings.reduce((s, b) => s + (b.fare  || 0), 0)
  const totalKm   = bookings.reduce((s, b) => s + (b.km    || 0), 0)
  const totalExp  = allExpenses.reduce((s, e) => s + (e.amount || 0), 0)
  const totalNet  = totalFare - totalExp
  const doneTrips    = bookingCompleted.length
  const pendingTrips = bookingPending.length

  // ── Fare trend (follows period toggle) ────────────────────
  // Month mode: last 6 months. Year mode: Jan–Dec of the current year.
  const monthlyFare = (() => {
    const now = new Date()
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d     = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key   = toLocalMonthStr(d)
      const label = d.toLocaleDateString('en-IN', { month: 'short' })
      const fare  = bookings
        .filter(b => b.startDate?.startsWith(key))
        .reduce((s, b) => s + (b.fare || 0), 0)
      months.push({ month: label, fare })
    }
    return months
  })()
  const yearlyFare = (() => {
    const y = new Date().getFullYear()
    const out = []
    for (let m = 0; m < 12; m++) {
      const d     = new Date(y, m, 1)
      const key   = toLocalMonthStr(d)
      const label = d.toLocaleDateString('en-IN', { month: 'short' })
      const fare  = bookings
        .filter(b => b.startDate?.startsWith(key))
        .reduce((s, b) => s + (b.fare || 0), 0)
      out.push({ month: label, fare })
    }
    return out
  })()
  const trendData  = period === 'year' ? yearlyFare : monthlyFare
  const trendTitle = period === 'year' ? '12-month trend' : '6-month trend'

  // ── Trip-volume trend (no money figures — safe for manager roles) ──
  const monthlyTrips = (() => {
    const now = new Date()
    const out = []
    for (let i = 5; i >= 0; i--) {
      const d     = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key   = toLocalMonthStr(d)
      const label = d.toLocaleDateString('en-IN', { month: 'short' })
      out.push({ month: label, fare: bookings.filter(b => b.startDate?.startsWith(key)).length })
    }
    return out
  })()
  const tripTotal = monthlyTrips.reduce((s, m) => s + m.fare, 0)

  // ── Needs-attention queue (operational roles without finance access) ──
  const unassignedCount = bookingPending.filter(b => !b.driver).length
  const attentionItems = [
    can('trips') && unassignedCount > 0
      ? { label: `${unassignedCount} trip${unassignedCount !== 1 ? 's' : ''} need a driver`, to: '/trips' } : null,
    can('expenses') && pendingApprovals > 0
      ? { label: `${pendingApprovals} expense${pendingApprovals !== 1 ? 's' : ''} awaiting approval`, to: '/expenses' } : null,
    can('vehicles') && vehicleDocAlerts.length > 0
      ? { label: `${vehicleDocAlerts.length} vehicle document${vehicleDocAlerts.length !== 1 ? 's' : ''} need attention`, to: '/vehicles' } : null,
    can('payroll') && settledPending > 0
      ? { label: `${settledPending} settlement${settledPending !== 1 ? 's' : ''} awaiting approval`, to: '/payroll' } : null,
  ].filter(Boolean)

  // ── Recent trips (max 5 on the dashboard) ─────────────────
  const recentTrips = [...bookings]
    .sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''))
    .slice(0, 5)
    .map(b => ({
      id:          b.id,
      customer:    b.customer,
      date:        b.startDate,
      source:      b.pickup,
      destination: b.drop,
      driver:      b.driver || '—',
      km:          b.km  || 0,
      fare:        b.fare || 0,
      net:         (b.fare||0) - (b.toll||0) - (b.bata||0) - (b.petrol||0) - (b.parking||0) - (b.extras||0),
      status:      b.status,
    }))

  // ── Loading skeleton (iPhone shimmer, mirrors the real layout) ──
  if (loading) {
    return (
      <div className="space-y-5" role="status" aria-busy="true" aria-label="Loading dashboard">
        <span className="sr-only">Loading dashboard…</span>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <div className="skeleton h-7 w-44 rounded-lg" />
            <div className="skeleton h-4 w-32 rounded-md" />
          </div>
          <div className="flex items-center gap-2">
            <div className="skeleton h-9 w-36 rounded-xl" />
            <div className="skeleton h-10 w-32 rounded-xl" />
          </div>
        </div>
        {/* KPI boxes */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="ap-surface p-4 space-y-3" aria-hidden="true">
              <div className="flex items-start justify-between">
                <div className="skeleton w-9 h-9 rounded-[11px]" />
                <div className="skeleton h-5 w-12 rounded-full" />
              </div>
              <div className="skeleton h-3 w-20 rounded" />
              <div className="skeleton h-7 w-3/4 rounded-lg" />
              <div className="skeleton h-3 w-1/2 rounded" />
            </div>
          ))}
        </div>
        {/* Widget chips */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="ap-surface p-3.5 flex items-center gap-3" aria-hidden="true">
              <div className="skeleton w-9 h-9 rounded-[11px] flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton h-5 w-12 rounded" />
                <div className="skeleton h-3 w-16 rounded" />
              </div>
            </div>
          ))}
        </div>
        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="ap-surface p-5 space-y-3" aria-hidden="true">
              <div className="skeleton h-3 w-24 rounded" />
              <div className="skeleton h-6 w-32 rounded-lg" />
              <div className="skeleton h-24 w-full rounded-xl" />
            </div>
          ))}
        </div>
        {/* Table rows */}
        <div className="ap-surface p-4 space-y-2.5" aria-hidden="true">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-2.5">
              <div className="skeleton w-7 h-7 rounded-full flex-shrink-0" />
              <div className="skeleton h-3.5 flex-1 rounded" />
              <div className="skeleton h-3.5 w-16 rounded hidden sm:block" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-up font-sf">
      {/* ── Header ── */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
            Overview — {period === 'year'
              ? `Year ${new Date().getFullYear()}`
              : new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
          </p>
          <h1 className="font-sf text-[28px] font-semibold tracking-tight text-slate-900 dark:text-white">Dashboard</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SegmentedControl
            ariaLabel="Dashboard period"
            value={period}
            onChange={setPeriod}
            options={[{ key: 'month', label: 'Month' }, { key: 'year', label: 'This Year' }]}
          />
          {can('trips') ? <Button icon={Plus} variant="primary" onClick={() => navigate('/trips')}>New Booking</Button> : null}
        </div>
      </div>

      {loadErrors.length > 0 && (
        <Callout
          tone="red"
          icon={AlertTriangle}
          title={`Couldn't load ${loadErrors.join(', ')}.`}
          sub="Showing partial data — try refreshing."
          actionLabel="Retry"
          onAction={reload}
        />
      )}

      {/* ── KPI Stats (follow the Month / This Year toggle) ── */}
      {can('revenueDashboard') ? (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard label={`Fare (${periodTagCap})`}     value={`Rs. ${periodFare.toLocaleString('en-IN')}`} sub={`${periodBookings.length} trips ${periodTag}`} icon={IndianRupee} tone="blue"   trend={8.4} trendUp />
          <MetricCard label={`Net Income (${periodTagCap})`} value={`Rs. ${periodNet.toLocaleString('en-IN')}`}  sub={`After trip costs ${periodTag}`}             icon={TrendingUp}  tone="green"  trend={5.2} trendUp />
          <MetricCard label={`KM (${periodTagCap})`}       value={periodKm.toLocaleString('en-IN')}               sub={`Kilometres covered ${periodTag}`}           icon={Car}         tone="violet" />
          <MetricCard label={`Expenses (${periodTagCap})`} value={`Rs. ${periodExpTotal.toLocaleString('en-IN')}`} sub={`${periodExpenses.length} entries ${periodTag}`} icon={Receipt}     tone="amber"  trend={2.1} trendUp={false} />
        </div>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard label="Total Trips"   value={periodBookings.length}              sub={periodTagCap}         icon={Car}         tone="blue" />
          <MetricCard label="Bills Done"    value={periodDone}                        sub={`Completed ${periodTag}`} icon={CheckCircle} tone="green" />
          <MetricCard label="Total KM"      value={periodKm.toLocaleString('en-IN')}  sub={periodTagCap}         icon={Car}         tone="violet" />
          <MetricCard label="Pending Bills" value={periodPending}                     sub="Awaiting invoice"     icon={Clock}       tone="amber" />
        </div>
      )}

      {/* ── Booking Overview ── */}
      {(can('revenueDashboard') || can('trips')) ? (
        <section>
          <SectionHeader
            className="mb-3"
            eyebrow="Booking Management"
            title="Booking Overview"
            badge={<span className="badge badge-active">{periodTagCap}</span>}
            action={
              <button onClick={() => navigate('/trips')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors">
                View all →
              </button>
            }
          />
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            <MiniStat icon={BookOpen}      tone="blue"  value={periodBookings.length} label="Total Bookings" onClick={() => navigate('/trips')} />
            <MiniStat icon={CalendarCheck} tone="teal"  value={bookingToday.length}   label="Today's Trips"  onClick={() => navigate('/trips')} />
            <MiniStat icon={Zap}           tone="amber" value={bookingActive.length}  label="Active Trips"   onClick={() => navigate('/trips')} />
            <MiniStat icon={CheckCircle}   tone="green" value={periodDone}            label="Completed"      onClick={() => navigate('/trips')} />
            <MiniStat icon={XCircle}       tone="red"   value={periodCancelled}       label="Cancelled"      onClick={() => navigate('/trips')} />
          </div>
        </section>
      ) : null}

      {/* ── Today's bookings quick list ── */}
      {bookingToday.length > 0 && (
        <section>
          <SectionHeader className="mb-3" eyebrow="Today" title="Today's Schedule" />
          <Surface padded={false} className="overflow-hidden">
            {bookingToday.slice(0, 4).map((b) => {
              const typeCfg = TRIP_TYPE_CONFIG[b.type]
              const stCfg   = getStatusCfg(b.status)
              return (
                <button key={b.id} onClick={() => navigate('/trips')}
                  className="w-full flex items-center gap-3 px-4 py-3 border-b ap-hairline last:border-0 hover:bg-blue-50/40 hover:bg-[var(--ap-surface-2)] transition-colors text-left">
                  <span className={`w-8 h-8 rounded-xl bg-gradient-to-br ${typeCfg?.gradient || 'from-slate-400 to-slate-500'} flex items-center justify-center text-sm flex-shrink-0`} aria-hidden="true">
                    {typeCfg?.icon}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{b.customer}</span>
                    <span className="block text-[10px] text-slate-400 dark:text-slate-500 truncate">
                      {b.startTime && `${b.startTime} · `}{b.pickup}{b.drop ? ` → ${b.drop}` : ''}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-full ${stCfg.badge}`}>
                      <span className={`w-1 h-1 rounded-full ${stCfg.dot.replace(' animate-pulse','')}`} />
                      {stCfg.label}
                    </span>
                    {b.driver && <span className="text-[10px] text-slate-400">{b.driver}</span>}
                  </span>
                </button>
              )
            })}
            {bookingToday.length > 4 && (
              <div className="px-4 py-2.5 text-center">
                <button onClick={() => navigate('/trips')} className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors">
                  +{bookingToday.length - 4} more trips today →
                </button>
              </div>
            )}
          </Surface>
        </section>
      )}

      {/* ── Pending assignments notice ── */}
      {bookingPending.filter(b => !b.driver).length > 0 && (isAdmin || isManager) && (
        <Callout
          tone="amber"
          icon={Users}
          title={`${bookingPending.filter(b => !b.driver).length} trip${bookingPending.filter(b => !b.driver).length !== 1 ? 's' : ''} need driver assignment`}
          sub="Confirmed bookings without a driver"
          actionLabel="Assign"
          onAction={() => navigate('/trips')}
        />
      )}

      {/* ── Vehicle Overview ── */}
      {can('vehicles') && (
        <section>
          <SectionHeader
            className="mb-3"
            eyebrow="Fleet Management"
            title="Vehicle Overview"
            action={
              <button onClick={() => navigate('/vehicles')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors">
                View all →
              </button>
            }
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniStat icon={Car}           tone="blue"  value={vehicles.length}       label="Total Vehicles" onClick={() => navigate('/vehicles')} />
            <MiniStat icon={CheckCircle}   tone="green" value={availableVehicles}     label="Available"      onClick={() => navigate('/vehicles')} />
            <MiniStat icon={Wrench}        tone="red"   value={maintenanceVehicles}   label="Maintenance"    onClick={() => navigate('/vehicles')} />
            <MiniStat icon={AlertTriangle} tone="amber" value={vehicleDocAlerts.length} label="Doc Alerts"   onClick={() => navigate('/vehicles')} />
          </div>
        </section>
      )}

      {/* ── Vehicle doc expiry alert ── */}
      {vehicleDocAlerts.length > 0 && can('vehicles') && (
        <Surface className="border-amber-500/20 bg-amber-500/[0.06]">
          <div className="flex items-center justify-between mb-3 gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                {vehicleDocAlerts.length} vehicle document{vehicleDocAlerts.length !== 1 ? 's' : ''} need attention
              </p>
            </div>
            <button onClick={() => navigate('/vehicles')}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-all active:scale-95 shadow-sm flex-shrink-0">
              Review
            </button>
          </div>
          <div className="space-y-1.5">
            {vehicleDocAlerts.slice(0, 4).map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300 truncate">{a.label}</p>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${a.st.badge}`}>{a.st.label}</span>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono tabular-nums">{a.expiry}</span>
                </div>
              </div>
            ))}
            {vehicleDocAlerts.length > 4 && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium pt-1">
                +{vehicleDocAlerts.length - 4} more — view all in Vehicles
              </p>
            )}
          </div>
        </Surface>
      )}

      {/* ── Mini stat chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat icon={CheckCircle} tone="green"  value={doneTrips}        label="Bills Done" />
        <MiniStat icon={Clock}       tone="amber"  value={pendingTrips}     label="Pending Bills" />
        <MiniStat icon={Users}       tone="blue"   value={drivers.length}   label="Drivers" />
        <MiniStat icon={Fuel}        tone="violet" value={vehicles.length}  label="Vehicles" />
      </div>

      {/* ── Customer Overview ── */}
      {can('customers') && (
        <section>
          <SectionHeader
            className="mb-3"
            eyebrow="Customer Management"
            title="Customer Overview"
            action={
              <button onClick={() => navigate('/customers')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors">
                View all →
              </button>
            }
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniStat icon={Users}       tone="blue"   value={customers.length} label="Total Customers" onClick={() => navigate('/customers')} />
            <MiniStat icon={CheckCircle} tone="green"  value={customers.filter(c => c.status === 'active').length} label="Active" onClick={() => navigate('/customers')} />
            <MiniStat icon={Users}       tone="violet" value={corporateCustomers} label="Corporate / Agent" onClick={() => navigate('/customers')} />
            <MiniStat icon={Plus}        tone="blue"   value={periodCustomers} label={`New ${periodTagCap}`} onClick={() => navigate('/customers')} />
          </div>
        </section>
      )}

      {/* ── Payroll & Settlements ── */}
      {can('payroll') && (
        <section>
          <SectionHeader
            className="mb-3"
            eyebrow="Payroll & Settlements"
            title="Driver Salary"
            action={
              <button onClick={() => navigate('/payroll')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors">
                View all →
              </button>
            }
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniStat icon={IndianRupee} tone="green"  value={`Rs. ${(totalPayrollPaid/1000).toFixed(1)}k`} label="Total Paid" onClick={() => navigate('/payroll')} />
            <MiniStat icon={IndianRupee} tone="blue"   value={settledPending}   label="Pending Approval" onClick={() => navigate('/payroll')} />
            <MiniStat icon={IndianRupee} tone="violet" value={settledApproved}  label="Approved (Unpaid)" onClick={() => navigate('/payroll')} />
            <MiniStat icon={IndianRupee} tone="gray"   value={settlements.length} label="Total Settlements" onClick={() => navigate('/payroll')} />
          </div>
          {(settledPending > 0 || settledApproved > 0) && (
            <Callout
              className="mt-3"
              tone="violet"
              title={
                (settledPending > 0 ? `${settledPending} settlement${settledPending!==1?'s':''} awaiting approval` : '') +
                (settledPending > 0 && settledApproved > 0 ? ' · ' : '') +
                (settledApproved > 0 ? `${settledApproved} approved — ready to pay` : '')
              }
              actionLabel="Review"
              onAction={() => navigate('/payroll')}
            />
          )}
        </section>
      )}

      {/* ── Expense Management ── */}
      {can('expenses') && (
        <section>
          <SectionHeader
            className="mb-3"
            eyebrow="Expense Management"
            title={periodTagCap}
            action={
              <button onClick={() => navigate('/expenses')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors">
                View all →
              </button>
            }
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <MiniStat icon={TrendingDown} tone="amber"  value={`Rs. ${(periodExpTotal/1000).toFixed(1)}k`} label={period === 'year' ? 'Year Total' : 'Month Total'} onClick={() => navigate('/expenses')} />
            <MiniStat icon={Receipt}      tone="gray"   value={periodExpenses.length} label="Entries"          onClick={() => navigate('/expenses')} />
            <MiniStat icon={Clock}        tone="blue"   value={pendingApprovals}      label="Pending Approval" onClick={() => navigate('/expenses')} />
            <MiniStat icon={Filter}       tone="violet" value={expByCategory.length}  label="Categories"       onClick={() => navigate('/expenses')} />
          </div>

          {expByCategory.length > 0 && (
            <Surface>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400 mb-3">
                Top Categories {periodTagCap}
              </p>
              <div className="space-y-2.5">
                {expByCategory.map(t => {
                  const pct = periodExpTotal > 0 ? Math.round((t.total / periodExpTotal) * 100) : 0
                  return (
                    <div key={t.key}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                          <span>{t.icon}</span>{t.label}
                        </span>
                        <span className="font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                          Rs. {t.total.toLocaleString('en-IN')} <span className="text-slate-400 font-normal">({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-[var(--ap-border)] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full bg-gradient-to-r ${t.color}`}
                          style={{ width: `${pct}%`, transition: 'width .5s' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Surface>
          )}

          {pendingApprovals > 0 && (
            <Callout
              className="mt-3"
              tone="blue"
              icon={Receipt}
              title={`${pendingApprovals} expense${pendingApprovals!==1?'s':''} awaiting your approval`}
              actionLabel="Review"
              onAction={() => navigate('/expenses')}
            />
          )}
        </section>
      )}

      {/* ── Attendance strip ── */}
      {can('attendance') && (
        <Surface>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CalendarCheck size={16} className="text-blue-600 dark:text-blue-400" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Today's Attendance</p>
            </div>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {new Date().toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short' })}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Present',  value: presentCount, dot: 'bg-emerald-500' },
              { label: 'Absent',   value: absentCount,  dot: 'bg-red-500' },
              { label: 'On Leave', value: todayAttendance.filter(a => a.status === 'leave').length,    dot: 'bg-amber-500' },
              { label: 'Half Day', value: todayAttendance.filter(a => a.status === 'half-day').length, dot: 'bg-blue-500' },
            ].map(s => (
              <div key={s.label} className="bg-slate-500/5 dark:bg-white/5 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center mb-1"><span className={`w-2 h-2 rounded-full ${s.dot}`} /></div>
                <p className="font-sf text-xl font-semibold text-slate-900 dark:text-white tabular-nums">{s.value}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </Surface>
      )}

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {can('revenueDashboard') ? (
          <Surface>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{period === 'year' ? 'Yearly Fare' : 'Monthly Fare'}</p>
                <p className="font-sf text-[17px] font-semibold text-slate-900 dark:text-white">{trendTitle}</p>
              </div>
              <span className="badge badge-active">{period === 'year' ? periodYear : trendData[trendData.length - 1]?.month}</span>
            </div>
            <SparkChart data={trendData} valueKey="fare" labelKey="month" />
            <div className="mt-3 pt-3 border-t ap-hairline flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Total ({periodTagCap})</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400 tabular-nums">Rs. {periodFare.toLocaleString('en-IN')}</span>
            </div>
          </Surface>
        ) : can('trips') ? (
          <Surface>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Trip Volume</p>
                <p className="font-sf text-[17px] font-semibold text-slate-900 dark:text-white">6-month trend</p>
              </div>
              <span className="badge badge-active">{monthlyTrips[monthlyTrips.length - 1]?.month}</span>
            </div>
            <SparkChart data={monthlyTrips} valueKey="fare" labelKey="month" accent="#0d9488"
              format={v => `${v} trip${v !== 1 ? 's' : ''}`} />
            <div className="mt-3 pt-3 border-t ap-hairline flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Total (6 mo.)</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400 tabular-nums">{tripTotal} trips</span>
            </div>
          </Surface>
        ) : (
          <AccessBlocked label="Revenue Chart" />
        )}

        {can('profitReports') ? (
          <Surface className="flex flex-col">
            <div className="mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Profit Breakdown</p>
              <p className="font-sf text-[17px] font-semibold text-slate-900 dark:text-white">Income vs Costs{' '}
                <span className="badge badge-active align-middle text-[10px]">{periodTagCap}</span>
              </p>
            </div>
            <div className="flex-1 flex items-center justify-center py-2">
              <div className="relative">
                <DonutRing pct={periodFare > 0 ? Math.round((periodNet / periodFare) * 100) : 0} color={periodNet >= 0 ? '#10b981' : '#f43f5e'} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="font-sf text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">{periodFare > 0 ? Math.min(100, Math.max(0, Math.round((periodNet / periodFare) * 100))) : 0}%</p>
                  <p className="text-[10px] text-slate-400">margin {periodTag}</p>
                </div>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {[
                { label:'Trip Revenue', amt:periodFare,     color:'bg-emerald-500' },
                { label:'Net Income',   amt:periodNet,      color: periodNet >= 0 ? 'bg-emerald-500' : 'bg-rose-500' },
                { label:'Expenses',     amt:periodExpTotal, color:'bg-rose-500' },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2"><div className={`w-2.5 h-2.5 rounded-full ${r.color}`} /><span className="text-slate-500 dark:text-slate-400">{r.label}</span></div>
                  <span className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">Rs. {r.amt.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          </Surface>
        ) : attentionItems.length > 0 ? (
          <Surface className="flex flex-col">
            <div className="mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Needs Attention</p>
              <p className="font-sf text-[17px] font-semibold text-slate-900 dark:text-white">Action queue</p>
            </div>
            <div className="flex-1 space-y-2">
              {attentionItems.map(item => (
                <button key={item.label} onClick={() => navigate(item.to)}
                  className="w-full flex items-center justify-between gap-2 rounded-xl border ap-hairline bg-slate-500/5 dark:bg-white/5 px-3.5 py-2.5 text-left hover:bg-slate-500/10 dark:hover:bg-white/10 active:scale-[0.99] transition-all min-h-[44px]">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{item.label}</span>
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex-shrink-0">Review →</span>
                </button>
              ))}
            </div>
          </Surface>
        ) : (
          <AccessBlocked label="Profit Reports" />
        )}

        {/* Driver pay — always visible */}
        <Surface>
          <div className="mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Driver Stats</p>
            <p className="font-sf text-[17px] font-semibold text-slate-900 dark:text-white">Pay summary</p>
          </div>
          <div className="space-y-4">
            {drivers.length === 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500">No drivers yet.</p>
            )}
            {drivers.slice(0, 5).map(d => {
              const driverTrips = bookings.filter(t => t.driver === d.name)
              const farePct     = totalFare > 0 ? Math.round((driverTrips.reduce((s,t) => s+(t.fare||0),0) / totalFare) * 100) : 0
              const driverCost  = allExpenses.filter(e => e.driver === d.name).reduce((s, e) => s + (e.amount || 0), 0)
              return (
                <div key={d.id}>
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <Avatar name={d.name} size={28} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{d.name}</p>
                      <p className="text-[10px] text-slate-400">{driverTrips.length} trips</p>
                    </div>
                    {can('financialAnalytics') && (
                      <p className="text-xs font-semibold text-red-500 tabular-nums">Rs. {driverCost.toLocaleString('en-IN')}</p>
                    )}
                  </div>
                  <div className="h-1.5 bg-[var(--ap-border)] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 rounded-full" style={{ width: `${Math.min(100, Math.max(0, farePct))}%` }} />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{farePct}% of total fare</p>
                </div>
              )
            })}
            {drivers.length > 5 && (
              <button onClick={() => navigate('/drivers')} className="mt-3 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors">
                +{drivers.length - 5} more drivers →
              </button>
            )}
          </div>
        </Surface>
      </div>

      {/* ── Live Fleet Board ── */}
      {(isAdmin || isManager) && (
        <section>
          <SectionHeader className="mb-3" eyebrow="Operations" title="Live Fleet" />
          <LiveFleetBoard />
        </section>
      )}

      {/* ── Fleet Alerts ── */}
      {can('fleetAlerts') && (() => {
        const activeAlerts = fleetAlerts.filter(a => a.status !== 'resolved' && a.status !== 'closed')
        const criticalCount = activeAlerts.filter(a => a.priority === 'critical').length
        const highCount = activeAlerts.filter(a => a.priority === 'high').length
        return (
        <section className="space-y-4">
          <SectionHeader
            eyebrow="Fleet Alerts"
            title={`Active Alerts (${activeAlerts.length})`}
            action={
              <button onClick={() => navigate('/fleet')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors flex-shrink-0">
                View All →
              </button>
            }
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <MiniStat icon={XCircle}       tone="red"   value={criticalCount}      label="Critical Alerts" />
            <MiniStat icon={AlertTriangle} tone="amber" value={highCount}          label="High Priority" />
            <MiniStat icon={Zap}           tone="blue"  value={activeAlerts.length} label="Total Active" />
          </div>
          {/* Recent Alerts List */}
          <Surface>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Recent Alerts</p>
              <button onClick={() => navigate('/fleet')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors flex-shrink-0">
                View All
              </button>
            </div>
            {activeAlerts.length === 0 ? (
              <EmptyState icon={CheckCircle} title="No active alerts" description="The fleet is reporting clear." />
            ) : (
              <div className="space-y-2.5">
                {activeAlerts.slice(0, 5).map((alert, index) => {
                  const priority = alert?.priority || 'medium'
                  const priorityLabel = priority.charAt(0).toUpperCase() + priority.slice(1)
                  const tone = priority === 'critical' ? 'red' : priority === 'high' ? 'amber' : 'blue'
                  const detected = alert?.detected_at ? new Date(alert.detected_at) : null
                  const detectedLabel = detected && !Number.isNaN(detected.getTime())
                    ? `${detected.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ${detected.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
                    : '--'
                  return (
                    <div key={alert?.id || index} className={`border-l-2 ${priority === 'critical' ? 'border-red-500' : priority === 'high' ? 'border-amber-500' : 'border-blue-500'} px-3 py-2.5 rounded-r-xl rounded-l-sm bg-slate-500/5 dark:bg-white/5`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                            {alert?.title || 'Fleet alert'}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate font-mono">
                            {alert?.vehicle_id ? `Vehicle ${String(alert.vehicle_id).slice(-6)}` : 'Unknown Vehicle'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <StatusPill tone={tone}>{priorityLabel}</StatusPill>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap tabular-nums">
                            {detectedLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Surface>
        </section>
        )
      })()}

      {/* ── Recent Activity (Audit Log, max 5 on the dashboard) ── */}
      {(isAdmin || isManager) && (() => {
        const recentActivity = loadRecentActivity(5)
        if (recentActivity.length === 0) return null
        return (
          <section>
            <SectionHeader className="mb-3" eyebrow="Audit Trail" title="Recent Activity" />
            <Surface padded={false} className="overflow-hidden">
              <div className="divide-y ap-hairline">
                {recentActivity.map(ev => (
                  <div key={ev.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-base flex-shrink-0" aria-hidden="true">{ev.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{ev.label}</p>
                      {ev.description && <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{ev.description}</p>}
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0">{fmtAuditTime(ev.timestamp)}</span>
                  </div>
                ))}
              </div>
            </Surface>
          </section>
        )
      })()}

      {/* ── Latest Trips ── */}
      <section>
        <SectionHeader
          className="mb-3"
          eyebrow="Recent Activity"
          title="Latest Trips"
          action={<Button icon={FileText} variant="outline" size="sm" onClick={() => navigate('/trips')}>View All</Button>}
        />
        {/* Desktop table */}
        <Surface padded={false} className="overflow-hidden hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b ap-hairline bg-slate-500/5 dark:bg-white/5">
                  {['Customer','Route','Driver','KM',
                    ...(can('revenueDashboard') ? ['Fare','Net'] : []),
                    'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-[0.06em] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentTrips.length === 0 && (
                  <tr>
                    <td colSpan={can('revenueDashboard') ? 7 : 5} className="px-4 py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                      No trips yet. Create your first booking from Trips.
                    </td>
                  </tr>
                )}
                {recentTrips.map(t => (
                  <tr key={t.id} className="border-b ap-hairline last:border-0 hover:bg-slate-500/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => navigate('/trips', { state: { tripId: t.id } })}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={t.customer} size={28} />
                        <div>
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">{t.customer}</p>
                          <p className="text-[10px] text-slate-400 tabular-nums">{t.date}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">{t.source} <span className="text-slate-300 dark:text-slate-500 mx-1">→</span> {t.destination}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{t.driver}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300 tabular-nums">{t.km} km</td>
                    {can('revenueDashboard') && <>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-900 dark:text-white whitespace-nowrap tabular-nums">Rs. {t.fare.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap tabular-nums">Rs. {t.net.toLocaleString('en-IN')}</td>
                    </>}
                    <td className="px-4 py-3"><Badge status={t.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Surface>
        {/* Mobile cards — stacked, no horizontal slider */}
        <div className="md:hidden space-y-2.5">
          {recentTrips.length === 0 && (
            <Surface className="text-center py-8">
              <p className="text-xs text-slate-400 dark:text-slate-500">No trips yet. Create your first booking from Trips.</p>
            </Surface>
          )}
          {recentTrips.map(t => (
            <button key={t.id} onClick={() => navigate('/trips', { state: { tripId: t.id } })}
              className="ap-surface ios-press p-3.5 cursor-pointer w-full text-left">
              <div className="flex items-center gap-2.5 mb-2">
                <Avatar name={t.customer} size={32} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{t.customer}</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">{t.date} · {t.km} km</p>
                </div>
                <Badge status={t.status} />
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug">
                {t.source} <span className="text-slate-300 dark:text-slate-500 mx-0.5">→</span> {t.destination}
              </p>
              <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t ap-hairline">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{t.driver}</p>
                {can('revenueDashboard') && (
                  <p className="text-xs font-semibold text-slate-900 dark:text-white tabular-nums flex-shrink-0">
                    Rs. {t.fare.toLocaleString('en-IN')}{' '}
                    <span className="text-emerald-600 dark:text-emerald-400">· Rs. {t.net.toLocaleString('en-IN')}</span>
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

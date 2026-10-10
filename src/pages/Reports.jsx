import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Car, Users, User, IndianRupee, AlertTriangle,
  CheckCircle, Download, BarChart2, RefreshCw,
  Navigation, TrendingUp, TrendingDown, Calendar,
  Search, Eye, ChevronLeft, ChevronRight, X, Wallet,
} from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import Avatar     from '../components/ui/Avatar'
import { useAuth } from '../context/AuthContext'
import { loadDrivers } from '../data/driverData'
import { loadVehicles } from '../data/vehicleData'
import { loadBookings } from '../data/tripTypes'
import { loadExpenses } from '../data/expenseData'
import {
  getExecutiveSummary, getTripReport, getDriverPerformance,
  getVehiclePerformance, getCustomerReport, getExpenseAnalytics,
  getPayrollAnalytics, getOperationsMonitor, getBusinessAlerts,
  exportToCSV, exportToExcel, exportToPDF, getMonthlySummary,
  todayStr, thisMonthStr,
} from '../data/reportData'

// ─────────────────────────────────────────────────────────────
//  Shared enterprise primitives (dark-navy ops language)
// ─────────────────────────────────────────────────────────────
const rs = (v) => `Rs. ${Number(v || 0).toLocaleString('en-IN')}`
const rsK = (v) => {
  const n = Number(v || 0)
  if (Math.abs(n) >= 1000) return `Rs. ${(n / 1000).toFixed(1)}k`
  return `Rs. ${n.toLocaleString('en-IN')}`
}
const dayLbl = (iso) => {
  const d = new Date((iso || '') + 'T00:00:00')
  return isNaN(d) ? '—' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
const fullDt = (iso) => {
  const d = new Date((iso || '') + 'T00:00:00')
  return isNaN(d) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function KpiCard({ icon, value, label, sub, delta, tone = 'blue', valueClass = '' }) {
  const tiles = {
    blue:   'bg-blue-100 dark:bg-blue-900/30 text-blue-500',
    green:  'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-400',
    red:    'bg-red-100 dark:bg-red-900/30 text-red-400',
    amber:  'bg-amber-100 dark:bg-amber-900/30 text-amber-400',
    violet: 'bg-violet-100 dark:bg-violet-900/30 text-violet-400',
    teal:   'bg-teal-100 dark:bg-teal-900/30 text-teal-400',
    orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-400',
  }
  return (
    <div className="ap-surface rounded-2xl p-4 relative">
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${tiles[tone]}`}>{icon}</div>
        {delta != null && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap">
            ↑ {delta}%
          </span>
        )}
      </div>
      <p className={`text-xl font-sf font-semibold tabular-nums leading-none ${valueClass}`}>{value}</p>
      <p className="text-xs font-bold text-slate-600 dark:text-slate-200 mt-1">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function Panel({ title, sub, icon, right, children }) {
  return (
    <div className="ap-surface rounded-2xl p-4">
      <div className="flex items-center gap-2.5 mb-3">
        {icon && <div className="w-8 h-8 rounded-xl bg-[var(--ap-surface-2)] flex items-center justify-center flex-shrink-0">{icon}</div>}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 dark:text-white">{title}</p>
          {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

function GranToggle({ value, onChange, options = [['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']] }) {
  return (
    <div className="flex gap-1 bg-[var(--ap-surface-2)] rounded-xl p-1">
      {options.map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${
            value === k ? 'bg-[var(--ap-accent)] text-white shadow' : 'text-slate-500 dark:text-slate-400'
          }`}>{l}</button>
      ))}
    </div>
  )
}

// SVG trend: bars (a) + line (b)
function TrendChart({ points, aLabel, bLabel, aColor = '#3b82f6', bColor = '#10b981', height = 180 }) {
  const W = 600, H = 200, PAD = 28
  const maxA = Math.max(...points.map(p => p.a), 1)
  const maxB = Math.max(...points.map(p => p.b), 1)
  const X = (i) => points.length < 2 ? W / 2 : PAD + (i * (W - PAD * 2)) / (points.length - 1)
  const bw = points.length ? Math.min(22, (W - PAD * 2) / points.length * 0.55) : 0
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${X(i).toFixed(1)},${(H - PAD - (p.b / maxB) * (H - PAD * 2)).toFixed(1)}`).join(' ')
  const ticks = points.length > 12 ? [points[0], points[Math.floor(points.length / 2)], points[points.length - 1]] : points
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
        {[0.25, 0.5, 0.75].map(f => (
          <line key={f} x1={PAD} x2={W - 8} y1={H * f} y2={H * f} stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3 3" />
        ))}
        {points.map((p, i) => {
          const h = Math.max(2, (p.a / maxA) * (H - PAD * 2))
          return <rect key={i} x={X(i) - bw / 2} y={H - PAD - h} width={bw} height={h} rx={2} fill={aColor} fillOpacity="0.85"><title>{`${p.x}: ${aLabel} ${p.a}, ${bLabel} ${p.b}`}</title></rect>
        })}
        <path d={line} fill="none" stroke={bColor} strokeWidth="2.5" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={X(i)} cy={H - PAD - (p.b / maxB) * (H - PAD * 2)} r="3" fill={bColor} stroke="white" strokeWidth="1"><title>{`${p.x}: ${bLabel} ${p.b}`}</title></circle>
        ))}
        {ticks.map((p, i) => <text key={i} x={X(points.indexOf(p))} y={H - 8} textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.5">{p.x}</text>)}
      </svg>
      <div className="flex items-center justify-center gap-4 mt-1">
        <span className="flex items-center gap-1.5 text-[10px] text-slate-400"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: aColor }} />{aLabel}</span>
        <span className="flex items-center gap-1.5 text-[10px] text-slate-400"><span className="w-2.5 h-2.5 rounded-full" style={{ background: bColor }} />{bLabel}</span>
      </div>
    </div>
  )
}

// SVG donut with center total
function Donut({ segments, total, totalLabel }) {
  const R = 52, C = 2 * Math.PI * R
  const sum = segments.reduce((s, g) => s + g.value, 0) || 1
  let acc = 0
  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-shrink-0" style={{ width: 132, height: 132 }}>
        <svg viewBox="0 0 132 132" className="w-full h-full -rotate-90">
          <circle cx="66" cy="66" r={R} fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="16" />
          {segments.map((g, i) => {
            const frac = g.value / sum
            const el = <circle key={i} cx="66" cy="66" r={R} fill="none" stroke={g.color} strokeWidth="16"
              strokeDasharray={`${(frac * C).toFixed(1)} ${C.toFixed(1)}`} strokeDashoffset={(-acc * C).toFixed(1)} strokeLinecap="butt" />
            acc += frac
            return el
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-sf font-semibold tabular-nums leading-none">{total}</p>
          <p className="text-[9px] text-slate-400 mt-0.5">{totalLabel}</p>
        </div>
      </div>
      <div className="flex-1 space-y-1.5 min-w-0">
        {segments.map(g => (
          <div key={g.label} className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: g.color }} />
            <span className="text-slate-500 dark:text-slate-400 flex-1 truncate">{g.label}</span>
            <span className="font-semibold tabular-nums">{g.value}</span>
            <span className="font-bold tabular-nums w-11 text-right" style={{ color: g.color }}>{sum ? Math.round(g.value / sum * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RankTable({ rows, cols, emptyText = 'No data' }) {
  if (!rows.length) return <p className="text-xs text-slate-400 text-center py-6">{emptyText}</p>
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--ap-border)]">
            {cols.map(c => (
              <th key={c.label} className={`px-2 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap ${c.right ? 'text-right' : 'text-left'}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-[var(--ap-border)] last:border-0">
              {cols.map(c => (
                <td key={c.label} className={`px-2 py-2 text-xs whitespace-nowrap ${c.right ? 'text-right' : ''} ${c.cls ? c.cls(r) : 'text-slate-600 dark:text-slate-300'}`}>
                  {c.render ? c.render(r, i) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Pager({ page, totalPages, total, pageSize, onPage, label }) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
      <p className="text-xs text-slate-400 tabular-nums">Showing {from} to {to} of {total} {label}</p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous"
            className="w-7 h-7 rounded-lg border border-[var(--ap-border)] flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-[var(--ap-surface-2)] transition-colors"><ChevronLeft size={13} /></button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            let p = i + 1
            if (totalPages > 5) {
              if (page > 3 && page < totalPages - 1) p = page - 2 + i
              else if (page >= totalPages - 1) p = totalPages - 4 + i
            }
            return (
              <button key={p} onClick={() => onPage(p)}
                className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-bold tabular-nums transition-colors ${p === page ? 'bg-[var(--ap-accent)] text-white' : 'text-slate-500 hover:bg-[var(--ap-surface-2)]'}`}>{p}</button>
            )
          })}
          <button disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next"
            className="w-7 h-7 rounded-lg border border-[var(--ap-border)] flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-[var(--ap-surface-2)] transition-colors"><ChevronRight size={13} /></button>
        </div>
      )}
    </div>
  )
}

function FilterSel({ value, onChange, children, wide }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className={`px-3 py-2.5 text-xs rounded-xl border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-700 dark:text-slate-200 focus:outline-none font-bold ${wide ? 'flex-1 min-w-[150px]' : ''}`}>
      {children}
    </select>
  )
}

function ExportBtn({ onClick, label = 'Export' }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--ap-accent)] text-white text-xs font-bold hover:opacity-90 transition-all shadow-md active:scale-95 whitespace-nowrap">
      <Download size={13} /> {label}
    </button>
  )
}

function ExportPanel({ onCSV, onExcel, onPDF }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--ap-accent)] text-white text-xs font-bold hover:opacity-90 transition-all shadow-md active:scale-95 whitespace-nowrap">
        <Download size={13} /> Export ▾
      </button>
      {open && (
        <div className="absolute right-0 top-11 bg-[var(--ap-surface-2)] border border-[var(--ap-border)] rounded-xl shadow-xl z-20 overflow-hidden py-1 min-w-[130px]">
          {[{ label: 'CSV', icon: '📊', fn: onCSV }, { label: 'Excel', icon: '📗', fn: onExcel }, { label: 'PDF', icon: '📄', fn: onPDF }].map(o => (
            <button key={o.label} onClick={() => { o.fn?.(); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-[var(--ap-surface-2)] transition-colors">
              <span>{o.icon}</span> {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyBlock({ text }) {
  return <p className="text-xs text-slate-400 text-center py-8">{text}</p>
}

// Trip status buckets shared by Trips views (real statuses only)
const bucketStatus = (s) => {
  if (s === 'completed' || s === 'closed') return 'completed'
  if (s === 'cancelled') return 'cancelled'
  if (s === 'started') return 'ongoing'
  return 'scheduled'
}
const ST4 = {
  completed: { label: 'Completed', color: '#10b981', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  ongoing:   { label: 'Ongoing',   color: '#f59e0b', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  cancelled: { label: 'Cancelled', color: '#ef4444', badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  scheduled: { label: 'Scheduled', color: '#64748b', badge: 'bg-[var(--ap-surface-2)] text-slate-600 dark:text-slate-300' },
}

// ─────────────────────────────────────────────────────────────
//  Overview
// ─────────────────────────────────────────────────────────────
function ExecutiveOverview({ summary }) {
  const { trips, customers, vehicles, drivers, finance } = summary
  const curYear = new Date().getFullYear()
  const [gran, setGran] = useState('monthly')
  const [revSeries, setRevSeries] = useState([])
  const [expSeries, setExpSeries] = useState([])
  const [labels, setLabels] = useState([])

  useEffect(() => {
    let live = true
    Promise.all([getMonthlySummary(curYear), loadBookings(), loadExpenses()]).then(([m, bks, exps]) => {
      if (!live) return
      const B = Array.isArray(bks) ? bks : []
      const E = Array.isArray(exps) ? exps : []
      if (gran === 'monthly') {
        const byM = {}
        E.forEach(e => {
          const k = (e.date || '').slice(0, 7)
          if (k.startsWith(String(curYear))) byM[k] = (byM[k] || 0) + (Number(e.amount) || 0)
        })
        const ML = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        setLabels(ML)
        setRevSeries(ML.map((_, i) => (m.find(x => x.month === i + 1)?.revenue) || 0))
        setExpSeries(ML.map((_, i) => byM[`${curYear}-${String(i + 1).padStart(2, '0')}`] || 0))
      } else {
        const days = gran === 'daily' ? 30 : 84
        const step = gran === 'daily' ? 1 : 7
        const pts = []
        for (let i = days - step; i >= 0; i -= step) {
          const d0 = new Date(); d0.setHours(0, 0, 0, 0); d0.setDate(d0.getDate() - i - (step - 1))
          const d1 = new Date(d0); d1.setDate(d1.getDate() + step - 1); d1.setHours(23, 59, 59, 999)
          const inW = (s) => { const t = new Date((s || '') + 'T00:00:00').getTime(); return t >= d0.getTime() && t <= d1.getTime() }
          pts.push({
            x: d0.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
            rev: B.filter(b => inW(b.startDate)).reduce((s, b) => s + (Number(b.fare) || 0), 0),
            exp: E.filter(e => inW(e.date)).reduce((s, e) => s + (Number(e.amount) || 0), 0),
          })
        }
        setLabels(pts.map(p => p.x))
        setRevSeries(pts.map(p => p.rev))
        setExpSeries(pts.map(p => p.exp))
      }
    }).catch(() => {})
    return () => { live = false }
  }, [gran, curYear])

  const netSeries = revSeries.map((r, i) => r - (expSeries[i] || 0))
  const points = labels.map((x, i) => ({ x, a: netSeries[i] < 0 ? 0 : netSeries[i], b: revSeries[i], e: expSeries[i] }))

  const buckets = { completed: trips.completed, ongoing: 0, cancelled: trips.cancelled, scheduled: 0 }
  // ongoing/scheduled split needs live statuses — derive in Trips-style from summary counts
  const ongoingSched = trips.total - trips.completed - trips.cancelled
  buckets.ongoing = trips.active
  buckets.scheduled = Math.max(0, ongoingSched - trips.active)

  const kpis = [
    { icon: <IndianRupee size={16} />, value: rsK(finance.totalFare), label: 'Total Revenue', sub: 'All bookings', tone: 'blue', vc: 'text-slate-800 dark:text-white' },
    { icon: <TrendingDown size={16} />, value: rsK(finance.totalExp), label: 'Total Expenses', sub: 'Paid out', tone: 'red', vc: 'text-red-500' },
    { icon: <TrendingUp size={16} />, value: rsK(finance.totalNet), label: 'Net Profit', sub: 'Revenue − Expenses', tone: 'green', vc: 'text-emerald-500' },
    { icon: <Navigation size={16} />, value: trips.total, label: 'Total Trips', sub: `${trips.completed} completed`, tone: 'blue', vc: 'text-slate-800 dark:text-white' },
    { icon: <Users size={16} />, value: customers.total, label: 'Total Customers', sub: `${customers.active} active`, tone: 'violet', vc: 'text-slate-800 dark:text-white' },
    { icon: <Car size={16} />, value: vehicles.total, label: 'Total Vehicles', sub: 'In operation', tone: 'amber', vc: 'text-slate-800 dark:text-white' },
    { icon: <User size={16} />, value: drivers.total, label: 'Total Drivers', sub: `${drivers.available} active`, tone: 'green', vc: 'text-slate-800 dark:text-white' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
        {kpis.map(k => <KpiCard key={k.label} icon={k.icon} value={k.value} label={k.label} sub={k.sub} tone={k.tone} valueClass={k.vc} />)}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <Panel title="Revenue vs Expenses" sub={gran === 'monthly' ? `Monthly trend ${curYear} — revenue, expenses and profit` : `Last ${gran === 'daily' ? '30 days' : '12 weeks'} — revenue vs expenses`}
            icon={<BarChart2 size={15} className="text-blue-500" />} right={<GranToggle value={gran} onChange={setGran} />}>
            {points.length === 0 || points.every(p => p.b === 0 && p.e === 0)
              ? <EmptyBlock text="No revenue data for this view." />
              : <TrendChart points={points.map(p => ({ x: p.x, a: Math.max(0, p.b - p.e), b: p.b }))} aLabel="Net Profit" bLabel="Revenue" />}
            <div className="flex items-center justify-center gap-4 mt-1">
              <span className="flex items-center gap-1.5 text-[10px] text-slate-400"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />Net Profit</span>
              <span className="flex items-center gap-1.5 text-[10px] text-slate-400"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />Revenue</span>
            </div>
          </Panel>
        </div>
        <Panel title="Trip Status" sub="Distribution of trips by status" icon={<Car size={15} className="text-slate-400" />}>
          {trips.total === 0 ? <EmptyBlock text="No trips yet." /> : (
            <Donut total={trips.total} totalLabel="Total Trips" segments={[
              { label: 'Completed', value: buckets.completed, color: '#10b981' },
              { label: 'Ongoing', value: buckets.ongoing, color: '#f59e0b' },
              { label: 'Cancelled', value: buckets.cancelled, color: '#ef4444' },
              { label: 'Scheduled', value: buckets.scheduled, color: '#64748b' },
            ]} />
          )}
        </Panel>
      </div>

      <OverviewRanks />
    </div>
  )
}

function OverviewRanks() {
  const [routes, setRoutes] = useState([])
  const [custs, setCusts] = useState([])
  const [expBrk, setExpBrk] = useState([])
  const navigate = useNavigate()
  useEffect(() => {
    let live = true
    Promise.all([loadBookings(), loadExpenses()]).then(([bks, exps]) => {
      if (!live) return
      const B = Array.isArray(bks) ? bks.filter(b => b.status === 'completed') : []
      const E = Array.isArray(exps) ? exps : []
      const rMap = new Map()
      B.forEach(b => {
        const k = `${b.pickup || '—'} → ${b.drop || 'Local'}`
        const r = rMap.get(k) || { route: k, trips: 0, revenue: 0 }
        r.trips++; r.revenue += Number(b.fare) || 0
        rMap.set(k, r)
      })
      setRoutes([...rMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5))
      const cMap = new Map()
      B.forEach(b => {
        const k = b.customer || '—'
        const r = cMap.get(k) || { customer: k, trips: 0, revenue: 0 }
        r.trips++; r.revenue += Number(b.fare) || 0
        cMap.set(k, r)
      })
      setCusts([...cMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5))
      const cat = new Map()
      E.forEach(e => {
        const k = e.type || 'other'
        cat.set(k, (cat.get(k) || 0) + (Number(e.amount) || 0))
      })
      const tot = [...cat.values()].reduce((s, v) => s + v, 0) || 1
      setExpBrk([...cat.entries()].map(([k, v]) => ({ cat: k, amount: v, pct: Math.round(v / tot * 100) }))
        .sort((a, b) => b.amount - a.amount).slice(0, 5))
    }).catch(() => {})
    return () => { live = false }
  }, [])

  const link = (to) => (
    <button onClick={() => navigate(to)} className="text-[11px] font-bold text-blue-500 hover:underline whitespace-nowrap">View All</button>
  )
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Panel title="Top Routes by Revenue" right={link('/trips')}>
        <RankTable emptyText="No completed trips yet." rows={routes} cols={[
          { label: '#', render: (_, i) => <span className="text-slate-400 tabular-nums">{i + 1}</span> },
          { label: 'Route', render: r => <span className="font-bold text-slate-700 dark:text-slate-200">{r.route}</span> },
          { label: 'Trips', key: 'trips', right: true, render: r => <span className="tabular-nums">{r.trips}</span> },
          { label: 'Revenue', right: true, render: r => <span className="font-semibold text-amber-500 tabular-nums">{rs(r.revenue)}</span> },
        ]} />
      </Panel>
      <Panel title="Top Customers by Revenue" right={link('/customers')}>
        <RankTable emptyText="No completed trips yet." rows={custs} cols={[
          { label: '#', render: (_, i) => <span className="text-slate-400 tabular-nums">{i + 1}</span> },
          { label: 'Customer', render: r => <span className="font-bold text-slate-700 dark:text-slate-200">{r.customer}</span> },
          { label: 'Trips', right: true, render: r => <span className="tabular-nums">{r.trips}</span> },
          { label: 'Revenue', right: true, render: r => <span className="font-semibold text-amber-500 tabular-nums">{rs(r.revenue)}</span> },
        ]} />
      </Panel>
      <Panel title="Expense Breakdown" right={link('/expenses')}>
        <RankTable emptyText="No expenses yet." rows={expBrk} cols={[
          { label: '#', render: (_, i) => <span className="text-slate-400 tabular-nums">{i + 1}</span> },
          { label: 'Category', render: r => <span className="font-bold text-slate-700 dark:text-slate-200 capitalize">{String(r.cat).replace(/_/g, ' ')}</span> },
          { label: 'Amount', right: true, render: r => <span className="tabular-nums">{rs(r.amount)}</span> },
          { label: '%', right: true, render: r => <span className="font-semibold tabular-nums">{r.pct}%</span> },
        ]} />
      </Panel>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Trips
// ─────────────────────────────────────────────────────────────
const TRIP_PAGE = 8
function TripReports() {
  const navigate = useNavigate()
  const today = todayStr()
  const monStr = thisMonthStr()
  const [from, setFrom] = useState(monStr + '-01')
  const [to, setTo] = useState(today)
  const [driver, setDriver] = useState('all')
  const [vehicle, setVehicle] = useState('all')
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [gran, setGran] = useState('daily')
  const [page, setPage] = useState(1)
  const [report, setReport] = useState({ rows: [], totalRevenue: 0, totalDistance: 0, completed: 0, cancelled: 0, cancelRate: 0 })
  const [prev, setPrev] = useState({ rows: [] })
  const [drivers, setDrivers] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [expenses, setExpenses] = useState([])

  useEffect(() => {
    getTripReport(from, to, driver, vehicle).then(d => setReport(d ?? { rows: [], totalRevenue: 0, totalDistance: 0, completed: 0, cancelled: 0, cancelRate: 0 })).catch(() => {})
    // Previous equal-length period for real deltas
    try {
      const f = new Date(from + 'T00:00:00'), t = new Date(to + 'T00:00:00')
      const len = Math.max(1, Math.round((t - f) / 86400000) + 1)
      const pf = new Date(f); pf.setDate(pf.getDate() - len)
      const pt = new Date(f); pt.setDate(pt.getDate() - 1)
      const iso = (d) => d.toISOString().slice(0, 10)
      getTripReport(iso(pf), iso(pt), driver, vehicle).then(d => setPrev(d ?? { rows: [] })).catch(() => {})
    } catch { setPrev({ rows: [] }) }
  }, [from, to, driver, vehicle])
  useEffect(() => {
    loadDrivers().then(d => setDrivers(Array.isArray(d) ? d : [])).catch(() => {})
    loadVehicles().then(v => setVehicles(Array.isArray(v) ? v : [])).catch(() => {})
    loadExpenses().then(e => setExpenses(Array.isArray(e) ? e : [])).catch(() => {})
  }, [])
  useEffect(() => { setPage(1) }, [from, to, driver, vehicle, status, search])

  const expByTrip = useMemo(() => {
    const m = new Map()
    expenses.forEach(e => {
      const k = e.tripRef || e.booking_id
      if (k) m.set(k, (m.get(k) || 0) + (Number(e.amount) || 0))
    })
    return m
  }, [expenses])
  const tripExp = (b) => expByTrip.get(b.bookingNo) ?? expByTrip.get(b.booking_id) ?? expByTrip.get(b.id) ?? 0

  const rows = useMemo(() => report.rows.filter(b => {
    if (status !== 'all' && bucketStatus(b.status) !== status) return false
    if (search) {
      const q = search.toLowerCase()
      if (![b.bookingNo, b.customer, b.pickup, b.drop, b.driver, b.vehicle].some(v => String(v ?? '').toLowerCase().includes(q))) return false
    }
    return true
  }), [report.rows, status, search])

  const completed = rows.filter(b => bucketStatus(b.status) === 'completed').length
  const ongoing = rows.filter(b => bucketStatus(b.status) === 'ongoing').length
  const cancelled = rows.filter(b => bucketStatus(b.status) === 'cancelled').length
  const revenue = rows.reduce((s, b) => s + (Number(b.fare) || 0), 0)
  const avgFare = rows.length ? Math.round(revenue / rows.length) : 0
  const prevRevenue = (prev.rows || []).reduce((s, b) => s + (Number(b.fare) || 0), 0)
  const delta = (cur, old) => old > 0 ? Math.round((cur - old) / old * 100) : null

  const trend = useMemo(() => {
    const step = gran === 'daily' ? 1 : 7
    const f = new Date(from + 'T00:00:00'), t = new Date(to + 'T00:00:00')
    const pts = []
    for (let d = new Date(f); d <= t; d.setDate(d.getDate() + step)) {
      const d0 = new Date(d), d1 = new Date(d); d1.setDate(d1.getDate() + step - 1)
      const inW = (s) => { const x = new Date((s || '') + 'T00:00:00').getTime(); return x >= d0.getTime() && x <= d1.getTime() + 86399999 }
      const day = rows.filter(b => inW(b.startDate))
      pts.push({
        x: d0.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        a: day.length,
        b: day.reduce((s, b) => s + (Number(b.fare) || 0), 0),
      })
    }
    return pts
  }, [rows, from, to, gran])

  const totalPages = Math.max(1, Math.ceil(rows.length / TRIP_PAGE))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const pageRows = rows.slice((safePage - 1) * TRIP_PAGE, safePage * TRIP_PAGE)

  const handleExport = () => exportToCSV(rows.map(b => ({
    date: b.startDate, tripId: b.bookingNo, customer: b.customer,
    route: `${b.pickup || ''} → ${b.drop || ''}`, vehicle: b.vehicle, driver: b.driver,
    status: bucketStatus(b.status), fare: b.fare || 0, expenses: tripExp(b), net: (Number(b.fare) || 0) - tripExp(b),
  })), [
    { label: 'Date', key: 'date' }, { label: 'Trip ID', key: 'tripId' }, { label: 'Customer', key: 'customer' },
    { label: 'Route', key: 'route' }, { label: 'Vehicle', key: 'vehicle' }, { label: 'Driver', key: 'driver' },
    { label: 'Status', key: 'status' }, { label: 'Trip Fare (Rs)', key: 'fare' },
    { label: 'Expenses (Rs)', key: 'expenses' }, { label: 'Net Revenue (Rs)', key: 'net' },
  ], 'trips_report')

  const clearAll = () => { setSearch(''); setStatus('all'); setDriver('all'); setVehicle('all'); setFrom(monStr + '-01'); setTo(today) }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard icon={<Navigation size={16} />} value={rows.length} label="Total Trips" sub="vs previous period" tone="blue" valueClass="text-slate-800 dark:text-white" delta={delta(rows.length, (prev.rows || []).length)} />
        <KpiCard icon={<CheckCircle size={16} />} value={completed} label="Completed" sub={rows.length ? `${Math.round(completed / rows.length * 100)}%` : '—'} tone="green" valueClass="text-emerald-500" />
        <KpiCard icon={<RefreshCw size={16} />} value={ongoing} label="Ongoing" sub={rows.length ? `${Math.round(ongoing / rows.length * 100)}%` : '—'} tone="amber" valueClass="text-amber-500" />
        <KpiCard icon={<X size={16} />} value={cancelled} label="Cancelled" sub={rows.length ? `${Math.round(cancelled / rows.length * 100)}%` : '—'} tone="red" valueClass="text-red-500" />
        <KpiCard icon={<IndianRupee size={16} />} value={rsK(revenue)} label="Total Revenue" sub="All trips" tone="violet" valueClass="text-slate-800 dark:text-white" delta={delta(revenue, prevRevenue)} />
        <KpiCard icon={<Wallet size={16} />} value={rs(avgFare)} label="Avg. Trip Fare" sub="Per trip" tone="blue" valueClass="text-slate-800 dark:text-white" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <Panel title="Trips Trend" sub="Number of trips and revenue trend" icon={<BarChart2 size={15} className="text-blue-500" />}
            right={<GranToggle value={gran} onChange={setGran} options={[['daily', 'Daily'], ['weekly', 'Weekly']]} />}>
            {trend.length === 0 || trend.every(p => p.a === 0 && p.b === 0)
              ? <EmptyBlock text="No trips in this range." />
              : <TrendChart points={trend} aLabel="Trips" bLabel="Revenue" />}
          </Panel>
        </div>
        <Panel title="Trip Status Distribution" sub="Share of trips by status" icon={<Users size={15} className="text-violet-500" />}>
          {rows.length === 0 ? <EmptyBlock text="No trips in this range." /> : (
            <Donut total={rows.length} totalLabel="Total Trips" segments={[
              { label: 'Completed', value: completed, color: '#10b981' },
              { label: 'Ongoing', value: ongoing, color: '#f59e0b' },
              { label: 'Cancelled', value: cancelled, color: '#ef4444' },
            ].filter(s => s.value > 0)} />
          )}
        </Panel>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[var(--ap-border)] bg-[var(--ap-surface-2)] flex-1 min-w-[180px] max-w-xs">
          <Search size={13} className="text-slate-400 flex-shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by Trip ID, Customer, Route…"
            className="bg-transparent text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none w-full" />
        </div>
        <FilterSel value={status} onChange={setStatus}>
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="ongoing">Ongoing</option>
          <option value="cancelled">Cancelled</option>
          <option value="scheduled">Scheduled</option>
        </FilterSel>
        <FilterSel value={vehicle} onChange={setVehicle}>
          <option value="all">All Vehicles</option>
          {vehicles.map(v => <option key={v.id} value={v.reg}>{v.reg}</option>)}
        </FilterSel>
        <FilterSel value={driver} onChange={setDriver}>
          <option value="all">All Drivers</option>
          {drivers.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
        </FilterSel>
        <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)}
          className="px-3 py-2.5 text-xs rounded-xl border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-700 dark:text-slate-200 focus:outline-none font-bold" />
        <input type="date" value={to} min={from} max={today} onChange={e => setTo(e.target.value)}
          className="px-3 py-2.5 text-xs rounded-xl border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-700 dark:text-slate-200 focus:outline-none font-bold" />
        <button onClick={clearAll} className="flex items-center gap-1 px-3 py-2.5 text-xs font-bold rounded-xl text-slate-500 hover:bg-[var(--ap-surface-2)] transition-colors">
          <X size={13} /> Clear
        </button>
        <ExportBtn onClick={handleExport} />
      </div>

      <Panel title={`Trips Report (${rows.length})`} right={
        <button onClick={() => navigate('/trips')} className="text-[11px] font-bold text-blue-500 hover:underline whitespace-nowrap">View Trip Details ›</button>
      }>
        {rows.length === 0 ? <EmptyBlock text="No trips match these filters." /> : (<>
          <div className="overflow-x-auto -mx-1 hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--ap-border)]">
                  {['#', 'Date', 'Trip ID', 'Customer', 'Route', 'Vehicle', 'Driver', 'Status', 'Trip Fare', 'Expenses', 'Net Revenue', 'Actions'].map(h => (
                    <th key={h} className={`px-2 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap ${['Trip Fare', 'Expenses', 'Net Revenue', 'Actions'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((b, i) => {
                  const st = ST4[bucketStatus(b.status)]
                  const exp = tripExp(b)
                  const fare = Number(b.fare) || 0
                  return (
                    <tr key={b.id} className="border-b border-[var(--ap-border)] last:border-0 hover:bg-[var(--ap-surface-2)] transition-colors">
                      <td className="px-2 py-2.5 text-xs text-slate-400 tabular-nums">{(safePage - 1) * TRIP_PAGE + i + 1}</td>
                      <td className="px-2 py-2.5 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">{fullDt(b.startDate)}</td>
                      <td className="px-2 py-2.5 text-[11px] font-mono text-slate-500 whitespace-nowrap">{b.bookingNo}</td>
                      <td className="px-2 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">{b.customer}</td>
                      <td className="px-2 py-2.5 text-xs text-slate-500 max-w-[150px] truncate">{b.pickup} → {b.drop || '—'}</td>
                      <td className="px-2 py-2.5 text-[11px] font-mono text-slate-500 whitespace-nowrap">{b.vehicle || '—'}</td>
                      <td className="px-2 py-2.5 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">{b.driver || '—'}</td>
                      <td className="px-2 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${st.badge}`}>● {st.label}</span></td>
                      <td className="px-2 py-2.5 text-xs font-bold tabular-nums text-right">{rs(fare)}</td>
                      <td className="px-2 py-2.5 text-xs tabular-nums text-right text-slate-500">{rs(exp)}</td>
                      <td className="px-2 py-2.5 text-xs font-semibold tabular-nums text-right text-emerald-500">{rs(fare - exp)}</td>
                      <td className="px-2 py-2.5 text-right">
                        <button onClick={() => navigate('/trips')} title="View in Trips" aria-label="View in Trips"
                          className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                          <Eye size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 md:hidden">
            {pageRows.map(b => {
              const st = ST4[bucketStatus(b.status)]
              const exp = tripExp(b)
              const fare = Number(b.fare) || 0
              return (
                <div key={b.id} className="rounded-xl border border-[var(--ap-border)] p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-mono text-slate-500 flex-1">{b.bookingNo}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.badge}`}>● {st.label}</span>
                  </div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{b.customer}</p>
                  <p className="text-[11px] text-slate-400 truncate">{b.pickup} → {b.drop || '—'}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs tabular-nums">
                    <span className="font-bold">{rs(fare)}</span>
                    <span className="text-slate-400">− {rs(exp)}</span>
                    <span className="font-semibold text-emerald-500 ml-auto">{rs(fare - exp)}</span>
                  </div>
                </div>
              )
            })}
          </div>
          <Pager page={safePage} totalPages={totalPages} total={rows.length} pageSize={TRIP_PAGE} onPage={setPage} label="trips" />
        </>)}
      </Panel>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Drivers
// ─────────────────────────────────────────────────────────────
function DriverPerformance() {
  const [data, setData] = useState([])
  useEffect(() => { getDriverPerformance().then(d => setData(Array.isArray(d) ? d : [])) }, [])
  const maxTrips = Math.max(...data.map(d => d.completedTrips), 1)
  const top = data[0]
  const handleExport = () => exportToCSV(data, [
    { label: 'Driver', key: 'name' }, { label: 'Total Trips', key: 'totalTrips' },
    { label: 'Completed', key: 'completedTrips' }, { label: 'Revenue (Rs.)', key: 'revenue' },
    { label: 'Present Days', key: 'presentDays' }, { label: 'Working Hours', key: 'workingHours' },
    { label: 'Rating', key: 'rating' },
  ], 'driver_performance')

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon={<User size={16} />} value={data.length} label="Total Drivers" sub="This month" tone="blue" valueClass="text-slate-800 dark:text-white" />
        <KpiCard icon={<CheckCircle size={16} />} value={data.reduce((s, d) => s + d.completedTrips, 0)} label="Completed Trips" sub="All drivers" tone="green" valueClass="text-emerald-500" />
        <KpiCard icon={<IndianRupee size={16} />} value={rsK(data.reduce((s, d) => s + d.revenue, 0))} label="Driver Revenue" sub="Completed fare" tone="violet" valueClass="text-slate-800 dark:text-white" />
        <KpiCard icon={<TrendingUp size={16} />} value={top ? top.name.split(' ')[0] : '—'} label="Top Driver" sub={top ? `${top.completedTrips} completed` : 'No data'} tone="amber" valueClass="text-slate-800 dark:text-white" />
      </div>
      <Panel title="Driver Performance" sub="Trips, revenue and attendance" right={<ExportBtn onClick={handleExport} />}>
        {data.length === 0 ? <EmptyBlock text="No driver data." /> : (
          <div className="space-y-2.5">
            {data.map((d, i) => (
              <div key={d.id} className="rounded-xl border border-[var(--ap-border)] p-3">
                <div className="flex items-center gap-3 mb-2">
                  <div className="relative flex-shrink-0">
                    <Avatar name={d.name} size={36} />
                    {i === 0 && <span className="absolute -top-1.5 -right-1.5 text-sm">🏆</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-800 dark:text-white text-sm truncate">{d.name}</p>
                      <span className="text-[10px] text-amber-500 font-bold whitespace-nowrap">★ {d.rating}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">{d.vehicle || '—'} · {d.presentDays} days present · {d.workingHours}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-semibold tabular-nums">{d.completedTrips}<span className="text-[10px] text-slate-400 font-bold">/{d.totalTrips}</span></p>
                    <p className="text-[10px] font-semibold text-emerald-500 tabular-nums">{rsK(d.revenue)}</p>
                  </div>
                </div>
                <div className="h-1.5 bg-[var(--ap-border)] rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.round(d.completedTrips / maxTrips * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Vehicles
// ─────────────────────────────────────────────────────────────
function VehiclePerformance() {
  const [data, setData] = useState([])
  useEffect(() => { getVehiclePerformance().then(d => setData(Array.isArray(d) ? d : [])) }, [])
  const maxTrips = Math.max(...data.map(v => v.completedTrips), 1)
  const handleExport = () => exportToCSV(data, [
    { label: 'Vehicle', key: 'reg' }, { label: 'Type', key: 'type' }, { label: 'Model', key: 'model' },
    { label: 'Total Trips', key: 'totalTrips' }, { label: 'Completed', key: 'completedTrips' },
    { label: 'Distance (KM)', key: 'distance' }, { label: 'Fuel Cost (Rs.)', key: 'fuelCost' },
    { label: 'Maint Cost (Rs.)', key: 'maintCost' }, { label: 'Total Cost (Rs.)', key: 'totalCost' },
  ], 'vehicle_performance')

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon={<Car size={16} />} value={data.length} label="Total Vehicles" sub="In fleet" tone="amber" valueClass="text-slate-800 dark:text-white" />
        <KpiCard icon={<CheckCircle size={16} />} value={data.reduce((s, v) => s + v.completedTrips, 0)} label="Completed Trips" sub="All vehicles" tone="green" valueClass="text-emerald-500" />
        <KpiCard icon={<Navigation size={16} />} value={`${Math.round(data.reduce((s, v) => s + v.distance, 0)).toLocaleString('en-IN')} km`} label="Total Distance" sub="All trips" tone="blue" valueClass="text-slate-800 dark:text-white" />
        <KpiCard icon={<Wallet size={16} />} value={rsK(data.reduce((s, v) => s + v.totalCost, 0))} label="Running Cost" sub="Fuel + maintenance" tone="red" valueClass="text-red-500" />
      </div>
      <Panel title="Vehicle Performance" sub="Trips, distance and running cost" right={<ExportBtn onClick={handleExport} />}>
        {data.length === 0 ? <EmptyBlock text="No vehicle data." /> : (
          <div className="space-y-2.5">
            {data.map((v, i) => (
              <div key={v.id} className="rounded-xl border border-[var(--ap-border)] p-3">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${i === 0 ? 'bg-blue-600' : 'bg-[var(--ap-accent)]'}`}>
                    <Car size={17} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-sf font-semibold text-slate-800 dark:text-white text-sm tracking-wider">{v.reg}</p>
                      {i === 0 && <span className="text-[9px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">Most Used</span>}
                    </div>
                    <p className="text-[10px] text-slate-400">{v.model} · {v.type} · {Number(v.distance).toLocaleString('en-IN')} km</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-semibold tabular-nums">{v.completedTrips}<span className="text-[10px] text-slate-400 font-bold">/{v.totalTrips}</span></p>
                    <p className="text-[10px] font-semibold text-amber-500 tabular-nums">{rsK(v.totalCost)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {[['Fuel', v.fuelCost, 'text-orange-500'], ['Maint', v.maintCost, 'text-red-500'], ['Total', v.totalCost, 'text-amber-500']].map(([l, val, c]) => (
                    <div key={l} className="bg-[var(--ap-surface-2)] rounded-lg py-1.5 text-center">
                      <p className={`text-xs font-semibold tabular-nums ${c}`}>{rs(val)}</p>
                      <p className="text-[9px] text-slate-400">{l}</p>
                    </div>
                  ))}
                </div>
                <div className="h-1.5 bg-[var(--ap-border)] rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.round(v.completedTrips / maxTrips * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Customers
// ─────────────────────────────────────────────────────────────
const CUST_PAGE = 8
function CustomerReports() {
  const [report, setReport] = useState({ rows: [], totalCustomers: 0, repeatCustomers: 0, corporateCustomers: 0, topByRevenue: [], topByTrips: [] })
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  useEffect(() => { getCustomerReport().then(d => setReport(d ?? { rows: [], totalCustomers: 0, repeatCustomers: 0, corporateCustomers: 0, topByRevenue: [], topByTrips: [] })) }, [])
  const maxTrips = Math.max(...report.topByTrips.map(c => c.totalTrips), 1)

  const rows = useMemo(() => {
    if (!search) return report.rows
    const q = search.toLowerCase()
    return report.rows.filter(c => [c.name, c.city, c.mobile, c.type].some(v => String(v ?? '').toLowerCase().includes(q)))
  }, [report.rows, search])
  const totalPages = Math.max(1, Math.ceil(rows.length / CUST_PAGE))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const pageRows = rows.slice((safePage - 1) * CUST_PAGE, safePage * CUST_PAGE)
  useEffect(() => { setPage(1) }, [search])

  const handleExport = () => exportToCSV(report.rows, [
    { label: 'Customer', key: 'name' }, { label: 'Type', key: 'type' }, { label: 'City', key: 'city' },
    { label: 'Mobile', key: 'mobile' }, { label: 'Total Trips', key: 'totalTrips' },
    { label: 'Completed', key: 'completedTrips' }, { label: 'Revenue (Rs.)', key: 'totalRevenue' },
  ], 'customer_report')

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon={<Users size={16} />} value={report.totalCustomers} label="Total Customers" sub="Active customers" tone="violet" valueClass="text-slate-800 dark:text-white" />
        <KpiCard icon={<TrendingUp size={16} />} value={report.repeatCustomers} label="Repeat Customers" sub="2+ trips" tone="green" valueClass="text-emerald-500" />
        <KpiCard icon={<Wallet size={16} />} value={report.corporateCustomers} label="Corporate / Agent" sub="B2B accounts" tone="blue" valueClass="text-slate-800 dark:text-white" />
        <KpiCard icon={<IndianRupee size={16} />} value={rsK(report.rows.reduce((s, c) => s + (c.totalRevenue || 0), 0))} label="Customer Revenue" sub="All time" tone="amber" valueClass="text-slate-800 dark:text-white" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Top Customers by Revenue">
          <RankTable emptyText="No customer data." rows={report.topByRevenue} cols={[
            { label: '#', render: (_, i) => <span className="text-slate-400 tabular-nums">{i + 1}</span> },
            { label: 'Customer', render: c => <span className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200"><Avatar name={c.name} size={22} /><span className="truncate">{c.name}</span></span> },
            { label: 'Trips', right: true, render: c => <span className="tabular-nums">{c.totalTrips}</span> },
            { label: 'Revenue', right: true, render: c => <span className="font-semibold text-amber-500 tabular-nums">{rs(c.totalRevenue)}</span> },
          ]} />
        </Panel>
        <Panel title="Top Customers by Trips">
          {report.topByTrips.length === 0 ? <EmptyBlock text="No customer data." /> : (
            <div className="space-y-2.5">
              {report.topByTrips.map((c, i) => (
                <div key={c.id} className="flex items-center gap-2.5">
                  <span className="text-[10px] font-bold text-slate-400 w-4 flex-shrink-0 tabular-nums">{i + 1}</span>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200 flex-1 truncate">{c.name}</p>
                  <div className="w-24 h-1.5 bg-[var(--ap-border)] rounded-full overflow-hidden flex-shrink-0">
                    <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.round(c.totalTrips / maxTrips * 100)}%` }} />
                  </div>
                  <span className="text-xs font-semibold tabular-nums w-8 text-right">{c.totalTrips}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
      <Panel title={`All Customers (${rows.length})`} right={<ExportBtn onClick={handleExport} />}>
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[var(--ap-border)] bg-[var(--ap-surface-2)] flex-1 min-w-[160px] max-w-xs mb-3">
          <Search size={13} className="text-slate-400 flex-shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer…"
            className="bg-transparent text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none w-full" />
        </div>
        {rows.length === 0 ? <EmptyBlock text="No customers found." /> : (<>
          <div className="overflow-x-auto -mx-1 hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--ap-border)]">
                  {['#', 'Customer', 'Type', 'Trips', 'Completed', 'Revenue'].map(h => (
                    <th key={h} className={`px-2 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap ${['Trips', 'Completed', 'Revenue'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((c, i) => (
                  <tr key={c.id} className="border-b border-[var(--ap-border)] last:border-0 hover:bg-[var(--ap-surface-2)] transition-colors">
                    <td className="px-2 py-2.5 text-xs text-slate-400 tabular-nums">{(safePage - 1) * CUST_PAGE + i + 1}</td>
                    <td className="px-2 py-2.5"><span className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200"><Avatar name={c.name} size={24} /><span className="truncate">{c.name}</span></span></td>
                    <td className="px-2 py-2.5 text-xs text-slate-500 capitalize">{c.type || '—'}</td>
                    <td className="px-2 py-2.5 text-xs tabular-nums text-right">{c.totalTrips}</td>
                    <td className="px-2 py-2.5 text-xs font-bold text-emerald-500 tabular-nums text-right">{c.completedTrips}</td>
                    <td className="px-2 py-2.5 text-xs font-semibold tabular-nums text-right">{rs(c.totalRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 md:hidden">
            {pageRows.map(c => (
              <div key={c.id} className="rounded-xl border border-[var(--ap-border)] p-3 flex items-center gap-2.5">
                <Avatar name={c.name} size={32} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{c.name}</p>
                  <p className="text-[10px] text-slate-400">{c.totalTrips} trips · {c.completedTrips} completed</p>
                </div>
                <p className="text-xs font-semibold tabular-nums">{rs(c.totalRevenue)}</p>
              </div>
            ))}
          </div>
          <Pager page={safePage} totalPages={totalPages} total={rows.length} pageSize={CUST_PAGE} onPage={setPage} label="customers" />
        </>)}
      </Panel>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Expenses
// ─────────────────────────────────────────────────────────────
function ExpenseAnalytics() {
  const [data, setData] = useState({ months: [], byCategory: [], monthTotal: 0, allTimeTotal: 0 })
  useEffect(() => { getExpenseAnalytics().then(d => setData(d ?? { months: [], byCategory: [], monthTotal: 0, allTimeTotal: 0 })) }, [])
  const maxMonth = Math.max(...data.months.map(m => m.tot), 1)
  const catTotal = data.byCategory.reduce((s, t) => s + t.total, 0) || 1
  const topCat = data.byCategory[0]
  const handleExport = () => exportToCSV(
    data.months.map(m => ({ month: m.lbl, total: m.tot })),
    [{ label: 'Month', key: 'month' }, { label: 'Total (Rs.)', key: 'total' }],
    'expense_analytics'
  )
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon={<TrendingDown size={16} />} value={rsK(data.monthTotal)} label="This Month" sub="Paid out" tone="red" valueClass="text-red-500" />
        <KpiCard icon={<Wallet size={16} />} value={rsK(data.allTimeTotal)} label="All-Time Expenses" sub="All categories" tone="blue" valueClass="text-slate-800 dark:text-white" />
        <KpiCard icon={<BarChart2 size={16} />} value={topCat ? String(topCat.label).replace(/_/g, ' ') : '—'} label="Top Category" sub={topCat ? rsK(topCat.total) : 'No data'} tone="amber" valueClass="text-slate-800 dark:text-white" />
        <KpiCard icon={<Calendar size={16} />} value={data.months.length ? rsK(Math.round(data.months.reduce((s, m) => s + m.tot, 0) / data.months.length)) : '—'} label="Monthly Average" sub="6-month view" tone="violet" valueClass="text-slate-800 dark:text-white" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Expense Trend" sub="Last 6 months" icon={<TrendingDown size={15} className="text-red-400" />} right={<ExportBtn onClick={handleExport} />}>
          {data.months.every(m => m.tot === 0) ? <EmptyBlock text="No expense data." /> : (
            <div className="flex items-end gap-2 h-32">
              {data.months.map(m => (
                <div key={m.key} title={`${m.lbl}: ${rs(m.tot)}`} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                  <span className="text-[9px] font-bold tabular-nums text-slate-500">{m.tot >= 1000 ? `${(m.tot / 1000).toFixed(0)}k` : m.tot}</span>
                  <div className="w-full max-w-[36px] rounded-t-md bg-red-400/85" style={{ height: `${Math.max(4, Math.round(m.tot / maxMonth * 100))}%` }} />
                  <span className="text-[9px] font-bold text-slate-400">{m.lbl}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-between text-xs border-t border-[var(--ap-border)] pt-2 mt-2">
            <span className="text-slate-500">This Month</span>
            <span className="font-semibold text-amber-500 tabular-nums">{rs(data.monthTotal)}</span>
          </div>
        </Panel>
        <Panel title="Expense Breakdown" sub="By category · all time">
          {data.byCategory.length === 0 ? <EmptyBlock text="No expense data." /> : (
            <RankTable rows={data.byCategory.slice(0, 7)} cols={[
              { label: '#', render: (_, i) => <span className="text-slate-400 tabular-nums">{i + 1}</span> },
              { label: 'Category', render: t => <span className="font-bold text-slate-700 dark:text-slate-200 capitalize">{String(t.label).replace(/_/g, ' ')}</span> },
              { label: 'Amount', right: true, render: t => <span className="tabular-nums">{rs(t.total)}</span> },
              { label: '%', right: true, render: t => <span className="font-semibold tabular-nums">{Math.round(t.total / catTotal * 100)}%</span> },
            ]} />
          )}
        </Panel>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Payroll
// ─────────────────────────────────────────────────────────────
function PayrollAnalytics() {
  const navigate = useNavigate()
  const [data, setData] = useState({ totalPaid: 0, pendingCount: 0, approvedCount: 0, paidCount: 0, draftCount: 0, totalIncentives: 0, byDriver: [] })
  useEffect(() => { getPayrollAnalytics().then(d => setData(d ?? { totalPaid: 0, pendingCount: 0, approvedCount: 0, paidCount: 0, draftCount: 0, totalIncentives: 0, byDriver: [] })) }, [])
  const maxPay = Math.max(...data.byDriver.map(d => d.paid), 1)
  const ranked = [...data.byDriver].sort((a, b) => b.paid - a.paid)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon={<IndianRupee size={16} />} value={rsK(data.totalPaid)} label="Total Paid" sub="Settled payroll" tone="green" valueClass="text-emerald-500" />
        <KpiCard icon={<RefreshCw size={16} />} value={data.pendingCount} label="Pending Approval" sub="Awaiting review" tone="blue" valueClass="text-slate-800 dark:text-white" />
        <KpiCard icon={<CheckCircle size={16} />} value={data.paidCount} label="Paid Settlements" sub={`${data.draftCount} drafts`} tone="teal" valueClass="text-slate-800 dark:text-white" />
        <KpiCard icon={<Wallet size={16} />} value={data.approvedCount} label="Approved Unpaid" sub="Ready to pay" tone="amber" valueClass="text-slate-800 dark:text-white" />
      </div>
      <Panel title="Paid Amount by Driver" right={
        <button onClick={() => navigate('/payroll')} className="text-[11px] font-bold text-blue-500 hover:underline whitespace-nowrap">View Payroll ›</button>
      }>
        {ranked.length === 0 ? <EmptyBlock text="No settlements yet." /> : (
          <RankTable rows={ranked} cols={[
            { label: '#', render: (_, i) => <span className="text-slate-400 tabular-nums">{i + 1}</span> },
            {
              label: 'Driver', render: d => (
                <span className="flex items-center gap-2">
                  <Avatar name={d.name} size={24} />
                  <span className="min-w-0"><span className="block font-bold text-slate-700 dark:text-slate-200 truncate">{d.name}</span>
                    <span className="block text-[10px] text-slate-400">{d.count} settlement{d.count !== 1 ? 's' : ''}</span></span>
                </span>
              ),
            },
            {
              label: 'Paid', right: true, render: d => (
                <span className="min-w-[140px] inline-block">
                  <span className="block font-semibold text-emerald-500 tabular-nums">{rs(d.paid)}</span>
                  <span className="block h-1 bg-[var(--ap-border)] rounded-full overflow-hidden mt-1">
                    <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${Math.round(d.paid / maxPay * 100)}%` }} />
                  </span>
                </span>
              ),
            },
          ]} />
        )}
      </Panel>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Monthly
// ─────────────────────────────────────────────────────────────
const ML = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function MonthlySummary() {
  const curYear = new Date().getFullYear()
  const [year, setYear] = useState(curYear)
  const [data, setData] = useState([])
  useEffect(() => { getMonthlySummary(year).then(setData).catch(() => { }) }, [year])
  const maxRev = Math.max(...data.map(d => d.revenue), 1)
  const totalRev = data.reduce((s, d) => s + d.revenue, 0)
  const totalBk = data.reduce((s, d) => s + d.bookings, 0)
  const COLS = [{ label: 'Month', key: 'month' }, { label: 'Bookings', key: 'bookings' }, { label: 'Completed', key: 'completed' }, { label: 'Cancelled', key: 'cancelled' }, { label: 'Revenue', key: 'revenue' }]
  const exportRows = data.map(d => ({ ...d, month: ML[d.month - 1] }))
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard icon={<IndianRupee size={16} />} value={rs(totalRev)} label={`Total Revenue ${year}`} sub={`${totalBk} bookings`} tone="blue" valueClass="text-slate-800 dark:text-white" />
        <KpiCard icon={<Navigation size={16} />} value={totalBk} label={`Total Bookings ${year}`} sub={`${data.reduce((s, d) => s + d.completed, 0)} completed`} tone="green" valueClass="text-emerald-500" />
      </div>
      <Panel title="Revenue by Month" right={
        <div className="flex items-center gap-2">
          <FilterSel value={year} onChange={v => setYear(Number(v))}>
            {[curYear - 1, curYear, curYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </FilterSel>
          <ExportPanel
            onCSV={() => exportToCSV(exportRows, COLS, `monthly_${year}`)}
            onExcel={() => exportToExcel(exportRows, COLS, `monthly_${year}`)}
            onPDF={() => exportToPDF(exportRows, COLS, `monthly_${year}`, `Monthly Summary ${year}`)}
          />
        </div>
      }>
        {data.every(d => d.revenue === 0) ? <EmptyBlock text={`No revenue in ${year}.`} /> : (<>
          <div className="flex items-end gap-1.5 h-32 mb-4">
            {data.map(d => (
              <div key={d.month} title={`${ML[d.month - 1]}: ${rs(d.revenue)} · ${d.bookings} trips`} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                <div className="w-full max-w-[36px] rounded-t-md bg-blue-600" style={{ height: `${Math.max(3, Math.round(d.revenue / maxRev * 100))}%` }} />
                <span className="text-[9px] font-bold text-slate-400">{ML[d.month - 1]}</span>
              </div>
            ))}
          </div>
          <RankTable rows={exportRows} cols={[
            { label: 'Month', render: r => <span className="font-bold text-slate-700 dark:text-slate-200">{r.month}</span> },
            { label: 'Bookings', right: true, render: r => <span className="tabular-nums">{r.bookings}</span> },
            { label: 'Completed', right: true, render: r => <span className="font-bold text-emerald-500 tabular-nums">{r.completed}</span> },
            { label: 'Cancelled', right: true, render: r => <span className="text-red-500 tabular-nums">{r.cancelled}</span> },
            { label: 'Revenue', right: true, render: r => <span className="font-semibold tabular-nums">{rs(r.revenue)}</span> },
          ]} />
        </>)}
      </Panel>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Operations + Alerts
// ─────────────────────────────────────────────────────────────
function OperationsMonitor() {
  const [ops, setOps] = useState({ drivers: { available: 0, onLeave: 0 }, vehicles: { available: 0, maintenance: 0, assigned: 0 }, trips: { scheduled: 0, assigned: 0, inProgress: 0, completed: 0, cancelled: 0 } })
  useEffect(() => { getOperationsMonitor().then(d => setOps(d ?? { drivers: { available: 0, onLeave: 0 }, vehicles: { available: 0, maintenance: 0, assigned: 0 }, trips: { scheduled: 0, assigned: 0, inProgress: 0, completed: 0, cancelled: 0 } })) }, [])
  const groups = [
    {
      title: 'Drivers', icon: <User size={15} className="text-emerald-500" />, items: [
        { l: 'Available', v: ops.drivers.available, tone: 'green' },
        { l: 'On Leave', v: ops.drivers.onLeave, tone: 'amber' },
      ],
    },
    {
      title: 'Vehicles', icon: <Car size={15} className="text-amber-500" />, items: [
        { l: 'Available', v: ops.vehicles.available, tone: 'green' },
        { l: 'Assigned', v: ops.vehicles.assigned, tone: 'blue' },
        { l: 'Maintenance', v: ops.vehicles.maintenance, tone: 'red' },
      ],
    },
    {
      title: 'Trips', icon: <Navigation size={15} className="text-blue-500" />, items: [
        { l: 'Scheduled', v: ops.trips.scheduled, tone: 'blue' },
        { l: 'Assigned', v: ops.trips.assigned, tone: 'violet' },
        { l: 'In Progress', v: ops.trips.inProgress, tone: 'amber' },
        { l: 'Completed', v: ops.trips.completed, tone: 'green' },
        { l: 'Cancelled', v: ops.trips.cancelled, tone: 'red' },
      ],
    },
  ]
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {groups.map(g => (
        <Panel key={g.title} title={g.title} icon={g.icon}>
          <div className="space-y-2">
            {g.items.map(it => (
              <div key={it.l} className="flex items-center justify-between bg-[var(--ap-surface-2)] rounded-xl px-3 py-2.5">
                <KpiDot label={it.l} tone={it.tone} />
                <span className="text-lg font-sf font-semibold tabular-nums">{it.value}</span>
              </div>
            ))}
          </div>
        </Panel>
      ))}
    </div>
  )
}

function KpiDot({ label, tone }) {
  const dots = { green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500', blue: 'bg-blue-500', violet: 'bg-violet-500' }
  return (
    <span className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dots[tone]} ${label === 'In Progress' ? 'animate-pulse' : ''}`} />
      {label}
    </span>
  )
}

function BusinessAlerts() {
  const [alerts, setAlerts] = useState([])
  useEffect(() => { getBusinessAlerts().then(setAlerts).catch(() => { }) }, [])
  const PC = {
    high: { badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', label: 'High' },
    medium: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', label: 'Medium' },
    low: { badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', label: 'Low' },
  }
  const TI = { insurance: '🛡', permit: '📋', fc: '📄', puc: '💨', service: '🔧' }
  const highs = alerts.filter(a => a.priority === 'high').length
  if (alerts.length === 0) return (
    <div className="ap-surface rounded-2xl p-10 text-center">
      <CheckCircle size={34} className="mx-auto text-emerald-400 mb-3" />
      <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">All documents are up to date</p>
      <p className="text-xs text-slate-400 mt-1">No alerts at this time</p>
    </div>
  )
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KpiCard icon={<AlertTriangle size={16} />} value={alerts.length} label="Total Alerts" sub="Documents & service" tone="amber" valueClass="text-slate-800 dark:text-white" />
        <KpiCard icon={<X size={16} />} value={highs} label="High Priority" sub="Act now" tone="red" valueClass="text-red-500" />
        <KpiCard icon={<Calendar size={16} />} value={alerts.filter(a => a.days < 0).length} label="Overdue" sub="Expired already" tone="violet" valueClass="text-slate-800 dark:text-white" />
      </div>
      <div className="space-y-2">
        {alerts.map((a, i) => {
          const pc = PC[a.priority] || PC.low
          return (
            <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${a.priority === 'high' ? 'bg-red-50 dark:bg-red-900/15 border-red-200 dark:border-red-800/30' : 'bg-amber-50 dark:bg-amber-900/15 border-amber-200 dark:border-amber-800/30'}`}>
              <span className="text-xl flex-shrink-0">{TI[a.type] || '⚠'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{a.label}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Expires: {a.expiry} · {a.days < 0 ? `${Math.abs(a.days)}d overdue` : a.days === 0 ? 'Today!' : `${a.days}d left`}
                </p>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${pc.badge}`}>{pc.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Main page
// ─────────────────────────────────────────────────────────────
const TABS = [
  { key: 'overview', label: 'Overview', icon: BarChart2 },
  { key: 'trips', label: 'Trips', icon: Navigation },
  { key: 'drivers', label: 'Drivers', icon: User },
  { key: 'vehicles', label: 'Vehicles', icon: Car },
  { key: 'customers', label: 'Customers', icon: Users },
  { key: 'expenses', label: 'Expenses', icon: TrendingDown },
  { key: 'payroll', label: 'Payroll', icon: IndianRupee },
  { key: 'monthly', label: 'Monthly', icon: Calendar },
  { key: 'operations', label: 'Operations', icon: RefreshCw },
  { key: 'alerts', label: 'Alerts', icon: AlertTriangle },
]

const TAB_META = {
  overview: { title: 'Executive Overview', sub: 'All modules snapshot' },
  monthly: { title: 'Monthly Summary', sub: 'Revenue by month with export' },
  trips: { title: 'Trip Reports', sub: 'Date range filter + CSV export' },
  drivers: { title: 'Driver Performance', sub: 'Current month' },
  vehicles: { title: 'Vehicle Performance', sub: 'All time' },
  customers: { title: 'Customer Reports', sub: 'Search + CSV export' },
  expenses: { title: 'Expense Analytics', sub: '6-month view' },
  payroll: { title: 'Payroll Analytics', sub: 'All settlements' },
  operations: { title: 'Operations Monitor', sub: 'Live status' },
  alerts: { title: 'Business Alerts', sub: 'Documents & service' },
}

export default function Reports() {
  const { isDriver } = useAuth()
  const [tab, setTab] = useState('overview')
  const [summary, setSummary] = useState({ trips: { total: 0, active: 0, completed: 0, cancelled: 0, assigned: 0, scheduled: 0 }, customers: { total: 0, corporate: 0, active: 0 }, vehicles: { total: 0, available: 0, inUse: 0, maintenance: 0 }, drivers: { total: 0, available: 0, onLeave: 0 }, finance: { totalFare: 0, totalNet: 0, totalKm: 0, totalExp: 0, monthExpenses: 0, paidPayroll: 0 } })
  useEffect(() => { getExecutiveSummary().then(d => setSummary(d ?? summary)) }, [])
  const [alerts, setAlerts] = useState([])
  useEffect(() => { getBusinessAlerts().then(setAlerts).catch(() => { }) }, [])

  if (isDriver) return (
    <div className="ap-surface rounded-2xl p-12 text-center">
      <AlertTriangle size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
      <p className="font-bold text-slate-500 dark:text-slate-400">Reports are not available for drivers.</p>
    </div>
  )

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Comprehensive business insights across all modules"
        action={alerts.length > 0 && (
          <button onClick={() => setTab('alerts')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 text-red-700 dark:text-red-400 text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
            <AlertTriangle size={13} /> {alerts.length} Alert{alerts.length !== 1 ? 's' : ''}
          </button>
        )}
      />

      <div className="overflow-x-auto no-scrollbar">
        <div className="flex gap-1 bg-[var(--ap-surface-2)] rounded-2xl p-1.5" style={{ minWidth: 'max-content' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${tab === t.key ? 'bg-[var(--ap-accent)] text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}>
              <t.icon size={13} />
              {t.label}
              {t.key === 'alerts' && alerts.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-semibold flex items-center justify-center ml-0.5">{alerts.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div>
        {tab === 'overview' && <ExecutiveOverview summary={summary} />}
        {tab === 'trips' && <TripReports />}
        {tab === 'drivers' && <DriverPerformance />}
        {tab === 'vehicles' && <VehiclePerformance />}
        {tab === 'customers' && <CustomerReports />}
        {tab === 'expenses' && <ExpenseAnalytics />}
        {tab === 'payroll' && <PayrollAnalytics />}
        {tab === 'monthly' && <MonthlySummary />}
        {tab === 'operations' && <OperationsMonitor />}
        {tab === 'alerts' && <BusinessAlerts />}
      </div>
    </div>
  )
}

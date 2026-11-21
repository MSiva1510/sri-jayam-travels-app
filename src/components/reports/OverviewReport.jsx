// ─── Executive overview ────────────────────────────────────────
// Reuses the existing executive summary, monthly summary, booking and
// expense records. No new financial definitions are introduced here.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, BarChart3, Car, IndianRupee, Navigation, TrendingDown,
  TrendingUp, UserRound, Users,
} from 'lucide-react'
import SparkChart from '../ui/SparkChart'
import StatusBar from '../ui/StatusBar'
import Button from '../ui/Button'
import Callout from '../ui/Callout'
import { getMonthlySummary } from '../../data/reportData'
import { loadBookings } from '../../data/tripTypes'
import { loadExpenses } from '../../data/expenseData'
import useReportResource from './useReportResource'
import {
  ReportIntro, ReportKpiGrid, ReportPanel, ReportSkeleton, ReportState,
  RankRows, useReportExport,
} from './ReportChrome'
import {
  bucketStatus, EMPTY_ARRAY, monthLabel, num, pct, rs, rsK, STATUS_META,
} from './reportUtils'

const ZERO_SUMMARY = {
  trips: { total: 0, active: 0, completed: 0, cancelled: 0, assigned: 0, scheduled: 0 },
  customers: { total: 0, corporate: 0, active: 0 },
  vehicles: { total: 0, available: 0, inUse: 0, maintenance: 0 },
  drivers: { total: 0, available: 0, onLeave: 0 },
  finance: { totalFare: 0, totalNet: 0, totalKm: 0, totalExp: 0, monthExpenses: 0, paidPayroll: 0 },
}

const GRANULARITIES = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
]

export default function OverviewReport({ summaryResource, refreshKey, resetKey, onRegisterExport }) {
  const navigate = useNavigate()
  const curYear = new Date().getFullYear()
  const [gran, setGran] = useState('monthly')

  useEffect(() => { setGran('monthly') }, [resetKey])

  const chartResource = useReportResource(
    `overview-chart:${gran}:${curYear}`,
    () => Promise.all([getMonthlySummary(curYear), loadBookings(), loadExpenses()]),
    { refreshKey },
  )
  const rankResource = useReportResource(
    'overview-ranks',
    () => Promise.all([loadBookings(), loadExpenses()]),
    { refreshKey },
  )

  const summary = summaryResource.data || ZERO_SUMMARY
  const { trips, customers, vehicles, drivers, finance } = summary

  const points = useMemo(() => {
    const result = chartResource.data
    if (!result) return []
    const [monthly = [], bookings = [], expenses = []] = result
    if (gran === 'monthly') {
      const byMonth = {}
      expenses.forEach(e => {
        const key = String(e.date || '').slice(0, 7)
        if (key.startsWith(String(curYear))) byMonth[key] = (byMonth[key] || 0) + num(e.amount)
      })
      return Array.from({ length: 12 }, (_, i) => ({
        x: monthLabel(i + 1),
        revenue: num(monthly.find(item => item.month === i + 1)?.revenue),
        expenses: num(byMonth[`${curYear}-${String(i + 1).padStart(2, '0')}`]),
      }))
    }

    const days = gran === 'daily' ? 30 : 84
    const step = gran === 'daily' ? 1 : 7
    const buckets = []
    for (let i = days - step; i >= 0; i -= step) {
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      start.setDate(start.getDate() - i - (step - 1))
      const end = new Date(start)
      end.setDate(end.getDate() + step - 1)
      end.setHours(23, 59, 59, 999)
      const inWindow = (value) => {
        const time = new Date(`${String(value || '').slice(0, 10)}T00:00:00`).getTime()
        return time >= start.getTime() && time <= end.getTime()
      }
      buckets.push({
        x: start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        revenue: bookings.filter(b => inWindow(b.startDate)).reduce((sum, b) => sum + num(b.fare), 0),
        expenses: expenses.filter(e => inWindow(e.date)).reduce((sum, e) => sum + num(e.amount), 0),
      })
    }
    return buckets
  }, [chartResource.data, curYear, gran])

  const chartData = useMemo(() => points.map(point => ({
    label: point.x,
    revenue: point.revenue,
    expenses: point.expenses,
    net: point.revenue - point.expenses,
  })), [points])
  const chartEmpty = chartData.length === 0 || chartData.every(point => point.revenue === 0 && point.expenses === 0)

  const statusBookings = Array.isArray(rankResource.data?.[0]) ? rankResource.data[0] : EMPTY_ARRAY
  const statusBuckets = useMemo(() => {
    const counts = { completed: 0, ongoing: 0, cancelled: 0, scheduled: 0 }
    statusBookings.forEach(booking => {
      const bucket = bucketStatus(booking.status)
      if (bucket in counts) counts[bucket] += 1
    })
    return [
      { label: STATUS_META.completed.label, value: counts.completed, color: STATUS_META.completed.color },
      { label: STATUS_META.ongoing.label, value: counts.ongoing, color: STATUS_META.ongoing.color },
      { label: STATUS_META.cancelled.label, value: counts.cancelled, color: STATUS_META.cancelled.color },
      { label: STATUS_META.scheduled.label, value: counts.scheduled, color: STATUS_META.scheduled.color },
    ]
  }, [statusBookings])

  const ranks = useMemo(() => {
    const [bookings = [], expensesData = []] = rankResource.data || []
    const completed = bookings.filter(b => b.status === 'completed')
    const routes = new Map()
    const custs = new Map()
    completed.forEach(b => {
      const routeKey = `${b.pickup || '—'} → ${b.drop || 'Local'}`
      const route = routes.get(routeKey) || { route: routeKey, trips: 0, revenue: 0 }
      route.trips += 1
      route.revenue += num(b.fare)
      routes.set(routeKey, route)

      const customerKey = b.customer || '—'
      const customer = custs.get(customerKey) || { customer: customerKey, trips: 0, revenue: 0 }
      customer.trips += 1
      customer.revenue += num(b.fare)
      custs.set(customerKey, customer)
    })
    const categories = new Map()
    expensesData.forEach(e => {
      const key = e.type || 'other'
      categories.set(key, (categories.get(key) || 0) + num(e.amount))
    })
    const expenseTotal = [...categories.values()].reduce((sum, value) => sum + value, 0) || 1
    return {
      routes: [...routes.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
      customers: [...custs.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
      expenses: [...categories.entries()]
        .map(([cat, amount]) => ({ cat, amount, pct: pct(amount, expenseTotal) }))
        .sort((a, b) => b.amount - a.amount).slice(0, 5),
    }
  }, [rankResource.data])

  const kpis = [
    { label: 'Total Revenue', value: rsK(finance.totalFare), sub: 'All bookings', icon: IndianRupee, tone: 'blue' },
    { label: 'Total Expenses', value: rsK(finance.totalExp), sub: 'All recorded expenses', icon: TrendingDown, tone: 'red' },
    { label: 'Net Profit', value: rsK(finance.totalNet), sub: 'Revenue − expenses', icon: TrendingUp, tone: 'green' },
    { label: 'Total Trips', value: trips.total, sub: `${trips.completed} completed`, icon: Navigation, tone: 'blue' },
    { label: 'Total Customers', value: customers.total, sub: `${customers.active} active`, icon: Users, tone: 'violet' },
    { label: 'Total Vehicles', value: vehicles.total, sub: `${vehicles.available} available`, icon: Car, tone: 'amber' },
    { label: 'Total Drivers', value: drivers.total, sub: `${drivers.available} active`, icon: UserRound, tone: 'green' },
  ]

  const exportConfig = useMemo(() => ({
    rows: summaryResource.error || summaryResource.loading
      ? EMPTY_ARRAY
      : kpis.map(kpi => ({ metric: kpi.label, value: kpi.value })),
    columns: [{ label: 'Metric', key: 'metric' }, { label: 'Value', key: 'value' }],
    filename: 'overview_report',
    title: 'Business Overview',
  }), [summaryResource.error, summaryResource.loading, finance.totalFare, finance.totalExp, finance.totalNet, trips.total, trips.completed, customers.total, customers.active, vehicles.total, vehicles.available, drivers.total, drivers.available])

  useReportExport(onRegisterExport, exportConfig)

  return (
    <div className="space-y-4">
      <ReportIntro
        title="Business at a glance"
        description="Revenue, expenses, fleet activity and the accounts behind today’s operations."
        scope="All-time KPIs and rankings. The financial chart uses the current year for Monthly, or a trailing 30/84-day window for Daily/Weekly."
      />

      {summaryResource.error ? (
        <Callout tone="red" icon={AlertTriangle} title="Could not load the executive summary"
          sub={summaryResource.error.message} actionLabel="Retry" onAction={summaryResource.retry} />
      ) : summaryResource.loading ? <ReportSkeleton variant="kpi" /> : (
        <>
          <ReportKpiGrid items={kpis.slice(0, 4)} columns="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" />
          <ReportKpiGrid items={kpis.slice(4)} columns="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" />
        </>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ReportPanel
          className="xl:col-span-2"
          eyebrow="Financial performance"
          title="Revenue & Expenses"
          sub={gran === 'monthly' ? `Monthly trend for ${curYear}` : gran === 'daily' ? 'Last 30 days' : 'Last 12 weeks'}
          icon={BarChart3}
          action={
            <div className="flex rounded-[10px] bg-[var(--ap-surface-2)] p-1" role="group" aria-label="Chart granularity">
              {GRANULARITIES.map(option => (
                <button key={option.key} type="button" onClick={() => setGran(option.key)}
                  aria-pressed={gran === option.key}
                  className={`px-3 py-1.5 rounded-[8px] text-[11px] font-semibold ap-focus transition-colors ${
                    gran === option.key ? 'bg-[var(--ap-accent)] text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'
                  }`}>{option.label}</button>
              ))}
            </div>
          }
        >
          <ReportState resource={chartResource} skeleton="chart" empty={chartEmpty}
            emptyIcon={BarChart3} emptyTitle="No revenue data for this view"
            emptyDescription="Try another granularity or add bookings and expenses for this period.">
            <div className="space-y-5">
              <ChartLine label="Net profit" color="var(--ap-success)" data={chartData} valueKey="net" />
              <ChartLine label="Revenue" color="var(--sjt-brand)" data={chartData} valueKey="revenue" />
              <ChartLine label="Expenses" color="var(--ap-danger)" data={chartData} valueKey="expenses" />
            </div>
          </ReportState>
        </ReportPanel>

        <ReportPanel eyebrow="Trip mix" title="Trip Status Overview" sub="Distribution of all recorded trips" icon={Car}>
          <ReportState resource={rankResource} skeleton="panel" empty={false}>
            {statusBookings.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">No trips yet.</p>
            ) : (
              <StatusBar total={statusBookings.length} totalLabel="Total Trips" segments={statusBuckets} format={(value) => num(value).toLocaleString('en-IN')} />
            )}
          </ReportState>
        </ReportPanel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ReportPanel eyebrow="Ranking" title="Top Routes by Revenue" icon={Navigation}
          action={<Button variant="ghost" size="sm" onClick={() => navigate('/trips')}>View all</Button>}>
          <ReportState resource={rankResource} skeleton="panel" empty={!ranks.routes.length}
            emptyIcon={Navigation} emptyTitle="No completed trips yet">
            <RankRows rows={ranks.routes}
              primary={row => <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{row.route}</p>}
              secondary={row => <p className="text-[11px] text-slate-400">{row.trips} trips</p>}
              value={row => <p className="text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">{rs(row.revenue)}</p>}
              tone="blue" />
          </ReportState>
        </ReportPanel>

        <ReportPanel eyebrow="Ranking" title="Top Customers by Revenue" icon={Users}
          action={<Button variant="ghost" size="sm" onClick={() => navigate('/customers')}>View all</Button>}>
          <ReportState resource={rankResource} skeleton="panel" empty={!ranks.customers.length}
            emptyIcon={Users} emptyTitle="No completed trips yet">
            <RankRows rows={ranks.customers}
              primary={row => <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{row.customer}</p>}
              secondary={row => <p className="text-[11px] text-slate-400">{row.trips} trips</p>}
              value={row => <p className="text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">{rs(row.revenue)}</p>}
              tone="violet" />
          </ReportState>
        </ReportPanel>

        <ReportPanel eyebrow="Ranking" title="Highest Expense Categories" icon={TrendingDown}
          action={<Button variant="ghost" size="sm" onClick={() => navigate('/expenses')}>View all</Button>}>
          <ReportState resource={rankResource} skeleton="panel" empty={!ranks.expenses.length}
            emptyIcon={TrendingDown} emptyTitle="No expenses yet">
            <RankRows rows={ranks.expenses}
              primary={row => <p className="text-xs font-semibold capitalize text-slate-700 dark:text-slate-200 truncate">{row.cat.replace(/_/g, ' ')}</p>}
              secondary={row => <p className="text-[11px] text-slate-400">{row.pct}% of spend</p>}
              value={row => <p className="text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">{rs(row.amount)}</p>}
              tone="amber" />
          </ReportState>
        </ReportPanel>
      </div>
    </div>
  )
}

function ChartLine({ label, color, data, valueKey }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full" style={{ background: color }} aria-hidden="true" />
        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{label}</p>
      </div>
      <SparkChart data={data} valueKey={valueKey} labelKey="label" height={120} accent={color} format={(value) => rs(value)} />
    </div>
  )
}

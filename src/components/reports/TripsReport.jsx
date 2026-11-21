// ─── Trip report ───────────────────────────────────────────────
// The only report tab wired to the global date range because
// getTripReport(from, to, driver, vehicle) is the only trip-level report
// function that accepts one.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart3, CalendarRange, CheckCircle2, Eye, IndianRupee, Navigation,
  RefreshCw, Wallet, XCircle,
} from 'lucide-react'
import SparkChart from '../ui/SparkChart'
import StatusBar from '../ui/StatusBar'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import StatusPill from '../ui/StatusPill'
import { exportToCSV, getTripReport } from '../../data/reportData'
import { loadDrivers } from '../../data/driverData'
import { loadExpenses } from '../../data/expenseData'
import { loadVehicles } from '../../data/vehicleData'
import useReportResource from './useReportResource'
import {
  ClearFilters, DateInput, FilterSelect, ReportIntro, ReportKpiGrid,
  ReportPanel, ReportPager, ReportState, ReportToolbar, SearchInput,
  useReportExport,
} from './ReportChrome'
import {
  bucketStatus, delta, EMPTY_ARRAY, fullDt, num, pct, previousRange, rs, rsK, STATUS_META,
} from './reportUtils'

const TRIP_PAGE = 8
const EMPTY_REPORT = { rows: [], totalRevenue: 0, totalDistance: 0, completed: 0, cancelled: 0, cancelRate: 0 }

const EXPORT_COLUMNS = [
  { label: 'Date', key: 'date' },
  { label: 'Trip ID', key: 'tripId' },
  { label: 'Customer', key: 'customer' },
  { label: 'Route', key: 'route' },
  { label: 'Vehicle', key: 'vehicle' },
  { label: 'Driver', key: 'driver' },
  { label: 'Status', key: 'status' },
  { label: 'Trip Fare (Rs)', key: 'fare' },
  { label: 'Expenses (Rs)', key: 'expenses' },
  { label: 'Net Revenue (Rs)', key: 'net' },
]

export default function TripsReport({ range, onRangeChange, onResetRange, refreshKey, resetKey, onRegisterExport }) {
  const navigate = useNavigate()
  const from = range?.from || ''
  const to = range?.to || ''
  const previous = useMemo(() => previousRange(from, to), [from, to])

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [driver, setDriver] = useState('all')
  const [vehicle, setVehicle] = useState('all')
  const [gran, setGran] = useState('daily')
  const [page, setPage] = useState(1)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const reportResource = useReportResource(
    `trip-report:${from}:${to}:${driver}:${vehicle}`,
    () => getTripReport(from, to, driver, vehicle).then(data => data || EMPTY_REPORT),
    { refreshKey },
  )
  const previousResource = useReportResource(
    `trip-report:${previous.from}:${previous.to}:${driver}:${vehicle}`,
    () => getTripReport(previous.from, previous.to, driver, vehicle).then(data => data || { rows: [] }),
    { refreshKey },
  )
  const driversResource = useReportResource('trip-filter-drivers', () => loadDrivers(), { refreshKey })
  const vehiclesResource = useReportResource('trip-filter-vehicles', () => loadVehicles(), { refreshKey })
  const expensesResource = useReportResource('trip-expenses', () => loadExpenses(), { refreshKey })

  useEffect(() => { setPage(1) }, [from, to, driver, vehicle, status, search])

  useEffect(() => {
    setSearch(''); setStatus('all'); setDriver('all'); setVehicle('all')
    setGran('daily'); setPage(1)
  }, [resetKey])

  const drivers = Array.isArray(driversResource.data) ? driversResource.data : EMPTY_ARRAY
  const vehicles = Array.isArray(vehiclesResource.data) ? vehiclesResource.data : EMPTY_ARRAY
  const expenses = Array.isArray(expensesResource.data) ? expensesResource.data : EMPTY_ARRAY

  const expByTrip = useMemo(() => {
    const map = new Map()
    expenses.forEach(e => {
      const key = e.tripRef || e.booking_id
      if (key) map.set(key, (map.get(key) || 0) + num(e.amount))
    })
    return map
  }, [expenses])
  const tripExpense = (booking) => (
    expByTrip.get(booking.bookingNo) ?? expByTrip.get(booking.booking_id) ?? expByTrip.get(booking.id) ?? 0
  )

  const report = reportResource.data || EMPTY_REPORT
  const rows = useMemo(() => report.rows.filter(booking => {
    if (status !== 'all' && bucketStatus(booking.status) !== status) return false
    if (!search) return true
    const query = search.toLowerCase()
    const bucket = bucketStatus(booking.status)
    return [
      booking.bookingNo, booking.customer, booking.pickup, booking.drop,
      booking.driver, booking.vehicle, booking.status, STATUS_META[bucket]?.label,
      booking.startDate, booking.endDate, booking.returnDate,
    ].some(value => String(value ?? '').toLowerCase().includes(query))
  }), [report.rows, search, status])

  const completed = rows.filter(b => bucketStatus(b.status) === 'completed').length
  const ongoing = rows.filter(b => bucketStatus(b.status) === 'ongoing').length
  const cancelled = rows.filter(b => bucketStatus(b.status) === 'cancelled').length
  const revenue = rows.reduce((sum, b) => sum + num(b.fare), 0)
  const distance = rows.reduce((sum, b) => sum + num(b.km), 0)
  const cancelRate = pct(cancelled, rows.length)
  const avgFare = rows.length ? Math.round(revenue / rows.length) : 0
  const previousRows = previousResource.data?.rows || EMPTY_ARRAY
  const previousRevenue = previousRows.reduce((sum, b) => sum + num(b.fare), 0)

  const trend = useMemo(() => {
    if (!from || !to) return []
    const step = gran === 'daily' ? 1 : 7
    const start = new Date(`${from}T00:00:00`)
    const end = new Date(`${to}T00:00:00`)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return []
    const points = []
    for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + step)) {
      const dayStart = new Date(cursor)
      const dayEnd = new Date(cursor)
      dayEnd.setDate(dayEnd.getDate() + step - 1)
      dayEnd.setHours(23, 59, 59, 999)
      const inWindow = (value) => {
        const time = new Date(`${String(value || '').slice(0, 10)}T00:00:00`).getTime()
        return time >= dayStart.getTime() && time <= dayEnd.getTime()
      }
      const bucket = rows.filter(b => inWindow(b.startDate))
      points.push({
        label: dayStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        trips: bucket.length,
        revenue: bucket.reduce((sum, b) => sum + num(b.fare), 0),
      })
    }
    return points
  }, [rows, from, to, gran])

  const exportRows = useMemo(() => rows.map(b => {
    const expense = tripExpense(b)
    return {
      date: b.startDate,
      tripId: b.bookingNo,
      customer: b.customer,
      route: `${b.pickup || ''} → ${b.drop || ''}`,
      vehicle: b.vehicle,
      driver: b.driver,
      status: bucketStatus(b.status),
      fare: num(b.fare),
      expenses: expense,
      net: num(b.fare) - expense,
    }
  }), [rows, expByTrip])

  const retryFailed = useCallback(() => {
    if (reportResource.error) reportResource.retry()
    if (expensesResource.error) expensesResource.retry()
  }, [reportResource.error, reportResource.retry, expensesResource.error, expensesResource.retry])
  const blockingResource = useMemo(() => {
    if (reportResource.error) return { error: reportResource.error, retry: retryFailed }
    if (expensesResource.error) return { error: expensesResource.error, retry: retryFailed }
    if (reportResource.loading || expensesResource.loading) return { loading: true }
    return null
  }, [reportResource.error, reportResource.loading, expensesResource.error, expensesResource.loading, retryFailed])

  const intro = (
    <ReportIntro
      title="Trip performance"
      description="Trip-level revenue, distance, status and net earnings after linked expenses."
      scope="Global date range applied to this report only. Driver, vehicle, status and search filters apply to the loaded range."
      action={<Button variant="ghost" size="sm" icon={CalendarRange}>{fullDt(from)} — {fullDt(to)}</Button>}
    />
  )

  const exportConfig = useMemo(() => ({
    rows: blockingResource ? EMPTY_ARRAY : exportRows,
    columns: EXPORT_COLUMNS, filename: 'trips_report', title: 'Trip Report',
  }), [blockingResource, exportRows])
  useReportExport(onRegisterExport, exportConfig)

  if (blockingResource) {
    return (
      <div className="space-y-4">
        {intro}
        <ReportState resource={blockingResource} skeleton="panel" empty={false} />
      </div>
    )
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / TRIP_PAGE))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const pageRows = rows.slice((safePage - 1) * TRIP_PAGE, safePage * TRIP_PAGE)
  const activeFilters = [search, status !== 'all', driver !== 'all', vehicle !== 'all'].filter(Boolean).length

  const clearAll = () => {
    setSearch(''); setStatus('all'); setDriver('all'); setVehicle('all')
    onResetRange?.()
  }
  const changeDate = (key, value) => onRangeChange?.({ preset: 'custom', from: key === 'from' ? value : from, to: key === 'to' ? value : to })

  const kpis = [
    { label: 'Total Trips', value: rows.length, sub: 'In selected range', icon: Navigation, tone: 'blue', trend: delta(rows.length, previousRows.length) === null ? undefined : Math.abs(delta(rows.length, previousRows.length)), trendUp: delta(rows.length, previousRows.length) >= 0, trendGood: delta(rows.length, previousRows.length) >= 0 },
    { label: 'Completed', value: completed, sub: rows.length ? `${pct(completed, rows.length)}% of trips` : '—', icon: CheckCircle2, tone: 'green' },
    { label: 'Ongoing', value: ongoing, sub: rows.length ? `${pct(ongoing, rows.length)}% of trips` : '—', icon: RefreshCw, tone: 'amber' },
    { label: 'Cancelled', value: cancelled, sub: rows.length ? `${pct(cancelled, rows.length)}% of trips` : '—', icon: XCircle, tone: 'red' },
    { label: 'Total Revenue', value: rsK(revenue), sub: 'Fare for filtered trips', icon: Wallet, tone: 'violet', trend: delta(revenue, previousRevenue) === null ? undefined : Math.abs(delta(revenue, previousRevenue)), trendUp: delta(revenue, previousRevenue) >= 0, trendGood: delta(revenue, previousRevenue) >= 0 },
    { label: 'Avg. Trip Fare', value: rs(avgFare), sub: 'Per filtered trip', icon: IndianRupee, tone: 'amber' },
  ]

  return (
    <div className="space-y-4">
      {intro}

      <ReportState resource={reportResource} skeleton="kpi" empty={false}>
        <ReportKpiGrid items={kpis.slice(0, 3)} columns="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" />
        <ReportKpiGrid items={kpis.slice(3)} columns="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" className="mt-3" />
      </ReportState>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ReportPanel className="xl:col-span-2" eyebrow="Trend" title="Trips & Revenue"
          sub={`${gran === 'daily' ? 'Daily' : 'Weekly'} buckets for the selected range`} icon={BarChart3}
          action={
            <div className="flex rounded-[10px] bg-[var(--ap-surface-2)] p-1" role="group" aria-label="Trip trend granularity">
              {[['daily', 'Daily'], ['weekly', 'Weekly']].map(([key, label]) => (
                <button key={key} type="button" onClick={() => setGran(key)} aria-pressed={gran === key}
                  className={`px-3 py-1.5 rounded-[8px] text-[11px] font-semibold ap-focus transition-colors ${gran === key ? 'bg-[var(--ap-accent)] text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>{label}</button>
              ))}
            </div>
          }>
          {trend.length === 0 || trend.every(point => point.trips === 0 && point.revenue === 0) ? (
            <p className="text-xs text-slate-400 text-center py-8">No trips in this range.</p>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Trips</p>
                <SparkChart data={trend} valueKey="trips" labelKey="label" height={120}
                  format={value => `${value} trip${value !== 1 ? 's' : ''}`} />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Revenue</p>
                <SparkChart data={trend} valueKey="revenue" labelKey="label" height={120}
                  accent="var(--ap-success)" format={value => rs(value)} />
              </div>
            </div>
          )}
        </ReportPanel>

        <ReportPanel eyebrow="Distribution" title="Trip Status"
          sub={`${Math.round(distance).toLocaleString('en-IN')} km · ${cancelRate}% cancelled in this view`}
          icon={Navigation}>
          {rows.length === 0 ? <p className="text-xs text-slate-400 text-center py-8">No trips in this range.</p> : (
            <StatusBar total={rows.length} totalLabel="Trips" segments={[
              { label: 'Completed', value: completed, color: STATUS_META.completed.color },
              { label: 'Ongoing', value: ongoing, color: STATUS_META.ongoing.color },
              { label: 'Cancelled', value: cancelled, color: STATUS_META.cancelled.color },
            ].filter(segment => segment.value > 0)} />
          )}
        </ReportPanel>
      </div>

      <ReportToolbar>
        <Button variant="secondary" size="sm" className="md:hidden" onClick={() => setFiltersOpen(value => !value)}>
          Filters{activeFilters ? ` (${activeFilters})` : ''}
        </Button>
        <div className={`w-full flex-wrap items-end gap-2 ${filtersOpen ? 'flex' : 'hidden md:flex'}`}>
          <SearchInput label="Search trips" value={search} onChange={setSearch}
            placeholder="Trip ID, customer, route, status, vehicle, driver, from, to…" />
          <FilterSelect label="Status" value={status} onChange={setStatus}>
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="ongoing">Ongoing</option>
            <option value="cancelled">Cancelled</option>
            <option value="scheduled">Scheduled</option>
          </FilterSelect>
          <FilterSelect label="Vehicle" value={vehicle} onChange={setVehicle}>
            <option value="all">All vehicles</option>
            {vehicles.map(item => <option key={item.id} value={item.reg}>{item.reg}</option>)}
          </FilterSelect>
          <FilterSelect label="Driver" value={driver} onChange={setDriver}>
            <option value="all">All drivers</option>
            {drivers.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
          </FilterSelect>
          <DateInput label="From" value={from} max={to} onChange={value => changeDate('from', value)} />
          <DateInput label="To" value={to} min={from} onChange={value => changeDate('to', value)} />
          <ClearFilters onClick={clearAll} activeCount={activeFilters} />
          <Button variant="outline" size="sm" icon={BarChart3} onClick={() => exportToCSV(exportRows, EXPORT_COLUMNS, 'trips_report')}>
            Export CSV
          </Button>
        </div>
      </ReportToolbar>

      <ReportPanel eyebrow="Ledger" title={`Trips Report (${rows.length})`}
        action={<Button variant="ghost" size="sm" onClick={() => navigate('/trips')}>View trip details →</Button>}>
        <ReportState resource={reportResource} skeleton="table"
          empty={rows.length === 0} emptyIcon={Navigation}
          emptyTitle="No trips match these filters"
          emptyDescription="Adjust the period or clear a filter to see more trips.">
          <div className="hidden md:block max-h-[520px] overflow-auto -mx-1">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="sticky top-0 z-10 bg-[var(--ap-surface)]">
                <tr className="border-b border-[var(--ap-border)]">
                  {['Date', 'Trip ID', 'Customer', 'Route', 'Vehicle', 'Driver', 'Status', 'Trip Fare', 'Expenses', 'Net Revenue', 'Actions'].map((heading, index) => (
                    <th key={heading} className={`px-2.5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap ${index >= 7 ? 'text-right' : 'text-left'}`}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map(b => {
                  const key = bucketStatus(b.status)
                  const expense = tripExpense(b)
                  const fare = num(b.fare)
                  return (
                    <tr key={b.id} className="border-b border-[var(--ap-border)] last:border-0 hover:bg-[var(--ap-surface-2)] transition-colors">
                      <td className="px-2.5 py-3 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">{fullDt(b.startDate)}</td>
                      <td className="px-2.5 py-3 text-[11px] font-mono text-slate-500 whitespace-nowrap">{b.bookingNo}</td>
                      <td className="px-2.5 py-3 text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">{b.customer}</td>
                      <td className="px-2.5 py-3 text-xs text-slate-500 max-w-[170px] truncate" title={`${b.pickup || ''} → ${b.drop || ''}`}>{b.pickup || '—'} → {b.drop || '—'}</td>
                      <td className="px-2.5 py-3 text-[11px] font-mono text-slate-500 whitespace-nowrap">{b.vehicle || '—'}</td>
                      <td className="px-2.5 py-3 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">{b.driver || '—'}</td>
                      <td className="px-2.5 py-3"><StatusPill tone={STATUS_META[key].tone}>{STATUS_META[key].label}</StatusPill></td>
                      <td className="px-2.5 py-3 text-xs font-semibold tabular-nums text-right">{rs(fare)}</td>
                      <td className="px-2.5 py-3 text-xs tabular-nums text-right text-slate-500">{rs(expense)}</td>
                      <td className="px-2.5 py-3 text-xs font-semibold tabular-nums text-right text-emerald-600 dark:text-emerald-400">{rs(fare - expense)}</td>
                      <td className="px-2.5 py-3 text-right">
                        <button type="button" onClick={() => navigate('/trips')} title="View in Trips" aria-label="View in Trips"
                          className="w-8 h-8 rounded-[10px] inline-flex items-center justify-center text-slate-400 ap-focus hover:text-[var(--ap-accent)] hover:bg-[var(--ap-surface-2)]">
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 md:hidden">
            {pageRows.map(b => {
              const key = bucketStatus(b.status)
              const expense = tripExpense(b)
              const fare = num(b.fare)
              return (
                <div key={b.id} className="rounded-[16px] border border-[var(--ap-border)] p-3.5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">{b.customer}</p>
                      <p className="text-[11px] font-mono text-slate-400">{b.bookingNo}</p>
                    </div>
                    <StatusPill tone={STATUS_META[key].tone}>{STATUS_META[key].label}</StatusPill>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate" title={`${b.pickup || ''} → ${b.drop || ''}`}>{b.pickup || '—'} → {b.drop || '—'}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{fullDt(b.startDate)}</p>
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--ap-border)] pt-3">
                    <div><p className="text-[10px] text-slate-400">Fare</p><p className="text-xs font-semibold tabular-nums">{rs(fare)}</p></div>
                    <div><p className="text-[10px] text-slate-400">Expenses</p><p className="text-xs tabular-nums text-slate-500">{rs(expense)}</p></div>
                    <div><p className="text-[10px] text-slate-400">Net</p><p className="text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{rs(fare - expense)}</p></div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-4"><ReportPager page={safePage} totalPages={totalPages} total={rows.length} pageSize={TRIP_PAGE} onPage={setPage} label="trips" /></div>
        </ReportState>
      </ReportPanel>
    </div>
  )
}

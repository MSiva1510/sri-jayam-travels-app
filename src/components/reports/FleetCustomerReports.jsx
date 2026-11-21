// ─── Driver, vehicle and customer reports ──────────────────────
// Presentations for the three all-time performance report functions.
// Rankings, totals and status definitions stay in reportData.js.

import { useEffect, useMemo, useState } from 'react'
import {
  Car, CheckCircle2, Clock3, Fuel, Gauge, IndianRupee, Navigation,
  Trophy, UserRound, Users, Wallet, Wrench,
} from 'lucide-react'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import StatusPill from '../ui/StatusPill'
import {
  exportToCSV, getCustomerReport, getDriverPerformance, getVehiclePerformance,
} from '../../data/reportData'
import useReportResource from './useReportResource'
import {
  ClearFilters, FilterSelect, RankRows, ReportIntro, ReportKpiGrid,
  ReportPanel, ReportPager, ReportState, ReportToolbar, SearchInput,
  useReportExport,
} from './ReportChrome'
import { EMPTY_ARRAY, num, pct, rs, rsK } from './reportUtils'

const DRIVER_COLUMNS = [
  { label: 'Driver', key: 'name' },
  { label: 'Total Trips', key: 'totalTrips' },
  { label: 'Completed', key: 'completedTrips' },
  { label: 'Revenue (Rs.)', key: 'revenue' },
  { label: 'Present Days', key: 'presentDays' },
  { label: 'Working Hours', key: 'workingHours' },
  { label: 'Rating', key: 'rating' },
]

const VEHICLE_COLUMNS = [
  { label: 'Vehicle', key: 'reg' },
  { label: 'Type', key: 'type' },
  { label: 'Model', key: 'model' },
  { label: 'Total Trips', key: 'totalTrips' },
  { label: 'Completed', key: 'completedTrips' },
  { label: 'Distance (KM)', key: 'distance' },
  { label: 'Fuel Cost (Rs.)', key: 'fuelCost' },
  { label: 'Maint Cost (Rs.)', key: 'maintCost' },
  { label: 'Total Cost (Rs.)', key: 'totalCost' },
]

const CUSTOMER_COLUMNS = [
  { label: 'Customer', key: 'name' },
  { label: 'Type', key: 'type' },
  { label: 'City', key: 'city' },
  { label: 'Mobile', key: 'mobile' },
  { label: 'Total Trips', key: 'totalTrips' },
  { label: 'Completed', key: 'completedTrips' },
  { label: 'Revenue (Rs.)', key: 'totalRevenue' },
]

const isInService = (status) => ['assigned', 'in-use', 'in_use', 'busy'].includes(String(status || '').toLowerCase())

const EMPTY_CUSTOMER_REPORT = {
  rows: EMPTY_ARRAY, topByRevenue: EMPTY_ARRAY, topByTrips: EMPTY_ARRAY,
  totalCustomers: 0, repeatCustomers: 0, corporateCustomers: 0,
}

export function DriversReport({ refreshKey, resetKey, onRegisterExport }) {
  const resource = useReportResource('driver-performance', () => getDriverPerformance(), { refreshKey })
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  useEffect(() => { setSearch(''); setStatus('all') }, [resetKey])

  const data = Array.isArray(resource.data) ? resource.data : EMPTY_ARRAY
  const rows = useMemo(() => data.filter(driver => {
    if (status !== 'all' && String(driver.status || 'inactive') !== status) return false
    if (!search) return true
    const query = search.toLowerCase()
    return [driver.name, driver.vehicle, driver.driver_id].some(value => String(value ?? '').toLowerCase().includes(query))
  }), [data, search, status])

  const maxTrips = Math.max(...data.map(driver => num(driver.completedTrips)), 1)
  const totalRevenue = data.reduce((sum, driver) => sum + num(driver.revenue), 0)
  const top = data[0]
  const kpis = [
    { label: 'Total Drivers', value: data.length, sub: 'Roster size', icon: UserRound, tone: 'blue' },
    { label: 'Active Drivers', value: data.filter(d => d.status === 'active').length, sub: 'Currently active', icon: CheckCircle2, tone: 'green' },
    { label: 'Completed Trips', value: data.reduce((sum, d) => sum + num(d.completedTrips), 0), sub: top ? `Led by ${top.name.split(' ')[0]}` : 'No trips yet', icon: Navigation, tone: 'violet' },
    { label: 'Incentives', value: rsK(data.reduce((sum, d) => sum + num(d.incentive), 0)), sub: 'Current-month settlements', icon: Wallet, tone: 'amber' },
    { label: 'Driver Revenue', value: rsK(totalRevenue), sub: 'All booked fare', icon: IndianRupee, tone: 'green' },
  ]

  const exportConfig = useMemo(() => ({
    rows, columns: DRIVER_COLUMNS, filename: 'driver_performance', title: 'Driver Performance',
  }), [rows])
  useReportExport(onRegisterExport, exportConfig)

  return (
    <div className="space-y-4">
      <ReportIntro
        title="Driver performance"
        description="Trip output, revenue contribution and current-month attendance for every driver."
        scope="All-time trips and revenue. Attendance, incentives and working hours are current-month values from the existing report function."
      />
      <ReportState resource={resource} skeleton="kpi" empty={false}>
        <ReportKpiGrid items={kpis.slice(0, 4)} columns="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" />
        <ReportKpiGrid items={kpis.slice(4)} columns="grid-cols-1 sm:grid-cols-2" className="mt-3" />
      </ReportState>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ReportPanel className="xl:col-span-2" eyebrow="Recognition" title="Top Performing Drivers"
          icon={Trophy} sub="Ranked by completed trips, using the existing report order">
          <ReportState resource={resource} skeleton="panel" empty={!data.length}
            emptyIcon={UserRound} emptyTitle="No driver data yet">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {data.slice(0, 3).map((driver, index) => (
                <div key={driver.id || driver.name} className="rounded-[16px] border border-[var(--ap-border)] p-3.5">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="relative flex-shrink-0">
                      <Avatar name={driver.name} size={38} />
                      {index === 0 && <Trophy size={14} className="absolute -top-1.5 -right-1.5 text-amber-500" aria-label="Top driver" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate text-slate-800 dark:text-white">{driver.name}</p>
                      <p className="text-[11px] text-slate-400">Rank #{index + 1}</p>
                    </div>
                  </div>
                  <p className="font-sf text-lg font-semibold tabular-nums text-slate-800 dark:text-white">{driver.completedTrips}<span className="text-xs text-slate-400"> / {driver.totalTrips}</span></p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{rsK(driver.revenue)} generated</p>
                </div>
              ))}
            </div>
          </ReportState>
        </ReportPanel>

        <ReportPanel eyebrow="Activity" title="Driver Activity" icon={Clock3}>
          <ReportState resource={resource} skeleton="panel" empty={!data.length} emptyIcon={UserRound}>
            <div className="space-y-3">
              {data.slice(0, 5).map(driver => (
                <div key={driver.id || driver.name} className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{driver.name}</span>
                  <span className="text-[11px] tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {num(driver.presentDays)} days · {driver.workingHours || '—'}
                  </span>
                </div>
              ))}
            </div>
          </ReportState>
        </ReportPanel>
      </div>

      <ReportToolbar>
        <SearchInput label="Search drivers" value={search} onChange={setSearch} placeholder="Name, ID or vehicle…" />
        <FilterSelect label="Status" value={status} onChange={setStatus}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="on-leave">On leave</option>
          <option value="inactive">Inactive</option>
        </FilterSelect>
        <ClearFilters onClick={() => { setSearch(''); setStatus('all') }} activeCount={[search, status !== 'all'].filter(Boolean).length} />
        <Button variant="outline" size="sm" icon={IndianRupee}
          onClick={() => exportToCSV(rows, DRIVER_COLUMNS, 'driver_performance')}>
          Export CSV
        </Button>
      </ReportToolbar>

      <ReportPanel eyebrow="Comparison" title={`Driver Performance (${rows.length})`}
        sub="Bars compare completed trips and revenue share against the leading driver"
        icon={UserRound}>
        <ReportState resource={resource} skeleton="table" empty={rows.length === 0}
          emptyIcon={UserRound} emptyTitle="No drivers match these filters">
          <div className="space-y-3">
            {rows.map((driver, index) => (
              <div key={driver.id || driver.name} className="rounded-[16px] border border-[var(--ap-border)] p-3.5">
                <div className="flex flex-wrap items-start gap-3">
                  <span className="w-6 h-6 rounded-lg bg-[var(--ap-surface-2)] text-[10px] font-bold text-slate-500 flex items-center justify-center tabular-nums">{index + 1}</span>
                  <Avatar name={driver.name} size={36} />
                  <div className="flex-1 min-w-[150px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800 dark:text-white">{driver.name}</p>
                      <span className="text-[11px] text-amber-500 font-semibold">{driver.rating != null ? `★ ${driver.rating}` : '—'}</span>
                      {driver.status && <StatusPill tone={driver.status === 'active' ? 'green' : driver.status === 'on-leave' ? 'amber' : 'gray'}>{driver.status.replace('-', ' ')}</StatusPill>}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{driver.vehicle || 'No vehicle assigned'} · {num(driver.presentDays)} days present · {driver.workingHours || '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-sf text-base font-semibold tabular-nums text-slate-800 dark:text-white">{rsK(driver.revenue)}</p>
                    <p className="text-[11px] text-slate-400 tabular-nums">{driver.completedTrips}/{driver.totalTrips} trips</p>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Progress label="Completed trips" value={pct(driver.completedTrips, maxTrips)} color="bg-blue-500" />
                  <Progress label="Revenue contribution" value={pct(driver.revenue, totalRevenue)} color="bg-emerald-500" />
                </div>
              </div>
            ))}
          </div>
        </ReportState>
      </ReportPanel>
    </div>
  )
}

export function VehiclesReport({ refreshKey, resetKey, onRegisterExport }) {
  const resource = useReportResource('vehicle-performance', () => getVehiclePerformance(), { refreshKey })
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [type, setType] = useState('all')

  useEffect(() => { setSearch(''); setStatus('all'); setType('all') }, [resetKey])

  const data = Array.isArray(resource.data) ? resource.data : EMPTY_ARRAY
  const rows = useMemo(() => data.filter(vehicle => {
    const key = String(vehicle.status || 'active').toLowerCase()
    if (status !== 'all' && key !== status && !(status === 'in-use' && isInService(key))) return false
    if (type !== 'all' && String(vehicle.type || vehicle.vehicle_type || '') !== type) return false
    if (!search) return true
    const query = search.toLowerCase()
    return [vehicle.reg, vehicle.registration, vehicle.model, vehicle.type].some(value => String(value ?? '').toLowerCase().includes(query))
  }), [data, search, status, type])

  const types = useMemo(
    () => [...new Set(data.map(v => v.type || v.vehicle_type).filter(Boolean).map(String))].sort(),
    [data],
  )
  const available = data.filter(v => String(v.status || '').toLowerCase() === 'active').length
  const inUse = data.filter(v => isInService(v.status)).length
  const maintenance = data.filter(v => String(v.status || '').toLowerCase() === 'maintenance').length
  const distance = data.reduce((sum, v) => sum + num(v.distance), 0)
  const runningCost = data.reduce((sum, v) => sum + num(v.totalCost), 0)
  const utilization = pct(available + inUse, data.length)
  const kpis = [
    { label: 'Total Vehicles', value: data.length, sub: 'Fleet size', icon: Car, tone: 'blue' },
    { label: 'Available', value: available, sub: 'Active status', icon: CheckCircle2, tone: 'green' },
    { label: 'In Use', value: inUse, sub: 'Assigned / in service', icon: Navigation, tone: 'violet' },
    { label: 'Maintenance', value: maintenance, sub: 'Needs attention', icon: Wrench, tone: 'amber' },
    { label: 'Total Distance', value: `${Math.round(distance).toLocaleString('en-IN')} km`, sub: 'All completed trips', icon: Gauge, tone: 'blue' },
    { label: 'Running Cost', value: rsK(runningCost), sub: 'Fuel + maintenance', icon: Wallet, tone: 'red' },
  ]

  const exportConfig = useMemo(() => ({
    rows, columns: VEHICLE_COLUMNS, filename: 'vehicle_performance', title: 'Vehicle Performance',
  }), [rows])
  useReportExport(onRegisterExport, exportConfig)

  return (
    <div className="space-y-4">
      <ReportIntro
        title="Fleet analytics"
        description="Distance, running cost and trip contribution for every vehicle in the fleet."
        scope={`All-time trips and expenses. Utilization = ${available + inUse} active/assigned vehicles ÷ ${data.length} total (${utilization}%). Global date range does not apply.`}
      />
      <ReportState resource={resource} skeleton="kpi" empty={false}>
        <ReportKpiGrid items={kpis.slice(0, 4)} columns="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" />
        <ReportKpiGrid items={kpis.slice(4)} columns="grid-cols-1 sm:grid-cols-2" className="mt-3" />
      </ReportState>

      <ReportToolbar>
        <SearchInput label="Search vehicles" value={search} onChange={setSearch} placeholder="Registration or model…" />
        <FilterSelect label="Status" value={status} onChange={setStatus}>
          <option value="all">All statuses</option>
          <option value="active">Available</option>
          <option value="in-use">In use</option>
          <option value="maintenance">Maintenance</option>
        </FilterSelect>
        <FilterSelect label="Type" value={type} onChange={setType}>
          <option value="all">All types</option>
          {types.map(item => <option key={item} value={item}>{item}</option>)}
        </FilterSelect>
        <ClearFilters onClick={() => { setSearch(''); setStatus('all'); setType('all') }}
          activeCount={[search, status !== 'all', type !== 'all'].filter(Boolean).length} />
        <Button variant="outline" size="sm" icon={IndianRupee}
          onClick={() => exportToCSV(rows, VEHICLE_COLUMNS, 'vehicle_performance')}>
          Export CSV
        </Button>
      </ReportToolbar>

      <ReportPanel eyebrow="Fleet" title={`Vehicle Performance (${rows.length})`}
        sub="Cost bars show fuel versus maintenance for each vehicle" icon={Car}>
        <ReportState resource={resource} skeleton="table" empty={rows.length === 0}
          emptyIcon={Car} emptyTitle="No vehicles match these filters">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {rows.map((vehicle, index) => {
              const fuel = num(vehicle.fuelCost)
              const maint = num(vehicle.maintCost)
              const total = num(vehicle.totalCost) || fuel + maint
              return (
                <div key={vehicle.id || vehicle.reg} className="rounded-[18px] border border-[var(--ap-border)] p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-[12px] bg-[var(--ap-accent)]/10 text-[var(--ap-accent)] flex items-center justify-center flex-shrink-0">
                      <Car size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-sf font-semibold tracking-wide text-sm text-slate-800 dark:text-white">{vehicle.reg || vehicle.registration || '—'}</p>
                        {index === 0 && <StatusPill tone="blue">Most used</StatusPill>}
                        {vehicle.status && <StatusPill tone={String(vehicle.status).toLowerCase() === 'maintenance' ? 'red' : 'green'}>{vehicle.status}</StatusPill>}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{vehicle.model || '—'} · {vehicle.type || vehicle.vehicle_type || '—'} · {Math.round(num(vehicle.distance)).toLocaleString('en-IN')} km</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-sf text-base font-semibold tabular-nums text-slate-800 dark:text-white">{vehicle.completedTrips}<span className="text-xs text-slate-400">/{vehicle.totalTrips}</span></p>
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 tabular-nums">{rsK(total)}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <MiniCost label="Fuel" value={rs(fuel)} icon={Fuel} />
                    <MiniCost label="Maintenance" value={rs(maint)} icon={Wrench} />
                    <MiniCost label="Total cost" value={rs(total)} icon={Wallet} />
                  </div>
                  <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-[var(--ap-surface-2)]" aria-label={`Fuel ${rs(fuel)}, maintenance ${rs(maint)}`}>
                    <div className="bg-amber-500" style={{ width: `${pct(fuel, total)}%` }} />
                    <div className="bg-red-500" style={{ width: `${pct(maint, total)}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </ReportState>
      </ReportPanel>
    </div>
  )
}

export function CustomersReport({ refreshKey, resetKey, onRegisterExport }) {
  const resource = useReportResource('customer-report', () => getCustomerReport(), { refreshKey })
  const [search, setSearch] = useState('')
  const [type, setType] = useState('all')
  const [page, setPage] = useState(1)
  const CUST_PAGE = 8

  useEffect(() => { setSearch(''); setType('all'); setPage(1) }, [resetKey])

  const report = resource.data || EMPTY_CUSTOMER_REPORT
  const maxTrips = Math.max(...(report.topByTrips || []).map(c => num(c.totalTrips)), 1)
  const types = useMemo(
    () => [...new Set((report.rows || []).map(c => c.type).filter(Boolean).map(String))].sort(),
    [report.rows],
  )
  const rows = useMemo(() => (report.rows || []).filter(customer => {
    if (type !== 'all' && String(customer.type || '') !== type) return false
    if (!search) return true
    const query = search.toLowerCase()
    return [customer.name, customer.city, customer.mobile, customer.type].some(value => String(value ?? '').toLowerCase().includes(query))
  }), [report.rows, search, type])

  useEffect(() => { setPage(1) }, [search, type])
  const totalPages = Math.max(1, Math.ceil(rows.length / CUST_PAGE))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const pageRows = rows.slice((safePage - 1) * CUST_PAGE, safePage * CUST_PAGE)

  const kpis = [
    { label: 'Total Customers', value: report.totalCustomers, sub: 'Active records', icon: Users, tone: 'violet' },
    { label: 'Repeat Customers', value: report.repeatCustomers, sub: 'More than one trip', icon: Navigation, tone: 'green' },
    { label: 'Corporate / Agent', value: report.corporateCustomers, sub: 'B2B accounts', icon: UserRound, tone: 'blue' },
    { label: 'Customer Revenue', value: rsK((report.rows || []).reduce((sum, c) => sum + num(c.totalRevenue), 0)), sub: 'All time', icon: IndianRupee, tone: 'amber' },
  ]

  const exportConfig = useMemo(() => ({
    rows, columns: CUSTOMER_COLUMNS, filename: 'customer_report', title: 'Customer Report',
  }), [rows])
  useReportExport(onRegisterExport, exportConfig)

  return (
    <div className="space-y-4">
      <ReportIntro
        title="Customer intelligence"
        description="Customer value, repeat business and revenue contribution across all trips."
        scope="All-time customer records and bookings. Global date range does not apply."
      />
      <ReportState resource={resource} skeleton="kpi" empty={false}>
        <ReportKpiGrid items={kpis} columns="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" />
      </ReportState>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportPanel eyebrow="Ranking" title="Top Customers by Revenue" icon={Users}>
          <ReportState resource={resource} skeleton="panel" empty={!report.topByRevenue?.length}
            emptyIcon={Users} emptyTitle="No customer data yet">
            <RankRows rows={report.topByRevenue || []}
              primary={row => (
                <span className="flex items-center gap-2">
                  <Avatar name={row.name} size={22} />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{row.name}</span>
                </span>
              )}
              secondary={row => <p className="text-[11px] text-slate-400">{row.totalTrips} trips</p>}
              value={row => <p className="text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">{rs(row.totalRevenue)}</p>}
              tone="violet" />
          </ReportState>
        </ReportPanel>
        <ReportPanel eyebrow="Ranking" title="Top Customers by Trips" icon={Navigation}>
          <ReportState resource={resource} skeleton="panel" empty={!report.topByTrips?.length}
            emptyIcon={Users} emptyTitle="No customer data yet">
            <RankRows rows={report.topByTrips || []}
              primary={row => <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{row.name}</p>}
              secondary={row => <p className="text-[11px] text-slate-400">{num(row.completedTrips)} completed</p>}
              value={row => <p className="text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">{row.totalTrips}</p>}
              share={row => pct(row.totalTrips, maxTrips)} tone="blue" />
          </ReportState>
        </ReportPanel>
      </div>

      <ReportToolbar>
        <SearchInput label="Search customers" value={search} onChange={setSearch} placeholder="Name, city or type…" />
        <FilterSelect label="Customer type" value={type} onChange={setType}>
          <option value="all">All types</option>
          {types.map(item => <option key={item} value={item}>{item}</option>)}
        </FilterSelect>
        <ClearFilters onClick={() => { setSearch(''); setType('all') }} activeCount={[search, type !== 'all'].filter(Boolean).length} />
        <Button variant="outline" size="sm" icon={IndianRupee}
          onClick={() => exportToCSV(rows, CUSTOMER_COLUMNS, 'customer_report')}>
          Export CSV
        </Button>
      </ReportToolbar>

      <ReportPanel eyebrow="Directory" title={`All Customers (${rows.length})`}>
        <ReportState resource={resource} skeleton="table" empty={rows.length === 0}
          emptyIcon={Users} emptyTitle="No customers found">
          <div className="hidden md:block overflow-x-auto -mx-1">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="sticky top-0 z-10 bg-[var(--ap-surface)]">
                <tr className="border-b border-[var(--ap-border)]">
                  {['Customer', 'Type', 'Total Trips', 'Completed', 'Revenue'].map((heading, index) => (
                    <th key={heading} className={`px-2.5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 ${index >= 2 ? 'text-right' : 'text-left'}`}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map(customer => (
                  <tr key={customer.id} className="border-b border-[var(--ap-border)] last:border-0 hover:bg-[var(--ap-surface-2)] transition-colors">
                    <td className="px-2.5 py-3">
                      <span className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                        <Avatar name={customer.name} size={24} /><span className="truncate">{customer.name}</span>
                      </span>
                    </td>
                    <td className="px-2.5 py-3 text-xs text-slate-500 capitalize">{customer.type || '—'}</td>
                    <td className="px-2.5 py-3 text-xs tabular-nums text-right">{customer.totalTrips}</td>
                    <td className="px-2.5 py-3 text-xs font-semibold tabular-nums text-right text-emerald-600 dark:text-emerald-400">{customer.completedTrips}</td>
                    <td className="px-2.5 py-3 text-xs font-semibold tabular-nums text-right">{rs(customer.totalRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 md:hidden">
            {pageRows.map(customer => (
              <div key={customer.id} className="rounded-[16px] border border-[var(--ap-border)] p-3.5 flex items-center gap-3">
                <Avatar name={customer.name} size={34} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">{customer.name}</p>
                  <p className="text-[11px] text-slate-400">{customer.totalTrips} trips · {customer.completedTrips} completed</p>
                </div>
                <p className="text-xs font-semibold tabular-nums">{rs(customer.totalRevenue)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4"><ReportPager page={safePage} totalPages={totalPages} total={rows.length} pageSize={CUST_PAGE} onPage={setPage} label="customers" /></div>
        </ReportState>
      </ReportPanel>
    </div>
  )
}

function Progress({ label, value, color }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
        <span>{label}</span><span className="tabular-nums">{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--ap-surface-2)] overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
      </div>
    </div>
  )
}

function MiniCost({ label, value, icon: Icon }) {
  return (
    <div className="rounded-[12px] bg-[var(--ap-surface-2)] px-2 py-2.5 text-center">
      <Icon size={13} className="mx-auto text-slate-400 mb-1" aria-hidden="true" />
      <p className="text-[11px] font-semibold tabular-nums text-slate-700 dark:text-slate-200 truncate" title={value}>{value}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{label}</p>
    </div>
  )
}

// ─── Reports & Analytics workspace ─────────────────────────────
// Presentation shell for the ten existing report functions. All business
// logic, calculations, export helpers and Supabase access stay in
// src/data/reportData.js and the repository layer.

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle, BarChart3, Car, IndianRupee, Navigation,
  RefreshCw, TrendingDown, UserRound, Users, X,
} from 'lucide-react'
import Button from '../components/ui/Button'
import SegmentedControl from '../components/ui/SegmentedControl'
import StatusPill from '../components/ui/StatusPill'
import Surface from '../components/ui/Surface'
import { useAuth } from '../context/AuthContext'
import { getBusinessAlerts, getExecutiveSummary } from '../data/reportData'
import { cacheClear } from '../utils/dataCache'
import {
  ExportMenu, ReportDateRange,
} from '../components/reports/ReportChrome'
import OverviewReport from '../components/reports/OverviewReport'
import TripsReport from '../components/reports/TripsReport'
import AlertsReport from '../components/reports/AlertsReport'
import OperationsReport from '../components/reports/OperationsReport'
import {
  CustomersReport, DriversReport, VehiclesReport,
} from '../components/reports/FleetCustomerReports'
import {
  ExpensesReport, MonthlyReport, PayrollReport,
} from '../components/reports/FinanceReports'
import useReportResource, { clearReportCache } from '../components/reports/useReportResource'
import {
  formatLastUpdated, formatRangeLabel, presetRange,
} from '../components/reports/reportUtils'

const TABS = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'trips', label: 'Trips', icon: Navigation },
  { key: 'drivers', label: 'Drivers', icon: UserRound },
  { key: 'vehicles', label: 'Vehicles', icon: Car },
  { key: 'customers', label: 'Customers', icon: Users },
  { key: 'expenses', label: 'Expenses', icon: TrendingDown },
  { key: 'payroll', label: 'Payroll', icon: IndianRupee },
  { key: 'monthly', label: 'Monthly', icon: BarChart3 },
  { key: 'operations', label: 'Operations', icon: RefreshCw },
  { key: 'alerts', label: 'Alerts', icon: AlertTriangle },
]

export default function Reports() {
  const { isDriver } = useAuth()
  const [tab, setTab] = useState('overview')
  const [range, setRange] = useState(() => presetRange('this-month'))
  const [refreshKey, setRefreshKey] = useState(0)
  const [resetKey, setResetKey] = useState(0)
  const [lastUpdated, setLastUpdated] = useState(() => new Date())
  const [refreshing, setRefreshing] = useState(false)
  const [exportConfig, setExportConfig] = useState(null)

  // These two resources are shared with the tabs so the header badge and the
  // Alerts view never issue duplicate document/summary requests.
  const summaryResource = useReportResource(
    'executive-summary',
    () => getExecutiveSummary(),
    { refreshKey, enabled: !isDriver },
  )
  const alertsResource = useReportResource(
    'business-alerts',
    () => getBusinessAlerts(),
    { refreshKey, enabled: !isDriver },
  )

  const registerExport = useCallback((config) => {
    setExportConfig(config ? { ...config, tab } : null)
  }, [tab])
  const activeExport = exportConfig?.tab === tab ? exportConfig : null

  const changeTab = (nextTab) => {
    setExportConfig(null)
    setTab(nextTab)
  }

  useEffect(() => {
    if (!refreshing) return undefined
    const timer = window.setTimeout(() => setRefreshing(false), 700)
    return () => window.clearTimeout(timer)
  }, [refreshing])

  const handleRefresh = () => {
    clearReportCache()
    cacheClear()
    setRefreshKey(value => value + 1)
    setLastUpdated(new Date())
    setRefreshing(true)
  }

  const resetAll = () => {
    setRange(presetRange('this-month'))
    setResetKey(value => value + 1)
  }

  const rangeActive = range?.preset !== 'this-month'
  const alertCount = alertsResource.error ? null : (alertsResource.data?.length || 0)
  const periodLabel = formatRangeLabel(range?.from, range?.to)

  if (isDriver) {
    return (
      <Surface className="p-12 text-center">
        <AlertTriangle size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" aria-hidden="true" />
        <p className="font-semibold text-slate-500 dark:text-slate-400">Reports are not available for drivers.</p>
      </Surface>
    )
  }

  const shared = { refreshKey, resetKey, onRegisterExport: registerExport }

  return (
    <div className="space-y-4 animate-fade-up">
      <Surface className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-[12px] bg-[var(--ap-accent)] flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <BarChart3 size={18} className="text-white" />
              </span>
              <div className="min-w-0">
                <h1 className="font-sf text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                  Reports &amp; Analytics
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Business performance, fleet insights and financial intelligence.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <StatusPill tone={rangeActive ? 'amber' : 'gray'}>
                {rangeActive ? 'Custom period' : 'Default period'}
              </StatusPill>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {periodLabel} · only the Trips report uses this date range
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {alertCount > 0 && (
              <Button variant="danger" size="sm" icon={AlertTriangle} onClick={() => changeTab('alerts')}>
                {alertCount} Alert{alertCount !== 1 ? 's' : ''}
              </Button>
            )}
            <ExportMenu config={activeExport} disabled={!activeExport?.rows?.length} />
            <Button variant="outline" size="sm" icon={RefreshCw} onClick={handleRefresh} disabled={refreshing}
              className={refreshing ? '[&_svg]:animate-spin' : ''}>
              {refreshing ? 'Refreshing…' : 'Refresh Data'}
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t ap-hairline pt-3">
          <div className="flex-1 min-w-[280px]">
            <ReportDateRange value={range} onChange={setRange} />
          </div>
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <span className="text-[11px] text-slate-400 tabular-nums">
              Last refreshed {formatLastUpdated(lastUpdated)}
            </span>
            <Button variant="ghost" size="sm" icon={X} onClick={resetAll}>Clear All</Button>
          </div>
        </div>
      </Surface>

      <SegmentedControl
        options={TABS}
        value={tab}
        onChange={changeTab}
        ariaLabel="Report sections"
        scroll
        className="max-w-full"
      />

      <div className="min-w-0">
        {tab === 'overview' && (
          <OverviewReport summaryResource={summaryResource} {...shared} />
        )}
        {tab === 'trips' && (
          <TripsReport
            range={range}
            onRangeChange={setRange}
            onResetRange={() => setRange(presetRange('this-month'))}
            {...shared}
          />
        )}
        {tab === 'drivers' && <DriversReport {...shared} />}
        {tab === 'vehicles' && <VehiclesReport {...shared} />}
        {tab === 'customers' && <CustomersReport {...shared} />}
        {tab === 'expenses' && <ExpensesReport {...shared} />}
        {tab === 'payroll' && <PayrollReport {...shared} />}
        {tab === 'monthly' && <MonthlyReport {...shared} />}
        {tab === 'operations' && <OperationsReport {...shared} />}
        {tab === 'alerts' && (
          <AlertsReport alertsResource={alertsResource} resetKey={resetKey} onRegisterExport={registerExport} />
        )}
      </div>

      <p className="text-[11px] text-slate-400 text-center pb-2">
        Exports follow the filters and scope shown in the active report.
      </p>
    </div>
  )
}

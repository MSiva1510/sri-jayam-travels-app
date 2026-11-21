// ─── Expense, payroll and monthly reports ──────────────────────
// All totals come from the existing reportData functions; this file only
// changes presentation, loading states and export surfaces.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart3, CalendarRange, CheckCircle2, IndianRupee,
  RefreshCw, Table2, TrendingDown, Wallet, XCircle,
} from 'lucide-react'
import SparkChart from '../ui/SparkChart'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import StatusPill from '../ui/StatusPill'
import {
  exportToCSV, getExpenseAnalytics, getMonthlySummary, getPayrollAnalytics,
} from '../../data/reportData'
import { loadBookings } from '../../data/tripTypes'
import useReportResource from './useReportResource'
import {
  ExportMenu, FilterSelect, RankRows, ReportIntro, ReportKpiGrid,
  ReportPanel, ReportState, useReportExport,
} from './ReportChrome'
import { EMPTY_ARRAY, monthLabel, num, pct, rs, rsK, titleCase } from './reportUtils'

const EMPTY_EXPENSES = { months: [], byCategory: [], monthTotal: 0, allTimeTotal: 0 }
const EMPTY_PAYROLL = {
  totalPaid: 0, pendingCount: 0, approvedCount: 0, paidCount: 0,
  draftCount: 0, totalIncentives: 0, byDriver: [],
}
const MONTHLY_COLUMNS = [
  { label: 'Month', key: 'month' },
  { label: 'Bookings', key: 'bookings' },
  { label: 'Completed', key: 'completed' },
  { label: 'Cancelled', key: 'cancelled' },
  { label: 'Revenue', key: 'revenue' },
]

export function ExpensesReport({ refreshKey, onRegisterExport }) {
  const resource = useReportResource('expense-analytics', () => getExpenseAnalytics(), { refreshKey })
  const data = resource.data || EMPTY_EXPENSES
  const categoryTotal = data.byCategory.reduce((sum, item) => sum + num(item.total), 0) || 1
  const topCategory = data.byCategory[0]
  const trendEmpty = data.months.every(month => num(month.tot) === 0)
  const average = data.months.length
    ? Math.round(data.months.reduce((sum, month) => sum + num(month.tot), 0) / data.months.length)
    : 0

  const kpis = [
    { label: "This Month’s Expenses", value: rsK(data.monthTotal), sub: 'Recorded this month', icon: TrendingDown, tone: 'red' },
    { label: 'All-Time Expenses', value: rsK(data.allTimeTotal), sub: 'All categories', icon: Wallet, tone: 'blue' },
    { label: 'Highest Category', value: topCategory ? titleCase(topCategory.label) : '—', sub: topCategory ? rsK(topCategory.total) : 'No data', icon: BarChart3, tone: 'amber' },
    { label: 'Monthly Average', value: data.months.length ? rsK(average) : '—', sub: 'Six-month window', icon: CalendarRange, tone: 'violet' },
  ]

  const exportRows = useMemo(() => data.byCategory.map((item, index) => ({
    rank: index + 1,
    category: titleCase(item.label),
    amount: num(item.total),
    share: `${pct(item.total, categoryTotal)}%`,
  })), [data.byCategory, categoryTotal])
  const exportConfig = useMemo(() => ({
    rows: exportRows,
    columns: [
      { label: 'Rank', key: 'rank' },
      { label: 'Category', key: 'category' },
      { label: 'Amount (Rs.)', key: 'amount' },
      { label: 'Share', key: 'share' },
    ],
    filename: 'expense_analytics',
    title: 'Expense Analytics',
  }), [exportRows])
  useReportExport(onRegisterExport, exportConfig)

  return (
    <div className="space-y-4">
      <ReportIntro
        title="Expense intelligence"
        description="Where money goes, how spend trends month to month, and which categories dominate."
        scope="Fixed six-month trend plus all-time categories. Global date range does not apply."
      />
      <ReportState resource={resource} skeleton="kpi" empty={false}>
        <ReportKpiGrid items={kpis} columns="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" />
      </ReportState>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ReportPanel className="xl:col-span-2" eyebrow="Trend" title="Monthly Expense Trend"
          sub="Last six months" icon={TrendingDown}
          action={<Button variant="outline" size="sm" icon={Table2}
            onClick={() => exportToCSV(data.months.map(month => ({ month: month.lbl, total: month.tot })),
              [{ label: 'Month', key: 'month' }, { label: 'Total (Rs.)', key: 'total' }], 'expense_analytics')}>
            Export trend CSV
          </Button>}>
          <ReportState resource={resource} skeleton="chart" empty={trendEmpty}
            emptyIcon={TrendingDown} emptyTitle="No expense data"
            emptyDescription="Add expenses to see a monthly trend.">
            <SparkChart data={data.months} valueKey="tot" labelKey="lbl" height={150}
              accent="var(--ap-danger)" format={value => rs(value)} />
            <div className="mt-3 flex items-center justify-between border-t border-[var(--ap-border)] pt-3">
              <span className="text-xs text-slate-500 dark:text-slate-400">This month</span>
              <span className="text-sm font-semibold tabular-nums text-amber-600 dark:text-amber-400">{rs(data.monthTotal)}</span>
            </div>
          </ReportState>
        </ReportPanel>

        <ReportPanel eyebrow="Mix" title="Expense Category Breakdown" sub="All-time spend by category" icon={Wallet}>
          <ReportState resource={resource} skeleton="panel" empty={!data.byCategory.length}
            emptyIcon={TrendingDown} emptyTitle="No categories recorded">
            <RankRows rows={data.byCategory.slice(0, 7)}
              primary={row => <p className="text-xs font-semibold capitalize text-slate-700 dark:text-slate-200 truncate">{titleCase(row.label)}</p>}
              secondary={row => <p className="text-[11px] text-slate-400">{num(row.count)} entries · {pct(row.total, categoryTotal)}% of spend</p>}
              value={row => <p className="text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">{rs(row.total)}</p>}
              share={row => pct(row.total, categoryTotal)} tone="amber" />
          </ReportState>
        </ReportPanel>
      </div>

      <ReportPanel eyebrow="Detail" title="Expense Analysis" sub="Ranked by amount, highest first" icon={BarChart3}>
        <ReportState resource={resource} skeleton="table" empty={!exportRows.length}
          emptyIcon={TrendingDown} emptyTitle="No expense categories yet">
          <div className="overflow-x-auto -mx-1">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="sticky top-0 z-10 bg-[var(--ap-surface)]">
                <tr className="border-b border-[var(--ap-border)]">
                  {['Rank', 'Category', 'Amount', 'Share of total'].map((heading, index) => (
                    <th key={heading} className={`px-2.5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 ${index > 1 ? 'text-right' : 'text-left'}`}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {exportRows.map(row => (
                  <tr key={row.category} className="border-b border-[var(--ap-border)] last:border-0 hover:bg-[var(--ap-surface-2)]">
                    <td className="px-2.5 py-3 text-xs tabular-nums text-slate-400">{row.rank}</td>
                    <td className="px-2.5 py-3 text-xs font-semibold text-slate-700 dark:text-slate-200">{row.category}</td>
                    <td className="px-2.5 py-3 text-xs font-semibold tabular-nums text-right">{rs(row.amount)}</td>
                    <td className="px-2.5 py-3 text-xs tabular-nums text-right text-amber-600 dark:text-amber-400">{row.share}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ReportState>
      </ReportPanel>
    </div>
  )
}

export function PayrollReport({ refreshKey, onRegisterExport }) {
  const navigate = useNavigate()
  const resource = useReportResource('payroll-analytics', () => getPayrollAnalytics(), { refreshKey })
  const data = resource.data || EMPTY_PAYROLL
  const ranked = useMemo(
    () => [...(data.byDriver || [])].sort((a, b) => num(b.paid) - num(a.paid)),
    [data.byDriver],
  )
  const maxPaid = Math.max(...ranked.map(driver => num(driver.paid)), 1)

  const kpis = [
    { label: 'Total Paid', value: rsK(data.totalPaid), sub: 'Settled payroll', icon: IndianRupee, tone: 'green' },
    { label: 'Pending Approval', value: data.pendingCount, sub: 'Awaiting review', icon: RefreshCw, tone: 'blue' },
    { label: 'Approved Unpaid', value: data.approvedCount, sub: 'Ready to pay', icon: CheckCircle2, tone: 'amber' },
    { label: 'Paid Settlements', value: data.paidCount, sub: `${data.draftCount} drafts on record`, icon: Wallet, tone: 'teal' },
    { label: 'Total Incentives', value: rsK(data.totalIncentives), sub: 'Across all settlements', icon: IndianRupee, tone: 'violet' },
  ]

  const exportRows = useMemo(() => ranked.map((driver, index) => ({
    rank: index + 1,
    driver: driver.name,
    settlements: driver.count,
    paid: num(driver.paid),
  })), [ranked])
  const exportConfig = useMemo(() => ({
    rows: exportRows,
    columns: [
      { label: 'Rank', key: 'rank' },
      { label: 'Driver', key: 'driver' },
      { label: 'Settlements', key: 'settlements' },
      { label: 'Paid (Rs.)', key: 'paid' },
    ],
    filename: 'payroll_analytics',
    title: 'Payroll Analytics',
  }), [exportRows])
  useReportExport(onRegisterExport, exportConfig)

  return (
    <div className="space-y-4">
      <ReportIntro
        title="Payroll & settlements"
        description="Settlement status and paid amounts by driver, using the existing payroll logic."
        scope="All-time settlements. Draft, pending, approved and paid remain distinct statuses. Global date range does not apply."
        action={<Button variant="outline" size="sm" onClick={() => navigate('/payroll')}>View payroll →</Button>}
      />
      <ReportState resource={resource} skeleton="kpi" empty={false}>
        <ReportKpiGrid items={kpis.slice(0, 4)} columns="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" />
        <ReportKpiGrid items={kpis.slice(4)} columns="grid-cols-1 sm:grid-cols-2" className="mt-3" />
      </ReportState>

      <ReportPanel eyebrow="Settlements" title="Paid Amount by Driver"
        sub="Bars compare paid amounts against the highest paid driver" icon={Wallet}
        action={<Button variant="ghost" size="sm" onClick={() => navigate('/payroll')}>View payroll →</Button>}>
        <ReportState resource={resource} skeleton="table" empty={!ranked.length}
          emptyIcon={Wallet} emptyTitle="No settlements yet">
          <RankRows rows={ranked}
            primary={row => (
              <span className="flex items-center gap-2">
                <Avatar name={row.name} size={24} />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{row.name}</span>
              </span>
            )}
            secondary={row => <p className="text-[11px] text-slate-400">{row.count} settlement{row.count !== 1 ? 's' : ''}</p>}
            value={row => <p className="text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{rs(row.paid)}</p>}
            share={row => pct(row.paid, maxPaid)} tone="green" />
        </ReportState>
      </ReportPanel>
    </div>
  )
}

export function MonthlyReport({ refreshKey, resetKey, onRegisterExport }) {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const [year, setYear] = useState(currentYear)
  useEffect(() => { setYear(currentYear) }, [resetKey, currentYear])
  const resource = useReportResource(
    `monthly-summary:${year}`,
    async () => {
      // getMonthlySummary() intentionally falls back to an empty array when
      // bookings fail. Verify the read first so a failed load never appears as
      // a real "no revenue" result.
      await loadBookings()
      return getMonthlySummary(year)
    },
    { refreshKey },
  )
  const data = Array.isArray(resource.data) ? resource.data : EMPTY_ARRAY

  const exportRows = useMemo(
    () => data.map(row => ({ ...row, month: monthLabel(row.month), monthNumber: num(row.month) })),
    [data],
  )
  const totalRevenue = data.reduce((sum, row) => sum + num(row.revenue), 0)
  const totalBookings = data.reduce((sum, row) => sum + num(row.bookings), 0)
  const completed = data.reduce((sum, row) => sum + num(row.completed), 0)
  const cancelled = data.reduce((sum, row) => sum + num(row.cancelled), 0)
  const maxRevenue = Math.max(...data.map(row => num(row.revenue)), 1)
  const empty = data.length === 0 || (totalRevenue === 0 && totalBookings === 0)

  const kpis = [
    { label: `Total Revenue ${year}`, value: rsK(totalRevenue), sub: `${totalBookings} bookings`, icon: IndianRupee, tone: 'blue' },
    { label: `Total Bookings ${year}`, value: totalBookings, sub: 'Selected year', icon: CalendarRange, tone: 'violet' },
    { label: 'Completed Bookings', value: completed, sub: `${pct(completed, totalBookings)}% of bookings`, icon: CheckCircle2, tone: 'green' },
    { label: 'Cancelled Bookings', value: cancelled, sub: `${pct(cancelled, totalBookings)}% of bookings`, icon: XCircle, tone: 'red' },
  ]

  const exportConfig = useMemo(() => ({
    rows: exportRows, columns: MONTHLY_COLUMNS, filename: `monthly_${year}`, title: `Monthly Summary ${year}`,
  }), [exportRows, year])
  useReportExport(onRegisterExport, exportConfig)

  return (
    <div className="space-y-4">
      <ReportIntro
        title={`Monthly performance · ${year}`}
        description="Bookings and revenue by calendar month for the selected year."
        scope={`Year ${year} only. Future months are shown as empty reporting periods, never as completed results.`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect label="Reporting year" value={String(year)} onChange={value => setYear(Number(value))}>
              {[currentYear - 1, currentYear, currentYear + 1].map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </FilterSelect>
            <ExportMenu config={exportConfig} disabled={!exportConfig.rows.length} />
          </div>
        }
      />

      <ReportState resource={resource} skeleton="kpi" empty={false}>
        <ReportKpiGrid items={kpis} columns="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" />
      </ReportState>

      <ReportPanel eyebrow="Comparison" title={`Revenue by Month · ${year}`}
        sub="Monthly bookings, outcomes and revenue" icon={BarChart3}>
        <ReportState resource={resource} skeleton="chart" empty={empty}
          emptyIcon={CalendarRange} emptyTitle={`No revenue in ${year}`}
          emptyDescription="Try another reporting year or add bookings for this year.">
          <SparkChart data={exportRows} valueKey="revenue" labelKey="month" height={150}
            accent="var(--sjt-brand)" format={value => rs(value)} />
          <div className="mt-4 flex items-end gap-1.5 h-28" aria-label="Monthly revenue bars">
            {exportRows.map(row => {
              const future = year > currentYear || (year === currentYear && row.monthNumber > currentMonth)
              return (
                <div key={row.month} className="flex-1 h-full flex flex-col items-center justify-end gap-1"
                  title={`${row.month}: ${rs(row.revenue)} · ${row.bookings} bookings${future ? ' · upcoming' : ''}`}>
                  <div className={`w-full max-w-[34px] rounded-t-[6px] ${future ? 'bg-[var(--ap-border)]' : 'bg-[var(--ap-accent)]'}`}
                    style={{ height: `${Math.max(3, Math.round(num(row.revenue) / maxRevenue * 100))}%` }} />
                  <span className="text-[9px] font-semibold text-slate-400">{row.month}</span>
                </div>
              )
            })}
          </div>
          <div className="mt-5 overflow-x-auto -mx-1">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="sticky top-0 z-10 bg-[var(--ap-surface)]">
                <tr className="border-b border-[var(--ap-border)]">
                  {['Month', 'Bookings', 'Completed', 'Cancelled', 'Revenue'].map((heading, index) => (
                    <th key={heading} className={`px-2.5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 ${index > 0 ? 'text-right' : 'text-left'}`}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map(row => {
                  const future = year > currentYear || (year === currentYear && num(row.month) > currentMonth)
                  return (
                    <tr key={row.month} className={`border-b border-[var(--ap-border)] last:border-0 ${future ? 'opacity-55' : 'hover:bg-[var(--ap-surface-2)]'}`}>
                      <td className="px-2.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                        <span className="flex items-center gap-2">{monthLabel(row.month)}{future && <StatusPill tone="gray">Upcoming</StatusPill>}</span>
                      </td>
                      <td className="px-2.5 py-2.5 text-xs tabular-nums text-right">{row.bookings}</td>
                      <td className="px-2.5 py-2.5 text-xs font-semibold tabular-nums text-right text-emerald-600 dark:text-emerald-400">{row.completed}</td>
                      <td className="px-2.5 py-2.5 text-xs tabular-nums text-right text-red-600 dark:text-red-400">{row.cancelled}</td>
                      <td className="px-2.5 py-2.5 text-xs font-semibold tabular-nums text-right">{rs(row.revenue)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </ReportState>
      </ReportPanel>
    </div>
  )
}

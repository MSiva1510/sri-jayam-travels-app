import { Receipt, ArrowUpRight } from 'lucide-react'
import Surface from '../ui/Surface'
import SectionHeader from '../ui/SectionHeader'
import SparkChart from '../ui/SparkChart'
import Callout from '../ui/Callout'
import AccessBlocked from './AccessBlocked'
import DataUnavailable from './DataUnavailable'
import { formatINR } from '../../utils/dashboardData'

export default function FinancialAnalytics({
  canRevenue, canProfit, canExpenses, data, onNavigate, unavailable = {},
}) {
  if (unavailable.bookings || unavailable.expenses) {
    return (
      <section>
        <SectionHeader eyebrow="Financial analytics" title="Revenue & expenses" />
        <DataUnavailable label="Financial analytics unavailable" description="Revenue and expense figures are hidden until their data sources load." />
      </section>
    )
  }

  const { totals, trend, expense, periodTagCap, periodTag } = data
  const chartRange = data.period === 'year'
    ? `Jan–Dec ${data.periodYear}`
    : 'Last 6 months'

  return (
    <section>
      <SectionHeader
        className="mb-3"
        eyebrow="Financial analytics"
        title="Revenue & expenses"
        badge={<span className="badge badge-active">{periodTagCap}</span>}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
        {canRevenue ? (
          <Surface className="flex flex-col">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Monthly fare trend</p>
                <p className="font-sf text-[17px] font-semibold text-slate-900 dark:text-white">{trend.title}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{chartRange} · cancelled trips excluded</p>
              </div>
              <span className="badge badge-active">INR</span>
            </div>
            <SparkChart
              data={trend.data}
              valueKey="fare"
              labelKey="month"
              accent="var(--sjt-brand)"
              summary={`Fare trend for ${chartRange}, total ${formatINR(totals.fare)}`}
            />
            <div className="mt-auto pt-3 border-t ap-hairline flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Total ({periodTagCap})</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400 tabular-nums">{formatINR(totals.fare)}</span>
            </div>
          </Surface>
        ) : (
          <Surface className="flex flex-col">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Trip volume</p>
                <p className="font-sf text-[17px] font-semibold text-slate-900 dark:text-white">6-month trend</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Last 6 months · cancelled trips excluded</p>
              </div>
              <span className="badge badge-active">TRIPS</span>
            </div>
            <SparkChart
              data={trend.monthlyTrips}
              valueKey="fare"
              labelKey="month"
              accent="#0d9488"
              format={value => `${value} trip${value !== 1 ? 's' : ''}`}
            />
            <div className="mt-auto pt-3 border-t ap-hairline flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Total (6 mo.)</span>
              <span className="font-semibold text-teal-600 dark:text-teal-400 tabular-nums">{trend.tripTotal} trips</span>
            </div>
          </Surface>
        )}

        {canProfit ? (
          <Surface className="flex flex-col">
            <div className="mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Income vs costs</p>
              <p className="font-sf text-[17px] font-semibold text-slate-900 dark:text-white">
                Profit breakdown <span className="badge badge-active align-middle text-[10px]">{periodTagCap}</span>
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{chartRange} · same fare source as KPIs</p>
            </div>
            <SparkChart
              data={trend.monthlyNet}
              valueKey="net"
              labelKey="month"
              height={120}
              accent={totals.net >= 0 ? '#10b981' : '#f43f5e'}
              summary={`Net income trend for ${chartRange}`}
            />
            <div className="mt-3 space-y-2">
              {[
                { label: 'Trip revenue', amount: totals.fare, color: 'bg-emerald-500' },
                { label: 'Expenses', amount: totals.expenses, color: 'bg-rose-500' },
                { label: 'Net income', amount: totals.net, color: totals.net >= 0 ? 'bg-emerald-500' : 'bg-rose-500' },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <span className={`w-2.5 h-2.5 rounded-full ${row.color}`} aria-hidden="true" />
                    {row.label}
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{formatINR(row.amount)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t ap-hairline flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Profit margin ({periodTagCap})</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{trend.margin}%</span>
            </div>
          </Surface>
        ) : (
          <AccessBlocked label="Profit reports" />
        )}
      </div>

      {canRevenue || canProfit ? null : (
        <div className="mt-3">
          <Callout
            tone="blue"
            icon={Receipt}
            title="Financial analytics is available to administrators"
            sub="Operational totals and the priority alerts above remain available for this role."
          />
        </div>
      )}

      {/* Expense breakdown — real loaded expenses, never sample data. */}
      {canExpenses && <div className="mt-3 sm:mt-4">
        <SectionHeader
          className="mb-3"
          eyebrow="Expense management"
          title={periodTagCap}
          action={
            <button
              type="button"
              onClick={() => onNavigate('/expenses')}
              aria-label="View all expenses"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors"
            >
              View all <ArrowUpRight size={13} aria-hidden="true" />
            </button>
          }
        />
        <Surface>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
            {[
              { label: 'Total spent', value: formatINR(totals.expenses), to: '/expenses' },
              { label: 'Entries', value: expense.entries, to: '/expenses' },
              { label: 'Pending approval', value: expense.pendingApprovals, to: '/expenses' },
              { label: 'Top categories', value: expense.categories.length, to: '/expenses' },
            ].map(item => (
              <button
                key={item.label}
                type="button"
                onClick={() => onNavigate(item.to)}
                className="ap-focus rounded-2xl border ap-hairline bg-slate-500/[0.02] dark:bg-white/[0.02] px-3 py-2.5 text-left hover:bg-[var(--ap-surface-2)] transition-colors"
              >
                <span className="block text-[10px] text-slate-500 dark:text-slate-400">{item.label}</span>
                <span className="block font-sf text-base font-semibold text-slate-900 dark:text-white tabular-nums mt-1">{item.value}</span>
              </button>
            ))}
          </div>

          {expense.categories.length > 0 ? (
            <div className="space-y-2.5">
              {expense.categories.map(category => {
                const pct = totals.expenses > 0 ? Math.round((category.total / totals.expenses) * 100) : 0
                return (
                  <div key={category.key}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                        <span aria-hidden="true">{category.icon}</span>{category.label}
                      </span>
                      <span className="font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                        {formatINR(category.total)} <span className="text-slate-400 font-normal">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-[var(--ap-border)] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full bg-gradient-to-r ${category.color}`} style={{ width: `${pct}%`, transition: 'width .5s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">No expenses recorded {periodTag}.</p>
          )}

          {expense.pendingApprovals > 0 && (
            <Callout
              className="mt-4"
              tone="blue"
              icon={Receipt}
              title={`${expense.pendingApprovals} expense${expense.pendingApprovals !== 1 ? 's' : ''} awaiting your approval`}
              actionLabel="Review"
              actionAriaLabel="Review expenses"
              onAction={() => onNavigate('/expenses')}
            />
          )}
        </Surface>
      </div>}
    </section>
  )
}

import { CalendarDays, Plus } from 'lucide-react'
import Button from '../ui/Button'
import SegmentedControl from '../ui/SegmentedControl'

export default function DashboardHeader({
  period, onPeriodChange, customRange, onCustomRangeChange,
  canBook, onCreateTrip, dateLabel, rangeLabel,
}) {
  const from = customRange?.from || ''
  const to = customRange?.to || ''
  const setRange = (patch) => onCustomRangeChange?.({ from, to, ...patch })

  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
          <span>Overview</span>
          <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1.5 normal-case tracking-normal">
            <CalendarDays size={13} aria-hidden="true" />
            {dateLabel}
          </span>
        </div>
        <h1 className="font-sf text-[28px] sm:text-[32px] font-semibold tracking-tight text-slate-900 dark:text-white mt-1">
          Fleet command center
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Live overview of trips, fleet and business performance · {rangeLabel}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 lg:justify-end">
        <div className="flex flex-wrap items-center gap-2 ap-surface px-2 py-1.5">
          <span className="hidden sm:inline text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400 pl-1">
            Date range
          </span>
          <SegmentedControl
            ariaLabel="Dashboard period"
            value={period}
            onChange={onPeriodChange}
            options={[
              { key: 'month', label: 'Month' },
              { key: 'year', label: 'This Year' },
              { key: 'custom', label: 'Custom' },
            ]}
          />
          {period === 'custom' && (
            <div className="flex items-center gap-1.5 pl-1">
              <label className="sr-only" htmlFor="dashboard-range-from">From date</label>
              <input
                id="dashboard-range-from"
                type="date"
                value={from}
                max={to || undefined}
                onChange={e => setRange({ from: e.target.value })}
                className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[var(--ap-accent)]"
              />
              <span className="text-xs text-slate-400" aria-hidden="true">–</span>
              <label className="sr-only" htmlFor="dashboard-range-to">To date</label>
              <input
                id="dashboard-range-to"
                type="date"
                value={to}
                min={from || undefined}
                onChange={e => setRange({ to: e.target.value })}
                className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[var(--ap-accent)]"
              />
            </div>
          )}
        </div>
        {canBook && (
          <Button icon={Plus} variant="primary" onClick={onCreateTrip} className="h-10 px-4 rounded-xl shadow-sm">
            Create Trip
          </Button>
        )}
      </div>
    </header>
  )
}

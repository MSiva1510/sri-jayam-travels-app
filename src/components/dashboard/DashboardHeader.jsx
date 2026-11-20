import { CalendarDays, Plus } from 'lucide-react'
import Button from '../ui/Button'
import SegmentedControl from '../ui/SegmentedControl'

export default function DashboardHeader({
  period, onPeriodChange, canBook, onNewBooking, dateLabel, rangeLabel,
}) {
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
        <div className="flex items-center gap-2 ap-surface px-2 py-1.5">
          <span className="hidden sm:inline text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400 pl-1">
            Date range
          </span>
          <SegmentedControl
            ariaLabel="Dashboard period"
            value={period}
            onChange={onPeriodChange}
            options={[{ key: 'month', label: 'Month' }, { key: 'year', label: 'This Year' }]}
          />
        </div>
        {canBook && (
          <Button icon={Plus} variant="primary" onClick={onNewBooking} className="h-10 px-4 rounded-xl shadow-sm">
            New Booking
          </Button>
        )}
      </div>
    </header>
  )
}

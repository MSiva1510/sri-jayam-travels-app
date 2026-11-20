import { ArrowUpRight, CheckCircle, Clock, Users, Fuel } from 'lucide-react'
import Surface from '../ui/Surface'
import DataUnavailable from './DataUnavailable'

const TONES = {
  blue: 'bg-blue-500', teal: 'bg-teal-500', green: 'bg-emerald-500',
  amber: 'bg-amber-500', red: 'bg-red-500',
}

export default function OperationsOverview({
  counts, allTime, driverCount, vehicleCount, unavailable,
  onViewAll, onViewTrips, onViewBills, onViewDrivers, onViewVehicles,
}) {
  const items = [
    { label: 'Total bookings', value: counts.total, tone: 'blue' },
    { label: 'Scheduled', value: counts.active, tone: 'teal' },
    { label: 'Completed', value: counts.completed, tone: 'green' },
    { label: 'Cancelled', value: counts.cancelled, tone: 'red' },
  ]
  const allTimeItems = [
    { label: 'Completed trips', navLabel: 'completed trips', value: allTime.doneTrips, icon: CheckCircle, onClick: onViewTrips || onViewAll },
    { label: 'Pending bills', navLabel: 'pending bills', value: allTime.pendingTrips, icon: Clock, onClick: onViewBills },
    { label: 'Drivers', navLabel: 'drivers', value: driverCount, icon: Users, onClick: onViewDrivers },
    { label: 'Vehicles', navLabel: 'vehicles', value: vehicleCount, icon: Fuel, onClick: onViewVehicles },
  ]

  if (unavailable) {
    return <DataUnavailable label="Today's operations unavailable" description="Booking counts are hidden until the data source loads." />
  }

  return (
    <Surface as="section" aria-label="Today's operations" className="py-4">
      <div className="flex items-center justify-between gap-3 mb-3.5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
            Today's operations
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Today · local time</p>
        </div>
        <button
          type="button"
          onClick={onViewAll}
          aria-label="View all trips"
          className="ap-action-link inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors"
        >
          View all <ArrowUpRight size={13} aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-2xl overflow-hidden bg-[var(--ap-border)]">
        {items.map(item => (
          <button
            key={item.label}
            type="button"
            onClick={onViewAll}
            aria-label="Open trips"
            className="ap-focus min-h-[68px] px-3 py-2.5 text-left bg-[var(--ap-surface)] hover:bg-[var(--ap-surface-2)] transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${TONES[item.tone]}`} aria-hidden="true" />
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">{item.label}</span>
            </span>
            <span className="block font-sf text-xl font-semibold text-slate-900 dark:text-white tabular-nums mt-1.5">
              {item.value}
            </span>
          </button>
        ))}
      </div>

      {/* All-time counters stay visible but visually subordinate to the daily pulse. */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-px rounded-2xl overflow-hidden bg-[var(--ap-border)]">
        {allTimeItems.map(item => (
          <button
            key={item.label}
            type="button"
            onClick={item.onClick}
            aria-label={`Open ${item.navLabel}`}
            className="ap-focus min-h-[54px] bg-[var(--ap-surface)] px-3 py-2.5 flex items-center gap-2 text-left hover:bg-[var(--ap-surface-2)] transition-colors"
          >
            <item.icon size={14} className="text-slate-500 dark:text-slate-400 flex-shrink-0" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">{item.label}</span>
              <span className="block font-sf text-sm font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{item.value}</span>
            </span>
          </button>
        ))}
      </div>
    </Surface>
  )
}

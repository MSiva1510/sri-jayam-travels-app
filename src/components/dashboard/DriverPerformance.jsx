import { ArrowUpRight } from 'lucide-react'
import Surface from '../ui/Surface'
import SectionHeader from '../ui/SectionHeader'
import Avatar from '../ui/Avatar'
import { formatINR } from '../../utils/dashboardData'
import DataUnavailable from './DataUnavailable'

export default function DriverPerformance({
  driverStats = [], canFinancialAnalytics, unavailable, onViewDrivers,
}) {
  if (unavailable) {
    return <DataUnavailable label="Driver performance unavailable" description="Trip and expense inputs are hidden until they load." />
  }

  return (
    <Surface>
      <SectionHeader
        eyebrow="Driver performance"
        title="Trip contribution"
        action={
          <button
            type="button"
            onClick={onViewDrivers}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors"
          >
            View drivers <ArrowUpRight size={13} aria-hidden="true" />
          </button>
        }
      />
      <div className="mt-4 space-y-3.5">
        {driverStats.length === 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-400">No drivers yet.</p>
        )}
        {driverStats.map(driver => (
          <div key={driver.id}>
            <div className="flex items-center gap-2.5 mb-1.5">
              <Avatar name={driver.name} size={28} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{driver.name}</p>
                <p className="text-[10px] text-slate-400 tabular-nums">
                  {driver.trips} trip{driver.trips !== 1 ? 's' : ''}
                </p>
              </div>
              {canFinancialAnalytics && (
                <p className="text-xs font-semibold text-red-500 tabular-nums">{formatINR(driver.cost)}</p>
              )}
            </div>
            <div className="h-1.5 bg-[var(--ap-border)] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full"
                style={{ width: `${Math.min(100, Math.max(0, driver.contribution))}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
              {driver.contribution}% of total fare
            </p>
          </div>
        ))}
        {driverStats.length > 0 && (
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            All-time trip share of total fare.
          </p>
        )}
      </div>
    </Surface>
  )
}

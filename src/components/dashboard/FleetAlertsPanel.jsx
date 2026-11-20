import { AlertTriangle, ArrowUpRight, XCircle, Zap, CheckCircle } from 'lucide-react'
import Surface from '../ui/Surface'
import SectionHeader from '../ui/SectionHeader'
import StatusPill from '../ui/StatusPill'
import EmptyState from '../ui/EmptyState'
import MiniStat from './MiniStat'
import DataUnavailable from './DataUnavailable'

const PRIORITY_TONE = { critical: 'red', high: 'amber' }

export default function FleetAlertsPanel({ alerts = [], unavailable, onViewAll }) {
  if (unavailable) {
    return <DataUnavailable label="Fleet alerts unavailable" description="Alert status is hidden until the feed loads; no all-clear is shown." />
  }

  const active = alerts.filter(alert => alert.status !== 'resolved' && alert.status !== 'closed')
  const critical = active.filter(alert => alert.priority === 'critical').length
  const high = active.filter(alert => alert.priority === 'high').length

  const formatDetected = value => {
    if (!value) return '--'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '--'
    return `${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ${date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
  }

  return (
    <section>
      <SectionHeader
        eyebrow="Fleet alerts"
        title={`Active alerts (${active.length})`}
        action={
          <button
            type="button"
            onClick={onViewAll}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors"
          >
            View all <ArrowUpRight size={13} aria-hidden="true" />
          </button>
        }
      />
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <MiniStat icon={XCircle} tone="red" value={critical} label="Critical alerts" />
        <MiniStat icon={AlertTriangle} tone="amber" value={high} label="High priority" />
        <MiniStat icon={Zap} tone="blue" value={active.length} label="Total active" />
      </div>
      <Surface className="mt-3">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">Recent alerts</p>
        {active.length === 0 ? (
          <EmptyState icon={CheckCircle} title="No active alerts" description="The fleet is reporting clear." />
        ) : (
          <div className="space-y-2">
            {active.slice(0, 5).map((alert, index) => {
              const priority = alert?.priority || 'medium'
              const label = priority.charAt(0).toUpperCase() + priority.slice(1)
              return (
                <div
                  key={alert?.id || index}
                  className={`border-l-2 ${priority === 'critical' ? 'border-red-500' : priority === 'high' ? 'border-amber-500' : 'border-blue-500'} rounded-r-xl rounded-l-sm bg-slate-500/5 dark:bg-white/5 px-3 py-2.5`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{alert?.title || 'Fleet alert'}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate font-mono">
                        {alert?.vehicle_id ? `Vehicle ${String(alert.vehicle_id).slice(-6)}` : 'Unknown vehicle'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <StatusPill tone={PRIORITY_TONE[priority] || 'blue'}>{label}</StatusPill>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap tabular-nums">
                        {formatDetected(alert?.detected_at)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Surface>
    </section>
  )
}

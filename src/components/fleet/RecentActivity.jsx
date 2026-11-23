import { Clock3, History, MapPin, Navigation2, Square } from 'lucide-react'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import Surface from '../ui/Surface'
import StatusPill from '../ui/StatusPill'
import { fmtTime, timeAgo } from './fleetStatus'

const EVENTS = {
  started:  { label: 'Started moving', tone: 'green',  icon: Navigation2 },
  stopped:  { label: 'Stopped',        tone: 'amber',  icon: Square },
  updated:  { label: 'Position updated', tone: 'blue', icon: MapPin },
  reconnected: { label: 'GPS reconnected', tone: 'green', icon: Navigation2 },
}

export default function RecentActivity({ events = [], onViewHistory }) {
  return (
    <Surface>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h2 className="text-sm font-sf font-semibold text-slate-900 dark:text-white">Recent Activity</h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Latest events derived from real GPS samples.</p>
        </div>
        <Button type="button" variant="ghost" size="sm" icon={History} onClick={onViewHistory} disabled={!onViewHistory}>
          View GPS History
        </Button>
      </div>

      {events.length === 0 ? (
        <EmptyState icon={Clock3} title="No recent activity" description="GPS events will appear here as vehicles report." />
      ) : (
        <ol className="space-y-1">
          {events.map((event, i) => {
            const meta = EVENTS[event.type] || EVENTS.updated
            const Icon = meta.icon
            return (
              <li key={event.id || i} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-500/5 dark:hover:bg-white/5 transition-colors">
                <span className="w-7 h-7 rounded-lg bg-[var(--ap-surface-2)] flex items-center justify-center text-slate-500 dark:text-slate-300 flex-shrink-0">
                  <Icon size={13} strokeWidth={2.1} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{event.registration || '—'}</span>
                    <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{event.location || 'Location unavailable'}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 tabular-nums">{fmtTime(event.t)}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">{timeAgo(event.t)}</p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Surface>
  )
}

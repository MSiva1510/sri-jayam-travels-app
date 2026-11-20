import { useState, useEffect } from 'react'
import Surface from '../ui/Surface'
import SectionHeader from '../ui/SectionHeader'
import DataUnavailable from './DataUnavailable'
import { loadRecentActivity, fmtAuditTime } from '../../data/auditLogData'

export default function RecentActivityWidget({ limit = 5 }) {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadRecentActivity(limit).then(list => {
      if (cancelled) return
      setActivities(Array.isArray(list) ? list : [])
      setLoading(false)
    }).catch(err => {
      if (cancelled) return
      console.error('[Dashboard] failed to load recent activity:', err)
      setError(true)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [limit])

  if (loading) return null

  return (
    <section>
      <SectionHeader className="mb-3" eyebrow="Audit trail" title="Recent activity" />
      {error ? (
        <DataUnavailable label="Recent activity unavailable" description="The audit feed could not be loaded." />
      ) : activities.length === 0 ? null : (
        <Surface padded={false} className="overflow-hidden">
          <div className="divide-y ap-hairline">
            {activities.map(event => (
              <div key={event.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-base flex-shrink-0" aria-hidden="true">{event.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{event.label}</p>
                  {event.description && <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{event.description}</p>}
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 flex-shrink-0">{fmtAuditTime(event.timestamp)}</span>
              </div>
            ))}
          </div>
        </Surface>
      )}
    </section>
  )
}

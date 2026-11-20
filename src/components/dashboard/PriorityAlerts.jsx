import { AlertTriangle, ArrowUpRight, CheckCircle2 } from 'lucide-react'
import Surface from '../ui/Surface'
import StatusPill from '../ui/StatusPill'
import DataUnavailable from './DataUnavailable'

const STATUS = {
  expired: { tone: 'red', label: 'Expired' },
  soon: { tone: 'amber', label: 'Expiring Soon' },
  active: { tone: 'green', label: 'Valid' },
}

const formatExpiry = value => {
  if (!value) return '—'
  const [year, month, day] = String(value).slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : String(value)
}

export default function PriorityAlerts({
  alerts = [], expiredCount = 0, soonCount = 0, validCount = 0,
  attentionItems = [], unavailable, onReviewAlert, onViewDocuments, onAction,
}) {
  if (unavailable) {
    return <DataUnavailable label="Document alerts unavailable" description="Expiry status is hidden until vehicle and driver data loads." />
  }

  const visible = alerts.slice(0, 5)
  const queue = attentionItems.filter(item => !item.label.toLowerCase().includes('document'))
  const hasAlerts = alerts.length > 0 || queue.length > 0

  return (
    <Surface className="py-4">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3.5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
            Priority alerts & reminders
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <StatusPill tone={expiredCount ? 'red' : 'gray'}>{expiredCount} expired</StatusPill>
            <StatusPill tone={soonCount ? 'amber' : 'gray'}>{soonCount} expiring soon</StatusPill>
            <StatusPill tone="green">{validCount} valid</StatusPill>
          </div>
        </div>
        {alerts.length > 0 && (
          <button
            type="button"
            onClick={onViewDocuments}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors"
          >
            View all <ArrowUpRight size={13} aria-hidden="true" />
          </button>
        )}
      </div>

      {!hasAlerts ? (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/[0.07] border border-emerald-500/15 px-3.5 py-3">
          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
            No expired documents or pending operational actions.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((alert, index) => {
            const status = STATUS[alert.status?.key] || STATUS.soon
            return (
              <div
                key={`${alert.to}-${alert.label}-${index}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-[var(--ap-border)] bg-[var(--ap-surface-2)] px-3.5 py-2.5"
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  alert.status?.key === 'expired' ? 'bg-red-500' : 'bg-amber-500'
                }`} aria-hidden="true" />
                <div className="flex-1 min-w-[160px]">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{alert.label}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {alert.kind} document · expires {formatExpiry(alert.expiryDate)}
                  </p>
                </div>
                <StatusPill tone={status.tone}>{status.label}</StatusPill>
                <button
                  type="button"
                  onClick={() => onReviewAlert(alert)}
                  className="ap-focus rounded-lg px-2 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition-colors"
                >
                  Review
                </button>
              </div>
            )
          })}

          {queue.map(item => (
            <button
              key={item.label}
              type="button"
              onClick={() => onAction(item.to)}
              className="ap-focus w-full flex items-center justify-between gap-3 rounded-2xl border border-[var(--ap-border)] px-3.5 py-2.5 text-left hover:bg-[var(--ap-surface-2)] transition-colors"
            >
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                <AlertTriangle size={13} className="text-amber-500" aria-hidden="true" />
                {item.label}
              </span>
              <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 flex-shrink-0">Review →</span>
            </button>
          ))}

          {alerts.length > visible.length && (
            <button
              type="button"
              onClick={onViewDocuments}
              className="w-full pt-1 text-center text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors"
            >
              +{alerts.length - visible.length} more alerts — view all documents
            </button>
          )}
        </div>
      )}
    </Surface>
  )
}

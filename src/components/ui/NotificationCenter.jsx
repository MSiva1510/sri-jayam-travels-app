// ─── Notification Center ──────────────────────────────────────
// Bell button + floating notification panel (4 tabs) — reads from
// CommunicationContext. Falls back gracefully when context is unavailable.

import { useState, useRef, useEffect } from 'react'
import {
  Bell, X, CheckCheck, CheckCircle, AlertTriangle,
  Clock, Archive, Trash2, BookOpen, BellOff, Inbox, Activity,
} from 'lucide-react'
import { useCommunicationCtx } from '../../hooks/useCommunication'
import { getBusinessAlerts } from '../../data/reportData'
import { loadRecentActivity, fmtAuditTime } from '../../data/auditLogData'
import { NOTIFICATION_TYPES } from '../../services/notificationService'

// ── Helpers ───────────────────────────────────────────────────
function useClickOutside(ref, handler) {
  useEffect(() => {
    const fn = e => { if (!ref.current || ref.current.contains(e.target)) return; handler() }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [ref, handler])
}

function fmtTime(ts) {
  if (!ts) return ''
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (diff < 60)   return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`
  return new Date(ts).toLocaleDateString('en-IN', { day:'numeric', month:'short' })
}

const CAT_COLOR = {
  booking:   'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  trip:      'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  expense:   'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  payroll:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  document:  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  vehicle:   'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  attendance:'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  fleet:     'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  general:   'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
}

const TABS = [
  { key:'inbox',    label:'Inbox',    Icon: Inbox    },
  { key:'alerts',   label:'Alerts',   Icon: AlertTriangle },
  { key:'activity', label:'Activity', Icon: Activity },
  { key:'archived', label:'Archived', Icon: Archive  },
]

// ── Sub-components ────────────────────────────────────────────
function EmptyState({ icon, text, hint }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="w-11 h-11 rounded-2xl bg-[var(--ap-surface-2)] flex items-center justify-center">
        {icon}
      </div>
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{text}</p>
      {hint && <p className="text-[10px] text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  )
}

function IconButton({ onClick, title, children, danger = false, show = true }) {
  if (!show) return null
  return (
    <button onClick={e => { e.stopPropagation(); onClick() }} title={title} aria-label={title}
      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
        danger
          ? 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
          : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
      }`}>
      {children}
    </button>
  )
}

function NotifRow({ n, onRead, onArchive, onDismiss, archived = false }) {
  const isUnread = n.status === 'unread'
  const catClass = CAT_COLOR[n.category] || CAT_COLOR.general
  const icon     = n.icon || NOTIFICATION_TYPES[n.type]?.icon || '🔔'

  return (
    <div className={`group relative flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--ap-surface-2)]/60 ${
      isUnread ? 'bg-blue-50/40 dark:bg-blue-500/5' : ''
    }`}>
      {isUnread && <span className="absolute left-0 top-2.5 bottom-2.5 w-0.5 rounded-r-full bg-blue-500" />}

      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-[15px] ${catClass}`}>
        {icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <p className={`text-xs font-bold leading-snug ${isUnread ? 'text-slate-800 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
            {n.title}
          </p>
          {isUnread && <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />}
        </div>

        {n.message && (
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 line-clamp-2">{n.message}</p>
        )}

        <div className="mt-1.5 flex items-center gap-2">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize ${catClass}`}>
            {n.category || 'general'}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">{fmtTime(n.created_at)}</span>
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-0.5 opacity-60 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
        <IconButton onClick={onRead} title="Mark read" show={!archived && isUnread && !!onRead}>
          <BookOpen size={12} />
        </IconButton>
        <IconButton onClick={onArchive} title="Archive" show={!archived && !!onArchive}>
          <Archive size={12} />
        </IconButton>
        <IconButton onClick={onDismiss} title="Delete" danger show={!!onDismiss}>
          <Trash2 size={12} />
        </IconButton>
      </div>
    </div>
  )
}

function AlertRow({ alert: a }) {
  const isExpired = a.status?.key === 'expired'
  return (
    <div className={`flex items-start gap-3 px-4 py-3 ${a.priority === 'high' ? 'bg-red-50/40 dark:bg-red-500/5' : ''}`}>
      <div className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
        isExpired ? 'bg-red-100 dark:bg-red-900/40' : 'bg-amber-100 dark:bg-amber-900/40'
      }`}>
        <AlertTriangle size={14} className={isExpired ? 'text-red-500' : 'text-amber-500'} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-slate-700 dark:text-slate-200">{a.label}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${a.status?.badge || ''}`}>
            {a.status?.label || ''}
          </span>
          {a.days != null && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              {a.days < 0 ? `${Math.abs(a.days)}d overdue` : a.days === 0 ? 'Today' : `${a.days}d left`}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function ActivityRow({ ev }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--ap-surface-2)] text-[13px]">
        {ev.icon || '📌'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-slate-700 dark:text-slate-200">{ev.label || 'Activity'}</p>
        {ev.description && <p className="truncate text-[10px] text-slate-400 dark:text-slate-500">{ev.description}</p>}
      </div>
      <span className="whitespace-nowrap text-[10px] text-slate-400 dark:text-slate-500">{fmtAuditTime(ev.timestamp)}</span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────
export default function NotificationCenter() {
  const {
    notifications, unreadCount, notifLoading,
    loadNotifs, markRead, markAllRead, archive, dismiss,
  } = useCommunicationCtx()

  const [open,     setOpen]    = useState(false)
  const [tab,      setTab]     = useState('inbox')
  const [alerts,   setAlerts]  = useState([])
  const [activity, setActivity]= useState([])
  const wrapRef = useRef()
  useClickOutside(wrapRef, () => setOpen(false))

  useEffect(() => {
    if (!open) return
    loadNotifs()
    getBusinessAlerts().then(setAlerts).catch(() => {})
    loadRecentActivity(12).then(list => setActivity(Array.isArray(list) ? list : []))
  }, [open, loadNotifs])

  const inbox    = notifications.filter(n => ['unread', 'read'].includes(n.status))
  const archived = notifications.filter(n => n.status === 'archived')
  const unread   = notifications.filter(n => n.status === 'unread')
  const highAlerts = alerts.filter(a => a.priority === 'high').length
  const badgeNum = unreadCount + highAlerts

  const counts = {
    inbox:    { badge: unread.length,  count: inbox.length    },
    alerts:   { badge: highAlerts,     count: alerts.length   },
    activity: { badge: 0,              count: activity.length },
    archived: { badge: 0,              count: archived.length },
  }

  return (
    <div ref={wrapRef} className="relative">
      {/* Bell */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={badgeNum > 0 ? `Notifications, ${badgeNum} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`group relative flex h-9 w-9 items-center justify-center rounded-xl border transition-all ${
          open
            ? 'border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400'
            : 'border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
        }`}
        title="Notifications">
        <Bell size={16} className="transition-transform group-hover:scale-105" />
        {badgeNum > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[9px] font-bold leading-none text-white dark:border-[var(--ap-surface)]">
            {badgeNum > 9 ? '9+' : badgeNum}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-11 z-50 w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[var(--ap-border)] bg-[var(--ap-surface)] shadow-2xl animate-fade-up sm:w-[380px]">
          {/* Header */}
          <div className="relative border-b border-[var(--ap-border)]">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-amber-500/10" />
            <div className="relative flex items-center gap-3 px-4 py-3.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
                <Bell size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-sf text-sm font-semibold leading-tight text-slate-800 dark:text-white">Notifications</h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  {unread.length > 0 ? `${unread.length} unread` : 'All caught up'}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {unread.length > 0 && (
                  <button onClick={markAllRead} title="Mark all read" aria-label="Mark all read"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20">
                    <CheckCheck size={14} />
                  </button>
                )}
                <button onClick={() => setOpen(false)} aria-label="Close notifications"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-[var(--ap-surface-2)] hover:text-slate-600 dark:hover:text-slate-200">
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Segmented tabs */}
          <div className="px-3 pt-3">
            <div className="flex gap-1 rounded-xl bg-[var(--ap-surface-2)] p-1">
              {TABS.map(t => {
                const { Icon } = t
                const active = tab === t.key
                const c = counts[t.key]
                return (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-bold transition-all ${
                      active
                        ? 'bg-[var(--ap-surface-elev)] text-slate-900 shadow-sm dark:text-white'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}>
                    <Icon size={11} className="hidden sm:block" />
                    {t.label}
                    {c.badge > 0 ? (
                      <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-600 dark:bg-red-900/40 dark:text-red-400">
                        {c.badge}
                      </span>
                    ) : c.count > 0 ? (
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                        active
                          ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
                          : 'bg-[var(--ap-border)] text-slate-400'
                      }`}>
                        {c.count}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Body */}
          <div className="mt-2 max-h-[22rem] overflow-y-auto">
            {notifLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              </div>
            ) : (
              <>
                {tab === 'inbox' && (
                  inbox.length === 0
                    ? <EmptyState icon={<BellOff size={20} className="text-slate-300 dark:text-slate-600" />} text="No notifications" hint="You're all caught up." />
                    : <div className="divide-y divide-[var(--ap-border)]/60">
                        {inbox.map(n => (
                          <NotifRow key={n.id} n={n}
                            onRead={n.status === 'unread' ? () => markRead(n.id) : null}
                            onArchive={() => archive(n.id)}
                            onDismiss={() => dismiss(n.id)} />
                        ))}
                      </div>
                )}

                {tab === 'alerts' && (
                  alerts.length === 0
                    ? <EmptyState icon={<CheckCircle size={20} className="text-emerald-400" />} text="All documents up to date" />
                    : <div className="divide-y divide-[var(--ap-border)]/60">
                        {alerts.map((a, i) => <AlertRow key={i} alert={a} />)}
                      </div>
                )}

                {tab === 'activity' && (
                  activity.length === 0
                    ? <EmptyState icon={<Clock size={20} className="text-slate-300 dark:text-slate-600" />} text="No recent activity" />
                    : <div className="divide-y divide-[var(--ap-border)]/60">
                        {activity.map(ev => <ActivityRow key={ev.id} ev={ev} />)}
                      </div>
                )}

                {tab === 'archived' && (
                  archived.length === 0
                    ? <EmptyState icon={<Archive size={20} className="text-slate-300 dark:text-slate-600" />} text="Nothing archived" />
                    : <div className="divide-y divide-[var(--ap-border)]/60">
                        {archived.map(n => (
                          <NotifRow key={n.id} n={n} archived onDismiss={() => dismiss(n.id)} />
                        ))}
                      </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-[var(--ap-border)] bg-[var(--ap-surface-2)]/40 px-4 py-2">
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              {unread.length > 0 ? `${unread.length} unread` : 'All caught up'}
            </p>
            <a href="/communications" className="text-[10px] font-bold text-blue-600 hover:underline dark:text-blue-400">
              View all →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

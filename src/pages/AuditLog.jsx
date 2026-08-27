// ─── Audit Log Data ───────────────────────────────────────────
// Day 31: enhanced with severity, module, old/new values, user tracking

import { useState, useEffect, useMemo, useCallback } from 'react'
import supabase from '../lib/supabase'
import PageHeader from '../components/ui/PageHeader'

export const AUDIT_LOG_KEY    = 'sjt_audit_log'
export const AUDIT_MAX_ENTRIES = 500

export const SEVERITY = { INFO:'info', WARNING:'warning', ERROR:'error', CRITICAL:'critical' }

export const AUDIT_ACTIONS = {
  // Trips / Bookings
  TRIP_CREATED:       { label:'Trip Created',       icon:'📋', module:'bookings',  severity:'info'    },
  TRIP_UPDATED:       { label:'Trip Updated',       icon:'✏️',  module:'bookings',  severity:'info'    },
  TRIP_ASSIGNED:      { label:'Trip Assigned',      icon:'🧑‍✈️', module:'trips',     severity:'info'    },
  TRIP_STARTED:       { label:'Trip Started',       icon:'🚗', module:'trips',     severity:'info'    },
  TRIP_COMPLETED:     { label:'Trip Completed',     icon:'✅', module:'trips',     severity:'info'    },
  TRIP_CANCELLED:     { label:'Trip Cancelled',     icon:'❌', module:'trips',     severity:'warning' },
  BOOKING_PENDING:    { label:'Booking Pending',    icon:'⏳', module:'bookings',  severity:'info'    },
  BOOKING_APPROVED:   { label:'Booking Approved',   icon:'✅', module:'bookings',  severity:'info'    },
  BOOKING_CANCELLED:  { label:'Booking Cancelled',  icon:'❌', module:'bookings',  severity:'warning' },
  BOOKING_CLOSED:     { label:'Booking Closed',     icon:'🔒', module:'bookings',  severity:'info'    },
  // Expenses
  EXPENSE_ADDED:      { label:'Expense Added',      icon:'💸', module:'expenses',  severity:'info'    },
  EXPENSE_APPROVED:   { label:'Expense Approved',   icon:'✅', module:'expenses',  severity:'info'    },
  EXPENSE_REJECTED:   { label:'Expense Rejected',   icon:'❌', module:'expenses',  severity:'warning' },
  // Vehicles / Drivers
  VEHICLE_ASSIGNED:   { label:'Vehicle Assigned',   icon:'🚙', module:'vehicles',  severity:'info'    },
  DRIVER_ADDED:       { label:'Driver Added',       icon:'🧑‍✈️', module:'drivers',   severity:'info'    },
  DRIVER_UPDATED:     { label:'Driver Updated',     icon:'✏️',  module:'drivers',   severity:'info'    },
  // Customers
  CUSTOMER_ADDED:     { label:'Customer Added',     icon:'👤', module:'customers', severity:'info'    },
  CUSTOMER_UPDATED:   { label:'Customer Updated',   icon:'✏️',  module:'customers', severity:'info'    },
  // Finance
  PAYROLL_SETTLED:    { label:'Payroll Settled',    icon:'💳', module:'payroll',   severity:'info'    },
  INVOICE_CREATED:    { label:'Invoice Created',    icon:'🧾', module:'finance',   severity:'info'    },
  // Security
  USER_LOGIN:         { label:'User Login',         icon:'🔐', module:'security',  severity:'info'    },
  USER_LOGOUT:        { label:'User Logout',        icon:'🚪', module:'security',  severity:'info'    },
  USER_CREATED:       { label:'User Created',       icon:'👤', module:'security',  severity:'info'    },
  USER_UPDATED:       { label:'User Updated',       icon:'✏️',  module:'security',  severity:'info'    },
  USER_DEACTIVATED:   { label:'User Deactivated',   icon:'🚫', module:'security',  severity:'warning' },
  USER_ACTIVATED:     { label:'User Activated',     icon:'✅', module:'security',  severity:'info'    },
  PASSWORD_CHANGED:   { label:'Password Changed',   icon:'🔑', module:'security',  severity:'warning' },
  PERMISSION_CHANGED: { label:'Permission Changed', icon:'🛡️', module:'security',  severity:'warning' },
  // System
  SETTINGS_UPDATED:   { label:'Settings Updated',   icon:'⚙️', module:'settings',  severity:'info'    },
  BACKUP_STARTED:     { label:'Backup Started',     icon:'💾', module:'backup',    severity:'info'    },
  BACKUP_COMPLETED:   { label:'Backup Completed',   icon:'✅', module:'backup',    severity:'info'    },
  ERROR_RESOLVED:     { label:'Error Resolved',     icon:'🔧', module:'system',    severity:'info'    },
  NOTE_ADDED:         { label:'Note Added',         icon:'📝', module:'general',   severity:'info'    },
}

export function loadAuditEvents(limit = 50) {
  try {
    const raw = localStorage.getItem(AUDIT_LOG_KEY)
    const all = raw ? JSON.parse(raw) : []
    return Array.isArray(all) ? (limit ? all.slice(0, limit) : all) : []
  } catch { return [] }
}

export function loadRecentActivity(count = 10) {
  return loadAuditEvents(count)
}

// Pending audit events that failed to sync (retry on next event)
const _pendingQueue = []

export function addAuditEvent(action, details = {}) {
  const def = AUDIT_ACTIONS[action] || { label:action, icon:'📌', module:'general', severity:'info' }
  const entry = {
    id:          `AUD-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`,
    action,
    label:       def.label,
    icon:        def.icon,
    module:      details.module      || def.module   || 'general',
    severity:    details.severity    || def.severity  || 'info',
    description: details.description || '',
    oldValues:   details.oldValues   || null,
    newValues:   details.newValues   || null,
    userId:      details.userId      || null,
    userName:    details.userName    || details.driver || null,
    timestamp:   new Date().toISOString(),
    ...details,
  }

  // Local cache — used as offline fallback / instant read
  try {
    const events = loadAuditEvents(AUDIT_MAX_ENTRIES)
    localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify([entry, ...events].slice(0, AUDIT_MAX_ENTRIES)))
  } catch {}

  // Supabase write: primary record. Failures are queued for retry.
  if (supabase) {
    const payload = {
      action,
      table_name:  details.table    || entry.module  || null,
      record_id:   details.recordId || details.tripId || null,
      old_values:  details.oldValues || null,
      new_values:  details.newValues ? { ...details } : null,
      changed_by:  details.changedBy || details.driver || null,
      severity:    entry.severity,
      module:      entry.module,
      user_name:   entry.userName,
      changed_at:  entry.timestamp,
    }
    // Drain any previously failed writes first
    const toRetry = _pendingQueue.splice(0)
    const writeAll = toRetry.length
      ? supabase.from('audit_logs').insert(toRetry.map(e => e.payload)).then(() =>
          supabase.from('audit_logs').insert([payload])
        )
      : supabase.from('audit_logs').insert([payload])

    writeAll.then(({ error }) => {
      if (error) {
        if (import.meta.env.DEV) console.warn('[auditLog] Supabase write failed — queued for retry:', error.message)
        _pendingQueue.push({ payload, entry })
      }
    })
  }

  return entry
}

/**
 * Load audit events from Supabase (for the admin AuditLog page).
 * Falls back to localStorage when offline.
 */
export async function loadAuditEventsFromDB(limit = 100) {
  if (!supabase) return { data: loadAuditEvents(limit), fromCache: true, error: null }
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    // Merge with any locally-pending events not yet synced
    const pending = _pendingQueue.map(q => q.entry)
    return { data: [...pending, ...(data || [])].slice(0, limit), fromCache: false, error: null }
  } catch (err) {
    // Offline/DB fallback — still surface the real error so it isn't hidden
    console.error('[AuditLog] Supabase fetch failed, falling back to local cache:', err?.message || err)
    return { data: loadAuditEvents(limit), fromCache: true, error: err?.message || 'Unknown error' }
  }
}

export function fmtAuditTime(iso) {
  if (!iso) return '—'
  try {
    const d    = new Date(iso)
    const mins = Math.floor((Date.now() - d.getTime()) / 60000)
    const hrs  = Math.floor(mins / 60)
    const days = Math.floor(hrs / 24)
    if (mins < 1)  return 'Just now'
    if (mins < 60) return `${mins}m ago`
    if (hrs  < 24) return `${hrs}h ago`
    if (days < 7)  return `${days}d ago`
    return d.toLocaleDateString('en-IN', { day:'numeric', month:'short' })
  } catch { return '—' }
}

export function clearAuditLog() {
  try { localStorage.removeItem(AUDIT_LOG_KEY) } catch {}
}

function SeverityBadge({ severity }) {
  const styles = {
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    error:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    warning:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    info:     'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${styles[severity] || styles.info}`}>
      {severity || 'info'}
    </span>
  )
}

export default function AuditLog() {
  const [events, setEvents]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [fromCache, setFromCache] = useState(false)
  const [search, setSearch]     = useState('')
  const [moduleFilter, setModuleFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, fromCache: cached, error: err } = await loadAuditEventsFromDB(200)
    setEvents(Array.isArray(data) ? data : [])
    setFromCache(cached)
    setError(err)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const modules = useMemo(
    () => ['all', ...new Set(events.map(e => e.module).filter(Boolean))],
    [events]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return events.filter(e => {
      if (moduleFilter !== 'all' && e.module !== moduleFilter) return false
      if (!q) return true
      return [e.action, e.table_name, e.user_name, e.changed_by, e.record_id]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(q))
    })
  }, [events, search, moduleFilter])

  return (
    <div className="p-6">
      <PageHeader
        title="Audit Log"
        subtitle={`${events.length} recent event${events.length === 1 ? '' : 's'}${fromCache ? ' (showing cached copy — live sync unavailable)' : ''}`}
        action={
          <button
            onClick={load}
            className="px-4 py-2 rounded-xl bg-navy-900 dark:bg-white text-white dark:text-navy-900 text-sm font-bold hover:opacity-90 transition-all"
          >
            Refresh
          </button>
        }
      />

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300">
          Live audit log is unavailable right now ({error}). Showing the last locally cached events instead.
        </div>
      )}

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search action, table, user…"
          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm w-64"
        />
        <select
          value={moduleFilter}
          onChange={e => setModuleFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm"
        >
          {modules.map(m => <option key={m} value={m}>{m === 'all' ? 'All modules' : m}</option>)}
        </select>
      </div>

      <div className="rounded-2xl border border-slate-200/80 dark:border-navy-700 bg-white dark:bg-navy-900 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading audit log…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            {events.length === 0 ? 'No audit events recorded yet.' : 'No events match your search.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-navy-800">
            {filtered.map((e, i) => (
              <div key={e.id || i} className="flex items-start gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-slate-800 dark:text-white">
                      {e.action || 'Unknown action'}
                    </span>
                    <SeverityBadge severity={e.severity} />
                    {e.module && (
                      <span className="text-[10px] uppercase tracking-wide text-slate-400">{e.module}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {e.table_name ? `${e.table_name}${e.record_id ? ` · ${e.record_id}` : ''}` : ''}
                    {(e.user_name || e.changed_by) && ` · by ${e.user_name || e.changed_by}`}
                  </p>
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">{fmtAuditTime(e.changed_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
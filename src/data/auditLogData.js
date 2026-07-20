import supabase from '../lib/supabase'

export const AUDIT_LOG_KEY = 'sjt_audit_log'
export const AUDIT_MAX_ENTRIES = 200

export const AUDIT_ACTIONS = {
  TRIP_CREATED:     { label: 'Trip Created',      icon: '📋' },
  TRIP_UPDATED:     { label: 'Trip Updated',      icon: '✏️' },
  TRIP_ASSIGNED:    { label: 'Trip Assigned',     icon: '🧑‍✈️' },
  TRIP_STARTED:     { label: 'Trip Started',      icon: '🚗' },
  TRIP_COMPLETED:   { label: 'Trip Completed',    icon: '✅' },
  TRIP_CANCELLED:   { label: 'Trip Cancelled',    icon: '❌' },
  EXPENSE_ADDED:    { label: 'Expense Added',     icon: '💰' },
  VEHICLE_ASSIGNED: { label: 'Vehicle Assigned',  icon: '🚙' },
  CUSTOMER_ADDED:   { label: 'Customer Added',    icon: '👤' },
  DRIVER_ADDED:     { label: 'Driver Added',      icon: '🧑‍✈️' },
  PAYROLL_SETTLED:  { label: 'Payroll Settled',   icon: '💳' },
}

export function loadAuditEvents(limit = 50) {
  try {
    const raw = localStorage.getItem(AUDIT_LOG_KEY)
    const all = raw ? JSON.parse(raw) : []
    return Array.isArray(all) ? (limit ? all.slice(0, limit) : all) : []
  } catch {
    return []
  }
}

export function loadRecentActivity(count = 10) {
  return loadAuditEvents(count)
}

export function addAuditEvent(action, details = {}) {
  const events = loadAuditEvents(AUDIT_MAX_ENTRIES)
  const entry = {
    id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    action,
    label: AUDIT_ACTIONS[action]?.label || action,
    icon: AUDIT_ACTIONS[action]?.icon || '📌',
    timestamp: new Date().toISOString(),
    ...details,
  }

  try {
    localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify([entry, ...events].slice(0, AUDIT_MAX_ENTRIES)))
  } catch {}

  if (supabase) {
    supabase.from('audit_logs').insert([{
      action,
      table_name: details.table || null,
      record_id: details.recordId || details.tripId || null,
      new_values: details.newValues || details || null,
      changed_by: details.changedBy || details.driver || null,
      changed_at: entry.timestamp,
    }]).then(({ error }) => {
      if (error && import.meta.env.DEV) console.warn('[auditLog] insert failed:', error.message)
    })
  }

  return entry
}

export function fmtAuditTime(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const mins = Math.floor((Date.now() - d.getTime()) / 60000)
    const hrs = Math.floor(mins / 60)
    const days = Math.floor(hrs / 24)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    if (hrs < 24) return `${hrs}h ago`
    if (days < 7) return `${days}d ago`
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  } catch {
    return '—'
  }
}

export function clearAuditLog() {
  try { localStorage.removeItem(AUDIT_LOG_KEY) } catch {}
}

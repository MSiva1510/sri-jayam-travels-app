// ─── Driver Status Engine ─────────────────────────────────────
// Manages live driver statuses with localStorage persistence.
// Auto-goes Offline if no GPS update in 10 minutes.

export const DRIVER_STATUS_KEY             = 'sjt_driver_statuses'
export const DRIVER_STATUS_OFFLINE_MS      = 10 * 60 * 1000   // 10 minutes

export const STATUS_CONFIG = {
  available: {
    key:   'available',
    label: 'Available',
    dot:   'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    icon:  '🟢',
  },
  driving: {
    key:   'driving',
    label: 'Driving',
    dot:   'bg-blue-500',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    icon:  '🚗',
  },
  reached_pickup: {
    key:   'reached_pickup',
    label: 'Reached Pickup',
    dot:   'bg-teal-500',
    badge: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
    icon:  '📍',
  },
  passenger_onboard: {
    key:   'passenger_onboard',
    label: 'Passenger Onboard',
    dot:   'bg-indigo-500',
    badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    icon:  '👤',
  },
  waiting: {
    key:   'waiting',
    label: 'Waiting',
    dot:   'bg-amber-500',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    icon:  '⏳',
  },
  completed: {
    key:   'completed',
    label: 'Completed',
    dot:   'bg-violet-500',
    badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    icon:  '✅',
  },
  offline: {
    key:   'offline',
    label: 'Offline',
    dot:   'bg-slate-400',
    badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    icon:  '⚫',
  },
}

// ── Ride-state → driver-status mapping ───────────────────────
export function getStatusFromRideState(rideState) {
  const map = {
    started:   'driving',
    paused:    'waiting',
    resumed:   'driving',
    completed: 'available',
    cancelled: 'available',
  }
  return map[rideState] || null
}

// ── Persistence ───────────────────────────────────────────────
export function loadDriverStatuses() {
  try {
    const raw = localStorage.getItem(DRIVER_STATUS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function saveDriverStatus(driverName, status, area = null) {
  if (!driverName) return
  const all = loadDriverStatuses()
  all[driverName] = { status, area, updatedAt: new Date().toISOString() }
  try { localStorage.setItem(DRIVER_STATUS_KEY, JSON.stringify(all)) } catch {}
}

export function getDriverStatus(driverName) {
  if (!driverName) return 'offline'
  const all   = loadDriverStatuses()
  const entry = all[driverName]
  if (!entry) return 'offline'
  // Auto-offline after 10 minutes with no update
  if (entry.updatedAt) {
    const elapsed = Date.now() - new Date(entry.updatedAt).getTime()
    if (elapsed > DRIVER_STATUS_OFFLINE_MS) return 'offline'
  }
  return entry.status || 'offline'
}

export function getDriverStatusEntry(driverName) {
  const all = loadDriverStatuses()
  return all[driverName] || { status: 'offline', area: null, updatedAt: null }
}

export function clearDriverStatus(driverName) {
  const all = loadDriverStatuses()
  delete all[driverName]
  try { localStorage.setItem(DRIVER_STATUS_KEY, JSON.stringify(all)) } catch {}
}

export function getStatusCfg(statusKey) {
  return STATUS_CONFIG[statusKey] || STATUS_CONFIG.offline
}

// ─── Vehicle Status Engine ────────────────────────────────────
// Tracks live vehicle status (In Use / Available / Maintenance / Idle)
// Mirrors driverStatusData.js — keeps vehicle state in its own
// localStorage key so Dashboard/LiveFleetBoard/Vehicles page can
// all read a single source of truth for "is this vehicle busy".

export const VEHICLE_STATUS_KEY = 'sjt_vehicle_statuses'

export const VEHICLE_STATUS_CONFIG = {
  available: {
    key:   'available',
    label: 'Available',
    dot:   'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  in_use: {
    key:   'in_use',
    label: 'In Use',
    dot:   'bg-blue-500',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  maintenance: {
    key:   'maintenance',
    label: 'Maintenance',
    dot:   'bg-amber-500',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  idle: {
    key:   'idle',
    label: 'Idle',
    dot:   'bg-slate-400',
    badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  },
}

// ── Persistence ───────────────────────────────────────────────
export function loadVehicleStatuses() {
  try {
    const raw = localStorage.getItem(VEHICLE_STATUS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

// area/driverName optional context for idle-location display
export function saveVehicleStatus(vehicleReg, status, area = null, driverName = null) {
  if (!vehicleReg) return
  const all = loadVehicleStatuses()
  all[vehicleReg] = {
    status,
    area,
    driver:    driverName,
    updatedAt: new Date().toISOString(),
  }
  try { localStorage.setItem(VEHICLE_STATUS_KEY, JSON.stringify(all)) } catch {}
}

export function getVehicleStatus(vehicleReg) {
  if (!vehicleReg) return 'idle'
  const all = loadVehicleStatuses()
  return all[vehicleReg]?.status || 'idle'
}

export function getVehicleStatusEntry(vehicleReg) {
  const all = loadVehicleStatuses()
  return all[vehicleReg] || { status: 'idle', area: null, driver: null, updatedAt: null }
}

export function clearVehicleStatus(vehicleReg) {
  const all = loadVehicleStatuses()
  delete all[vehicleReg]
  try { localStorage.setItem(VEHICLE_STATUS_KEY, JSON.stringify(all)) } catch {}
}

export function getVehicleStatusCfg(statusKey) {
  return VEHICLE_STATUS_CONFIG[statusKey] || VEHICLE_STATUS_CONFIG.idle
}

// ── Mark vehicle in_use when trip starts, available when trip ends ─
export function markVehicleInUse(vehicleReg, driverName, area = null) {
  saveVehicleStatus(vehicleReg, 'in_use', area, driverName)
}

export function markVehicleAvailable(vehicleReg, area = null) {
  saveVehicleStatus(vehicleReg, 'available', area, null)
}

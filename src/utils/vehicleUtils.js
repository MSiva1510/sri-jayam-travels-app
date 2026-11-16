// ─── Vehicle Utility Functions ────────────────────────────────
// Extracted from pages/Vehicles.jsx so data modules and other
// pages can import these without pulling in a page component.

const _today = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function docStatus(expiryDateStr) {
  if (!expiryDateStr) return {
    key: 'unknown', label: 'Unknown',
    badge: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    dot: 'bg-slate-400',
  }
  const exp  = new Date(expiryDateStr)
  const days = Math.floor((exp - _today()) / (1000 * 60 * 60 * 24))
  if (days < 0)   return { key: 'expired', label: 'Expired',       badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',             dot: 'bg-red-500',    days }
  if (days <= 30) return { key: 'soon',    label: 'Expiring Soon', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',     dot: 'bg-amber-500',  days }
  return              { key: 'active',  label: 'Active',       badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', dot: 'bg-emerald-500', days }
}

export function daysLabel(days) {
  if (days == null) return ''
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Expires today'
  return `${days}d left`
}

// ─── Normalise a `vehicles` row for the UI ────────────────────
// Supabase stores snake_case columns (registration, vehicle_type,
// current_km, insurance_expiry…) while the pages read short aliases
// (reg, type, km, insExpiry…). Normalising in the repository keeps the
// list, the detail panel and the edit form on one shape, and leaves the
// raw columns in place for anything that already reads them.
//
// `km` is the vehicle's odometer (`vehicles.current_km`). Trip distances
// are relative, so they can never stand in for an absolute odometer.
export function normalizeVehicleRow(row) {
  if (!row || typeof row !== 'object') return row
  const km = Number(row.current_km ?? row.km ?? 0)
  const currentKm = Number.isFinite(km) ? km : 0

  return {
    ...row,
    reg:          row.reg          ?? row.registration   ?? row.license_plate ?? '',
    registration: row.registration ?? row.reg            ?? row.license_plate ?? '',
    type:         row.type         ?? row.vehicle_type   ?? '',
    vehicle_type: row.vehicle_type ?? row.type           ?? '',
    km:           currentKm,
    current_km:   currentKm,
    fuel:         row.fuel         ?? row.fuel_type      ?? '',
    fuelType:     row.fuelType     ?? row.fuel_type      ?? '',
    lastServiceKm: row.lastServiceKm ?? row.last_service_km ?? '',
    insNumber:    row.insNumber    ?? row.insurance_number      ?? '',
    insExpiry:    row.insExpiry    ?? row.insurance_expiry      ?? '',
    fcExpiry:     row.fcExpiry     ?? row.fitness_cert_expiry   ?? '',
    pucExpiry:    row.pucExpiry    ?? row.pollution_cert_expiry ?? '',
  }
}

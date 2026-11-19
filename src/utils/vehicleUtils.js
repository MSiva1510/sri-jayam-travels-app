// ─── Vehicle Utility Functions ────────────────────────────────
// Extracted from pages/Vehicles.jsx so data modules and other
// pages can import these without pulling in a page component.

const _today = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// Parse a document date at *local* midnight.
// `new Date('2027-05-01')` is parsed as UTC midnight, which shifts the day
// backwards for anyone behind UTC and made the expiry count wrong there.
// Accepts `YYYY-MM-DD`, full ISO timestamps and Date objects; returns null
// for empty/unparseable input so a missing date never shows a status.
export function parseDateOnly(value) {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return new Date(value.getFullYear(), value.getMonth(), value.getDate())
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value).trim())
  if (match) {
    const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  const fallback = new Date(value)
  if (Number.isNaN(fallback.getTime())) return null
  return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate())
}

// Documents inside this window are "Expiring Soon".
export const EXPIRY_SOON_DAYS = 30

// Whole days from `today` (local midnight) to the document date, or null.
// Math.round absorbs 23/25-hour DST days.
export function daysUntil(dateStr, today = _today()) {
  const expiry = parseDateOnly(dateStr)
  if (!expiry) return null
  const base = parseDateOnly(today) || _today()
  return Math.round((expiry - base) / (1000 * 60 * 60 * 24))
}

export function docStatus(expiryDateStr) {
  const days = daysUntil(expiryDateStr)
  if (days === null) return {
    key: 'unknown', label: 'Unknown',
    badge: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    dot: 'bg-slate-400',
  }
  if (days < 0)        return { key: 'expired', label: 'Expired',       badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',             dot: 'bg-red-500',    days }
  if (days <= EXPIRY_SOON_DAYS) return { key: 'soon', label: 'Expiring Soon', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',     dot: 'bg-amber-500',  days }
  return                      { key: 'active',  label: 'Active',       badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', dot: 'bg-emerald-500', days }
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
    lastServiceDate: row.lastServiceDate ?? row.last_service_date ?? '',
    lastServiceKm: row.lastServiceKm ?? row.last_service_km ?? '',
    nextServiceDate: row.nextServiceDate ?? row.next_service_date ?? '',
    nextServiceKm: row.nextServiceKm ?? row.next_service_km ?? '',
    insProvider:  row.insProvider  ?? row.insurance_provider     ?? '',
    insNumber:    row.insNumber    ?? row.insurance_number       ?? '',
    insExpiry:    row.insExpiry    ?? row.insurance_expiry       ?? '',
    permitNumber: row.permitNumber ?? row.permit_number          ?? '',
    permitExpiry: row.permitExpiry ?? row.permit_expiry          ?? '',
    fcNumber:     row.fcNumber     ?? row.fitness_cert_number    ?? '',
    fcExpiry:     row.fcExpiry     ?? row.fitness_cert_expiry    ?? '',
    pucNumber:    row.pucNumber    ?? row.pollution_cert_number  ?? '',
    pucExpiry:    row.pucExpiry    ?? row.pollution_cert_expiry  ?? '',
  }
}

// ─── Build a `vehicles` write payload ─────────────────────────
// The form speaks camelCase, the table speaks snake_case. Before this
// existed the repository only mapped a handful of columns, so insurance,
// permit, FC, PUC and service-tracking values were silently dropped on
// Supabase saves. Keep the aliases here so every field the form edits has
// exactly one write path.

export const VEHICLE_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Columns added by supabase/migrations/20261119_vehicle_compliance_fields.sql.
// Used to retry a read/write without them when the migration has not been
// applied yet, so an un-migrated database keeps working exactly as before.
export const VEHICLE_COMPLIANCE_COLUMNS = [
  'insurance_provider', 'permit_number', 'permit_expiry',
  'fitness_cert_number', 'pollution_cert_number',
  'last_service_date', 'next_service_date', 'next_service_km',
]

// Keep the two select lists in one place so the fallback cannot drift from
// the migration. The legacy list is byte-for-byte the query used before the
// compliance redesign.
export const LEGACY_VEHICLE_SELECT_COLUMNS = 'id, vehicle_id, registration, vehicle_type, model, year, color, fuel_type, status, current_km, insurance_number, insurance_expiry, fitness_cert_expiry, pollution_cert_expiry, last_service_km, engine_number, imei, created_at, updated_at'
export const VEHICLE_SELECT_COLUMNS = 'id, vehicle_id, registration, vehicle_type, model, year, color, fuel_type, status, current_km, insurance_provider, insurance_number, insurance_expiry, permit_number, permit_expiry, fitness_cert_number, fitness_cert_expiry, pollution_cert_number, pollution_cert_expiry, last_service_date, last_service_km, next_service_date, next_service_km, engine_number, imei, created_at, updated_at'

// Supabase numeric columns reject ''; keep a real 0, drop blank/NaN input.
function toDbNumber(value) {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value === 'string' && value.trim() === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

// Supabase date columns reject ''; a cleared date should clear the column.
function toDbDate(value) {
  if (value === undefined) return undefined
  if (value === null) return null
  const text = String(value).trim()
  return text === '' ? null : text
}

// camelCase (form/local) and snake_case (Supabase row) both accepted.
export function toDbVehicle(data = {}) {
  const payload = {
    vehicle_id: data.vehicle_id || (!VEHICLE_UUID_RE.test(String(data.id || '')) ? data.id : undefined),
    registration: data.registration ?? data.reg,
    vehicle_type: data.vehicle_type ?? data.type,
    model: data.model,
    year: toDbNumber(data.year),
    color: data.color,
    fuel_type: data.fuel_type ?? data.fuel ?? data.fuelType,
    status: data.status,
    current_km: toDbNumber(data.current_km ?? data.km),
    engine_number: data.engine_number,
    imei: data.imei,
    last_service_date: toDbDate(data.last_service_date ?? data.lastServiceDate),
    last_service_km: toDbNumber(data.last_service_km ?? data.lastServiceKm),
    next_service_date: toDbDate(data.next_service_date ?? data.nextServiceDate),
    next_service_km: toDbNumber(data.next_service_km ?? data.nextServiceKm),
    insurance_provider: data.insurance_provider ?? data.insProvider,
    insurance_number: data.insurance_number ?? data.insNumber,
    insurance_expiry: toDbDate(data.insurance_expiry ?? data.insExpiry),
    permit_number: data.permit_number ?? data.permitNumber,
    permit_expiry: toDbDate(data.permit_expiry ?? data.permitExpiry),
    fitness_cert_number: data.fitness_cert_number ?? data.fcNumber,
    fitness_cert_expiry: toDbDate(data.fitness_cert_expiry ?? data.fcExpiry),
    pollution_cert_number: data.pollution_cert_number ?? data.pucNumber,
    pollution_cert_expiry: toDbDate(data.pollution_cert_expiry ?? data.pucExpiry),
    updated_at: data.updated_at ?? data.updatedAt,
  }
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined))
}

// Drop the columns from the 20261119 migration so a write can still succeed
// on a database where it has not been applied yet.
export function withoutComplianceColumns(payload = {}) {
  const next = { ...payload }
  for (const column of VEHICLE_COMPLIANCE_COLUMNS) delete next[column]
  return next
}

// Postgres 42703 = undefined column. PostgREST uses PGRST204 for the same
// problem when a column is missing from its schema cache; require a column
// message so an unrelated PGRST204 (e.g. empty update result) is not treated
// as a missing column and silently retried.
export function isMissingColumnError(error) {
  if (!error) return false
  const code = String(error.code || '')
  const message = String(error.message || '')
  const mentionsColumn = /column|schema cache/i.test(message)
  return code === '42703'
    || (code === 'PGRST204' && mentionsColumn)
    || /column\s+.*\s+does not exist/i.test(message)
}

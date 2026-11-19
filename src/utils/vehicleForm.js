// ─── Vehicle form helpers (pure) ────────────────────────────────
// Dependency-free so the defaults, sanitising, validation and save
// payload behind the premium Add/Edit Vehicle modal can be unit-tested.
// Field names, defaults, dropdown options and messages are unchanged from
// the previous inline VehicleModal in pages/Vehicles.jsx.
//
// The UI additions (expiry / service indicators) only *read* existing
// fields — no new columns, no business-logic changes.

import { daysUntil, EXPIRY_SOON_DAYS } from './vehicleUtils.js'

export { EXPIRY_SOON_DAYS }

export const VEHICLE_TYPES = ['4+1 Sedan', '7+1 SUV', 'Tempo Traveller', 'Mini Van']
export const FUEL_TYPES = ['Petrol', 'Diesel', 'CNG', 'Electric']
export const VEHICLE_STATUSES = ['active', 'maintenance', 'offline']

export const STATUS_LABELS = {
  active: 'Active',
  maintenance: 'Maintenance',
  offline: 'Offline',
}

// `softDelete()` stores `inactive`, which is not a choice for new vehicles.
// Show it as a disabled selected option when editing a legacy/inactive row so
// the value is not silently displayed as "Active" or changed on save.
export function statusOptionsFor(status) {
  const options = VEHICLE_STATUSES.map(s => ({ value: s, label: STATUS_LABELS[s] || s }))
  const value = String(status || '')
  if (!value || VEHICLE_STATUSES.includes(value)) return options
  const label = STATUS_LABELS[value] || `${value.charAt(0).toUpperCase()}${value.slice(1)}`
  return [{ value, label, disabled: true }, ...options]
}

export const REGISTRATION_MAX_LENGTH = 12
export const MODEL_MAX_LENGTH = 40
export const COLOR_MAX_LENGTH = 20
export const ODOMETER_MAX_DIGITS = 7
export const DOC_NUMBER_MAX_LENGTH = 20

export const ODOMETER_FIELDS = ['km', 'lastServiceKm', 'nextServiceKm']
export const DOC_NUMBER_FIELDS = ['insNumber', 'permitNumber', 'fcNumber', 'pucNumber']
export const REQUIRED_FIELDS = ['reg', 'model']

const defaultYear = () => new Date().getFullYear()

// Original create-mode defaults (year defaults to the current year,
// colour to White, type to 4+1 Sedan, fuel to Petrol, status to active).
export function createEmptyVehicle(year = defaultYear()) {
  return {
    id: null, reg: '', type: '4+1 Sedan', model: '', year,
    km: 0, status: 'active', fuelType: 'Petrol', color: 'White', driver: '',
    lastServiceDate: '', lastServiceKm: '', nextServiceDate: '', nextServiceKm: '',
    insProvider: '', insNumber: '', insExpiry: '',
    permitNumber: '', permitExpiry: '',
    fcNumber: '', fcExpiry: '',
    pucNumber: '', pucExpiry: '',
  }
}

// Edit mode used `{ ...vehicle }`. Keep every raw column (so an update still
// round-trips data this form does not know about) and then fill the aliases
// the inputs bind to: short camelCase first, DB snake_case second.
export function vehicleToForm(vehicle, year = defaultYear()) {
  if (!vehicle || typeof vehicle !== 'object') return createEmptyVehicle(year)
  return {
    ...createEmptyVehicle(year),
    ...vehicle,
    reg: vehicle.reg ?? vehicle.registration ?? vehicle.license_plate ?? '',
    type: vehicle.type ?? vehicle.vehicle_type ?? '4+1 Sedan',
    km: vehicle.km ?? vehicle.current_km ?? 0,
    fuelType: vehicle.fuelType ?? vehicle.fuel_type ?? vehicle.fuel ?? 'Petrol',
    color: vehicle.color ?? 'White',
    year: vehicle.year ?? year,
    status: vehicle.status ?? 'active',
    insNumber: vehicle.insNumber ?? vehicle.insurance_number ?? '',
    insExpiry: vehicle.insExpiry ?? vehicle.insurance_expiry ?? '',
    fcExpiry: vehicle.fcExpiry ?? vehicle.fitness_cert_expiry ?? '',
    pucExpiry: vehicle.pucExpiry ?? vehicle.pollution_cert_expiry ?? '',
    lastServiceKm: vehicle.lastServiceKm ?? vehicle.last_service_km ?? '',
  }
}

// Same per-field guards the old inline VField applied on every keystroke.
export function sanitizeVehicleField(field, value) {
  let v = value == null ? '' : String(value)
  if (field === 'reg') {
    v = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, REGISTRATION_MAX_LENGTH)
  }
  if (field === 'model') {
    v = v.slice(0, MODEL_MAX_LENGTH)
  }
  if (field === 'color') {
    v = v.replace(/[^a-zA-Z\s]/g, '').slice(0, COLOR_MAX_LENGTH)
  }
  if (field === 'year') {
    v = v.replace(/\D/g, '').slice(0, 4)
  }
  if (ODOMETER_FIELDS.includes(field)) {
    v = v.replace(/\D/g, '').slice(0, ODOMETER_MAX_DIGITS)
  }
  if (DOC_NUMBER_FIELDS.includes(field)) {
    v = v.toUpperCase().replace(/[^A-Z0-9\-/]/g, '').slice(0, DOC_NUMBER_MAX_LENGTH)
  }
  return v
}

// Registration and model are the two fields the original UI marked
// `required`; saving stays blocked until both are present.
export function validateVehicleForm(form = {}) {
  const errors = {}
  if (!String(form.reg || '').trim()) errors.reg = 'Required'
  if (!String(form.model || '').trim()) errors.model = 'Required'
  return errors
}

export function isVehicleFormReady(form = {}) {
  return REQUIRED_FIELDS.every(field => String(form[field] || '').trim())
}

// The repository already whitelists columns (`toDbVehicle`), so the modal
// hands it the same form object the inline component did.
export function buildVehicleInput(form = {}) {
  return { ...form }
}

function toNumberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

// Read-only service indicator derived from the fields already in the form.
// Overdue = next-service date in the past, or next-service odometer at/below
// the current odometer. Never invents a service record.
export function serviceStatus(form = {}, today) {
  const days = daysUntil(form.nextServiceDate, today)
  const nextKm = toNumberOrNull(form.nextServiceKm)
  const currentKm = toNumberOrNull(form.km)
  const kmDue = nextKm !== null && currentKm !== null && nextKm <= currentKm

  if (days === null && nextKm === null) return { key: 'unknown', days: null, kmDue: false }
  if ((days !== null && days < 0) || kmDue) return { key: 'overdue', days, kmDue }
  if (days !== null && days <= EXPIRY_SOON_DAYS) return { key: 'due-soon', days, kmDue }
  return { key: 'on-track', days, kmDue }
}

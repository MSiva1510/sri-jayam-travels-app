// Pins the pure helpers behind the premium Add/Edit Vehicle modal: the
// original field names, defaults, dropdown options, per-keystroke guards,
// validation messages, derived expiry/service indicators and the payload
// handed to vehicleRepository.

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createEmptyVehicle, vehicleToForm, sanitizeVehicleField, validateVehicleForm,
  isVehicleFormReady, buildVehicleInput, serviceStatus,
  VEHICLE_TYPES, FUEL_TYPES, VEHICLE_STATUSES, STATUS_LABELS,
  REGISTRATION_MAX_LENGTH, MODEL_MAX_LENGTH, DOC_NUMBER_MAX_LENGTH,
} from '../src/utils/vehicleForm.js'
import { docStatus, daysUntil, daysLabel, parseDateOnly, EXPIRY_SOON_DAYS } from '../src/utils/vehicleUtils.js'

const YEAR = 2026

const isoDate = date => {
  const pad = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const localDay = offset => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offset)
  return d
}

test('create defaults preserve the original vehicle field names and values', () => {
  const empty = createEmptyVehicle(YEAR)
  for (const key of [
    'reg', 'type', 'model', 'year', 'km', 'status', 'fuelType', 'color',
    'driver', 'lastServiceDate', 'lastServiceKm', 'nextServiceDate',
    'nextServiceKm', 'insProvider', 'insNumber', 'insExpiry', 'permitNumber',
    'permitExpiry', 'fcNumber', 'fcExpiry', 'pucNumber', 'pucExpiry',
  ]) {
    assert.ok(key in empty, `missing default key ${key}`)
  }
  assert.equal(empty.id, null)
  assert.equal(empty.reg, '')
  assert.equal(empty.type, '4+1 Sedan')
  assert.equal(empty.year, YEAR)
  assert.equal(empty.km, 0)
  assert.equal(empty.status, 'active')
  assert.equal(empty.fuelType, 'Petrol')
  assert.equal(empty.color, 'White')
})

test('default year follows the current year when not provided', () => {
  assert.equal(createEmptyVehicle().year, new Date().getFullYear())
})

test('vehicleToForm reads short aliases and DB snake_case columns', () => {
  const form = vehicleToForm({
    id: 'b7611d3d-f028-4d88-a829-cb7489d41d79',
    vehicle_id: 'VEH-101',
    registration: 'PY01CY1255',
    vehicle_type: 'sedan',
    model: 'Dzire',
    current_km: 150734,
    fuel_type: 'Diesel',
    insurance_number: 'TATA-AIG-PY01CY1255-2026',
    insurance_expiry: '2027-03-15',
    fitness_cert_expiry: '2029-06-10',
    pollution_cert_expiry: '2026-12-20',
    last_service_km: 0,
  }, YEAR)

  assert.equal(form.reg, 'PY01CY1255')
  assert.equal(form.type, 'sedan')
  assert.equal(form.km, 150734)
  assert.equal(form.fuelType, 'Diesel')
  assert.equal(form.insNumber, 'TATA-AIG-PY01CY1255-2026')
  assert.equal(form.insExpiry, '2027-03-15')
  assert.equal(form.fcExpiry, '2029-06-10')
  assert.equal(form.pucExpiry, '2026-12-20')
  assert.equal(form.lastServiceKm, 0)
  // Raw columns survive so an update still round-trips them.
  assert.equal(form.vehicle_id, 'VEH-101')
  // Untouched fields fall back to create defaults.
  assert.equal(form.color, 'White')
  assert.equal(form.permitNumber, '')
})

test('vehicleToForm prefers camelCase over snake_case and survives no vehicle', () => {
  const form = vehicleToForm({ reg: 'TN01AB1234', registration: 'OLD', km: 10, current_km: 99 }, YEAR)
  assert.equal(form.reg, 'TN01AB1234')
  assert.equal(form.km, 10)

  assert.deepEqual(vehicleToForm(null, YEAR), createEmptyVehicle(YEAR))
  assert.deepEqual(vehicleToForm(undefined, YEAR), createEmptyVehicle(YEAR))
})

test('sanitizeVehicleField keeps the original per-keystroke guards', () => {
  assert.equal(sanitizeVehicleField('reg', 'py 01-ab!1234xyz'), 'PY01AB1234XY')
  assert.equal(sanitizeVehicleField('reg', 'ABCDEFGHIJKLMNOP').length, REGISTRATION_MAX_LENGTH)
  assert.equal(sanitizeVehicleField('model', 'x'.repeat(50)).length, MODEL_MAX_LENGTH)
  assert.equal(sanitizeVehicleField('color', 'Pearl White 2'), 'Pearl White ')
  assert.equal(sanitizeVehicleField('year', '20a26x'), '2026')
  assert.equal(sanitizeVehicleField('km', '12,345km'), '12345')
  assert.equal(sanitizeVehicleField('nextServiceKm', '00123456789'), '0012345')
  assert.equal(sanitizeVehicleField('insNumber', 'tata/aig-1234!'), 'TATA/AIG-1234')
  assert.equal(sanitizeVehicleField('pucNumber', 'x'.repeat(40)).length, DOC_NUMBER_MAX_LENGTH)
  // Values the guards do not own pass through untouched.
  assert.equal(sanitizeVehicleField('type', '7+1 SUV'), '7+1 SUV')
  assert.equal(sanitizeVehicleField('insProvider', 'TATA AIG'), 'TATA AIG')
  assert.equal(sanitizeVehicleField('km', null), '')
})

test('dropdown options and status labels are unchanged', () => {
  assert.deepEqual(VEHICLE_TYPES, ['4+1 Sedan', '7+1 SUV', 'Tempo Traveller', 'Mini Van'])
  assert.deepEqual(FUEL_TYPES, ['Petrol', 'Diesel', 'CNG', 'Electric'])
  assert.deepEqual(VEHICLE_STATUSES, ['active', 'maintenance', 'offline'])
  assert.deepEqual(STATUS_LABELS, { active: 'Active', maintenance: 'Maintenance', offline: 'Offline' })
})

test('validateVehicleForm requires registration and model', () => {
  assert.deepEqual(validateVehicleForm(createEmptyVehicle(YEAR)), { reg: 'Required', model: 'Required' })
  assert.deepEqual(
    validateVehicleForm({ ...createEmptyVehicle(YEAR), reg: 'PY01AB1234' }),
    { model: 'Required' }
  )
  assert.deepEqual(
    validateVehicleForm({ ...createEmptyVehicle(YEAR), reg: 'PY01AB1234', model: 'Dzire' }),
    {}
  )
  assert.deepEqual(
    validateVehicleForm({ ...createEmptyVehicle(YEAR), reg: '   ', model: '   ' }),
    { reg: 'Required', model: 'Required' }
  )
})

test('isVehicleFormReady gates the primary button', () => {
  assert.equal(isVehicleFormReady(createEmptyVehicle(YEAR)), false)
  assert.equal(isVehicleFormReady({ ...createEmptyVehicle(YEAR), reg: 'PY01AB1234' }), false)
  assert.equal(isVehicleFormReady({ ...createEmptyVehicle(YEAR), reg: 'PY01AB1234', model: 'Dzire' }), true)
})

test('buildVehicleInput returns the same form the repository received before', () => {
  const form = {
    ...createEmptyVehicle(YEAR),
    id: 'VEH-1700000000000',
    reg: 'PY01AB1234',
    model: 'Dzire',
    km: '150000',
    insExpiry: '2027-03-15',
  }
  const payload = buildVehicleInput(form)

  assert.deepEqual(payload, form)
  assert.notEqual(payload, form) // new object, form state is not mutated
  assert.ok('insProvider' in payload)
  assert.ok('permitNumber' in payload)
  assert.equal(payload.id, 'VEH-1700000000000')
})

test('serviceStatus flags an overdue date or odometer without inventing data', () => {
  const base = createEmptyVehicle(YEAR)

  assert.equal(serviceStatus(base).key, 'unknown')

  assert.equal(serviceStatus({
    ...base, km: 50000, nextServiceDate: isoDate(localDay(-3)),
  }).key, 'overdue')

  assert.equal(serviceStatus({
    ...base, km: 50000, nextServiceKm: 50000,
  }).key, 'overdue')

  assert.equal(serviceStatus({
    ...base, km: 50000, nextServiceKm: 45000,
  }).key, 'overdue')

  assert.equal(serviceStatus({
    ...base, nextServiceDate: isoDate(localDay(EXPIRY_SOON_DAYS)),
  }).key, 'due-soon')

  assert.equal(serviceStatus({
    ...base, km: 50000, nextServiceKm: 55000, nextServiceDate: isoDate(localDay(90)),
  }).key, 'on-track')

  // A blank odometer must not be coerced to 0 and flagged overdue.
  assert.equal(serviceStatus({
    ...base, km: '', nextServiceKm: '',
  }).key, 'unknown')
})

test('parseDateOnly treats YYYY-MM-DD as a local date', () => {
  const parsed = parseDateOnly('2027-05-01')
  assert.equal(parsed.getFullYear(), 2027)
  assert.equal(parsed.getMonth(), 4)
  assert.equal(parsed.getDate(), 1)
  assert.equal(parsed.getHours(), 0)
  assert.equal(parseDateOnly(''), null)
  assert.equal(parseDateOnly(null), null)
  assert.equal(parseDateOnly('not-a-date'), null)
})

test('daysUntil is timezone-safe across month and DST boundaries', () => {
  assert.equal(daysUntil('2026-03-01', new Date(2026, 1, 28)), 1)
  assert.equal(daysUntil('2026-12-01', new Date(2026, 10, 19)), 12)
  assert.equal(daysUntil('2026-11-19', new Date(2026, 10, 19)), 0)
  assert.equal(daysUntil('2026-11-18', new Date(2026, 10, 19)), -1)
  assert.equal(daysUntil('', new Date(2026, 10, 19)), null)
})

test('docStatus only reports a status when a real date is present', () => {
  assert.equal(docStatus('').key, 'unknown')
  assert.equal(docStatus(null).key, 'unknown')
  assert.equal(docStatus('garbage').key, 'unknown')

  assert.equal(docStatus(isoDate(localDay(-1))).key, 'expired')
  assert.equal(docStatus(isoDate(localDay(0))).key, 'soon')
  assert.equal(docStatus(isoDate(localDay(EXPIRY_SOON_DAYS))).key, 'soon')
  assert.equal(docStatus(isoDate(localDay(EXPIRY_SOON_DAYS + 1))).key, 'active')

  assert.equal(daysLabel(-4), '4d overdue')
  assert.equal(daysLabel(0), 'Expires today')
  assert.equal(daysLabel(7), '7d left')
  assert.equal(daysLabel(null), '')
})

// Pins the vehicles-row shape the UI relies on: Supabase columns are
// snake_case, the pages read short aliases (reg / type / km / insExpiry).

import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeVehicleRow } from '../src/utils/vehicleUtils.js'

const row = {
  id: 'b7611d3d-f028-4d88-a829-cb7489d41d79',
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
}

test('current_km is exposed as km (the table reads v.km)', () => {
  const v = normalizeVehicleRow(row)
  assert.equal(v.km, 150734)
  assert.equal(v.current_km, 150734)
})

test('registration and vehicle_type gain the short aliases', () => {
  const v = normalizeVehicleRow(row)
  assert.equal(v.reg, 'PY01CY1255')
  assert.equal(v.registration, 'PY01CY1255')
  assert.equal(v.type, 'sedan')
  assert.equal(v.vehicle_type, 'sedan')
})

test('a missing odometer is 0, never NaN', () => {
  assert.equal(normalizeVehicleRow({ registration: 'X' }).km, 0)
  assert.equal(normalizeVehicleRow({ registration: 'X', current_km: null }).km, 0)
})

test('numeric strings from PostgREST are converted', () => {
  assert.equal(normalizeVehicleRow({ current_km: '42150' }).km, 42150)
})

test('document columns map to the fields the detail panel renders', () => {
  const v = normalizeVehicleRow(row)
  assert.equal(v.insNumber, 'TATA-AIG-PY01CY1255-2026')
  assert.equal(v.insExpiry, '2027-03-15')
  assert.equal(v.fcExpiry, '2029-06-10')
  assert.equal(v.pucExpiry, '2026-12-20')
})

test('existing camelCase values win over column defaults', () => {
  const v = normalizeVehicleRow({ reg: 'AA01AA0001', km: 12, current_km: 99 })
  assert.equal(v.reg, 'AA01AA0001')
  assert.equal(v.km, 99)          // current_km is the source of truth
  assert.equal(v.registration, 'AA01AA0001')
})

test('compliance columns from the 20261119 migration gain form aliases', () => {
  const v = normalizeVehicleRow({
    insurance_provider: 'TATA AIG',
    permit_number: 'KL/1',
    permit_expiry: '2027-06-30',
    fitness_cert_number: 'FC-1',
    pollution_cert_number: 'PUC-1',
    last_service_date: '2026-09-01',
    next_service_date: '2026-12-01',
    next_service_km: 55000,
  })
  assert.equal(v.insProvider, 'TATA AIG')
  assert.equal(v.permitNumber, 'KL/1')
  assert.equal(v.permitExpiry, '2027-06-30')
  assert.equal(v.fcNumber, 'FC-1')
  assert.equal(v.pucNumber, 'PUC-1')
  assert.equal(v.lastServiceDate, '2026-09-01')
  assert.equal(v.nextServiceDate, '2026-12-01')
  assert.equal(v.nextServiceKm, 55000)
})

test('null / undefined rows pass through untouched', () => {
  assert.equal(normalizeVehicleRow(null), null)
  assert.equal(normalizeVehicleRow(undefined), undefined)
})

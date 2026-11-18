// Pins the expense repository aliases for the type-specific detail columns
// added by 20261118_expense_type_details.sql. These fields used to be dropped
// by the toDbExpense() whitelist; they must now round-trip in both directions.

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  toDbExpense, normalizeExpense, EXPENSE_SELECT,
} from '../src/utils/expenseMapping.js'

const DETAIL_COLUMNS = [
  'parking_location', 'parking_duration', 'toll_name', 'toll_route',
  'bata_driver', 'bata_trip', 'maintenance_vendor', 'maintenance_invoice',
]

test('expense SELECT includes every type-specific detail column', () => {
  for (const column of DETAIL_COLUMNS) {
    assert.ok(EXPENSE_SELECT.includes(column), `missing ${column} in SELECT`)
  }
  assert.ok(EXPENSE_SELECT.includes('odometer_km'))
  assert.ok(EXPENSE_SELECT.includes('receipt_url'))
})

test('toDbExpense maps all camelCase detail fields to DB columns', () => {
  const db = toDbExpense({
    type: 'parking',
    parkingLocation: 'Airport',
    parkingDuration: '3.5',
    tollName: 'Tindivanam Toll',
    tollRoute: 'ECR Chennai',
    bataDriver: 'Ravi',
    bataTrip: 'BK-1001',
    maintenanceVendor: 'Jayam Workshop',
    maintenanceInvoice: 'INV-42',
  })

  assert.equal(db.parking_location, 'Airport')
  assert.equal(db.parking_duration, '3.5')
  assert.equal(db.toll_name, 'Tindivanam Toll')
  assert.equal(db.toll_route, 'ECR Chennai')
  assert.equal(db.bata_driver, 'Ravi')
  assert.equal(db.bata_trip, 'BK-1001')
  assert.equal(db.maintenance_vendor, 'Jayam Workshop')
  assert.equal(db.maintenance_invoice, 'INV-42')
  assert.equal(db.type, 'parking')
})

test('toDbExpense still accepts snake_case and drops undefined detail fields', () => {
  const db = toDbExpense({
    toll_name: 'Already snake case',
    parking_duration: undefined,
    unknown_field: 'ignored',
  })

  assert.equal(db.toll_name, 'Already snake case')
  assert.equal('parking_duration' in db, false)
  assert.equal('unknown_field' in db, false)
})

test('normalizeExpense exposes DB detail columns as camelCase aliases', () => {
  const ui = normalizeExpense({
    id: 'expense-1',
    parking_location: 'Mall',
    parking_duration: 2,
    toll_name: 'Toll Plaza',
    toll_route: 'NH48',
    bata_driver: 'Kumar',
    bata_trip: 'BK-2002',
    maintenance_vendor: 'Service Centre',
    maintenance_invoice: 'INV-99',
  })

  assert.equal(ui.parkingLocation, 'Mall')
  assert.equal(ui.parkingDuration, 2)
  assert.equal(ui.tollName, 'Toll Plaza')
  assert.equal(ui.tollRoute, 'NH48')
  assert.equal(ui.bataDriver, 'Kumar')
  assert.equal(ui.bataTrip, 'BK-2002')
  assert.equal(ui.maintenanceVendor, 'Service Centre')
  assert.equal(ui.maintenanceInvoice, 'INV-99')
})

test('normalizeExpense preserves existing camelCase detail values', () => {
  const ui = normalizeExpense({
    parkingLocation: 'Already UI',
    tollName: 'UI Toll',
    maintenanceVendor: 'UI Vendor',
  })

  assert.equal(ui.parkingLocation, 'Already UI')
  assert.equal(ui.tollName, 'UI Toll')
  assert.equal(ui.maintenanceVendor, 'UI Vendor')
})

// Pins the pure helpers behind the premium Create Booking form:
// existing payload shape/coercion must stay identical, every dynamic
// schedule field must map to an existing booking column, and validation
// must keep the original required fields.

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BOOKING_FORM_DEFAULTS, AMOUNT_FIELDS, scheduleFieldsFor,
  validateBookingForm, buildBookingPayload, pricingBreakdown, formatINR, toAmount,
} from '../src/utils/bookingForm.js'

test('defaults keep the existing booking field names and draft status', () => {
  assert.equal(BOOKING_FORM_DEFAULTS.type, 'one_way')
  assert.equal(BOOKING_FORM_DEFAULTS.status, 'draft')
  for (const key of ['customer', 'contact', 'pickup', 'drop', 'startDate', 'startTime',
    'returnDate', 'returnTime', 'notes', 'fare', 'bata', 'driverAllowance']) {
    assert.ok(key in BOOKING_FORM_DEFAULTS, `missing ${key}`)
  }
  assert.deepEqual(AMOUNT_FIELDS, ['fare', 'driverAllowance', 'bata'])
})

test('every schedule field maps to an existing Supabase-backed booking field', () => {
  const allowed = new Set(['startDate', 'startTime', 'returnDate', 'returnTime'])
  for (const type of ['one_way', 'round_trip', 'local_visit', 'multi_day',
    'rental_with_driver', 'self_drive']) {
    const fields = scheduleFieldsFor(type)
    assert.ok(fields.length > 0, `${type} has no schedule fields`)
    for (const f of fields) {
      assert.ok(allowed.has(f.key), `${type} invented field ${f.key}`)
      assert.ok(['date', 'time'].includes(f.inputType))
    }
    assert.ok(fields.some(f => f.required), `${type} has no required date`)
  }
  assert.deepEqual(scheduleFieldsFor('unknown'), scheduleFieldsFor('one_way'))
})

test('validation keeps original required fields and adds safe checks', () => {
  assert.deepEqual(validateBookingForm(BOOKING_FORM_DEFAULTS), {
    customer: 'Customer name is required',
    pickup: 'Pickup location is required',
    startDate: 'Pickup date is required',
  })
  const valid = {
    ...BOOKING_FORM_DEFAULTS,
    customer: 'Kalidass', pickup: 'Puducherry', startDate: '2026-11-18',
  }
  assert.deepEqual(validateBookingForm(valid), {})
  assert.ok(validateBookingForm({ ...valid, contact: '123' }).contact)
  assert.ok(validateBookingForm({ ...valid, returnDate: '2026-11-01' }).returnDate)
})

test('payload coercion matches the previous booking save behaviour exactly', () => {
  const payload = buildBookingPayload(
    { ...BOOKING_FORM_DEFAULTS, fare: '4500', bata: '', driverAllowance: '1000' },
    { userName: 'Siva', now: '2026-11-18T10:00:00.000Z', newId: 'id-1', newBookingNo: 'BK-26-11-0001' }
  )
  assert.equal(payload.id, 'id-1')
  assert.equal(payload.bookingNo, 'BK-26-11-0001')
  assert.equal(payload.fare, 4500)
  assert.equal(payload.bata, 0)
  assert.equal(payload.driverAllowance, 1000)
  assert.equal(payload.createdAt, '2026-11-18T10:00:00.000Z')
  assert.equal(payload.updatedAt, '2026-11-18T10:00:00.000Z')
  assert.equal(payload.createdBy, 'Siva')
  assert.equal(payload.driver, null)
  assert.equal(payload.vehicle, null)
})

test('existing edit values are preserved instead of regenerated', () => {
  const payload = buildBookingPayload(
    { id: 'keep-id', bookingNo: 'FY26-NOV-0054', createdAt: 'old', createdBy: 'admin',
      fare: 0, bata: 0, driverAllowance: 0 },
    { userName: 'manager', now: 'now', newId: 'other', newBookingNo: 'other' }
  )
  assert.equal(payload.id, 'keep-id')
  assert.equal(payload.bookingNo, 'FY26-NOV-0054')
  assert.equal(payload.createdAt, 'old')
  assert.equal(payload.createdBy, 'admin')
})

test('amounts stay independent — no fare/allowance/bata arithmetic is implied', () => {
  assert.deepEqual(pricingBreakdown({ fare: '4500', bata: '500', driverAllowance: '1000' }), {
    fare: 4500, driverAllowance: 1000, bata: 500,
  })
  assert.equal(pricingBreakdown({ fare: 'x', bata: undefined }).fare, 0)
  assert.equal(toAmount(null), 0)
  assert.equal(formatINR(4500), '₹4,500')
})

// Pins the pure helpers behind the premium Add/Edit Customer modal:
// field names, Tamil Nadu default, validation rules, type values and the
// exact payload shape handed to the existing saveCustomer() path.

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  EMPTY_CUSTOMER, FIELD_RESTRICTIONS,
  sanitizeField, validateCustomerForm, buildCustomerPayload, isBusinessCustomer,
} from '../src/utils/customerForm.js'

const VALID = {
  ...EMPTY_CUSTOMER,
  name: 'Sri Jayam Travels',
  mobile: '9876543210',
}

test('defaults preserve original customer field names and Tamil Nadu state', () => {
  for (const key of [
    'id', 'type', 'status', 'name', 'mobile', 'altMobile', 'email',
    'address', 'city', 'state', 'gst', 'companyName', 'contactPerson',
    'billingAddress', 'notes', 'isVip', 'isBlacklisted', 'isFrequentTraveller',
    'emergencyName', 'emergencyContact',
  ]) {
    assert.ok(key in EMPTY_CUSTOMER, `missing ${key}`)
  }
  assert.equal(EMPTY_CUSTOMER.state, 'Tamil Nadu')
  assert.equal(EMPTY_CUSTOMER.type, 'individual')
  assert.equal(EMPTY_CUSTOMER.status, 'active')
})

test('required validation keeps name and 10-digit mobile rules', () => {
  assert.deepEqual(validateCustomerForm(EMPTY_CUSTOMER), {
    name: 'Customer name is required',
    mobile: 'Mobile number is required',
  })
  assert.equal(validateCustomerForm({ ...VALID, name: 'A' }).name,
    'Name must be at least 2 characters')
  assert.equal(validateCustomerForm({ ...VALID, mobile: '12345' }).mobile,
    'Mobile must be exactly 10 digits')
  assert.equal(validateCustomerForm({ ...VALID, mobile: 'abcdefghij' }).mobile,
    'Mobile must contain only numbers')
})

test('optional fields validate only when supplied', () => {
  assert.deepEqual(validateCustomerForm(VALID), {})

  assert.equal(validateCustomerForm({ ...VALID, altMobile: '123' }).altMobile,
    'Alternate mobile must be 10 digits')
  assert.equal(validateCustomerForm({ ...VALID, altMobile: 'abcdefghij' }).altMobile,
    'Must contain only numbers')
  assert.equal(validateCustomerForm({ ...VALID, email: 'not-an-email' }).email,
    'Please enter a valid email address')
  assert.equal(validateCustomerForm({ ...VALID, gst: 'SHORT' }).gst,
    'GST must be exactly 15 characters')
  assert.equal(validateCustomerForm({ ...VALID, gst: '29AAACM0000A1Z!' }).gst,
    'GST must be 15 alphanumeric characters (e.g., 29AAACM0000A1Z5)')
})

test('customer type values stay compatible with the existing filter and DB mapping', () => {
  assert.equal(isBusinessCustomer('corporate'), true)
  assert.equal(isBusinessCustomer('agent'), true)
  assert.equal(isBusinessCustomer('individual'), false)
})

test('sanitizers keep original input restrictions and the requested notes placeholder', () => {
  assert.equal(sanitizeField('mobile', '98a76-543210'), '98765432')
  assert.equal(sanitizeField('altMobile', '98765x43210'), '987654321')
  assert.equal(sanitizeField('gst', '29aaacm0000a1z5'), '29AAACM0000A1Z5')
  assert.equal(sanitizeField('name', 'Ravi 123'), 'Ravi ')
  assert.equal(sanitizeField('notes', 'x'.repeat(350)).length, 300)
  assert.equal(FIELD_RESTRICTIONS.notes.placeholder,
    'Preferred driver, vehicle preferences, payment terms...')
})

test('payload keeps all flags and customer fields, only adding id and timestamps', () => {
  const form = {
    ...VALID,
    id: 'CUS-123456',
    type: 'corporate',
    companyName: 'Jayam Tours',
    isVip: true,
    isFrequentTraveller: true,
    isBlacklisted: false,
    emergencyName: 'Anand',
    emergencyContact: '9123456780',
    createdAt: '2026-01-01T00:00:00.000Z',
  }
  const payload = buildCustomerPayload(form, {
    now: '2026-11-18T10:00:00.000Z',
    newId: 'CUS-IGNORED',
  })

  assert.equal(payload.id, 'CUS-123456')
  assert.equal(payload.createdAt, '2026-01-01T00:00:00.000Z')
  assert.equal(payload.updatedAt, '2026-11-18T10:00:00.000Z')
  for (const key of [
    'name', 'mobile', 'altMobile', 'email', 'address', 'city', 'state',
    'gst', 'companyName', 'contactPerson', 'billingAddress', 'notes',
    'isVip', 'isFrequentTraveller', 'isBlacklisted',
    'emergencyName', 'emergencyContact',
  ]) {
    assert.deepEqual(payload[key], form[key], `payload changed ${key}`)
  }

  const fresh = buildCustomerPayload(VALID, { now: 'now', newId: 'CUS-NEW' })
  assert.equal(fresh.id, 'CUS-NEW')
  assert.equal(fresh.createdAt, 'now')
})

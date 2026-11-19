// Pins the pure helpers behind the premium Add/Edit Driver modal: original
// field names, defaults, validation messages, licence limits and the exact
// payload shape handed to the existing driverRepository / authRepository path.

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createEmptyDriver, driverToForm, validateDriverForm, validateLicenceFile,
  buildDriverPayload, MOBILE_LENGTH, MIN_PASSWORD_LENGTH, LICENCE_MAX_BYTES,
} from '../src/utils/driverForm.js'

const TODAY = '2026-11-19'

test('create defaults preserve the original driver field names and values', () => {
  const empty = createEmptyDriver(TODAY)
  for (const key of [
    'name', 'mobile', 'vehicle', 'license', 'vehicleType', 'joined', 'status',
    'rating', 'licenseExpiry', 'badge', 'medicalExpiry', 'bankName', 'accountNo',
    'ifscCode', 'emergencyName', 'emergencyContact', 'email', 'password',
    'createLogin',
  ]) {
    assert.ok(key in empty, `missing default key ${key}`)
  }
  assert.equal(empty.joined, TODAY)
  assert.equal(empty.status, 'active')
  assert.equal(empty.rating, 4.5)
  assert.equal(empty.createLogin, true)
  assert.equal(empty.name, '')
})

test('driverToForm reads both camelCase and DB snake_case aliases', () => {
  const form = driverToForm({
    id: 'driver-1',
    name: 'Ravi Kumar',
    phone: '9000000001',
    license_number: 'TN1234567890',
    joined_date: '2024-05-01',
    license_expiry: '2027-05-01',
    medical_expiry: '2027-01-01',
    bank_name: 'State Bank of India',
    emergency_contact: '9000000099',
    vehicle: 'PY01XX1234',
    badge: 'BADGE-77',
  }, TODAY)

  assert.equal(form.mobile, '9000000001')
  assert.equal(form.license, 'TN1234567890')
  assert.equal(form.joined, '2024-05-01')
  assert.equal(form.licenseExpiry, '2027-05-01')
  assert.equal(form.medicalExpiry, '2027-01-01')
  assert.equal(form.bankName, 'State Bank of India')
  assert.equal(form.emergencyContact, '9000000099')
  assert.equal(form.vehicle, 'PY01XX1234')
  assert.equal(form.badge, 'BADGE-77')
  // Login is create-only: never pre-filled on edit.
  assert.equal(form.email, '')
  assert.equal(form.password, '')
  assert.equal(form.createLogin, false)
})

test('driverToForm falls back to create defaults when there is no driver', () => {
  assert.deepEqual(driverToForm(null, TODAY), createEmptyDriver(TODAY))
})

test('validateDriverForm keeps the original messages', () => {
  const empty = validateDriverForm(createEmptyDriver(TODAY))
  assert.deepEqual(empty, {
    name: 'Required',
    mobile: '10 digits required',
    license: 'Required',
    email: 'Valid email required for login',
    password: 'Min 6 characters',
  })

  const short = validateDriverForm({
    ...createEmptyDriver(TODAY), name: 'Ravi', mobile: '12345', license: 'TN1',
  })
  assert.equal(short.mobile, '10 digits required')
  assert.ok(!short.name)
  assert.ok(!short.license)

  const badEmail = validateDriverForm({
    ...createEmptyDriver(TODAY), name: 'Ravi', mobile: '9000000001',
    license: 'TN1', email: 'nope', password: 'secret1',
  })
  assert.equal(badEmail.email, 'Valid email required for login')
  assert.ok(!badEmail.password)
})

test('validateDriverForm skips login rules when createLogin is off', () => {
  const errors = validateDriverForm({
    ...createEmptyDriver(TODAY),
    name: 'Ravi',
    mobile: '9000000001',
    license: 'TN1',
    createLogin: false,
  })
  assert.deepEqual(errors, {})
})

test('validateLicenceFile enforces type and the 2 MB cap', () => {
  assert.equal(validateLicenceFile(null), null)
  assert.equal(validateLicenceFile({ type: 'image/png', size: 1024 }), null)
  assert.equal(validateLicenceFile({ type: 'application/pdf', size: 1024 }), null)
  assert.equal(
    validateLicenceFile({ type: 'text/plain', size: 10 }),
    'Only image or PDF files are allowed.'
  )
  assert.equal(
    validateLicenceFile({ type: 'image/png', size: LICENCE_MAX_BYTES + 1 }),
    'File too large. Max 2MB.'
  )
  assert.equal(validateLicenceFile({ type: 'image/png', size: LICENCE_MAX_BYTES }), null)
})

test('buildDriverPayload create adds the generated id, timestamp and licence', () => {
  const form = {
    ...createEmptyDriver(TODAY),
    name: 'Ravi Kumar',
    mobile: '9000000001',
    license: 'TN1234567890',
    email: 'ravi@example.com',
    password: 'secret123',
    notes: 'Weekend shifts only',
  }
  const payload = buildDriverPayload(form, {
    id: 'DRV-123', now: '2026-11-19T10:00:00.000Z', licenceImg: 'data:image/png;base64,AAA',
  })

  assert.equal(payload.id, 'DRV-123')
  assert.equal(payload.createdAt, '2026-11-19T10:00:00.000Z')
  assert.equal(payload.license_photo_url, 'data:image/png;base64,AAA')
  assert.equal(payload.name, 'Ravi Kumar')
  assert.equal(payload.notes, 'Weekend shifts only')
  assert.equal(payload.status, 'active')
  assert.equal(payload.rating, 4.5)
  // Login credentials must never reach the driver row.
  assert.ok(!('email' in payload))
  assert.ok(!('password' in payload))
  assert.ok(!('createLogin' in payload))
})

test('buildDriverPayload create defaults the licence to null', () => {
  const payload = buildDriverPayload(createEmptyDriver(TODAY), { id: 'DRV-9' })
  assert.equal(payload.license_photo_url, null)
  assert.equal(payload.id, 'DRV-9')
})

test('buildDriverPayload edit keeps the id and only sends a new licence', () => {
  const form = { ...createEmptyDriver(TODAY), name: 'Ravi', license: 'TN1' }
  const without = buildDriverPayload(form, { isEdit: true })
  assert.ok(!('id' in without))
  assert.ok(!('createdAt' in without))
  assert.ok(!('license_photo_url' in without))

  const withLicence = buildDriverPayload(form, { isEdit: true, licenceImg: 'data:image/png;base64,BBB' })
  assert.equal(withLicence.license_photo_url, 'data:image/png;base64,BBB')
})

test('exported limits match the original form rules', () => {
  assert.equal(MOBILE_LENGTH, 10)
  assert.equal(MIN_PASSWORD_LENGTH, 6)
  assert.equal(LICENCE_MAX_BYTES, 2 * 1024 * 1024)
})

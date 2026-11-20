import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ALLOWED_MIMES,
  DOC_MAX_BYTES,
  DOCUMENT_CATEGORIES,
  DOCUMENT_TYPES,
  REMINDER_INTERVALS,
  addDays,
  buildDocumentPayload,
  changeCategory,
  createEmptyDocument,
  documentStatus,
  documentToForm,
  formatDate,
  formatFileSize,
  mapOcrFields,
  requiresEntity,
  suggestReminderDate,
  typeHasExpiry,
  typeOptionsFor,
  validateDocumentForm,
  validateFile,
} from '../src/utils/documentForm.js'

const today = () => formatDate(new Date())

test('catalogue keeps every legacy stored value and adds the requested company types', () => {
  assert.deepEqual(DOCUMENT_CATEGORIES.map(c => c.key), ['driver', 'vehicle', 'company'])
  assert.deepEqual(DOCUMENT_TYPES.driver.map(t => t.key), [
    'license', 'aadhar', 'pan', 'passport', 'badge', 'medical', 'police_cert', 'bank', 'other',
  ])
  assert.deepEqual(DOCUMENT_TYPES.vehicle.map(t => t.key), [
    'rc_book', 'insurance', 'permit', 'puc', 'fitness', 'tax_token', 'other',
  ])
  for (const key of ['gst', 'company_pan', 'tan', 'business_registration', 'bank_documents', 'agreement', 'registration', 'tax', 'other']) {
    assert.ok(DOCUMENT_TYPES.company.some(t => t.key === key), key)
  }
  assert.equal(typeHasExpiry('driver', 'license'), true)
  assert.equal(typeHasExpiry('driver', 'aadhar'), false)
  assert.equal(typeHasExpiry('vehicle', 'puc'), true)
  assert.equal(typeHasExpiry('company', 'gst'), false)
})

test('unknown legacy types are preserved and shown as an existing option', () => {
  const options = typeOptionsFor('vehicle', 'legacy_doc')
  assert.equal(options[0].key, 'legacy_doc')
  assert.match(options[0].label, /existing/)
  assert.ok(options.some(t => t.key === 'insurance'))
  assert.equal(buildDocumentPayload({ ...createEmptyDocument(), doc_type: 'legacy_doc' }).doc_type, 'legacy_doc')
})

test('documentToForm accepts raw Supabase rows, aliases and back attachments', () => {
  const form = documentToForm({
    id: 'd1',
    related_entity: 'vehicle',
    document_type: 'insurance',
    title: 'Insurance 2026',
    vehicle_id: 'v1',
    document_number: 'INS-9',
    issuing_authority: 'LIC',
    issue_date: '2026-01-02T00:00:00.000Z',
    expiry_date: '2027-01-02',
    reminder_date: '2026-12-03',
    reminder_enabled: false,
    reminder_interval: 15,
    notes: 'Own note',
    tags: 'fleet, insurance',
    file_url: 'https://signed/front',
    file_name: 'front.pdf',
    file_size: '2048',
    back_file_url: 'https://signed/back',
    back_file_name: 'back.pdf',
    back_file_size: 1024,
    status: 'active',
  })
  assert.equal(form.category, 'vehicle')
  assert.equal(form.doc_type, 'insurance')
  assert.equal(form.entity_id, 'v1')
  assert.equal(form.issue_date, '2026-01-02')
  assert.deepEqual(form.tags, ['fleet', 'insurance'])
  assert.equal(form.reminder_enabled, false)
  assert.equal(form.reminder_interval, 15)
  assert.equal(form.frontFileSize, 2048)
  assert.equal(form.backFileSize, 1024)
  assert.equal(form._existingFrontUrl, 'https://signed/front')
  assert.equal(form._existingBackUrl, 'https://signed/back')
})

test('category changes clear only the incompatible type and linked entity', () => {
  const form = {
    ...createEmptyDocument(),
    category: 'driver',
    doc_type: 'license',
    entity_id: 'd1',
    title: 'Keep me',
    notes: 'Keep me too',
    expiry_date: '2027-01-01',
  }
  const next = changeCategory(form, 'vehicle')
  assert.equal(next.category, 'vehicle')
  assert.equal(next.doc_type, 'rc_book')
  assert.equal(next.entity_id, '')
  assert.equal(next.title, 'Keep me')
  assert.equal(next.notes, 'Keep me too')
  assert.equal(next.expiry_date, '2027-01-01')
  assert.equal(form.entity_id, 'd1', 'the original form is untouched')
  assert.equal(requiresEntity('company'), false)
  assert.equal(requiresEntity('driver'), true)
})

test('status uses local dates and keeps legacy pending rows', () => {
  assert.equal(documentStatus(''), 'no_expiry')
  assert.equal(documentStatus('', 'pending'), 'pending')
  assert.equal(documentStatus(addDays(today(), -1)), 'expired')
  assert.equal(documentStatus(today()), 'expiring_soon')
  assert.equal(documentStatus(addDays(today(), 30)), 'expiring_soon')
  assert.equal(documentStatus(addDays(today(), 31)), 'active')
})

test('reminder suggestions respect the interval and never overwrite a manual date', () => {
  const expiry = '2027-01-30'
  assert.equal(suggestReminderDate(expiry, 7), '2027-01-23')
  assert.equal(suggestReminderDate(expiry, 15), '2027-01-15')
  assert.equal(suggestReminderDate(expiry, 30), '2026-12-31')
  assert.equal(suggestReminderDate(expiry, 60), '2026-12-01')
  assert.equal(suggestReminderDate(expiry, 30, '2026-12-20'), '2026-12-20')
  assert.equal(suggestReminderDate('', 30), '')
  assert.deepEqual(REMINDER_INTERVALS, [7, 15, 30, 60])
})

test('validation preserves the original required messages and checks date order', () => {
  assert.deepEqual(validateDocumentForm(createEmptyDocument(), null), {
    title: 'Required',
    entity_id: 'Select one',
    file: 'Attach the document file',
  })
  const base = {
    ...createEmptyDocument(),
    title: 'Licence',
    entity_id: 'd1',
    issue_date: '2026-02-01',
    expiry_date: '2026-01-01',
    reminder_date: '2026-02-05',
  }
  const errors = validateDocumentForm(base, { name: 'f.pdf' })
  assert.match(errors.expiry_date, /earlier than the issue date/)
  assert.match(errors.reminder_date, /later than the expiry date/)
  assert.equal(validateDocumentForm({ ...base, expiry_date: '2026-12-01' }, {}) .reminder_date, undefined)
  assert.equal(validateDocumentForm({ ...createEmptyDocument(), title: 'Company doc', category: 'company' }, {}).entity_id, undefined)
})

test('buildDocumentPayload maps only the active entity and keeps both aliases', () => {
  const form = {
    ...createEmptyDocument(),
    category: 'vehicle',
    doc_type: 'insurance',
    title: '  Insurance  ',
    entity_id: 'v1',
    document_number: '  INS-9 ',
    issuing_authority: ' LIC ',
    issue_date: '2026-01-01',
    expiry_date: '2027-01-01',
    reminder_date: '2026-12-02',
    reminder_enabled: true,
    reminder_interval: 15,
    notes: 'note',
    tags: ['fleet', ''],
    frontFileUrl: 'https://signed/front',
    frontFileName: 'front.pdf',
    frontFileSize: 100,
    backFileUrl: 'https://signed/back',
    backFileName: 'back.pdf',
    backFileSize: 200,
    _existingFrontUrl: 'https://signed/old-front',
    _existingBackUrl: 'https://signed/old-back',
  }
  const payload = buildDocumentPayload(form, { url: 'https://signed/new', name: 'new.pdf', size: 50 }, null)
  assert.equal(payload.title, 'Insurance')
  assert.equal(payload.document_type, 'insurance')
  assert.equal(payload.related_entity, 'vehicle')
  assert.equal(payload.doc_type, 'insurance')
  assert.equal(payload.driver_id, null)
  assert.equal(payload.vehicle_id, 'v1')
  assert.equal(payload.customer_id, null)
  assert.equal(payload.document_number, 'INS-9')
  assert.equal(payload.issuing_authority, 'LIC')
  assert.equal(payload.status, documentStatus('2027-01-01'))
  assert.deepEqual(payload.tags, ['fleet'])
  assert.equal(payload.file_url, 'https://signed/new')
  assert.equal(payload.file_name, 'new.pdf')
  assert.equal(payload.file_size, 50)
  assert.equal(payload.back_file_url, 'https://signed/back', 'an existing back file is kept')
  assert.equal(payload.back_file_name, 'back.pdf')
  assert.equal(payload.back_file_size, 200)

  const noReminder = buildDocumentPayload({ ...form, reminder_enabled: false })
  assert.equal(noReminder.reminder_date, null)
  assert.equal(noReminder.reminder_enabled, false)
  assert.equal(buildDocumentPayload(form).reminder_interval, 15)
})

test('file validation accepts the existing formats and keeps the 10 MB cap', () => {
  assert.deepEqual(ALLOWED_MIMES, [
    'image/jpeg', 'image/png', 'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ])
  assert.equal(DOC_MAX_BYTES, 10 * 1024 * 1024)
  assert.equal(validateFile({ type: 'image/png', size: DOC_MAX_BYTES }), null)
  assert.match(validateFile({ type: 'text/plain', size: 1 }), /Only JPG/)
  assert.match(validateFile({ type: 'image/png', size: DOC_MAX_BYTES + 1 }), /10 MB/)
  assert.equal(formatFileSize(1024), '1.0 KB')
  assert.equal(formatFileSize(2 * 1024 * 1024), '2.0 MB')
})

test('OCR suggestions are editable and never overwrite entered values', () => {
  const form = {
    ...createEmptyDocument(),
    category: 'driver',
    title: 'My own title',
    notes: 'My own note',
    doc_type: 'license',
  }
  const { form: next, suggestions } = mapOcrFields({
    holderName: 'Wrong Name',
    documentNumber: 'DL-1234',
    issueDate: '2026-01-01',
    expiryDate: '2030-01-01',
    docType: 'licence',
    vehicleNumber: 'TN01AB1234',
  }, form)
  assert.equal(next.title, 'My own title')
  assert.equal(next.notes, 'My own note')
  assert.equal(next.document_number, 'DL-1234')
  assert.equal(next.issue_date, '2026-01-01')
  assert.equal(next.expiry_date, '2030-01-01')
  assert.equal(next.doc_type, 'license')
  assert.equal(next.entity_id, '', 'a scanned number never auto-binds an entity')
  assert.ok(suggestions.some(s => s.label === 'Vehicle on document'))

  const blank = mapOcrFields({ holderName: 'Ravi', docType: 'insurance' }, {
    ...createEmptyDocument(), category: 'vehicle',
  })
  assert.equal(blank.form.title, 'Ravi — Insurance')
  assert.equal(blank.form.doc_type, 'insurance')
  assert.equal(mapOcrFields({ docType: 'pan' }, { ...createEmptyDocument(), category: 'vehicle' }).form.doc_type, 'license', 'cross-category guesses are ignored')

  // Every docType the OCR prompt can return has a safe in-category mapping.
  assert.equal(mapOcrFields({ docType: 'fc' }, { ...createEmptyDocument(), category: 'vehicle' }).form.doc_type, 'fitness')
  assert.equal(mapOcrFields({ docType: 'company_pan' }, { ...createEmptyDocument(), category: 'company' }).form.doc_type, 'company_pan')
  assert.equal(mapOcrFields({ docType: 'business_registration' }, { ...createEmptyDocument(), category: 'company' }).form.doc_type, 'business_registration')
  assert.equal(mapOcrFields({ docType: 'bank_documents' }, { ...createEmptyDocument(), category: 'company' }).form.doc_type, 'bank_documents')
})

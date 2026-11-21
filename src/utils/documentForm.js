// ─── documentForm — pure document form helpers ─────────────────
// Shared by the premium DocumentModal and its tests. No React, Supabase or
// browser globals here: every rule is deterministic and easy to verify.
//
// The stored values below are deliberately unchanged from the previous
// inline modal. New options are additive; an unknown legacy doc_type is
// preserved rather than silently rewritten to `other`.

import { daysUntil, parseDateOnly, EXPIRY_SOON_DAYS } from './vehicleUtils.js'

export const DOC_BUCKET = 'trip-documents'
export const DOC_MAX_BYTES = 10 * 1024 * 1024
export const SIGNED_URL_TTL = 60 * 60 * 24 * 365

export const DOCUMENT_CATEGORIES = [
  { key: 'driver', label: 'Drivers', singular: 'Driver' },
  { key: 'vehicle', label: 'Vehicles', singular: 'Vehicle' },
  { key: 'company', label: 'Company', singular: 'Company' },
]

export const DOCUMENT_TYPES = {
  driver: [
    { key: 'license', label: 'Driving Licence', hasExpiry: true },
    { key: 'aadhar', label: 'Aadhaar Card', hasExpiry: false },
    { key: 'pan', label: 'PAN Card', hasExpiry: false },
    { key: 'passport', label: 'Passport', hasExpiry: true },
    { key: 'badge', label: 'Badge / ID', hasExpiry: true },
    { key: 'medical', label: 'Medical Certificate', hasExpiry: true },
    { key: 'police_cert', label: 'Police Certificate', hasExpiry: true },
    { key: 'bank', label: 'Bank Passbook', hasExpiry: false },
    { key: 'other', label: 'Other', hasExpiry: false },
  ],
  vehicle: [
    { key: 'rc_book', label: 'RC Book', hasExpiry: false },
    { key: 'insurance', label: 'Insurance', hasExpiry: true },
    { key: 'permit', label: 'Permit', hasExpiry: true },
    { key: 'puc', label: 'Pollution Certificate', hasExpiry: true },
    { key: 'fitness', label: 'Fitness Certificate', hasExpiry: true },
    { key: 'tax_token', label: 'Road Tax', hasExpiry: true },
    { key: 'other', label: 'Other', hasExpiry: false },
  ],
  company: [
    { key: 'gst', label: 'GST Certificate', hasExpiry: false },
    { key: 'company_pan', label: 'PAN', hasExpiry: false },
    { key: 'tan', label: 'TAN', hasExpiry: false },
    { key: 'business_registration', label: 'Business Registration', hasExpiry: true },
    { key: 'bank_documents', label: 'Bank Documents', hasExpiry: false },
    { key: 'agreement', label: 'Agreements', hasExpiry: true },
    { key: 'registration', label: 'Registration', hasExpiry: true },
    { key: 'tax', label: 'Tax Documents', hasExpiry: false },
    { key: 'other', label: 'Other', hasExpiry: false },
  ],
  // Kept for reading/filtering legacy rows; the modal only offers the three
  // categories requested by the product.
  trip: [
    { key: 'permit', label: 'Trip Permit', hasExpiry: true },
    { key: 'authorization', label: 'Trip Authorization', hasExpiry: true },
    { key: 'itinerary', label: 'Trip Itinerary', hasExpiry: false },
    { key: 'manifest', label: 'Trip Manifest', hasExpiry: false },
    { key: 'inspection', label: 'Vehicle Inspection', hasExpiry: true },
    { key: 'other', label: 'Other', hasExpiry: false },
  ],
  customer: [{ key: 'other', label: 'Other', hasExpiry: false }],
}

export const STATUS_CFG = {
  active: { label: 'Valid', tone: 'green' },
  expiring_soon: { label: 'Expiring Soon', tone: 'amber' },
  expired: { label: 'Expired', tone: 'red' },
  no_expiry: { label: 'No Expiry', tone: 'gray' },
  pending: { label: 'Pending', tone: 'gray' },
}

export const REMINDER_INTERVALS = [7, 15, 30, 60]
export const ALLOWED_MIMES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
export const IMAGE_MIMES = ['image/jpeg', 'image/png']

export function createEmptyDocument() {
  return {
    id: null,
    category: 'driver',
    doc_type: 'license',
    title: '',
    entity_id: '',
    document_number: '',
    issuing_authority: '',
    issue_date: '',
    expiry_date: '',
    reminder_date: '',
    reminder_enabled: true,
    reminder_interval: 30,
    notes: '',
    tags: [],
    frontFileUrl: null,
    frontFileName: '',
    frontFileSize: null,
    frontFilePath: null,
    backFileUrl: null,
    backFileName: '',
    backFileSize: null,
    backFilePath: null,
    _existingFrontUrl: null,
    _existingBackUrl: null,
  }
}

function asDate(value) {
  if (!value) return ''
  const text = String(value).trim()
  if (!text) return ''
  // A full ISO timestamp is stored as its local calendar day.
  const parsed = parseDateOnly(text)
  if (!parsed) return text
  return formatDate(parsed)
}

function asTags(value) {
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean)
  if (typeof value === 'string') {
    return value.split(',').map(v => v.trim()).filter(Boolean)
  }
  return []
}

function asFileSize(value) {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

// Accept both the camelCase form shape and raw snake_case Supabase rows.
export function documentToForm(row) {
  const empty = createEmptyDocument()
  if (!row || typeof row !== 'object') return empty
  const category = row.category || row.related_entity || empty.category
  const docType = row.doc_type || row.document_type || empty.doc_type
  const entityId = row.driver_id || row.vehicle_id || row.customer_id || ''
  const interval = Number(row.reminder_interval ?? empty.reminder_interval)
  return {
    ...empty,
    id: row.id || null,
    category,
    doc_type: docType,
    title: row.title || '',
    entity_id: entityId,
    document_number: row.document_number ?? row.reference_number ?? '',
    issuing_authority: row.issuing_authority ?? '',
    issue_date: asDate(row.issue_date),
    expiry_date: asDate(row.expiry_date),
    reminder_date: asDate(row.reminder_date),
    reminder_enabled: row.reminder_enabled === undefined ? true : !!row.reminder_enabled,
    reminder_interval: REMINDER_INTERVALS.includes(interval) ? interval : empty.reminder_interval,
    notes: row.notes || '',
    tags: asTags(row.tags),
    frontFileUrl: row.file_url || null,
    frontFileName: row.file_name || '',
    frontFileSize: asFileSize(row.file_size),
    frontFilePath: row.file_path || null,
    backFileUrl: row.back_file_url || null,
    backFileName: row.back_file_name || '',
    backFileSize: asFileSize(row.back_file_size),
    backFilePath: row.back_file_path || null,
    _existingFrontUrl: row.file_url || null,
    _existingBackUrl: row.back_file_url || null,
    status: row.status || null,
  }
}

export function typeOptionsFor(category, currentValue) {
  const options = DOCUMENT_TYPES[category] || []
  if (!currentValue || options.some(t => t.key === currentValue)) return [...options]
  // An existing row may use a type that is no longer offered. Keep it visible
  // and selected so editing that row cannot silently change its stored value.
  return [{ key: currentValue, label: `${formatTypeLabel(currentValue)} (existing)`, hasExpiry: false }, ...options]
}

export function typeHasExpiry(category, docType) {
  return !!(DOCUMENT_TYPES[category] || []).find(t => t.key === docType)?.hasExpiry
}

export function formatTypeLabel(key) {
  if (!key) return 'Document'
  const found = Object.values(DOCUMENT_TYPES)
    .flat()
    .find(t => t.key === key)
  if (found) return found.label
  return String(key).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function changeCategory(form, nextCategory) {
  const nextType = DOCUMENT_TYPES[nextCategory]?.[0]?.key || 'other'
  // Switching category clears only the incompatible linked entity and type.
  // Files, dates, notes and the title are the user's work and stay put.
  return {
    ...form,
    category: nextCategory,
    doc_type: nextType,
    entity_id: '',
  }
}

export function entityOptionsFor(category, drivers = [], vehicles = [], customers = []) {
  if (category === 'driver') {
    return drivers.map(d => ({ value: d.id, label: d.name || d.driver_id || d.id }))
  }
  if (category === 'vehicle') {
    return vehicles.map(v => ({
      value: v.id,
      label: [v.reg || v.registration || v.vehicle_id, v.model].filter(Boolean).join(' · '),
    }))
  }
  if (category === 'customer' || category === 'trip') {
    return customers.map(c => ({ value: c.id, label: c.name || c.id }))
  }
  return []
}

export function requiresEntity(category) {
  return category === 'driver' || category === 'vehicle' || category === 'customer'
}

export function formatDate(date) {
  const d = parseDateOnly(date)
  if (!d) return ''
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export function addDays(dateStr, days) {
  const date = parseDateOnly(dateStr)
  if (!date) return ''
  date.setDate(date.getDate() + Number(days))
  return formatDate(date)
}

// Reminder is suggested `interval` days before expiry and never auto-filled
// over a date the user has already chosen or edited.
export function suggestReminderDate(expiryDate, interval, currentReminder = '') {
  if (!expiryDate || currentReminder) return currentReminder || ''
  const n = REMINDER_INTERVALS.includes(Number(interval)) ? Number(interval) : 30
  return addDays(expiryDate, -n)
}

export function documentStatus(expiryDate, existingStatus) {
  const days = daysUntil(expiryDate)
  if (days === null) {
    // Preserve a legacy `pending` row; everything else without a date is
    // deliberately "No Expiry", never "Expired".
    return existingStatus === 'pending' ? 'pending' : 'no_expiry'
  }
  if (days < 0) return 'expired'
  if (days <= EXPIRY_SOON_DAYS) return 'expiring_soon'
  return 'active'
}

export function validateFile(file) {
  if (!file) return 'Attach the document file'
  if (!ALLOWED_MIMES.includes(file.type)) {
    return 'Only JPG, PNG, PDF, DOC or DOCX files are allowed'
  }
  if (file.size > DOC_MAX_BYTES) return 'File size must be 10 MB or less'
  return null
}

export function formatFileSize(bytes) {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n < 0) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function validateDocumentForm(form, frontFile = null) {
  const errors = {}
  if (!form.category) errors.category = 'Select a category'
  if (!String(form.title || '').trim()) errors.title = 'Required'
  if (requiresEntity(form.category) && !form.entity_id) errors.entity_id = 'Select one'
  if (!frontFile && !form._existingFrontUrl && !form.frontFileUrl) {
    errors.file = 'Attach the document file'
  }

  const issue = parseDateOnly(form.issue_date)
  const expiry = parseDateOnly(form.expiry_date)
  const reminder = parseDateOnly(form.reminder_date)
  if (issue && expiry && expiry < issue) {
    errors.expiry_date = 'Expiry date cannot be earlier than the issue date'
  }
  if (reminder && expiry && reminder > expiry) {
    errors.reminder_date = 'Reminder date cannot be later than the expiry date'
  }
  if (reminder && issue && reminder < issue) {
    errors.reminder_date = 'Reminder date cannot be earlier than the issue date'
  }
  if (form.reminder_enabled && reminder && !expiry) {
    errors.reminder_date = 'Set an expiry date or turn the reminder off'
  }
  if (!REMINDER_INTERVALS.includes(Number(form.reminder_interval))) {
    errors.reminder_interval = 'Choose a reminder interval'
  }
  return errors
}

export function buildDocumentPayload(form, frontMeta = null, backMeta = null) {
  const category = form.category || 'driver'
  const docType = form.doc_type || 'other'
  const entityId = form.entity_id || ''
  const frontUrl = frontMeta?.url || form.frontFileUrl || form._existingFrontUrl || null
  const backUrl = backMeta?.url || form.backFileUrl || form._existingBackUrl || null
  return {
    document_type: docType,
    related_entity: category,
    title: String(form.title || '').trim(),
    category,
    doc_type: docType,
    status: documentStatus(form.expiry_date, form.status),
    document_number: String(form.document_number || '').trim() || null,
    issuing_authority: String(form.issuing_authority || '').trim() || null,
    issue_date: form.issue_date || null,
    expiry_date: form.expiry_date || null,
    reminder_date: form.reminder_enabled ? (form.reminder_date || null) : null,
    reminder_enabled: !!form.reminder_enabled,
    reminder_interval: REMINDER_INTERVALS.includes(Number(form.reminder_interval))
      ? Number(form.reminder_interval)
      : 30,
    notes: form.notes || null,
    tags: asTags(form.tags),
    driver_id: category === 'driver' ? (entityId || null) : null,
    vehicle_id: category === 'vehicle' ? (entityId || null) : null,
    customer_id: category === 'customer' || category === 'trip' ? (entityId || null) : null,
    file_url: frontUrl,
    file_name: frontMeta?.name || (frontUrl ? (form.frontFileName || '') : ''),
    file_size: frontMeta ? Number(frontMeta.size) : (frontUrl ? asFileSize(form.frontFileSize) : null),
    file_path: frontMeta?.path || (frontUrl ? (form.frontFilePath || null) : null),
    back_file_url: backUrl,
    back_file_name: backMeta?.name || (backUrl ? (form.backFileName || '') : ''),
    back_file_size: backMeta ? Number(backMeta.size) : (backUrl ? asFileSize(form.backFileSize) : null),
    back_file_path: backMeta?.path || (backUrl ? (form.backFilePath || null) : null),
  }
}

// ── OCR ────────────────────────────────────────────────────────
// The provider is staff-only and disabled without VITE_OCR_PROVIDER. These
// helpers only turn a successful result into *editable suggestions*: blank
// fields are prefilled, existing user input is never overwritten.

const DOC_TYPE_ALIASES = {
  licence: 'license',
  license: 'license',
  driving_licence: 'license',
  driving_license: 'license',
  aadhaar: 'aadhar',
  adhar: 'aadhar',
  uid: 'aadhar',
  pan: 'pan',
  passport: 'passport',
  badge: 'badge',
  medical: 'medical',
  police_cert: 'police_cert',
  bank: 'bank',
  rc: 'rc_book',
  rc_book: 'rc_book',
  insurance: 'insurance',
  permit: 'permit',
  puc: 'puc',
  pollution: 'puc',
  fitness: 'fitness',
  fc: 'fitness',
  fitness_certificate: 'fitness',
  tax: 'tax_token',
  road_tax: 'tax_token',
  gst: 'gst',
  gst_certificate: 'gst',
  company_pan: 'company_pan',
  tan: 'tan',
  business_registration: 'business_registration',
  bank_documents: 'bank_documents',
  bank_document: 'bank_documents',
  agreement: 'agreement',
  registration: 'registration',
  other: 'other',
}

function canonicalDocType(value, category) {
  const key = String(value || '').trim().toLowerCase().replace(/[\s/-]+/g, '_')
  const mapped = DOC_TYPE_ALIASES[key]
  if (!mapped) return ''
  const options = DOCUMENT_TYPES[category] || []
  if (options.some(t => t.key === mapped)) return mapped
  // Provider labels like "PAN" can mean a company PAN even when the driver
  // form is open. Do not guess across categories.
  return ''
}

export function mapOcrFields(fields = {}, form = {}, category = form.category) {
  const suggestions = []
  const next = { ...form }
  const put = (key, value, label) => {
    const clean = String(value ?? '').trim()
    if (!clean) return
    const dateField = key === 'issue_date' || key === 'expiry_date'
    if (!next[key]) next[key] = dateField ? (asDate(clean) || clean) : clean
    suggestions.push({ key, label, value: clean })
  }

  put('document_number', fields.documentNumber ?? fields.document_number, 'Document number')
  put('issuing_authority', fields.issuingAuthority ?? fields.issuing_authority, 'Issuing authority')
  put('issue_date', fields.issueDate ?? fields.issue_date, 'Issue date')
  put('expiry_date', fields.expiryDate ?? fields.expiry_date, 'Expiry date')

  const type = canonicalDocType(fields.docType ?? fields.doc_type, category)
  if (type && (!next.doc_type || next.doc_type === 'license')) {
    next.doc_type = type
    suggestions.push({ key: 'doc_type', label: 'Document type', value: formatTypeLabel(type) })
  }

  const holder = String(fields.holderName ?? fields.name ?? '').trim()
  if (holder) {
    if (!next.title) next.title = `${holder} — ${formatTypeLabel(next.doc_type)}`
    suggestions.push({ key: 'title', label: 'Name on document', value: holder })
  }

  // A vehicle number is shown as a suggestion only. Binding it to an entity
  // without confirmation could attach a scan to the wrong driver/vehicle.
  const vehicleNumber = String(fields.vehicleNumber ?? fields.vehicle_number ?? '').trim()
  if (vehicleNumber) suggestions.push({ key: 'entity_id', label: 'Vehicle on document', value: vehicleNumber })

  return { form: next, suggestions }
}

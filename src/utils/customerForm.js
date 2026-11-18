// ─── Customer form — pure helpers ─────────────────────────────────
// Shared by the premium Add/Edit Customer modal and its unit tests.
// Field names and validation rules mirror the previous inline modal.

export const FIELD_RESTRICTIONS = Object.freeze({
  name: {
    maxLength: 50,
    minLength: 2,
    pattern: /^[a-zA-Z\s\-'.]*$/,
    errorMsg: 'Only letters, spaces, hyphens, and apostrophes allowed',
    placeholder: 'Full name or company name (2-50 chars)',
  },
  mobile: {
    maxLength: 10,
    minLength: 10,
    pattern: /^[0-9]*$/,
    errorMsg: 'Mobile must be exactly 10 digits',
    placeholder: '10-digit mobile number (e.g., 9876543210)',
  },
  altMobile: {
    maxLength: 10,
    minLength: 0,
    pattern: /^[0-9]*$/,
    errorMsg: 'Mobile must be 10 digits',
    placeholder: '10 digits only (optional)',
  },
  email: {
    maxLength: 100,
    pattern: /^[^\s]*@?[^\s]*\.?[^\s]*$/,
    errorMsg: 'Please enter a valid email address',
    placeholder: 'user@example.com (optional)',
  },
  city: {
    maxLength: 30,
    pattern: /^[a-zA-Z\s\-'.]*$/,
    errorMsg: 'Only letters, spaces, hyphens, and apostrophes allowed',
    placeholder: 'City name (optional)',
  },
  state: {
    maxLength: 30,
    pattern: /^[a-zA-Z\s\-'.]*$/,
    errorMsg: 'Only letters, spaces, hyphens, and apostrophes allowed',
    placeholder: 'State name (optional)',
  },
  address: {
    maxLength: 100,
    pattern: /^[a-zA-Z0-9\s\-',./]*$/,
    errorMsg: 'Address contains invalid characters',
    placeholder: 'Door no., Street name (optional)',
  },
  companyName: {
    maxLength: 60,
    pattern: /^[a-zA-Z0-9\s\-'.&()]*$/,
    errorMsg: 'Only alphanumeric, spaces, and basic punctuation allowed',
    placeholder: 'Registered company name (optional)',
  },
  contactPerson: {
    maxLength: 50,
    pattern: /^[a-zA-Z\s\-'.]*$/,
    errorMsg: 'Only letters, spaces, hyphens, and apostrophes allowed',
    placeholder: 'Primary contact name (optional)',
  },
  gst: {
    maxLength: 15,
    pattern: /^[0-9A-Z]*$/,
    errorMsg: 'GST must be 15 alphanumeric characters (e.g., 29AAACM0000A1Z5)',
    placeholder: 'GSTIN - 15 characters (optional)',
  },
  billingAddress: {
    maxLength: 120,
    pattern: /^[a-zA-Z0-9\s\-',./]*$/,
    errorMsg: 'Address contains invalid characters',
    placeholder: 'GST billing address (optional)',
  },
  notes: {
    maxLength: 300,
    errorMsg: 'Notes cannot exceed 300 characters',
    placeholder: 'Preferred driver, vehicle preferences, payment terms...',
  },
})

export const EMPTY_CUSTOMER = Object.freeze({
  id: '', type: 'individual', status: 'active',
  name: '', mobile: '', altMobile: '', email: '',
  address: '', city: '', state: 'Tamil Nadu',
  gst: '', companyName: '', contactPerson: '', billingAddress: '',
  notes: '',
  isVip: false, isBlacklisted: false, isFrequentTraveller: false,
  emergencyName: '', emergencyContact: '',
})

// Strip disallowed characters as the user types. Email stays untouched so
// the existing save-time validation can show a helpful message instead.
const STRIP = Object.freeze({
  name: /[^a-zA-Z\s\-'.]/g,
  mobile: /\D/g,
  altMobile: /\D/g,
  city: /[^a-zA-Z\s\-'.]/g,
  state: /[^a-zA-Z\s\-'.]/g,
  address: /[^a-zA-Z0-9\s\-',./]/g,
  companyName: /[^a-zA-Z0-9\s\-'.&()]/g,
  contactPerson: /[^a-zA-Z\s\-'.]/g,
  gst: /[^0-9A-Z]/g,
  billingAddress: /[^a-zA-Z0-9\s\-',./]/g,
})

export function sanitizeField(field, value) {
  let next = String(value ?? '')
  if (field === 'gst') next = next.toUpperCase()
  const max = FIELD_RESTRICTIONS[field]?.maxLength
  if (max) next = next.slice(0, max)
  const strip = STRIP[field]
  return strip ? next.replace(strip, '') : next
}

export function isBusinessCustomer(type) {
  return type === 'corporate' || type === 'agent'
}

export function validateCustomerForm(form = {}) {
  const errors = {}
  const name = String(form.name ?? '')
  const mobile = String(form.mobile ?? '')
  const altMobile = String(form.altMobile ?? '')
  const email = String(form.email ?? '')
  const gst = String(form.gst ?? '')

  if (!name.trim()) {
    errors.name = 'Customer name is required'
  } else {
    const rule = FIELD_RESTRICTIONS.name
    if (name.length < rule.minLength) {
      errors.name = `Name must be at least ${rule.minLength} characters`
    } else if (!rule.pattern.test(name)) {
      errors.name = rule.errorMsg
    }
  }

  if (!mobile.trim()) {
    errors.mobile = 'Mobile number is required'
  } else {
    const rule = FIELD_RESTRICTIONS.mobile
    if (mobile.length !== rule.maxLength) {
      errors.mobile = `Mobile must be exactly ${rule.maxLength} digits`
    } else if (!rule.pattern.test(mobile)) {
      errors.mobile = 'Mobile must contain only numbers'
    }
  }

  if (altMobile.trim()) {
    const rule = FIELD_RESTRICTIONS.altMobile
    if (altMobile.length !== rule.maxLength) {
      errors.altMobile = `Alternate mobile must be ${rule.maxLength} digits`
    } else if (!rule.pattern.test(altMobile)) {
      errors.altMobile = 'Must contain only numbers'
    }
  }

  if (email.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) errors.email = FIELD_RESTRICTIONS.email.errorMsg
  }

  if (gst.trim()) {
    const rule = FIELD_RESTRICTIONS.gst
    if (gst.length !== 15) {
      errors.gst = 'GST must be exactly 15 characters'
    } else if (!rule.pattern.test(gst)) {
      errors.gst = rule.errorMsg
    }
  }

  return errors
}

// Same payload shape the previous modal sent to saveCustomer().
export function buildCustomerPayload(form = {}, options = {}) {
  const { now = new Date().toISOString(), newId = '' } = options
  return {
    ...form,
    id: form.id || newId,
    createdAt: form.createdAt || now,
    updatedAt: now,
  }
}

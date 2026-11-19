// ─── Driver form helpers (pure) ─────────────────────────────────
// Dependency-free so the defaults, validation rules and save payload
// behind the premium Add/Edit Driver modal can be unit-tested directly.
// Field names, defaults and messages are unchanged from the previous
// inline AddDriverModal in Drivers.jsx.

export const MOBILE_LENGTH = 10
export const MIN_PASSWORD_LENGTH = 6
export const LICENCE_MAX_BYTES = 2 * 1024 * 1024
export const NOTES_MAX_LENGTH = 500

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const todayISO = () => new Date().toISOString().slice(0, 10)

// Original create-mode defaults (join date defaults to today).
export function createEmptyDriver(today = todayISO()) {
  return {
    name: '', mobile: '', vehicle: '', license: '', vehicleType: '',
    joined: today, status: 'active', rating: 4.5,
    licenseExpiry: '', badge: '', medicalExpiry: '',
    bankName: '', accountNo: '', ifscCode: '',
    emergencyName: '', emergencyContact: '', notes: '',
    email: '', password: '', createLogin: true,
  }
}

// Builds the edit-mode form from a driver row, keeping the original
// camelCase + snake_case fallbacks. Login fields are never pre-filled.
export function driverToForm(driver, today = todayISO()) {
  if (!driver) return createEmptyDriver(today)
  return {
    name: driver.name || '',
    mobile: driver.mobile || driver.phone || '',
    vehicle: driver.vehicle || '',
    license: driver.license ?? driver.license_number ?? '',
    vehicleType: driver.vehicleType || driver.vehicle_type || '',
    joined: driver.joined || driver.joined_date || today,
    status: driver.status || 'active',
    rating: driver.rating ?? 4.5,
    licenseExpiry: driver.licenseExpiry || driver.license_expiry || '',
    badge: driver.badge || '',
    medicalExpiry: driver.medicalExpiry || driver.medical_expiry || '',
    bankName: driver.bankName || driver.bank_name || '',
    accountNo: driver.accountNo || driver.account_no || '',
    ifscCode: driver.ifscCode || driver.ifsc_code || '',
    emergencyName: driver.emergencyName || driver.emergency_name || '',
    emergencyContact: driver.emergencyContact || driver.emergency_contact || '',
    notes: driver.notes || '',
    email: '', password: '', createLogin: false,
  }
}

// Original validation rules and messages.
export function validateDriverForm(form = {}) {
  const errors = {}
  if (!String(form.name || '').trim()) errors.name = 'Required'

  const mobile = String(form.mobile || '').trim()
  if (!mobile || mobile.length < MOBILE_LENGTH) errors.mobile = '10 digits required'

  if (!String(form.license || '').trim()) errors.license = 'Required'

  if (form.createLogin) {
    const email = String(form.email || '').trim()
    if (!email || !EMAIL_RE.test(email)) errors.email = 'Valid email required for login'
    if (!form.password || form.password.length < MIN_PASSWORD_LENGTH) {
      errors.password = 'Min 6 characters'
    }
  }
  return errors
}

// Returns a message when the licence file is rejected, else null.
export function validateLicenceFile(file) {
  if (!file) return null
  const type = String(file.type || '')
  const isImage = type.startsWith('image/')
  const isPdf = type === 'application/pdf'
  if (!isImage && !isPdf) return 'Only image or PDF files are allowed.'
  if (file.size > LICENCE_MAX_BYTES) return 'File too large. Max 2MB.'
  return null
}

// Original payload shape: login fields are stripped; edits only include a
// newly attached licence, creates add the generated id, timestamp and url.
export function buildDriverPayload(form, { isEdit = false, id, now, licenceImg } = {}) {
  const { email, password, createLogin, ...driverFields } = form

  if (isEdit) {
    return {
      ...driverFields,
      ...(licenceImg ? { license_photo_url: licenceImg } : {}),
    }
  }

  return {
    ...driverFields,
    id: id || `DRV-${Date.now()}`,
    license_photo_url: licenceImg || null,
    createdAt: now || new Date().toISOString(),
  }
}

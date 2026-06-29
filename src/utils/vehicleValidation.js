// ─────────────────────────────────────────────────────────────────────
// VEHICLE VALIDATION UTILITIES
// Validation rules for vehicle data
// ─────────────────────────────────────────────────────────────────────

/**
 * Validate vehicle data
 * @param {Object} vehicle
 * @returns {Object} {valid: boolean, errors: Array}
 */
export function validateVehicle(vehicle) {
  const errors = []

  if (!vehicle.registration) {
    errors.push('Registration number is required')
  } else if (!isValidRegistration(vehicle.registration)) {
    errors.push('Invalid registration format')
  }

  if (!vehicle.type) {
    errors.push('Vehicle type is required')
  }

  if (!vehicle.model) {
    errors.push('Model is required')
  }

  if (vehicle.year && !isValidYear(vehicle.year)) {
    errors.push('Invalid year')
  }

  if (vehicle.insurance_expiry && !isValidDate(vehicle.insurance_expiry)) {
    errors.push('Invalid insurance expiry date')
  }

  if (vehicle.permit_expiry && !isValidDate(vehicle.permit_expiry)) {
    errors.push('Invalid permit expiry date')
  }

  if (vehicle.fc_expiry && !isValidDate(vehicle.fc_expiry)) {
    errors.push('Invalid FC expiry date')
  }

  if (vehicle.puc_expiry && !isValidDate(vehicle.puc_expiry)) {
    errors.push('Invalid PUC expiry date')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate registration format (Indian format: XX00XX0000)
 * @param {string} registration
 * @returns {boolean}
 */
export function isValidRegistration(registration) {
  if (!registration) return false
  const regex = /^[A-Z]{2}\d{1,2}[A-Z]{2}\d{4}$/
  return regex.test(registration.toUpperCase().replace(/\s+/g, ''))
}

/**
 * Validate year
 * @param {number} year
 * @returns {boolean}
 */
export function isValidYear(year) {
  const currentYear = new Date().getFullYear()
  return year >= 1900 && year <= currentYear + 1
}

/**
 * Validate date format
 * @param {string} dateString
 * @returns {boolean}
 */
export function isValidDate(dateString) {
  try {
    const date = new Date(dateString)
    return date instanceof Date && !isNaN(date)
  } catch {
    return false
  }
}

/**
 * Check if document is expired
 * @param {string} expiryDate
 * @returns {boolean}
 */
export function isDocumentExpired(expiryDate) {
  if (!expiryDate) return false
  const expiry = new Date(expiryDate)
  const today = new Date()
  return expiry < today
}

/**
 * Check if document is expiring soon (within 30 days)
 * @param {string} expiryDate
 * @returns {boolean}
 */
export function isDocumentExpiringSoon(expiryDate) {
  if (!expiryDate) return false
  const expiry = new Date(expiryDate)
  const today = new Date()
  const daysUntilExpiry = Math.floor((expiry - today) / (1000 * 60 * 60 * 24))
  return daysUntilExpiry >= 0 && daysUntilExpiry <= 30
}

/**
 * Format registration number to standard format
 * @param {string} registration
 * @returns {string}
 */
export function formatRegistration(registration) {
  if (!registration) return ''
  return registration.toUpperCase().replace(/\s+/g, '')
}

/**
 * Get registration state from registration number
 * @param {string} registration
 * @returns {string|null}
 */
export function getRegistrationState(registration) {
  if (!isValidRegistration(registration)) return null
  const state = registration.substring(0, 2).toUpperCase()

  const stateMap = {
    'AP': 'Andhra Pradesh',
    'AR': 'Arunachal Pradesh',
    'AS': 'Assam',
    'BR': 'Bihar',
    'CG': 'Chhattisgarh',
    'CH': 'Chandigarh',
    'DD': 'Daman and Diu',
    'DL': 'Delhi',
    'DN': 'Dadra and Nagar Haveli',
    'GA': 'Goa',
    'GJ': 'Gujarat',
    'HR': 'Haryana',
    'HP': 'Himachal Pradesh',
    'JK': 'Jammu and Kashmir',
    'JH': 'Jharkhand',
    'KA': 'Karnataka',
    'KL': 'Kerala',
    'LD': 'Ladakh',
    'LL': 'Ladakh',
    'MP': 'Madhya Pradesh',
    'MH': 'Maharashtra',
    'MN': 'Manipur',
    'ML': 'Meghalaya',
    'MZ': 'Mizoram',
    'NL': 'Nagaland',
    'OR': 'Odisha',
    'OD': 'Odisha',
    'PB': 'Punjab',
    'PY': 'Puducherry',
    'RJ': 'Rajasthan',
    'SK': 'Sikkim',
    'TN': 'Tamil Nadu',
    'TS': 'Telangana',
    'TR': 'Tripura',
    'UP': 'Uttar Pradesh',
    'UK': 'Uttarakhand',
    'WB': 'West Bengal',
  }

  return stateMap[state] || null
}

export default {
  validateVehicle,
  isValidRegistration,
  isValidYear,
  isValidDate,
  isDocumentExpired,
  isDocumentExpiringSoon,
  formatRegistration,
  getRegistrationState,
}
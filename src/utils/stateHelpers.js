// ─────────────────────────────────────────────────────────────────────
// UI STATE & ERROR HANDLING UTILITIES
// Empty states, error messages, and loading states
// ─────────────────────────────────────────────────────────────────────

/**
 * Common empty state messages by context
 */
export const EMPTY_STATES = {
  trips: {
    title: 'No Trips',
    description: 'No trips found. Create a new trip to get started.',
    icon: 'Route'
  },
  customers: {
    title: 'No Customers',
    description: 'No customers in the system. Add a customer to create bookings.',
    icon: 'Users'
  },
  drivers: {
    title: 'No Drivers',
    description: 'No drivers available. Please add drivers to the system.',
    icon: 'User'
  },
  vehicles: {
    title: 'No Vehicles',
    description: 'No vehicles in the fleet. Add vehicles to manage the fleet.',
    icon: 'Car'
  },
  expenses: {
    title: 'No Expenses',
    description: 'No expenses recorded yet. Add an expense to track costs.',
    icon: 'Receipt'
  },
  invoices: {
    title: 'No Invoices',
    description: 'No invoices generated yet. Complete trips to create invoices.',
    icon: 'FileText'
  },
  attendance: {
    title: 'No Attendance',
    description: 'No attendance records found.',
    icon: 'CalendarCheck'
  },
  payroll: {
    title: 'No Payroll',
    description: 'No payroll records found.',
    icon: 'IndianRupee'
  },
  reports: {
    title: 'No Data',
    description: 'No report data available for the selected period.',
    icon: 'BarChart2'
  },
  search: {
    title: 'No Results',
    description: 'No items match your search criteria.',
    icon: 'Search'
  },
  assignedTrips: {
    title: 'No Trips Assigned',
    description: 'You have no trips assigned yet.',
    icon: 'Route'
  },
  rideHistory: {
    title: 'No Ride History',
    description: 'Your ride history will appear here.',
    icon: 'History'
  }
}

/**
 * Error messages by error type
 */
export const ERROR_MESSAGES = {
  network: 'Network error. Please check your connection.',
  storage: 'Failed to save data. Please try again.',
  notFound: 'Item not found.',
  unauthorized: 'You do not have permission to perform this action.',
  validation: 'Please correct the errors below and try again.',
  duplicate: 'This item already exists.',
  invalidFile: 'Invalid file format. Please upload a valid file.',
  fileTooLarge: 'File size exceeds the maximum limit (2MB).',
  serverError: 'Server error. Please try again later.',
  timeout: 'Request timed out. Please try again.',
}

/**
 * Format a generic error message
 * @param {Error|string} error - The error object or message
 * @returns {string} - Formatted error message
 */
export function formatErrorMessage(error) {
  if (typeof error === 'string') return error
  if (error?.message) return error.message
  return 'An unexpected error occurred. Please try again.'
}

/**
 * Check if a value is empty or null
 * @param {*} value - The value to check
 * @returns {boolean} - True if empty
 */
export function isEmpty(value) {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value).length === 0
  return false
}

/**
 * Get empty state config for a section
 * @param {string} section - The section identifier
 * @param {string} customMessage - Optional custom message
 * @returns {Object} - Empty state configuration
 */
export function getEmptyStateConfig(section, customMessage = null) {
  const config = EMPTY_STATES[section] || EMPTY_STATES.trips
  return {
    ...config,
    ...(customMessage && { description: customMessage })
  }
}

/**
 * Format a storage error to user-friendly message
 * @returns {string} - Formatted error message
 */
export function getStorageErrorMessage() {
  return 'Failed to save data. Please try again. If the problem persists, clear your browser cache.'
}

/**
 * Check if we should show loading state
 * @param {boolean} isLoading - Loading flag
 * @param {*} data - The data being loaded
 * @returns {boolean} - True if should show loading
 */
export function shouldShowLoading(isLoading, data) {
  return isLoading && isEmpty(data)
}

/**
 * Create a normalized response object
 * @param {boolean} success - Operation success status
 * @param {string} message - Response message
 * @param {*} data - Response data
 * @param {string} error - Error message if failed
 * @returns {Object} - Normalized response
 */
export function createResponse(success, message = '', data = null, error = null) {
  return {
    success,
    message,
    data,
    error: error || (success ? null : 'Operation failed'),
    timestamp: new Date().toISOString()
  }
}

/**
 * Validate form submission and return errors
 * @param {Object} errors - Validation errors object
 * @returns {boolean} - True if form has errors
 */
export function hasFormErrors(errors) {
  if (!errors || typeof errors !== 'object') return false
  return Object.values(errors).some(error => error !== null && error !== undefined && error !== '')
}

/**
 * Get first error message from errors object
 * @param {Object} errors - Validation errors object
 * @returns {string|null} - First error message or null
 */
export function getFirstError(errors) {
  if (!hasFormErrors(errors)) return null
  const messages = Object.values(errors).filter(e => e)
  return messages[0] || null
}
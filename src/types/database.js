// ─────────────────────────────────────────────────────────────────────
// DATABASE TYPES
// Type definitions and constants for the database layer
// ─────────────────────────────────────────────────────────────────────

/**
 * User roles
 */
export const USER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  DRIVER: 'driver',
}

/**
 * Customer types
 */
export const CUSTOMER_TYPES = {
  INDIVIDUAL: 'individual',
  CORPORATE: 'corporate',
  GOVERNMENT: 'government',
}

/**
 * Vehicle statuses
 */
export const VEHICLE_STATUSES = {
  ACTIVE: 'active',
  ASSIGNED: 'assigned',
  MAINTENANCE: 'maintenance',
  OFFLINE: 'offline',
  INACTIVE: 'inactive',
}

/**
 * Booking/Trip types
 */
export const BOOKING_TYPES = {
  RIDE: 'ride',
  RENTAL: 'rental',
  CHARTER: 'charter',
  SHUTTLE: 'shuttle',
  CARGO: 'cargo',
  DELIVERY: 'delivery',
}

/**
 * Booking/Trip statuses
 */
export const BOOKING_STATUSES = {
  DRAFT: 'draft',
  CONFIRMED: 'confirmed',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
}

/**
 * Expense types
 */
export const EXPENSE_TYPES = {
  FUEL: 'fuel',
  TOLL: 'toll',
  MAINTENANCE: 'maintenance',
  PARKING: 'parking',
  OTHER: 'other',
}

/**
 * Expense statuses
 */
export const EXPENSE_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PAID: 'paid',
}

/**
 * Settlement statuses
 */
export const SETTLEMENT_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  PAID: 'paid',
}

/**
 * Attendance statuses
 */
export const ATTENDANCE_STATUSES = {
  PRESENT: 'present',
  ABSENT: 'absent',
  LEAVE: 'leave',
  HALF_DAY: 'half_day',
}

/**
 * Combined database types object
 */
export const DATABASE_TYPES = {
  USER_ROLES,
  CUSTOMER_TYPES,
  VEHICLE_STATUSES,
  BOOKING_TYPES,
  BOOKING_STATUSES,
  EXPENSE_TYPES,
  EXPENSE_STATUSES,
  SETTLEMENT_STATUSES,
  ATTENDANCE_STATUSES,
}

export default DATABASE_TYPES
// ─────────────────────────────────────────────────────────────────────
// DATABASE TYPES
// TypeScript/JavaScript type definitions for Supabase tables
// ─────────────────────────────────────────────────────────────────────

/**
 * User roles in the system
 */
export const USER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  DRIVER: 'driver',
}

/**
 * User type definition
 * @typedef {Object} User
 * @property {string} id - UUID primary key
 * @property {string} email - Email address
 * @property {string} phone - Phone number
 * @property {string} name - Full name
 * @property {'admin'|'manager'|'driver'} role - User role
 * @property {string} [avatar_url] - Avatar image URL
 * @property {boolean} is_active - Account active status
 * @property {string} [last_login] - Last login timestamp
 * @property {string} created_at - Creation timestamp
 * @property {string} updated_at - Last update timestamp
 */
export const UserType = `
id: string (UUID)
email: string
phone: string
name: string
role: 'admin' | 'manager' | 'driver'
avatar_url?: string
is_active: boolean
last_login?: string (timestamp)
created_at: string (timestamp)
updated_at: string (timestamp)
`

/**
 * Customer types
 */
export const CUSTOMER_TYPES = {
  INDIVIDUAL: 'individual',
  CORPORATE: 'corporate',
  AGENCY: 'agency',
}

/**
 * Customer type definition
 * @typedef {Object} Customer
 */
export const CustomerType = `
id: string (UUID)
customer_id: string (unique)
name: string
type: 'individual' | 'corporate' | 'agency'
primary_mobile: string
alternate_mobile?: string
email?: string
city?: string
state?: string
address?: string
company_name?: string
contact_person?: string
gstin?: string
notes?: string
is_active: boolean
created_at: string (timestamp)
updated_at: string (timestamp)
`

/**
 * Driver type definition
 * @typedef {Object} Driver
 */
export const DriverType = `
id: string (UUID)
user_id: string (UUID) -> users.id
driver_id: string (unique)
name: string
phone: string
license_number: string (unique)
license_expiry?: string (date)
vehicle_registration?: string
vehicle_type?: string
rating: decimal (default: 5.0)
is_active: boolean
joined_date: string (date)
avatar_url?: string
created_at: string (timestamp)
updated_at: string (timestamp)
`

/**
 * Vehicle statuses
 */
export const VEHICLE_STATUSES = {
  ACTIVE: 'active',
  ASSIGNED: 'assigned',
  MAINTENANCE: 'maintenance',
  OFFLINE: 'offline',
}

/**
 * Vehicle type definition
 * @typedef {Object} Vehicle
 */
export const VehicleType = `
id: string (UUID)
vehicle_id: string (unique)
registration: string (unique)
type: string
model?: string
year?: number
color?: string
fuel_type?: string
status: 'active' | 'assigned' | 'maintenance' | 'offline'
current_driver?: string (UUID) -> drivers.id
current_km: decimal
last_service_date?: string (date)
last_service_km?: decimal
next_service_date?: string (date)
next_service_km?: decimal
insurance_number?: string
insurance_expiry?: string (date)
permit_number?: string
permit_expiry?: string (date)
fc_number?: string
fc_expiry?: string (date)
puc_number?: string
puc_expiry?: string (date)
created_at: string (timestamp)
updated_at: string (timestamp)
`

/**
 * Booking types
 */
export const BOOKING_TYPES = {
  ONE_WAY: 'one_way',
  ROUND_TRIP: 'round_trip',
  LOCAL_VISIT: 'local_visit',
  MULTI_DAY: 'multi_day',
  RENTAL_WITH_DRIVER: 'rental_with_driver',
  SELF_DRIVE: 'self_drive',
}

/**
 * Booking statuses
 */
export const BOOKING_STATUSES = {
  DRAFT: 'draft',
  ASSIGNED: 'assigned',
  STARTED: 'started',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
}

/**
 * Booking type definition
 * @typedef {Object} Booking
 */
export const BookingType = `
id: string (UUID)
booking_id: string (unique)
booking_number: string (unique)
type: 'one_way' | 'round_trip' | 'local_visit' | 'multi_day' | 'rental_with_driver' | 'self_drive'
status: 'draft' | 'assigned' | 'started' | 'paused' | 'completed' | 'cancelled'
customer_id: string (UUID) -> customers.id
customer_name: string
customer_contact?: string
driver_id?: string (UUID) -> drivers.id
vehicle_id?: string (UUID) -> vehicles.id
pickup_location: string
drop_location: string
start_date: string (date)
start_time?: string (time)
end_date?: string (date)
end_time?: string (time)
pickup_odometer?: decimal
drop_odometer?: decimal
total_km?: decimal
base_fare?: decimal
total_fare?: decimal
notes?: string
type_data?: object (JSONB)
created_at: string (timestamp)
updated_at: string (timestamp)
`

/**
 * Expense types
 */
export const EXPENSE_TYPES = {
  FUEL: 'fuel',
  PARKING: 'parking',
  TOLL: 'toll',
  BATA: 'bata',
  MAINTENANCE: 'maintenance',
  OTHER: 'other',
}

/**
 * Expense statuses
 */
export const EXPENSE_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
}

/**
 * Expense type definition
 * @typedef {Object} Expense
 */
export const ExpenseType = `
id: string (UUID)
expense_id: string (unique)
booking_id?: string (UUID) -> bookings.id
driver_id: string (UUID) -> drivers.id
type: 'fuel' | 'parking' | 'toll' | 'bata' | 'maintenance' | 'other'
amount: decimal
expense_date: string (date)
location?: string
notes?: string
bill_image_url?: string
status: 'pending' | 'approved' | 'rejected'
created_by: string (UUID) -> users.id
approved_by?: string (UUID) -> users.id
created_at: string (timestamp)
updated_at: string (timestamp)
`

/**
 * Settlement statuses
 */
export const SETTLEMENT_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  PAID: 'paid',
}

/**
 * Settlement type definition
 * @typedef {Object} Settlement
 */
export const SettlementType = `
id: string (UUID)
settlement_id: string (unique)
driver_id: string (UUID) -> drivers.id
month: number
year: number
basic_pay?: decimal
incentive: decimal (default: 0)
deductions: decimal (default: 0)
net_amount: decimal
status: 'pending' | 'approved' | 'paid'
payment_method?: string
payment_date?: string (date)
notes?: string
created_at: string (timestamp)
updated_at: string (timestamp)
`

/**
 * Attendance statuses
 */
export const ATTENDANCE_STATUSES = {
  PRESENT: 'present',
  ABSENT: 'absent',
  LEAVE: 'leave',
  HOLIDAY: 'holiday',
}

/**
 * Attendance type definition
 * @typedef {Object} Attendance
 */
export const AttendanceType = `
id: string (UUID)
driver_id: string (UUID) -> drivers.id
attendance_date: string (date)
check_in_time?: string (timestamp)
check_out_time?: string (timestamp)
status: 'present' | 'absent' | 'leave' | 'holiday'
notes?: string
created_at: string (timestamp)
updated_at: string (timestamp)
`

/**
 * Notification type definition
 * @typedef {Object} Notification
 */
export const NotificationType = `
id: string (UUID)
user_id: string (UUID) -> users.id
type: string
title: string
message?: string
related_id?: string
is_read: boolean
read_at?: string (timestamp)
created_at: string (timestamp)
`

/**
 * Audit log type definition
 * @typedef {Object} AuditLog
 */
export const AuditLogType = `
id: string (UUID)
user_id?: string (UUID) -> users.id
action: string
entity_type?: string
entity_id?: string
changes?: object (JSONB)
ip_address?: string
user_agent?: string
created_at: string (timestamp)
`

/**
 * Get all type definitions as an object
 */
export const DATABASE_TYPES = {
  User: UserType,
  Customer: CustomerType,
  Driver: DriverType,
  Vehicle: VehicleType,
  Booking: BookingType,
  Expense: ExpenseType,
  Settlement: SettlementType,
  Attendance: AttendanceType,
  Notification: NotificationType,
  AuditLog: AuditLogType,
}

export default DATABASE_TYPES
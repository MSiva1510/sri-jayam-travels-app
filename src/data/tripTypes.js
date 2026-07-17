// ─── Trip Type Management — Data, Config & Booking Store ─────
// Storage: Supabase `bookings` table via tripRepository

import { tripRepository } from '../repositories/tripRepository'
import { withCache, cacheClear } from '../utils/dataCache'

// ── Trip type definitions ─────────────────────────────────────
export const TRIP_TYPE_CONFIG = {
  one_way: {
    id:'one_way', label:'One Way', icon:'→', color:'blue',
    gradient:'from-blue-600 to-blue-500', bg:'bg-blue-50 dark:bg-blue-900/20',
    border:'border-blue-200 dark:border-blue-800/50',
    badge:'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    description:'Single direction trip from pickup to drop', fields:['pickup','drop'],
  },
  round_trip: {
    id:'round_trip', label:'Round Trip', icon:'⇄', color:'emerald',
    gradient:'from-emerald-600 to-teal-500', bg:'bg-emerald-50 dark:bg-emerald-900/20',
    border:'border-emerald-200 dark:border-emerald-800/50',
    badge:'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    description:'Return trip back to pickup location', fields:['pickup','destination','returnDate','returnTime'],
  },
  local_visit: {
    id:'local_visit', label:'Local Visit', icon:'📍', color:'violet',
    gradient:'from-violet-600 to-purple-500', bg:'bg-violet-50 dark:bg-violet-900/20',
    border:'border-violet-200 dark:border-violet-800/50',
    badge:'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    description:'Multiple stops within same city or region', fields:['baseLocation','stops','waitingTime'],
  },
  multi_day: {
    id:'multi_day', label:'Multi Day Trip', icon:'🗓', color:'amber',
    gradient:'from-amber-500 to-orange-500', bg:'bg-amber-50 dark:bg-amber-900/20',
    border:'border-amber-200 dark:border-amber-800/50',
    badge:'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    description:'Extended trip spanning multiple days', fields:['pickup','destination','numberOfDays'],
  },
  rental_with_driver: {
    id:'rental_with_driver', label:'Rental With Driver', icon:'🚗', color:'teal',
    gradient:'from-teal-600 to-cyan-500', bg:'bg-teal-50 dark:bg-teal-900/20',
    border:'border-teal-200 dark:border-teal-800/50',
    badge:'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
    description:'Hourly or daily vehicle rental with driver', fields:['pickupTime','returnTime','vehicle','driver'],
  },
  self_drive: {
    id:'self_drive', label:'Self Drive Rental', icon:'🔑', color:'rose',
    gradient:'from-rose-600 to-red-500', bg:'bg-rose-50 dark:bg-rose-900/20',
    border:'border-rose-200 dark:border-rose-800/50',
    badge:'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    description:'Customer drives the vehicle themselves', fields:['pickupTime','returnTime','securityDeposit','startKm','endKm'],
  },
}

export const TRIP_TYPE_LIST = Object.values(TRIP_TYPE_CONFIG)

// ── Booking status definitions ────────────────────────────────
export const BOOKING_STATUSES = [
  { key:'draft',     label:'Draft',       badge:'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',                dot:'bg-slate-400' },
  { key:'confirmed', label:'Confirmed',   badge:'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',          dot:'bg-violet-500' },
  { key:'assigned',  label:'Assigned',    badge:'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',                  dot:'bg-blue-500' },
  { key:'started',   label:'In Progress', badge:'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',              dot:'bg-amber-500 animate-pulse' },
  { key:'completed', label:'Completed',   badge:'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',      dot:'bg-emerald-500' },
  { key:'cancelled', label:'Cancelled',   badge:'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',                     dot:'bg-red-500' },
]

// Keep legacy alias for backward compat
export const TRIP_STATUSES = BOOKING_STATUSES

export const getStatusCfg = key => BOOKING_STATUSES.find(s => s.key === key) || BOOKING_STATUSES[0]

// ── Driver availability config ────────────────────────────────
export const DRIVER_AVAIL_CFG = {
  available: { label:'Available', badge:'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', dot:'bg-emerald-500' },
  driving:   { label:'Driving',   badge:'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',        dot:'bg-amber-500 animate-pulse' },
  offline:   { label:'Offline',   badge:'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',           dot:'bg-slate-400' },
  leave:     { label:'On Leave',  badge:'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',                dot:'bg-red-500' },
}

// ── Vehicle availability config ───────────────────────────────
export const VEHICLE_AVAIL_CFG = {
  available:   { label:'Available', badge:'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', dot:'bg-emerald-500' },
  assigned:    { label:'Assigned',  badge:'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',             dot:'bg-blue-500' },
  maintenance: { label:'Service',   badge:'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',                 dot:'bg-red-500' },
}

// ── Booking number generator ──────────────────────────────────
export function generateBookingNumber() {
  const d  = new Date()
  const y  = d.getFullYear().toString().slice(-2)
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const ts = Date.now().toString().slice(-4)
  return `BK-${y}${m}-${ts}`
}

// ── Supabase booking store ────────────────────────────────────
// All functions are async — callers must await them.

async function _loadBookings() {
  try {
    const rows = await tripRepository.getAll()
    return (Array.isArray(rows) ? rows : []).map(normalizeBooking)
  } catch (err) {
    console.error('[tripTypes] loadBookings failed:', err)
    return MOCK_BOOKINGS
  }
}
export const loadBookings = withCache('bookings', _loadBookings)


// Alias used in some pages
export const getBookings = loadBookings

export function normalizeBooking(row = {}) {
  const typeData = row.type_data && typeof row.type_data === 'object' ? row.type_data : {}
  return {
    ...typeData,
    ...row,
    id: row.id || row.booking_id,
    bookingNo: row.bookingNo ?? row.booking_number ?? row.booking_id ?? row.id ?? '',
    customer: row.customer ?? row.customer_name ?? '',
    contact: row.contact ?? row.customer_contact ?? '',
    driver: row.driver ?? row.driver_name ?? row.driver_id ?? '',
    vehicle: row.vehicle ?? row.vehicle_registration ?? row.vehicle_id ?? '',
    pickup: row.pickup ?? row.pickup_location ?? '',
    drop: row.drop ?? row.drop_location ?? '',
    startDate: row.startDate ?? row.start_date ?? '',
    startTime: row.startTime ?? row.start_time ?? '',
    returnDate: row.returnDate ?? row.end_date ?? '',
    returnTime: row.returnTime ?? row.end_time ?? '',
    km: Number(row.km ?? row.total_km ?? 0),
    fare: Number(row.fare ?? row.total_fare ?? row.base_fare ?? 0),
    createdAt: row.createdAt ?? row.created_at ?? '',
    updatedAt: row.updatedAt ?? row.updated_at ?? row.created_at ?? '',
  }
}

export async function saveBooking(booking) {
  try {
    const { id, ...rest } = booking
    const existing = id ? await tripRepository.getById(id) : null
    if (existing) {
      return await tripRepository.update(id, rest)
    }
    return await tripRepository.create({ id, ...rest })
  } catch (err) {
    console.error('[tripTypes] saveBooking failed:', err)
    return null
  }
}

export async function deleteBooking(id) {
  try {
    return await tripRepository.delete(id)
  } catch (err) {
    console.error('[tripTypes] deleteBooking failed:', err)
    return false
  }
}

export async function getBookingsByStatus(status) {
  try {
    return await tripRepository.getByStatus(status)
  } catch (err) {
    console.error('[tripTypes] getBookingsByStatus failed:', err)
    return []
  }
}

// ── Availability helpers ──────────────────────────────────────
export function getDriverAvailability(driverName, date, bookings, mockDriverStatus) {
  if (mockDriverStatus === 'on-leave') return 'leave'
  const conflict = (bookings ?? []).find(b =>
    b.driver === driverName &&
    b.startDate === date &&
    ['assigned','started'].includes(b.status)
  )
  if (conflict) return 'driving'
  return 'available'
}

export function getVehicleAvailability(vehicleReg, date, bookings, mockVehicleStatus) {
  if (mockVehicleStatus === 'maintenance') return 'maintenance'
  const conflict = (bookings ?? []).find(b =>
    b.vehicle === vehicleReg &&
    b.startDate === date &&
    ['assigned','started'].includes(b.status)
  )
  if (conflict) return 'assigned'
  return 'available'
}

// ── Seed / reference data (NOT merged into live queries) ─────
// Used only as fallback if Supabase is unreachable, and as
// documentation of the expected booking shape.
export const MOCK_BOOKINGS = [
  {
    id:'BK-2605-001', bookingNo:'BK-2605-001', type:'one_way', status:'completed',
    customer:'Rajan Kumar', contact:'9876543210',
    pickup:'Hotel Atithi, Puducherry', drop:'Chennai International Airport',
    startDate:'2026-05-28', startTime:'06:30', notes:'Carry name board',
    driver:'Ramanan', vehicle:'PY01CY1255', fare:3200, km:145,
    createdAt:'2026-05-26T10:00:00Z', createdBy:'manager',
  },
  {
    id:'BK-2605-002', bookingNo:'BK-2605-002', type:'round_trip', status:'assigned',
    customer:'Meena Devi', contact:'9123456789',
    pickup:'Puducherry Bus Stand', drop:'Bangalore',
    startDate:'2026-06-02', startTime:'08:00',
    returnDate:'2026-06-04', returnTime:'18:00',
    notes:'Corporate client',
    driver:'Babu', vehicle:'PY01DF1255', fare:14000, km:620,
    createdAt:'2026-05-27T09:15:00Z', createdBy:'admin',
  },
  {
    id:'BK-2605-003', bookingNo:'BK-2605-003', type:'local_visit', status:'confirmed',
    customer:'Suresh Pillai', contact:'9988776655',
    pickup:'Puducherry', drop:'Auroville · Paradise Beach · Chunnambar',
    startDate:'2026-06-01', startTime:'10:00', notes:'Family of 6',
    driver:null, vehicle:null, fare:2500, km:80,
    createdAt:'2026-05-28T11:30:00Z', createdBy:'manager',
  },
  {
    id:'BK-2605-004', bookingNo:'BK-2605-004', type:'multi_day', status:'draft',
    customer:'Ananya Singh', contact:'9012345678',
    pickup:'Puducherry', drop:'Tirupati – Bangalore – Mysore',
    startDate:'2026-06-05', startTime:'07:00', notes:'Pilgrimage + tourism',
    driver:null, vehicle:null, fare:28000, km:1200,
    createdAt:'2026-05-29T08:00:00Z', createdBy:'admin',
  },
  {
    id:'BK-2605-005', bookingNo:'BK-2605-005', type:'rental_with_driver', status:'started',
    customer:'Vikram Nair', contact:'8765432109',
    pickup:'Puducherry', drop:'City Tour',
    startDate:'2026-05-29', startTime:'09:00', notes:'Full day city rental',
    driver:'Babu', vehicle:'PY01DF1255', fare:4500, km:null,
    createdAt:'2026-05-29T07:00:00Z', createdBy:'manager',
  },
  {
    id:'BK-2605-006', bookingNo:'BK-2605-006', type:'one_way', status:'draft',
    customer:'Kavitha Selvan', contact:'9444123456',
    pickup:'Puducherry Railway Station', drop:'Chennai Central',
    startDate:'2026-06-03', startTime:'14:00', notes:'2 large bags',
    driver:null, vehicle:null, fare:3000, km:148,
    createdAt:'2026-05-30T14:00:00Z', createdBy:'manager',
  },
  {
    id:'BK-2605-007', bookingNo:'BK-2605-007', type:'one_way', status:'cancelled',
    customer:'Murugan Pillai', contact:'9876000111',
    pickup:'Auroville', drop:'Villupuram',
    startDate:'2026-05-31', startTime:'11:00', notes:'Cancelled by customer',
    driver:null, vehicle:null, fare:1200, km:55,
    createdAt:'2026-05-30T09:00:00Z', createdBy:'manager',
  },
]

// Backward compat alias
export const CREATED_TRIPS = MOCK_BOOKINGS

// ─── Booking form — pure helpers ──────────────────────────────────
// Shared by the premium Create Booking modal and its unit tests.
// Everything here is side-effect free: no Supabase, no DOM, no dates
// unless the caller supplies them. Field names deliberately match the
// existing booking shape (see src/data/tripTypes.js normalizeBooking).

export const BOOKING_FORM_DEFAULTS = Object.freeze({
  customer: '',
  contact: '',
  type: 'one_way',
  pickup: '',
  drop: '',
  startDate: '',
  startTime: '',
  returnDate: '',
  returnTime: '',
  notes: '',
  fare: '',
  bata: '',
  driverAllowance: '',
  status: 'draft',
})

export const AMOUNT_FIELDS = Object.freeze(['fare', 'driverAllowance', 'bata'])

export function toAmount(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

// Schedule fields are all backed by existing booking columns:
// startDate/startDate, startTime/start_time, returnDate/end_date,
// returnTime/end_time. No new database fields are introduced.
export const SCHEDULE_BY_TYPE = Object.freeze({
  one_way: [
    { key: 'startDate', label: 'Pickup date', inputType: 'date', required: true },
    { key: 'startTime', label: 'Pickup time', inputType: 'time' },
  ],
  round_trip: [
    { key: 'startDate', label: 'Pickup date', inputType: 'date', required: true },
    { key: 'startTime', label: 'Pickup time', inputType: 'time' },
    { key: 'returnDate', label: 'Return date', inputType: 'date' },
    { key: 'returnTime', label: 'Return time', inputType: 'time' },
  ],
  local_visit: [
    { key: 'startDate', label: 'Visit date', inputType: 'date', required: true },
    { key: 'startTime', label: 'Start time', inputType: 'time' },
    { key: 'returnTime', label: 'End time', inputType: 'time' },
  ],
  multi_day: [
    { key: 'startDate', label: 'Start date', inputType: 'date', required: true },
    { key: 'returnDate', label: 'End date', inputType: 'date' },
    { key: 'startTime', label: 'Pickup time', inputType: 'time' },
  ],
  rental_with_driver: [
    { key: 'startDate', label: 'Rental start date', inputType: 'date', required: true },
    { key: 'startTime', label: 'Start time', inputType: 'time' },
    { key: 'returnDate', label: 'Rental end date', inputType: 'date' },
    { key: 'returnTime', label: 'End time', inputType: 'time' },
  ],
  self_drive: [
    { key: 'startDate', label: 'Rental start date', inputType: 'date', required: true },
    { key: 'startTime', label: 'Start time', inputType: 'time' },
    { key: 'returnDate', label: 'Rental end date', inputType: 'date' },
    { key: 'returnTime', label: 'End time', inputType: 'time' },
  ],
})

export function scheduleFieldsFor(type) {
  return SCHEDULE_BY_TYPE[type] || SCHEDULE_BY_TYPE.one_way
}

export function validateBookingForm(form = {}) {
  const errors = {}
  if (!String(form.customer ?? '').trim()) errors.customer = 'Customer name is required'
  if (!form.type) errors.type = 'Choose a trip type'
  if (!String(form.pickup ?? '').trim()) errors.pickup = 'Pickup location is required'
  if (!form.startDate) errors.startDate = 'Pickup date is required'
  if (form.contact && !/^\d{10}$/.test(String(form.contact))) {
    errors.contact = 'Enter a valid 10-digit mobile number'
  }
  if (form.returnDate && form.startDate && form.returnDate < form.startDate) {
    errors.returnDate = 'Return date must be on or after the start date'
  }
  return errors
}

// Mirrors the previous BookingModal.handleSave payload exactly — same field
// names, same Number()||0 coercion, same driver/vehicle null defaults.
export function buildBookingPayload(form = {}, options = {}) {
  const {
    userName = 'manager',
    now = new Date().toISOString(),
    newId = '',
    newBookingNo = '',
  } = options
  return {
    ...form,
    id: form.id || newId,
    bookingNo: form.bookingNo || newBookingNo,
    fare: toAmount(form.fare),
    bata: toAmount(form.bata),
    driverAllowance: toAmount(form.driverAllowance),
    createdAt: form.createdAt || now,
    updatedAt: now,
    createdBy: form.createdBy || userName || 'manager',
    driver: form.driver || null,
    vehicle: form.vehicle || null,
  }
}

// Amounts are reported separately on purpose: driver allowance and bata are
// NOT assumed to be part of the customer fare. No arithmetic is changed.
export function pricingBreakdown(form = {}) {
  return {
    fare: toAmount(form.fare),
    driverAllowance: toAmount(form.driverAllowance),
    bata: toAmount(form.bata),
  }
}

export const formatINR = value =>
  `₹${toAmount(value).toLocaleString('en-IN')}`

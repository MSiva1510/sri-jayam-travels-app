// ─── Attendance derived from trips ────────────────────────────
// Pure helpers (no Supabase) so the rules can be unit-tested and shared by
// the Attendance page, the Payroll page and the payslip view.
//
// Rule set:
//   • a completed / closed trip on a date      → Present (worked that day)
//   • an assigned trip that was never completed
//     and whose date is already past            → Absent (no-show)
//   • a past date with no trip assigned         → Leave / Off
//   • a manual attendance row always wins over any trip-derived value
//
// One trip counts for its start date only — the same "one trip = one day"
// model payroll uses, so attendance and payslips can never disagree.

export const ATTENDANCE_STATUS = {
  PRESENT: 'present',
  ABSENT: 'absent',
  LEAVE: 'leave',
  UNKNOWN: 'unknown',
}

const CANCELLED = new Set(['cancelled', 'canceled'])
const COMPLETED = new Set(['completed', 'closed'])

// Local calendar date — `toISOString()` is UTC and rolls over to the next
// day at 05:30 IST, which used to put the app a day behind in the morning.
export function localDateISO(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function normalizeName(name) {
  return String(name ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

const compactName = (name) => normalizeName(name).replace(/[^a-z0-9]/g, '')

// Map a name as typed in a trip (or an old attendance row) onto a driver
// record. Trips are free-text, so "babu" / "Babu" and the truncated
// "Rajasekhara" / "Rajasekharan" must land on the same driver.
export function resolveDriverName(name, drivers = []) {
  const raw = String(name ?? '').trim()
  if (!raw) return ''
  const list = (drivers || []).filter(d => d && d.name)
  const exact = list.find(d => d.name === raw)
  if (exact) return exact.name
  const norm = normalizeName(raw)
  const ci = list.find(d => normalizeName(d.name) === norm)
  if (ci) return ci.name
  const compact = compactName(raw)
  if (!compact) return raw
  const compactExact = list.filter(d => compactName(d.name) === compact)
  if (compactExact.length === 1) return compactExact[0].name
  // Truncated spellings only: at least 5 characters, at most 3 apart.
  const near = list.filter(d => {
    const dn = compactName(d.name)
    const shorter = compact.length <= dn.length ? compact : dn
    const longer = compact.length <= dn.length ? dn : compact
    return shorter.length >= 5 && longer.length - shorter.length <= 3 && longer.startsWith(shorter)
  })
  return near.length === 1 ? near[0].name : raw
}

export function tripDate(trip = {}) {
  return String(trip.startDate ?? trip.start_date ?? trip.date ?? '').slice(0, 10)
}

export function tripDriver(trip = {}) {
  return trip.driver ?? trip.driver_name ?? trip.driverName ?? ''
}

function tripStatus(trip = {}) {
  return String(trip.status ?? '').trim().toLowerCase()
}

export function isCompletedTrip(trip = {}) {
  return COMPLETED.has(tripStatus(trip))
}

export function isCancelledTrip(trip = {}) {
  return CANCELLED.has(tripStatus(trip))
}

// Supabase returns snake_case; the UI reads short aliases.
export function normalizeAttendanceRow(row = {}) {
  if (!row || typeof row !== 'object') return row
  const rawDate = row.date ?? row.attendance_date ?? row.attendanceDate ?? ''
  const date = String(rawDate).slice(0, 10)
  const driver = row.driver ?? row.driver_name ?? row.driverName ?? ''
  const rawVehicle = row.vehicle ?? row.vehicle_assigned ?? ''
  // vehicle_assigned holds a vehicles.id UUID, not a registration — don't
  // render it as a plate. The page resolves it against the vehicles list.
  const vehicleIsId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(rawVehicle))
  return {
    ...row,
    driver,
    driver_name: row.driver_name ?? driver,
    driverId: row.driverId ?? row.driver_id ?? null,
    driver_id: row.driver_id ?? row.driverId ?? null,
    date,
    attendance_date: row.attendance_date ?? date,
    status: row.status || 'present',
    checkIn: row.checkIn ?? row.check_in ?? null,
    check_in: row.check_in ?? row.checkIn ?? null,
    checkOut: row.checkOut ?? row.check_out ?? null,
    check_out: row.check_out ?? row.checkOut ?? null,
    vehicle: vehicleIsId ? '' : rawVehicle,
    vehicleId: vehicleIsId ? String(rawVehicle) : (row.vehicleId ?? row.vehicle_id ?? null),
    workingHours: row.workingHours ?? row.working_hours ?? null,
    working_hours: row.working_hours ?? row.workingHours ?? null,
    tripSessions: row.tripSessions ?? row.trip_sessions ?? [],
    tripWorkingMinutes: row.tripWorkingMinutes ?? null,
    leaveType: row.leaveType ?? row.leave_type ?? null,
    notes: row.notes ?? '',
    source: 'manual',
  }
}

function findManualRecord(records, driverName, driverId, date) {
  const target = normalizeName(driverName)
  return (records || []).find(r => {
    if (!r || String(r.date ?? r.attendance_date ?? '').slice(0, 10) !== date) return false
    if (driverId && r.driverId && r.driverId === driverId) return true
    if (driverId && r.driver_id && r.driver_id === driverId) return true
    return normalizeName(r.driver ?? r.driver_name) === target
  }) || null
}

// One driver, one date.
export function buildDayStatus({
  driverName,
  driverId = null,
  date,
  records = [],
  bookings = [],
  drivers = [],
  today = localDateISO(),
} = {}) {
  const target = normalizeName(driverName)
  const record = findManualRecord(records, driverName, driverId, date)

  const trips = (bookings || []).filter(b => {
    if (!b || isCancelledTrip(b)) return false
    if (tripDate(b) !== date) return false
    return normalizeName(resolveDriverName(tripDriver(b), drivers)) === target
  })
  const completed = trips.filter(isCompletedTrip)
  const pending = trips.filter(b => !isCompletedTrip(b))
  const vehicle = completed[0]?.vehicle ?? completed[0]?.vehicle_reg ?? trips[0]?.vehicle ?? trips[0]?.vehicle_reg ?? ''
  const tripCount = completed.length

  const base = {
    driver: driverName,
    driverId,
    date,
    trips,
    completedTrips: completed,
    tripCount,
    vehicle,
    record: record || null,
    checkIn: record?.checkIn ?? record?.check_in ?? trips[0]?.startTime ?? trips[0]?.start_time ?? null,
    checkOut: record?.checkOut ?? record?.check_out ?? (completed[0]?.endTime ?? completed[0]?.end_time ?? null),
    workingHours: record?.workingHours ?? record?.working_hours ?? null,
    tripWorkingMinutes: record?.tripWorkingMinutes ?? null,
    tripSessions: record?.tripSessions ?? [],
  }

  // 1. Manual attendance always wins.
  if (record) {
    const status = String(record.status || 'present').toLowerCase()
    return {
      ...base,
      status,
      source: 'manual',
      note: record.leaveType || record.leave_type
        ? `Marked manually · ${record.leaveType || record.leave_type}`
        : 'Marked manually',
    }
  }

  // 2. A completed trip means the driver worked.
  if (completed.length > 0) {
    return {
      ...base,
      status: ATTENDANCE_STATUS.PRESENT,
      source: 'trip',
      note: `${completed.length} completed trip${completed.length !== 1 ? 's' : ''}`,
    }
  }

  // 3. Assigned but not completed. On/after today they are still on duty;
  //    once the date is past it becomes a no-show.
  if (pending.length > 0) {
    const isPast = date < today
    return {
      ...base,
      status: isPast ? ATTENDANCE_STATUS.ABSENT : ATTENDANCE_STATUS.PRESENT,
      source: isPast ? 'trip-missed' : 'trip-scheduled',
      note: isPast
        ? `${pending.length} assigned trip${pending.length !== 1 ? 's' : ''} not completed`
        : 'Assigned trip — on duty',
    }
  }

  // 4. Nothing assigned: a past day counts as an off day (leave).
  if (date <= today) {
    return {
      ...base,
      status: ATTENDANCE_STATUS.LEAVE,
      source: 'no-trip',
      note: 'No trip assigned',
    }
  }

  return { ...base, status: ATTENDANCE_STATUS.UNKNOWN, source: 'future', note: 'Date is in the future' }
}

function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00`)
  d.setDate(d.getDate() + days)
  return localDateISO(d)
}

// Whole month, day by day (never beyond today). Used by payroll/payslips.
export function buildMonthSummary({
  driverName,
  driverId = null,
  monthKey,
  records = [],
  bookings = [],
  drivers = [],
  today = localDateISO(),
  joinedDate = null,
} = {}) {
  const monthStart = `${monthKey}-01`
  const [y, m] = monthKey.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  const monthEnd = `${monthKey}-${String(lastDay).padStart(2, '0')}`
  const end = today < monthEnd ? today : monthEnd
  const start = joinedDate && joinedDate > monthStart ? String(joinedDate).slice(0, 10) : monthStart

  const days = []
  if (start <= end) {
    let cursor = start
    while (cursor <= end) {
      days.push(buildDayStatus({ driverName, driverId, date: cursor, records, bookings, drivers, today }))
      cursor = addDays(cursor, 1)
    }
  }

  const presentDays = days.filter(d => d.status === ATTENDANCE_STATUS.PRESENT || d.status === 'half-day').length
  const absentDays = days.filter(d => d.status === ATTENDANCE_STATUS.ABSENT).length
  const leaveDays = days.filter(d => d.status === ATTENDANCE_STATUS.LEAVE).length
  const tripDays = days.filter(d => d.source === 'trip').length

  return {
    driver: driverName,
    driverId,
    monthKey,
    days,
    presentDays,
    absentDays,
    leaveDays,
    tripDays,
    totalDays: days.length,
    absentDates: days.filter(d => d.status === ATTENDANCE_STATUS.ABSENT).map(d => d.date),
    leaveDates: days.filter(d => d.status === ATTENDANCE_STATUS.LEAVE).map(d => d.date),
  }
}

// Last `count` days, newest first. Used by the driver-facing view.
export function buildRecentDays({
  driverName,
  driverId = null,
  count = 14,
  records = [],
  bookings = [],
  drivers = [],
  today = localDateISO(),
} = {}) {
  const out = []
  for (let i = 0; i < count; i++) {
    const date = addDays(today, -i)
    out.push(buildDayStatus({ driverName, driverId, date, records, bookings, drivers, today }))
  }
  return out
}

// Canonical names for a month: registered drivers + any driver named on a
// trip that month + any manual attendance row that month.
export function driverNamesForMonth({ drivers = [], bookings = [], records = [], monthKey } = {}) {
  const names = new Set()
  const add = (name) => {
    const resolved = resolveDriverName(name, drivers)
    if (resolved) names.add(resolved)
  }
  ;(drivers || []).forEach(d => { if (d?.name) add(d.name) })
  ;(bookings || []).forEach(b => {
    if ((tripDate(b) || '').startsWith(monthKey) && !isCancelledTrip(b) && tripDriver(b)) add(tripDriver(b))
  })
  ;(records || []).forEach(r => {
    if (String(r.date ?? r.attendance_date ?? '').startsWith(monthKey)) add(r.driver ?? r.driver_name)
  })
  return [...names].sort((a, b) => a.localeCompare(b))
}

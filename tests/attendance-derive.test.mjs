// Pins the trip-derived attendance rules shared by the Attendance page and
// payroll/payslips:
//   • completed / closed trip  → present
//   • assigned trip, past date → absent (no-show)
//   • past date, no trip       → leave / off
//   • a manual attendance row always overrides the derived value
// One trip counts for its start date only ("one trip = one day").

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  localDateISO, normalizeName, resolveDriverName, normalizeAttendanceRow,
  buildDayStatus, buildMonthSummary, buildRecentDays, driverNamesForMonth,
  ATTENDANCE_STATUS,
} from '../src/data/attendanceDerive.js'

const DRIVERS = [
  { id: 'd-babu',       name: 'Babu' },
  { id: 'd-raj',        name: 'Rajasekharan' },
  { id: 'd-raman',      name: 'Ramanan' },
  { id: 'd-kalidass',   name: 'Kalidass' },
]

const TODAY = '2026-11-16'

const trip = (over = {}) => ({
  id: over.id || 'b1',
  driver: 'Babu',
  startDate: '2026-11-04',
  status: 'completed',
  ...over,
})

test('localDateISO uses the local calendar date, not UTC', () => {
  // 2026-11-16 00:30 IST is still 2026-11-15 in UTC.
  const d = new Date(2026, 10, 16, 0, 30)
  assert.equal(localDateISO(d), '2026-11-16')
})

test('normalizeName is trim + case insensitive', () => {
  assert.equal(normalizeName('  BABU  '), 'babu')
  assert.equal(normalizeName(null), '')
})

test('resolveDriverName maps free-text trip names onto driver records', () => {
  assert.equal(resolveDriverName('babu', DRIVERS), 'Babu')
  assert.equal(resolveDriverName('BABU', DRIVERS), 'Babu')
  assert.equal(resolveDriverName('Rajasekhara', DRIVERS), 'Rajasekharan')
  assert.equal(resolveDriverName('Ramanan', DRIVERS), 'Ramanan')
  // Unknown names pass through unchanged so nothing is silently dropped.
  assert.equal(resolveDriverName('Vijay', DRIVERS), 'Vijay')
  assert.equal(resolveDriverName('', DRIVERS), '')
})

test('normalizeAttendanceRow maps snake_case columns to UI aliases', () => {
  const r = normalizeAttendanceRow({
    id: 'a1',
    driver_name: 'Babu',
    driver_id: 'd-babu',
    attendance_date: '2026-11-02T00:00:00+00:00',
    status: 'present',
    check_in: '09:00',
    check_out: '18:00',
    working_hours: '9 hours',
    vehicle_assigned: 'bdfc3456-4677-443f-8883-53c2298007e0',
    notes: 'Checked in from mobile app',
  })
  assert.equal(r.driver, 'Babu')
  assert.equal(r.driverId, 'd-babu')
  assert.equal(r.date, '2026-11-02')
  assert.equal(r.checkIn, '09:00')
  assert.equal(r.checkOut, '18:00')
  assert.equal(r.workingHours, '9 hours')
  assert.equal(r.notes, 'Checked in from mobile app')
  // vehicle_assigned holds a UUID, never shown as a plate
  assert.equal(r.vehicle, '')
  assert.equal(r.vehicleId, 'bdfc3456-4677-443f-8883-53c2298007e0')
})

test('completed trip on a date → present', () => {
  const day = buildDayStatus({
    driverName: 'Babu', driverId: 'd-babu', date: '2026-11-04',
    records: [], bookings: [trip({ startDate: '2026-11-04', status: 'completed' })],
    drivers: DRIVERS, today: TODAY,
  })
  assert.equal(day.status, ATTENDANCE_STATUS.PRESENT)
  assert.equal(day.source, 'trip')
  assert.equal(day.tripCount, 1)
  assert.equal(day.completedTrips.length, 1)
})

test('closed trip also counts as present, cancelled trips never do', () => {
  const closed = buildDayStatus({
    driverName: 'Kalidass', date: '2026-11-10',
    records: [], bookings: [trip({ driver: 'Kalidass', startDate: '2026-11-10', status: 'closed' })],
    drivers: DRIVERS, today: TODAY,
  })
  assert.equal(closed.status, ATTENDANCE_STATUS.PRESENT)

  const cancelled = buildDayStatus({
    driverName: 'Rajasekharan', date: '2026-10-30',
    records: [], bookings: [trip({ driver: 'Rajasekharan', startDate: '2026-10-30', status: 'cancelled' })],
    drivers: DRIVERS, today: TODAY,
  })
  assert.equal(cancelled.status, ATTENDANCE_STATUS.LEAVE)
})

test('assigned trip that was never completed, past date → absent', () => {
  const day = buildDayStatus({
    driverName: 'Babu', date: '2026-11-05',
    records: [], bookings: [trip({ startDate: '2026-11-05', status: 'approved' })],
    drivers: DRIVERS, today: TODAY,
  })
  assert.equal(day.status, ATTENDANCE_STATUS.ABSENT)
  assert.equal(day.source, 'trip-missed')
})

test('assigned trip on/after today is "on duty", not absent', () => {
  const day = buildDayStatus({
    driverName: 'Babu', date: TODAY,
    records: [], bookings: [trip({ startDate: TODAY, status: 'approved' })],
    drivers: DRIVERS, today: TODAY,
  })
  assert.equal(day.status, ATTENDANCE_STATUS.PRESENT)
  assert.equal(day.source, 'trip-scheduled')
})

test('past date with no trip → leave / off', () => {
  const day = buildDayStatus({
    driverName: 'Babu', date: '2026-11-06',
    records: [], bookings: [], drivers: DRIVERS, today: TODAY,
  })
  assert.equal(day.status, ATTENDANCE_STATUS.LEAVE)
  assert.equal(day.source, 'no-trip')
})

test('future date with no trip → unknown, not leave', () => {
  const day = buildDayStatus({
    driverName: 'Babu', date: '2026-11-20',
    records: [], bookings: [], drivers: DRIVERS, today: TODAY,
  })
  assert.equal(day.status, ATTENDANCE_STATUS.UNKNOWN)
})

test('a manual attendance row always overrides the derived value', () => {
  const records = [normalizeAttendanceRow({
    driver_name: 'Babu', attendance_date: '2026-11-04', status: 'leave',
  })]
  const day = buildDayStatus({
    driverName: 'Babu', driverId: 'd-babu', date: '2026-11-04',
    records,
    bookings: [trip({ startDate: '2026-11-04', status: 'completed' })],
    drivers: DRIVERS, today: TODAY,
  })
  assert.equal(day.status, 'leave')
  assert.equal(day.source, 'manual')
})

test('manual row is found by driver id even when the stored name differs', () => {
  const records = [normalizeAttendanceRow({
    driver_id: 'd-babu', driver_name: 'babu', attendance_date: '2026-11-02', status: 'present',
  })]
  const day = buildDayStatus({
    driverName: 'Babu', driverId: 'd-babu', date: '2026-11-02',
    records, bookings: [], drivers: DRIVERS, today: TODAY,
  })
  assert.equal(day.source, 'manual')
  assert.equal(day.status, 'present')
})

test('trip names resolve before matching the driver', () => {
  const day = buildDayStatus({
    driverName: 'Rajasekharan', date: '2026-11-04',
    records: [],
    bookings: [trip({ driver: 'Rajasekhara', startDate: '2026-11-04', status: 'closed' })],
    drivers: DRIVERS, today: TODAY,
  })
  assert.equal(day.status, ATTENDANCE_STATUS.PRESENT)
  assert.equal(day.tripCount, 1)
})

test('buildMonthSummary counts present / absent / leave for elapsed days', () => {
  const bookings = [
    trip({ id: 't1', driver: 'Babu', startDate: '2026-11-02', status: 'completed' }),
    trip({ id: 't2', driver: 'Babu', startDate: '2026-11-04', status: 'approved' }), // no-show
  ]
  const summary = buildMonthSummary({
    driverName: 'Babu', driverId: 'd-babu', monthKey: '2026-11',
    records: [], bookings, drivers: DRIVERS, today: TODAY,
  })
  // Nov 1..16 = 16 elapsed days
  assert.equal(summary.totalDays, 16)
  assert.equal(summary.presentDays, 1)
  assert.equal(summary.absentDays, 1)
  assert.equal(summary.leaveDays, 14)
  assert.deepEqual(summary.absentDates, ['2026-11-04'])
  assert.ok(summary.leaveDates.includes('2026-11-06'))
})

test('buildMonthSummary never reaches beyond today', () => {
  const summary = buildMonthSummary({
    driverName: 'Babu', monthKey: '2026-11', records: [], bookings: [],
    drivers: DRIVERS, today: TODAY,
  })
  assert.equal(summary.days[summary.days.length - 1].date, TODAY)
})

test('buildMonthSummary respects a mid-month joining date', () => {
  const summary = buildMonthSummary({
    driverName: 'Babu', monthKey: '2026-11', records: [], bookings: [],
    drivers: DRIVERS, today: TODAY, joinedDate: '2026-11-11',
  })
  assert.equal(summary.totalDays, 6) // 11..16
  assert.equal(summary.days[0].date, '2026-11-11')
})

test('a past month counts the full month', () => {
  const summary = buildMonthSummary({
    driverName: 'Babu', monthKey: '2026-10', records: [], bookings: [],
    drivers: DRIVERS, today: TODAY,
  })
  assert.equal(summary.totalDays, 31)
})

test('buildRecentDays returns newest first and stops at today', () => {
  const days = buildRecentDays({
    driverName: 'Babu', count: 3, records: [], bookings: [],
    drivers: DRIVERS, today: TODAY,
  })
  assert.deepEqual(days.map(d => d.date), ['2026-11-16', '2026-11-15', '2026-11-14'])
})

test('driverNamesForMonth unions drivers, trip names and manual rows', () => {
  const names = driverNamesForMonth({
    drivers: DRIVERS,
    bookings: [trip({ driver: 'Vijay', startDate: '2026-11-03' })],
    records: [normalizeAttendanceRow({ driver_name: 'mani', attendance_date: '2026-11-01' })],
    monthKey: '2026-11',
  })
  assert.ok(names.includes('Babu'))
  assert.ok(names.includes('Vijay'))
  assert.ok(names.includes('mani'))
  assert.ok(names.includes('Rajasekharan'))
})

test('driverNamesForMonth ignores other months and cancelled trips', () => {
  const names = driverNamesForMonth({
    drivers: [],
    bookings: [
      trip({ driver: 'Vijay', startDate: '2026-10-03' }),
      trip({ driver: 'Arul', startDate: '2026-11-03', status: 'cancelled' }),
    ],
    records: [],
    monthKey: '2026-11',
  })
  assert.deepEqual(names, [])
})

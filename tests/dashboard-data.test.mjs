import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildDashboardData,
  buildDocumentAlerts,
  deriveGpsStatus,
  formatINR,
  toLocalMonthStr,
} from '../src/utils/dashboardData.js'

const now = new Date(2026, 10, 20, 12, 0, 0)
const nowMs = now.getTime()
const monthKey = toLocalMonthStr(now)
const prevMonthKey = toLocalMonthStr(new Date(2026, 9, 1, 12, 0, 0))

const booking = (overrides = {}) => ({
  id: 'b', status: 'completed', startDate: `${monthKey}-05`,
  fare: 1000, km: 20, driver: 'Ravi', vehicle: 'TN01 AB 1234', ...overrides,
})

const expense = (overrides = {}) => ({
  id: 'e', date: `${monthKey}-06`, amount: 200, type: 'fuel', ...overrides,
})

function dateFromToday(days) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

test('period KPIs preserve the original fare, kilometre and expense formulas', () => {
  const data = buildDashboardData({
    bookings: [
      booking({ id: 'b1', fare: 1000, km: 20 }),
      booking({ id: 'b2', status: 'started', fare: 500, km: 10 }),
      booking({ id: 'b3', status: 'cancelled', fare: 9000, km: 90 }),
      booking({ id: 'b4', startDate: `${prevMonthKey}-05`, fare: 800, km: 15 }),
    ],
    allExpenses: [expense({ amount: 200 }), expense({ id: 'e2', amount: 100, type: 'toll' })],
    period: 'month', now, nowMs,
  })

  assert.equal(data.totals.fare, 1500)
  assert.equal(data.totals.km, 30)
  assert.equal(data.totals.expenses, 300)
  assert.equal(data.totals.net, 1200)
  assert.equal(data.bookingCounts.cancelled, 1)
  assert.equal(data.allTime.fare, 2300, 'all-time revenue excludes cancelled but includes other months')
  assert.equal(data.deltas.fare, 87.5, 'previous month comparison uses real loaded data')
  assert.equal(data.trend.data.length, 6)
  assert.equal(data.trend.margin, 80)
  assert.equal(formatINR(1234567), 'Rs. 12,34,567')
})

test('manager KPI counters include pending bills', () => {
  const data = buildDashboardData({
    bookings: [
      booking({ id: 'b1', status: 'confirmed' }),
      booking({ id: 'b2', status: 'completed' }),
    ],
    now, nowMs,
  })

  assert.equal(data.bookingCounts.total, 2)
  assert.equal(data.bookingCounts.pending, 1)
})

test('year mode uses Jan–Dec of the selected year', () => {
  const data = buildDashboardData({
    bookings: [
      booking({ id: 'b1', startDate: '2026-01-04', fare: 400 }),
      booking({ id: 'b2', startDate: '2025-12-20', fare: 700 }),
    ],
    period: 'year', now, nowMs,
  })
  assert.equal(data.trend.data.length, 12)
  assert.equal(data.totals.fare, 400)
  assert.equal(data.trend.data[0].fare, 400)
})

test('document alerts sort expired first and include driver licences', () => {
  const alerts = buildDocumentAlerts({
    vehicles: [{
      reg: 'TN01 AB 1234',
      insExpiry: dateFromToday(-2),
      permitExpiry: dateFromToday(10),
      fcExpiry: dateFromToday(200),
    }],
    drivers: [
      { id: 'd1', name: 'Ravi', license_expiry: dateFromToday(-1) },
      { id: 'd2', name: 'Kumar', licenseExpiry: dateFromToday(400) },
    ],
  })

  assert.deepEqual(alerts.alerts.map(a => a.status.key), ['expired', 'expired', 'soon'])
  assert.deepEqual(alerts.alerts.slice(0, 2).map(alert => alert.kind).sort(), ['Driver', 'Vehicle'])
  assert.equal(alerts.expiredCount, 2)
  assert.equal(alerts.soonCount, 1)
  assert.equal(alerts.validCount, 2)
  assert.equal(alerts.alerts.every(alert => alert.to === '/drivers' || alert.to === '/vehicles'), true)
})

test('GPS stale fixes are never reported as live', () => {
  const fresh = deriveGpsStatus({
    running: true, health: { ok: true }, settings: { enabled: true },
    snapshots: [{ timestamp: new Date(nowMs - 60_000).toISOString(), speed_kmh: 12 }],
  }, nowMs)
  assert.equal(fresh.state, 'live')
  assert.equal(fresh.counts.moving, 1)

  const stale = deriveGpsStatus({
    running: true, health: { ok: true }, settings: { enabled: true },
    snapshots: [{ timestamp: new Date(nowMs - 11 * 60_000).toISOString(), speed_kmh: 12 }],
  }, nowMs)
  assert.equal(stale.state, 'stale')
  assert.equal(stale.isLive, false)
  assert.equal(stale.counts.offline, 1)

  const disconnected = deriveGpsStatus({
    running: true, health: { ok: false, lastError: 'provider down' }, settings: { enabled: true },
  }, nowMs)
  assert.equal(disconnected.state, 'disconnected')

  const paused = deriveGpsStatus({ running: false, settings: { enabled: false } }, nowMs)
  assert.equal(paused.state, 'paused')

  const noData = deriveGpsStatus({ running: true, health: { ok: true } }, nowMs)
  assert.equal(noData.state, 'no-data')
})

test('attention queue keeps the original permission gates', () => {
  const base = {
    bookings: [booking({ id: 'b1', status: 'assigned', driver: '' })],
    allExpenses: [expense({ status: 'submitted' })],
    vehicles: [{ reg: 'TN01 AB 1234', fcExpiry: dateFromToday(5) }],
    settlements: [{ status: 'pending', netAmount: 100 }],
    now, nowMs,
  }
  const limited = buildDashboardData({ ...base, can: key => key === 'trips' })
  assert.deepEqual(limited.attentionItems.map(item => item.to), ['/trips'])

  const manager = buildDashboardData({ ...base, can: key => ['trips', 'expenses', 'vehicles', 'payroll'].includes(key) })
  assert.deepEqual(manager.attentionItems.map(item => item.to), ['/trips', '/expenses', '/vehicles', '/payroll'])
})

test('payroll list covers every driver, including drivers without settlements', () => {
  const data = buildDashboardData({
    drivers: [
      { id: 'd1', name: 'Ravi' },
      { id: 'd2', name: 'Kumar' },
      { id: 'd3', name: 'Selvan' },
    ],
    settlements: [
      { driver: 'Ravi', status: 'paid', netAmount: 8400 },
      { driver: 'Kumar', status: 'pending', netAmount: 3200 },
    ],
    now, nowMs,
  })

  assert.deepEqual(data.payroll.drivers, [
    { id: 'd1', name: 'Ravi', status: 'paid', amount: 8400 },
    { id: 'd2', name: 'Kumar', status: 'pending', amount: 3200 },
    { id: 'd3', name: 'Selvan', status: 'none', amount: 0 },
  ])
  assert.equal(data.payroll.total, 2, 'settlement count must not include driver rows')
})

test('losses keep a negative margin and today counters stay local', () => {
  const data = buildDashboardData({
    bookings: [booking({ id: 'b1', fare: 100, type: 'outstation', startDate: `${monthKey}-20` })],
    allExpenses: [expense({ id: 'e1', amount: 300 })],
    drivers: [{ id: 'd1', name: 'Ravi' }],
    today: now,
    now,
    nowMs,
  })

  assert.equal(data.trend.margin, -200, 'negative net income must not be clamped to 0%')
  assert.equal(data.todayCounts.total, 1)
  assert.equal(data.driverCounts.total, 1)
  assert.equal(data.recentTrips[0].type, 'outstation')
  assert.equal(data.recentTrips[0].startTime, null)
})

test('attendance counts are zero only when attendance rows loaded', () => {
  const withRows = buildDashboardData({
    todayAttendance: [{ status: 'present' }, { status: 'present' }, { status: 'leave' }],
    now, nowMs,
  })
  assert.deepEqual(withRows.attendance, { present: 2, leave: 1 })

  const empty = buildDashboardData({ now, nowMs })
  assert.deepEqual(empty.attendance, { present: 0, leave: 0 })
})

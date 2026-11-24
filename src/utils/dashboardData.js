// ─── Dashboard derived data ────────────────────────────────────
// Pure calculations for the manager dashboard. The page owns loading and
// permissions; this module only turns loaded rows into the values the UI
// renders. Keeping the formulas here makes them testable without a browser
// and prevents the redesign from silently changing business logic.

import { getExpenseDate, isThisMonth, summariseByType } from './expenseHelpers.js'
import { docStatus } from './vehicleUtils.js'

const TEN_MINUTES = 10 * 60 * 1000
const SEVERITY = { expired: 0, soon: 1, active: 2, unknown: 3 }

export const toLocalDateStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const toLocalMonthStr = (d = new Date()) => toLocalDateStr(d).slice(0, 7)

export const formatINR = value => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`

const sumAmount = (rows, key) => rows.reduce((total, row) => total + (Number(row?.[key]) || 0), 0)

export function deltaPct(current, previous) {
  const prev = Number(previous)
  const cur = Number(current)
  if (!(prev > 0)) return cur > 0 ? 100 : undefined
  return Math.round(((cur - prev) / prev) * 1000) / 10
}

export function relativeTime(timestamp, now = Date.now()) {
  if (!timestamp) return 'never'
  const seconds = Math.round((now - timestamp) / 1000)
  if (seconds < 0) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(timestamp).toLocaleString('en-IN')
}

// ── GPS connection summary ─────────────────────────────────────
// Counts deliberately match the previous dashboard: a fix older than ten
// minutes is offline, even when the sync service itself is still running.
// The connection label is stricter so stale fixes are never called "Live".
export function deriveGpsStatus({
  snapshots = [], settings = {}, health = {}, running = false, error = null,
} = {}, now = Date.now()) {
  const counts = { moving: 0, stopped: 0, idle: 0, offline: 0 }
  let lastSnapshotTs = 0

  snapshots.forEach(snapshot => {
    const ts = snapshot.timestamp ? new Date(snapshot.timestamp).getTime() : 0
    if (Number.isFinite(ts) && ts > lastSnapshotTs) lastSnapshotTs = ts
    if (!ts || now - ts > TEN_MINUTES) { counts.offline += 1; return }
    if (Number(snapshot.speed_kmh ?? 0) > 0) counts.moving += 1
    else if (snapshot.ignition === true) counts.idle += 1
    else counts.stopped += 1
  })

  const healthTs = health?.lastSuccess ? Date.parse(health.lastSuccess) : 0
  const lastSuccessTs = Math.max(
    Number.isFinite(lastSnapshotTs) ? lastSnapshotTs : 0,
    Number.isFinite(healthTs) ? healthTs : 0,
  )
  const age = lastSuccessTs ? now - lastSuccessTs : null
  const interval = Math.max(5, Number(settings?.refresh_interval ?? 60))

  let state = 'live'
  let label = 'Live'
  let tone = 'green'
  if (settings?.enabled === false) {
    state = 'paused'; label = 'Paused'; tone = 'amber'
  } else if (error || health?.ok === false) {
    state = 'disconnected'; label = 'Disconnected'; tone = 'red'
  } else if (!running) {
    state = 'paused'; label = 'Paused'; tone = 'amber'
  } else if (age !== null && age > TEN_MINUTES) {
    state = 'stale'; label = 'Stale data'; tone = 'amber'
  } else if (!snapshots.length) {
    state = 'no-data'; label = 'No data'; tone = 'gray'
  }

  return {
    counts,
    lastSuccessTs,
    lastUpdate: relativeTime(lastSuccessTs, now),
    interval,
    state,
    label,
    tone,
    isLive: state === 'live',
  }
}

// ── Expiry alerts ──────────────────────────────────────────────
export function buildDocumentAlerts({ vehicles = [], drivers = [] } = {}) {
  const all = []

  vehicles.forEach(vehicle => {
    const registration = vehicle.reg || vehicle.registration || 'Unregistered vehicle'
    ;[
      { label: `${registration} Insurance`, expiry: vehicle.insExpiry || vehicle.insurance_expiry, to: '/vehicles', kind: 'Vehicle' },
      { label: `${registration} Permit`, expiry: vehicle.permitExpiry || vehicle.permit_expiry, to: '/vehicles', kind: 'Vehicle' },
      { label: `${registration} FC`, expiry: vehicle.fcExpiry || vehicle.fc_expiry, to: '/vehicles', kind: 'Vehicle' },
      { label: `${registration} PUC`, expiry: vehicle.pucExpiry || vehicle.puc_expiry, to: '/vehicles', kind: 'Vehicle' },
    ].forEach(doc => all.push({ ...doc, status: docStatus(doc.expiry), expiryDate: doc.expiry || null }))
  })

  drivers.forEach(driver => {
    const expiry = driver.licenseExpiry || driver.license_expiry
    all.push({
      label: `${driver.name || 'Unnamed driver'} Driving Licence`,
      expiryDate: expiry || null,
      expiry,
      to: '/drivers',
      kind: 'Driver',
      status: docStatus(expiry),
    })
  })

  const alerts = all
    .filter(doc => doc.status.key === 'expired' || doc.status.key === 'soon')
    .map(({ expiry, ...doc }) => doc)
    .sort((a, b) =>
      SEVERITY[a.status.key] - SEVERITY[b.status.key] ||
      (a.status.days ?? 9999) - (b.status.days ?? 9999) ||
      a.label.localeCompare(b.label))

  return {
    all,
    alerts,
    vehicleDocAlerts: alerts.filter(alert => alert.kind === 'Vehicle'),
    driverDocAlerts: alerts.filter(alert => alert.kind === 'Driver'),
    expiredCount: alerts.filter(alert => alert.status.key === 'expired').length,
    soonCount: alerts.filter(alert => alert.status.key === 'soon').length,
    validCount: all.filter(doc => doc.status.key === 'active').length,
  }
}

const daysInMonth = (year, monthIndex) => new Date(year, monthIndex + 1, 0).getDate()
const addDays = (dateStr, days) => {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + days)
  return toLocalDateStr(d)
}
const diffDays = (from, to) => Math.round((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000)
const inRange = (dateStr, from, to) => {
  const d = (dateStr || '').slice(0, 10)
  return !!d && d >= from && d <= to
}
const monthKeysBetween = (from, to) => {
  const keys = []
  let d = new Date(`${from.slice(0, 7)}-01T00:00:00`)
  const end = new Date(`${to.slice(0, 7)}-01T00:00:00`)
  while (d <= end) {
    keys.push(toLocalMonthStr(d))
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  }
  return keys
}

function resolvePeriod(period, now, dateRange) {
  const year = now.getFullYear()
  if (period === 'year') {
    const from = `${year}-01-01`
    const to = `${year}-12-31`
    return {
      from, to, periodKey: String(year),
      periodTag: 'this year', periodTagCap: 'This Year',
      prevFrom: `${year - 1}-01-01`, prevTo: `${year - 1}-12-31`,
      prevPeriodKey: String(year - 1),
    }
  }
  if (period === 'custom' && dateRange?.from && dateRange?.to) {
    let from = String(dateRange.from).slice(0, 10)
    let to = String(dateRange.to).slice(0, 10)
    if (from > to) [from, to] = [to, from]
    const span = Math.max(0, diffDays(from, to))
    const prevTo = addDays(from, -1)
    const prevFrom = addDays(prevTo, -span)
    return {
      from, to, periodKey: from.slice(0, 7),
      periodTag: 'in selected range', periodTagCap: 'Selected range',
      prevFrom, prevTo, prevPeriodKey: prevFrom.slice(0, 7),
    }
  }
  const monthKey = toLocalMonthStr(now)
  const lastDay = daysInMonth(year, now.getMonth())
  const from = `${monthKey}-01`
  const to = `${monthKey}-${String(lastDay).padStart(2, '0')}`
  const prev = new Date(year, now.getMonth() - 1, 1)
  const prevKey = toLocalMonthStr(prev)
  const prevLast = daysInMonth(prev.getFullYear(), prev.getMonth())
  return {
    from, to, periodKey: monthKey,
    periodTag: 'this month', periodTagCap: 'This Month',
    prevFrom: `${prevKey}-01`, prevTo: `${prevKey}-${String(prevLast).padStart(2, '0')}`,
    prevPeriodKey: prevKey,
  }
}

// ── One call builds every dashboard value from loaded rows ─────
export function buildDashboardData({
  bookings = [], customers = [], allExpenses = [], settlements = [],
  todayAttendance = [], drivers = [], vehicles = [], period = 'month',
  dateRange = null,
  gps = {}, can = () => false, now = new Date(), nowMs = Date.now(),
} = {}) {
  // Cancelled trips never earned a fare — excluded from money/KM figures and
  // trend charts, but still counted in booking status tiles.
  const revenueBookings = bookings.filter(booking => booking.status !== 'cancelled')
  const todayStr = toLocalDateStr(now)
  const thisMonthKey = toLocalMonthStr(now)
  const { from: rangeFrom, to: rangeTo, periodKey, periodTag, periodTagCap, prevFrom, prevTo, prevPeriodKey } = resolvePeriod(period, now, dateRange)
  const periodYear = String(now.getFullYear())
  const monthBookings = revenueBookings.filter(booking => booking.startDate?.startsWith(thisMonthKey))
  const monthFare = sumAmount(monthBookings, 'fare')
  const monthKm = sumAmount(monthBookings, 'km')
  const monthDone = monthBookings.filter(booking => booking.status === 'completed').length
  const monthPending = monthBookings.filter(booking => ['draft', 'confirmed', 'assigned'].includes(booking.status)).length

  const bookingToday = bookings.filter(booking => booking.startDate === todayStr)
  const todayCounts = {
    total: bookingToday.length,
    active: bookingToday.filter(booking => booking.status === 'started').length,
    completed: bookingToday.filter(booking => booking.status === 'completed').length,
    cancelled: bookingToday.filter(booking => booking.status === 'cancelled').length,
  }
  const bookingActive = bookings.filter(booking => booking.status === 'started')
  const bookingCompleted = bookings.filter(booking => booking.status === 'completed')
  const bookingCancelled = bookings.filter(booking => booking.status === 'cancelled')
  const bookingPending = bookings.filter(booking => ['draft', 'confirmed', 'assigned'].includes(booking.status))

  const availableVehicles = vehicles.filter(vehicle => vehicle.status === 'active').length
  const maintenanceVehicles = vehicles.filter(vehicle => vehicle.status === 'maintenance').length
  const onTripVehicles = new Set(
    bookingActive
      .map(booking => booking.vehicleId || booking.vehicle)
      .filter(Boolean)
      .map(value => String(value)),
  ).size
  const documents = buildDocumentAlerts({ vehicles, drivers })
  const gpsStatus = deriveGpsStatus(gps, nowMs)

  const newCustomersMonth = customers.filter(customer => customer.createdAt?.startsWith(thisMonthKey)).length
  const corporateCustomers = customers.filter(customer => customer.type === 'corporate' || customer.type === 'agent').length

  const monthExpenses = allExpenses.filter(isThisMonth)
  const monthExpTotal = sumAmount(monthExpenses, 'amount')
  const monthNet = monthFare - monthExpTotal
  const pendingApprovals = allExpenses.filter(expense => expense.status === 'submitted').length

  // KPIs, expense chips and the fare chart follow the selected period.
  // Queues (pending approvals, driver assignment) stay all-time on purpose.
  const periodBookings = bookings.filter(booking => inRange(booking.startDate, rangeFrom, rangeTo))
  const periodRevenue = periodBookings.filter(booking => booking.status !== 'cancelled')
  const periodFare = sumAmount(periodRevenue, 'fare')
  const periodKm = sumAmount(periodRevenue, 'km')
  const periodDone = periodRevenue.filter(booking => booking.status === 'completed').length
  const periodPending = periodRevenue.filter(booking => ['draft', 'confirmed', 'assigned'].includes(booking.status)).length
  const periodCancelled = periodBookings.filter(booking => booking.status === 'cancelled').length
  const periodExpenses = allExpenses.filter(expense => inRange(getExpenseDate(expense), rangeFrom, rangeTo))
  const periodExpTotal = sumAmount(periodExpenses, 'amount')
  const periodNet = periodFare - periodExpTotal
  const periodCustomers = customers.filter(customer => inRange(customer.createdAt, rangeFrom, rangeTo)).length
  const expByCategory = summariseByType(periodExpenses).slice(0, 3)

  const prevRevenue = bookings.filter(booking =>
    booking.status !== 'cancelled' && inRange(booking.startDate, prevFrom, prevTo))
  const prevPeriodFare = sumAmount(prevRevenue, 'fare')
  const prevPeriodExpTotal = sumAmount(
    allExpenses.filter(expense => inRange(getExpenseDate(expense), prevFrom, prevTo)),
    'amount',
  )
  const prevPeriodNet = prevPeriodFare - prevPeriodExpTotal
  const fareDelta = deltaPct(periodFare, prevPeriodFare)
  const netDelta = deltaPct(periodNet, prevPeriodNet)
  const expDelta = deltaPct(periodExpTotal, prevPeriodExpTotal)

  const totalPayrollPaid = settlements
    .filter(settlement => settlement.status === 'paid')
    .reduce((total, settlement) => total + (settlement.netAmount || 0), 0)
  const settledPending = settlements.filter(settlement => settlement.status === 'pending').length
  const settledApproved = settlements.filter(settlement => settlement.status === 'approved').length
  // Payroll dashboard lists the whole driver registry, not only drivers who
  // already have a settlement row. Settlement matching is by display name,
  // which is how the Payroll page keys its records too.
  const payrollDrivers = drivers.map(driver => {
    const name = driver.name || driver.full_name || ''
    const settlement = settlements.find(item =>
      String(item.driver || '').trim().toLowerCase() === name.trim().toLowerCase())
    return {
      id: driver.id,
      name,
      status: settlement?.status || 'none',
      amount: Number(settlement?.netAmount || 0),
    }
  })

  const totalFare = sumAmount(revenueBookings, 'fare')
  const totalKm = sumAmount(revenueBookings, 'km')
  const totalExp = sumAmount(allExpenses, 'amount')
  const totalNet = totalFare - totalExp
  const doneTrips = bookingCompleted.length
  const pendingTrips = bookingPending.length

  const buildBuckets = () => {
    if (period === 'year') {
      const year = now.getFullYear()
      return Array.from({ length: 12 }, (_, month) => {
        const date = new Date(year, month, 1)
        const key = toLocalMonthStr(date)
        return { key, month: date.toLocaleDateString('en-IN', { month: 'short' }), granularity: 'month' }
      })
    }
    if (period === 'custom' && rangeFrom && rangeTo) {
      const span = diffDays(rangeFrom, rangeTo)
      if (span > 62) {
        return monthKeysBetween(rangeFrom, rangeTo).map(key => {
          const date = new Date(`${key}-01T00:00:00`)
          return { key, month: date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }), granularity: 'month' }
        })
      }
      const out = []
      for (let i = 0; i <= span; i++) {
        const day = addDays(rangeFrom, i)
        const d = new Date(`${day}T00:00:00`)
        out.push({
          key: day,
          month: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          granularity: 'day',
        })
      }
      return out
    }
    return Array.from({ length: 6 }, (_, index) => {
      const i = 5 - index
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = toLocalMonthStr(date)
      return { key, month: date.toLocaleDateString('en-IN', { month: 'short' }), granularity: 'month' }
    })
  }

  const buckets = buildBuckets()
  const trendData = buckets.map(b => ({
    month: b.month,
    fare: sumAmount(
      revenueBookings.filter(booking => b.granularity === 'day'
        ? (booking.startDate || '').slice(0, 10) === b.key
        : (booking.startDate || '').startsWith(b.key)),
      'fare',
    ),
  }))
  const trendTitle = period === 'year'
    ? '12-month trend'
    : period === 'custom'
      ? (buckets[0]?.granularity === 'day' ? 'Daily trend' : 'Monthly trend')
      : '6-month trend'

  const monthlyNet = buckets.map((b, index) => {
    const exp = sumAmount(
      allExpenses.filter(expense => {
        const d = getExpenseDate(expense) || ''
        return b.granularity === 'day' ? d.slice(0, 10) === b.key : d.startsWith(b.key)
      }),
      'amount',
    )
    return { month: b.month, net: (Number(trendData[index]?.fare) || 0) - exp }
  })

  const monthlyTrips = (() => {
    const out = []
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = toLocalMonthStr(date)
      out.push({
        month: date.toLocaleDateString('en-IN', { month: 'short' }),
        fare: revenueBookings.filter(booking => booking.startDate?.startsWith(key)).length,
      })
    }
    return out
  })()
  const tripTotal = monthlyTrips.reduce((total, item) => total + item.fare, 0)

  const unassignedCount = bookingPending.filter(booking => !booking.driver).length
  const attentionItems = [
    can('trips') && unassignedCount > 0
      ? { label: `${unassignedCount} trip${unassignedCount !== 1 ? 's' : ''} need a driver`, to: '/trips' } : null,
    can('expenses') && pendingApprovals > 0
      ? { label: `${pendingApprovals} expense${pendingApprovals !== 1 ? 's' : ''} awaiting approval`, to: '/expenses' } : null,
    can('vehicles') && documents.vehicleDocAlerts.length > 0
      ? { label: `${documents.vehicleDocAlerts.length} vehicle document${documents.vehicleDocAlerts.length !== 1 ? 's' : ''} need attention`, to: '/vehicles' } : null,
    can('payroll') && settledPending > 0
      ? { label: `${settledPending} settlement${settledPending !== 1 ? 's' : ''} awaiting approval`, to: '/payroll' } : null,
  ].filter(Boolean)

  const recentTrips = [...bookings]
    .sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''))
    .slice(0, 5)
    .map(booking => ({
      id: booking.id,
      customer: booking.customer,
      date: booking.startDate,
      startTime: booking.startTime || null,
      source: booking.pickup,
      destination: booking.drop,
      vehicle: booking.vehicle || '—',
      driver: booking.driver || '—',
      type: booking.type,
      km: booking.km || 0,
      fare: booking.fare || 0,
      net: (booking.fare || 0) - (booking.toll || 0) - (booking.bata || 0) - (booking.petrol || 0) - (booking.parking || 0) - (booking.extras || 0),
      status: booking.status,
    }))

  const driverStats = drivers.slice(0, 5).map(driver => {
    const driverTrips = bookings.filter(booking => booking.driver === driver.name)
    const earnings = sumAmount(driverTrips, 'fare')
    return {
      id: driver.id,
      name: driver.name,
      trips: driverTrips.length,
      earnings,
      cost: sumAmount(allExpenses.filter(expense => expense.driver === driver.name), 'amount'),
      contribution: totalFare > 0 ? Math.round((earnings / totalFare) * 100) : 0,
    }
  })

  return {
    // period + labels
    period, periodKey, periodTag, periodTagCap, periodYear, prevPeriodKey, rangeFrom, rangeTo,
    // today and booking counters
    todayStr, bookingToday, bookingActive, bookingCompleted, bookingCancelled, bookingPending,
    bookingCounts: {
      total: periodBookings.length,
      today: bookingToday.length,
      active: bookingActive.length,
      completed: periodDone,
      pending: periodPending,
      cancelled: periodCancelled,
    },
    todayCounts,
    // fleet + gps
    vehicleCounts: {
      total: vehicles.length,
      available: availableVehicles,
      onTrip: onTripVehicles,
      maintenance: maintenanceVehicles,
      docAlerts: documents.vehicleDocAlerts.length,
    },
    documents,
    gps: gpsStatus,
    // customers
    customerCounts: {
      total: customers.length,
      active: customers.filter(customer => customer.status === 'active').length,
      corporate: corporateCustomers,
      newThisPeriod: periodCustomers,
      newThisMonth: newCustomersMonth,
    },
    // finance
    totals: { fare: periodFare, net: periodNet, km: periodKm, expenses: periodExpTotal, periodRevenueCount: periodRevenue.length },
    deltas: { fare: fareDelta, net: netDelta, expenses: expDelta },
    monthly: { fare: monthFare, km: monthKm, expenses: monthExpTotal, net: monthNet, done: monthDone, pending: monthPending },
    allTime: { fare: totalFare, km: totalKm, expenses: totalExp, net: totalNet, doneTrips, pendingTrips },
    expense: { entries: periodExpenses.length, pendingApprovals, categories: expByCategory },
    trend: {
      data: trendData,
      title: trendTitle,
      monthlyExp: monthlyNet.map((n, i) => (Number(trendData[i]?.fare) || 0) - (Number(n.net) || 0)),
      monthlyNet,
      monthlyTrips,
      tripTotal,
      margin: periodFare > 0 ? Math.min(100, Math.round((periodNet / periodFare) * 100)) : 0,
    },
    // payroll + people
    payroll: {
      totalPaid: totalPayrollPaid, pending: settledPending, approved: settledApproved,
      total: settlements.length, drivers: payrollDrivers,
    },
    attendance: { present: todayAttendance.filter(row => row.status === 'present').length, leave: todayAttendance.filter(row => row.status === 'leave').length },
    driverStats,
    driverCounts: { total: drivers.length },
    // queues and activity
    unassignedCount,
    attentionItems,
    recentTrips,
  }
}

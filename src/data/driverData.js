// ─── Driver Dashboard Mock Data ──────────────────────────────
// Keyed by driver username so each driver sees their own data.

import { TRIPS, DRIVERS, VEHICLES } from './mockData'

// ── TODAY'S DATE (computed at runtime) ───────────────────────
const _now = new Date()
export const TODAY     = _now.toLocaleDateString('en-CA')          // 'YYYY-MM-DD'
export const TODAY_DAY = _now.toLocaleDateString('en-IN', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
})

// ── DRIVER STATUS OPTIONS ────────────────────────────────────
export const DRIVER_STATUSES = [
  { key: 'available', label: 'Available',  color: 'emerald', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',  ring: 'ring-emerald-400' },
  { key: 'driving',   label: 'Driving',    color: 'blue',    dot: 'bg-blue-500',    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',               ring: 'ring-blue-400'    },
  { key: 'break',     label: 'On Break',   color: 'amber',   dot: 'bg-amber-500',   badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',            ring: 'ring-amber-400'   },
  { key: 'completed', label: 'Completed',  color: 'violet',  dot: 'bg-violet-500',  badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',        ring: 'ring-violet-400'  },
  { key: 'offline',   label: 'Offline',    color: 'slate',   dot: 'bg-slate-400',   badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',               ring: 'ring-slate-400'   },
]

// ── TRIP TYPE LABELS ─────────────────────────────────────────
export const TRIP_TYPES = {
  airport:   'Airport Transfer',
  outstation:'Outstation',
  local:     'Local Package',
  pickup:    'Pickup Only',
  drop:      'Drop Only',
  roundtrip: 'Round Trip',
}

// ── TODAY'S ASSIGNED TRIPS per driver ────────────────────────
// Structure: { tripId, customer, contact, pickup, drop, tripType,
//              scheduledTime, status, fare, km, notes }
export const TODAY_TRIPS = {
  ramanan: [
    {
      tripId:        'SJT-T-001',
      customer:      'Suresh Rajan',
      contact:       '9876512340',
      pickup:        'Hotel Atithi, Puducherry',
      drop:          'Chennai International Airport',
      tripType:      'airport',
      scheduledTime: '06:30 AM',
      status:        'completed',
      fare:           3200,
      km:             145,
      notes:          'Carry board with customer name',
      startTime:     '06:28 AM',
      endTime:       '09:45 AM',
      duration:      '3h 17m',
    },
    {
      tripId:        'SJT-T-002',
      customer:      'Priya Menon',
      contact:       '9123456780',
      pickup:        'Auroville Main Road',
      drop:          'Villupuram Bus Stand',
      tripType:      'drop',
      scheduledTime: '12:00 PM',
      status:        'driving',
      fare:           1400,
      km:             65,
      notes:          'Customer has 2 bags',
      startTime:     '11:58 AM',
      endTime:       null,
      duration:      null,
    },
    {
      tripId:        'SJT-T-003',
      customer:      'Arjun Krishnamurthy',
      contact:       '9988001133',
      pickup:        'Puducherry Bus Stand',
      drop:          'Cuddalore General Hospital',
      tripType:      'local',
      scheduledTime: '03:30 PM',
      status:        'pending',
      fare:           900,
      km:             28,
      notes:          '',
      startTime:     null,
      endTime:       null,
      duration:      null,
    },
  ],
  babu: [
    {
      tripId:        'SJT-T-004',
      customer:      'Deepika Nair',
      contact:       '8765432100',
      pickup:        'White Town, Puducherry',
      drop:          'Bangalore Kempegowda Airport',
      tripType:      'airport',
      scheduledTime: '04:00 AM',
      status:        'completed',
      fare:           7500,
      km:             310,
      notes:          'Early morning pick-up',
      startTime:     '03:58 AM',
      endTime:       '11:30 AM',
      duration:      '7h 32m',
    },
    {
      tripId:        'SJT-T-005',
      customer:      'Ramesh Pillai',
      contact:       '7654321001',
      pickup:        'Auroville Beach Road',
      drop:          'Mahabalipuram Shore Temple',
      tripType:      'outstation',
      scheduledTime: '02:00 PM',
      status:        'pending',
      fare:           3800,
      km:             162,
      notes:          'Return trip same evening',
      startTime:     null,
      endTime:       null,
      duration:      null,
    },
  ],
  rajasekharan: [
    {
      tripId:        'SJT-T-006',
      customer:      'Meenakshi Sundaram',
      contact:       '9012345679',
      pickup:        'Rly Station, Pondicherry',
      drop:          'Tirupati Balaji Temple',
      tripType:      'outstation',
      scheduledTime: '05:00 AM',
      status:        'completed',
      fare:           9000,
      km:             420,
      notes:          '7 passengers + luggage',
      startTime:     '04:57 AM',
      endTime:       '12:20 PM',
      duration:      '7h 23m',
    },
    {
      tripId:        'SJT-T-007',
      customer:      'Kavitha Mohan',
      contact:       '9871234560',
      pickup:        'Auroville, Tamil Nadu',
      drop:          'Salem Bus Terminus',
      tripType:      'drop',
      scheduledTime: '04:00 PM',
      status:        'pending',
      fare:           5200,
      km:             248,
      notes:          '6 passengers',
      startTime:     null,
      endTime:       null,
      duration:      null,
    },
  ],
}

// ── RIDE HISTORY (last 10 trips per driver from mockData + extras) ──
export function getDriverHistory(driverName) {
  const name = driverName?.toLowerCase()
  // Pull from existing TRIPS dataset filtered by driver
  const fromTrips = TRIPS
    .filter(t => (t.driver ?? '').toLowerCase() === name)
    .map(t => ({
      tripId:    t.invNo,
      date:      t.date,
      customer:  t.customer,
      pickup:    t.source,
      drop:      t.destination,
      km:        t.km,
      duration:  estimateDuration(t.km),
      earnings:  t.bata + t.exp,
      fare:      t.fare,
      status:    t.status === 'done' ? 'completed' : 'pending',
      tripType:  t.km > 200 ? 'outstation' : t.km > 80 ? 'airport' : 'local',
    }))
  return fromTrips
}

function estimateDuration(km) {
  const mins = Math.round((km / 50) * 60) // ~50 km/h avg
  const h    = Math.floor(mins / 60)
  const m    = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// ── TODAY'S EARNINGS per driver ──────────────────────────────
export function getTodayEarnings(driverName) {
  const name    = driverName?.toLowerCase()
  const myToday = (TODAY_TRIPS[name] || []).filter(t => t.status === 'completed')
  return myToday.reduce((s, t) => {
    // bata is ~12% of fare (mock calc)
    const bata = Math.round(t.fare * 0.12)
    return s + bata
  }, 0)
}

// ── TODAY'S STATS per driver ─────────────────────────────────
export function getTodayStats(driverName) {
  const name  = driverName?.toLowerCase()
  const trips = TODAY_TRIPS[name] || []

  const completed   = trips.filter(t => t.status === 'completed')
  const pending     = trips.filter(t => t.status === 'pending')
  const driving     = trips.filter(t => t.status === 'driving')
  const totalKm     = completed.reduce((s, t) => s + t.km, 0)
  const earnings    = getTodayEarnings(driverName)

  // Estimate hours from durations
  const hours = completed.reduce((s, t) => {
    if (!t.duration) return s
    const parts = t.duration.match(/(\d+)h\s*(\d+)m/)
    if (parts) return s + parseInt(parts[1]) + parseInt(parts[2]) / 60
    const mParts = t.duration.match(/(\d+)m/)
    if (mParts) return s + parseInt(mParts[1]) / 60
    return s
  }, 0)

  return {
    totalTrips:    trips.length,
    completedTrips:completed.length,
    pendingTrips:  pending.length,
    activeTrips:   driving.length,
    totalKm,
    hoursOnRoad:   parseFloat(hours.toFixed(1)),
    earningsToday: earnings,
  }
}

// ── VEHICLE INFO for logged-in driver ────────────────────────
export function getDriverVehicle(vehicleReg) {
  return VEHICLES.find(v => v.reg === vehicleReg) || null
}

// ── DRIVER PROFILE from DRIVERS array ───────────────────────
export function getDriverProfile(driverName) {
  return DRIVERS.find(d => (d.name ?? '').toLowerCase() === driverName?.toLowerCase()) || null
}

// ── TRIP STATUS config ────────────────────────────────────────
export const TRIP_STATUS_CFG = {
  pending:   { label: 'Scheduled', bg: 'bg-amber-100 dark:bg-amber-900/30',   text: 'text-amber-700 dark:text-amber-300',   dot: 'bg-amber-500',   icon: '🕐' },
  driving:   { label: 'In Progress',bg: 'bg-blue-100 dark:bg-blue-900/30',    text: 'text-blue-700 dark:text-blue-300',     dot: 'bg-blue-500',    icon: '🚗' },
  completed: { label: 'Completed',  bg: 'bg-emerald-100 dark:bg-emerald-900/30',text:'text-emerald-700 dark:text-emerald-300',dot:'bg-emerald-500', icon: '✓'  },
  cancelled: { label: 'Cancelled',  bg: 'bg-red-100 dark:bg-red-900/30',      text: 'text-red-700 dark:text-red-300',       dot: 'bg-red-500',     icon: '✕'  },
}

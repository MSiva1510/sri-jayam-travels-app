// ─── Attendance Data & Helpers ────────────────────────────────
export const ATTENDANCE_KEY         = 'sjt_attendance'
export const VEHICLE_ASSIGNMENT_KEY = 'sjt_vehicle_assignments'

export const ATTENDANCE_TYPES = [
  { key:'present',  label:'Present',  color:'emerald', dot:'bg-emerald-500', bg:'bg-emerald-100 dark:bg-emerald-900/30', text:'text-emerald-700 dark:text-emerald-300' },
  { key:'absent',   label:'Absent',   color:'red',     dot:'bg-red-500',     bg:'bg-red-100 dark:bg-red-900/30',         text:'text-red-700 dark:text-red-300'         },
  { key:'leave',    label:'Leave',    color:'amber',   dot:'bg-amber-500',   bg:'bg-amber-100 dark:bg-amber-900/30',     text:'text-amber-700 dark:text-amber-300'     },
  { key:'half-day', label:'Half Day', color:'blue',    dot:'bg-blue-500',    bg:'bg-blue-100 dark:bg-blue-900/30',       text:'text-blue-700 dark:text-blue-300'       },
]

export const getAttendanceCfg = key => ATTENDANCE_TYPES.find(t => t.key === key) || ATTENDANCE_TYPES[0]

// ── Mock historical attendance (last 30 days) ─────────────────
const TODAY = new Date()
function daysAgo(n) {
  const d = new Date(TODAY); d.setDate(d.getDate() - n)
  return d.toISOString().slice(0,10)
}

export const MOCK_ATTENDANCE = [
  // Ramanan
  { id:1,  driver:'Ramanan',      driverId:3, date: daysAgo(0),  status:'present',  checkIn:'08:05', checkOut:null,    vehicle:'PY01CY1255', workingHours:null      },
  { id:2,  driver:'Ramanan',      driverId:3, date: daysAgo(1),  status:'present',  checkIn:'07:55', checkOut:'20:10', vehicle:'PY01CY1255', workingHours:'12h 15m' },
  { id:3,  driver:'Ramanan',      driverId:3, date: daysAgo(2),  status:'present',  checkIn:'08:30', checkOut:'19:45', vehicle:'PY01CY1255', workingHours:'11h 15m' },
  { id:4,  driver:'Ramanan',      driverId:3, date: daysAgo(3),  status:'absent',   checkIn:null,    checkOut:null,    vehicle:null,          workingHours:null      },
  { id:5,  driver:'Ramanan',      driverId:3, date: daysAgo(4),  status:'present',  checkIn:'08:00', checkOut:'21:00', vehicle:'PY01CY1255', workingHours:'13h 00m' },
  { id:6,  driver:'Ramanan',      driverId:3, date: daysAgo(5),  status:'leave',    checkIn:null,    checkOut:null,    vehicle:null,          workingHours:null      },
  { id:7,  driver:'Ramanan',      driverId:3, date: daysAgo(6),  status:'present',  checkIn:'07:50', checkOut:'20:30', vehicle:'PY01CY1255', workingHours:'12h 40m' },
  // Babu
  { id:8,  driver:'Babu',         driverId:4, date: daysAgo(0),  status:'present',  checkIn:'07:30', checkOut:null,    vehicle:'PY01DF1255', workingHours:null      },
  { id:9,  driver:'Babu',         driverId:4, date: daysAgo(1),  status:'present',  checkIn:'07:45', checkOut:'21:15', vehicle:'PY01DF1255', workingHours:'13h 30m' },
  { id:10, driver:'Babu',         driverId:4, date: daysAgo(2),  status:'half-day', checkIn:'08:00', checkOut:'13:00', vehicle:'PY01DF1255', workingHours:'5h 00m'  },
  { id:11, driver:'Babu',         driverId:4, date: daysAgo(3),  status:'present',  checkIn:'08:10', checkOut:'20:00', vehicle:'PY01DF1255', workingHours:'11h 50m' },
  { id:12, driver:'Babu',         driverId:4, date: daysAgo(4),  status:'present',  checkIn:'07:55', checkOut:'19:30', vehicle:'PY01DF1255', workingHours:'11h 35m' },
  { id:13, driver:'Babu',         driverId:4, date: daysAgo(5),  status:'present',  checkIn:'08:20', checkOut:'20:45', vehicle:'PY01DF1255', workingHours:'12h 25m' },
  { id:14, driver:'Babu',         driverId:4, date: daysAgo(6),  status:'absent',   checkIn:null,    checkOut:null,    vehicle:null,          workingHours:null      },
  // Rajasekharan
  { id:15, driver:'Rajasekharan', driverId:5, date: daysAgo(0),  status:'present',  checkIn:'09:00', checkOut:null,    vehicle:'PY01VF1255', workingHours:null      },
  { id:16, driver:'Rajasekharan', driverId:5, date: daysAgo(1),  status:'present',  checkIn:'08:45', checkOut:'22:00', vehicle:'PY01VF1255', workingHours:'13h 15m' },
  { id:17, driver:'Rajasekharan', driverId:5, date: daysAgo(2),  status:'present',  checkIn:'08:00', checkOut:'20:30', vehicle:'PY01VF1255', workingHours:'12h 30m' },
  { id:18, driver:'Rajasekharan', driverId:5, date: daysAgo(3),  status:'leave',    checkIn:null,    checkOut:null,    vehicle:null,          workingHours:null      },
  { id:19, driver:'Rajasekharan', driverId:5, date: daysAgo(4),  status:'present',  checkIn:'07:40', checkOut:'20:10', vehicle:'PY01VF1255', workingHours:'12h 30m' },
  { id:20, driver:'Rajasekharan', driverId:5, date: daysAgo(5),  status:'present',  checkIn:'08:30', checkOut:'19:00', vehicle:'PY01VF1255', workingHours:'10h 30m' },
  { id:21, driver:'Rajasekharan', driverId:5, date: daysAgo(6),  status:'present',  checkIn:'08:00', checkOut:'21:30', vehicle:'PY01VF1255', workingHours:'13h 30m' },
]

// ── localStorage helpers ──────────────────────────────────────
export function loadAttendance() {
  try {
    const raw = localStorage.getItem(ATTENDANCE_KEY)
    const stored = raw ? JSON.parse(raw) : []
    // Merge stored over mock (stored entries override by id)
    const storedIds = new Set(stored.map(r => r.id))
    return [...stored, ...MOCK_ATTENDANCE.filter(r => !storedIds.has(r.id))]
  } catch { return MOCK_ATTENDANCE }
}

export function saveAttendanceRecord(record) {
  try {
    const raw = localStorage.getItem(ATTENDANCE_KEY)
    const stored = raw ? JSON.parse(raw) : []
    const idx = stored.findIndex(r => r.id === record.id || (r.driver === record.driver && r.date === record.date))
    if (idx >= 0) stored[idx] = record
    else stored.unshift(record)
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(stored))
  } catch {}
}

// ── Auto check-in: called when driver starts their first ride ─
export function autoCheckIn(driverName, vehicleReg) {
  const today = new Date().toISOString().slice(0, 10)
  const all   = loadAttendance()
  const existing = all.find(a => a.driver === driverName && a.date === today)
  if (existing?.checkIn) return existing  // already checked in

  const now = new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:false })
  const record = {
    id:           existing?.id || Date.now(),
    driver:       driverName,
    driverId:     existing?.driverId || null,
    date:         today,
    status:       'present',
    checkIn:      now,
    checkOut:     null,
    vehicle:      vehicleReg,
    workingHours: null,
    autoCheckedIn: true,
  }
  saveAttendanceRecord(record)
  return record
}

// ── Auto check-out: called when driver ends their last ride ───
export function autoCheckOut(driverName) {
  const today = new Date().toISOString().slice(0, 10)
  const all   = loadAttendance()
  const existing = all.find(a => a.driver === driverName && a.date === today)
  if (!existing || existing.checkOut) return existing

  const now = new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:false })
  // Calculate working hours
  let workingHours = null
  if (existing.checkIn) {
    const [ih, im] = existing.checkIn.split(':').map(Number)
    const [oh, om] = now.split(':').map(Number)
    const totalMin = (oh * 60 + om) - (ih * 60 + im)
    if (totalMin > 0) {
      const h = Math.floor(totalMin / 60), m = totalMin % 60
      workingHours = `${h}h ${String(m).padStart(2,'0')}m`
    }
  }
  const updated = { ...existing, checkOut: now, workingHours, autoCheckedOut: true }
  saveAttendanceRecord(updated)
  return updated
}

// ── Get today's attendance (for dashboard strip) ──────────────
export function loadAttendanceToday() {
  const today = new Date().toISOString().slice(0, 10)
  return loadAttendance().filter(a => a.date === today)
}

// ── Vehicle assignments ───────────────────────────────────────
export function loadVehicleAssignments() {
  try { const r = localStorage.getItem(VEHICLE_ASSIGNMENT_KEY); return r ? JSON.parse(r) : [] } catch { return [] }
}
export function saveVehicleAssignment(record) {
  try {
    const arr = loadVehicleAssignments()
    const idx = arr.findIndex(a => a.driverId === record.driverId)
    if (idx >= 0) arr[idx] = record
    else arr.push(record)
    localStorage.setItem(VEHICLE_ASSIGNMENT_KEY, JSON.stringify(arr))
  } catch {}
}

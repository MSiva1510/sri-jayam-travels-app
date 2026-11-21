// ─── Attendance Data & Helpers ────────────────────────────────
// Storage: Supabase `attendance` table via attendanceRepository
//          Vehicle assignments: Supabase `vehicles` table (driver column)

import { attendanceRepository } from '../repositories/attendanceRepository'
import supabase                  from '../lib/supabase'
import { withCache, cacheClear } from '../utils/dataCache'
import { normalizeAttendanceRow, localDateISO } from './attendanceDerive'

// Attendance is derived from trips (completed = present, missed assignment =
// leave / off, no trip = leave). These helpers live in a pure module so the
// same rules drive the Attendance page and the payslips.
export {
  normalizeAttendanceRow,
  buildDayStatus,
  buildMonthSummary,
  buildRecentDays,
  driverNamesForMonth,
  resolveDriverName,
  localDateISO,
  ATTENDANCE_STATUS,
} from './attendanceDerive'

export const ATTENDANCE_TYPES = [
  { key:'present',  label:'Present',  color:'emerald', dot:'bg-emerald-500', bg:'bg-emerald-100 dark:bg-emerald-900/30', text:'text-emerald-700 dark:text-emerald-300' },
  { key:'leave',    label:'Leave',    color:'amber',   dot:'bg-amber-500',   bg:'bg-amber-100 dark:bg-amber-900/30',     text:'text-amber-700 dark:text-amber-300'     },
]

export const getAttendanceCfg = key => ATTENDANCE_TYPES.find(t => t.key === key) || ATTENDANCE_TYPES[0]

// ── Supabase attendance store ─────────────────────────────────

async function _loadAttendance() {
  try {
    const rows = await attendanceRepository.getAll()
    return (Array.isArray(rows) ? rows : []).map(normalizeAttendanceRow)
  } catch (err) {
    console.error('[attendanceData] loadAttendance failed:', err)
    throw err
  }
}
export const loadAttendance = withCache('attendance', _loadAttendance)


export async function saveAttendanceRecord(record) {
  try {
    const { id, ...rest } = record
    const today = localDateISO()
    // Check for existing record by driver + date
    const existing = id ? await attendanceRepository.getById(id) : null
    let result
    if (existing || id) {
      result = await attendanceRepository.update(id, rest)
    } else {
      // Try to find by driver name + date to avoid duplicates
      const todayRecs = (await attendanceRepository.getByDate(rest.date || rest.attendance_date || today))
        .map(normalizeAttendanceRow)
      const match = todayRecs.find(r =>
        r.driver === rest.driver || r.driver_name === rest.driver
      )
      result = match
        ? await attendanceRepository.update(match.id, rest)
        : await attendanceRepository.create(rest)
    }
    cacheClear('attendance')
    return result ? normalizeAttendanceRow(result) : null
  } catch (err) {
    console.error('[attendanceData] saveAttendanceRecord failed:', err)
    return null
  }
}

// ── Today's attendance ────────────────────────────────────────
export async function loadAttendanceToday() {
  const today = localDateISO()
  try {
    const rows = await attendanceRepository.getByDate(today)
    return (Array.isArray(rows) ? rows : []).map(normalizeAttendanceRow)
  } catch (err) {
    // Throw so the dashboard can distinguish "no records" ([]) from a failed
    // attendance query. Never turn an unavailable feed into a zero count.
    console.error('[attendanceData] loadAttendanceToday failed:', err)
    throw err
  }
}

// ── Vehicle assignments ───────────────────────────────────────
// Assignments are stored in a `vehicle_assignments` table in Supabase.
// If that table doesn't exist yet, run:
//   CREATE TABLE public.vehicle_assignments (
//     id            BIGSERIAL PRIMARY KEY,
//     vehicle_reg   TEXT NOT NULL,
//     vehicle_type  TEXT,
//     vehicle_model TEXT,
//     driver_id     TEXT,
//     driver_name   TEXT NOT NULL,
//     assigned_date DATE NOT NULL,
//     assigned_time TEXT,
//     assigned_at   TIMESTAMPTZ DEFAULT NOW(),
//     released_date DATE,
//     created_at    TIMESTAMPTZ DEFAULT NOW()
//   );
//   ALTER TABLE public.vehicle_assignments DISABLE ROW LEVEL SECURITY;

export async function loadVehicleAssignments() {
  try {
    const { data, error } = await supabase
      .from('vehicle_assignments')
      .select('*')
      .order('assigned_at', { ascending: false })
    if (error) throw error
    // Normalise snake_case → camelCase for compatibility
    return (data || []).map(r => ({
      id:           r.id,
      vehicleReg:   r.vehicle_reg,
      vehicleType:  r.vehicle_type,
      vehicleModel: r.vehicle_model,
      driverId:     r.driver_id,
      driverName:   r.driver_name,
      assignedDate: r.assigned_date,
      assignedTime: r.assigned_time,
      assignedAt:   r.assigned_at,
      releasedDate: r.released_date,
    }))
  } catch (err) {
    console.error('[attendanceData] loadVehicleAssignments failed:', err)
    return []
  }
}

export async function saveVehicleAssignment(record) {
  try {
    const payload = {
      vehicle_reg:   record.vehicleReg,
      vehicle_type:  record.vehicleType,
      vehicle_model: record.vehicleModel,
      driver_id:     record.driverId,
      driver_name:   record.driverName,
      assigned_date: record.assignedDate,
      assigned_time: record.assignedTime,
      assigned_at:   record.assignedAt || new Date().toISOString(),
      released_date: record.releasedDate || null,
    }
    // Upsert: one active assignment per driver (no released_date)
    const { data: existing } = await supabase
      .from('vehicle_assignments')
      .select('id')
      .eq('driver_name', record.driverName)
      .is('released_date', null)
      .single()

    if (existing?.id) {
      await supabase
        .from('vehicle_assignments')
        .update(payload)
        .eq('id', existing.id)
    } else {
      await supabase.from('vehicle_assignments').insert([payload])
    }
    return record
  } catch (err) {
    console.error('[attendanceData] saveVehicleAssignment failed:', err)
    return null
  }
}
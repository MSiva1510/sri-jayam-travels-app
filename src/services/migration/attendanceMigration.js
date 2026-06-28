// ─────────────────────────────────────────────────────────────────────
// ATTENDANCE MIGRATION SERVICE
// Handles migration of attendance records
// ─────────────────────────────────────────────────────────────────────

import { attendanceRepository } from '../../repositories/attendanceRepository'
import { dataService } from '../../services/dataService'
import {
  isMigrationCompleted,
  completeMigration,
  failMigration,
} from '../../utils/migrationHelper'
import { isSupabaseConfigured } from '../../lib/supabase'
import { getDatabaseProvider, DATABASE_PROVIDERS } from '../../config/database'

const LOCAL_ATTENDANCE_KEY = 'sjt_attendance'

/**
 * Migrate attendance data from localStorage to Supabase
 * @returns {Promise<Object>}
 */
export async function migrateAttendance() {
  if (isMigrationCompleted('attendance')) {
    console.log('Attendance migration already completed')
    return { success: true, message: 'Migration already completed', recordCount: 0 }
  }

  if (!isSupabaseConfigured() || getDatabaseProvider() !== DATABASE_PROVIDERS.SUPABASE) {
    console.log('Supabase not configured, skipping attendance migration')
    return { success: true, message: 'Supabase not configured', recordCount: 0 }
  }

  try {
    const attendance = dataService.get(LOCAL_ATTENDANCE_KEY, [])

    if (attendance.length === 0) {
      completeMigration('attendance', 0, [])
      return { success: true, message: 'No attendance to migrate', recordCount: 0 }
    }

    console.log(`Starting migration of ${attendance.length} attendance records...`)

    const errors = []
    let successCount = 0

    for (const record of attendance) {
      try {
        const normalized = normalizeAttendanceData(record)
        await attendanceRepository.create(normalized)
        successCount++
      } catch (error) {
        errors.push(`Attendance record: ${error.message}`)
        console.error('Failed to migrate attendance:', error)
      }
    }

    completeMigration('attendance', successCount, errors)
    console.log(`Attendance migration completed: ${successCount}/${attendance.length} succeeded`)

    return {
      success: errors.length === 0,
      message: `Migrated ${successCount} attendance records`,
      recordCount: successCount,
      errors: errors.length > 0 ? errors : undefined,
    }
  } catch (error) {
    console.error('Attendance migration failed:', error)
    failMigration('attendance', error.message)
    return {
      success: false,
      message: error.message,
      recordCount: 0,
      error: error.message,
    }
  }
}

function normalizeAttendanceData(record) {
  return {
    id: record.id,
    driver_id: record.driver_id,
    attendance_date: record.attendance_date,
    check_in_time: record.check_in_time,
    check_out_time: record.check_out_time,
    status: record.status || 'present',
    notes: record.notes,
    created_at: record.created_at || new Date().toISOString(),
    updated_at: record.updated_at || new Date().toISOString(),
  }
}

/**
 * Verify attendance migration
 * @returns {Promise<Object>}
 */
export async function verifyAttendanceMigration() {
  try {
    const localAttendance = dataService.get(LOCAL_ATTENDANCE_KEY, [])
    const supabaseAttendance = await attendanceRepository.getAll()

    const localIds = new Set(localAttendance.map(a => a.id))
    const supabaseIds = new Set(supabaseAttendance.map(a => a.id))

    const missing = [...localIds].filter(id => !supabaseIds.has(id))

    return {
      localCount: localAttendance.length,
      supabaseCount: supabaseAttendance.length,
      missing: missing.length > 0 ? missing : undefined,
      verified: missing.length === 0,
    }
  } catch (error) {
    console.error('Verification failed:', error)
    return { verified: false, error: error.message }
  }
}

export default {
  migrateAttendance,
  verifyAttendanceMigration,
}
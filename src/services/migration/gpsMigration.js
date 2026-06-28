// ─────────────────────────────────────────────────────────────────────
// GPS MIGRATION SERVICE
// Handles migration of GPS tracking data
// ─────────────────────────────────────────────────────────────────────

import { gpsRepository } from '../../repositories/gpsRepository'
import { dataService } from '../../services/dataService'
import {
  isMigrationCompleted,
  completeMigration,
  failMigration,
} from '../../utils/migrationHelper'
import { isSupabaseConfigured } from '../../lib/supabase'
import { getDatabaseProvider, DATABASE_PROVIDERS } from '../../config/database'

const LOCAL_GPS_KEY = 'sjt_gps_history'
const LOCAL_ROUTES_KEY = 'sjt_trip_routes'

/**
 * Migrate GPS data from localStorage to Supabase
 * @returns {Promise<Object>}
 */
export async function migrateGPS() {
  if (isMigrationCompleted('gps')) {
    console.log('GPS migration already completed')
    return { success: true, message: 'Migration already completed', recordCount: 0 }
  }

  if (!isSupabaseConfigured() || getDatabaseProvider() !== DATABASE_PROVIDERS.SUPABASE) {
    console.log('Supabase not configured, skipping GPS migration')
    return { success: true, message: 'Supabase not configured', recordCount: 0 }
  }

  try {
    const gpsLogs = dataService.get(LOCAL_GPS_KEY, [])
    const routes = dataService.get(LOCAL_ROUTES_KEY, [])

    let successCount = 0
    const errors = []

    for (const log of gpsLogs) {
      try {
        await gpsRepository.createGPSLog(log)
        successCount++
      } catch (error) {
        errors.push(`GPS log: ${error.message}`)
      }
    }

    for (const route of routes) {
      try {
        await gpsRepository.saveRoute(route.trip_id, route.route_data)
        successCount++
      } catch (error) {
        errors.push(`Route: ${error.message}`)
      }
    }

    completeMigration('gps', successCount, errors)
    console.log(`GPS migration completed: ${successCount} records migrated`)

    return {
      success: errors.length === 0,
      message: `Migrated ${successCount} GPS records`,
      recordCount: successCount,
      errors: errors.length > 0 ? errors : undefined,
    }
  } catch (error) {
    console.error('GPS migration failed:', error)
    failMigration('gps', error.message)
    return {
      success: false,
      message: error.message,
      recordCount: 0,
      error: error.message,
    }
  }
}

/**
 * Verify GPS migration
 * @returns {Promise<Object>}
 */
export async function verifyGPSMigration() {
  try {
    const localGPS = dataService.get(LOCAL_GPS_KEY, [])
    const supabaseGPS = await gpsRepository.getAllGPSLogs()

    return {
      localCount: localGPS.length,
      supabaseCount: supabaseGPS.length,
      verified: localGPS.length === supabaseGPS.length,
    }
  } catch (error) {
    console.error('Verification failed:', error)
    return { verified: false, error: error.message }
  }
}

export default {
  migrateGPS,
  verifyGPSMigration,
}
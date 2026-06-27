// ─────────────────────────────────────────────────────────────────────
// DRIVER MIGRATION SERVICE
// Handles migration of drivers from localStorage to Supabase
// ─────────────────────────────────────────────────────────────────────

import { driverRepository } from '../../repositories/driverRepository'
import { dataService } from '../../services/dataService'
import {
  isMigrationCompleted,
  completeMigration,
  failMigration,
  validateMigrationItem,
} from '../../utils/migrationHelper'
import { isSupabaseConfigured } from '../../lib/supabase'
import { getDatabaseProvider, DATABASE_PROVIDERS } from '../../config/database'

const LOCAL_DRIVERS_KEY = 'sjt_drivers'

/**
 * Migrate drivers from localStorage to Supabase
 * @returns {Promise<Object>} Migration result
 */
export async function migrateDrivers() {
  // Check if migration already completed
  if (isMigrationCompleted('drivers')) {
    console.log('Driver migration already completed')
    return { success: true, message: 'Migration already completed', recordCount: 0 }
  }

  // Check if Supabase is configured and active
  if (!isSupabaseConfigured() || getDatabaseProvider() !== DATABASE_PROVIDERS.SUPABASE) {
    console.log('Supabase not configured or not active, skipping migration')
    return { success: true, message: 'Supabase not configured', recordCount: 0 }
  }

  try {
    // Get drivers from localStorage
    const localDrivers = dataService.get(LOCAL_DRIVERS_KEY, [])

    if (localDrivers.length === 0) {
      console.log('No drivers to migrate')
      completeMigration('drivers', 0, [])
      return { success: true, message: 'No drivers to migrate', recordCount: 0 }
    }

    console.log(`Starting migration of ${localDrivers.length} drivers...`)

    const errors = []
    let successCount = 0

    // Migrate each driver
    for (const driver of localDrivers) {
      try {
        // Validate driver data
        const validation = validateMigrationItem('driver', driver)
        if (!validation.valid) {
          errors.push(`Driver ${driver.id}: ${validation.errors.join(', ')}`)
          continue
        }

        // Check for duplicates in Supabase
        const existing = await driverRepository.getById(driver.id)
        if (existing) {
          console.log(`Driver ${driver.id} already exists in Supabase, skipping`)
          successCount++
          continue
        }

        // Normalize driver data for Supabase
        const normalizedDriver = normalizeDriverData(driver)

        // Create driver in Supabase
        await driverRepository.create(normalizedDriver)
        successCount++
      } catch (error) {
        errors.push(`Driver ${driver.id}: ${error.message}`)
        console.error(`Failed to migrate driver ${driver.id}:`, error)
      }
    }

    // Mark migration as complete
    completeMigration('drivers', successCount, errors)

    console.log(`Driver migration completed: ${successCount}/${localDrivers.length} succeeded`)

    return {
      success: errors.length === 0,
      message: `Migrated ${successCount} drivers`,
      recordCount: successCount,
      errors: errors.length > 0 ? errors : undefined,
    }
  } catch (error) {
    console.error('Driver migration failed:', error)
    failMigration('drivers', error.message)
    return {
      success: false,
      message: error.message,
      recordCount: 0,
      error: error.message,
    }
  }
}

/**
 * Normalize driver data from localStorage format to Supabase format
 * @param {Object} driver - Driver from localStorage
 * @returns {Object} Normalized driver object
 */
function normalizeDriverData(driver) {
  return {
    id: driver.id,
    driver_id: driver.driver_id || driver.id,
    name: driver.name,
    phone: driver.phone || driver.mobile,
    license_number: driver.license_number || driver.license,
    license_expiry: driver.license_expiry,
    vehicle_registration: driver.vehicle_registration || driver.vehicle,
    vehicle_type: driver.vehicle_type || driver.vehicleType,
    rating: driver.rating || 5.0,
    is_active: driver.is_active !== false && driver.status !== 'inactive',
    joined_date: driver.joined_date || driver.joined,
    avatar_url: driver.avatar_url,
    status: driver.status || 'available',
    created_at: driver.created_at || new Date().toISOString(),
    updated_at: driver.updated_at || new Date().toISOString(),
  }
}

/**
 * Verify driver migration
 * @returns {Promise<Object>} Verification result
 */
export async function verifyDriverMigration() {
  try {
    const localDrivers = dataService.get(LOCAL_DRIVERS_KEY, [])
    const supabaseDrivers = await driverRepository.getAll()

    const localIds = new Set(localDrivers.map(d => d.id))
    const supabaseIds = new Set(supabaseDrivers.map(d => d.id))

    const missing = [...localIds].filter(id => !supabaseIds.has(id))
    const extra = [...supabaseIds].filter(id => !localIds.has(id))

    return {
      localCount: localDrivers.length,
      supabaseCount: supabaseDrivers.length,
      missing: missing.length > 0 ? missing : undefined,
      extra: extra.length > 0 ? extra : undefined,
      verified: missing.length === 0 && extra.length === 0,
    }
  } catch (error) {
    console.error('Verification failed:', error)
    return {
      verified: false,
      error: error.message,
    }
  }
}

/**
 * Rollback driver migration (copy Supabase data back to localStorage)
 * @returns {Promise<Object>}
 */
export async function rollbackDriverMigration() {
  try {
    const supabaseDrivers = await driverRepository.getAll()
    dataService.set(LOCAL_DRIVERS_KEY, supabaseDrivers)

    return {
      success: true,
      message: `Rolled back ${supabaseDrivers.length} drivers to localStorage`,
      recordCount: supabaseDrivers.length,
    }
  } catch (error) {
    console.error('Rollback failed:', error)
    return {
      success: false,
      message: error.message,
      error: error.message,
    }
  }
}

export default {
  migrateDrivers,
  verifyDriverMigration,
  rollbackDriverMigration,
}
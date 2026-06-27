// ─────────────────────────────────────────────────────────────────────
// VEHICLE MIGRATION SERVICE
// Handles migration of vehicles from localStorage to Supabase
// ─────────────────────────────────────────────────────────────────────

import { vehicleRepository } from '../../repositories/vehicleRepository'
import { dataService } from '../../services/dataService'
import {
  isMigrationCompleted,
  completeMigration,
  failMigration,
  validateMigrationItem,
} from '../../utils/migrationHelper'
import { isSupabaseConfigured } from '../../lib/supabase'
import { getDatabaseProvider, DATABASE_PROVIDERS } from '../../config/database'

const LOCAL_VEHICLES_KEY = 'sjt_vehicles'

/**
 * Migrate vehicles from localStorage to Supabase
 * @returns {Promise<Object>} Migration result
 */
export async function migrateVehicles() {
  // Check if migration already completed
  if (isMigrationCompleted('vehicles')) {
    console.log('Vehicle migration already completed')
    return { success: true, message: 'Migration already completed', recordCount: 0 }
  }

  // Check if Supabase is configured and active
  if (!isSupabaseConfigured() || getDatabaseProvider() !== DATABASE_PROVIDERS.SUPABASE) {
    console.log('Supabase not configured or not active, skipping migration')
    return { success: true, message: 'Supabase not configured', recordCount: 0 }
  }

  try {
    // Get vehicles from localStorage
    const localVehicles = dataService.get(LOCAL_VEHICLES_KEY, [])

    if (localVehicles.length === 0) {
      console.log('No vehicles to migrate')
      completeMigration('vehicles', 0, [])
      return { success: true, message: 'No vehicles to migrate', recordCount: 0 }
    }

    console.log(`Starting migration of ${localVehicles.length} vehicles...`)

    const errors = []
    let successCount = 0

    // Migrate each vehicle
    for (const vehicle of localVehicles) {
      try {
        // Validate vehicle data
        const validation = validateMigrationItem('vehicle', vehicle)
        if (!validation.valid) {
          errors.push(`Vehicle ${vehicle.id}: ${validation.errors.join(', ')}`)
          continue
        }

        // Check for duplicates in Supabase
        const existing = await vehicleRepository.getById(vehicle.id)
        if (existing) {
          console.log(`Vehicle ${vehicle.id} already exists in Supabase, skipping`)
          successCount++
          continue
        }

        // Normalize vehicle data for Supabase
        const normalizedVehicle = normalizeVehicleData(vehicle)

        // Create vehicle in Supabase
        await vehicleRepository.create(normalizedVehicle)
        successCount++
      } catch (error) {
        errors.push(`Vehicle ${vehicle.id}: ${error.message}`)
        console.error(`Failed to migrate vehicle ${vehicle.id}:`, error)
      }
    }

    // Mark migration as complete
    completeMigration('vehicles', successCount, errors)

    console.log(`Vehicle migration completed: ${successCount}/${localVehicles.length} succeeded`)

    return {
      success: errors.length === 0,
      message: `Migrated ${successCount} vehicles`,
      recordCount: successCount,
      errors: errors.length > 0 ? errors : undefined,
    }
  } catch (error) {
    console.error('Vehicle migration failed:', error)
    failMigration('vehicles', error.message)
    return {
      success: false,
      message: error.message,
      recordCount: 0,
      error: error.message,
    }
  }
}

/**
 * Normalize vehicle data from localStorage to Supabase format
 * @param {Object} vehicle
 * @returns {Object} Normalized vehicle
 */
function normalizeVehicleData(vehicle) {
  return {
    id: vehicle.id,
    vehicle_id: vehicle.vehicle_id || vehicle.id,
    registration: vehicle.registration,
    type: vehicle.type,
    model: vehicle.model,
    year: vehicle.year,
    color: vehicle.color,
    fuel_type: vehicle.fuel_type,
    status: vehicle.status || 'active',
    current_driver: vehicle.current_driver,
    current_km: vehicle.current_km || 0,
    last_service_date: vehicle.last_service_date,
    last_service_km: vehicle.last_service_km,
    next_service_date: vehicle.next_service_date,
    next_service_km: vehicle.next_service_km,
    insurance_number: vehicle.insurance_number,
    insurance_expiry: vehicle.insurance_expiry,
    permit_number: vehicle.permit_number,
    permit_expiry: vehicle.permit_expiry,
    fc_number: vehicle.fc_number,
    fc_expiry: vehicle.fc_expiry,
    puc_number: vehicle.puc_number,
    puc_expiry: vehicle.puc_expiry,
    created_at: vehicle.created_at || new Date().toISOString(),
    updated_at: vehicle.updated_at || new Date().toISOString(),
  }
}

/**
 * Verify vehicle migration
 * @returns {Promise<Object>}
 */
export async function verifyVehicleMigration() {
  try {
    const localVehicles = dataService.get(LOCAL_VEHICLES_KEY, [])
    const supabaseVehicles = await vehicleRepository.getAll()

    const localIds = new Set(localVehicles.map(v => v.id))
    const supabaseIds = new Set(supabaseVehicles.map(v => v.id))

    const missing = [...localIds].filter(id => !supabaseIds.has(id))
    const extra = [...supabaseIds].filter(id => !localIds.has(id))

    return {
      localCount: localVehicles.length,
      supabaseCount: supabaseVehicles.length,
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
 * Rollback vehicle migration
 * @returns {Promise<Object>}
 */
export async function rollbackVehicleMigration() {
  try {
    const supabaseVehicles = await vehicleRepository.getAll()
    dataService.set(LOCAL_VEHICLES_KEY, supabaseVehicles)

    return {
      success: true,
      message: `Rolled back ${supabaseVehicles.length} vehicles to localStorage`,
      recordCount: supabaseVehicles.length,
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
  migrateVehicles,
  verifyVehicleMigration,
  rollbackVehicleMigration,
}
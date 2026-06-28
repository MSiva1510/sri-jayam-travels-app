// ─────────────────────────────────────────────────────────────────────
// TRIP MIGRATION SERVICE
// Handles migration of trips from localStorage to Supabase
// ─────────────────────────────────────────────────────────────────────

import { tripRepository } from '../../repositories/tripRepository'
import { dataService } from '../../services/dataService'
import {
  isMigrationCompleted,
  completeMigration,
  failMigration,
  validateMigrationItem,
} from '../../utils/migrationHelper'
import { isSupabaseConfigured } from '../../lib/supabase'
import { getDatabaseProvider, DATABASE_PROVIDERS } from '../../config/database'

const LOCAL_TRIPS_KEY = 'sjt_trips'

/**
 * Migrate trips from localStorage to Supabase
 * @returns {Promise<Object>} Migration result
 */
export async function migrateTrips() {
  if (isMigrationCompleted('trips')) {
    console.log('Trip migration already completed')
    return { success: true, message: 'Migration already completed', recordCount: 0 }
  }

  if (!isSupabaseConfigured() || getDatabaseProvider() !== DATABASE_PROVIDERS.SUPABASE) {
    console.log('Supabase not configured or not active, skipping migration')
    return { success: true, message: 'Supabase not configured', recordCount: 0 }
  }

  try {
    const localTrips = dataService.get(LOCAL_TRIPS_KEY, [])

    if (localTrips.length === 0) {
      console.log('No trips to migrate')
      completeMigration('trips', 0, [])
      return { success: true, message: 'No trips to migrate', recordCount: 0 }
    }

    console.log(`Starting migration of ${localTrips.length} trips...`)

    const errors = []
    let successCount = 0

    for (const trip of localTrips) {
      try {
        const validation = validateMigrationItem('trip', trip)
        if (!validation.valid) {
          errors.push(`Trip ${trip.id}: ${validation.errors.join(', ')}`)
          continue
        }

        const existing = await tripRepository.getById(trip.id)
        if (existing) {
          console.log(`Trip ${trip.id} already exists in Supabase, skipping`)
          successCount++
          continue
        }

        const normalizedTrip = normalizeTripData(trip)
        await tripRepository.create(normalizedTrip)
        successCount++
      } catch (error) {
        errors.push(`Trip ${trip.id}: ${error.message}`)
        console.error(`Failed to migrate trip ${trip.id}:`, error)
      }
    }

    completeMigration('trips', successCount, errors)
    console.log(`Trip migration completed: ${successCount}/${localTrips.length} succeeded`)

    return {
      success: errors.length === 0,
      message: `Migrated ${successCount} trips`,
      recordCount: successCount,
      errors: errors.length > 0 ? errors : undefined,
    }
  } catch (error) {
    console.error('Trip migration failed:', error)
    failMigration('trips', error.message)
    return {
      success: false,
      message: error.message,
      recordCount: 0,
      error: error.message,
    }
  }
}

function normalizeTripData(trip) {
  return {
    id: trip.id,
    booking_id: trip.booking_id || trip.id,
    booking_number: trip.booking_number,
    type: trip.type,
    status: trip.status || 'draft',
    customer_id: trip.customer_id,
    customer_name: trip.customer_name,
    customer_contact: trip.customer_contact,
    driver_id: trip.driver_id,
    vehicle_id: trip.vehicle_id,
    pickup_location: trip.pickup_location,
    drop_location: trip.drop_location,
    start_date: trip.start_date,
    start_time: trip.start_time,
    end_date: trip.end_date,
    end_time: trip.end_time,
    pickup_odometer: trip.pickup_odometer,
    drop_odometer: trip.drop_odometer,
    total_km: trip.total_km,
    base_fare: trip.base_fare,
    total_fare: trip.total_fare,
    notes: trip.notes,
    type_data: trip.type_data,
    created_at: trip.created_at || new Date().toISOString(),
    updated_at: trip.updated_at || new Date().toISOString(),
  }
}

/**
 * Verify trip migration
 * @returns {Promise<Object>}
 */
export async function verifyTripMigration() {
  try {
    const localTrips = dataService.get(LOCAL_TRIPS_KEY, [])
    const supabaseTrips = await tripRepository.getAll()

    const localIds = new Set(localTrips.map(t => t.id))
    const supabaseIds = new Set(supabaseTrips.map(t => t.id))

    const missing = [...localIds].filter(id => !supabaseIds.has(id))
    const extra = [...supabaseIds].filter(id => !localIds.has(id))

    return {
      localCount: localTrips.length,
      supabaseCount: supabaseTrips.length,
      missing: missing.length > 0 ? missing : undefined,
      extra: extra.length > 0 ? extra : undefined,
      verified: missing.length === 0 && extra.length === 0,
    }
  } catch (error) {
    console.error('Verification failed:', error)
    return { verified: false, error: error.message }
  }
}

/**
 * Rollback trip migration
 * @returns {Promise<Object>}
 */
export async function rollbackTripMigration() {
  try {
    const supabaseTrips = await tripRepository.getAll()
    dataService.set(LOCAL_TRIPS_KEY, supabaseTrips)

    return {
      success: true,
      message: `Rolled back ${supabaseTrips.length} trips to localStorage`,
      recordCount: supabaseTrips.length,
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
  migrateTrips,
  verifyTripMigration,
  rollbackTripMigration,
}
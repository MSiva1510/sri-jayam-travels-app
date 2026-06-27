// ─────────────────────────────────────────────────────────────────────
// VEHICLE MIGRATION HELPER
// Utilities specific to vehicle migration
// ─────────────────────────────────────────────────────────────────────

import { dataService } from '../services/dataService'

const VEHICLE_MIGRATION_KEY = 'sjt_vehicle_migration'

/**
 * Get vehicle migration status
 * @returns {Object|null}
 */
export function getVehicleMigrationStatus() {
  return dataService.get(VEHICLE_MIGRATION_KEY, null)
}

/**
 * Set vehicle migration status
 * @param {Object} status
 */
export function setVehicleMigrationStatus(status) {
  dataService.set(VEHICLE_MIGRATION_KEY, {
    ...status,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Mark vehicle migration as complete
 * @param {number} vehicleCount
 * @param {number} documentCount
 * @param {Array} errors
 */
export function completeVehicleMigration(vehicleCount, documentCount = 0, errors = []) {
  setVehicleMigrationStatus({
    completed: true,
    vehicleCount,
    documentCount,
    errors,
    completedAt: new Date().toISOString(),
  })
}

/**
 * Check if vehicle migration is complete
 * @returns {boolean}
 */
export function isVehicleMigrationComplete() {
  const status = getVehicleMigrationStatus()
  return status?.completed === true
}

/**
 * Get vehicle migration summary
 * @returns {Object}
 */
export function getVehicleMigrationSummary() {
  const status = getVehicleMigrationStatus()
  return {
    isComplete: status?.completed === false,
    vehicleCount: status?.vehicleCount || 0,
    documentCount: status?.documentCount || 0,
    errors: status?.errors || [],
    completedAt: status?.completedAt,
    timestamp: status?.timestamp,
  }
}

/**
 * Reset vehicle migration status
 */
export function resetVehicleMigration() {
  dataService.remove(VEHICLE_MIGRATION_KEY)
}

export default {
  getVehicleMigrationStatus,
  setVehicleMigrationStatus,
  completeVehicleMigration,
  isVehicleMigrationComplete,
  getVehicleMigrationSummary,
  resetVehicleMigration,
}
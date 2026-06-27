// ─────────────────────────────────────────────────────────────────────
// MIGRATION HELPER
// Utilities for managing data migrations
// ─────────────────────────────────────────────────────────────────────

import { dataService } from '../services/dataService'

const MIGRATION_LOG_KEY = 'sjt_migration_log'
const MIGRATION_STATUS_KEY = 'sjt_migration_status'

/**
 * Get migration status
 * @param {string} key - Migration identifier (e.g., 'customers', 'drivers')
 * @returns {Object|null}
 */
export function getMigrationStatus(key) {
  const statuses = dataService.get(MIGRATION_STATUS_KEY, {})
  return statuses[key] || null
}

/**
 * Set migration status
 * @param {string} key
 * @param {Object} status
 */
export function setMigrationStatus(key, status) {
  const statuses = dataService.get(MIGRATION_STATUS_KEY, {})
  statuses[key] = {
    ...status,
    timestamp: new Date().toISOString(),
  }
  dataService.set(MIGRATION_STATUS_KEY, statuses)
}

/**
 * Check if migration has been completed
 * @param {string} key
 * @returns {boolean}
 */
export function isMigrationCompleted(key) {
  const status = getMigrationStatus(key)
  return status?.completed === true
}

/**
 * Mark migration as completed
 * @param {string} key
 * @param {number} recordCount
 * @param {Array} errors
 */
export function completeMigration(key, recordCount = 0, errors = []) {
  setMigrationStatus(key, {
    completed: true,
    recordCount,
    errors,
    completedAt: new Date().toISOString(),
  })
  addMigrationLog(key, 'completed', recordCount, errors)
}

/**
 * Mark migration as failed
 * @param {string} key
 * @param {string} error
 */
export function failMigration(key, error) {
  setMigrationStatus(key, {
    completed: false,
    error,
    failedAt: new Date().toISOString(),
  })
  addMigrationLog(key, 'failed', 0, [error])
}

/**
 * Add entry to migration log
 * @param {string} key
 * @param {string} status
 * @param {number} recordCount
 * @param {Array} errors
 */
export function addMigrationLog(key, status, recordCount = 0, errors = []) {
  const logs = dataService.get(MIGRATION_LOG_KEY, [])
  logs.push({
    key,
    status,
    recordCount,
    errors,
    timestamp: new Date().toISOString(),
  })
  dataService.set(MIGRATION_LOG_KEY, logs)
}

/**
 * Get migration logs
 * @returns {Array}
 */
export function getMigrationLogs() {
  return dataService.get(MIGRATION_LOG_KEY, [])
}

/**
 * Clear migration status for a key
 * @param {string} key
 */
export function clearMigrationStatus(key) {
  const statuses = dataService.get(MIGRATION_STATUS_KEY, {})
  delete statuses[key]
  dataService.set(MIGRATION_STATUS_KEY, statuses)
}

/**
 * Reset all migration data (useful for testing)
 */
export function resetAllMigrations() {
  dataService.remove(MIGRATION_LOG_KEY)
  dataService.remove(MIGRATION_STATUS_KEY)
}

/**
 * Get migration summary
 * @returns {Object}
 */
export function getMigrationSummary() {
  const statuses = dataService.get(MIGRATION_STATUS_KEY, {})
  const logs = dataService.get(MIGRATION_LOG_KEY, [])

  return {
    statuses,
    logs,
    completed: Object.values(statuses).filter(s => s.completed).length,
    failed: Object.values(statuses).filter(s => !s.completed && s.error).length,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Validate migration data
 * @param {string} type - 'customer' or 'driver'
 * @param {Object} item
 * @returns {Object} {valid: boolean, errors: Array}
 */
export function validateMigrationItem(type, item) {
  const errors = []

  if (type === 'customer') {
    if (!item.id) errors.push('Missing id')
    if (!item.name) errors.push('Missing name')
    if (!item.type) errors.push('Missing type')
  } else if (type === 'driver') {
    if (!item.id) errors.push('Missing id')
    if (!item.name) errors.push('Missing name')
    if (!item.phone) errors.push('Missing phone')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export default {
  getMigrationStatus,
  setMigrationStatus,
  isMigrationCompleted,
  completeMigration,
  failMigration,
  addMigrationLog,
  getMigrationLogs,
  clearMigrationStatus,
  resetAllMigrations,
  getMigrationSummary,
  validateMigrationItem,
}
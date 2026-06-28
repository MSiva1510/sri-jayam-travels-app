// ─────────────────────────────────────────────────────────────────────
// MIGRATION LOGGER
// Comprehensive migration logging and reporting
// ─────────────────────────────────────────────────────────────────────

import { dataService } from '../services/dataService'

const MIGRATION_EVENTS_KEY = 'sjt_migration_events'
const MIGRATION_SUMMARY_KEY = 'sjt_migration_summary'

/**
 * Log migration event
 * @param {string} module - Module name (customers, drivers, vehicles, etc)
 * @param {string} action - Action (start, complete, fail, etc)
 * @param {Object} details - Additional details
 */
export function logMigrationEvent(module, action, details = {}) {
  const events = dataService.get(MIGRATION_EVENTS_KEY, [])
  const event = {
    module,
    action,
    details,
    timestamp: new Date().toISOString(),
  }
  events.push(event)
  dataService.set(MIGRATION_EVENTS_KEY, events)
  console.log(`[Migration] ${module}: ${action}`, details)
}

/**
 * Get all migration events
 * @returns {Array}
 */
export function getMigrationEvents() {
  return dataService.get(MIGRATION_EVENTS_KEY, [])
}

/**
 * Get migration events for a specific module
 * @param {string} module
 * @returns {Array}
 */
export function getModuleMigrationEvents(module) {
  const events = dataService.get(MIGRATION_EVENTS_KEY, [])
  return events.filter(e => e.module === module)
}

/**
 * Get migration summary
 * @returns {Object}
 */
export function getMigrationSummary() {
  return dataService.get(MIGRATION_SUMMARY_KEY, {
    startTime: null,
    endTime: null,
    modules: {},
    totalRecords: 0,
    totalErrors: 0,
    status: 'pending',
  })
}

/**
 * Update migration summary
 * @param {Object} summary
 */
export function updateMigrationSummary(summary) {
  const current = getMigrationSummary()
  const updated = { ...current, ...summary, lastUpdated: new Date().toISOString() }
  dataService.set(MIGRATION_SUMMARY_KEY, updated)
}

/**
 * Start migration tracking
 */
export function startMigrationTracking() {
  const summary = {
    startTime: new Date().toISOString(),
    status: 'in_progress',
    modules: {},
    totalRecords: 0,
    totalErrors: 0,
  }
  dataService.set(MIGRATION_SUMMARY_KEY, summary)
  logMigrationEvent('system', 'migration_started')
}

/**
 * Complete migration tracking
 */
export function completeMigrationTracking() {
  const summary = getMigrationSummary()
  summary.endTime = new Date().toISOString()
  summary.status = summary.totalErrors === 0 ? 'completed' : 'completed_with_errors'
  dataService.set(MIGRATION_SUMMARY_KEY, summary)
  logMigrationEvent('system', 'migration_completed', summary)
}

/**
 * Add module migration status
 * @param {string} module
 * @param {Object} status
 */
export function addModuleMigrationStatus(module, status) {
  const summary = getMigrationSummary()
  summary.modules[module] = status
  summary.totalRecords += status.recordCount || 0
  summary.totalErrors += (status.errors && status.errors.length) || 0
  dataService.set(MIGRATION_SUMMARY_KEY, summary)
}

/**
 * Generate migration report
 * @returns {string}
 */
export function generateMigrationReport() {
  const summary = getMigrationSummary()
  const events = getMigrationEvents()

  let report = `
═══════════════════════════════════════════════════════════
                  MIGRATION REPORT
═══════════════════════════════════════════════════════════

Status: ${summary.status}
Start Time: ${summary.startTime}
End Time: ${summary.endTime || 'In Progress'}
Total Records Migrated: ${summary.totalRecords}
Total Errors: ${summary.totalErrors}

MODULES:
────────────────────────────────────────────────────────────
`

  Object.entries(summary.modules).forEach(([module, status]) => {
    report += `${module.toUpperCase()}\n`
    report += `  Records: ${status.recordCount || 0}\n`
    report += `  Status: ${status.status || 'unknown'}\n`
    if (status.errors && status.errors.length > 0) {
      report += `  Errors: ${status.errors.length}\n`
    }
    report += '\n'
  })

  report += `
EVENTS:
────────────────────────────────────────────────────────────
`

  events.slice(-10).forEach(event => {
    report += `${event.timestamp} | ${event.module.toUpperCase()}: ${event.action}\n`
  })

  report += `
═══════════════════════════════════════════════════════════
`

  return report
}

/**
 * Clear all migration logs
 */
export function clearMigrationLogs() {
  dataService.remove(MIGRATION_EVENTS_KEY)
  dataService.remove(MIGRATION_SUMMARY_KEY)
}

export default {
  logMigrationEvent,
  getMigrationEvents,
  getModuleMigrationEvents,
  getMigrationSummary,
  updateMigrationSummary,
  startMigrationTracking,
  completeMigrationTracking,
  addModuleMigrationStatus,
  generateMigrationReport,
  clearMigrationLogs,
}
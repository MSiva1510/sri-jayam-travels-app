// ─────────────────────────────────────────────────────────────────────
// MIGRATION LOGGER
// Comprehensive migration logging and reporting
// ─────────────────────────────────────────────────────────────────────

const MIGRATION_STATUS_KEY = 'sjt_migration_status'
const MIGRATION_EVENTS_KEY = 'sjt_migration_events'

/**
 * Start migration tracking
 */
export function startMigrationTracking() {
  const status = {
    startTime: new Date().toISOString(),
    status: 'in_progress',
    modules: {},
    totalRecords: 0,
    totalErrors: 0,
    endTime: null,
  }
  try {
    localStorage.setItem(MIGRATION_STATUS_KEY, JSON.stringify(status))
  } catch (error) {
    console.error('Failed to save migration status:', error)
  }
}

/**
 * Complete migration tracking
 */
export function completeMigrationTracking() {
  try {
    const status = loadMigrationStatus()
    status.endTime = new Date().toISOString()
    status.status = status.totalErrors === 0 ? 'completed' : 'completed_with_errors'
    localStorage.setItem(MIGRATION_STATUS_KEY, JSON.stringify(status))
  } catch (error) {
    console.error('Failed to complete migration tracking:', error)
  }
}

/**
 * Add module migration status
 * @param {string} module - Module name
 * @param {Object} result - Migration result
 */
export function addModuleMigrationStatus(module, result) {
  try {
    const status = loadMigrationStatus()
    status.modules[module] = {
      success: result.success,
      recordCount: result.recordCount || 0,
      errors: result.errors || [],
      message: result.message,
      timestamp: new Date().toISOString(),
    }
    status.totalRecords += result.recordCount || 0
    status.totalErrors += (result.errors && result.errors.length) || 0
    localStorage.setItem(MIGRATION_STATUS_KEY, JSON.stringify(status))
  } catch (error) {
    console.error('Failed to add module migration status:', error)
  }
}

/**
 * Load migration status from localStorage
 * @returns {Object}
 */
export function loadMigrationStatus() {
  try {
    const stored = localStorage.getItem(MIGRATION_STATUS_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('Failed to load migration status:', error)
  }
  return {
    startTime: null,
    endTime: null,
    status: 'pending',
    modules: {},
    totalRecords: 0,
    totalErrors: 0,
  }
}

/**
 * Clear migration status
 */
export function clearMigrationStatus() {
  try {
    localStorage.removeItem(MIGRATION_STATUS_KEY)
    localStorage.removeItem(MIGRATION_EVENTS_KEY)
  } catch (error) {
    console.error('Failed to clear migration status:', error)
  }
}

/**
 * Log migration event
 * @param {string} module - Module name
 * @param {string} action - Action name
 * @param {Object} details - Additional details
 */
export function logMigrationEvent(module, action, details = {}) {
  try {
    let events = []
    const stored = localStorage.getItem(MIGRATION_EVENTS_KEY)
    if (stored) {
      events = JSON.parse(stored)
    }
    events.push({
      module,
      action,
      details,
      timestamp: new Date().toISOString(),
    })
    localStorage.setItem(MIGRATION_EVENTS_KEY, JSON.stringify(events))
  } catch (error) {
    console.error('Failed to log migration event:', error)
  }
}

/**
 * Get migration events
 * @returns {Array}
 */
export function getMigrationEvents() {
  try {
    const stored = localStorage.getItem(MIGRATION_EVENTS_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('Failed to get migration events:', error)
  }
  return []
}

/**
 * Get module migration events
 * @param {string} module
 * @returns {Array}
 */
export function getModuleMigrationEvents(module) {
  const events = getMigrationEvents()
  return events.filter(e => e.module === module)
}

/**
 * Generate migration report
 * @returns {string}
 */
export function generateMigrationReport() {
  const status = loadMigrationStatus()
  const events = getMigrationEvents()

  let report = `
═══════════════════════════════════════════════════════════
                  MIGRATION REPORT
═══════════════════════════════════════════════════════════

Status: ${status.status}
Start Time: ${status.startTime}
End Time: ${status.endTime || 'In Progress'}
Total Records Migrated: ${status.totalRecords}
Total Errors: ${status.totalErrors}

MODULES:
────────────────────────────────────────────────────────────
`

  Object.entries(status.modules).forEach(([module, moduleStatus]) => {
    report += `${module.toUpperCase()}\n`
    report += `  Records: ${moduleStatus.recordCount || 0}\n`
    report += `  Status: ${moduleStatus.success ? 'success' : 'failed'}\n`
    if (moduleStatus.errors && moduleStatus.errors.length > 0) {
      report += `  Errors: ${moduleStatus.errors.length}\n`
    }
    report += '\n'
  })

  report += `
RECENT EVENTS:
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

export default {
  startMigrationTracking,
  completeMigrationTracking,
  addModuleMigrationStatus,
  loadMigrationStatus,
  clearMigrationStatus,
  logMigrationEvent,
  getMigrationEvents,
  getModuleMigrationEvents,
  generateMigrationReport,
}
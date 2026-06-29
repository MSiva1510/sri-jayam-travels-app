// ─────────────────────────────────────────────────────────────────────
// REPORT MIGRATION SERVICE
// Handles report data initialization (reports are computed, not migrated)
// ─────────────────────────────────────────────────────────────────────

import {
  isMigrationCompleted,
  completeMigration,
} from '../../utils/migrationHelper'
import { isSupabaseConfigured } from '../../lib/supabase'
import { getDatabaseProvider, DATABASE_PROVIDERS } from '../../config/database'

/**
 * Initialize report data (no actual migration, just mark as ready)
 * @returns {Promise<Object>}
 */
export async function migrateReports() {
  if (isMigrationCompleted('reports')) {
    console.log('Reports already initialized')
    return { success: true, message: 'Reports already initialized', recordCount: 0 }
  }

  if (!isSupabaseConfigured() || getDatabaseProvider() !== DATABASE_PROVIDERS.SUPABASE) {
    console.log('Supabase not configured, skipping reports initialization')
    return { success: true, message: 'Supabase not configured', recordCount: 0 }
  }

  try {
    console.log('Initializing report data...')
    completeMigration('reports', 0, [])
    console.log('Report data initialized')

    return {
      success: true,
      message: 'Reports initialized',
      recordCount: 0,
    }
  } catch (error) {
    console.error('Reports initialization failed:', error)
    return {
      success: false,
      message: error.message,
      recordCount: 0,
      error: error.message,
    }
  }
}

export default {
  migrateReports,
}
// ─────────────────────────────────────────────────────────────────────
// DATABASE CONFIGURATION
// Supports both localStorage and Supabase providers
// ─────────────────────────────────────────────────────────────────────

import { dataService } from '../services/dataService'
import { isSupabaseConfigured } from '../lib/supabase'

/**
 * Database configuration
 * Controls which storage provider is used
 */
const DATABASE_CONFIG = {
  provider: import.meta.env.VITE_DATABASE_PROVIDER || 'local',  // 'local' | 'supabase'
  debug: import.meta.env.VITE_DATABASE_DEBUG === 'true' || false,
}

/**
 * Available database providers
 */
export const DATABASE_PROVIDERS = {
  LOCAL: 'local',
  SUPABASE: 'supabase',
}

/**
 * Get current database provider
 * @returns {string} Current provider name
 */
export function getDatabaseProvider() {
  // If Supabase is not configured, force local
  if (DATABASE_CONFIG.provider === DATABASE_PROVIDERS.SUPABASE && !isSupabaseConfigured()) {
    if (DATABASE_CONFIG.debug) {
      console.warn('⚠️ Supabase not configured, falling back to localStorage')
    }
    return DATABASE_PROVIDERS.LOCAL
  }
  return DATABASE_CONFIG.provider
}

/**
 * Set database provider
 * @param {string} provider - 'local' or 'supabase'
 */
export function setDatabaseProvider(provider) {
  if (!Object.values(DATABASE_PROVIDERS).includes(provider)) {
    throw new Error(`Invalid provider: ${provider}`)
  }
  DATABASE_CONFIG.provider = provider
  dataService.setService(provider === DATABASE_PROVIDERS.SUPABASE ? 'supabase' : 'localStorage')
  
  if (DATABASE_CONFIG.debug) {
    console.log(`📦 Database provider switched to: ${provider}`)
  }
}

/**
 * Check if using local storage
 * @returns {boolean} True if using localStorage
 */
export function isLocalStorage() {
  return getDatabaseProvider() === DATABASE_PROVIDERS.LOCAL
}

/**
 * Check if using Supabase
 * @returns {boolean} True if using Supabase
 */
export function isSupabaseProvider() {
  return getDatabaseProvider() === DATABASE_PROVIDERS.SUPABASE
}

/**
 * Get database configuration
 * @returns {Object} Current configuration
 */
export function getDatabaseConfig() {
  return {
    provider: getDatabaseProvider(),
    isLocalStorage: isLocalStorage(),
    isSupabase: isSupabaseProvider(),
    isSupabaseConfigured: isSupabaseConfigured(),
    debug: DATABASE_CONFIG.debug,
  }
}

/**
 * Initialize database
 * Called on app startup
 */
export function initializeDatabase() {
  const config = getDatabaseConfig()
  
  if (DATABASE_CONFIG.debug) {
    console.log('📦 Database initialized', config)
  }
  
  return config
}

export default DATABASE_CONFIG
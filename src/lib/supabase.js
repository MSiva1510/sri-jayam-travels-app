// ─────────────────────────────────────────────────────────────────────
// SUPABASE CLIENT INITIALIZATION
// Initializes Supabase client with environment variables
// ─────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase environment variables not configured. Using localStorage only.')
}

/**
 * Supabase client instance
 * Available only if VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set
 */
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,  // We manage auth separately
      },
    })
  : null

/**
 * Check if Supabase is configured
 * @returns {boolean} True if Supabase client is initialized
 */
export function isSupabaseConfigured() {
  return supabase !== null
}

/**
 * Health check for Supabase connection
 * @returns {Promise<Object>} Health status
 */
export async function checkSupabaseHealth() {
  if (!isSupabaseConfigured()) {
    return {
      isHealthy: false,
      message: 'Supabase not configured',
      timestamp: new Date().toISOString()
    }
  }

  try {
    const { data, error } = await supabase.from('_health_check').select('1').limit(1)
    
    if (error && error.code === 'PGRST116') {
      // Table doesn't exist yet - this is expected during bootstrap
      return {
        isHealthy: true,
        message: 'Supabase configured and responding (no tables yet)',
        timestamp: new Date().toISOString()
      }
    }

    if (error) {
      return {
        isHealthy: false,
        message: `Supabase error: ${error.message}`,
        timestamp: new Date().toISOString()
      }
    }

    return {
      isHealthy: true,
      message: 'Supabase healthy and ready',
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return {
      isHealthy: false,
      message: `Connection error: ${error.message}`,
      timestamp: new Date().toISOString()
    }
  }
}

export default supabase
import { createClient } from '@supabase/supabase-js'
import authStorage from './authStorage.js'

// import.meta.env is undefined outside Vite (node --test); degrade to "not configured"
const env = import.meta.env ?? {}
const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseKey = env.VITE_SUPABASE_ANON_KEY

let supabase = null

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        // localStorage when "Remember me" is on, sessionStorage when off.
        storage: authStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  } catch (error) {
    console.error('Failed to initialize Supabase:', error)
    supabase = null
  }
}

export function isSupabaseConfigured() {
  return supabase !== null
}

export default supabase
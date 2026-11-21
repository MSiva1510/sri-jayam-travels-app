import { isSupabaseConfigured } from '../lib/supabase'

export const DATABASE_PROVIDERS = {
  SUPABASE: 'supabase',
  LOCAL: 'localStorage',
}

export function getDatabaseProvider() {
  return isSupabaseConfigured() ? DATABASE_PROVIDERS.SUPABASE : DATABASE_PROVIDERS.LOCAL
}

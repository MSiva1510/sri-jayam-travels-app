// ─── Per-user profile preferences ─────────────────────────────
// Notification choices are per user and must follow the account across
// devices, so they live in the `notification_preferences` table (one row
// per user) rather than in component state or the admin-only `settings`
// table.

import supabase from '../lib/supabase'

export const DEFAULT_PROFILE_PREFS = {
  notifRide:  true,
  notifEmail: false,
  notifSMS:   true,
}

// App preference → notification_preferences column.
const COLUMNS = {
  notifRide:  'trip_notifications',
  notifEmail: 'email_enabled',
  notifSMS:   'sms_enabled',
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

function fromRow(row) {
  const prefs = { ...DEFAULT_PROFILE_PREFS }
  if (!row) return prefs
  Object.entries(COLUMNS).forEach(([pref, col]) => {
    if (row[col] !== null && row[col] !== undefined) prefs[pref] = Boolean(row[col])
  })
  return prefs
}

function toRow(prefs) {
  const row = {}
  Object.entries(COLUMNS).forEach(([pref, col]) => {
    if (prefs[pref] !== undefined) row[col] = Boolean(prefs[pref])
  })
  row.updated_at = new Date().toISOString()
  return row
}

export async function loadProfilePrefs(userId) {
  if (!userId) return { ...DEFAULT_PROFILE_PREFS }
  const { data, error } = await requireSupabase()
    .from('notification_preferences')
    .select('trip_notifications,email_enabled,sms_enabled')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message || 'Could not load preferences')
  return fromRow(data)
}

export async function saveProfilePrefs(userId, prefs) {
  if (!userId) throw new Error('Not signed in')
  const db = requireSupabase()
  const row = toRow(prefs)

  // A row may not exist yet, and user_id has no ON CONFLICT target, so
  // update first and insert only when nothing was updated.
  const { data, error } = await db
    .from('notification_preferences')
    .update(row)
    .eq('user_id', userId)
    .select('user_id')
  if (error) throw new Error(error.message || 'Could not save preferences')
  if (!Array.isArray(data) || data.length === 0) {
    const { error: insertError } = await db
      .from('notification_preferences')
      .insert({ user_id: userId, ...row })
    if (insertError) throw new Error(insertError.message || 'Could not save preferences')
  }

  return { ...DEFAULT_PROFILE_PREFS, ...prefs }
}

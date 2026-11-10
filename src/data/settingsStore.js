// ─── Settings store (key/value) ───────────────────────────────
// The live `settings` table has NO unique constraint on `key` (or
// `setting_key`), so PostgREST's `upsert(..., { onConflict })` fails with
// 42P10. Every save used to fail silently and lose the change.
//
// This helper writes without relying on a constraint:
//   1. update the row where setting_key = key
//   2. update the legacy row where key = key
//   3. insert a new row (both columns set, so reads work either way)
//
// Reads accept either column, so old rows (setting_key only) and new rows
// (both columns) both resolve.

import supabase from '../lib/supabase'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

function clean(v) {
  return v === undefined ? null : v
}

// Filter for either the canonical or the legacy column.
function keyFilter(key) {
  const safe = String(key).replace(/[,()]/g, '')
  return `setting_key.eq.${safe},key.eq.${safe}`
}

export async function loadSettingValue(key, fallback = null) {
  if (!supabase) return fallback
  const { data, error } = await requireSupabase()
    .from('settings')
    .select('setting_key,key,setting_value,value')
    .or(keyFilter(key))
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return fallback
  const value = data.setting_value ?? data.value
  return value === null || value === undefined ? fallback : value
}

export async function saveSettingValue(key, value) {
  const db = requireSupabase()
  const payload = {
    key,
    setting_key: key,
    value: clean(value),
    setting_value: clean(value),
    updated_at: new Date().toISOString(),
  }

  // 1. Canonical column used by the current app.
  let { data, error } = await db
    .from('settings')
    .update(payload)
    .eq('setting_key', key)
    .select('id')
  if (error) throw error
  if (Array.isArray(data) && data.length > 0) return true

  // 2. Legacy rows written with only the `key` column.
  ;({ data, error } = await db
    .from('settings')
    .update(payload)
    .eq('key', key)
    .select('id'))
  if (error) throw error
  if (Array.isArray(data) && data.length > 0) return true

  // 3. First save for this key.
  ;({ error } = await db.from('settings').insert(payload))
  if (error) throw error
  return true
}

export async function deleteSettingValue(key) {
  const { error } = await requireSupabase()
    .from('settings')
    .delete()
    .or(keyFilter(key))
  if (error) throw error
  return true
}

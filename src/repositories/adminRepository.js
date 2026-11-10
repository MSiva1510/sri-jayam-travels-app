// ─── Admin Repository ─────────────────────────────────────────
import supabase from '../lib/supabase'
import { saveSettingValue } from '../data/settingsStore'

export const DEFAULT_BACKUP_CONFIGS = [
  { id:'bc-1', name:'Manual Backup',  provider:'manual',   is_active:true,  retention_days:30, last_backup_status:'never' },
  { id:'bc-2', name:'Supabase Auto',  provider:'supabase', is_active:false, retention_days:7,  last_backup_status:'never' },
  { id:'bc-3', name:'Google Drive',   provider:'gdrive',   is_active:false, retention_days:90, last_backup_status:'never' },
  { id:'bc-4', name:'OneDrive',       provider:'onedrive', is_active:false, retention_days:90, last_backup_status:'never' },
]

// ── Role Permissions ──────────────────────────────────────────
export const rolePermissionRepository = {
  async getAll() {
    if (!supabase) return []
    try {
      const { data } = await supabase.from('role_permissions').select('*')
      return data || []
    } catch {}
    return []
  },
  async upsert(role, permission, isAllowed) {
    const entry = { role, permission, is_allowed: isAllowed, updated_at: new Date().toISOString() }
    if (!supabase) return entry
    try {
      const { data } = await supabase.from('role_permissions')
        .upsert(entry, { onConflict: 'role,permission' }).select().single()
      return data || entry
    } catch {}
    return entry
  },
  async getForRole(role) {
    const all = await this.getAll()
    return all.filter(r => r.role === role)
  },
}

// ── Session Log ───────────────────────────────────────────────
export const sessionLogRepository = {
  async getAll({ userId, limit = 50, offset = 0 } = {}) {
    if (!supabase) return { data: [], count: 0 }
    try {
      let q = supabase.from('session_log').select('*', { count: 'exact' })
      if (userId) q = q.eq('user_id', userId)
      q = q.order('created_at', { ascending: false }).range(offset, offset + limit - 1)
      const { data, count } = await q
      return { data: data || [], count: count || 0 }
    } catch {}
    return { data: [], count: 0 }
  },
}

// ── Error Log ─────────────────────────────────────────────────
export const errorLogRepository = {
  async getAll({ severity, module, resolved, limit = 50, offset = 0 } = {}) {
    if (!supabase) return { data: [], count: 0 }
    try {
      let q = supabase.from('error_log').select('*', { count: 'exact' })
      if (severity != null) q = q.eq('severity', severity)
      if (module)           q = q.eq('module', module)
      if (resolved != null) q = q.eq('resolved', resolved)
      q = q.order('created_at', { ascending: false }).range(offset, offset + limit - 1)
      const { data, count } = await q
      return { data: data || [], count: count || 0 }
    } catch {}
    return { data: [], count: 0 }
  },
  async resolve(id, resolvedBy) {
    if (!supabase) return
    try {
      await supabase.from('error_log').update({
        resolved:true, resolved_by:resolvedBy, resolved_at:new Date().toISOString()
      }).eq('id', id)
    } catch {}
  },
}

// ── System Settings ───────────────────────────────────────────
export const systemSettingsRepository = {
  async getAll() {
    if (!supabase) return []
    try {
      const { data } = await supabase.from('settings').select('*')
      return data || []
    } catch {}
    return []
  },
  async get(key) {
    if (!supabase) return null
    try {
      const { data } = await supabase.from('settings').select('*').eq('setting_key', key).single()
      if (data) return data.setting_value
    } catch {}
    return null
  },
  async set(key, value, updatedBy) {
    if (!supabase) return
    try {
      await saveSettingValue(key, String(value))
    } catch (err) {
      console.error('[adminRepository] system setting save failed:', key, err)
    }
  },
  async setBulk(pairs, updatedBy) {
    return Promise.all(Object.entries(pairs).map(([k,v]) => this.set(k, v, updatedBy)))
  },
}

// ── Backup Config ─────────────────────────────────────────────
export const backupRepository = {
  async getConfigs() {
    if (!supabase) return DEFAULT_BACKUP_CONFIGS
    try {
      const { data } = await supabase.from('backup_config').select('*').order('created_at')
      if (data?.length) return data
    } catch {}
    return DEFAULT_BACKUP_CONFIGS
  },
  async getHistory({ limit=20 } = {}) {
    if (!supabase) return []
    try {
      const { data } = await supabase.from('backup_history').select('*').order('started_at',{ascending:false}).limit(limit)
      return data || []
    } catch {}
    return []
  },
  async createHistoryEntry(entry) {
    const item = { ...entry, id:`bk-${Date.now()}`, started_at:new Date().toISOString() }
    if (!supabase) return item
    try {
      const { data } = await supabase.from('backup_history').insert(item).select().single()
      if (data) return data
    } catch {}
    return item
  },
}

// ── Users (admin management) ──────────────────────────────────
export const userAdminRepository = {
  async getAll() {
    if (!supabase) return []
    try {
      const { data } = await supabase.from('users').select('*').order('created_at',{ascending:false})
      return data || []
    } catch {}
    return []
  },
  async update(id, updates) {
    if (!supabase) return { id, ...updates }
    try {
      const { data } = await supabase.from('users').update(updates).eq('id',id).select().single()
      return data || { id, ...updates }
    } catch {}
    return { id, ...updates }
  },
  async getActivityLog(userId, limit=20) {
    if (!supabase) return []
    try {
      const { data } = await supabase.from('audit_logs')
        .select('*').eq('user_id',userId).order('created_at',{ascending:false}).limit(limit)
      return data || []
    } catch {}
    return []
  },
}

// ── Health ────────────────────────────────────────────────────
export const healthRepository = {
  async getSummary() {
    if (!supabase) return { total_bookings:0, active_trips:0, active_drivers:0, total_vehicles:0,
             total_customers:0, audit_events_24h:0, unresolved_errors:0, comm_events_24h:0,
             checked_at:new Date().toISOString() }
    try {
      const { data } = await supabase.from('system_health_summary').select('*').single()
      return data || { total_bookings:0, active_trips:0, active_drivers:0, total_vehicles:0,
             total_customers:0, audit_events_24h:0, unresolved_errors:0, comm_events_24h:0,
             checked_at:new Date().toISOString() }
    } catch {}
    return { total_bookings:0, active_trips:0, active_drivers:0, total_vehicles:0,
             total_customers:0, audit_events_24h:0, unresolved_errors:0, comm_events_24h:0,
             checked_at:new Date().toISOString() }
  },
  async checkConnection() {
    if (!supabase) return { connected:false, latencyMs:0 }
    try {
      const start = Date.now()
      await supabase.from('settings').select('setting_key').limit(1)
      return { connected:true, latencyMs: Date.now()-start }
    } catch {
      return { connected:false, latencyMs:0 }
    }
  },
}

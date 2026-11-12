// ─── Communication Repository ────────────────────────────────
// Data access layer for communication_logs, notification_preferences,
// communication_queue, and communication_providers.
// All operations go to Supabase — no localStorage fallbacks.

import supabase from '../lib/supabase'
import { loadSettingValue, saveSettingValue } from '../data/settingsStore'
import { translateDbError } from '../data/errorUtils'

// ── Communication Logs ────────────────────────────────────────
export const communicationLogRepository = {
  async getAll({ channel, category, status, recipientId, limit = 50, offset = 0 } = {}) {
    if (!supabase) return { data: [], count: 0 }
    try {
      let q = supabase.from('communication_logs').select('*', { count: 'exact' })
      if (channel)     q = q.eq('channel', channel)
      if (category)    q = q.eq('category', category)
      if (status)      q = q.eq('status', status)
      if (recipientId) q = q.eq('recipient_id', recipientId)
      q = q.order('created_at', { ascending: false }).range(offset, offset + limit - 1)
      const { data, count, error } = await q
      if (!error) return { data: data || [], count: count || 0 }
    } catch {}
    return { data: [], count: 0 }
  },

  async create(log) {
    if (!supabase) return { ...log, id: `log-${Date.now()}`, created_at: new Date().toISOString() }
    try {
      const { data, error } = await supabase.from('communication_logs').insert(log).select().single()
      if (!error && data) return data
    } catch (err) {
      console.error('[communicationLogRepository] create failed:', err.message)
    }
    return { ...log, id: `log-${Date.now()}`, created_at: new Date().toISOString() }
  },

  async update(id, updates) {
    if (!supabase || String(id).startsWith('log-')) return null
    try {
      const { data } = await supabase.from('communication_logs').update(updates).eq('id', id).select().single()
      return data
    } catch {}
    return null
  },

  async getStats() {
    if (!supabase) return []
    try {
      // Compute from communication_logs (communication_analytics may not be populated)
      const { data: logs } = await supabase.from('communication_logs').select('channel,status')
      if (!logs) return []
      const channels = [...new Set(logs.map(l => l.channel))]
      return channels.map(ch => ({
        channel:   ch,
        total:     logs.filter(l => l.channel === ch).length,
        delivered: logs.filter(l => l.channel === ch && l.status === 'delivered').length,
        failed:    logs.filter(l => l.channel === ch && l.status === 'failed').length,
        pending:   logs.filter(l => l.channel === ch && l.status === 'pending').length,
      })).filter(s => s.total > 0)
    } catch {}
    return []
  },
}

// ── Notification Preferences ──────────────────────────────────
export const notificationPreferenceRepository = {
  async get(userId) {
    if (!supabase || !userId) return null
    try {
      const { data } = await supabase.from('notification_preferences').select('*').eq('user_id', userId).single()
      return data
    } catch {}
    return null
  },

  async upsert(userId, prefs) {
    if (!supabase || !userId) return null
    try {
      // update-then-insert: notification_preferences.user_id may not have an
      // ON CONFLICT target in all deployments; update-then-insert is safe
      const { data } = await supabase
        .from('notification_preferences')
        .update({ ...prefs, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .select().single()
      if (!data || data.length === 0) {
        await supabase.from('notification_preferences').insert({
          user_id: userId, ...prefs, updated_at: new Date().toISOString()
        })
      }
    } catch {}
    return { user_id: userId, ...prefs, updated_at: new Date().toISOString() }
  },
}

// ── Communication Queue ───────────────────────────────────────
export const communicationQueueRepository = {
  async getPending() {
    if (!supabase) return []
    try {
      const { data } = await supabase.from('communication_queue')
        .select('*').eq('status','pending').order('scheduled_at')
      return data || []
    } catch {}
    return []
  },

  async getById(id) {
    if (!supabase) return null
    try {
      const { data } = await supabase.from('communication_queue').select('*').eq('id', id).single()
      return data
    } catch {}
    return null
  },

  async getStats() {
    if (!supabase) return { total:0, pending:0, processing:0, delivered:0, failed:0, retrying:0, cancelled:0 }
    try {
      const { data } = await supabase.from('communication_queue').select('status')
      if (!data) return { total:0, pending:0, processing:0, delivered:0, failed:0, retrying:0, cancelled:0 }
      return {
        total: data.length,
        pending: data.filter(i => i.status === 'pending').length,
        processing: data.filter(i => i.status === 'processing').length,
        delivered: data.filter(i => i.status === 'delivered').length,
        failed: data.filter(i => i.status === 'failed').length,
        retrying: data.filter(i => i.status === 'retrying').length,
        cancelled: data.filter(i => i.status === 'cancelled').length,
      }
    } catch {}
    return { total:0, pending:0, processing:0, delivered:0, failed:0, retrying:0, cancelled:0 }
  },

  async updateStatus(id, status, extra = {}) {
    if (!supabase || String(id).startsWith('q-')) return null
    try {
      const { data } = await supabase.from('communication_queue')
        .update({ status, processed_at: new Date().toISOString(), ...extra }).eq('id', id).select().single()
      return data
    } catch {}
    return null
  },

  async retry(id) {
    if (!supabase) return null
    try {
      const { data } = await supabase.from('communication_queue')
        .update({ status: 'pending', retry_count: 0, failure_reason: null, processed_at: null }).eq('id', id).select().single()
      return data
    } catch {}
    return null
  },

  async cancel(id) {
    if (!supabase) return null
    try {
      const { data } = await supabase.from('communication_queue')
        .update({ status: 'cancelled' }).eq('id', id).select().single()
      return data
    } catch {}
    return null
  },

  /** Cancel pending queue items older than 1 day (24h). */
  async cancelStalePending(maxAgeHours = 24) {
    if (!supabase) return 0
    try {
      const cutoff = new Date(Date.now() - maxAgeHours * 3_600_000).toISOString()
      const { data } = await supabase.from('communication_queue')
        .update({ status: 'cancelled', processed_at: new Date().toISOString(), failure_reason: 'Auto-cancelled: pending older than 1 day' })
        .eq('status', 'pending')
        .lt('created_at', cutoff)
        .select('id')
      return data?.length ?? 0
    } catch {}
    return 0
  },
}

// ── Provider Configuration ────────────────────────────────────
export const providerRepository = {
  async getAll() {
    if (!supabase) return []
    try {
      const { data } = await supabase.from('communication_providers').select('*')
      return data || []
    } catch {}
    return []
  },

  async getByChannel(channel) {
    const all = await this.getAll()
    return all.filter(p => p.channel === channel)
  },

  async getActive() {
    const all = await this.getAll()
    return all.filter(p => p.is_active)
  },

  normalize(row = {}) {
    return {
      ...row,
      id: row.id || `prov-${Date.now()}`,
      channel: row.channel || '',
      provider: row.provider ?? row.provider_name ?? row.name ?? '',
      is_active: !!row.is_active,
      config: row.config && typeof row.config === 'object' ? row.config : {}
    }
  },

  async getLocalConfig(id) {
    if (!supabase) return {}
    try {
      const { data } = await supabase.from('communication_providers').select('config').eq('id', id).single()
      if (data && data.config && typeof data.config === 'object') return data.config
    } catch {}
    return {}
  },

  async create(provider) {
    if (!supabase) return this.normalize({ ...provider, updated_at: new Date().toISOString() })
    try {
      const entry = { ...provider, updated_at: new Date().toISOString() }
      const { data, error } = await supabase.from('communication_providers').insert(entry).select().single()
      if (!error && data) return data
    } catch (err) {
      console.error('[providerRepository] create failed:', err.message)
    }
    return this.normalize({ ...provider, updated_at: new Date().toISOString() })
  },

  async update(id, updates) {
    if (!supabase) return this.normalize({ ...updates, updated_at: new Date().toISOString() })
    try {
      const { data } = await supabase.from('communication_providers').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single()
      return data
    } catch {}
    return null
  },
}

// ── Mobile push settings (global) ─────────────────────────────
// Stored in `settings` table: { key: 'mobile_push_settings', value: JSON }
const LS_MOBILE_PUSH = 'sjt_mobile_push_settings'
export const mobilePushSettingsRepository = {
  defaults() {
    return { enabled: false, updated_at: null }
  },
  async get() {
    if (supabase) {
      try {
        const value = await loadSettingValue('mobile_push_settings', null)
        if (value) return { ...this.defaults(), ...value }
      } catch {}
    }
    return this.defaults()
  },
  async save(cfg) {
    const value = { ...this.defaults(), ...cfg, updated_at: new Date().toISOString() }
    if (supabase) {
      try {
        await saveSettingValue('mobile_push_settings', value)
      } catch (error) {
        throw translateDbError(error, 'mobilePushSettings.save')
      }
      return value
    }
    return value
  },
}

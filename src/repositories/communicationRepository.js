// ─── Communication Repository ────────────────────────────────
// Data access layer for communication_logs, notification_preferences,
// communication_queue, and communication_providers.

import supabase from '../lib/supabase'

const LS_LOGS   = 'sjt_comm_logs'
const LS_PREFS  = 'sjt_notif_prefs'
const LS_QUEUE  = 'sjt_comm_queue'
const LS_PROV   = 'sjt_comm_providers'
const LS_PROV_CFG = 'sjt_comm_provider_cfg'
// Local credential mirror: used when communication_providers has no
// config column (or is unreachable). Keyed by provider row id.
const rCfg = () => { try { return JSON.parse(localStorage.getItem(LS_PROV_CFG) || '{}') } catch { return {} } }
const wCfg = (id, cfg) => {
  try {
    const all = rCfg()
    if (cfg && Object.keys(cfg).length) all[id] = cfg
    else delete all[id]
    localStorage.setItem(LS_PROV_CFG, JSON.stringify(all))
  } catch {}
}

const rLS = key => { try { return JSON.parse(localStorage.getItem(key)||'[]') } catch { return [] } }
const wLS = (key, d) => { try { localStorage.setItem(key, JSON.stringify(d)) } catch {} }

// ── Communication Logs ────────────────────────────────────────
export const communicationLogRepository = {
  async getAll({ channel, category, status, recipientId, limit = 50, offset = 0 } = {}) {
    if (supabase) {
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
    }
    let all = rLS(LS_LOGS)
    if (channel)     all = all.filter(l => l.channel === channel)
    if (category)    all = all.filter(l => l.category === category)
    if (status)      all = all.filter(l => l.status === status)
    if (recipientId) all = all.filter(l => l.recipient_id === recipientId)
    return { data: all.slice(offset, offset + limit), count: all.length }
  },

  async create(log) {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('communication_logs').insert(log).select().single()
        if (!error && data) return data
      } catch {}
    }
    const entry = { ...log, id: `log-${Date.now()}`, created_at: new Date().toISOString() }
    const logs = rLS(LS_LOGS)
    wLS(LS_LOGS, [entry, ...logs].slice(0, 500))
    return entry
  },

  async update(id, updates) {
    if (supabase && !String(id).startsWith('log-')) {
      try {
        const { data } = await supabase.from('communication_logs').update(updates).eq('id', id).select().single()
        if (data) return data
      } catch {}
    }
    const logs = rLS(LS_LOGS).map(l => l.id === id ? { ...l, ...updates } : l)
    wLS(LS_LOGS, logs)
    return logs.find(l => l.id === id)
  },

  async getStats() {
    if (supabase) {
      try {
        const { data } = await supabase.from('communication_analytics').select('*')
        if (data) return data
      } catch {}
    }
    const all = rLS(LS_LOGS)
    const channels = ['in_app','whatsapp','sms','push','webhook']
    return channels.map(ch => ({
      channel:   ch,
      total:     all.filter(l => l.channel === ch).length,
      delivered: all.filter(l => l.channel === ch && l.status === 'delivered').length,
      failed:    all.filter(l => l.channel === ch && l.status === 'failed').length,
      pending:   all.filter(l => l.channel === ch && l.status === 'pending').length,
    })).filter(s => s.total > 0)
  },
}

// ── Notification Preferences ──────────────────────────────────
export const notificationPreferenceRepository = {
  async get(userId) {
    if (supabase && userId) {
      try {
        const { data } = await supabase.from('notification_preferences').select('*').eq('user_id', userId).single()
        if (data) return data
      } catch {}
    }
    const all = rLS(LS_PREFS)
    return all.find(p => p.user_id === userId) || _defaultPrefs(userId)
  },

  async upsert(userId, prefs) {
    const payload = { user_id: userId, ...prefs, updated_at: new Date().toISOString() }
    if (supabase && userId) {
      try {
        const { data } = await supabase.from('notification_preferences')
          .upsert(payload, { onConflict: 'user_id' }).select().single()
        if (data) return data
      } catch {}
    }
    const all = rLS(LS_PREFS)
    const idx = all.findIndex(p => p.user_id === userId)
    if (idx >= 0) all[idx] = { ...all[idx], ...payload }
    else all.unshift(payload)
    wLS(LS_PREFS, all)
    return payload
  },
}

// ── Communication Queue ───────────────────────────────────────
export const communicationQueueRepository = {
  async getPending() {
    if (supabase) {
      try {
        const { data } = await supabase.from('communication_queue')
          .select('*').eq('status','pending').order('scheduled_at')
        if (data) return data
      } catch {}
    }
    return rLS(LS_QUEUE).filter(i => i.status === 'pending')
  },

  async updateStatus(id, status, extra = {}) {
    if (supabase && !String(id).startsWith('q-')) {
      try {
        await supabase.from('communication_queue')
          .update({ status, processed_at: new Date().toISOString(), ...extra }).eq('id', id)
      } catch {}
    }
    const q = rLS(LS_QUEUE).map(i => i.id === id ? { ...i, status, ...extra } : i)
    wLS(LS_QUEUE, q)
  },
}

// ── Provider Configuration ────────────────────────────────────
// The communication_providers table has no repo-managed migration, so
// writes are tolerant: full payload first, minimal retry on missing
// columns, local registry fallback when the table is unreachable.
const _isMissingColumn = (e) => /column .* does not exist|Could not find the '.*' column/i.test(String(e?.message || ''))
const _provName = (p = {}) => p.provider ?? p.provider_name ?? p.name ?? ''

export const providerRepository = {
  async getAll() {
    let remote = []
    if (supabase) {
      try {
        const { data } = await supabase.from('communication_providers').select('*')
        if (data) remote = data
      } catch {}
    }
    const seen = new Set(remote.map(r => r.id))
    const local = rLS(LS_PROV).filter(l => !seen.has(l.id))
    return [...remote, ...local]
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
      id: row.id || `prov-local-${Date.now()}`,
      channel: row.channel || '',
      provider: _provName(row),
      is_active: !!row.is_active,
      config: row.config && typeof row.config === 'object' ? row.config : {},
    }
  },

  _toLocal(entry) {
    const all = rLS(LS_PROV)
    const idx = all.findIndex(p => p.id === entry.id)
    if (idx >= 0) all[idx] = { ...all[idx], ...entry }
    else all.unshift(entry)
    wLS(LS_PROV, all)
    return entry
  },

  getLocalConfig(id) {
    const rowCfg = rLS(LS_PROV).find(p => p.id === id)?.config
    if (rowCfg && Object.keys(rowCfg).length) return rowCfg
    return rCfg()[id] || {}
  },

  async create(provider) {
    const entry = this.normalize({ ...provider, updated_at: new Date().toISOString() })
    const mirrorCfg = () => wCfg(entry.id, entry.config)
    if (supabase) {
      try {
        const { data, error } = await supabase.from('communication_providers').insert(entry).select().single()
        if (!error && data) { wCfg(data.id || entry.id, entry.config); return data }
      } catch {}
      // Retry without the config blob when columns differ
      try {
        const { config, ...minimal } = entry
        const { data, error } = await supabase.from('communication_providers').insert(minimal).select().single()
        if (!error && data) { wCfg(data.id || entry.id, config); return data }
      } catch {}
    }
    mirrorCfg()
    return this._toLocal(entry)
  },

  async update(id, updates) {
    const payload = { ...updates, updated_at: new Date().toISOString() }
    if (payload.config) wCfg(id, payload.config)
    if (supabase && !String(id).startsWith('prov-local-')) {
      try {
        const { data, error } = await supabase.from('communication_providers').update(payload).eq('id', id).select().single()
        if (!error && data) return data
      } catch {}
      try {
        const { config, ...minimal } = payload
        const { data, error } = await supabase.from('communication_providers').update(minimal).eq('id', id).select().single()
        if (!error && data) return data
      } catch {}
    }
    const all = rLS(LS_PROV).map(p => p.id === id ? { ...p, ...payload } : p)
    wLS(LS_PROV, all)
    return all.find(p => p.id === id) || null
  },
}

// ── Mobile push settings (global) ─────────────────────────────
// Stored in `settings` table: { key: 'mobile_push_settings', value: JSON }
// Local fallback when the table is unreachable.
const LS_MOBILE_PUSH = 'sjt_mobile_push_settings'
export const mobilePushSettingsRepository = {
  defaults() {
    return { enabled: false, updated_at: null }
  },
  async get() {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('settings').select('value').eq('key', 'mobile_push_settings').single()
        if (!error && data?.value) return { ...this.defaults(), ...data.value }
      } catch {}
    }
    try {
      const raw = JSON.parse(localStorage.getItem(LS_MOBILE_PUSH) || 'null')
      if (raw) return { ...this.defaults(), ...raw }
    } catch {}
    return this.defaults()
  },
  async save(cfg) {
    const value = { ...this.defaults(), ...cfg, updated_at: new Date().toISOString() }
    if (supabase) {
      try {
        const { error } = await supabase.from('settings').upsert({ key: 'mobile_push_settings', value }, { onConflict: 'key' })
        if (!error) return value
      } catch {}
    }
    try { localStorage.setItem(LS_MOBILE_PUSH, JSON.stringify(value)) } catch {}
    return value
  },
}

// ── Helpers ───────────────────────────────────────────────────
function _defaultPrefs(userId) {
  return {
    user_id: userId,
    in_app_enabled: true, whatsapp_enabled: false, sms_enabled: false,
    push_enabled: false, email_enabled: false,
    booking_notifications: true, trip_notifications: true,
    expense_notifications: true, payroll_notifications: true,
    vehicle_notifications: true, attendance_notifications: true,
    document_notifications: true, system_notifications: true,
    quiet_hours_enabled: false, quiet_hours_start: '22:00', quiet_hours_end: '07:00',
  }
}

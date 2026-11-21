// ─── Communication Service ───────────────────────────────────
// The service layer that pages and contexts call.
// Routes through CommunicationEngine → Adapters → Logs.
// Also provides backward-compatible in-app notification helpers.

import supabase from '../lib/supabase'
import { communicationEngine, CHANNELS, RECIPIENT_TYPE, sendCommunication } from '../communication/CommunicationEngine'
import { publish, EVENTS }       from '../communication/EventBus'
import { scheduler }             from '../communication/Scheduler'
import { whatsapp, WA_TEMPLATES } from '../communication/adapters/WhatsAppAdapter'
import {
  communicationLogRepository,
  notificationPreferenceRepository,
  providerRepository,
  mobilePushSettingsRepository,
  communicationQueueRepository,
} from '../repositories/communicationRepository'
import { loadDrivers } from '../data/driverData'

// ── Re-export core ────────────────────────────────────────────
export { CHANNELS, RECIPIENT_TYPE }
export { publish, EVENTS }
export { scheduler }
export { whatsapp, WA_TEMPLATES }

// ── WhatsApp deep-link helpers (no API required) ─────────────
export function openWhatsApp(phone, message) {
  return whatsapp.openChat(phone, message)
}

// ── Mobile app push ───────────────────────────────────────────
// Master switch + registered-device broadcast for the driver mobile app.
// Sends through the engine push channel to every driver with a registered
// FCM token. Results are truthful: unconfigured providers log as failed.
export async function getMobilePushSettings() {
  return mobilePushSettingsRepository.get()
}
export async function saveMobilePushSettings(cfg) {
  return mobilePushSettingsRepository.save(cfg)
}
export async function getPushableDrivers() {
  const all = await loadDrivers()
  const list = Array.isArray(all) ? all : []
  return list.filter(d => String(d.push_token || d.pushToken || '').trim() !== '')
}
export async function broadcastMobilePush({ title, body }) {
  const settings = await mobilePushSettingsRepository.get()
  if (!settings.enabled) return { ok: false, reason: 'disabled', sent: 0, failed: 0, total: 0 }
  const targets = await getPushableDrivers()
  if (targets.length === 0) return { ok: false, reason: 'no_tokens', sent: 0, failed: 0, total: 0 }
  const subject = title || 'Sri Jayam Travels'

  // Preferred path: send-push Edge Function (real FCM delivery).
  const edge = await _invokePushEdge(targets.map(d => d.push_token || d.pushToken), subject, body || '')
  if (edge && !edge.error && edge.error !== 'not_configured') {
    const byToken = new Map((edge.results || []).map(r => [r.token, r]))
    let sent = 0, failed = 0
    for (const d of targets) {
      const r = byToken.get(d.push_token || d.pushToken)
      const ok = !!r?.ok
      if (ok) sent++
      else failed++
      try {
        await communicationLogRepository.create({
          channel: CHANNELS.PUSH,
          recipient_id: d.driver_id || d.id,
          recipient_type: RECIPIENT_TYPE.DRIVER,
          recipient_name: d.name || null,
          recipient_contact: d.phone || null,
          category: 'driver',
          event_type: 'MOBILE_ANNOUNCEMENT',
          subject,
          body: body || '',
          status: ok ? 'delivered' : 'failed',
          sent_at: ok ? new Date().toISOString() : null,
          failure_reason: ok ? null : (r?.error || 'Edge send failed'),
          related_entity_type: 'driver',
          related_entity_id: d.driver_id || d.id,
          metadata: { via: 'edge', messageId: r?.messageId || null },
        })
      } catch {}
    }
    return { ok: true, reason: null, via: 'edge', sent, failed, total: targets.length }
  }

  // Fallback path: engine push channel per token (honest logging —
  // unconfigured providers record as failed, never fake-delivered).
  let sent = 0, failed = 0
  for (const d of targets) {
    try {
      const results = await sendCommunication({
        eventType: 'MOBILE_ANNOUNCEMENT',
        channels: [CHANNELS.PUSH],
        recipient: {
          id: d.driver_id || d.id, type: RECIPIENT_TYPE.DRIVER,
          name: d.name, contact: d.phone,
          pushToken: d.push_token || d.pushToken,
        },
        subject,
        body: body || '',
        relatedEntity: { type: 'driver', id: d.driver_id || d.id },
      })
      const ok = (Array.isArray(results) ? results : []).some(r => !['failed', 'not_configured', 'skipped'].includes(r?.status))
      if (ok) sent++
      else failed++
    } catch {
      failed++
    }
  }
  return { ok: true, reason: edge?.error === 'not_configured' ? 'sender_not_configured' : null, via: 'engine', sent, failed, total: targets.length }
}

async function _invokePushEdge(tokens, title, body) {
  try {
    if (!supabase) return null
    const { data, error } = await supabase.functions.invoke('send-push', { body: { tokens, title, body } })
    if (error) return null
    return data
  } catch {
    return null
  }
}

// ── User preferences ──────────────────────────────────────────
export async function getNotificationPreferences(userId) {
  return notificationPreferenceRepository.get(userId)
}

export async function saveNotificationPreferences(userId, prefs) {
  await communicationEngine.savePreferences(userId, prefs)
  return notificationPreferenceRepository.upsert(userId, prefs)
}


// ── Engine stats ──────────────────────────────────────────────
export function getEngineStats() {
  return {
    engine:  communicationEngine.getStats(),
    adapters: {
      whatsapp: whatsapp.providerInfo(),
    },
  }
}

// ── Scheduled notifications ───────────────────────────────────
export function scheduleTripReminder(bookingId, startDate, payload) {
  scheduler.scheduleTripReminder(bookingId, startDate, payload)
}

export function getScheduledJobs() {
  return scheduler.getJobs()
}


// ── Queue management ─────────────────────────────────────────
export async function cancelStalePendingQueue() {
  return communicationQueueRepository.cancelStalePending()
}

/** Permanently remove a communication log row. */
export async function deleteCommunication(id) {
  return communicationLogRepository.remove(id)
}

// ── Provider Management ───────────────────────────────────────
export async function getProviders() {
  return providerRepository.getAll()
}

/**
 * Update a provider configuration
 * @param {string} providerId - Provider ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated provider
 */
export async function updateProvider(providerId, updates) {
  return providerRepository.update(providerId, updates)
}

/**
 * Create a new provider configuration
 * @param {Object} provider - Provider configuration
 * @returns {Promise<Object>} Created provider
 */
export async function createProvider(provider) {
  return providerRepository.create(provider)
}

// ── Communication Logs Enhancement ────────────────────────────
/**
 * Get communication logs with enhanced filtering
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Logs with pagination info
 */
export async function getCommunicationLogs(filters = {}) {
  return communicationLogRepository.getAll(filters)
}

/**
 * Get communication statistics
 * @returns {Promise<Array>} Statistics by channel
 */
export async function getCommunicationStats() {
  return communicationLogRepository.getStats()
}

// ── WhatsApp bot handoff ────────────────────────────────────
// Both actions go through the Vercel function (api/whatsapp/send), which
// checks the signed-in user is staff. The Supabase session token — not the
// anon key — is what proves that.
async function postInboxAction(action, phone) {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw new Error(error.message)
  const token = data?.session?.access_token
  if (!token) throw new Error('Your session has expired. Sign in again and retry.')

  const res = await fetch('/api/whatsapp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, phone }),
  })
  const result = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(result.error || `WhatsApp action failed (${res.status})`)
  return result
}

// Staff can resume a paused bot so it starts answering again immediately.
export async function resumeBot(phone) {
  return postInboxAction('resume_bot', phone)
}

// Staff are answering from their own WhatsApp: keep the bot quiet for 6 h.
export async function pauseBot(phone) {
  return postInboxAction('pause_bot', phone)
}

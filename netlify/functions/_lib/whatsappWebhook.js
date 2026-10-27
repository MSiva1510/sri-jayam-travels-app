// ─── WhatsApp Cloud API webhook helpers ────────────────────────────────
// Pure functions used by netlify/functions/whatsapp-webhook.js:
//   • the one-time GET verification Meta performs when you save the
//     callback URL (hub.mode / hub.verify_token / hub.challenge),
//   • X-Hub-Signature-256 checking, so only Meta can post events,
//   • turning Meta's nested payload into flat status / message records.
// Nothing here talks to the network or reads process.env.

import crypto from 'node:crypto'

/**
 * Meta's subscription check. Returns the challenge to echo back, or null.
 * @param {Record<string, string> | null | undefined} query
 * @param {string | undefined} verifyToken  WHATSAPP_VERIFY_TOKEN
 */
export function verifyChallenge(query, verifyToken) {
  if (!verifyToken || !query) return null
  const mode = query['hub.mode']
  const token = query['hub.verify_token']
  const challenge = query['hub.challenge']
  if (mode !== 'subscribe' || typeof challenge !== 'string' || !challenge) return null
  return safeEqual(String(token ?? ''), verifyToken) ? challenge : null
}

/**
 * Checks `X-Hub-Signature-256: sha256=<hex>` against an HMAC of the exact raw
 * body bytes, keyed with the Meta App Secret.
 * @param {string | Buffer} rawBody
 * @param {string | undefined} signatureHeader
 * @param {string | undefined} appSecret  WHATSAPP_APP_SECRET
 */
export function verifySignature(rawBody, signatureHeader, appSecret) {
  if (!appSecret || !signatureHeader) return false
  const match = /^sha256=([0-9a-f]{64})$/i.exec(String(signatureHeader).trim())
  if (!match) return false
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')
  return safeEqual(match[1].toLowerCase(), expected)
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb)
}

const STATUS_VALUES = new Set(['sent', 'delivered', 'read', 'failed'])

function toIso(unixSeconds) {
  const n = Number(unixSeconds)
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : new Date().toISOString()
}

function textOf(message) {
  switch (message.type) {
    case 'text':        return message.text?.body ?? null
    case 'button':      return message.button?.text ?? null
    case 'interactive': return message.interactive?.button_reply?.title
                            ?? message.interactive?.list_reply?.title ?? null
    case 'image':
    case 'video':
    case 'document':    return message[message.type]?.caption ?? null
    case 'location': {
      const l = message.location || {}
      return [l.name, l.address, l.latitude != null ? `${l.latitude},${l.longitude}` : null]
        .filter(Boolean).join(' · ') || null
    }
    default:            return null
  }
}

/**
 * Flattens a `whatsapp_business_account` webhook payload.
 * Unknown objects/fields are ignored rather than rejected.
 * @returns {{ statuses: Array<{wamid, status, at, recipient, error}>,
 *             messages: Array<{wamid, from, contactName, phoneNumberId, type, text, at, raw}> }}
 */
export function parseWebhook(payload) {
  const statuses = []
  const messages = []
  if (!payload || payload.object !== 'whatsapp_business_account') return { statuses, messages }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue
      const value = change.value ?? {}
      const phoneNumberId = value.metadata?.phone_number_id ?? null
      const names = new Map((value.contacts ?? []).map(c => [c.wa_id, c.profile?.name ?? null]))

      for (const s of value.statuses ?? []) {
        if (!s?.id || !STATUS_VALUES.has(s.status)) continue
        const err = s.errors?.[0]
        statuses.push({
          wamid: s.id,
          status: s.status,
          at: toIso(s.timestamp),
          recipient: s.recipient_id ?? null,
          error: err ? [err.code, err.title, err.error_data?.details].filter(Boolean).join(' · ') : null,
        })
      }

      for (const m of value.messages ?? []) {
        if (!m?.id || !m.from) continue
        messages.push({
          wamid: m.id,
          from: m.from,
          contactName: names.get(m.from) ?? null,
          phoneNumberId,
          type: m.type ?? 'unknown',
          text: textOf(m),
          at: toIso(m.timestamp),
          raw: m,
        })
      }
    }
  }
  return { statuses, messages }
}

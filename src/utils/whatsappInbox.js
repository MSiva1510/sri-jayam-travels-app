// ─── WhatsApp inbox helpers ───────────────────────────────────
// Pure functions used by pages/WhatsApp.jsx (tested in
// tests/whatsappInbox.test.mjs). No React, no Supabase.

export const REPLY_WINDOW_MS = 24 * 3_600_000

const toMs = (value) => {
  if (!value) return NaN
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : NaN
}

/** '917305581235' → '+91 73055 81235'. Other shapes get a leading + only. */
export function formatPhone(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`
  }
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
  return `+${digits}`
}

/** Contact name if present, else the formatted phone. */
export function displayName(conv) {
  const name = String(conv?.contact_name ?? '').trim()
  return name || formatPhone(conv?.phone)
}

/** True while the customer wrote within the last 24 h (free text allowed). */
export function isWithinReplyWindow(lastInboundAt, now = Date.now()) {
  const last = toMs(lastInboundAt)
  return Number.isFinite(last) && now - last < REPLY_WINDOW_MS
}

/** True when bot_paused_until is in the future. */
export function isBotPaused(botPausedUntil, now = Date.now()) {
  const until = toMs(botPausedUntil)
  return Number.isFinite(until) && until > now
}

/** Text to show for an inbound row: text_body, or "[image]" etc. for media. */
export function inboundText(row) {
  const body = row?.text_body
  if (body != null && String(body).trim() !== '') return String(body)
  return `[${row?.message_type || 'message'}]`
}

/** Who sent an outbound row: "Bot", "Staff" or "Trip message". */
export function senderLabel(kind) {
  const k = String(kind ?? '')
  if (k === 'bot') return 'Bot'
  if (k === 'staff') return 'Staff'
  // customer_confirmed / customer_completed / customer_driver:<id> / driver_trip:<id>
  return k ? 'Trip message' : ''
}

const STATUS_LABELS = {
  queued: 'Queued',
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
  failed: 'Failed',
}

/** Human label for an outbound status. Unknown values are capitalised. */
export function statusLabel(status) {
  const s = String(status ?? '').toLowerCase()
  if (STATUS_LABELS[s]) return STATUS_LABELS[s]
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Queued'
}

/**
 * Merge inbound + outbound rows into one thread, oldest first.
 * Each item: { key, direction: 'in'|'out', at, text, row }.
 * Rows with the same key (realtime re-delivery) are de-duplicated,
 * the later copy wins (so status updates replace the old row).
 */
export function mergeThread(inbound = [], outbound = []) {
  const byKey = new Map()
  for (const row of inbound || []) {
    if (!row) continue
    const key = `in:${row.id ?? row.wamid}`
    byKey.set(key, { key, direction: 'in', at: row.received_at, text: inboundText(row), row })
  }
  for (const row of outbound || []) {
    if (!row) continue
    const key = `out:${row.id ?? row.wamid}`
    let text = row.body
    if (text == null || String(text).trim() === '') {
      text = row.template_name ? `Template: ${row.template_name}` : ''
    }
    byKey.set(key, { key, direction: 'out', at: row.created_at, text: String(text), row })
  }
  return [...byKey.values()].sort((a, b) => {
    const ta = toMs(a.at)
    const tb = toMs(b.at)
    const da = Number.isFinite(ta) ? ta : 0
    const db = Number.isFinite(tb) ? tb : 0
    if (da !== db) return da - db
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0
  })
}

/** Insert or replace a row by id; returns a new array. */
export function upsertById(rows = [], row) {
  if (!row) return rows
  const i = rows.findIndex(r => r.id === row.id)
  if (i === -1) return [...rows, row]
  const next = rows.slice()
  next[i] = { ...rows[i], ...row }
  return next
}

/** Conversations newest last_message_at first (nulls last). */
export function sortConversations(list = []) {
  return [...list].sort((a, b) => {
    const ta = toMs(a?.last_message_at)
    const tb = toMs(b?.last_message_at)
    const da = Number.isFinite(ta) ? ta : -Infinity
    const db = Number.isFinite(tb) ? tb : -Infinity
    return db - da
  })
}

/** Filter by chip ('all' | 'needs_staff' | 'unread') and a name/phone search. */
export function filterConversations(list = [], { filter = 'all', query = '' } = {}) {
  const q = String(query).trim().toLowerCase()
  const qDigits = q.replace(/\D/g, '')
  return list.filter(c => {
    if (filter === 'needs_staff' && !c.needs_staff) return false
    if (filter === 'unread' && !(Number(c.unread) > 0)) return false
    if (!q) return true
    const name = String(c.contact_name ?? '').toLowerCase()
    if (name.includes(q)) return true
    return qDigits.length > 0 && String(c.phone ?? '').includes(qDigits)
  })
}

/** Short time for list rows / bubbles: today → "14:05", else "12 Oct". */
export function shortTime(value, now = Date.now()) {
  const ms = toMs(value)
  if (!Number.isFinite(ms)) return ''
  const d = new Date(ms)
  const today = new Date(now)
  const sameDay = d.getFullYear() === today.getFullYear()
    && d.getMonth() === today.getMonth()
    && d.getDate() === today.getDate()
  if (sameDay) {
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/**
 * Latest message per phone from recent inbound + outbound rows, for the
 * list preview: { [phone]: { text, at, direction } }.
 */
export function latestByPhone(inbound = [], outbound = [], into = {}) {
  const map = { ...into }
  const consider = (phone, at, text, direction) => {
    if (!phone) return
    const ms = toMs(at)
    const prev = map[phone]
    if (prev && !(ms > toMs(prev.at))) return
    map[phone] = { text, at, direction }
  }
  for (const row of inbound || []) {
    if (row) consider(row.from_phone, row.received_at, inboundText(row), 'in')
  }
  for (const row of outbound || []) {
    if (!row) continue
    const body = row.body != null && String(row.body).trim() !== ''
      ? String(row.body)
      : row.template_name ? `Template: ${row.template_name}` : ''
    consider(row.to_phone, row.created_at, body, 'out')
  }
  return map
}

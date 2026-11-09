// ─── Inbox actions for staff (web + manager app) ────────────────────────
// POST /api/whatsapp/send   Authorization: Bearer <Supabase session token>
//   { "action": "reply",      "phone": "9173…", "text": "…" }
//   { "action": "resume_bot", "phone": "9173…" }
//
// reply: free text to the customer. WhatsApp allows it only within 24 h
// of the customer's last message (else 409 — use a template). Pauses the
// bot for BOT_PAUSE_HOURS so it does not talk over staff.
// resume_bot: hands the chat back to the bot now.
// Staff only (admin / manager), same check as the GPS proxy.

import { supabaseAdmin } from './_lib/supabaseAdmin.js'
import { waMessage, waPhone, whatsappConfig } from './_lib/whatsappApi.js'
import { BOT_PAUSE_HOURS, sendAndRecord } from './_lib/whatsappService.js'
import { extractBearer, verifySupabaseStaff } from './_lib/verifySupabaseUser.js'

export const REPLY_WINDOW_MS = 24 * 3_600_000

function reply(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  }
}

export async function handler(event, _context, env = process.env, fetchImpl = fetch, now = Date.now()) {
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' })

  const staff = await verifySupabaseStaff(extractBearer(event.headers), env)
  if (!staff.ok) return reply(staff.status, { error: staff.error })

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return reply(400, { error: 'Invalid JSON' })
  }
  const phone = waPhone(body.phone)
  if (!phone) return reply(400, { error: 'A valid phone number is required' })

  const db = supabaseAdmin(env, fetchImpl)
  if (!db) return reply(500, { error: 'WhatsApp is not configured' })
  const path = `whatsapp_conversations?phone=eq.${phone}`

  if (body.action === 'resume_bot') {
    await db.update(path, { bot_paused_until: null, needs_staff: false, state: null, data: {} })
    return reply(200, { ok: true })
  }

  if (body.action !== 'reply') return reply(400, { error: 'Unknown action' })
  const text = String(body.text ?? '').trim()
  if (!text) return reply(400, { error: 'Message is empty' })
  if (text.length > 4096) return reply(400, { error: 'Message is too long (4096 characters max)' })

  const config = whatsappConfig(env)
  if (!config) return reply(500, { error: 'WhatsApp is not configured' })

  const [conv] = await db.select(`${path}&select=last_inbound_at`) ?? []
  const last = conv?.last_inbound_at ? Date.parse(conv.last_inbound_at) : NaN
  if (!(now - last < REPLY_WINDOW_MS)) {
    return reply(409, {
      error: 'The customer has not written in the last 24 hours. WhatsApp only allows approved template messages now.',
    })
  }

  const row = await sendAndRecord(db, config, {
    to: phone,
    msg: waMessage.text(phone, text),
    kind: 'staff',
    sentBy: staff.user.id,
  })
  await db.update(path, {
    bot_paused_until: new Date(now + BOT_PAUSE_HOURS * 3_600_000).toISOString(),
    needs_staff: false,
    unread: 0,
    state: null,
    data: {},
  })
  return row.status === 'sent'
    ? reply(200, { ok: true, message: row })
    : reply(502, { error: row.error || 'WhatsApp did not accept the message', message: row })
}

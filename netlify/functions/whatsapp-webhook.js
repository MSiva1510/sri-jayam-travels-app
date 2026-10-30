// ─── WhatsApp Cloud API webhook (Meta → Sri Jayam) ─────────────────────
// Callback URL: https://<site>/api/whatsapp/webhook  (see netlify.toml)
//
//   GET  — Meta's one-time verification: echoes hub.challenge when
//          hub.verify_token matches WHATSAPP_VERIFY_TOKEN.
//   POST — delivery receipts (sent / delivered / read / failed) and incoming
//          customer messages. Rejected with 401 unless X-Hub-Signature-256
//          matches WHATSAPP_APP_SECRET. Receipts update communication_logs
//          and whatsapp_outbound_messages (matched on the wamid) through the
//          whatsapp_apply_status RPC; messages land in
//          whatsapp_inbound_messages. Both writes are idempotent, so Meta's
//          retries are safe. Each NEW message then goes to the auto-reply
//          bot (whatsappService.handleInbound); a bot failure is logged but
//          still answers 200, so Meta does not resend and double-reply.
//
// Server-only env (Netlify → Site configuration → Environment variables):
//   WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET,
//   SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY,
//   WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID (bot replies; without them
//   messages are stored but not answered)

import { verifyChallenge, verifySignature, parseWebhook } from './_lib/whatsappWebhook.js'
import { supabaseAdmin } from './_lib/supabaseAdmin.js'
import { whatsappConfig } from './_lib/whatsappApi.js'
import { handleInbound } from './_lib/whatsappService.js'

const MAX_BODY_BYTES = 1024 * 1024

function reply(statusCode, body, contentType = 'application/json') {
  return {
    statusCode,
    headers: { 'Content-Type': contentType, 'Cache-Control': 'no-store' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }
}

function header(headers = {}, name) {
  const wanted = name.toLowerCase()
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return value
  }
  return undefined
}

/** Stores receipts + messages; returns the messages that were not stored before. */
async function store(db, { statuses, messages }) {
  for (const s of statuses) {
    await db.rpc('whatsapp_apply_status', { p_wamid: s.wamid, p_status: s.status, p_at: s.at, p_error: s.error })
    await db.rpc('whatsapp_apply_outbound_status', { p_wamid: s.wamid, p_status: s.status, p_error: s.error })
  }
  if (!messages.length) return []
  const inserted = await db.insert(
    'whatsapp_inbound_messages',
    messages.map(m => ({
      wamid: m.wamid,
      from_phone: m.from,
      contact_name: m.contactName,
      phone_number_id: m.phoneNumberId,
      message_type: m.type,
      text_body: m.text,
      received_at: m.at,
      payload: m.raw,
    })),
    { prefer: 'resolution=ignore-duplicates,return=representation', onConflict: 'wamid' },
  )
  const fresh = new Set((inserted ?? []).map(r => r.wamid))
  return messages.filter(m => fresh.has(m.wamid))
}

export async function handler(event, _context, env = process.env, fetchImpl = fetch) {
  const method = event.httpMethod

  if (method === 'GET') {
    const challenge = verifyChallenge(event.queryStringParameters, env.WHATSAPP_VERIFY_TOKEN)
    return challenge !== null
      ? reply(200, challenge, 'text/plain')
      : reply(403, { error: 'Verification failed' })
  }

  if (method !== 'POST') return reply(405, { error: 'Method not allowed' })

  if (!env.WHATSAPP_APP_SECRET) {
    console.error('[whatsapp-webhook] WHATSAPP_APP_SECRET is not set')
    return reply(500, { error: 'Webhook is not configured' })
  }

  const raw = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64')
    : Buffer.from(event.body || '', 'utf8')
  if (raw.length > MAX_BODY_BYTES) return reply(413, { error: 'Payload too large' })

  if (!verifySignature(raw, header(event.headers, 'x-hub-signature-256'), env.WHATSAPP_APP_SECRET)) {
    return reply(401, { error: 'Invalid signature' })
  }

  let payload
  try {
    payload = JSON.parse(raw.toString('utf8'))
  } catch {
    return reply(400, { error: 'Invalid JSON' })
  }

  const parsed = parseWebhook(payload)
  if (!parsed.statuses.length && !parsed.messages.length) return reply(200, { ok: true, stored: 0 })

  const db = supabaseAdmin(env, fetchImpl)
  if (!db) {
    console.error('[whatsapp-webhook] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set')
    return reply(500, { error: 'Webhook is not configured' })
  }

  let fresh
  try {
    fresh = await store(db, parsed)
  } catch (error) {
    // Non-200 makes Meta retry; both writes are idempotent.
    console.error('[whatsapp-webhook] store failed:', error.message)
    return reply(500, { error: 'Could not store event' })
  }

  const config = whatsappConfig(env)
  let replied = 0
  for (const m of fresh) {
    try {
      replied += (await handleInbound(db, config, m)).replied
    } catch (error) {
      console.error('[whatsapp-webhook] bot failed:', error.message)
    }
  }

  return reply(200, { ok: true, stored: parsed.statuses.length + parsed.messages.length, replied })
}

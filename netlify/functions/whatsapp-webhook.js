// ─── WhatsApp Cloud API webhook (Meta → Sri Jayam) ─────────────────────
// Callback URL: https://<site>/api/whatsapp/webhook  (see netlify.toml)
//
//   GET  — Meta's one-time verification: echoes hub.challenge when
//          hub.verify_token matches WHATSAPP_VERIFY_TOKEN.
//   POST — delivery receipts (sent / delivered / read / failed) and incoming
//          customer messages. Rejected with 401 unless X-Hub-Signature-256
//          matches WHATSAPP_APP_SECRET. Receipts update communication_logs
//          (matched on provider_message_id) through the whatsapp_apply_status
//          RPC; messages land in whatsapp_inbound_messages. Both writes are
//          idempotent, so Meta's retries are safe.
//
// Server-only env (Netlify → Site configuration → Environment variables):
//   WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET,
//   SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY

import { verifyChallenge, verifySignature, parseWebhook } from './_lib/whatsappWebhook.js'

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

function supabaseAdmin(env) {
  const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  return url && key ? { url, key } : null
}

async function rest(db, path, init) {
  const res = await fetch(`${db.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: db.key,
      Authorization: `Bearer ${db.key}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`${init.method} ${path} → ${res.status} ${detail.slice(0, 200)}`)
  }
}

async function store(db, { statuses, messages }) {
  for (const s of statuses) {
    await rest(db, 'rpc/whatsapp_apply_status', {
      method: 'POST',
      body: JSON.stringify({ p_wamid: s.wamid, p_status: s.status, p_at: s.at, p_error: s.error }),
    })
  }
  if (messages.length) {
    await rest(db, 'whatsapp_inbound_messages?on_conflict=wamid', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify(messages.map(m => ({
        wamid: m.wamid,
        from_phone: m.from,
        contact_name: m.contactName,
        phone_number_id: m.phoneNumberId,
        message_type: m.type,
        text_body: m.text,
        received_at: m.at,
        payload: m.raw,
      }))),
    })
  }
}

export async function handler(event, _context, env = process.env) {
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

  const db = supabaseAdmin(env)
  if (!db) {
    console.error('[whatsapp-webhook] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set')
    return reply(500, { error: 'Webhook is not configured' })
  }

  try {
    await store(db, parsed)
  } catch (error) {
    // Non-200 makes Meta retry; both writes are idempotent.
    console.error('[whatsapp-webhook] store failed:', error.message)
    return reply(500, { error: 'Could not store event' })
  }

  return reply(200, { ok: true, stored: parsed.statuses.length + parsed.messages.length })
}

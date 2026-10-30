// ─── Trip messages on booking changes ────────────────────────────────────
// POST /api/whatsapp/notify  { "booking_id": "<uuid>" }
//
// Called by the database trigger on public.bookings (pg_net, every status /
// driver / vehicle change from the web, the manager app or the driver app)
// with the X-Sjt-Notify-Secret header, or by a staff session (Bearer
// token) to resend. Works out from the booking itself which templates are
// due and sends only those not sent yet — safe to call any number of times.
//
// Server-only env: WHATSAPP_NOTIFY_SECRET (same value as the Supabase Vault
// secret 'whatsapp_notify_secret'), WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY (staff check).

import { timingSafeEqual } from 'node:crypto'
import { supabaseAdmin } from './_lib/supabaseAdmin.js'
import { whatsappConfig } from './_lib/whatsappApi.js'
import { notifyBooking } from './_lib/whatsappService.js'
import { extractBearer, verifySupabaseStaff } from './_lib/verifySupabaseUser.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function reply(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  }
}

function header(headers = {}, name) {
  const wanted = name.toLowerCase()
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return value
  }
  return undefined
}

export function secretMatches(given, expected) {
  if (!given || !expected) return false
  const a = Buffer.from(String(given))
  const b = Buffer.from(String(expected))
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function handler(event, _context, env = process.env, fetchImpl = fetch) {
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' })

  if (!secretMatches(header(event.headers, 'x-sjt-notify-secret'), env.WHATSAPP_NOTIFY_SECRET)) {
    const staff = await verifySupabaseStaff(extractBearer(event.headers), env)
    if (!staff.ok) return reply(staff.status, { error: staff.error })
  }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return reply(400, { error: 'Invalid JSON' })
  }
  const bookingId = body.booking_id
  if (!UUID_RE.test(String(bookingId ?? ''))) return reply(400, { error: 'booking_id is required' })

  const db = supabaseAdmin(env, fetchImpl)
  const config = whatsappConfig(env)
  if (!db || !config) {
    console.error('[whatsapp-notify] missing SUPABASE_* or WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID')
    return reply(500, { error: 'WhatsApp is not configured' })
  }

  try {
    return reply(200, { ok: true, ...(await notifyBooking(db, config, bookingId)) })
  } catch (error) {
    console.error('[whatsapp-notify] failed:', error.message)
    return reply(500, { error: 'Could not send trip messages' })
  }
}

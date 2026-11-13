// ─── WhatsApp flows that touch Meta and the database ────────────────────
// Used by whatsapp-webhook (bot replies), whatsapp-notify (trip messages)
// and whatsapp-send (staff replies from the inbox). Every message we send
// is recorded in whatsapp_outbound_messages, so the inbox shows both sides
// and Meta's delivery receipts can update it.

import { localPhone, messagePreview, sendWhatsApp, waMessage } from './whatsappApi.js'
import { botStep, bookedReply, nextBookingNumber, statusReply } from './whatsappBot.js'
import { dueMessages } from './whatsappTrip.js'

export const STAFF_PAUSE_HOURS = 6
/** A failed booking only pauses the bot briefly so the customer can retry. */
export const BOOKING_FAILURE_PAUSE_MS = 5 * 60_000

/** Today's date in India, 'YYYY-MM-DD'. */
export function todayIST(now = Date.now()) {
  return new Date(now + 5.5 * 3_600_000).toISOString().slice(0, 10)
}

const enc = encodeURIComponent

function toGraph(to, reply) {
  if (reply.kind === 'buttons') return waMessage.buttons(to, reply.body, reply.buttons)
  if (reply.kind === 'location') return waMessage.locationRequest(to, reply.body)
  return waMessage.text(to, reply.body)
}

/**
 * Sends one message and records it. Never throws for a WhatsApp error: the
 * row is stored as failed with Meta's reason (shown in the inbox).
 */
export async function sendAndRecord(db, config, { to, msg, kind, bookingId = null, sentBy = null, rowId = null }) {
  const base = {
    to_phone: to,
    kind,
    body: messagePreview(msg),
    template_name: msg.type === 'template' ? msg.template.name : null,
    booking_id: bookingId,
    sent_by: sentBy,
  }
  let wamid = null
  let error = null
  try {
    wamid = await sendWhatsApp(config, msg)
  } catch (e) {
    error = String(e.message || e).slice(0, 500)
  }
  const result = { ...base, wamid, status: wamid ? 'sent' : 'failed', error }
  const [row] = rowId
    ? await db.update(`whatsapp_outbound_messages?id=eq.${enc(rowId)}`, result)
    : await db.insert('whatsapp_outbound_messages', [result])
  await db.rpc('whatsapp_touch_conversation', { p_phone: to, p_direction: 'out' })
  return row ?? result
}

// ── Inbound → bot ───────────────────────────────────────────────────────────

async function createBotBooking(db, phone, contactName, data) {
  const local = localPhone(phone)
  let customerId = null
  let customer = null
  try {
    const found = await db.select(
      `customers?select=id,name,is_vip,is_frequent_traveller&or=(phone.eq.${local},mobile.eq.${local},primary_mobile.eq.${local})&limit=1`,
    )
    customerId = found?.[0]?.id ?? null
    customer = found?.[0] ?? null
    if (found?.[0]?.name) contactName = found[0].name
  } catch {
    // Older customers table without these columns: book without the link.
  }

  // nextBookingNumber keeps only the trip's own FY prefix.
  const existing = await db.select('bookings?select=booking_number&booking_number=like.FY*')
  const numbers = (existing ?? []).map(r => r.booking_number)

  for (let bump = 0; bump < 5; bump++) {
    const bookingNumber = nextBookingNumber(data.date, numbers, bump)
    const type = ['one_way', 'round_trip', 'self_drive'].includes(data.type) ? data.type : 'one_way'
    try {
      const [row] = await db.insert('bookings', [{
        booking_number: bookingNumber,
        type,
        status: 'pending',
        customer_name: contactName || 'WhatsApp customer',
        customer_contact: local,
        customer_id: customerId,
        pickup_location: data.pickup,
        drop_location: data.drop,
        start_date: data.date,
        start_time: data.time,
        end_date: data.return_date ?? null,
        notes: 'Booked on WhatsApp',
        type_data: {
          lead_source: 'WhatsApp',
          source: 'whatsapp_bot',
          ...(data.idType ? { idType: data.idType, idNum: data.idNum, dlNum: data.dlNum, dlExpiry: data.dlExpiry } : {}),
        },
      }])
      return { booking: row, customer }
    } catch (e) {
      if (e.status === 409 || /duplicate key|23505/.test(e.body ?? '')) continue
      throw e
    }
  }
  throw new Error('Could not pick a free booking number')
}

async function tripStatus(db, phone) {
  const local = localPhone(phone)
  // Look up the customer record so we can greet VIP / frequent travellers by name.
  let customer = null
  try {
    const found = await db.select(
      `customers?select=id,name,is_vip,is_frequent_traveller&or=(phone.eq.${local},mobile.eq.${local},primary_mobile.eq.${local})&limit=1`,
    )
    customer = found?.[0] ?? null
  } catch {
    // Older customers table without these columns: status without the link.
  }
  const bookings = await db.select(
    `bookings?select=booking_number,status,start_date,start_time,pickup_location,drop_location,driver_id,vehicle_reg` +
    `&customer_contact=like.*${local}&status=neq.draft&order=start_date.desc&limit=3`,
  ) ?? []
  const ids = [...new Set(bookings.map(b => b.driver_id).filter(Boolean))]
  const drivers = ids.length
    ? await db.select(`drivers?select=id,name,phone&id=in.(${ids.map(enc).join(',')})`) ?? []
    : []
  const reply = statusReply(bookings, Object.fromEntries(drivers.map(d => [d.id, d])))
  // Prepend a VIP / frequent recognition line when we know the customer.
  if (customer && bookings.length > 0) {
    const honor = customer.is_vip ? 'Valued VIP customer' : customer.is_frequent_traveller ? 'Frequent traveller' : null
    const prefix = honor ? `${honor} ${customer.name},\n\n` : ''
    return { kind: 'text', body: prefix + reply.body }
  }
  return reply
}

/**
 * One newly stored inbound message: update the conversation and, unless
 * staff took over, let the bot answer.
 */
export async function handleInbound(db, config, message, now = Date.now()) {
  const [conv] = await db.rpc('whatsapp_touch_conversation', {
    p_phone: message.from,
    p_direction: 'in',
    p_contact_name: message.contactName ?? null,
  })
  if (!config) return { replied: 0, reason: 'not configured' }
  const pauseEndsAt = Date.parse(conv?.bot_paused_until ?? '')
  if (pauseEndsAt > now) {
    return { replied: 0, reason: 'staff handling' }
  }

  if (conv?.needs_staff && Number.isFinite(pauseEndsAt)) {
    await db.update(`whatsapp_conversations?phone=eq.${enc(message.from)}`, {
      bot_paused_until: null,
      needs_staff: false,
    })
  }

  const step = botStep(conv, {
    text: message.text,
    replyId: message.replyId,
    contactName: conv?.contact_name ?? message.contactName,
  }, todayIST(now))

  const replies = [...step.replies]
  const patch = { state: step.state, data: step.data }
  if (!conv?.welcome_checked_at) patch.welcome_checked_at = new Date(now).toISOString()

  if (step.action?.type === 'create_booking') {
    try {
      const { booking, customer } = await createBotBooking(db, message.from, conv?.contact_name ?? message.contactName, step.action.booking)
      replies.push(bookedReply(booking.booking_number, step.action.booking, customer))
    } catch (e) {
      console.error('[whatsapp-bot] booking failed:', e.message)
      replies.push({ kind: 'text', body: 'Sorry, we could not save the booking. Please try again in 5 minutes, or our team will contact you here.' })
      patch.bot_paused_until = new Date(now + BOOKING_FAILURE_PAUSE_MS).toISOString()
    }
  } else if (step.action?.type === 'trip_status') {
    replies.push(await tripStatus(db, message.from))
  } else if (step.action?.type === 'handoff') {
    patch.bot_paused_until = new Date(now + STAFF_PAUSE_HOURS * 3_600_000).toISOString()
    patch.needs_staff = true
  }

  await db.update(`whatsapp_conversations?phone=eq.${enc(message.from)}`, patch)
  for (const r of replies) {
    await sendAndRecord(db, config, { to: message.from, msg: toGraph(message.from, r), kind: 'bot' })
  }
  return { replied: replies.length, action: step.action?.type ?? null }
}

// ── Booking change → trip templates ─────────────────────────────────────────

/** Claims (booking, kind) so parallel calls cannot both send; failed rows are retried. */
async function claim(db, bookingId, item) {
  const rows = await db.insert(
    'whatsapp_outbound_messages',
    [{ booking_id: bookingId, kind: item.kind, to_phone: item.to, status: 'queued', template_name: item.template }],
    { prefer: 'resolution=ignore-duplicates,return=representation', onConflict: 'booking_id,kind' },
  )
  if (rows?.length) return rows[0]
  const retried = await db.update(
    `whatsapp_outbound_messages?booking_id=eq.${enc(bookingId)}&kind=eq.${enc(item.kind)}&status=eq.failed`,
    { status: 'queued', error: null },
  )
  return retried?.[0] ?? null
}

export async function notifyBooking(db, config, bookingId, now = Date.now()) {
  const [booking] = await db.select(`bookings?id=eq.${enc(bookingId)}&select=*`) ?? []
  if (!booking) return { sent: 0, reason: 'booking not found' }
  let driver = null
  if (booking.driver_id) {
    [driver] = await db.select(`drivers?id=eq.${enc(booking.driver_id)}&select=id,name,phone`) ?? []
  }
  const due = dueMessages(booking, driver ?? null, todayIST(now))
  let sent = 0
  const failed = []
  for (const item of due) {
    const row = await claim(db, booking.id, item)
    if (!row) continue
    const result = await sendAndRecord(db, config, {
      to: item.to,
      msg: waMessage.template(item.to, item.template, item.params),
      kind: item.kind,
      bookingId: booking.id,
      rowId: row.id,
    })
    if (result.status === 'sent') sent++
    else failed.push({ kind: item.kind, error: result.error })
  }
  return { sent, failed, due: due.length }
}

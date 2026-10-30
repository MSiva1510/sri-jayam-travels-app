// WhatsApp bot, trip messages and inbox replies
// (netlify/functions/_lib/whatsapp{Bot,Trip,Api,Service}.js,
//  whatsapp-webhook.js / whatsapp-notify.js / whatsapp-send.js).
//
// The functions talk to Supabase REST and Meta's Graph API with fetch; the
// fake below plays both, keeping tables in memory, so the flows run end to
// end: message in → bot reply out, booking change → template once, staff
// reply only inside the 24 h window.
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

import { botStep, parseTripDate, parseTripTime, nextBookingNumber, statusReply } from '../netlify/functions/_lib/whatsappBot.js'
import { dueMessages, TEMPLATES } from '../netlify/functions/_lib/whatsappTrip.js'
import { waPhone, templateText, waMessage, messagePreview } from '../netlify/functions/_lib/whatsappApi.js'
import { todayIST } from '../netlify/functions/_lib/whatsappService.js'
import { handler as webhook } from '../netlify/functions/whatsapp-webhook.js'
import { handler as notify } from '../netlify/functions/whatsapp-notify.js'
import { handler as send } from '../netlify/functions/whatsapp-send.js'

const TODAY = '2026-10-30'
const PHONE = '917305581235'

// ── Pure: bot ─────────────────────────────────────────────────

test('dates and times the bot understands', () => {
  assert.equal(parseTripDate('today', TODAY), '2026-10-30')
  assert.equal(parseTripDate('Tomorrow', TODAY), '2026-10-31')
  assert.equal(parseTripDate('5/11', TODAY), '2026-11-05')
  assert.equal(parseTripDate('05-11-2026', TODAY), '2026-11-05')
  assert.equal(parseTripDate('3/1', TODAY), '2027-01-03') // next January
  assert.equal(parseTripDate('1/10/2026', TODAY), null) // past
  assert.equal(parseTripDate('31/2', TODAY), null)
  assert.equal(parseTripDate('next week', TODAY), null)
  assert.equal(parseTripTime('6:30 am'), '06:30')
  assert.equal(parseTripTime('6.30PM'), '18:30')
  assert.equal(parseTripTime('18:45'), '18:45')
  assert.equal(parseTripTime('12 am'), '00:00')
  assert.equal(parseTripTime('25:00'), undefined)
})

test('booking conversation: menu → pickup → drop → date → time → confirm', () => {
  let s = botStep(null, { text: 'Hi', contactName: 'Mani Kumar' }, TODAY)
  assert.equal(s.replies[0].kind, 'buttons')
  assert.match(s.replies[0].body, /Vanakkam Mani!/)
  assert.deepEqual(s.replies[0].buttons.map(b => b.id), ['book', 'status', 'staff'])

  s = botStep(s, { text: 'Book a trip', replyId: 'book' }, TODAY)
  assert.equal(s.state, 'book_pickup')
  s = botStep(s, { text: 'Ariyakuppam' }, TODAY)
  s = botStep(s, { text: 'Chennai airport' }, TODAY)
  assert.equal(s.state, 'book_date')
  const bad = botStep(s, { text: 'someday' }, TODAY)
  assert.equal(bad.state, 'book_date')
  assert.match(bad.replies[0].body, /could not read that date/)
  s = botStep(s, { text: 'tomorrow' }, TODAY)
  s = botStep(s, { text: '5:30 am' }, TODAY)
  assert.equal(s.state, 'book_confirm')
  assert.match(s.replies[0].body, /Pickup: Ariyakuppam\nDrop: Chennai airport\nDate: 31 Oct 2026\nTime: 05:30/)

  const done = botStep(s, { text: 'Confirm', replyId: 'confirm' }, TODAY)
  assert.equal(done.state, null)
  assert.deepEqual(done.action, {
    type: 'create_booking',
    booking: { pickup: 'Ariyakuppam', drop: 'Chennai airport', date: '2026-10-31', time: '05:30' },
  })
})

test('cancel, status, staff and unknown text', () => {
  const mid = { state: 'book_drop', data: { pickup: 'X' } }
  const c = botStep(mid, { text: 'cancel' }, TODAY)
  assert.equal(c.state, null)
  assert.match(c.replies[0].body, /^Cancelled\./)
  assert.equal(botStep(null, { text: '2' }, TODAY).action.type, 'trip_status')
  const staff = botStep(null, { text: 'x', replyId: 'staff' }, TODAY)
  assert.equal(staff.action.type, 'handoff')
  assert.equal(botStep(null, { text: 'what is the fare?' }, TODAY).replies[0].kind, 'buttons')
})

test('status reply lists the newest trips with driver and car', () => {
  const r = statusReply([
    { booking_number: 'FY26-OCT-0060', status: 'assigned', start_date: '2026-10-31', start_time: '05:30:00',
      pickup_location: 'A', drop_location: 'B', driver_id: 'd1', vehicle_reg: 'PY01VF1255' },
    { booking_number: 'FY26-OCT-0001', status: 'draft' },
  ], { d1: { name: 'Ramanan', phone: '+91 98765 43210' } })
  assert.equal(r.body,
    '*FY26-OCT-0060* — Driver assigned\n31 Oct 2026 05:30: A → B\nDriver: Ramanan (9876543210)\nCar: PY01VF1255' +
    '\n\nType menu for more options.')
  assert.equal(statusReply([]).kind, 'buttons')
})

test('booking numbers follow the apps (sequence across the FY)', () => {
  const existing = ['FY26-MAY-0023', 'FY26-JUL-0051', 'FY25-MAR-0400', 'BK-2610-1']
  assert.equal(nextBookingNumber('2026-10-31', existing), 'FY26-OCT-0052')
  assert.equal(nextBookingNumber('2026-10-31', existing, 2), 'FY26-OCT-0054')
  assert.equal(nextBookingNumber('2027-02-01', existing), 'FY26-FEB-0052')
  assert.equal(nextBookingNumber('2027-04-01', existing), 'FY27-APR-0001')
})

// ── Pure: trip messages ───────────────────────────────────────

const BOOKING = {
  id: '9b1c4e0a-0000-4000-8000-000000000001', booking_number: 'FY26-OCT-0052', status: 'approved',
  customer_name: 'Mani', customer_contact: '7305581235', pickup_location: 'Ariyakuppam',
  drop_location: 'Chennai', start_date: '2026-10-31', start_time: '05:30:00', total_km: 320, total_fare: 5400,
}
const DRIVER = { id: 'd1', name: 'Ramanan', phone: '9876543210' }

test('trip messages due for each stage', () => {
  assert.deepEqual(dueMessages(BOOKING, null, TODAY).map(m => m.kind), ['customer_confirmed'])
  const assigned = dueMessages({ ...BOOKING, status: 'assigned', vehicle_reg: 'PY01VF1255' }, DRIVER, TODAY)
  assert.deepEqual(assigned.map(m => [m.kind, m.to, m.template]), [
    ['customer_confirmed', PHONE, 'sjt_booking_confirmed'],
    ['customer_driver:d1', PHONE, 'sjt_driver_assigned'],
    ['driver_trip:d1', '919876543210', 'sjt_driver_new_trip'],
  ])
  assert.deepEqual(assigned[1].params, ['Mani', 'FY26-OCT-0052', '31 Oct 2026', 'Ramanan', '9876543210', 'PY01VF1255'])
  assert.deepEqual(assigned[2].params.slice(0, 3), ['FY26-OCT-0052', '31 Oct 2026', '05:30'])

  const done = dueMessages({ ...BOOKING, status: 'completed' }, DRIVER, '2026-11-02')
  assert.deepEqual(done.map(m => m.kind), ['customer_completed'])
  assert.deepEqual(done[0].params.slice(4), ['320', 'Rs. 5,400'])

  // Pending / cancelled, old trips and missing phones send nothing.
  assert.equal(dueMessages({ ...BOOKING, status: 'pending' }, DRIVER, TODAY).length, 0)
  assert.equal(dueMessages({ ...BOOKING, status: 'cancelled' }, DRIVER, TODAY).length, 0)
  assert.equal(dueMessages({ ...BOOKING, start_date: '2026-07-01' }, DRIVER, TODAY).length, 0)
  assert.equal(dueMessages({ ...BOOKING, status: 'completed', start_date: '2026-07-01' }, null, TODAY).length, 0)
  assert.equal(dueMessages({ ...BOOKING, customer_contact: '12' }, null, TODAY).length, 0)
})

test('every template has as many params as placeholders', () => {
  for (const [name, t] of Object.entries(TEMPLATES)) {
    const n = (t.body.match(/\{\{\d+\}\}/g) ?? []).length
    assert.equal(t.params.length, n, name)
    assert.equal(t.example.length, n, name)
  }
})

test('phones, template text and previews', () => {
  assert.equal(waPhone('+91 73055 81235'), PHONE)
  assert.equal(waPhone('07305581235'), PHONE)
  assert.equal(waPhone('7305581235'), PHONE)
  assert.equal(waPhone('12345'), null)
  assert.equal(templateText(' a\nb\t c '), 'a b c')
  assert.equal(templateText(''), '-')
  const b = waMessage.buttons(PHONE, 'Pick one', [{ id: 'a', title: 'A very long button title here' }])
  assert.equal(b.interactive.action.buttons[0].reply.title.length, 20)
  assert.equal(messagePreview(waMessage.template(PHONE, 'sjt_x', ['Mani', ''])), 'Template sjt_x: Mani · -')
  assert.equal(todayIST(Date.parse('2026-10-30T20:00:00Z')), '2026-10-31')
})

// ── End to end with a fake Supabase + Graph API ───────────────

const ENV = {
  WHATSAPP_VERIFY_TOKEN: 'v', WHATSAPP_APP_SECRET: 'app-secret',
  SUPABASE_URL: 'https://db.test', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service',
  WHATSAPP_TOKEN: 'wa-token', WHATSAPP_PHONE_NUMBER_ID: 'PNID', WHATSAPP_NOTIFY_SECRET: 'notify-secret',
}

const realFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = realFetch })

function fakeWorld({ staffRole = 'manager' } = {}) {
  const db = {
    inbound: [], outbound: [], conversations: new Map(), bookings: [{ ...BOOKING }],
    drivers: [{ ...DRIVER }], customers: [],
  }
  const sent = []
  let seq = 0
  const json = (body, status = 200) => new Response(body === undefined ? '' : JSON.stringify(body), { status })
  const q = url => Object.fromEntries(new URL(url).searchParams)
  const eq = v => decodeURIComponent(String(v ?? '').replace(/^eq\./, ''))

  globalThis.fetch = async (url, init = {}) => {
    url = String(url)
    const body = init.body ? JSON.parse(init.body) : undefined
    const method = init.method ?? 'GET'
    if (url.startsWith('https://graph.facebook.com/')) {
      sent.push(body)
      if (body.to === '910000000000') return json({ error: { message: 'Recipient not in allowed list', code: 131030 } }, 400)
      return json({ messages: [{ id: `wamid.OUT${++seq}` }] })
    }
    if (url === `${ENV.SUPABASE_URL}/auth/v1/user`) {
      return init.headers.Authorization === 'Bearer staff-jwt' ? json({ id: 'u1', email: 's@x' }) : json({}, 401)
    }
    const path = url.slice(`${ENV.SUPABASE_URL}/rest/v1/`.length).split('?')[0]
    const p = q(url)
    switch (`${method} ${path}`) {
      case 'GET profiles': return json([{ role: staffRole, status: 'active' }])
      case 'POST whatsapp_inbound_messages': {
        const fresh = body.filter(m => !db.inbound.some(x => x.wamid === m.wamid))
        db.inbound.push(...fresh)
        return json(fresh)
      }
      case 'POST rpc/whatsapp_apply_status': return json(0)
      case 'POST rpc/whatsapp_apply_outbound_status': {
        const row = db.outbound.find(m => m.wamid === body.p_wamid)
        if (row) row.status = body.p_status
        return json(row ? 1 : 0)
      }
      case 'POST rpc/whatsapp_touch_conversation': {
        const c = db.conversations.get(body.p_phone) ?? { phone: body.p_phone, state: null, data: {}, unread: 0 }
        if (body.p_direction === 'in') { c.unread++; c.last_inbound_at = new Date().toISOString() }
        c.contact_name = body.p_contact_name ?? c.contact_name
        db.conversations.set(body.p_phone, c)
        return json([c])
      }
      case 'PATCH whatsapp_conversations': {
        const c = db.conversations.get(eq(p.phone))
        if (c) Object.assign(c, body)
        return json(c ? [c] : [])
      }
      case 'GET whatsapp_conversations': {
        const c = db.conversations.get(eq(p.phone))
        return json(c ? [c] : [])
      }
      case 'POST whatsapp_outbound_messages': {
        const out = []
        for (const r of body) {
          if (r.booking_id && db.outbound.some(x => x.booking_id === r.booking_id && x.kind === r.kind)) continue
          const row = { id: `o${db.outbound.length + 1}`, ...r }
          db.outbound.push(row)
          out.push(row)
        }
        return json(out)
      }
      case 'PATCH whatsapp_outbound_messages': {
        const rows = db.outbound.filter(r =>
          (!p.id || r.id === eq(p.id)) && (!p.booking_id || r.booking_id === eq(p.booking_id)) &&
          (!p.kind || r.kind === eq(p.kind)) && (!p.status || r.status === eq(p.status)))
        rows.forEach(r => Object.assign(r, body))
        return json(rows)
      }
      case 'GET bookings':
        if (p.id) return json(db.bookings.filter(b => b.id === eq(p.id)))
        if (p.select === 'booking_number') return json(db.bookings.map(b => ({ booking_number: b.booking_number })))
        return json(db.bookings.filter(b => String(b.customer_contact).endsWith(p.customer_contact.slice(-10))))
      case 'POST bookings': {
        const row = { id: crypto.randomUUID(), ...body[0] }
        if (db.bookings.some(b => b.booking_number === row.booking_number)) {
          return new Response('{"code":"23505","message":"duplicate key"}', { status: 409 })
        }
        db.bookings.push(row)
        return json([row])
      }
      case 'GET drivers':
        return json(p.id?.startsWith('eq.')
          ? db.drivers.filter(d => d.id === eq(p.id))
          : db.drivers.filter(d => !p.id || p.id.includes(d.id)))
      case 'GET customers': return json(db.customers)
      default: throw new Error(`unexpected ${method} ${url}`)
    }
  }
  return { db, sent }
}

const sign = body => 'sha256=' + crypto.createHmac('sha256', ENV.WHATSAPP_APP_SECRET).update(body).digest('hex')
function incoming(text, { id = crypto.randomUUID(), replyId } = {}) {
  const message = replyId
    ? { from: PHONE, id, timestamp: '1793100000', type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: replyId, title: text } } }
    : { from: PHONE, id, timestamp: '1793100000', type: 'text', text: { body: text } }
  const body = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ field: 'messages', value: {
      metadata: { phone_number_id: 'PNID' },
      contacts: [{ wa_id: PHONE, profile: { name: 'Mani Kumar' } }],
      messages: [message],
    } }] }],
  })
  return { httpMethod: 'POST', headers: { 'x-hub-signature-256': sign(body) }, body }
}

test('webhook: a customer books a trip end to end, and a retried message is not answered twice', async () => {
  const { db, sent } = fakeWorld()
  const hi = incoming('Hi', { id: 'wamid.HI' })
  let res = await webhook(hi, {}, ENV)
  assert.deepEqual(JSON.parse(res.body), { ok: true, stored: 1, replied: 1 })
  assert.equal(sent[0].type, 'interactive')
  assert.equal(sent[0].to, PHONE)
  res = await webhook(hi, {}, ENV) // Meta retry
  assert.equal(JSON.parse(res.body).replied, 0)

  for (const [text, replyId] of [['Book a trip', 'book'], ['Ariyakuppam'], ['Chennai'], ['5/11'], ['skip'], ['Confirm', 'confirm']]) {
    await webhook(incoming(text, { replyId }), {}, ENV)
  }
  const booking = db.bookings.at(-1)
  assert.equal(booking.status, 'pending')
  assert.equal(booking.booking_number, 'FY26-NOV-0053')
  assert.deepEqual([booking.customer_name, booking.customer_contact, booking.start_date, booking.start_time],
    ['Mani Kumar', '7305581235', '2026-11-05', null])
  assert.match(sent.at(-1).text.body, /Your request FY26-NOV-0053 is booked/)
  assert.equal(db.outbound.filter(m => m.kind === 'bot').length, sent.length)
  assert.equal(db.conversations.get(PHONE).state, null)
})

test('webhook: "Talk to staff" pauses the bot until staff hand it back', async () => {
  const { db, sent } = fakeWorld()
  await webhook(incoming('Talk to staff', { replyId: 'staff' }), {}, ENV)
  const conv = db.conversations.get(PHONE)
  assert.equal(conv.needs_staff, true)
  assert.ok(Date.parse(conv.bot_paused_until) > Date.now())
  const before = sent.length
  await webhook(incoming('hello?'), {}, ENV)
  assert.equal(sent.length, before, 'bot stays quiet')
  assert.equal(db.inbound.length, 2, 'message still stored for the inbox')
})

test('notify: secret or staff only; each template once; failures retried next time', async () => {
  const { db, sent } = fakeWorld()
  const call = (headers = { 'x-sjt-notify-secret': 'notify-secret' }, id = BOOKING.id) =>
    notify({ httpMethod: 'POST', headers, body: JSON.stringify({ booking_id: id }) }, {}, ENV)

  assert.equal((await call({ 'x-sjt-notify-secret': 'wrong' })).statusCode, 401)
  assert.equal((await call({}, 'not-a-uuid')).statusCode, 401)
  assert.equal((await call(undefined, 'nope')).statusCode, 400)

  db.bookings[0].status = 'assigned'
  db.bookings[0].driver_id = 'd1'
  db.bookings[0].start_date = todayIST()
  let res = JSON.parse((await call()).body)
  assert.equal(res.sent, 3)
  assert.deepEqual(sent.map(m => m.template.name), ['sjt_booking_confirmed', 'sjt_driver_assigned', 'sjt_driver_new_trip'])
  assert.deepEqual(db.outbound.map(m => m.status), ['sent', 'sent', 'sent'])

  res = JSON.parse((await call({ authorization: 'Bearer staff-jwt' })).body) // staff resend
  assert.equal(res.sent, 0, 'nothing twice')

  db.drivers.push({ id: 'd2', name: 'Bala', phone: '910000000000' }) // WhatsApp refuses this one
  db.bookings[0].driver_id = 'd2'
  res = JSON.parse((await call()).body)
  assert.equal(res.sent, 1) // customer told about the new driver
  assert.equal(res.failed[0].kind, 'driver_trip:d2')
  db.drivers[1].phone = '9000000001'
  res = JSON.parse((await call()).body)
  assert.equal(res.sent, 1, 'failed driver message retried')
})

test('send: staff reply inside 24 h, refused after; resume bot; drivers refused', async () => {
  const { db, sent } = fakeWorld()
  const call = (body, auth = 'Bearer staff-jwt', now = Date.now()) =>
    send({ httpMethod: 'POST', headers: { authorization: auth }, body: JSON.stringify(body) }, {}, ENV, fetch, now)

  db.conversations.set(PHONE, { phone: PHONE, unread: 3, last_inbound_at: new Date().toISOString() })
  let res = await call({ action: 'reply', phone: '7305581235', text: 'Your driver is on the way' })
  assert.equal(res.statusCode, 200)
  assert.equal(sent[0].text.body, 'Your driver is on the way')
  assert.equal(db.outbound[0].kind, 'staff')
  assert.equal(db.outbound[0].sent_by, 'u1')
  assert.equal(db.conversations.get(PHONE).unread, 0)
  assert.ok(db.conversations.get(PHONE).bot_paused_until)

  res = await call({ action: 'reply', phone: PHONE, text: 'late' }, undefined, Date.now() + 25 * 3_600_000)
  assert.equal(res.statusCode, 409)

  res = await call({ action: 'resume_bot', phone: PHONE })
  assert.equal(res.statusCode, 200)
  assert.equal(db.conversations.get(PHONE).bot_paused_until, null)

  assert.equal((await call({ action: 'reply', phone: PHONE, text: 'x' }, 'Bearer bad')).statusCode, 401)
  fakeWorld({ staffRole: 'driver' })
  assert.equal((await call({ action: 'reply', phone: PHONE, text: 'x' })).statusCode, 403)
})

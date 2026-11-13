// WhatsApp bot, trip messages and inbox replies
// (vercel/functions/_lib/whatsapp{Bot,Trip,Api,Service}.js,
//  whatsapp-webhook.js / whatsapp-notify.js / whatsapp-send.js).
//
// The functions talk to Supabase REST and Meta's Graph API with fetch; the
// fake below plays both, keeping tables in memory, so the flows run end to
// end: message in → bot reply out, booking change → template once, staff
// reply only inside the 24 h window.
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

import { botStep, parseTripDate, parseTripTime, nextBookingNumber, statusReply, parseLocation, locationText, tripType } from '../vercel/functions/_lib/whatsappBot.js'
import { dueMessages, TEMPLATES } from '../vercel/functions/_lib/whatsappTrip.js'
import { waPhone, templateText, waMessage, messagePreview } from '../vercel/functions/_lib/whatsappApi.js'
import { todayIST } from '../vercel/functions/_lib/whatsappService.js'
import { handler as webhook } from '../vercel/functions/whatsapp-webhook.js'
import { handler as notify } from '../vercel/functions/whatsapp-notify.js'
import { handler as send } from '../vercel/functions/whatsapp-send.js'

const TODAY = '2026-10-30'
const NOW = Date.parse('2026-10-30T12:00:00Z') // fixed clock — todayIST(NOW) === '2026-10-30'
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

test('booking conversation: menu → trip type → pickup → drop → date → time → confirm', () => {
  let s = botStep(null, { text: 'Hi', contactName: 'Mani Kumar' }, TODAY)
  assert.equal(s.replies[0].kind, 'buttons')
  assert.equal(s.welcome, true)
  assert.match(s.replies[0].body, /Vanakkam Mani!/)
  assert.deepEqual(s.replies[0].buttons.map(b => b.id), ['book', 'status', 'staff'])

  s = botStep(s, { text: 'Book a trip', replyId: 'book' }, TODAY)
  assert.equal(s.state, 'book_type')
  assert.deepEqual(s.replies.at(-1).buttons.map(b => b.id), ['one_way', 'round_trip', 'self_drive'])

  const badType = botStep(s, { text: 'someday' }, TODAY)
  assert.equal(badType.state, 'book_type', 'asks again until a trip type is picked')
  assert.match(badType.replies[0].body, /choose your trip type/)

  s = botStep(s, { text: 'One way', replyId: 'one_way' }, TODAY)
  assert.equal(s.state, 'book_pickup')
  assert.equal(s.data.type, 'one_way')
  s = botStep(s, { text: 'Ariyakuppam' }, TODAY)
  s = botStep(s, { text: 'Chennai airport' }, TODAY)
  assert.equal(s.state, 'book_date')
  const bad = botStep(s, { text: 'someday' }, TODAY)
  assert.equal(bad.state, 'book_date')
  assert.match(bad.replies[0].body, /could not read that date/)
  s = botStep(s, { text: 'tomorrow' }, TODAY)
  s = botStep(s, { text: '5:30 am' }, TODAY)
  assert.equal(s.state, 'book_confirm')
  assert.match(s.replies[0].body, /Trip: One way\nPickup: Ariyakuppam\nDrop: Chennai airport\nDate: 31 Oct 2026\nTime: 05:30/)

  const done = botStep(s, { text: 'Confirm', replyId: 'confirm' }, TODAY)
  assert.equal(done.state, null)
  assert.deepEqual(done.action, {
    type: 'create_booking',
    booking: { type: 'one_way', pickup: 'Ariyakuppam', drop: 'Chennai airport', date: '2026-10-31', time: '05:30' },
  })
})

test('trip type: one way, round trip (return date) and self drive (ID + licence)', () => {
  // Typed aliases map to the bookings.type values.
  assert.equal(tripType('1'), 'one_way')
  assert.equal(tripType('One way'), 'one_way')
  assert.equal(tripType('round'), 'round_trip')
  assert.equal(tripType('Round trip'), 'round_trip')
  assert.equal(tripType('self driving'), 'self_drive')
  assert.equal(tripType('something else'), null)

  // Round trip asks for the return date and keeps it with the booking.
  let s = botStep(null, { text: 'book cab' }, TODAY)
  assert.equal(s.state, 'book_type')
  s = botStep(s, { text: 'Round trip', replyId: 'round_trip' }, TODAY)
  s = botStep(s, { text: 'Ariyakuppam' }, TODAY)
  s = botStep(s, { text: 'Chennai' }, TODAY)
  s = botStep(s, { text: '5/11' }, TODAY)
  assert.equal(s.state, 'book_return_date')
  const tooEarly = botStep(s, { text: '4/11' }, TODAY)
  assert.equal(tooEarly.state, 'book_return_date')
  assert.match(tooEarly.replies[0].body, /cannot be before the pickup date/)
  s = botStep(s, { text: '7/11' }, TODAY)
  assert.equal(s.state, 'book_time')
  s = botStep(s, { text: 'skip' }, TODAY)
  assert.match(s.replies[0].body, /Trip: Round trip[\s\S]*Return: 7 Nov 2026/)
  const done = botStep(s, { text: 'Confirm', replyId: 'confirm' }, TODAY)
  assert.equal(done.action.booking.type, 'round_trip')
  assert.equal(done.action.booking.return_date, '2026-11-07')

  // Self drive collects the ID and licence once, then books.
  s = botStep(null, { text: 'Book a trip', replyId: 'book' }, TODAY)
  s = botStep(s, { text: 'Self drive', replyId: 'self_drive' }, TODAY)
  assert.equal(s.data.self_drive, true)
  s = botStep(s, { text: 'Ariyakuppam' }, TODAY)
  s = botStep(s, { text: 'Chennai' }, TODAY)
  s = botStep(s, { text: 'tomorrow' }, TODAY)
  s = botStep(s, { text: 'skip' }, TODAY)
  s = botStep(s, { text: 'Confirm', replyId: 'confirm' }, TODAY)
  assert.equal(s.state, 'book_selfdrive_id_type')
  s = botStep(s, { text: '1' }, TODAY)
  s = botStep(s, { text: '1234 5678 9012' }, TODAY)
  s = botStep(s, { text: 'TN01-20200012345' }, TODAY)
  s = botStep(s, { text: '31/12/2030' }, TODAY)
  assert.equal(s.state, 'book_confirm')
  assert.match(s.replies[0].body, /ID: Aadhaar — 1234 5678 9012\nDL: TN01-20200012345\nDL Expiry: 31\/12\/2030/)
  const booked = botStep(s, { text: 'Confirm', replyId: 'confirm' }, TODAY)
  assert.equal(booked.action.type, 'create_booking')
  assert.equal(booked.action.booking.type, 'self_drive')
  assert.equal(booked.action.booking.dlExpiry, '31/12/2030')
})

test('Vanakkam is only sent for the first message when it is exactly Hi', () => {
  const firstHi = botStep(null, { text: 'Hi', contactName: 'Mani Kumar' }, TODAY)
  assert.match(firstHi.replies[0].body, /^Vanakkam Mani!/)

  const firstHello = botStep(null, { text: 'Hello', contactName: 'Mani Kumar' }, TODAY)
  assert.doesNotMatch(firstHello.replies[0].body, /Vanakkam/)
  const nextHi = botStep(
    { state: null, data: {}, welcome_checked_at: '2026-10-30T12:00:00.000Z' },
    { text: 'Hi', contactName: 'Mani Kumar' },
    TODAY,
  )
  assert.doesNotMatch(nextHi.replies[0].body, /Vanakkam/)
})

test('locations: WhatsApp shares, maps links and typed coordinates are understood', () => {
  // WhatsApp's own share, flattened by textOf().
  assert.deepEqual(
    parseLocation('Ariyakuppam · Main Road, Ariyakuppam 632314 · 12.9716,79.1587'),
    { label: 'Ariyakuppam · Main Road, Ariyakuppam 632314', lat: 12.9716, lng: 79.1587 },
  )
  // A share with no name/address is just coordinates.
  assert.deepEqual(parseLocation('12.9716,79.1587'), { lat: 12.9716, lng: 79.1587, label: '' })
  // Maps links (Google / Apple / Bing) that carry coordinates.
  for (const url of [
    'https://www.google.com/maps/@12.9716,79.1587,17z',
    'https://maps.google.com/?q=12.9716,79.1587',
    'https://www.google.com/maps/place/Ariyakuppam/data=!3d12.9716!4d79.1587',
    'https://maps.apple.com/?ll=12.9716,79.1587',
    'https://www.bing.com/maps?cp=12.9716~79.1587',
  ]) {
    assert.deepEqual(parseLocation(url), { lat: 12.9716, lng: 79.1587, label: '' }, url)
  }
  // geo: URI and a short link (no coordinates visible) are kept as-is.
  assert.deepEqual(parseLocation('geo:12.9716,79.1587'), { lat: 12.9716, lng: 79.1587, label: '' })
  assert.deepEqual(parseLocation('https://maps.app.goo.gl/abc123'), { url: 'https://maps.app.goo.gl/abc123' })
  // Plain text / impossible coordinates are not locations.
  assert.equal(parseLocation('Chennai airport'), null)
  assert.equal(parseLocation('95.0,200.0'), null)
  assert.equal(parseLocation(''), null)

  assert.equal(locationText('Ariyakuppam · Main Road · 12.9716,79.1587'), 'Ariyakuppam · Main Road (12.97160, 79.15870)')
  assert.equal(locationText('12.9716,79.1587'), '12.97160, 79.15870')
  assert.equal(locationText('Chennai airport'), 'Chennai airport')
})

test('booking conversation: location request button, location share and maps link', () => {
  let s = botStep(null, { text: 'Book a trip', replyId: 'book' }, TODAY)
  s = botStep(s, { text: 'One way', replyId: 'one_way' }, TODAY)
  assert.equal(s.state, 'book_pickup')
  const locReply = s.replies.find(r => r.kind === 'location')
  assert.equal(locReply.kind, 'location')
  assert.match(locReply.body, /Share your pickup location/)

  // Live location / share (WhatsApp flattens name · address · lat,lng).
  s = botStep(s, { text: 'Ariyakuppam · Main Road · 12.9716,79.1587' }, TODAY)
  assert.equal(s.state, 'book_drop')
  assert.equal(s.replies[0].kind, 'location')
  assert.equal(s.data.pickup, 'Ariyakuppam · Main Road (12.97160, 79.15870)')

  // A Google Maps link works for the drop.
  s = botStep(s, { text: 'https://www.google.com/maps/@13.0827,80.2707,15z' }, TODAY)
  assert.equal(s.state, 'book_date')
  assert.equal(s.data.drop, '13.08270, 80.27070')

  s = botStep(s, { text: 'tomorrow' }, TODAY)
  s = botStep(s, { text: 'skip' }, TODAY)
  assert.match(s.replies[0].body, /Pickup: Ariyakuppam · Main Road \(12\.97160, 79\.15870\)/)
  assert.match(s.replies[0].body, /Drop: 13\.08270, 80\.27070/)
})

test('bot starts with the welcome message before any flow reply', () => {
  const s = botStep(null, { text: 'Book a trip', replyId: 'book', contactName: 'Mani Kumar' }, TODAY)
  assert.match(s.replies[0].body, /Vanakkam Mani!/)
  assert.equal(s.state, 'book_type')
  assert.match(s.replies[1].body, /Which type of trip do you need/)

  const later = botStep({ state: 'book_pickup', data: {}, welcome_checked_at: '2026-10-30T12:00:00.000Z' }, { text: 'Ariyakuppam' }, TODAY)
  assert.equal(later.replies.length, 1, 'no second welcome for returning conversations')
})

test('cancel, status, staff, booking intents and unknown text', () => {
  const mid = { state: 'book_drop', data: { pickup: 'X' } }
  const c = botStep(mid, { text: 'cancel' }, TODAY)
  assert.equal(c.state, null)
  assert.match(c.replies[0].body, /^Cancelled — no booking was made/)
  assert.doesNotMatch(c.replies[0].body, /Vanakkam/)
  assert.deepEqual(c.replies[0].buttons.map(b => b.id), ['book', 'status', 'staff'])
  assert.equal(botStep(null, { text: '2' }, TODAY).action.type, 'trip_status')
  assert.equal(botStep(null, { text: 'my trip status' }, TODAY).action.type, 'trip_status')
  const staff = botStep(null, { text: 'x', replyId: 'staff' }, TODAY)
  assert.equal(staff.action.type, 'handoff')

  // "book cab"/"cab"/"taxi" … start the booking flow without the menu.
  for (const text of ['book cab', 'Book a Cab', 'cab', 'taxi', 'I want to book a cab', 'need a car']) {
    const r = botStep(null, { text }, TODAY)
    assert.equal(r.state, 'book_type', text)
    assert.deepEqual(r.replies.at(-1).buttons.map(b => b.id), ['one_way', 'round_trip', 'self_drive'], text)
  }
  assert.equal(botStep(null, { text: 'what is the fare?' }, TODAY).replies[0].kind, 'buttons')
  assert.equal(botStep(null, { text: 'what is the fare?' }, TODAY).state, null)
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
  assert.deepEqual(done.map(m => m.kind), ['customer_completed', 'customer_bill'])
  assert.deepEqual(done[0].params.slice(4), ['320', 'Rs. 5,400'])
  assert.deepEqual(done[1].params, ['Mani', 'FY26-OCT-0052', '31 Oct 2026', 'Ariyakuppam', 'Chennai', '320', 'Rs. 5,400'])

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
  assert.equal(messagePreview(waMessage.locationRequest(PHONE, 'Where to?')), 'Where to?\n[Send location]')
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

function fakeWorld({ staffRole = 'manager', failBookings = false } = {}) {
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
        if (failBookings) return json({ message: 'database is unavailable' }, 500)
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
function signed(message) {
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
function incoming(text, { id = crypto.randomUUID(), replyId } = {}) {
  return signed(replyId
    ? { from: PHONE, id, timestamp: '1793100000', type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: replyId, title: text } } }
    : { from: PHONE, id, timestamp: '1793100000', type: 'text', text: { body: text } })
}
function incomingLocation(location) {
  return signed({ from: PHONE, id: crypto.randomUUID(), timestamp: '1793100000', type: 'location', location })
}

test('webhook: a customer books a trip end to end, and a retried message is not answered twice', async () => {
  const { db, sent } = fakeWorld()
  const hi = incoming('Hi', { id: 'wamid.HI' })
  let res = await webhook(hi, {}, ENV, fetch, NOW)
  assert.deepEqual(JSON.parse(res.body), { ok: true, stored: 1, replied: 1 })
  assert.equal(sent[0].type, 'interactive')
  assert.equal(sent[0].to, PHONE)
  res = await webhook(hi, {}, ENV, fetch, NOW) // Meta retry
  assert.equal(JSON.parse(res.body).replied, 0)

  for (const [text, replyId] of [['book cab', null], ['One way', 'one_way'], ['Ariyakuppam'], ['Chennai'], ['5/11'], ['skip'], ['Confirm', 'confirm']]) {
    await webhook(incoming(text, { replyId }), {}, ENV, fetch, NOW)
  }
  const booking = db.bookings.at(-1)
  assert.equal(booking.status, 'pending')
  assert.equal(booking.type, 'one_way')
  assert.equal(booking.booking_number, 'FY26-NOV-0053')
  assert.deepEqual([booking.customer_name, booking.customer_contact, booking.start_date, booking.start_time],
    ['Mani Kumar', '7305581235', '2026-11-05', null])
  assert.match(sent.at(-1).text.body, /Your request FY26-NOV-0053 is booked/)
  assert.equal(db.outbound.filter(m => m.kind === 'bot').length, sent.length)
  assert.equal(db.conversations.get(PHONE).state, null)
})

test('webhook: a round trip saves type and return date', async () => {
  const { db, sent } = fakeWorld()
  for (const [text, replyId] of [
    ['book cab', null], ['Round trip', 'round_trip'], ['Ariyakuppam'], ['Chennai'],
    ['5/11'], ['7/11'], ['skip'], ['Confirm', 'confirm'],
  ]) {
    await webhook(incoming(text, { replyId }), {}, ENV, fetch, NOW)
  }
  const booking = db.bookings.at(-1)
  assert.equal(booking.type, 'round_trip')
  assert.equal(booking.start_date, '2026-11-05')
  assert.equal(booking.end_date, '2026-11-07')
  assert.equal(booking.status, 'pending')
  assert.match(sent.at(-1).text.body, /Trip: Round trip[\s\S]*Return: 7 Nov 2026/)
})

test('webhook: a self drive saves the type and ID details', async () => {
  const { db, sent } = fakeWorld()
  for (const [text, replyId] of [
    ['book cab', null], ['Self drive', 'self_drive'], ['Ariyakuppam'], ['Chennai'],
    ['5/11'], ['skip'], ['Confirm', 'confirm'],
    ['1'], ['1234 5678 9012'], ['TN01-20200012345'], ['31/12/2030'], ['Confirm', 'confirm'],
  ]) {
    await webhook(incoming(text, { replyId }), {}, ENV, fetch, NOW)
  }
  const booking = db.bookings.at(-1)
  assert.equal(booking.type, 'self_drive')
  assert.equal(booking.end_date, null)
  assert.deepEqual(booking.type_data, {
    lead_source: 'WhatsApp',
    source: 'whatsapp_bot',
    idType: 'Aadhaar',
    idNum: '1234 5678 9012',
    dlNum: 'TN01-20200012345',
    dlExpiry: '31/12/2030',
  })
  assert.match(sent.at(-1).text.body, /Your request .* is booked/)
})

test('webhook: a customer books by sharing their live location and a maps link', async () => {
  const { db, sent } = fakeWorld()
  await webhook(incoming('Book a trip', { replyId: 'book' }), {}, ENV, fetch, NOW)
  assert.equal(sent.at(-1).type, 'interactive')
  assert.equal(sent.at(-1).interactive.type, 'button')
  await webhook(incoming('One way', { replyId: 'one_way' }), {}, ENV, fetch, NOW)
  assert.equal(sent.at(-1).type, 'interactive')
  assert.equal(sent.at(-1).interactive.type, 'location_request_message')
  assert.deepEqual(sent.at(-1).interactive.action, { name: 'send_location' })

  await webhook(incomingLocation({
    latitude: 12.9716, longitude: 79.1587, name: 'Ariyakuppam', address: 'Main Road',
  }), {}, ENV, fetch, NOW)
  assert.equal(db.conversations.get(PHONE).state, 'book_drop')
  assert.equal(sent.at(-1).interactive.type, 'location_request_message', 'asks for the drop the same way')

  await webhook(incoming('https://maps.google.com/?q=13.0827,80.2707'), {}, ENV, fetch, NOW)
  await webhook(incoming('5/11'), {}, ENV, fetch, NOW)
  await webhook(incoming('skip'), {}, ENV, fetch, NOW)
  await webhook(incoming('Confirm', { replyId: 'confirm' }), {}, ENV, fetch, NOW)

  const booking = db.bookings.at(-1)
  assert.equal(booking.pickup_location, 'Ariyakuppam · Main Road (12.97160, 79.15870)')
  assert.equal(booking.drop_location, '13.08270, 80.27070')
  assert.equal(booking.status, 'pending')
  assert.match(sent.at(-1).text.body, /Your request FY26-NOV-0053 is booked/)
})

test('webhook: "Talk to staff" pauses the bot for 6 hours, then resumes it', async () => {
  const { db, sent } = fakeWorld()
  await webhook(incoming('Hi'), {}, ENV, fetch, NOW)
  await webhook(incoming('Talk to staff', { replyId: 'staff' }), {}, ENV, fetch, NOW)
  const conv = db.conversations.get(PHONE)
  assert.equal(conv.needs_staff, true)
  assert.equal(Date.parse(conv.bot_paused_until), NOW + 6 * 3_600_000)
  const before = sent.length
  await webhook(incoming('hello?'), {}, ENV, fetch, NOW + 5 * 3_600_000 + 59 * 60_000)
  assert.equal(sent.length, before, 'bot stays quiet')
  assert.equal(db.inbound.length, 3, 'messages are still stored for the inbox')

  await webhook(incoming('Hi'), {}, ENV, fetch, NOW + 6 * 3_600_000)
  assert.equal(sent.length, before + 1, 'bot resumes after 6 hours')
  assert.equal(db.conversations.get(PHONE).needs_staff, false)
  assert.equal(db.conversations.get(PHONE).bot_paused_until, null)
  assert.doesNotMatch(sent.at(-1).interactive.body.text, /Vanakkam/)
})

test('webhook: a failed booking pauses the bot for 5 minutes only', async () => {
  const { db, sent } = fakeWorld({ failBookings: true })
  for (const [text, replyId] of [['book cab', null], ['One way', 'one_way'], ['Ariyakuppam'], ['Chennai'], ['5/11'], ['skip'], ['Confirm', 'confirm']]) {
    await webhook(incoming(text, { replyId }), {}, ENV, fetch, NOW)
  }
  const conv = db.conversations.get(PHONE)
  assert.equal(Date.parse(conv.bot_paused_until), NOW + 5 * 60_000, 'paused for 5 minutes, not 12 hours')
  assert.match(sent.at(-1).text.body, /could not save the booking/)
  assert.equal(db.bookings.length, 1, 'no new booking was stored')

  const before = sent.length
  await webhook(incoming('Hi'), {}, ENV, fetch, NOW + 4 * 60_000)
  assert.equal(sent.length, before, 'still paused after 4 minutes')
  assert.equal(db.inbound.length, 8, 'the message is still stored for the inbox')

  await webhook(incoming('Hi'), {}, ENV, fetch, NOW + 5 * 60_000)
  assert.equal(sent.length, before + 1, 'bot resumes after 5 minutes')
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

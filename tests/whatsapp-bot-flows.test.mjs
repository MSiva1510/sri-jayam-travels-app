// Every branch of the WhatsApp bot state machine (pure botStep).
// whatsapp-bot.test.mjs covers the happy paths plus the webhook integration;
// this file walks each state, each guard and each trip model so a regression
// in one branch cannot hide behind the others.
import test from 'node:test'
import assert from 'node:assert/strict'

import { botStep, tripType, TRIP_TYPE_BUTTONS } from '../vercel/functions/_lib/whatsappBot.js'

const TODAY = '2026-10-30'
const IDLE = { state: null, data: {}, welcome_checked_at: '2026-10-30T00:00:00.000Z' }
const step = (conv, msg) => botStep(conv ?? IDLE, msg, TODAY)

const MENU_IDS = ['book', 'status', 'staff']
const TYPE_IDS = ['one_way', 'round_trip', 'self_drive']

test('menu: reset words, status, staff, booking and unknown messages', () => {
  // Reset words always return to the menu, whatever the state was.
  for (const word of ['hi', 'hii', 'hello', 'hey', 'menu', 'start', 'vanakkam', '0']) {
    const s = step({ state: 'book_drop', data: { pickup: 'X' } }, { text: word })
    assert.equal(s.state, null, word)
    assert.deepEqual(s.replies[0].buttons.map(b => b.id), MENU_IDS, word)
  }

  // Status.
  for (const text of ['status', '2', 'my trip status', 'what is the status of my booking']) {
    const s = step(IDLE, { text })
    assert.equal(s.action?.type, 'trip_status', text)
    assert.equal(s.state, null, text)
  }

  // Staff handoff.
  for (const text of ['staff', '3', 'talk to staff', 'agent', 'human', 'operator']) {
    const s = step(IDLE, { text })
    assert.equal(s.action?.type, 'handoff', text)
    assert.equal(s.state, null, text)
    assert.match(s.replies[0].body, /our team will reply/, text)
  }

  // Booking intents — the reported "book cab" case first.
  for (const text of [
    'book', '1', 'booking', 'book a trip', 'book cab', 'book a cab', 'cab', 'taxi',
    'car', 'trip', 'need a car', 'I want to book a cab', 'hire a vehicle',
  ]) {
    const s = step(IDLE, { text })
    assert.equal(s.state, 'book_type', text)
    assert.deepEqual(s.replies.at(-1).buttons.map(b => b.id), TYPE_IDS, text)
    assert.equal(s.action, null, text)
  }

  // Anything else shows the menu without starting a flow.
  for (const text of ['what is the fare?', 'good morning', 'booked already']) {
    const s = step(IDLE, { text })
    assert.equal(s.state, null, text)
    assert.equal(s.action, null, text)
    assert.deepEqual(s.replies[0].buttons.map(b => b.id), MENU_IDS, text)
  }
})

test('trip type: every button and typed alias maps to the DB value', () => {
  assert.deepEqual(TRIP_TYPE_BUTTONS.map(b => b.id), TYPE_IDS)
  assert.deepEqual(TRIP_TYPE_BUTTONS.map(b => b.title), ['One way', 'Round trip', 'Self drive'])

  const aliases = {
    one_way: ['one_way', 'one way', 'oneway', 'single', 'single trip', '1'],
    round_trip: ['round_trip', 'round trip', 'roundtrip', 'round', 'return', 'two way', '2'],
    self_drive: ['self_drive', 'self drive', 'selfdrive', 'self driving', 'drive myself', '3'],
  }
  for (const [type, list] of Object.entries(aliases)) {
    for (const alias of list) assert.equal(tripType(alias), type, alias)
  }
  for (const bad of ['airplane', 'one', 'four wheeler', '']) assert.equal(tripType(bad), null, bad)

  // Each alias also moves the conversation out of book_type.
  for (const [type, list] of Object.entries(aliases)) {
    for (const alias of list) {
      const s = step({ state: 'book_type', data: {} }, { text: alias })
      assert.equal(s.state, 'book_pickup', alias)
      assert.equal(s.data.type, type, alias)
      assert.equal(Boolean(s.data.self_drive), type === 'self_drive', alias)
    }
  }

  // A wrong answer asks again and keeps the step.
  const again = step({ state: 'book_type', data: {} }, { text: 'airplane' })
  assert.equal(again.state, 'book_type')
  assert.deepEqual(again.replies[0].buttons.map(b => b.id), TYPE_IDS)
  assert.match(again.replies[0].body, /choose your trip type/)
})

test('one way: pickup → drop → date → time → confirm, with every guard', () => {
  let s = step(IDLE, { text: 'book cab' })
  assert.equal(s.state, 'book_type')

  s = step(s, { text: 'One way', replyId: 'one_way' })
  assert.equal(s.state, 'book_pickup')
  assert.equal(s.data.type, 'one_way')

  // Empty pickup asks again; a location share is formatted.
  s = step(s, { text: '' })
  assert.equal(s.state, 'book_pickup')
  assert.equal(s.replies[0].kind, 'location')
  assert.match(s.replies[0].body, /Please share your pickup location/)
  s = step(s, { text: 'Ariyakuppam · Main Road · 12.9716,79.1587' })
  assert.equal(s.state, 'book_drop')
  assert.equal(s.data.pickup, 'Ariyakuppam · Main Road (12.97160, 79.15870)')

  // Empty drop asks again; a maps link is accepted.
  s = step(s, { text: '   ' })
  assert.equal(s.state, 'book_drop')
  assert.match(s.replies[0].body, /drop location/)
  s = step(s, { text: 'https://maps.google.com/?q=13.0827,80.2707' })
  assert.equal(s.state, 'book_date')
  assert.equal(s.data.drop, '13.08270, 80.27070')

  // Past and unreadable dates are rejected.
  for (const bad of ['yesterday', '1/10/2026', '31/2', 'next week']) {
    const again = step(s, { text: bad })
    assert.equal(again.state, 'book_date', bad)
    assert.match(again.replies[0].body, /could not read that date/, bad)
  }
  s = step(s, { text: 'tomorrow' })
  assert.equal(s.state, 'book_time')
  assert.equal(s.data.date, '2026-10-31')

  // Bad time asks again; skip is allowed.
  s = step(s, { text: 'noon' })
  assert.equal(s.state, 'book_time')
  assert.match(s.replies[0].body, /type a time like/)
  s = step(s, { text: 'skip' })
  assert.equal(s.state, 'book_confirm')
  assert.equal(s.data.time, null)
  assert.match(s.replies[0].body,
    /Trip: One way\nPickup: Ariyakuppam · Main Road \(12\.97160, 79\.15870\)\nDrop: 13\.08270, 80\.27070\nDate: 31 Oct 2026\nTime: Not given/)

  // Only Confirm / yes / ok creates the booking.
  for (const notConfirm of ['maybe', 'later']) {
    const again = step(s, { text: notConfirm })
    assert.equal(again.state, 'book_confirm', notConfirm)
    assert.equal(again.action, null, notConfirm)
  }
  const done = step(s, { text: 'Confirm', replyId: 'confirm' })
  assert.equal(done.state, null)
  assert.deepEqual(done.data, {})
  assert.deepEqual(done.action, {
    type: 'create_booking',
    booking: {
      type: 'one_way',
      pickup: 'Ariyakuppam · Main Road (12.97160, 79.15870)',
      drop: '13.08270, 80.27070',
      date: '2026-10-31',
      time: null,
    },
  })
})

test('round trip: asks for a return date and validates it', () => {
  let s = step(IDLE, { text: 'Book a trip', replyId: 'book' })
  s = step(s, { text: 'Round trip', replyId: 'round_trip' })
  assert.equal(s.data.type, 'round_trip')
  assert.equal(s.data.self_drive, undefined)
  s = step(s, { text: 'Ariyakuppam' })
  s = step(s, { text: 'Chennai' })
  s = step(s, { text: '5/11' })
  assert.equal(s.state, 'book_return_date')
  assert.equal(s.data.date, '2026-11-05')

  const bad = step(s, { text: 'someday' })
  assert.equal(bad.state, 'book_return_date')
  assert.match(bad.replies[0].body, /could not read that date/)

  const before = step(s, { text: '4/11' })
  assert.equal(before.state, 'book_return_date')
  assert.equal(before.data.return_date, undefined)
  assert.match(before.replies[0].body, /cannot be before the pickup date/)

  // Same-day return is allowed.
  s = step(s, { text: '5/11' })
  assert.equal(s.state, 'book_time')
  assert.equal(s.data.return_date, '2026-11-05')

  s = step(s, { text: '6:30 am' })
  assert.match(s.replies[0].body, /Trip: Round trip[\s\S]*Return: 5 Nov 2026[\s\S]*Time: 06:30/)
  const done = step(s, { text: 'yes' })
  assert.equal(done.action.booking.type, 'round_trip')
  assert.equal(done.action.booking.return_date, '2026-11-05')
  assert.equal(done.action.booking.time, '06:30')
})

test('self drive: ID type → ID number → licence → expiry → confirm (no loop)', () => {
  let s = step(IDLE, { text: 'self drive' })
  // "self drive" alone is not a booking verb: the menu explains the options.
  assert.equal(s.state, null)

  s = step(IDLE, { text: 'book a self drive cab' })
  assert.equal(s.state, 'book_type')
  s = step(s, { text: 'self driving' })
  assert.equal(s.state, 'book_pickup')
  assert.equal(s.data.type, 'self_drive')
  assert.equal(s.data.self_drive, true)
  s = step(s, { text: 'Ariyakuppam' })
  s = step(s, { text: 'Chennai' })
  s = step(s, { text: 'tomorrow' })
  s = step(s, { text: 'skip' })

  // First confirm asks for the ID, not the booking yet.
  s = step(s, { text: 'Confirm', replyId: 'confirm' })
  assert.equal(s.state, 'book_selfdrive_id_type')
  assert.equal(s.action, null)
  assert.match(s.replies[0].body, /Self Drive — ID Details/)

  // ID type: number or name, case-insensitive; anything else asks again.
  for (const bad of ['5', 'driving licence', '']) {
    const again = step(s, { text: bad })
    assert.equal(again.state, 'book_selfdrive_id_type', bad)
    assert.match(again.replies[0].body, /reply with ID type/, bad)
  }
  s = step(s, { text: 'AADHAAR' })
  assert.equal(s.state, 'book_selfdrive_id_num')
  assert.equal(s.data.idType, 'Aadhaar')

  // ID number guard.
  s = step(s, { text: 'ab' })
  assert.equal(s.state, 'book_selfdrive_id_num')
  assert.match(s.replies[0].body, /valid ID number/)
  s = step(s, { text: '1234 5678 9012' })
  assert.equal(s.state, 'book_selfdrive_dl_num')
  assert.equal(s.data.idNum, '1234 5678 9012')

  // Licence number guard.
  s = step(s, { text: 'xy' })
  assert.equal(s.state, 'book_selfdrive_dl_num')
  assert.match(s.replies[0].body, /valid Driving Licence number/)
  s = step(s, { text: 'TN01-20200012345' })
  assert.equal(s.state, 'book_selfdrive_dl_expiry')
  assert.equal(s.data.dlNum, 'TN01-20200012345')

  // Expiry guard, then the full confirmation with every detail stored.
  s = step(s, { text: '31/1' })
  assert.equal(s.state, 'book_selfdrive_dl_expiry')
  assert.match(s.replies[0].body, /valid expiry date/)
  s = step(s, { text: '31/12/2030' })
  assert.equal(s.state, 'book_confirm')
  assert.equal(s.data.dlExpiry, '31/12/2030')
  assert.match(s.replies[0].body,
    /Trip: Self drive[\s\S]*ID: Aadhaar — 1234 5678 9012\nDL: TN01-20200012345\nDL Expiry: 31\/12\/2030/)

  // The second confirm books the trip (it must not ask for the ID again).
  const done = step(s, { text: 'ok' })
  assert.equal(done.state, null)
  assert.equal(done.action.type, 'create_booking')
  assert.deepEqual(done.action.booking, {
    type: 'self_drive',
    self_drive: true,
    pickup: 'Ariyakuppam',
    drop: 'Chennai',
    date: '2026-10-31',
    time: null,
    idType: 'Aadhaar',
    idNum: '1234 5678 9012',
    dlNum: 'TN01-20200012345',
    dlExpiry: '31/12/2030',
  })
})

test('cancel and menu work from every booking state', () => {
  const states = [
    'book_type', 'book_pickup', 'book_drop', 'book_date', 'book_return_date', 'book_time',
    'book_confirm', 'book_selfdrive_id_type', 'book_selfdrive_id_num',
    'book_selfdrive_dl_num', 'book_selfdrive_dl_expiry',
  ]
  const data = {
    type: 'self_drive', self_drive: true, pickup: 'A', drop: 'B',
    date: '2026-11-05', return_date: '2026-11-07', time: null,
  }
  for (const state of states) {
    const cancelled = step({ state, data }, { text: 'cancel' })
    assert.equal(cancelled.state, null, state)
    assert.equal(cancelled.action, null, state)
    assert.deepEqual(cancelled.replies[0].buttons.map(b => b.id), MENU_IDS, state)
    assert.match(cancelled.replies[0].body, /^Cancelled/, state)

    const reset = step({ state, data }, { text: 'menu' })
    assert.equal(reset.state, null, state)
    assert.deepEqual(reset.replies[0].buttons.map(b => b.id), MENU_IDS, state)
  }
})

test('typed booking words mid-flow are read as the current answer, not a new booking', () => {
  // Design guard: once a flow has started, the answer belongs to that step.
  const pickup = step({ state: 'book_pickup', data: { type: 'one_way' } }, { text: 'Taxi stand' })
  assert.equal(pickup.state, 'book_drop')
  assert.equal(pickup.data.pickup, 'Taxi stand')
  assert.equal(pickup.action, null)
})

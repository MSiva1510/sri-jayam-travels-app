// WhatsApp inbox helpers: thread merge, phone format, 24 h window, labels.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatPhone, displayName, isWithinReplyWindow, isBotPaused, inboundText, typeLabel,
  senderLabel, statusLabel, mergeThread, upsertById, sortConversations,
  filterConversations, latestByPhone, dayKey, dateDividerLabel, groupThread,
  REPLY_WINDOW_MS,
} from '../src/utils/whatsappInbox.js'

test('formats Indian numbers as +91 xxxxx xxxxx', () => {
  assert.equal(formatPhone('917305581235'), '+91 73055 81235')
  assert.equal(formatPhone('7305581235'), '+91 73055 81235')
  assert.equal(formatPhone('+91 73055-81235'), '+91 73055 81235')
  assert.equal(formatPhone('447700900123'), '+447700900123')
  assert.equal(formatPhone(null), '')
})

test('display name falls back to the formatted phone', () => {
  assert.equal(displayName({ phone: '917305581235', contact_name: 'Ravi' }), 'Ravi')
  assert.equal(displayName({ phone: '917305581235', contact_name: '  ' }), '+91 73055 81235')
})

test('24 h reply window', () => {
  const now = Date.parse('2026-10-30T12:00:00Z')
  assert.equal(isWithinReplyWindow('2026-10-30T11:00:00Z', now), true)
  assert.equal(isWithinReplyWindow(new Date(now - REPLY_WINDOW_MS + 1000).toISOString(), now), true)
  assert.equal(isWithinReplyWindow(new Date(now - REPLY_WINDOW_MS).toISOString(), now), false)
  assert.equal(isWithinReplyWindow('2026-10-28T12:00:00Z', now), false)
  assert.equal(isWithinReplyWindow(null, now), false)
  assert.equal(isWithinReplyWindow('garbage', now), false)
})

test('bot paused only when the pause is in the future', () => {
  const now = Date.parse('2026-10-30T12:00:00Z')
  assert.equal(isBotPaused('2026-10-30T13:00:00Z', now), true)
  assert.equal(isBotPaused('2026-10-30T11:00:00Z', now), false)
  assert.equal(isBotPaused(null, now), false)
})

test('inbound media without text shows the message type', () => {
  assert.equal(inboundText({ text_body: 'hi', message_type: 'text' }), 'hi')
  assert.equal(inboundText({ text_body: null, message_type: 'image' }), '[image]')
  assert.equal(inboundText({ text_body: '', message_type: 'location' }), '[location]')
  assert.equal(inboundText({}), '[message]')
})

test('unknown or rejected message types render a friendly label, not a raw type', () => {
  // Meta reports content it could not accept as type "unsupported" (131051).
  assert.equal(inboundText({ text_body: null, message_type: 'unsupported' }), 'Unsupported message')
  assert.equal(inboundText({ text_body: null, message_type: 'errors' }), 'Delivery error')
  assert.equal(inboundText({ text_body: null, message_type: 'revoke' }), 'Message revoked')
  assert.equal(typeLabel('unsupported'), 'Unsupported message')
  assert.equal(typeLabel('reaction', { payload: { reaction: { emoji: '👍' } } }), '👍')
  assert.equal(typeLabel('location'), 'Location')
})

test('reactions attach to the message they reply to and do not bubble up', () => {
  const outbound = [
    { id: 'o1', wamid: 'wamid.OUT1', created_at: '2026-10-30T10:00:00Z', body: 'Vanakkam! Welcome', kind: 'bot' },
  ]
  const inbound = [
    { id: 'i1', wamid: 'wamid.IN1', from_phone: 'a', received_at: '2026-10-30T10:05:00Z', message_type: 'text', text_body: 'hi' },
    { id: 'i2', wamid: 'wamid.IN2', from_phone: 'a', received_at: '2026-10-30T10:06:00Z', message_type: 'reaction', payload: { reaction: { emoji: '👍', message_id: 'wamid.OUT1' } } },
  ]
  const thread = mergeThread(inbound, outbound)
  assert.equal(thread.length, 2)
  assert.equal(thread[0].reaction?.emoji, '👍')
  assert.equal(thread[0].text, 'Vanakkam! Welcome')
  assert.equal(thread[1].text, 'hi')

  // Reaction with an unknown target becomes its own row, not a crash.
  const orphan = mergeThread([{ id: 'i3', wamid: 'wamid.IN3', from_phone: 'a', received_at: '2026-10-30T11:00:00Z', message_type: 'reaction', payload: { reaction: { emoji: '🙏' } } }], [])
  assert.equal(orphan.length, 1)
  assert.equal(orphan[0].text, '🙏')
})

test('sender and status labels', () => {
  assert.equal(senderLabel('bot'), 'Bot')
  assert.equal(senderLabel('staff'), 'Staff')
  assert.equal(senderLabel('customer_confirmed'), 'Trip message')
  assert.equal(senderLabel('customer_driver:abc'), 'Trip message')
  assert.equal(senderLabel('driver_trip:abc'), 'Trip message')
  assert.equal(statusLabel('delivered'), 'Delivered')
  assert.equal(statusLabel('FAILED'), 'Failed')
  assert.equal(statusLabel(null), 'Queued')
  assert.equal(statusLabel('weird'), 'Weird')
})

test('merges inbound and outbound by time, oldest first', () => {
  const inbound = [
    { id: 1, received_at: '2026-10-30T10:00:00Z', text_body: 'hello', message_type: 'text' },
    { id: 2, received_at: '2026-10-30T10:02:00Z', text_body: null, message_type: 'image' },
  ]
  const outbound = [
    { id: 1, created_at: '2026-10-30T10:01:00Z', body: 'Hi! How can we help?', kind: 'bot' },
    { id: 2, created_at: '2026-10-30T09:00:00Z', body: null, template_name: 'trip_confirmed', kind: 'customer_confirmed' },
  ]
  const thread = mergeThread(inbound, outbound)
  assert.deepEqual(thread.map(m => m.key), ['out:2', 'in:1', 'out:1', 'in:2'])
  assert.deepEqual(thread.map(m => m.direction), ['out', 'in', 'out', 'in'])
  assert.equal(thread[0].text, 'Template: trip_confirmed')
  assert.equal(thread[3].text, '[image]')
})

test('merge de-duplicates by id and tolerates bad input', () => {
  const thread = mergeThread(
    [{ id: 5, received_at: '2026-10-30T10:00:00Z', text_body: 'a' }, { id: 5, received_at: '2026-10-30T10:00:00Z', text_body: 'a2' }, null],
    undefined,
  )
  assert.equal(thread.length, 1)
  assert.equal(thread[0].text, 'a2')
  assert.deepEqual(mergeThread(), [])
})

test('upsertById inserts and merges updates', () => {
  const rows = [{ id: 1, status: 'sent' }]
  assert.deepEqual(upsertById(rows, { id: 1, status: 'read' }), [{ id: 1, status: 'read' }])
  assert.deepEqual(upsertById(rows, { id: 2, status: 'queued' }).map(r => r.id), [1, 2])
  assert.equal(rows[0].status, 'sent')
})

test('sorts conversations newest first, nulls last', () => {
  const list = [
    { phone: 'a', last_message_at: '2026-10-29T10:00:00Z' },
    { phone: 'b', last_message_at: null },
    { phone: 'c', last_message_at: '2026-10-30T10:00:00Z' },
  ]
  assert.deepEqual(sortConversations(list).map(c => c.phone), ['c', 'a', 'b'])
})

test('filters by chip and search', () => {
  const list = [
    { phone: '917305581235', contact_name: 'Ravi Kumar', needs_staff: true, unread: 0 },
    { phone: '919876543210', contact_name: null, needs_staff: false, unread: 3 },
  ]
  assert.equal(filterConversations(list, { filter: 'needs_staff' }).length, 1)
  assert.equal(filterConversations(list, { filter: 'unread' })[0].phone, '919876543210')
  assert.equal(filterConversations(list, { query: 'ravi' }).length, 1)
  assert.equal(filterConversations(list, { query: '98765 43' })[0].phone, '919876543210')
  assert.equal(filterConversations(list, { query: 'nobody' }).length, 0)
  assert.equal(filterConversations(list, {}).length, 2)
})

test('latestByPhone keeps the newest message per phone', async () => {
  const map = latestByPhone(
    [
      { from_phone: 'a', received_at: '2026-10-30T10:00:00Z', text_body: 'old' },
      { from_phone: 'a', received_at: '2026-10-30T12:00:00Z', text_body: null, message_type: 'image' },
      { from_phone: 'b', received_at: '2026-10-30T09:00:00Z', text_body: 'hi' },
    ],
    [
      { to_phone: 'b', created_at: '2026-10-30T09:30:00Z', body: 'Hello!' },
      { to_phone: 'a', created_at: '2026-10-30T11:00:00Z', body: 'reply', status: 'read' },
    ],
  )
  assert.deepEqual(map.a, { text: '[image]', at: '2026-10-30T12:00:00Z', direction: 'in' })
  assert.deepEqual(map.b, { text: 'Hello!', at: '2026-10-30T09:30:00Z', direction: 'out' })
  const next = latestByPhone([{ from_phone: 'b', received_at: '2026-10-30T13:00:00Z', text_body: 'new' }], [], map)
  assert.equal(next.b.text, 'new')
  assert.equal(next.a.text, '[image]')
})

test('outbound previews carry the delivery status for list ticks', () => {
  const map = latestByPhone([], [
    { to_phone: 'a', created_at: '2026-10-30T09:30:00Z', body: 'reply', status: 'read' },
  ])
  assert.equal(map.a.status, 'read')
  assert.equal(map.a.direction, 'out')
})

test('day keys and date dividers use the local calendar', () => {
  const now = new Date(2026, 9, 30, 21, 0).getTime() // 30 Oct 2026, 21:00 local
  const todayAt = new Date(2026, 9, 30, 9, 0).toISOString()
  const yesterdayAt = new Date(2026, 9, 29, 23, 30).toISOString()
  const olderAt = new Date(2026, 8, 12, 10, 0).toISOString()
  const lastYearAt = new Date(2025, 9, 30, 10, 0).toISOString()

  assert.equal(dayKey(todayAt), dayKey(now))
  assert.equal(dayKey('garbage'), '')
  assert.equal(dateDividerLabel(todayAt, now), 'Today')
  assert.equal(dateDividerLabel(yesterdayAt, now), 'Yesterday')
  assert.equal(dateDividerLabel(olderAt, now), '12 September')
  assert.equal(dateDividerLabel(lastYearAt, now), '30 October 2025')
})

test('groupThread marks date breaks and same-sender runs', () => {
  const thread = [
    { key: 'a', direction: 'in', at: new Date(2026, 9, 29, 23, 58).toISOString() },
    { key: 'b', direction: 'in', at: new Date(2026, 9, 30, 0, 1).toISOString() },  // next day
    { key: 'c', direction: 'in', at: new Date(2026, 9, 30, 0, 3).toISOString() },  // same run
    { key: 'd', direction: 'out', at: new Date(2026, 9, 30, 0, 4).toISOString() }, // other side
    { key: 'e', direction: 'in', at: new Date(2026, 9, 30, 0, 20).toISOString() }, // gap > 4 min
  ]
  const out = groupThread(thread)
  assert.deepEqual(out.map(m => m.newDay), [true, true, false, false, false])
  assert.deepEqual(out.map(m => m.groupStart), [true, true, false, true, true])
  assert.deepEqual(out.map(m => m.groupEnd), [true, false, true, true, true])
  assert.deepEqual(groupThread(), [])
  assert.deepEqual(groupThread([{ direction: 'in', at: 'garbage' }])[0].groupStart, true)
})

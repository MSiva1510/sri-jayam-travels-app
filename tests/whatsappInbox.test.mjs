// WhatsApp inbox helpers: thread merge, phone format, 24 h window, labels.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatPhone, displayName, isWithinReplyWindow, isBotPaused, inboundText,
  senderLabel, statusLabel, mergeThread, upsertById, sortConversations,
  filterConversations, REPLY_WINDOW_MS,
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
  const { latestByPhone } = await import('../src/utils/whatsappInbox.js')
  const map = latestByPhone(
    [
      { from_phone: 'a', received_at: '2026-10-30T10:00:00Z', text_body: 'old' },
      { from_phone: 'a', received_at: '2026-10-30T12:00:00Z', text_body: null, message_type: 'image' },
      { from_phone: 'b', received_at: '2026-10-30T09:00:00Z', text_body: 'hi' },
    ],
    [
      { to_phone: 'b', created_at: '2026-10-30T09:30:00Z', body: 'Hello!' },
      { to_phone: 'a', created_at: '2026-10-30T11:00:00Z', body: 'reply' },
    ],
  )
  assert.deepEqual(map.a, { text: '[image]', at: '2026-10-30T12:00:00Z', direction: 'in' })
  assert.deepEqual(map.b, { text: 'Hello!', at: '2026-10-30T09:30:00Z', direction: 'out' })
  const next = latestByPhone([{ from_phone: 'b', received_at: '2026-10-30T13:00:00Z', text_body: 'new' }], [], map)
  assert.equal(next.b.text, 'new')
  assert.equal(next.a.text, '[image]')
})

// handleInbound: an inbound message must always end in a reply.
//
// Regression: the deployed bot wrote whatsapp_conversations.welcome_checked_at
// before the migration that adds the column reached production. Every message
// then failed the PATCH, the webhook logged "bot failed" and answered 200, and
// customers got silence for three days. Schema drift may not cost a reply.
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import { handleInbound } from '../vercel/functions/_lib/whatsappService.js'

const CONFIG = { token: 'token', phoneNumberId: 'PNID', version: 'v21.0' }

/** Conversation row as PostgREST returns it; older tables have no welcome column. */
const conversation = (extra = {}) => ({
  phone: '919876543210',
  contact_name: 'Ravi',
  state: null,
  data: {},
  bot_paused_until: null,
  needs_staff: false,
  ...extra,
})

function fakeDb({ conv = conversation(), update = async () => [] } = {}) {
  const calls = { rpc: [], update: [], insert: [], select: [] }
  return {
    calls,
    async rpc(fn, args) {
      calls.rpc.push([fn, args])
      if (fn === 'whatsapp_touch_conversation' && args.p_direction === 'in') return [conv]
      return null
    },
    async update(path, patch) {
      calls.update.push([path, patch])
      return update(path, patch)
    },
    async insert(table, rows) {
      calls.insert.push([table, rows])
      return rows.map((r, i) => ({ id: `row-${i}`, ...r }))
    },
    async select(path) {
      calls.select.push(path)
      return []
    },
  }
}

function graphFetch(status = 200) {
  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) })
    if (status !== 200) return new Response(JSON.stringify({ error: { message: 'nope' } }), { status })
    return new Response(JSON.stringify({ messages: [{ id: 'wamid.SENT' }] }), { status: 200 })
  }
  return calls
}

const realFetch = globalThis.fetch
const realError = console.error
afterEach(() => {
  globalThis.fetch = realFetch
  console.error = realError
})

const msg = { from: '919876543210', text: 'hi', contactName: 'Ravi' }

test('a missing welcome_checked_at column does not stop the reply', async () => {
  const sent = graphFetch()
  const errors = []
  console.error = (...args) => errors.push(args.join(' '))

  const db = fakeDb({
    update: async (_path, patch) => {
      if ('welcome_checked_at' in patch) {
        const err = new Error('PATCH whatsapp_conversations → 400 {"code":"42703","message":"column whatsapp_conversations.welcome_checked_at does not exist"}')
        err.status = 400
        throw err
      }
      return [patch]
    },
  })

  const result = await handleInbound(db, { ...CONFIG }, msg, Date.parse('2026-11-14T10:00:00Z'))

  assert.equal(result.replied, 1)
  assert.equal(sent.length, 1, 'the customer is answered')
  assert.match(sent[0].body.interactive.body.text, /Welcome to Sri Jayam Travels|How can we help/)
  // First PATCH carries the welcome marker, the retry drops exactly that field.
  assert.ok('welcome_checked_at' in db.calls.update[0][1])
  assert.ok(!('welcome_checked_at' in db.calls.update[1][1]))
  assert.ok('state' in db.calls.update[1][1], 'state is still saved')
  assert.equal(db.calls.insert.length, 1)
  assert.equal(db.calls.insert[0][0], 'whatsapp_outbound_messages')
  assert.ok(errors.some(e => /retrying without it/.test(e)))
})

test('the reply still goes out when every conversation write fails', async () => {
  const sent = graphFetch()
  const errors = []
  console.error = (...args) => errors.push(args.join(' '))

  const db = fakeDb({
    update: async () => { throw new Error('PATCH whatsapp_conversations → 500 boom') },
  })

  const result = await handleInbound(db, { ...CONFIG }, msg, Date.parse('2026-11-14T10:00:00Z'))

  assert.equal(result.replied, 1)
  assert.equal(sent.length, 1)
  assert.equal(db.calls.update.length, 2)
  assert.ok(errors.some(e => /could not save conversation/.test(e)))
})

test('a healthy table saves progress in one write', async () => {
  const sent = graphFetch()
  const errors = []
  console.error = (...args) => errors.push(args.join(' '))

  const db = fakeDb({ update: async (_path, patch) => [patch] })

  const result = await handleInbound(db, { ...CONFIG }, msg, Date.parse('2026-11-14T10:00:00Z'))

  assert.equal(result.replied, 1)
  assert.equal(sent.length, 1)
  assert.equal(db.calls.update.length, 1)
  assert.ok(db.calls.update[0][1].welcome_checked_at)
  assert.deepEqual(errors, [])
})

test('without WhatsApp credentials the message is stored but not answered', async () => {
  const sent = graphFetch()
  const db = fakeDb()

  const result = await handleInbound(db, null, msg, Date.parse('2026-11-14T10:00:00Z'))

  assert.deepEqual(result, { replied: 0, reason: 'not configured' })
  assert.equal(sent.length, 0)
  assert.equal(db.calls.update.length, 0)
})

test('a staff takeover keeps the bot quiet', async () => {
  const sent = graphFetch()
  const db = fakeDb({
    conv: conversation({ bot_paused_until: '2026-11-14T20:00:00.000Z', needs_staff: true }),
  })

  const result = await handleInbound(db, { ...CONFIG }, msg, Date.parse('2026-11-14T10:00:00Z'))

  assert.deepEqual(result, { replied: 0, reason: 'staff handling' })
  assert.equal(sent.length, 0)
})

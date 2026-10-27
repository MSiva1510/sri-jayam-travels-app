// WhatsApp Cloud API webhook (netlify/functions/whatsapp-webhook.js).
//
// Meta verifies the callback URL with a GET, then POSTs signed events. The
// function must echo the challenge only for our verify token, refuse any
// POST whose X-Hub-Signature-256 is not ours, and hand receipts / inbound
// messages to Supabase — returning non-200 when storing fails so Meta retries.
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { handler } from '../netlify/functions/whatsapp-webhook.js'
import { verifyChallenge, verifySignature, parseWebhook } from '../netlify/functions/_lib/whatsappWebhook.js'

const ENV = {
  WHATSAPP_VERIFY_TOKEN: 'verify-me',
  WHATSAPP_APP_SECRET: 'app-secret',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
}

const PAYLOAD = {
  object: 'whatsapp_business_account',
  entry: [{
    id: 'WABA_ID',
    changes: [{
      field: 'messages',
      value: {
        messaging_product: 'whatsapp',
        metadata: { display_phone_number: '919400000000', phone_number_id: 'PNID' },
        contacts: [{ wa_id: '919876543210', profile: { name: 'Ravi' } }],
        messages: [{ from: '919876543210', id: 'wamid.IN1', timestamp: '1793100000', type: 'text', text: { body: 'Is my cab on time?' } }],
        statuses: [
          { id: 'wamid.OUT1', status: 'delivered', timestamp: '1793100010', recipient_id: '919876543210' },
          { id: 'wamid.OUT2', status: 'failed', timestamp: '1793100020', recipient_id: '919800000000',
            errors: [{ code: 131026, title: 'Message undeliverable' }] },
        ],
      },
    }],
  }],
}

const sign = (body, secret = ENV.WHATSAPP_APP_SECRET) =>
  'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex')

const post = (body, headers = { 'x-hub-signature-256': sign(body) }) =>
  ({ httpMethod: 'POST', headers, body, isBase64Encoded: false })

const realFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = realFetch })

function captureFetch(status = 200) {
  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init, body: init.body ? JSON.parse(init.body) : null })
    return new Response(status === 200 ? '' : 'boom', { status })
  }
  return calls
}

// ── GET verification ─────────────────────────────────────────

test('GET echoes hub.challenge for the right verify token', async () => {
  const res = await handler({ httpMethod: 'GET', queryStringParameters: {
    'hub.mode': 'subscribe', 'hub.verify_token': 'verify-me', 'hub.challenge': '1158201444',
  } }, {}, ENV)
  assert.equal(res.statusCode, 200)
  assert.equal(res.body, '1158201444')
  assert.equal(res.headers['Content-Type'], 'text/plain')
})

test('GET is refused for a wrong token, wrong mode, or no token configured', async () => {
  const q = { 'hub.mode': 'subscribe', 'hub.verify_token': 'nope', 'hub.challenge': 'x' }
  assert.equal((await handler({ httpMethod: 'GET', queryStringParameters: q }, {}, ENV)).statusCode, 403)
  assert.equal(verifyChallenge({ ...q, 'hub.verify_token': 'verify-me', 'hub.mode': 'unsubscribe' }, 'verify-me'), null)
  assert.equal(verifyChallenge({ ...q, 'hub.verify_token': '' }, undefined), null)
})

// ── Signature ────────────────────────────────────────────────

test('verifySignature accepts only the exact body signed with the app secret', () => {
  const body = JSON.stringify(PAYLOAD)
  assert.equal(verifySignature(body, sign(body), 'app-secret'), true)
  assert.equal(verifySignature(body + ' ', sign(body), 'app-secret'), false)
  assert.equal(verifySignature(body, sign(body, 'other'), 'app-secret'), false)
  assert.equal(verifySignature(body, 'sha256=nothex', 'app-secret'), false)
  assert.equal(verifySignature(body, undefined, 'app-secret'), false)
  assert.equal(verifySignature(body, sign(body), undefined), false)
})

test('POST with a bad or missing signature is 401 and stores nothing', async () => {
  const calls = captureFetch()
  const body = JSON.stringify(PAYLOAD)
  assert.equal((await handler(post(body, { 'x-hub-signature-256': sign(body, 'evil') }), {}, ENV)).statusCode, 401)
  assert.equal((await handler(post(body, {}), {}, ENV)).statusCode, 401)
  assert.equal(calls.length, 0)
})

test('POST without WHATSAPP_APP_SECRET configured is refused (500), never accepted unsigned', async () => {
  const body = JSON.stringify(PAYLOAD)
  const res = await handler(post(body), {}, { ...ENV, WHATSAPP_APP_SECRET: '' })
  assert.equal(res.statusCode, 500)
})

// ── Parsing ──────────────────────────────────────────────────

test('parseWebhook flattens receipts and inbound messages', () => {
  const { statuses, messages } = parseWebhook(PAYLOAD)
  assert.deepEqual(statuses.map(s => [s.wamid, s.status]), [['wamid.OUT1', 'delivered'], ['wamid.OUT2', 'failed']])
  assert.match(statuses[1].error, /131026 · Message undeliverable/)
  assert.equal(statuses[0].at, new Date(1793100010 * 1000).toISOString())
  assert.equal(messages.length, 1)
  assert.deepEqual(
    { from: messages[0].from, name: messages[0].contactName, text: messages[0].text, pnid: messages[0].phoneNumberId },
    { from: '919876543210', name: 'Ravi', text: 'Is my cab on time?', pnid: 'PNID' },
  )
})

test('parseWebhook ignores other objects and unknown statuses', () => {
  assert.deepEqual(parseWebhook({ object: 'page', entry: [] }), { statuses: [], messages: [] })
  const odd = structuredClone(PAYLOAD)
  odd.entry[0].changes[0].value.statuses = [{ id: 'w', status: 'deleted' }]
  assert.equal(parseWebhook(odd).statuses.length, 0)
})

// ── Storing ──────────────────────────────────────────────────

test('signed POST applies each receipt via RPC and upserts inbound messages', async () => {
  const calls = captureFetch()
  const body = JSON.stringify(PAYLOAD)
  const res = await handler(post(body), {}, ENV)
  assert.equal(res.statusCode, 200)
  assert.deepEqual(JSON.parse(res.body), { ok: true, stored: 3 })

  const rpc = calls.filter(c => c.url.endsWith('/rest/v1/rpc/whatsapp_apply_status'))
  assert.deepEqual(rpc.map(c => [c.body.p_wamid, c.body.p_status]), [['wamid.OUT1', 'delivered'], ['wamid.OUT2', 'failed']])
  assert.equal(rpc[0].init.headers.Authorization, 'Bearer service-key')

  const ins = calls.find(c => c.url.includes('/rest/v1/whatsapp_inbound_messages?on_conflict=wamid'))
  assert.ok(ins, 'inbound insert sent')
  assert.match(ins.init.headers.Prefer, /resolution=ignore-duplicates/)
  assert.equal(ins.body[0].wamid, 'wamid.IN1')
  assert.equal(ins.body[0].text_body, 'Is my cab on time?')
})

test('base64-encoded bodies are verified on the decoded bytes', async () => {
  captureFetch()
  const body = JSON.stringify(PAYLOAD)
  const res = await handler({
    httpMethod: 'POST',
    headers: { 'X-Hub-Signature-256': sign(body) },
    body: Buffer.from(body).toString('base64'),
    isBase64Encoded: true,
  }, {}, ENV)
  assert.equal(res.statusCode, 200)
})

test('a storage failure returns 500 so Meta retries', async () => {
  captureFetch(503)
  const body = JSON.stringify(PAYLOAD)
  assert.equal((await handler(post(body), {}, ENV)).statusCode, 500)
})

test('missing Supabase service key is 500, not a silent 200', async () => {
  const calls = captureFetch()
  const body = JSON.stringify(PAYLOAD)
  const res = await handler(post(body), {}, { ...ENV, SUPABASE_SERVICE_ROLE_KEY: '' })
  assert.equal(res.statusCode, 500)
  assert.equal(calls.length, 0)
})

test('signed POST with nothing relevant is acknowledged without DB calls', async () => {
  const calls = captureFetch()
  const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'account_update', value: {} }] }] })
  const res = await handler(post(body), {}, ENV)
  assert.equal(res.statusCode, 200)
  assert.equal(calls.length, 0)
})

test('other methods are 405', async () => {
  assert.equal((await handler({ httpMethod: 'PUT' }, {}, ENV)).statusCode, 405)
})

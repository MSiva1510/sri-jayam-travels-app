// ─── Vercel entry points (api/*.js) ──────────────────────────────────────
// The deployed site runs on Vercel, which serves `api/` as Web-standard
// functions. These tests exercise the adapter end to end so a broken rewrite
// or body encoding fails CI instead of Meta's "couldn't validate" error.

import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

process.env.WHATSAPP_VERIFY_TOKEN = 'test-verify-token'
process.env.WHATSAPP_APP_SECRET = 'test-app-secret'
process.env.SUPABASE_URL = 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'

const { default: webhook } = await import('../api/whatsapp/webhook.js')
const { toNetlifyEvent, toWebResponse } = await import('../server/vercelAdapter.js')

const URL_BASE = 'https://app.travelsjayam.in/api/whatsapp/webhook'

const sign = body => 'sha256=' + crypto.createHmac('sha256', 'test-app-secret').update(body).digest('hex')

test('Vercel webhook: GET echoes hub.challenge for the right verify token', async () => {
  const request = new Request(
    `${URL_BASE}?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=challenge-42`,
  )
  const response = await webhook.fetch(request)

  assert.equal(response.status, 200)
  assert.equal(await response.text(), 'challenge-42')
  assert.match(response.headers.get('content-type'), /text\/plain/)
})

test('Vercel webhook: GET is refused for a wrong verify token', async () => {
  const request = new Request(`${URL_BASE}?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=x`)
  const response = await webhook.fetch(request)

  assert.equal(response.status, 403)
})

test('Vercel webhook: POST without a signature is 401', async () => {
  const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] })
  const response = await webhook.fetch(new Request(URL_BASE, { method: 'POST', body }))

  assert.equal(response.status, 401)
})

test('Vercel webhook: the signature is checked against the exact raw bytes', async () => {
  const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] })
  const response = await webhook.fetch(new Request(URL_BASE, {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': sign(body) },
  }))

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true, stored: 0 })
})

test('Vercel webhook: unknown methods are 405', async () => {
  const response = await webhook.fetch(new Request(URL_BASE, { method: 'DELETE' }))
  assert.equal(response.status, 405)
})

test('adapter keeps the raw body bytes and Netlify event shape', async () => {
  const body = '{"a":1,  "b":"ü"}'
  const event = await toNetlifyEvent(new Request(`${URL_BASE}?x=1&x=2`, {
    method: 'POST',
    body,
    headers: { 'X-Custom': 'yes' },
  }))

  assert.equal(event.httpMethod, 'POST')
  assert.equal(event.body, body)
  assert.equal(event.isBase64Encoded, false)
  assert.equal(event.headers['x-custom'], 'yes')
  assert.deepEqual(event.queryStringParameters, { x: '2' })
})

test('adapter passes null when there is no query string', async () => {
  const event = await toNetlifyEvent(new Request(URL_BASE))
  assert.equal(event.queryStringParameters, null)
  assert.equal(event.body, '')
})

test('adapter turns a Netlify response into a Web Response', async () => {
  const response = toWebResponse({
    statusCode: 418,
    headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
    body: 'teapot',
  })

  assert.equal(response.status, 418)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(await response.text(), 'teapot')
})

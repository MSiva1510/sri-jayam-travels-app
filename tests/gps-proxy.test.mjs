// Contract tests for netlify/functions/gps-proxy.js
// Supabase auth is mocked via global fetch; no network needed.
import { test, before } from 'node:test'
import assert from 'node:assert/strict'

process.env.SUPABASE_URL = 'https://example.supabase.co'
process.env.SUPABASE_ANON_KEY = 'anon-key'

const users = {
  admin:  { id: 'u1', role: 'admin',   status: 'active' },
  driver: { id: 'u2', role: 'driver',  status: 'active' },
  gone:   { id: 'u3', role: 'manager', status: 'inactive' },
}

let handler
before(async () => {
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url)
    const tok = (opts.headers?.Authorization || '').replace('Bearer ', '')
    if (u.includes('/auth/v1/user')) {
      return users[tok] ? { ok: true, json: async () => ({ id: users[tok].id }) } : { ok: false }
    }
    if (u.includes('/rest/v1/profiles')) {
      return { ok: true, json: async () => [{ role: users[tok].role, status: users[tok].status }] }
    }
    // vendor
    return { status: 200, ok: true, text: async () => JSON.stringify({ relayed: u }), headers: { get: () => 'application/json' } }
  }
  ;({ handler } = await import('../netlify/functions/gps-proxy.js'))
})

const okBody = { target_url: 'https://mvt.apmkingstrack.com/api', vendor_method: 'GET', company_id: '1' }
const call = (headers, body, method = 'POST') =>
  handler({ httpMethod: method, headers, body: body ? JSON.stringify(body) : '' })

test('rejects non-POST', async () => {
  assert.equal((await call({}, null, 'GET')).statusCode, 405)
})
test('401 without a token', async () => {
  assert.equal((await call({}, okBody)).statusCode, 401)
})
test('401 with an invalid token', async () => {
  assert.equal((await call({ authorization: 'Bearer nope' }, okBody)).statusCode, 401)
})
test('403 for a driver (not staff)', async () => {
  assert.equal((await call({ authorization: 'Bearer driver' }, okBody)).statusCode, 403)
})
test('403 for a deactivated staff profile', async () => {
  assert.equal((await call({ authorization: 'Bearer gone' }, okBody)).statusCode, 403)
})
test('200 relays for staff', async () => {
  const res = await call({ authorization: 'Bearer admin' }, okBody)
  assert.equal(res.statusCode, 200)
  assert.match(res.body, /mvt\.apmkingstrack\.com/)
})
test('400 blocks SSRF to a non-allow-listed host', async () => {
  const res = await call({ authorization: 'Bearer admin' }, { ...okBody, target_url: 'http://169.254.169.254/latest/meta-data' })
  assert.equal(res.statusCode, 400)
})
test('400 blocks unsupported vendor methods', async () => {
  const res = await call({ authorization: 'Bearer admin' }, { ...okBody, vendor_method: 'DELETE' })
  assert.equal(res.statusCode, 400)
})
test('413 on oversized bodies', async () => {
  const res = handler({ httpMethod: 'POST', headers: { authorization: 'Bearer admin' }, body: 'x'.repeat(9000) })
  assert.equal((await res).statusCode, 413)
})

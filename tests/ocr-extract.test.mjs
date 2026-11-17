// Contract tests for vercel/functions/ocr-extract.js
// Supabase auth + the OCR provider are mocked via global fetch; no network needed.
import { test, before } from 'node:test'
import assert from 'node:assert/strict'

process.env.SUPABASE_URL = 'https://example.supabase.co'
process.env.SUPABASE_ANON_KEY = 'anon-key'
process.env.OPENAI_API_KEY = 'test-openai-key'

const users = {
  admin:  { id: 'u1', role: 'admin',   status: 'active' },
  manager: { id: 'u4', role: 'manager', status: 'active' },
  driver: { id: 'u2', role: 'driver',  status: 'active' },
  gone:   { id: 'u3', role: 'manager', status: 'inactive' },
}

const extracted = {
  holderName: 'Ramanan',
  documentNumber: 'DL-1234',
  issueDate: '2026-01-01',
  expiryDate: '2028-01-01',
  vehicleNumber: 'PY01CY1255',
  docType: 'licence',
}

let handler
before(async () => {
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url)
    const tok = (opts.headers?.Authorization || '').replace('Bearer ', '')
    if (u.includes('/auth/v1/user')) {
      return users[tok] ? { ok: true, json: async () => ({ id: users[tok].id, email: `${tok}@travelsjayam.in`, role: users[tok].role }) } : { ok: false }
    }
    if (u.includes('/rest/v1/profiles')) {
      const profile = users[tok]
      return { ok: true, json: async () => (profile ? [{ role: profile.role, status: profile.status }] : []) }
    }
    if (u.includes('api.openai.com/v1/chat/completions')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: JSON.stringify(extracted) } }] }),
        text: async () => '',
      }
    }
    return { ok: false }
  }
  ;({ handler } = await import('../vercel/functions/ocr-extract.js'))
})

const okBody = { fileName: 'rc.pdf', mimeType: 'application/pdf', dataBase64: 'aGVsbG8=' }
const call = (headers, body, method = 'POST') =>
  handler({ httpMethod: method, headers, body: body ? JSON.stringify(body) : '' })

test('rejects non-POST', async () => {
  assert.equal((await call({}, okBody, 'GET')).statusCode, 405)
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

test('400 when the file payload is missing', async () => {
  const res = await call({ authorization: 'Bearer admin' }, { fileName: 'rc.pdf' })
  assert.equal(res.statusCode, 400)
})

test('200 returns extracted fields + confidence for staff', async () => {
  const res = await call({ authorization: 'Bearer admin' }, okBody)
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.ok, true)
  assert.equal(body.provider, 'openai')
  assert.equal(body.fields.holderName, 'Ramanan')
  assert.equal(body.fields.documentNumber, 'DL-1234')
  assert.equal(body.fields.expiryDate, '2028-01-01')
  assert.equal(body.fields.docType, 'licence')
  assert.equal(typeof body.confidence, 'number')
})

test('200 works for a manager too', async () => {
  const res = await call({ authorization: 'Bearer manager' }, okBody)
  assert.equal(res.statusCode, 200)
})

test('503 when the OCR provider is not configured', async () => {
  const unconfigured = await handler(
    { httpMethod: 'POST', headers: { authorization: 'Bearer admin' }, body: JSON.stringify(okBody) },
    {},
    { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon-key', OPENAI_API_KEY: '' },
  )
  assert.equal(unconfigured.statusCode, 503)
  const body = JSON.parse(unconfigured.body)
  assert.equal(body.ok, false)
})

test('503 when the OCR provider upstream fails', async () => {
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url)
    const tok = (opts.headers?.Authorization || '').replace('Bearer ', '')
    if (u.includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: 'u1', role: 'admin' }) }
    if (u.includes('/rest/v1/profiles')) return { ok: true, json: async () => [{ role: 'admin', status: 'active' }] }
    return { ok: false, status: 500, statusText: 'Internal Server Error', text: async () => 'upstream down' }
  }
  const res = await call({ authorization: 'Bearer admin' }, okBody)
  assert.equal(res.statusCode, 503)
  const body = JSON.parse(res.body)
  assert.equal(body.ok, false)
})

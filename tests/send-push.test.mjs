import test from 'node:test'
import assert from 'node:assert/strict'

import {
  corsHeaders,
  timingSafeEqual,
  verifyCaller,
} from '../supabase/functions/send-push/security.js'

function mockFetch({ role = 'admin', status = 'active', userOk = true } = {}) {
  return async (url, options = {}) => {
    if (String(url).includes('/auth/v1/user')) {
      return {
        ok: userOk,
        json: async () => (userOk ? { id: 'u-1' } : {}),
      }
    }
    if (String(url).includes('/rest/v1/profiles')) {
      assert.equal(options.headers?.Authorization, 'Bearer service-role')
      return { ok: true, json: async () => [{ role, status }] }
    }
    throw new Error(`unexpected fetch: ${url}`)
  }
}

const baseEnv = {
  SUPABASE_URL: 'https://project.supabase.co/',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
}

test('CORS reflects only allowlisted browser origins', () => {
  const allowed = corsHeaders('https://app.travelsjayam.in', {})
  assert.equal(allowed['Access-Control-Allow-Origin'], 'https://app.travelsjayam.in')
  assert.equal(allowed.Vary, 'Origin')
  assert.equal(corsHeaders('https://evil.example', {}), null)
  assert.equal(
    corsHeaders('https://app.travelsjayam.in', { PUSH_ALLOWED_ORIGINS: 'https://custom.example' }),
    null,
  )
  assert.equal(corsHeaders(null, {})['Access-Control-Allow-Origin'], undefined)
})

test('shared secret comparison is exact and length-safe', () => {
  assert.equal(timingSafeEqual('secret', 'secret'), true)
  assert.equal(timingSafeEqual('secret', 'secreT'), false)
  assert.equal(timingSafeEqual('secret', 'secret-extra'), false)
})

test('shared secret authenticates trusted server callers', async () => {
  const result = await verifyCaller({
    pushSecret: 'server-secret',
    env: { PUSH_FUNCTION_SECRET: 'server-secret' },
    fetchImpl: () => { throw new Error('should not call Supabase') },
  })
  assert.deepEqual(result, { ok: true })
})

test('missing or invalid user tokens are rejected', async () => {
  const missing = await verifyCaller({ env: baseEnv, fetchImpl: mockFetch() })
  assert.equal(missing.status, 401)

  const invalid = await verifyCaller({
    authorization: 'Bearer bad-token',
    env: baseEnv,
    fetchImpl: mockFetch({ userOk: false }),
  })
  assert.equal(invalid.status, 401)
})

test('only active admin/manager profiles may send pushes', async () => {
  const admin = await verifyCaller({
    authorization: 'Bearer user-token',
    env: baseEnv,
    fetchImpl: mockFetch({ role: 'admin' }),
  })
  assert.deepEqual(admin, { ok: true })

  const manager = await verifyCaller({
    authorization: 'Bearer user-token',
    env: baseEnv,
    fetchImpl: mockFetch({ role: 'manager' }),
  })
  assert.deepEqual(manager, { ok: true })

  const driver = await verifyCaller({
    authorization: 'Bearer user-token',
    env: baseEnv,
    fetchImpl: mockFetch({ role: 'driver' }),
  })
  assert.equal(driver.status, 403)

  const inactive = await verifyCaller({
    authorization: 'Bearer user-token',
    env: baseEnv,
    fetchImpl: mockFetch({ role: 'admin', status: 'inactive' }),
  })
  assert.equal(inactive.status, 403)
})

test('authentication failures fail closed when auth config is absent', async () => {
  const result = await verifyCaller({
    authorization: 'Bearer user-token',
    env: {},
    fetchImpl: mockFetch(),
  })
  assert.equal(result.status, 401)
})

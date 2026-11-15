// Remember me: the Supabase session token must live in localStorage when the
// box is ticked and in sessionStorage when it is not, and switching modes must
// not leave a stale token behind in the other store.
import test from 'node:test'
import assert from 'node:assert/strict'

import authStorage, { isRememberMe, setRememberMe } from '../src/lib/authStorage.js'

function makeStore() {
  const map = new Map()
  return {
    get length() { return map.size },
    key: i => [...map.keys()][i] ?? null,
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)) },
    removeItem: k => { map.delete(k) },
    keys: () => [...map.keys()],
  }
}

// authStorage resolves window at call time, so installing a fake window here
// is enough even though the module was imported above.
const local = makeStore()
const session = makeStore()
globalThis.window = { localStorage: local, sessionStorage: session }

const TOKEN = 'sb-test-project-auth-token'

test('remember me defaults to on', () => {
  assert.equal(isRememberMe(), true)
})

test('checked: token is written to and read from localStorage', () => {
  setRememberMe(true)
  authStorage.setItem(TOKEN, 'remembered-token')
  assert.equal(local.getItem(TOKEN), 'remembered-token')
  assert.equal(session.getItem(TOKEN), null)
  assert.equal(authStorage.getItem(TOKEN), 'remembered-token')
})

test('unchecked: token is written to and read from sessionStorage', () => {
  setRememberMe(false)
  assert.equal(isRememberMe(), false)
  authStorage.setItem(TOKEN, 'tab-token')
  assert.equal(session.getItem(TOKEN), 'tab-token')
  assert.equal(local.getItem(TOKEN), null)
  assert.equal(authStorage.getItem(TOKEN), 'tab-token')
})

test('switching modes drops tokens from the store no longer used', () => {
  // Move to localStorage: a leftover tab-only token must not survive.
  setRememberMe(true)
  authStorage.setItem(TOKEN, 'local-token')
  session.setItem(TOKEN, 'stale-tab-token')
  setRememberMe(true)
  assert.equal(session.getItem(TOKEN), null)
  assert.equal(authStorage.getItem(TOKEN), 'local-token')

  // Move to sessionStorage: a leftover local token must not resurrect.
  setRememberMe(false)
  authStorage.setItem(TOKEN, 'tab-token')
  local.setItem(TOKEN, 'stale-local-token')
  setRememberMe(false)
  assert.equal(local.getItem(TOKEN), null)
  assert.equal(authStorage.getItem(TOKEN), 'tab-token')
})

test('removeItem clears the token from both stores', () => {
  setRememberMe(true)
  authStorage.setItem(TOKEN, 'a')
  session.setItem(TOKEN, 'b')
  authStorage.removeItem(TOKEN)
  assert.equal(local.getItem(TOKEN), null)
  assert.equal(session.getItem(TOKEN), null)
})

test('a remembered choice survives a reload', () => {
  setRememberMe(false)
  assert.equal(isRememberMe(), false)
  // Value is a preference, not a credential: it stays in localStorage so the
  // checkbox comes back unticked even though the session did not persist.
  assert.equal(local.getItem('sjt.remember-me'), '0')
  setRememberMe(true)
  assert.equal(local.getItem('sjt.remember-me'), '1')
})

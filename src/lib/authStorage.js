// ─── Remember-me aware auth storage ───────────────────────────────────
// Supabase keeps the session token in a storage adapter. It defaults to
// localStorage, which survives a browser restart. When the user unticks
// "Remember me" the token is written to sessionStorage instead: it still
// survives a page reload, but the browser drops it when the tab closes.
//
// The choice is persisted under sjt.remember-me (not a credential), so the
// checkbox shows the same state on the next visit.

const REMEMBER_KEY = 'sjt.remember-me'
const AUTH_TOKEN_KEY = /-auth-token$/

function localStore() {
  try { return typeof window !== 'undefined' ? window.localStorage : null } catch { return null }
}

function sessionStore() {
  try { return typeof window !== 'undefined' ? window.sessionStorage : null } catch { return null }
}

export function isRememberMe() {
  const ls = localStore()
  if (!ls) return true
  try { return ls.getItem(REMEMBER_KEY) !== '0' } catch { return true }
}

function clearAuthKeys(store) {
  if (!store) return
  try {
    const stale = []
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i)
      if (key && AUTH_TOKEN_KEY.test(key)) stale.push(key)
    }
    stale.forEach(key => store.removeItem(key))
  } catch { /* storage can be unavailable in private mode */ }
}

/**
 * Persist the user's choice and drop tokens from the store that will no
 * longer be read, so an old session can never resurrect itself later.
 */
export function setRememberMe(remember) {
  const ls = localStore()
  try { ls?.setItem(REMEMBER_KEY, remember ? '1' : '0') } catch { /* ignore */ }

  if (remember) clearAuthKeys(sessionStore())
  else clearAuthKeys(ls)
}

const authStorage = {
  getItem(key) {
    const store = isRememberMe() ? localStore() : sessionStore()
    try { return store ? store.getItem(key) : null } catch { return null }
  },
  setItem(key, value) {
    const store = isRememberMe() ? localStore() : sessionStore()
    try { store?.setItem(key, value) } catch { /* ignore */ }
  },
  removeItem(key) {
    try { localStore()?.removeItem(key) } catch { /* ignore */ }
    try { sessionStore()?.removeItem(key) } catch { /* ignore */ }
  },
}

export default authStorage

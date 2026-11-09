// ─── Supabase JWT verification for serverless / dev middleware ─────────
// The GPS proxy relays requests to the vendor API on behalf of the browser.
// Without this check anyone on the internet could use our Netlify function
// as a free relay (and burn the vendor quota). We require a valid Supabase
// session AND an active staff profile (admin / manager) — the same roles
// that are allowed to open /fleet in the UI.

const STAFF_ROLES = ['admin', 'manager']

function supabaseConfig(env = process.env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY
  return { url: url ? url.replace(/\/+$/, '') : null, anonKey: anonKey || null }
}

export function extractBearer(headers = {}) {
  const raw = headers.authorization || headers.Authorization || ''
  const match = /^Bearer\s+(.+)$/i.exec(String(raw).trim())
  return match ? match[1] : null
}

/**
 * @returns {Promise<{ ok: true, user: { id, email, role } } | { ok: false, status: number, error: string }>}
 */
export async function verifySupabaseStaff(token, env = process.env) {
  const { url, anonKey } = supabaseConfig(env)
  if (!url || !anonKey) {
    return { ok: false, status: 500, error: 'GPS proxy is not configured (SUPABASE_URL / SUPABASE_ANON_KEY)' }
  }
  if (!token) return { ok: false, status: 401, error: 'Authentication required' }

  const headers = { apikey: anonKey, Authorization: `Bearer ${token}` }

  let userRes
  try {
    userRes = await fetch(`${url}/auth/v1/user`, { headers })
  } catch {
    return { ok: false, status: 502, error: 'Could not reach auth service' }
  }
  if (!userRes.ok) return { ok: false, status: 401, error: 'Invalid or expired session' }
  const user = await userRes.json()
  if (!user?.id) return { ok: false, status: 401, error: 'Invalid or expired session' }

  // RLS lets a user read their own profile row; this also proves the
  // profile exists and is active (app_role() semantics live in the DB).
  let profileRes
  try {
    profileRes = await fetch(
      `${url}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role,status&limit=1`,
      { headers: { ...headers, Accept: 'application/json' } }
    )
  } catch {
    return { ok: false, status: 502, error: 'Could not verify user role' }
  }
  const rows = profileRes.ok ? await profileRes.json() : []
  const profile = Array.isArray(rows) ? rows[0] : null
  if (!profile || (profile.status && profile.status !== 'active')) {
    return { ok: false, status: 403, error: 'Account is not active' }
  }
  if (!STAFF_ROLES.includes(profile.role)) {
    return { ok: false, status: 403, error: 'Fleet tracking is restricted to staff accounts' }
  }

  return { ok: true, user: { id: user.id, email: user.email, role: profile.role } }
}

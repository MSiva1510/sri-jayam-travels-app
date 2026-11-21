// Shared authorization/CORS helpers for the send-push Edge Function.
// Kept free of Deno globals so the same logic can be unit-tested under Node.

export const DEFAULT_ALLOWED_ORIGINS = [
  'https://app.travelsjayam.in',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]

const STAFF_ROLES = new Set(['admin', 'manager'])

export function normalizeOrigin(value) {
  try {
    return new URL(String(value).trim()).origin
  } catch {
    return null
  }
}

export function allowedOrigins(env = {}) {
  const configured = env.PUSH_ALLOWED_ORIGINS || env.APP_ORIGIN || ''
  const raw = configured
    ? configured.split(',').map(v => v.trim()).filter(Boolean)
    : DEFAULT_ALLOWED_ORIGINS
  const origins = raw
    .map(normalizeOrigin)
    .filter(v => !!v && v !== 'null')
  return [...new Set(origins)]
}

export function corsHeaders(origin = null, env = {}) {
  const headers = {
    'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
  if (!origin) return headers // non-browser callers
  if (!allowedOrigins(env).includes(origin)) return null
  headers['Access-Control-Allow-Origin'] = origin
  return headers
}

export function timingSafeEqual(expected, actual) {
  const enc = new TextEncoder()
  const a = enc.encode(String(expected))
  const b = enc.encode(String(actual))
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export function bearerToken(header = '') {
  const match = /^Bearer\s+(.+)$/i.exec(String(header).trim())
  return match ? match[1] : null
}

/**
 * Accepts either the optional server-to-server shared secret or a valid
 * Supabase JWT belonging to an active admin/manager profile.
 *
 * @param {{ authorization?: string|null, pushSecret?: string|null,
 *           fetchImpl?: typeof fetch, env?: Record<string, string|undefined> }} input
 */
export async function verifyCaller({
  authorization = null,
  pushSecret = null,
  fetchImpl = fetch,
  env = {},
} = {}) {
  const secret = env.PUSH_FUNCTION_SECRET
  if (secret && pushSecret && timingSafeEqual(secret, pushSecret)) return { ok: true }

  const token = bearerToken(authorization)
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY
  if (!token || !url || !anonKey) {
    return { ok: false, status: 401, error: 'unauthorized' }
  }

  const base = String(url).replace(/\/+$/, '')
  try {
    const userRes = await fetchImpl(`${base}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    })
    if (!userRes.ok) return { ok: false, status: 401, error: 'unauthorized' }
    const user = await userRes.json()
    const userId = user?.id
    if (!userId) return { ok: false, status: 401, error: 'unauthorized' }

    // Prefer the injected service-role key so the role check does not depend
    // on the caller's own profile SELECT policy.
    const profileKey = env.SUPABASE_SERVICE_ROLE_KEY || token
    const profileRes = await fetchImpl(
      `${base}/rest/v1/profiles?id=eq.${encodeURIComponent(String(userId))}&select=role,status&limit=1`,
      { headers: { Authorization: `Bearer ${profileKey}`, apikey: anonKey } },
    )
    if (!profileRes.ok) return { ok: false, status: 403, error: 'forbidden' }
    const profiles = await profileRes.json()
    const profile = Array.isArray(profiles) ? profiles[0] : null
    const role = String(profile?.role || '').toLowerCase()
    const status = String(profile?.status || '').toLowerCase()
    if (!profile || !STAFF_ROLES.has(role) || status !== 'active') {
      return { ok: false, status: 403, error: 'forbidden' }
    }
    return { ok: true }
  } catch {
    return { ok: false, status: 503, error: 'auth_unavailable' }
  }
}

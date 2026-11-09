// ─── Supabase REST with the service-role key (server only) ──────────────
// Bypasses RLS: only for Netlify functions that have already checked who
// is calling (Meta signature, staff session or the notify secret).

export function supabaseAdmin(env = process.env, fetchImpl = fetch) {
  const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null

  async function request(path, { method = 'GET', body, prefer } = {}) {
    const res = await fetchImpl(`${url}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(prefer ? { Prefer: prefer } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    if (!res.ok) {
      const err = new Error(`${method} ${path.split('?')[0]} → ${res.status} ${text.slice(0, 200)}`)
      err.status = res.status
      err.body = text
      throw err
    }
    return text ? JSON.parse(text) : null
  }

  return {
    select: path => request(path),
    insert: (table, rows, { prefer = 'return=representation', onConflict } = {}) =>
      request(onConflict ? `${table}?on_conflict=${onConflict}` : table, { method: 'POST', body: rows, prefer }),
    update: (path, patch) => request(path, { method: 'PATCH', body: patch, prefer: 'return=representation' }),
    rpc: (fn, args) => request(`rpc/${fn}`, { method: 'POST', body: args }),
  }
}

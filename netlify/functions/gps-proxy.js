import { extractBearer, verifySupabaseStaff } from './_lib/verifySupabaseUser.js'

const DEFAULT_ALLOWED_HOSTS = ['mvt.apmkingstrack.com', 'app.gpstrack.in']
const MAX_BODY_BYTES = 8 * 1024

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  }
}

function parseAllowedHosts() {
  const configured = process.env.GPS_PROXY_ALLOWED_HOSTS
  if (!configured) return DEFAULT_ALLOWED_HOSTS
  return configured.split(',').map(host => host.trim().toLowerCase()).filter(Boolean)
}

function isAllowedTarget(targetUrl) {
  try {
    const url = new URL(targetUrl)
    if (!['http:', 'https:'].includes(url.protocol)) return false
    return parseAllowedHosts().includes(url.hostname.toLowerCase())
  } catch {
    return false
  }
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  // ── Auth: only signed-in staff may relay through this function ──
  const auth = await verifySupabaseStaff(extractBearer(event.headers))
  if (!auth.ok) return json(auth.status, { error: auth.error })

  if ((event.body || '').length > MAX_BODY_BYTES) {
    return json(413, { error: 'Request body too large' })
  }

  let payload
  try {
    payload = JSON.parse(event.body || '{}')
  } catch {
    return json(400, { error: 'Invalid JSON body' })
  }

  const { target_url, vendor_method, ...vendorPayload } = payload
  if (!target_url || !isAllowedTarget(target_url)) {
    return json(400, { error: 'GPS target URL is not allowed' })
  }
  if (!['GET', 'POST'].includes(String(vendor_method || 'POST').toUpperCase())) {
    return json(400, { error: 'Unsupported vendor method' })
  }

  try {
    const method = String(vendor_method || 'POST').toUpperCase()
    const url = new URL(target_url)
    if (method === 'GET') {
      for (const [key, value] of Object.entries(vendorPayload)) {
        if (value == null || value === '') continue
        url.searchParams.set(key, value)
      }
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': method === 'GET' ? 'application/json' : 'application/x-www-form-urlencoded'
      },
      body: method === 'GET' ? undefined : new URLSearchParams(vendorPayload).toString(),
    })

    const text = await response.text()
    return {
      statusCode: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
        'Cache-Control': 'no-store',
      },
      body: text,
    }
  } catch (error) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ error: error?.message || 'GPS proxy request failed' }),
    }
  }
}

// ─── Vercel ⇄ Netlify function adapter ───────────────────────────────────
// The app's server code lives in `netlify/functions/*` and speaks the Netlify
// event/response shape:  handler({ httpMethod, headers, queryStringParameters,
// body }) → { statusCode, headers, body }.
//
// Vercel serves files under `api/` as functions with the Web-standard
// signature (`fetch(request) → Response`). This adapter converts one to the
// other so the SAME handler runs on either host — no duplicated business
// logic.
//
// The request body is read as raw bytes on purpose: the Meta webhook verifies
// `X-Hub-Signature-256` against the exact bytes Meta sent, so re-serialising
// parsed JSON would break signature checks.

/** @param {Request} request */
export async function toNetlifyEvent(request) {
  const url = new URL(request.url)

  const headers = {}
  request.headers.forEach((value, key) => { headers[key] = value })

  // Netlify passes `null` when there is no query string; keep that shape so
  // handlers that do `if (!query) ...` behave identically.
  let queryStringParameters = null
  if (url.search) {
    queryStringParameters = {}
    for (const [key, value] of url.searchParams) queryStringParameters[key] = value
  }

  const raw = Buffer.from(await request.arrayBuffer())

  return {
    httpMethod: request.method.toUpperCase(),
    headers,
    queryStringParameters,
    body: raw.toString('utf8'),
    isBase64Encoded: false,
  }
}

/** @param {{ statusCode?: number, headers?: Record<string, string>, body?: string, isBase64Encoded?: boolean }} result */
export function toWebResponse(result = {}) {
  const headers = new Headers()
  for (const [key, value] of Object.entries(result.headers ?? {})) {
    if (value == null) continue
    if (Array.isArray(value)) value.forEach(v => headers.append(key, String(v)))
    else headers.set(key, String(value))
  }

  const status = result.statusCode ?? 200
  const body = result.body ?? ''

  // 204/304 must not carry a body.
  if (status === 204 || status === 304) {
    return new Response(null, { status, headers })
  }

  if (result.isBase64Encoded) {
    return new Response(Buffer.from(body, 'base64'), { status, headers })
  }

  return new Response(body, { status, headers })
}

/**
 * Builds a Vercel Web-standard fetch handler from a Netlify-style handler.
 * @param {(event: any, context?: any) => Promise<any>} handler
 * @param {string} label  used in the 500 log line
 */
export function wrapNetlifyHandler(handler, label) {
  return {
    /** @param {Request} request */
    async fetch(request) {
      try {
        const event = await toNetlifyEvent(request)
        return toWebResponse(await handler(event))
      } catch (error) {
        console.error(`[${label}] unhandled:`, error?.message ?? error)
        return new Response(JSON.stringify({ error: 'Internal error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        })
      }
    },
  }
}

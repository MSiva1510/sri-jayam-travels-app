// ─── Snap to road (optional) ────────────────────────────────────
//
// Snaps a GPS fix to the nearest road via the OSRM `nearest` endpoint
// (public demo server, keyless — the same host family the route
// estimator already calls). Strictly display-side: only the live car
// markers use it, so vendor API quota is untouched.
//
// Results are cached by rounded coordinate; failures are remembered
// briefly so a down endpoint doesn't get hammered every poll.

const OSRM_NEAREST = 'https://router.project-osrm.org/nearest/v1/driving'
const TIMEOUT_MS = 6000
const MAX_CACHE = 500
const FAIL_QUIET_MS = 60_000

const cache = new Map()   // "lat,lng" @5dp -> { lat, lng }
const failAt = new Map()  // "lat,lng" @5dp -> timestamp of last failure
const inflight = new Map()

const keyOf = (lat, lng) => `${lat.toFixed(5)},${lng.toFixed(5)}`

// Number(null) === 0 and Number('') === 0 — treat missing values as
// absent, not zero.
const toNum = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v))

function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t))
}

export function clearSnapCache() {
  cache.clear()
  failAt.clear()
}

/**
 * Resolve { lat, lng } snapped to the nearest road, or null when the
 * point is invalid, off-network, or the lookup failed.
 */
export async function snapPoint(lat, lng) {
  const la = toNum(lat)
  const ln = toNum(lng)
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null
  const key = keyOf(la, ln)
  if (cache.has(key)) return cache.get(key)
  if (inflight.has(key)) return inflight.get(key)
  if (failAt.has(key) && Date.now() - failAt.get(key) < FAIL_QUIET_MS) return null

  const p = (async () => {
    try {
      const res = await fetchWithTimeout(
        `${OSRM_NEAREST}/${ln},${la}?number=1`,
        TIMEOUT_MS
      )
      if (!res.ok) return null
      const json = await res.json()
      const loc = json?.waypoints?.[0]?.location
      if (json?.code !== 'Ok' || !Array.isArray(loc)) return null
      const out = { lat: Number(loc[1]), lng: Number(loc[0]) }
      if (!Number.isFinite(out.lat) || !Number.isFinite(out.lng)) return null
      return out
    } catch {
      return null
    } finally {
      inflight.delete(key)
    }
  })()
  inflight.set(key, p)

  const out = await p
  if (out) {
    if (cache.size >= MAX_CACHE) cache.clear()
    cache.set(key, out)
  } else {
    failAt.set(key, Date.now())
  }
  return out
}

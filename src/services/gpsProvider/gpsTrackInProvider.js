// ─── GPSTrack.in Provider Adapter ─────────────────────────────
// Vendor: https://app.gpstrack.in
// Endpoint: GET /api/get_current_data?token=<api_token>&email=<api_email>
// Returns a JSON array, one object per device:
//   { latitude, longitude, speed, date (epoch ms), isoDate, odoDistance,
//     ignitionStatus 'ON'|'OFF', status, vehicleStatus 'PARKED'|'MOVING'|…,
//     address, regNo 'PY01VF1255', vehicleType, vehicleId, deviceId (IMEI),
//     expiryDate, onboardDate, fuelLitre, bearing, serverTime, … }
//
// Settings keys used: api_url, api_token, api_email, timeout, use_proxy.
// The request always goes through /api/gps-proxy in the browser so the
// token never appears in a cross-origin URL; the proxy appends the
// query parameters for GET vendor calls.

import { withTimeout } from '../../utils/withTimeout.js'
import supabase from '../../lib/supabase.js'

export const GPSTRACK_DEFAULT_URL = 'https://app.gpstrack.in/api/get_current_data'
const GPS_PROXY_PATH = '/api/gps-proxy'

const MOCK_VEHICLES = [
  { latitude: 11.8942, longitude: 79.8066, speed: 0,  date: Date.now(), ignitionStatus: 'OFF', vehicleStatus: 'PARKED', address: 'Kamaraj Nagar, Ariyankuppam', regNo: 'PY01VF1255', deviceId: '0867440061832671', odoDistance: 40361.0, bearing: 113 },
  { latitude: 11.8936, longitude: 79.8052, speed: 32, date: Date.now(), ignitionStatus: 'ON',  vehicleStatus: 'MOVING', address: '3rd Cross St, Ariyankuppam',  regNo: 'PY01DF1255', deviceId: '0869925072569047', odoDistance: 18599.3, bearing: 12 },
]

// Number(null) === 0 and Number('') === 0 — treat missing values as absent, not zero
const toNumber = (v, fb = 0) => {
  if (v === null || v === undefined || v === '') return fb
  const n = Number(v); return Number.isFinite(n) ? n : fb
}

/** Registration as the app stores it: uppercase, no spaces/dashes. */
export function normalizeRegistration(reg) {
  return String(reg ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

async function proxyAuthHeader() {
  if (!supabase) return {}
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function createGpsTrackInProvider(settings = {}) {
  const baseUrl  = settings.api_url || GPSTRACK_DEFAULT_URL
  const timeout  = Number(settings.timeout ?? 30) * 1000
  const isMock   = import.meta.env?.VITE_GPS_MOCK === 'true'
  const useProxy = settings.use_proxy !== false
  const creds    = () => ({ token: settings.api_token ?? '', email: settings.api_email ?? '' })

  function normalizeResponse(raw) {
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : []
    return list.map(v => {
      const lat = toNumber(v?.latitude, NaN)
      const lng = toNumber(v?.longitude, NaN)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

      // `date` is epoch ms; fall back to isoDate, then now
      const tsMs = toNumber(v.date, NaN)
      const ts   = Number.isFinite(tsMs) ? new Date(tsMs) : new Date(v.isoDate ?? Date.now())
      const validTs = Number.isFinite(ts.getTime()) ? ts : new Date()

      const vehicleStatus = String(v.vehicleStatus ?? v.status ?? '').trim().toLowerCase()
      const speed = toNumber(v.speed, 0)
      // Vendor vocabulary → the dashboard's moving/stopped/idle buckets
      const status = vehicleStatus === 'moving' || speed > 2 ? 'moving'
                   : vehicleStatus === 'idle'                ? 'idle'
                   : 'stopped'

      return {
        imei:         String(v.deviceId ?? '').trim(),
        registration: normalizeRegistration(v.regNo),
        lat,
        lng,
        address:      v.address ?? '',
        speed_kmh:    speed,
        ignition:     String(v.ignitionStatus ?? '').toUpperCase() === 'ON',
        // A fix newer than 10 minutes counts as GPS online
        gps_online:   Date.now() - validTs.getTime() < 10 * 60 * 1000,
        status,
        odometer:     toNumber(v.odoDistance, 0),
        bearing:      toNumber(v.bearing, 0),
        vehicle_type: v.vehicleType ?? '',
        timestamp:    validTs.toISOString(),
        _epoch:       Math.floor(validTs.getTime() / 60000) * 60000,
        _raw:         v,
      }
    }).filter(Boolean)
  }

  async function request(ms) {
    const { token, email } = creds()
    if (!token || !email) throw new Error('GPSTrack.in API token and account email are required')

    let res
    if (useProxy) {
      res = await withTimeout(fetch(GPS_PROXY_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await proxyAuthHeader()) },
        body: JSON.stringify({ target_url: baseUrl, vendor_method: 'GET', token, email }),
      }), ms, null)
    } else {
      const url = new URL(baseUrl)
      url.searchParams.set('token', token)
      url.searchParams.set('email', email)
      res = await withTimeout(fetch(url, { method: 'GET' }), ms, null)
    }
    return res
  }

  async function fetchFleet() {
    if (isMock) return { ok: true, mock: true, snapshots: normalizeResponse(MOCK_VEHICLES), raw: MOCK_VEHICLES }
    try {
      const res = await request(timeout)
      if (!res) return { ok: false, error: 'timeout', snapshots: [] }
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, snapshots: [] }
      const raw = await res.json().catch(() => null)
      if (!raw) return { ok: false, error: 'Invalid JSON', snapshots: [] }
      if (!Array.isArray(raw)) return { ok: false, error: raw?.message || raw?.error || 'Unexpected response', snapshots: [] }
      return { ok: true, raw, snapshots: normalizeResponse(raw) }
    } catch (err) {
      return { ok: false, error: err?.message ?? 'Network error', snapshots: [] }
    }
  }

  async function healthCheck() {
    if (isMock) return { ok: true, latencyMs: 1, mock: true }
    const t0 = performance.now()
    try {
      const res = await request(Math.min(timeout, 8000))
      const latencyMs = Math.round(performance.now() - t0)
      if (!res) return { ok: false, latencyMs, error: 'timeout' }
      if (!res.ok) return { ok: false, latencyMs, error: `HTTP ${res.status}` }
      const raw = await res.json().catch(() => null)
      if (!Array.isArray(raw)) return { ok: false, latencyMs, error: raw?.message || 'Unexpected response (check token/email)' }
      return { ok: true, latencyMs, devices: raw.length }
    } catch (err) {
      return { ok: false, latencyMs: Math.round(performance.now() - t0), error: err?.message ?? 'Network error' }
    }
  }

  return { name: 'gpstrack', fetchFleet, healthCheck, normalizeResponse }
}

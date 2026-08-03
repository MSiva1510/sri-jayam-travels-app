// ─── KingsTrack Provider Adapter ──────────────────────────────
// GPS: 'A' = Active/Valid fix, 'V' = Void/No fix
// Mock: VITE_GPS_MOCK=true bypasses network for dev/CI

import { withTimeout } from '../../utils/withTimeout'

const DEFAULT_URL = 'https://mvt.apmkingstrack.com/fleettracking/api/live/json'
const GPS_PROXY_PATH = '/api/gps-proxy'

const MOCK_VEHICLES = [
  { Vehicle: 'TN-32-AQ-1234', Latitude: 11.9416, Longitude: 79.8083, Address: 'Puducherry Bypass', Speed: 42, Timestamp: new Date().toISOString(), GPS: 'A', Ignition: 'ON',  Status: 'Moving',  Odometer: 54321.5, IMEI: '352093081234567' },
  { Vehicle: 'TN-32-BH-5678', Latitude: 11.9350, Longitude: 79.8290, Address: 'White Town',        Speed: 0,  Timestamp: new Date().toISOString(), GPS: 'A', Ignition: 'OFF', Status: 'Stopped', Odometer: 98765.0, IMEI: '352093085678901' },
  { Vehicle: 'TN-32-CR-9012', Latitude: 11.9600, Longitude: 79.8400, Address: 'Auroville Main Rd', Speed: 18, Timestamp: new Date().toISOString(), GPS: 'V', Ignition: 'ON',  Status: 'Idle',    Odometer: 12345.6, IMEI: '352093089012345' },
]

export function createKingsTrackProvider(settings = {}) {
  const baseUrl = settings.api_url || DEFAULT_URL
  const timeout = Number(settings.timeout ?? 30) * 1000
  const isMock  = import.meta.env.VITE_GPS_MOCK === 'true'
  const useProxy = settings.use_proxy !== false

  function normalizeResponse(raw) {
    const list = Array.isArray(raw) ? raw
                : Array.isArray(raw?.data) ? raw.data
                : Array.isArray(raw?.vehicles) ? raw.vehicles
                : []
    return list.map(v => {
      const lat = Number(v.Latitude ?? v.latitude)
      const lng = Number(v.Longitude ?? v.longitude)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
      const tsRaw = v.Timestamp ?? v.timestamp ?? new Date().toISOString()
      const ts    = new Date(tsRaw)
      const isoTs = Number.isFinite(ts.getTime()) ? ts.toISOString() : new Date().toISOString()
      return {
        imei:         v.IMEI ?? v.imei ?? v.DeviceIMEI ?? '',
        registration: v.Vehicle ?? v.registration ?? '',
        lat, lng,
        address:    v.Address  ?? v.address  ?? '',
        speed_kmh:  Number(v.Speed ?? v.speed ?? 0),
        ignition:   String(v.Ignition ?? '').toUpperCase() === 'ON',
        gps_online: String(v.GPS ?? v.gps ?? '').toUpperCase() === 'A',
        status:     (v.Status ?? v.status ?? '').toString().toLowerCase(),
        odometer:   Number(v.Odometer ?? v.odometer ?? 0),
        timestamp:  isoTs,
        _epoch:     Math.floor(ts.getTime() / 60000) * 60000,
        _raw:       v,   // per-vehicle raw for the gps_tracking.raw column
      }
    }).filter(Boolean)
  }

  async function fetchFleet() {
    if (isMock) return { ok: true, mock: true, snapshots: normalizeResponse(MOCK_VEHICLES), raw: MOCK_VEHICLES }
    try {
      const body = { company_id: settings.company_id ?? '', user_id: settings.user_id ?? '' }
      const res = await requestGps(baseUrl, body, timeout, useProxy)
      if (!res) return { ok: false, error: 'timeout', snapshots: [] }
      if (!res.ok) return { ok: false, error: await readErrorResponse(res), snapshots: [] }
      const raw = await res.json().catch(() => null)
      if (!raw) return { ok: false, error: 'Invalid JSON', snapshots: [] }
      return { ok: true, raw, snapshots: normalizeResponse(raw) }
    } catch (err) {
      return { ok: false, error: err?.message ?? 'Network error', snapshots: [] }
    }
  }

  async function healthCheck() {
    if (isMock) return { ok: true, latencyMs: 1, mock: true }
    const t0 = performance.now()
    try {
      const body = { company_id: settings.company_id ?? '', user_id: settings.user_id ?? '' }
      const res = await requestGps(baseUrl, body, Math.min(timeout, 5000), useProxy)
      const latencyMs = Math.round(performance.now() - t0)
      if (!res) return { ok: false, latencyMs, error: 'timeout' }
      if (!res.ok) return { ok: false, latencyMs, error: await readErrorResponse(res) }
      return { ok: true, latencyMs }
    } catch (err) {
      return { ok: false, latencyMs: Math.round(performance.now() - t0), error: err?.message ?? 'Network error' }
    }
  }

  return { name: 'kingstrack', fetchFleet, healthCheck, normalizeResponse }
}

async function requestGps(targetUrl, body, timeout, useProxy) {
  const method = String(body.api_method || 'POST').toUpperCase()
  const first = await sendGpsRequest(targetUrl, body, timeout, useProxy, method)
  if (first?.status !== 405 || method === 'GET') return first
  return sendGpsRequest(targetUrl, body, timeout, useProxy, 'GET')
}

function sendGpsRequest(targetUrl, body, timeout, useProxy, vendorMethod) {
  const requestBody = useProxy
    ? { target_url: targetUrl, vendor_method: vendorMethod, ...body }
    : body
  const url = useProxy
    ? GPS_PROXY_PATH
    : vendorMethod === 'GET'
      ? withQueryParams(targetUrl, body)
      : targetUrl

  return withTimeout(
    fetch(url, {
      method: useProxy ? 'POST' : vendorMethod,
      headers: { 'Content-Type': 'application/json' },
      body: vendorMethod === 'GET' && !useProxy ? undefined : JSON.stringify(requestBody),
    }),
    timeout,
    null
  )
}

function withQueryParams(targetUrl, body) {
  const url = new URL(targetUrl)
  for (const [key, value] of Object.entries(body)) {
    if (value == null || value === '') continue
    url.searchParams.set(key, value)
  }
  return url.toString()
}

async function readErrorResponse(res) {
  const fallback = `HTTP ${res?.status ?? 'error'}`
  try {
    const text = await res.text()
    if (!text) return fallback
    try {
      const json = JSON.parse(text)
      return json.error || json.message || json.status || fallback
    } catch {
      return text.length > 160 ? `${text.slice(0, 157)}...` : text
    }
  } catch {
    return fallback
  }
}

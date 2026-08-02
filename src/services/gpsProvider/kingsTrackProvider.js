// ─── KingsTrack Provider Adapter ──────────────────────────────
//
// Vendor: https://apmkingstrack.com
// Endpoint: https://mvt.apmkingstrack.com/fleettracking/api/live/json
// Request:  POST { company_id, user_id }  → returns array of
//           { Vehicle, Latitude, Longitude, Address, Speed,
//             Timestamp, GPS, Ignition, Status, Odometer }
//
// Mock mode: set VITE_GPS_MOCK=true to skip the network call in
// dev / CI and return 3 representative vehicles instead.

import { withTimeout } from '../../utils/withTimeout'

const DEFAULT_URL = 'https://mvt.apmkingstrack.com/fleettracking/api/live/json'

// ── Mock data for dev / CI ─────────────────────────────────────
const MOCK_VEHICLES = [
  {
    Vehicle: 'TN-32-AQ-1234', Latitude: 11.9416, Longitude: 79.8083,
    Address: 'Puducherry Bypass',  Speed: 42, Timestamp: new Date().toISOString(),
    GPS: 'A', Ignition: 'ON',  Status: 'Moving', Odometer: 54321.5,
  },
  {
    Vehicle: 'TN-32-BH-5678', Latitude: 11.9350, Longitude: 79.8290,
    Address: 'White Town',        Speed: 0,  Timestamp: new Date().toISOString(),
    GPS: 'A', Ignition: 'OFF', Status: 'Stopped', Odometer: 98765.0,
  },
  {
    Vehicle: 'TN-32-CR-9012', Latitude: 11.9600, Longitude: 79.8400,
    Address: 'Auroville Main Rd', Speed: 18, Timestamp: new Date().toISOString(),
    GPS: 'V', Ignition: 'ON',  Status: 'Idle', Odometer: 12345.6,
  },
]

/**
 * @param {object} settings  gps_settings row from DB:
 *   { api_url, company_id, user_id, timeout (sec), retry_count }
 */
export function createKingsTrackProvider(settings = {}) {
  const baseUrl  = settings.api_url || DEFAULT_URL
  const timeout  = Number(settings.timeout ?? 30) * 1000
  const isMock   = import.meta.env.VITE_GPS_MOCK === 'true'

  function normalizeResponse(raw) {
    const list = Array.isArray(raw) ? raw
                : Array.isArray(raw?.data) ? raw.data
                : Array.isArray(raw?.vehicles) ? raw.vehicles
                : []
    return list
      .map(v => {
        const lat = Number(v.Latitude ?? v.latitude)
        const lng = Number(v.Longitude ?? v.longitude)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
        const tsRaw = v.Timestamp ?? v.timestamp ?? new Date().toISOString()
        const ts = new Date(tsRaw)
        const isoTs = Number.isFinite(ts.getTime()) ? ts.toISOString() : new Date().toISOString()
        return {
          imei:         v.IMEI ?? v.imei ?? v.DeviceIMEI ?? '',
          registration: v.Vehicle ?? v.registration ?? '',
          lat, lng,
          address:   v.Address ?? v.address ?? '',
          speed_kmh: Number(v.Speed ?? v.speed ?? 0),
          ignition:  String(v.Ignition ?? '').toUpperCase() === 'ON',
          status:    (v.Status ?? v.status ?? '').toString().toLowerCase(),
          odometer:  Number(v.Odometer ?? v.odometer ?? 0),
          timestamp: isoTs,
          _epoch:    Math.floor(ts.getTime() / 60000) * 60000,
        }
      })
      .filter(Boolean)
  }

  async function fetchFleet() {
    if (isMock) {
      return { ok: true, mock: true, snapshots: normalizeResponse(MOCK_VEHICLES), raw: MOCK_VEHICLES }
    }
    try {
      const res = await withTimeout(
        fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company_id: settings.company_id ?? '',
            user_id:    settings.user_id    ?? '',
          }),
        }),
        timeout,
        null
      )
      if (!res || !res.ok) {
        return { ok: false, error: `HTTP ${res?.status ?? 'timeout'}`, snapshots: [] }
      }
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
      const res = await withTimeout(
        fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company_id: settings.company_id ?? '',
            user_id:    settings.user_id    ?? '',
            healthcheck: true,
          }),
        }),
        Math.min(timeout, 5000),
        null
      )
      const latencyMs = Math.round(performance.now() - t0)
      if (!res) return { ok: false, latencyMs, error: 'timeout' }
      return { ok: res.ok, latencyMs }
    } catch (err) {
      const latencyMs = Math.round(performance.now() - t0)
      return { ok: false, latencyMs, error: err?.message ?? 'Network error' }
    }
  }

  return {
    name: 'kingstrack',
    fetchFleet,
    healthCheck,
    normalizeResponse,
  }
}
// ─── GPS Sync Service ─────────────────────────────────────────
// Module-singleton: polls GpsProvider → dedup → gps_tracking → status tables.
// Pages never call provider methods directly.

import { createGpsProvider }    from './gpsProvider'

const normalizeReg = (r) => String(r ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
import { gpsHistoryRepository } from '../repositories/gpsHistoryRepository'
import { gpsSettingsRepository } from '../repositories/gpsSettingsRepository'
import { vehicleRepository }    from '../repositories/vehicleRepository'
import { fleetAlertRepository } from '../repositories/fleetAlertRepository'
import { geofenceService }      from '../services/geofenceService'
import { loadVehicles }         from '../data/vehicleData'
import { addAuditEvent }        from '../data/auditLogData'
import supabase                 from '../lib/supabase'

const state = {
  running: false, intervalId: null, intervalMs: 60_000,
  retryAttempt: 0, backoffMs: 0, retryTimer: null,
  syncing: false, lastAttemptAt: 0,
  vehicleIndex: {}, imeiIndex: {},
  provider: null, providerName: null,
  health: {
    ok: null, lastPoll: null, lastSuccess: null, lastError: null,
    responseTimeMs: 0, mock: false, consecutiveFailures: 0, lastVehicleCount: 0,
    providerRows: 0, matchedCount: 0, unmatchedRegs: [],
  },
  subscribers: new Set(), visibilityHandler: null,
}

function emit() {
  for (const fn of state.subscribers) {
    try { fn({ health: { ...state.health }, running: state.running }) } catch {}
  }
}

async function _ensureIndexes() {
  if (!Object.keys(state.vehicleIndex).length) {
    const list = await loadVehicles()
    const regIdx = {}, imeiIdx = {}
    for (const v of list ?? []) {
      if (v.registration) {
        regIdx[v.registration] = v.id
        // vendors send "PY01DF1255"; the fleet may be stored as "PY 01 DF 1255" / "PY-01-DF-1255"
        regIdx[normalizeReg(v.registration)] = v.id
      }
      if (v.imei) imeiIdx[String(v.imei).trim()] = v.id
    }
    state.vehicleIndex = regIdx
    state.imeiIndex    = imeiIdx
  }
}

function _resetIndexes() {
  state.vehicleIndex = {}
  state.imeiIndex = {}
}

async function _syncNow(opts = {}) {
  // Coalesce overlapping triggers (StrictMode double-mount, manual +
  // interval racing) — the vendor rate-limits aggressively.
  if (state.syncing) return { ok: false, error: 'sync-in-progress' }
  // Auto polls never fire inside the vendor's minimum gap; manual syncs
  // (Retry buttons) always attempt — the result lands in health either way.
  if (opts.throttle && Date.now() - (state.lastAttemptAt || 0) < VENDOR_MIN_GAP_MS) {
    return { ok: false, error: 'too-soon' }
  }
  state.syncing = true
  state.lastAttemptAt = Date.now()
  try {
    return await _syncNowInner()
  } finally {
    state.syncing = false
  }
}

async function _syncNowInner() {
  if (!state.provider) return
  const t0 = performance.now()
  state.health.lastPoll = new Date().toISOString()
  const { ok, snapshots, error, mock } = await state.provider.fetchFleet()
  state.health.responseTimeMs = Math.round(performance.now() - t0)

  if (!ok) {
    state.health.ok = false; state.health.lastError = error || 'fetch failed'
    state.health.consecutiveFailures += 1
    _applyBackoff(parseRetryAfterMs(error)); _auditFailure(error); emit(); return
  }

  state.health.mock = !!mock; state.health.ok = true
  state.health.lastSuccess = new Date().toISOString()
  state.health.lastError = null; state.health.consecutiveFailures = 0
  state.health.nextRetryAt = null
  state.retryAttempt = 0; state.backoffMs = 0

  state.health.providerRows = snapshots?.length ?? 0
  if (!snapshots?.length) {
    state.health.lastVehicleCount = 0; state.health.matchedCount = 0
    state.health.unmatchedRegs = []; emit(); return
  }

  await _ensureIndexes()
  const matchId = (s) =>
    state.vehicleIndex[s.registration]
    ?? state.vehicleIndex[normalizeReg(s.registration)]
    ?? (s.imei ? state.imeiIndex[String(s.imei).trim()] : null)
    ?? null
  // Provider rows that match no fleet vehicle (wrong reg/IMEI on either
  // side, or a device outside this fleet) are recorded for diagnostics
  // instead of silently vanishing.
  state.health.unmatchedRegs = snapshots
    .filter(s => !matchId(s))
    .map(s => s.registration || (s.imei ? `IMEI ${s.imei}` : 'unknown'))
    .slice(0, 10)
  const rows = snapshots.map(s => ({
    ...s,
    // Downstream consumers (geofence, alerts, status tables) read
    // latitude/longitude — provider snapshots carry lat/lng.
    latitude:  Number.isFinite(s.latitude) ? s.latitude : s.lat,
    longitude: Number.isFinite(s.longitude) ? s.longitude : s.lng,
    vehicle_id: matchId(s),
    timestamp:  new Date(s._epoch ?? Date.parse(s.timestamp) ?? Date.now()).toISOString(),
    raw:        s._raw ?? {},
  })).filter(s => s.vehicle_id)
  state.health.matchedCount = rows.length

  const write = await gpsHistoryRepository.insertBatch(rows).catch(() => ({ inserted: 0, skipped: rows.length }))
  state.health.lastVehicleCount = rows.length
  state.health.lastWrite = {
    inserted: write?.inserted ?? 0,
    skipped: write?.skipped ?? 0,
    at: new Date().toISOString(),
  }

  // Detect and create geofence events from GPS data
  await geofenceService.detectAndGenerateEvents(rows)

  // Detect and create alerts from GPS data
  await _detectAndCreateAlerts(rows)

  await _updateStatuses(rows); emit()
  return { count: rows.length }
}

async function _updateStatuses(rows) {
  const ts = new Date().toISOString()
  for (const row of rows) {
    try {
      await supabase.from('vehicle_status').upsert(
        { vehicle_id: row.vehicle_id, last_gps_at: ts, last_lat: row.lat, last_lng: row.lng, updated_at: ts },
        { onConflict: 'vehicle_id' }
      )
    } catch {}
    if (row.driver_id) {
      try {
        await supabase.from('driver_status').upsert(
          { driver_id: row.driver_id, latitude: row.lat, longitude: row.lng, speed_kmh: row.speed_kmh, last_heartbeat: ts, updated_at: ts },
          { onConflict: 'driver_id' }
        )
      } catch {}
    }
  }
}

// Vendor rate limit ("one API request every 30 seconds") — never fire
// auto polls closer together, no matter the configured interval.
const VENDOR_MIN_GAP_MS = 30_000

// Parse "Please try after 07:11:39 PM" style retry hints into ms.
function parseRetryAfterMs(msg) {
  const m = String(msg || '').match(/try after\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)/i)
  if (!m) return 0
  let h = Number(m[1]) % 12 + (m[4].toUpperCase() === 'PM' ? 12 : 0)
  const t = new Date()
  t.setHours(h, Number(m[2]), Number(m[3] || 0), 0)
  let ms = t.getTime() - Date.now()
  if (ms < 0) ms += 86400000
  return ms + 2000 // small buffer past the vendor's clock
}

function _applyBackoff(extraMs = 0) {
  state.retryAttempt = Math.min(state.retryAttempt + 1, 6)
  state.backoffMs = Math.max(
    Math.min(1000 * 2 ** (state.retryAttempt - 1), 30_000),
    Math.min(extraMs, 300_000)
  )
  // The interval guard skips while backoffMs is set — without an explicit
  // retry the poller would stall forever after a single failure.
  if (state.running && !state.retryTimer) {
    state.health.nextRetryAt = new Date(Date.now() + state.backoffMs).toISOString()
    state.retryTimer = setTimeout(() => {
      state.retryTimer = null
      state.backoffMs = 0
      state.health.nextRetryAt = null
      _syncNow()
    }, state.backoffMs)
  }
}

function _auditFailure(error) {
  if (state.health.consecutiveFailures !== 2) return
  addAuditEvent('SETTINGS_UPDATED', {
    description: `GPS sync failing (${state.health.consecutiveFailures}×): ${error}`,
    module: 'security', severity: 'error',
  })
}

// ── Alert Detection ──────────────────────────────────────
async function _detectAndCreateAlerts(rows) {
  const settings = await gpsSettingsRepository.getAsObject()
  if (!settings.enabled) return []

  const alerts = []

  for (const row of rows) {
    // Skip if no vehicle_id
    if (!row.vehicle_id) continue

    // Get vehicle info for context
    const vehicle = await vehicleRepository.getById(row.vehicle_id)
    if (!vehicle) continue

    // Get driver info if available
    let driver = null
    if (row.driver_id) {
      // We'd need to import driverRepository, but for now we'll skip
      // In a real implementation, we'd fetch the driver info
    }

    // 1. Overspeed detection
    if (settings.overspeed_limit && row.speed_kmh && row.speed_kmh > settings.overspeed_limit) {
      alerts.push({
        vehicle_id: row.vehicle_id,
        driver_id: row.driver_id || null,
        alert_type: 'overspeed',
        priority: row.speed_kmh > (settings.overspeed_limit * 1.5) ? 'critical' : 'high',
        title: `Overspeed Detected: ${vehicle.registration || 'Unknown'}`,
        description: `Vehicle exceeded speed limit of ${settings.overspeed_limit} km/h`,
        location: {
          latitude: row.latitude,
          longitude: row.longitude,
          accuracy: row.accuracy
        },
        speed_kmh: row.speed_kmh,
        detected_at: row.timestamp
      })
    }

    // 2. Vehicle offline detection (no GPS data for a while)
    // This would typically be handled by checking last seen time vs current time
    // For now, we'll rely on the status field from GPS data
    if (row.status === 'offline') {
      alerts.push({
        vehicle_id: row.vehicle_id,
        driver_id: row.driver_id || null,
        alert_type: 'vehicle_offline',
        priority: 'high',
        title: `Vehicle Offline: ${vehicle.registration || 'Unknown'}`,
        description: `Vehicle has not reported GPS data for more than ${settings.offline_timeout || 5} minutes`,
        location: {
          latitude: row.latitude,
          longitude: row.longitude,
          accuracy: row.accuracy
        },
        detected_at: row.timestamp
      })
    }

    // 3. GPS offline detection
    if (!row.gps_online && row.gps_online !== null) {
      alerts.push({
        vehicle_id: row.vehicle_id,
        driver_id: row.driver_id || null,
        alert_type: 'gps_offline',
        priority: 'high',
        title: `GPS Signal Lost: ${vehicle.registration || 'Unknown'}`,
        description: `GPS module appears to be offline or malfunctioning`,
        location: {
          latitude: row.latitude,
          longitude: row.longitude,
          accuracy: row.accuracy
        },
        detected_at: row.timestamp
      })
    }

    // 4. Ignition ON detection
    if (row.ignition === true) {
      // Check if we had previously recorded ignition OFF for this vehicle
      // This would require storing previous state, which we'll simplify for now
      alerts.push({
        vehicle_id: row.vehicle_id,
        driver_id: row.driver_id || null,
        alert_type: 'ignition_on',
        priority: 'information',
        title: `Ignition ON: ${vehicle.registration || 'Unknown'}`,
        description: `Vehicle ignition turned on`,
        location: {
          latitude: row.latitude,
          longitude: row.longitude,
          accuracy: row.accuracy
        },
        detected_at: row.timestamp
      })
    }

    // 5. Ignition OFF detection
    if (row.ignition === false) {
      alerts.push({
        vehicle_id: row.vehicle_id,
        driver_id: row.driver_id || null,
        alert_type: 'ignition_off',
        priority: 'information',
        title: `Ignition OFF: ${vehicle.registration || 'Unknown'}`,
        description: `Vehicle ignition turned off`,
        location: {
          latitude: row.latitude,
          longitude: row.longitude,
          accuracy: row.accuracy
        },
        detected_at: row.timestamp
      })
    }

    // 6. Long idle detection
    // This would require tracking time spent with speed = 0 and ignition = on
    // For simplicity, we'll implement a basic version
    if (row.speed_kmh === 0 && row.ignition === true) {
      // In a real implementation, we'd track how long the vehicle has been idle
      // For now, we'll skip this complex logic
    }
  }

  // Create alerts in batch
  const createdAlerts = []
  for (const alertData of alerts) {
    try {
      const alert = await fleetAlertRepository.create(alertData)
      createdAlerts.push(alert)
    } catch (error) {
      console.error('Failed to create alert:', error)
    }
  }

  return createdAlerts
}

async function _bootstrapProvider() {
  const settings = await gpsSettingsRepository.getAsObject()
  if (!settings.enabled) { state.provider = null; state.providerName = settings.provider; return null }
  state.providerName = settings.provider
  state.provider     = createGpsProvider(settings.provider, settings)
  state.intervalMs   = Math.max(5_000, Number(settings.refresh_interval ?? 60) * 1000)

  // Initialize geofence service when GPS provider is initialized
  try {
    await geofenceService.initialize()
  } catch (error) {
    console.warn('Failed to initialize geofence service:', error)
  }

  return state.provider
}

async function start() {
  if (state.running) return
  await _bootstrapProvider()
  if (!state.provider) { state.health.ok = false; state.health.lastError = 'GPS sync disabled or provider unconfigured'; emit(); return }
  state.running = true; _installVisibilityHandler(); _syncNow()
  state.intervalId = setInterval(() => { if (!state.backoffMs) _syncNow({ throttle: true }) }, state.intervalMs)
  emit()
}

function stop() {
  if (state.intervalId) clearInterval(state.intervalId)
  if (state.retryTimer) clearTimeout(state.retryTimer)
  state.intervalId = null; state.retryTimer = null; state.running = false
  state.backoffMs = 0; state.retryAttempt = 0
  _uninstallVisibilityHandler(); _resetIndexes(); emit()
}

function rateLimitedMs() {
  if (state.backoffMs) return state.backoffMs
  const t = state.health.nextRetryAt ? new Date(state.health.nextRetryAt).getTime() : 0
  return Number.isFinite(t) ? Math.max(0, t - Date.now()) : 0
}

async function syncNow() {
  if (!state.provider) await _bootstrapProvider()
  // Manual retries obey the vendor ban too — firing into a rate limit
  // only slides the ban window further out.
  const wait = rateLimitedMs()
  if (wait > 0) return { ok: false, error: 'rate-limited', retryInMs: wait }
  return _syncNow()
}

async function healthCheck() {
  if (!state.provider) await _bootstrapProvider()
  if (!state.provider) return { ok: false, error: 'Provider not configured' }
  return state.provider.healthCheck()
}

function subscribe(fn) {
  state.subscribers.add(fn)
  fn({ health: { ...state.health }, running: state.running })
  return () => state.subscribers.delete(fn)
}

function getHealth()       { return { ...state.health } }
function getProviderName() { return state.providerName }

function _installVisibilityHandler() {
  if (state.visibilityHandler) return
  const onVis = () => {
    if (document.hidden) { if (state.intervalId) { clearInterval(state.intervalId); state.intervalId = null } }
    else if (state.running && !state.intervalId) {
      _syncNow({ throttle: true })
      state.intervalId = setInterval(() => { if (!state.backoffMs) _syncNow({ throttle: true }) }, state.intervalMs)
    }
  }
  document.addEventListener('visibilitychange', onVis); state.visibilityHandler = onVis
}

function _uninstallVisibilityHandler() {
  if (!state.visibilityHandler) return
  document.removeEventListener('visibilitychange', state.visibilityHandler)
  state.visibilityHandler = null
}

export const gpsSyncService = { start, stop, syncNow, healthCheck, subscribe, getHealth, getProviderName, rateLimitedMs }

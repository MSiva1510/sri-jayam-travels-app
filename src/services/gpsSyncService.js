// ─── GPS Sync Service ─────────────────────────────────────────
// Module-singleton: polls GpsProvider → dedup → gps_tracking → status tables.
// Pages never call provider methods directly.

import { createGpsProvider }    from './gpsProvider'
import { gpsHistoryRepository } from '../repositories/gpsHistoryRepository'
import { gpsSettingsRepository } from '../repositories/gpsSettingsRepository'
import { vehicleRepository }    from '../repositories/vehicleRepository'
import { withCache, cacheClear } from '../utils/dataCache'
import { addAuditEvent }        from '../data/auditLogData'
import supabase                 from '../lib/supabase'

const state = {
  running: false, intervalId: null, intervalMs: 60_000,
  retryAttempt: 0, backoffMs: 0,
  vehicleIndex: {}, imeiIndex: {},
  provider: null, providerName: null,
  health: {
    ok: null, lastPoll: null, lastSuccess: null, lastError: null,
    responseTimeMs: 0, mock: false, consecutiveFailures: 0, lastVehicleCount: 0,
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
    const list = await withCache('vehicles_for_gps', () => vehicleRepository.getAll())()
    const regIdx = {}, imeiIdx = {}
    for (const v of list ?? []) {
      if (v.registration) regIdx[v.registration] = v.id
      if (v.imei)         imeiIdx[v.imei]        = v.id
    }
    state.vehicleIndex = regIdx
    state.imeiIndex    = imeiIdx
  }
}

function _resetIndexes() {
  state.vehicleIndex = {}; state.imeiIndex = {}
  cacheClear('vehicles_for_gps')
}

async function _syncNow() {
  if (!state.provider) return
  const t0 = performance.now()
  state.health.lastPoll = new Date().toISOString()
  const { ok, snapshots, error, mock } = await state.provider.fetchFleet()
  state.health.responseTimeMs = Math.round(performance.now() - t0)

  if (!ok) {
    state.health.ok = false; state.health.lastError = error || 'fetch failed'
    state.health.consecutiveFailures += 1
    _applyBackoff(); _auditFailure(error); emit(); return
  }

  state.health.mock = !!mock; state.health.ok = true
  state.health.lastSuccess = new Date().toISOString()
  state.health.lastError = null; state.health.consecutiveFailures = 0
  state.retryAttempt = 0; state.backoffMs = 0

  if (!snapshots?.length) { state.health.lastVehicleCount = 0; emit(); return }

  await _ensureIndexes()
  const rows = snapshots.map(s => ({
    ...s,
    vehicle_id: state.vehicleIndex[s.registration] ?? state.imeiIndex[s.imei] ?? null,
    timestamp:  new Date(s._epoch ?? Date.parse(s.timestamp) ?? Date.now()).toISOString(),
    raw:        s._raw ?? {},
  })).filter(s => s.vehicle_id)

  await gpsHistoryRepository.insertBatch(rows)
  state.health.lastVehicleCount = rows.length
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

function _applyBackoff() {
  state.retryAttempt = Math.min(state.retryAttempt + 1, 6)
  state.backoffMs = Math.min(1000 * 2 ** (state.retryAttempt - 1), 30_000)
}

function _auditFailure(error) {
  if (state.health.consecutiveFailures !== 2) return
  addAuditEvent('SETTINGS_UPDATED', {
    description: `GPS sync failing (${state.health.consecutiveFailures}×): ${error}`,
    module: 'security', severity: 'error',
  })
}

async function _bootstrapProvider() {
  const settings = await gpsSettingsRepository.getAsObject()
  if (!settings.enabled) { state.provider = null; state.providerName = settings.provider; return null }
  state.providerName = settings.provider
  state.provider     = createGpsProvider(settings.provider, settings)
  state.intervalMs   = Math.max(5_000, Number(settings.refresh_interval ?? 60) * 1000)
  return state.provider
}

async function start() {
  if (state.running) return
  await _bootstrapProvider()
  if (!state.provider) { state.health.ok = false; state.health.lastError = 'GPS sync disabled or provider unconfigured'; emit(); return }
  state.running = true; _installVisibilityHandler(); _syncNow()
  state.intervalId = setInterval(() => { if (!state.backoffMs) _syncNow() }, state.intervalMs)
  emit()
}

function stop() {
  if (state.intervalId) clearInterval(state.intervalId)
  state.intervalId = null; state.running = false
  _uninstallVisibilityHandler(); _resetIndexes(); emit()
}

async function syncNow() {
  if (!state.provider) await _bootstrapProvider()
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
      _syncNow()
      state.intervalId = setInterval(() => { if (!state.backoffMs) _syncNow() }, state.intervalMs)
    }
  }
  document.addEventListener('visibilitychange', onVis); state.visibilityHandler = onVis
}

function _uninstallVisibilityHandler() {
  if (!state.visibilityHandler) return
  document.removeEventListener('visibilitychange', state.visibilityHandler)
  state.visibilityHandler = null
}

export const gpsSyncService = { start, stop, syncNow, healthCheck, subscribe, getHealth, getProviderName }

// ─── GPS Sync Service ─────────────────────────────────────────
//
// Module-singleton orchestrator that pulls fleet snapshots from a
// swappable GpsProvider on a configurable interval, dedups against
// the gps_tracking UNIQUE INDEX, and writes only GPS-related
// fields back to vehicle_status / driver_status (never the
// booking-lifecycle `status` column).
//
// Pages never call provider methods directly — they go through
// GpsHistoryContext → this service → provider.

import { createGpsProvider } from './gpsProvider'
import { gpsHistoryRepository } from '../repositories/gpsHistoryRepository'
import { gpsSettingsRepository } from '../repositories/gpsSettingsRepository'
import { vehicleRepository }     from '../repositories/vehicleRepository'
import { withCache, cacheClear } from '../utils/dataCache'
import { addAuditEvent }         from '../data/auditLogData'
import supabase                  from '../lib/supabase'

// ── State (module-singleton) ──────────────────────────────────
const state = {
  running:        false,
  intervalId:     null,
  intervalMs:     60_000,
  retryAttempt:   0,
  backoffMs:      0,
  vehicleIndex:   {},            // registration → uuid
  provider:       null,
  providerName:   null,
  health: {
    ok:            null,         // null = never run
    lastPoll:      null,
    lastSuccess:   null,
    lastError:     null,
    responseTimeMs: 0,
    mock:          false,
    consecutiveFailures: 0,
    lastVehicleCount: 0,
  },
  subscribers:    new Set(),
  visibilityHandler: null,
}

const subscribers = () => state.subscribers
function emit() {
  for (const fn of subscribers()) {
    try { fn({ health: { ...state.health }, running: state.running }) }
    catch (err) { console.warn('[gpsSync] subscriber threw:', err) }
  }
}

// ── Vehicle / driver indexes ──────────────────────────────────
async function _ensureIndexes() {
  if (!Object.keys(state.vehicleIndex).length) {
    const list = await withCache('vehicles_for_gps', () => vehicleRepository.getAll())()
    const idx  = {}
    for (const v of list ?? []) {
      const reg = v.registration ?? v.vehicle_id
      if (reg) idx[reg] = v.id
    }
    state.vehicleIndex = idx
  }
}

function _resetIndexes() {
  state.vehicleIndex = {}
  cacheClear('vehicles_for_gps')
}

// ── Sync logic ────────────────────────────────────────────────
async function _syncNow() {
  if (!state.provider) return
  const t0 = performance.now()
  state.health.lastPoll = new Date().toISOString()
  const { ok, raw, snapshots, error, mock } = await state.provider.fetchFleet()
  const elapsed = Math.round(performance.now() - t0)
  state.health.responseTimeMs = elapsed

  if (!ok) {
    state.health.ok = false
    state.health.lastError = error || 'fetch failed'
    state.health.consecutiveFailures += 1
    _applyBackoff()
    _auditFailure(error)
    emit()
    return
  }

  state.health.mock = !!mock
  state.health.ok = true
  state.health.lastSuccess = new Date().toISOString()
  state.health.lastError = null
  state.health.consecutiveFailures = 0
  state.retryAttempt = 0
  state.backoffMs = 0

  if (!snapshots?.length) {
    state.health.lastVehicleCount = 0
    emit()
    return
  }

  await _ensureIndexes()
  const rows = snapshots
    .map(s => {
      const vehicleId = state.vehicleIndex[s.registration]
                ?? state.vehicleIndex[s.imei]
                ?? null
      return {
        ...s,
        vehicle_id: vehicleId,
        timestamp:  new Date(s._epoch ?? Date.parse(s.timestamp) ?? Date.now()).toISOString(),
        raw:        raw ? { first_row: Array.isArray(raw) ? raw[0] : raw } : {},
      }
    })
    .filter(s => s.vehicle_id)

  const result = await gpsHistoryRepository.insertBatch(rows)
  state.health.lastVehicleCount = rows.length
  await _updateStatuses(rows)
  emit()
  return { count: rows.length, ...result }
}

async function _updateStatuses(rows) {
  const ts = new Date().toISOString()
  for (const row of rows) {
    // Update vehicle_status — last_gps_at only, NOT status
    try {
      await supabase.from('vehicle_status').upsert({
        vehicle_id:  row.vehicle_id,
        last_gps_at: ts,
        last_lat:    row.lat,
        last_lng:    row.lng,
        updated_at:  ts,
      }, { onConflict: 'vehicle_id' })
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[gpsSync] vehicle_status update failed:', err?.message)
    }
    // Update driver_status heartbeat if driver_id is mapped
    if (row.driver_id) {
      try {
        await supabase.from('driver_status').upsert({
          driver_id:      row.driver_id,
          latitude:       row.lat,
          longitude:      row.lng,
          speed_kmh:      row.speed_kmh,
          last_heartbeat: ts,
          updated_at:     ts,
        }, { onConflict: 'driver_id' })
      } catch {}
    }
  }
}

function _applyBackoff() {
  // Exponential: 1, 2, 4, 8, 16, 30 (cap), reset on success
  const cap = 30_000
  state.retryAttempt = Math.min(state.retryAttempt + 1, 6)
  state.backoffMs = Math.min(1000 * 2 ** (state.retryAttempt - 1), cap)
}

function _auditFailure(error) {
  if (state.health.consecutiveFailures !== 2) return
  addAuditEvent('SETTINGS_UPDATED', {
    description: `GPS sync failing (${state.health.consecutiveFailures}×): ${error}`,
    module:      'security',
    severity:    'error',
  })
}

// ── Public API ────────────────────────────────────────────────
async function _bootstrapProvider() {
  const settings = await gpsSettingsRepository.getAsObject()
  if (!settings.enabled) {
    state.provider = null
    state.providerName = settings.provider
    return null
  }
  state.providerName = settings.provider
  state.provider     = createGpsProvider(settings.provider, settings)
  state.intervalMs   = Math.max(5_000, Number(settings.refresh_interval ?? 60) * 1000)
  return state.provider
}

async function start() {
  if (state.running) return
  await _bootstrapProvider()
  if (!state.provider) {
    state.health.ok = false
    state.health.lastError = 'GPS sync disabled or provider unconfigured'
    emit()
    return
  }
  state.running = true
  _installVisibilityHandler()
  // First tick immediately, then on interval
  _syncNow()
  state.intervalId = setInterval(() => {
    if (state.backoffMs > 0) {
      // Skip this tick — backoff in effect; reschedule via short retry
      return
    }
    _syncNow()
  }, state.intervalMs)
  emit()
}

function stop() {
  if (state.intervalId) clearInterval(state.intervalId)
  state.intervalId = null
  state.running = false
  _uninstallVisibilityHandler()
  _resetIndexes()
  emit()
}

async function syncNow() {
  if (!state.provider) await _bootstrapProvider()
  return _syncNow()
}

async function healthCheck() {
  if (!state.provider) {
    await _bootstrapProvider()
  }
  if (!state.provider) {
    return { ok: false, error: 'Provider not configured' }
  }
  return state.provider.healthCheck()
}

function subscribe(fn) {
  state.subscribers.add(fn)
  fn({ health: { ...state.health }, running: state.running })
  return () => state.subscribers.delete(fn)
}

function getHealth() {
  return { ...state.health }
}

function getProviderName() {
  return state.providerName
}

function _installVisibilityHandler() {
  if (state.visibilityHandler) return
  const onVis = () => {
    if (document.hidden) {
      // Pause: clear the interval so we don't fire while hidden
      if (state.intervalId) {
        clearInterval(state.intervalId)
        state.intervalId = null
      }
    } else if (state.running && !state.intervalId) {
      _syncNow()
      state.intervalId = setInterval(() => {
        if (state.backoffMs > 0) return
        _syncNow()
      }, state.intervalMs)
    }
  }
  document.addEventListener('visibilitychange', onVis)
  state.visibilityHandler = onVis
}

function _uninstallVisibilityHandler() {
  if (!state.visibilityHandler) return
  document.removeEventListener('visibilitychange', state.visibilityHandler)
  state.visibilityHandler = null
}

export const gpsSyncService = {
  start,
  stop,
  syncNow,
  healthCheck,
  subscribe,
  getHealth,
  getProviderName,
}

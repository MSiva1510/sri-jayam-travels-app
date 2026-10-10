// ─── GPS Sync Service ─────────────────────────────────────────
// Module-singleton: polls GpsProvider → dedup → gps_tracking → status tables.
// Pages never call provider methods directly.

import { createGpsProvider, parseProviderNames }    from './gpsProvider'

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
  syncing: false, syncingSince: 0, lastAttemptPerf: 0,
  vehicleIndex: {}, imeiIndex: {}, vehicleById: {},
  alertMemory: {}, prevIgnition: {},
  provider: null, providerName: null,
  health: {
    ok: null, lastPoll: null, lastSuccess: null, lastError: null,
    responseTimeMs: 0, mock: false, consecutiveFailures: 0, lastVehicleCount: 0,
    providerRows: 0, matchedCount: 0, unmatchedRegs: [],
    providers: null, degraded: false,
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
    const regIdx = {}, imeiIdx = {}, byId = {}
    for (const v of list ?? []) {
      byId[v.id] = v
      if (v.registration) {
        regIdx[v.registration] = v.id
        // vendors send "PY01DF1255"; the fleet may be stored as "PY 01 DF 1255" / "PY-01-DF-1255"
        regIdx[normalizeReg(v.registration)] = v.id
      }
      if (v.imei) imeiIdx[String(v.imei).trim()] = v.id
    }
    state.vehicleIndex = regIdx
    state.imeiIndex    = imeiIdx
    state.vehicleById  = byId
  }
}

function _resetIndexes() {
  state.vehicleIndex = {}
  state.imeiIndex = {}
  state.vehicleById = {}
}

async function _syncNow(opts = {}) {
  // Coalesce overlapping triggers (StrictMode double-mount, manual +
  // interval racing) — the vendor rate-limits aggressively.
  // Watchdog: a wedged flag (sleep/wake, hung adapter) must never block
  // polling forever — performance.now() is monotonic, immune to clock jumps.
  if (state.syncing && performance.now() - (state.syncingSince || 0) > 120_000) {
    state.syncing = false
    state.health.lastSkip = 'watchdog-reset'
  }
  if (state.syncing) {
    state.health.lastAttempt = new Date().toISOString()
    state.health.lastSkip = 'sync-in-progress'
    emit()
    return { ok: false, error: 'sync-in-progress' }
  }
  // Auto polls never fire inside the vendor's minimum gap; manual syncs
  // (Retry buttons) always attempt — the result lands in health either way.
  if (opts.throttle && performance.now() - (state.lastAttemptPerf || 0) < VENDOR_MIN_GAP_MS) {
    state.health.lastAttempt = new Date().toISOString()
    state.health.lastSkip = 'too-soon'
    emit()
    return { ok: false, error: 'too-soon' }
  }
  state.syncing = true
  state.syncingSince = performance.now()
  try {
    // Serialize with every other caller (other tabs, reloads, manual
    // retries): wait out the shared vendor gap instead of failing into it.
    // Re-claim after waiting in case another context took the slot first.
    // claimSlot() stamps the shared slot when it returns 0, so it must be
    // called once per attempt — a second call right after always reads
    // "0 ms ago" and would block every sync.
    let claimed = false
    for (let i = 0; i < 3; i++) {
      const wait = claimSlot()
      if (wait <= 0) { claimed = true; break }
      await delay(wait)
    }
    if (!claimed) return { ok: false, error: 'too-soon' }
    state.lastAttemptPerf = performance.now()
    return await _syncNowInner()
  } finally {
    state.syncing = false
  }
}

async function _syncNowInner() {
  state.health.lastAttempt = new Date().toISOString()
  state.health.lastSkip = null
  if (!state.provider) {
    state.health.ok = false
    state.health.lastError = 'GPS provider not configured'
    emit()
    return { ok: false, error: 'no-provider' }
  }
  const t0 = performance.now()
  state.health.lastPoll = new Date().toISOString()
  const { ok, snapshots, error, mock, partial, providers } = await state.provider.fetchFleet()
  state.health.responseTimeMs = Math.round(performance.now() - t0)
  state.health.providers = providers ?? null

  if (!ok) {
    state.health.ok = false; state.health.lastError = error || 'fetch failed'
    state.health.consecutiveFailures += 1
    _applyBackoff(parseRetryAfterMs(error)); _auditFailure(error); emit(); return
  }

  state.health.mock = !!mock; state.health.ok = true
  state.health.lastSuccess = new Date().toISOString()
  // Partial = at least one vendor answered. Keep syncing, but name the dead one.
  state.health.degraded = !!partial
  state.health.lastError = partial ? error : null
  state.health.consecutiveFailures = 0
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
  // A single all-skipped sync is normal (same-minute dedup on re-poll) —
  // only a streak means rows genuinely aren't persisting (e.g. RLS).
  const fullSkip = (write?.skipped ?? 0) > 0 && (write?.inserted ?? 0) === 0
  state.health.writeStreak = fullSkip ? (state.health.writeStreak || 0) + 1 : 0
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
  let failed = 0, lastErr = null
  for (const row of rows) {
    const { error } = await supabase.from('vehicle_status').upsert(
      { vehicle_id: row.vehicle_id, last_gps_at: ts, last_lat: row.lat, last_lng: row.lng, updated_at: ts },
      { onConflict: 'vehicle_id' }
    ).then(r => r, e => ({ error: e }))
    if (error) { failed++; lastErr = error.message || String(error) }
    if (row.driver_id) {
      const r2 = await supabase.from('driver_status').upsert(
        { driver_id: row.driver_id, latitude: row.lat, longitude: row.lng, speed_kmh: row.speed_kmh, last_heartbeat: ts, updated_at: ts },
        { onConflict: 'driver_id' }
      ).then(r => r, e => ({ error: e }))
      if (r2.error) { failed++; lastErr = r2.error.message || String(r2.error) }
    }
  }
  state.health.statusWriteError = failed ? `${failed} status write(s) failed: ${lastErr}` : null
}

// Vendor rate limit ("one API request every 30 seconds") — never fire
// auto polls closer together, no matter the configured interval.
const VENDOR_MIN_GAP_MS = 30_000
// Cross-tab slot: the vendor counts every caller (tabs, reloads, manual
// link hits share the account quota), so the last-call timestamp lives
// in localStorage where all contexts see it.
const LS_LAST_CALL = 'sjt_gps_last_call'
function claimSlot() {
  // All math here is gap-bounded and tolerates wall-clock jumps
  // (sleep/wake, NTP steps): far-future stamps are ignored, waits are
  // clamped to one vendor gap so a skew can never wedge the poller.
  try {
    const last = Number(localStorage.getItem(LS_LAST_CALL) || 0)
    const age = Date.now() - last
    if (!Number.isFinite(age) || age < -60_000) {
      localStorage.setItem(LS_LAST_CALL, String(Date.now()))
      return 0
    }
    const wait = VENDOR_MIN_GAP_MS - age
    if (wait > 0) return Math.min(wait, VENDOR_MIN_GAP_MS)
    localStorage.setItem(LS_LAST_CALL, String(Date.now()))
    return 0
  } catch {
    return 0
  }
}
const delay = (ms) => new Promise(r => setTimeout(r, ms))

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
  // Floor every auto-retry at the vendor minimum gap — retrying sooner
  // (even the 1s exponential step) can itself extend a rate-limit ban.
  state.backoffMs = Math.max(
    VENDOR_MIN_GAP_MS,
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
// Alerts fire on state CHANGE (ignition) or once per cooldown window
// (overspeed / offline) — never on every poll.
const ALERT_COOLDOWN_MS = 10 * 60_000

function _shouldFire(vehicleId, type) {
  const key = `${vehicleId}:${type}`
  const last = state.alertMemory[key] || 0
  if (Date.now() - last < ALERT_COOLDOWN_MS) return false
  state.alertMemory[key] = Date.now()
  return true
}

async function _detectAndCreateAlerts(rows) {
  const settings = await gpsSettingsRepository.getAsObject()
  if (!settings.enabled || settings.alerts_enabled === false) return []

  const alerts = []
  for (const row of rows) {
    if (!row.vehicle_id) continue
    // Cached fleet list — no per-row DB query on every poll
    const vehicle = state.vehicleById[row.vehicle_id]
    const reg = vehicle?.registration || row.registration || 'Unknown'
    const location = { latitude: row.latitude, longitude: row.longitude, accuracy: row.accuracy }
    const base = { vehicle_id: row.vehicle_id, driver_id: row.driver_id || null, location, detected_at: row.timestamp }

    if (settings.overspeed_limit && row.speed_kmh > settings.overspeed_limit && _shouldFire(row.vehicle_id, 'overspeed')) {
      alerts.push({ ...base, alert_type: 'overspeed',
        priority: row.speed_kmh > settings.overspeed_limit * 1.5 ? 'critical' : 'high',
        title: `Overspeed Detected: ${reg}`,
        description: `Vehicle exceeded speed limit of ${settings.overspeed_limit} km/h`,
        speed_kmh: row.speed_kmh })
    }

    if (row.status === 'offline' && _shouldFire(row.vehicle_id, 'vehicle_offline')) {
      alerts.push({ ...base, alert_type: 'vehicle_offline', priority: 'high',
        title: `Vehicle Offline: ${reg}`,
        description: `Vehicle has not reported GPS data for more than ${settings.offline_timeout || 5} minutes` })
    }

    if (row.gps_online === false && _shouldFire(row.vehicle_id, 'gps_offline')) {
      alerts.push({ ...base, alert_type: 'gps_offline', priority: 'high',
        title: `GPS Signal Lost: ${reg}`,
        description: 'GPS module appears to be offline or malfunctioning' })
    }

    // Ignition: only when the state actually changed since the last poll
    if (typeof row.ignition === 'boolean') {
      const prev = state.prevIgnition[row.vehicle_id]
      state.prevIgnition[row.vehicle_id] = row.ignition
      if (prev !== undefined && prev !== row.ignition) {
        alerts.push({ ...base, alert_type: row.ignition ? 'ignition_on' : 'ignition_off', priority: 'information',
          title: `Ignition ${row.ignition ? 'ON' : 'OFF'}: ${reg}`,
          description: `Vehicle ignition turned ${row.ignition ? 'on' : 'off'}` })
      }
    }
  }

  const createdAlerts = []
  for (const alertData of alerts) {
    try { createdAlerts.push(await fleetAlertRepository.create(alertData)) }
    catch (error) { console.error('Failed to create alert:', error) }
  }
  return createdAlerts
}

async function _bootstrapProvider() {
  const settings = await gpsSettingsRepository.getAsObject()
  // Self-heal a dead vendor selection: gpstrack without token credentials
  // can never sync. Fall back to KingsTrack (keeping the account ids and
  // restoring the KingsTrack endpoint), persist it, and audit the change.
  // Runs once per process; a deliberate gpstrack+token setup is untouched.
  // Only heals a *sole* gpstrack selection: a multi-vendor list such as
  // "kingstrack,gpstrack" is deliberate and must survive.
  if (!state.healedVendor &&
      parseProviderNames(settings.provider).join(',') === 'gpstrack' &&
      !(settings.api_token && settings.api_email)) {
    state.healedVendor = true
    settings.provider = 'kingstrack'
    settings.api_url = ''
    try {
      await gpsSettingsRepository.setMany(
        { provider: 'kingstrack', api_url: '' },
        { updated_by: 'auto-heal' }
      )
      addAuditEvent('SETTINGS_UPDATED', {
        description: 'GPS provider auto-corrected gpstrack → kingstrack (no gpstrack credentials stored)',
        module: 'security',
      })
    } catch {}
  }
  if (!settings.enabled) { state.provider = null; state.providerName = settings.provider; return null }

  try {
    state.provider = createGpsProvider(settings.provider, settings)
  } catch (err) {
    // A bad provider name must not take the whole dashboard down.
    state.provider = null
    state.providerName = settings.provider
    state.health.ok = false
    state.health.lastError = err?.message ?? 'Invalid GPS provider'
    emit()
    return null
  }
  state.providerName = state.provider.name ?? settings.provider
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
  // `running` is only set after an await, so two callers (app-level starter
  // + Fleet page) used to both get through, creating two intervals (one
  // leaked) and two immediate vendor calls. Share one in-flight start.
  if (state.starting) return state.starting
  state.starting = (async () => {
    try {
      await _bootstrapProvider()
      if (!state.provider) { state.health.ok = false; state.health.lastError = 'GPS sync disabled or provider unconfigured'; emit(); return }
      if (state.running) return
      state.running = true; _installVisibilityHandler(); _syncNow()
      if (state.intervalId) clearInterval(state.intervalId)
      state.intervalId = setInterval(() => { if (!state.backoffMs) _syncNow({ throttle: true }) }, state.intervalMs)
      emit()
    } finally { state.starting = null }
  })()
  return state.starting
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

// Re-bootstrap when the stored vendor changes under a running service
// (settings edits, auto-heal). Cheap: one small settings read.
async function refreshProvider() {
  try {
    const settings = await gpsSettingsRepository.getAsObject()
    if (!state.provider || settings.provider !== state.providerName) {
      await _bootstrapProvider()
    }
  } catch {}
}

async function syncNow() {
  if (!state.provider) await _bootstrapProvider()
  else await refreshProvider()
  // Manual retries obey the vendor ban window (Retry buttons) — firing into
  // a rate limit only slides the ban window further out.
  const wait = rateLimitedMs()
  if (wait > 0) return { ok: false, error: 'rate-limited', retryInMs: wait }
  return _syncNow()
}

// Wait for the shared (cross-tab) 30 s vendor slot. Any code that talks to
// the vendor outside the poller must go through this.
async function waitForVendorSlot() {
  for (let i = 0; i < 4; i++) {
    const wait = claimSlot()
    if (wait <= 0) return true
    await delay(Math.min(wait, 10_000))
  }
  return false
}

async function healthCheck() {
  // The vendor rate-limits the whole account (browsers hitting the raw
  // URL count too) — never spend more than one check per minute here.
  const now = Date.now()
  if (state.lastHealthCheck && now - state.lastHealthCheck.at < 60_000) {
    return state.lastHealthCheck.result
  }
  if (!state.provider) await _bootstrapProvider()
  if (!state.provider) return { ok: false, error: 'Provider not configured' }
  // Health pings count against the same vendor quota — wait out the
  // shared slot (capped) instead of firing into a rate limit.
  await waitForVendorSlot()
  const result = await state.provider.healthCheck()
  state.lastHealthCheck = { at: Date.now(), result }
  return result
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

// DB snapshot refresh failures are invisible to _syncNow (separate path).
// Record them on health (with streak) so the page reports a stale view
// instead of silently freezing. A single blip clears automatically.
function noteRefreshError(msg) {
  state.health.refreshError = msg || null
  state.health.refreshFailStreak = msg ? (state.health.refreshFailStreak || 0) + 1 : 0
  emit()
}

export const gpsSyncService = { waitForVendorSlot, start, stop, syncNow, healthCheck, subscribe, getHealth, getProviderName, rateLimitedMs, refreshProvider, noteRefreshError }

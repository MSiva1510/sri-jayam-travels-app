// ─── GpsProvider Factory ──────────────────────────────────────
//
// Swappable provider interface for GPS vendor adapters.
//
// To add a new vendor:
//   1. Create src/services/gpsProvider/<name>Provider.js exporting
//      `{ fetchFleet, healthCheck, normalizeResponse }`.
//   2. Register it in REGISTRY below.
//
// MULTI-VENDOR FLEETS
// The `provider` setting accepts several names ("kingstrack,gpstrack").
// Every listed vendor is then polled and the snapshots merged, because a
// fleet can carry devices from more than one tracking company (Sri Jayam:
// PY01CY1255 on KingsTrack, PY01VF1255 + PY01DF1255 on GPSTrack.in). With a
// single provider the other vendor's vehicles never receive a fix and show
// as "Offline" forever.
//
// Per-vendor settings: prefix a key with the provider name to address one
// vendor only — `gpstrack_api_url`, `kingstrack_api_url`. Unprefixed keys
// are shared. `api_url` is the exception: it is ambiguous when several
// vendors are polled, so in multi-provider mode it is ignored unless
// prefixed and each adapter falls back to its own default endpoint.
//
// Future GPS APIs need only a new Provider Adapter — no changes
// to Context, Page, Service, or Repository.

import { createKingsTrackProvider } from './kingsTrackProvider.js'
import { createGpsTrackInProvider } from './gpsTrackInProvider.js'

/**
 * @typedef {Object} NormalizedSnapshot
 * @property {string}  imei       Device IMEI (vendor-issued id)
 * @property {string=} registration  Optional vehicle registration if vendor provides it
 * @property {number}  lat        Latitude (decimal degrees)
 * @property {number}  lng        Longitude (decimal degrees)
 * @property {string=} address    Reverse-geocoded address (best-effort)
 * @property {number=} speed_kmh  Current speed
 * @property {boolean=} ignition  Ignition on?
 * @property {string=} status     Vendor-supplied status string
 * @property {string=} odometer   Vehicle odometer reading
 * @property {string}  timestamp  ISO timestamp from the device
 * @property {number}  _epoch     timestamp rounded to nearest minute (ms) — used for dedup
 * @property {string=} _provider  adapter that produced the snapshot (multi-vendor mode)
 */

/**
 * @typedef {Object} GpsProvider
 * @property {string}   name             Provider identifier
 * @property {string[]} providers        One entry per polled vendor
 * @property {() => Promise<{ok: boolean, raw?: any, snapshots: NormalizedSnapshot[], error?: string}>} fetchFleet
 * @property {() => Promise<{ok: boolean, latencyMs?: number, error?: string}>} healthCheck
 * @property {(raw: any) => NormalizedSnapshot[]} normalizeResponse
 */

const REGISTRY = {
  kingstrack: createKingsTrackProvider,
  gpstrack:   createGpsTrackInProvider,   // app.gpstrack.in
}

export const GPS_PROVIDER_NAMES = Object.keys(REGISTRY)

/**
 * Split a `provider` setting into adapter names.
 * Accepts "gpstrack", "kingstrack,gpstrack", "kingstrack + gpstrack".
 * @returns {string[]} lower-cased, de-duplicated, order preserved
 */
export function parseProviderNames(value) {
  return String(value ?? '')
    .split(/[,+|/\s]+/)
    .map(part => part.trim().toLowerCase())
    .filter(Boolean)
    .filter((name, i, all) => all.indexOf(name) === i)
}

/**
 * Settings as seen by one adapter: `<name>_key` overrides plain `key`.
 * @param {boolean} multi  true when more than one vendor is polled
 */
export function settingsForProvider(name, settings = {}, multi = false) {
  const prefix = `${name}_`
  const scoped = { ...settings }
  // Ambiguous across vendors — each adapter uses its own default instead.
  if (multi) delete scoped.api_url

  for (const [key, value] of Object.entries(settings)) {
    if (key.startsWith(prefix)) scoped[key.slice(prefix.length)] = value
  }
  return scoped
}

function buildOne(name, settings, multi) {
  const factory = REGISTRY[name]
  if (!factory) {
    throw new Error(
      `[GpsProvider] Unknown provider "${name}". Registered: ${GPS_PROVIDER_NAMES.join(', ')}`
    )
  }
  return factory(settingsForProvider(name, settings, multi))
}

/** Poll several vendors and present them as one provider. */
function createCompositeProvider(names, settings) {
  const children = names.map(name => ({ name, provider: buildOne(name, settings, true) }))

  const settle = async (call) => Promise.all(children.map(async child => {
    try { return { name: child.name, ...(await call(child.provider)) } }
    catch (err) { return { name: child.name, ok: false, error: err?.message ?? 'Provider error' } }
  }))

  async function fetchFleet() {
    const results = await settle(p => p.fetchFleet())

    // Merge; if two vendors report the same device the first listed wins.
    const snapshots = []
    const seen = new Set()
    for (const result of results) {
      for (const snapshot of result.snapshots ?? []) {
        const key = snapshot.imei || snapshot.registration
        if (key && seen.has(key)) continue
        if (key) seen.add(key)
        snapshots.push({ ...snapshot, _provider: result.name })
      }
    }

    const failed  = results.filter(r => !r.ok)
    const okCount = results.length - failed.length
    return {
      // One dead vendor must not stop the others from updating.
      ok:        okCount > 0,
      partial:   okCount > 0 && failed.length > 0,
      error:     failed.length ? failed.map(r => `${r.name}: ${r.error}`).join('; ') : null,
      mock:      results.every(r => r.mock),
      snapshots,
      raw:       Object.fromEntries(results.map(r => [r.name, r.raw ?? null])),
      providers: results.map(r => ({
        name: r.name, ok: !!r.ok, error: r.error ?? null,
        count: r.snapshots?.length ?? 0, cached: !!r.cached,
      })),
    }
  }

  async function healthCheck() {
    const results = await settle(p => p.healthCheck())
    const failed  = results.filter(r => !r.ok)
    return {
      ok:        failed.length === 0,
      partial:   failed.length > 0 && failed.length < results.length,
      latencyMs: Math.max(0, ...results.map(r => r.latencyMs ?? 0)),
      devices:   results.reduce((sum, r) => sum + (r.devices ?? 0), 0),
      error:     failed.length ? failed.map(r => `${r.name}: ${r.error}`).join('; ') : undefined,
      providers: results,
    }
  }

  // In composite mode raw is keyed by provider name.
  function normalizeResponse(raw = {}) {
    return children.flatMap(child =>
      (child.provider.normalizeResponse(raw?.[child.name] ?? raw) ?? [])
        .map(snapshot => ({ ...snapshot, _provider: child.name }))
    )
  }

  return {
    name: names.join('+'),
    providers: names,
    fetchFleet,
    healthCheck,
    normalizeResponse,
  }
}

/**
 * Create a GPS provider instance.
 * @param {string} providerName   One or more keys from REGISTRY ("a" or "a,b").
 * @param {object} settings       Row of gps settings from the DB.
 * @returns {GpsProvider}
 */
export function createGpsProvider(providerName, settings = {}) {
  const names = parseProviderNames(providerName)
  if (!names.length) {
    throw new Error(`[GpsProvider] No provider configured. Registered: ${GPS_PROVIDER_NAMES.join(', ')}`)
  }
  if (names.length === 1) {
    return { providers: names, ...buildOne(names[0], settings, false) }
  }
  return createCompositeProvider(names, settings)
}

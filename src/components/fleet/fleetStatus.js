// ─── Fleet status helpers ──────────────────────────────────────
// One definition of movement state, freshness, vehicle/GPS merging and
// formatting for the Live Fleet page, its map markers and detail drawer.
// GPS connection health stays separate from vehicle movement.

export const FLEET_STALE_MS = 10 * 60_000

export const FLEET_STATUSES = {
  moving:  { label: 'Moving',  tone: 'green', color: '#10b981' },
  stopped: { label: 'Stopped', tone: 'blue',  color: '#3b82f6' },
  offline: { label: 'Offline', tone: 'red',   color: '#ef4444' },
}

export const MAP_STATUSES = ['moving', 'stopped', 'offline']

const tsOf = (s) => {
  const ts = s?.timestamp ? new Date(s.timestamp).getTime() : 0
  return Number.isFinite(ts) ? ts : 0
}

export const isRecent = (s, now = Date.now()) => {
  const ts = tsOf(s)
  return Boolean(ts && now - ts < FLEET_STALE_MS)
}

const hasNumber = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))

export const hasGpsFix = (s) => hasNumber(s?.latitude) && hasNumber(s?.longitude)

/** Speed is only known when a GPS snapshot exists. */
export function speedText(s) {
  if (!tsOf(s)) return '—'
  return `${Number(s?.speed_kmh ?? 0).toFixed(0)} km/h`
}

/**
 * Movement state only. A stale fix is offline; a recent zero-speed fix is
 * stopped regardless of ignition. Ignition is surfaced separately as
 * telemetry, never used to invent movement or to hide stale data.
 */
export function vehStatus(s, now = Date.now()) {
  if (!isRecent(s, now)) return 'offline'
  if (Number(s?.speed_kmh ?? 0) > 0) return 'moving'
  return 'stopped'
}

export function freshnessLabel(s, now = Date.now()) {
  const ts = tsOf(s)
  if (!ts) return 'No GPS data'
  if (now - ts > FLEET_STALE_MS) return 'Offline'
  if (now - ts < 60_000) return 'Updated just now'
  return `Updated ${timeAgo(s.timestamp, now)}`
}

export const normReg = (value) => String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')

function offlineVehicleSnapshot(v) {
  const key = v.id ?? v.vehicle_id ?? v.registration ?? v.reg
  return {
    id: `vehicle:${key}`,
    vehicle_id: v.id ?? v.vehicle_id,
    registration: v.registration || v.reg,
    vehicle_model: v.model || v.vehicle_model,
    model: v.model || v.vehicle_model,
    vehicle_type: v.vehicle_type,
    driver_name: v.driver_name,
    imei: v.imei,
    speed_kmh: null,
    timestamp: null,
    latitude: null,
    longitude: null,
    gps_online: false,
    fromVehicleRecord: true,
  }
}

/**
 * Treat the vehicles table as the fleet roster and attach the latest GPS
 * row where one matches. Vehicles with no GPS row are real offline entries,
 * never "stopped" and never given invented coordinates. Provider rows with
 * no roster match are still shown so unmatched trackers remain visible.
 */
export function mergeFleetVehicles(vehicles, snapshots) {
  const gps = Array.isArray(snapshots) ? snapshots : []
  if (!Array.isArray(vehicles) || !vehicles.length) return gps

  const byReg = new Map()
  const byId = new Map()
  gps.forEach((s) => {
    const reg = normReg(s?.registration || s?.reg)
    if (reg) byReg.set(reg, s)
    ;[s?.vehicle_id, s?.id].forEach((id) => {
      if (id !== null && id !== undefined && id !== '') byId.set(String(id), s)
    })
  })

  const used = new Set()
  const merged = vehicles.map((v) => {
    const reg = normReg(v?.registration || v?.reg)
    const ids = [v?.id, v?.vehicle_id].filter((id) => id !== null && id !== undefined && id !== '').map(String)
    const s = (reg && byReg.get(reg)) || ids.map((id) => byId.get(id)).find(Boolean)
    if (!s) return offlineVehicleSnapshot(v || {})
    used.add(s)
    return {
      ...s,
      registration: s.registration || v.registration || v.reg,
      vehicle_model: s.vehicle_model || s.model || v.model || v.vehicle_model,
      model: s.model || v.model || v.vehicle_model,
      driver_name: s.driver_name || v.driver_name,
      vehicle_type: s.vehicle_type || v.vehicle_type,
      imei: s.imei || v.imei,
    }
  })

  gps.forEach((s) => { if (!used.has(s)) merged.push(s) })
  return merged
}

export function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()
}

export function fmtDT(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}`
}

export function timeAgo(iso, now = Date.now()) {
  if (!iso) return '—'
  const ms = now - new Date(iso).getTime()
  if (!Number.isFinite(ms)) return '—'
  if (ms < 60_000) return 'just now'
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

export const ignitionOn = (value) => value === true || String(value ?? '').toUpperCase() === 'ON'

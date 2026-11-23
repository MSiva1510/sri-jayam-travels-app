// ─── Fleet status helpers ──────────────────────────────────────
// One definition of movement state, freshness and formatting for the
// Live Fleet page, its map markers and the vehicle detail drawer.
// GPS connection health stays separate from vehicle movement.

export const FLEET_STALE_MS = 10 * 60_000

export const FLEET_STATUSES = {
  moving:  { label: 'Moving',  tone: 'green', color: '#10b981' },
  stopped: { label: 'Stopped', tone: 'amber', color: '#f59e0b' },
  offline: { label: 'Offline', tone: 'gray',  color: '#94a3b8' },
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

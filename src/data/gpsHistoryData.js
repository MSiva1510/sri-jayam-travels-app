// ─── GPS Route History ────────────────────────────────────────
// Saves GPS route points during active trips (every 30 seconds).
// Each trip gets its own localStorage key.
// Also stores start/end coords and calculates distance.

export const GPS_HISTORY_KEY    = 'sjt_gps_history'          // existing key — trip summary list
export const GPS_ROUTE_KEY      = 'sjt_gps_route'            // per-trip route points
export const GPS_ROUTE_INTERVAL = 30 * 1000                  // 30 seconds

// ── Route Point Structure: { tripId, lat, lng, area, timestamp }

// ── Save one GPS point for an active trip ─────────────────────
export function saveRoutePoint({ tripId, lat, lng, area, timestamp }) {
  if (!tripId || lat == null || lng == null) return false
  const key    = `${GPS_ROUTE_KEY}:${tripId}`
  const point  = {
    tripId,
    lat,
    lng,
    area:      area      || '—',
    timestamp: timestamp || new Date().toISOString(),
  }
  const existing = loadTripRoute(tripId)
  existing.push(point)
  try {
    localStorage.setItem(key, JSON.stringify(existing))
    return true
  } catch { return false }
}

// ── Load all route points for a trip ──────────────────────────
export function loadTripRoute(tripId) {
  if (!tripId) return []
  try {
    const raw = localStorage.getItem(`${GPS_ROUTE_KEY}:${tripId}`)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

// ── Clear route points for a completed/cancelled trip ─────────
export function clearTripRoute(tripId) {
  if (!tripId) return
  try { localStorage.removeItem(`${GPS_ROUTE_KEY}:${tripId}`) } catch {}
}

// ── Get the latest recorded point ────────────────────────────
export function getLatestRoutePoint(tripId) {
  const pts = loadTripRoute(tripId)
  return pts.length ? pts[pts.length - 1] : null
}

// ── Haversine distance between two points (km) ───────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R    = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a    = Math.sin(dLat / 2) ** 2
              + Math.cos(lat1 * Math.PI / 180)
              * Math.cos(lat2 * Math.PI / 180)
              * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Calculate total distance driven from route points ─────────
export function calcRouteDistanceKm(tripId) {
  const pts = loadTripRoute(tripId)
  if (pts.length < 2) return 0
  let total = 0
  for (let i = 1; i < pts.length; i++) {
    total += haversine(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng)
  }
  return Math.round(total * 10) / 10
}

// ── Start recording route points every 30 seconds ────────────
// Returns a stop() function — call when trip ends.
// getCoordFn must return Promise<{ lat, lng, area }> or null
export function startRouteRecording(tripId, getCoordFn) {
  if (!tripId || typeof getCoordFn !== 'function') return () => {}
  const id = setInterval(async () => {
    try {
      const coord = await getCoordFn()
      if (coord && coord.lat != null) {
        saveRoutePoint({
          tripId,
          lat:  coord.lat,
          lng:  coord.lng,
          area: coord.area || '—',
        })
      }
    } catch { /* silent — GPS may be unavailable mid-trip */ }
  }, GPS_ROUTE_INTERVAL)
  return () => clearInterval(id)
}

// ── Build a trip summary for GPS history ─────────────────────
// Call this when a trip ends — creates the history entry.
export function buildRouteHistoryEntry({
  tripId, customer, driver,
  startCoord, endCoord,
  startTime, endTime,
  duration,
}) {
  const pts      = loadTripRoute(tripId)
  const distance = calcRouteDistanceKm(tripId)
  return {
    tripId,
    customer:    customer    || '—',
    driver:      driver      || '—',
    startCoord,
    endCoord,
    startTime,
    endTime,
    duration,
    routePoints: pts.length,
    distanceKm:  distance,
    completedAt: new Date().toISOString(),
  }
}

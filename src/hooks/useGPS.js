// ─── useGPS — Browser Geolocation Hook ───────────────────────
import { useState, useEffect, useCallback, useRef } from 'react'

export const GPS_STORAGE_KEY = 'sjt_gps_active_ride'
export const GPS_HISTORY_KEY = 'sjt_gps_history'

// ── Placeholder reverse geocoder ─────────────────────────────
// Replace body when a real API is integrated (Google Maps, OpenCage, etc.)
export function getAreaName(lat, lng) {
  if (lat == null || lng == null) return '—'
  const regions = [
    { name: 'Puducherry',   latMin: 11.88, latMax: 11.97, lngMin: 79.77, lngMax: 79.86 },
    { name: 'Auroville',   latMin: 11.97, latMax: 12.02, lngMin: 79.80, lngMax: 79.85 },
    { name: 'Cuddalore',   latMin: 11.73, latMax: 11.80, lngMin: 79.73, lngMax: 79.79 },
    { name: 'Villupuram',  latMin: 11.91, latMax: 11.96, lngMin: 79.45, lngMax: 79.55 },
    { name: 'Chennai',     latMin: 12.90, latMax: 13.20, lngMin: 80.10, lngMax: 80.30 },
    { name: 'Bangalore',   latMin: 12.85, latMax: 13.10, lngMin: 77.45, lngMax: 77.75 },
    { name: 'Salem',       latMin: 11.60, latMax: 11.70, lngMin: 78.10, lngMax: 78.20 },
    { name: 'Tirupati',    latMin: 13.60, latMax: 13.70, lngMin: 79.38, lngMax: 79.48 },
    { name: 'Coimbatore',  latMin: 10.98, latMax: 11.05, lngMin: 76.93, lngMax: 77.00 },
    { name: 'Mahabalipuram',latMin:12.60, latMax: 12.66, lngMin: 80.17, lngMax: 80.22 },
  ]
  for (const r of regions) {
    if (lat >= r.latMin && lat <= r.latMax && lng >= r.lngMin && lng <= r.lngMax) {
      return r.name
    }
  }
  // Fallback coordinate string — replaced by API result in future
  return `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`
}

// ── Error code → friendly string ─────────────────────────────
function friendlyGPSError(err) {
  if (!err) return 'Unknown GPS error'
  switch (err.code) {
    case 1: return 'Location permission denied. Please enable GPS in your browser or device settings, then refresh.'
    case 2: return 'GPS signal unavailable. Move to an open area and try again.'
    case 3: return 'Location request timed out. Ensure GPS is enabled and try again.'
    default: return err.message || 'GPS error occurred.'
  }
}

// ── Build a coordinate snapshot from a GeolocationPosition ───
export function buildCoordSnapshot(position) {
  const { latitude, longitude, accuracy, altitude, speed } = position.coords
  return {
    lat:       parseFloat(latitude.toFixed(6)),
    lng:       parseFloat(longitude.toFixed(6)),
    accuracy:  Math.round(accuracy),
    altitude:  altitude  != null ? parseFloat(altitude.toFixed(1))  : null,
    speed:     speed     != null ? parseFloat(speed.toFixed(2))     : null,
    timestamp: new Date().toISOString(),
    area:      getAreaName(latitude, longitude),
  }
}

// ── Active-ride GPS ─── persisted so page refresh restores it ─
export function loadActiveRideGPS()  {
  try { const r = localStorage.getItem(GPS_STORAGE_KEY); return r ? JSON.parse(r) : null } catch { return null }
}
export function saveActiveRideGPS(data) {
  try { localStorage.setItem(GPS_STORAGE_KEY, JSON.stringify(data)) } catch {}
}
export function clearActiveRideGPS() {
  try { localStorage.removeItem(GPS_STORAGE_KEY) } catch {}
}

// ── GPS trip history ──────────────────────────────────────────
export function loadGPSHistory() {
  try { const r = localStorage.getItem(GPS_HISTORY_KEY); return r ? JSON.parse(r) : [] } catch { return [] }
}
export function appendGPSHistory(entry) {
  try {
    const h = loadGPSHistory()
    h.unshift(entry)
    localStorage.setItem(GPS_HISTORY_KEY, JSON.stringify(h.slice(0, 100)))
  } catch {}
}

// ─────────────────────────────────────────────────────────────
//  useGPS hook
// ─────────────────────────────────────────────────────────────
export function useGPS() {
  // status: idle | requesting | granted | denied | unavailable | timeout
  const [status,       setStatus]       = useState('idle')
  const [currentCoord, setCurrentCoord] = useState(null)
  const [error,        setError]        = useState(null)
  const [loading,      setLoading]      = useState(false)
  const watchIdRef = useRef(null)

  const isSupported = typeof navigator !== 'undefined' && 'geolocation' in navigator

  // ── Single position fix ────────────────────────────────────
  const getPosition = useCallback((opts = {}) => {
    return new Promise((resolve, reject) => {
      if (!isSupported) { reject({ code: 2, message: 'Geolocation not supported.' }); return }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout:            12000,
        maximumAge:         0,
        ...opts,
      })
    })
  }, [isSupported])

  // ── Request current location (one-shot) ───────────────────
  const requestCurrent = useCallback(async () => {
    setLoading(true)
    setError(null)
    setStatus('requesting')
    try {
      const pos   = await getPosition()
      const coord = buildCoordSnapshot(pos)
      setCurrentCoord(coord)
      setStatus('granted')
      setLoading(false)
      return coord
    } catch (err) {
      const msg = friendlyGPSError(err)
      setError(msg)
      setLoading(false)
      setStatus(err.code === 1 ? 'denied' : err.code === 3 ? 'timeout' : 'unavailable')
      return null
    }
  }, [getPosition])

  // ── Start watchPosition (continuous updates) ───────────────
  const startWatch = useCallback(() => {
    if (!isSupported || watchIdRef.current != null) return
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setCurrentCoord(buildCoordSnapshot(pos))
        setStatus('granted')
        setError(null)
      },
      (err) => {
        setError(friendlyGPSError(err))
        if (err.code === 1) setStatus('denied')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    )
  }, [isSupported])

  // ── Stop watchPosition ─────────────────────────────────────
  const stopWatch = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  useEffect(() => () => stopWatch(), [stopWatch])

  return { isSupported, status, currentCoord, error, loading, requestCurrent, startWatch, stopWatch }
}

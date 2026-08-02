// ─── GPS History Context ──────────────────────────────────────
// Thin wrapper around the gpsSyncService module singleton.
// Mounts the service on first child render, unmounts on last
// child unmount, and re-renders when health state changes.

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { gpsSyncService }           from '../services/gpsSyncService'
import { gpsHistoryRepository }     from '../repositories/gpsHistoryRepository'
import { gpsSettingsRepository }    from '../repositories/gpsSettingsRepository'

const GpsHistoryContext = createContext(null)

export function GpsHistoryProvider({ children }) {
  const [health, setHealth] = useState(() => gpsSyncService.getHealth())
  const [running, setRunning] = useState(false)
  const [fleet, setFleet] = useState([])
  const [snapshots, setSnapshots] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const lastSyncRef = useRef(null)

  // Subscribe to service health changes
  useEffect(() => {
    const unsub = gpsSyncService.subscribe(({ health, running }) => {
      setHealth({ ...health })
      setRunning(!!running)
    })
    return unsub
  }, [])

  // Load settings + initial fleet snapshot on mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const [s, f] = await Promise.all([
          gpsSettingsRepository.getAsObject(),
          gpsHistoryRepository.getLatestForFleet(),
        ])
        if (cancelled) return
        setSettings(s)
        setSnapshots(f)
        lastSyncRef.current = f
      } catch (err) {
        if (!cancelled) setError(err?.message ?? 'Failed to load GPS data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Start/stop polling based on mounted lifecycle
  useEffect(() => {
    gpsSyncService.start()
    return () => gpsSyncService.stop()
  }, [])

  // Periodically refresh the latest snapshot view (cheap query)
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const f = await gpsHistoryRepository.getLatestForFleet()
        setSnapshots(f)
        lastSyncRef.current = f
      } catch {}
    }, 15_000)
    return () => clearInterval(t)
  }, [])

  const syncNow = useCallback(async () => {
    try {
      await gpsSyncService.syncNow()
      const f = await gpsHistoryRepository.getLatestForFleet()
      setSnapshots(f)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err?.message ?? 'Sync failed' }
    }
  }, [])

  const healthCheck = useCallback(() => gpsSyncService.healthCheck(), [])

  const reloadSettings = useCallback(async () => {
    const s = await gpsSettingsRepository.getAsObject()
    setSettings(s)
    return s
  }, [])

  const value = {
    health,
    running,
    fleet,         // computed {online, moving, stopped, offline, avgSpeed, lastSync}
    snapshots,     // raw gps_tracking latest per vehicle
    settings,
    loading,
    error,
    syncNow,
    healthCheck,
    reloadSettings,
  }

  return (
    <GpsHistoryContext.Provider value={value}>
      {children}
    </GpsHistoryContext.Provider>
  )
}

export function useGpsHistory() {
  const ctx = useContext(GpsHistoryContext)
  if (!ctx) {
    throw new Error('useGpsHistory must be used within GpsHistoryProvider')
  }
  // Derive fleet KPIs from snapshots
  const summary = computeFleetSummary(ctx.snapshots)
  return { ...ctx, fleet: { ...ctx.fleet, ...summary } }
}

function computeFleetSummary(snapshots = []) {
  let online = 0, moving = 0, stopped = 0, offline = 0, gpsOn = 0, gpsOff = 0, ignitionOn = 0, ignitionOff = 0
  let speedSum = 0, speedCount = 0
  let lastSync = null
  for (const s of snapshots) {
    const ts = s.timestamp ? new Date(s.timestamp).getTime() : 0
    const isRecent = ts && (Date.now() - ts) < 5 * 60_000
    if (isRecent) {
      online++
      if (s.ignition === true) ignitionOn++; else if (s.ignition === false) ignitionOff++
      if (s.gps_online !== false) gpsOn++; else gpsOff++
      if ((s.speed_kmh ?? 0) > 0) {
        moving++
        speedSum += Number(s.speed_kmh ?? 0)
        speedCount++
      } else {
        stopped++
      }
    } else {
      offline++
    }
    if (ts && (!lastSync || ts > lastSync)) lastSync = ts
  }
  return {
    online,
    moving,
    stopped,
    offline,
    gpsOn,
    gpsOff,
    ignitionOn,
    ignitionOff,
    avgSpeed: speedCount ? Math.round(speedSum / speedCount) : 0,
    lastSync: lastSync ? new Date(lastSync).toISOString() : null,
  }
}
// ─── useDriverStatus Hook ─────────────────────────────────────
// Tracks live driver status and persists to localStorage.
// Auto-goes Offline after 10 minutes with no GPS update.

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  saveDriverStatus,
  getDriverStatus,
  getStatusCfg,
  STATUS_CONFIG,
  DRIVER_STATUS_OFFLINE_MS,
} from '../data/driverStatusData'

export function useDriverStatus(driverName) {
  const [status, setStatus] = useState(() =>
    driverName ? getDriverStatus(driverName) : 'offline'
  )
  const offlineTimer = useRef(null)

  function resetOfflineTimer() {
    if (offlineTimer.current) clearTimeout(offlineTimer.current)
    offlineTimer.current = setTimeout(() => {
      setStatus(prev => {
        if (prev !== 'offline') {
          saveDriverStatus(driverName, 'offline', null)
          return 'offline'
        }
        return prev
      })
    }, DRIVER_STATUS_OFFLINE_MS)
  }

  const updateStatus = useCallback((newStatus, area = null) => {
    setStatus(newStatus)
    saveDriverStatus(driverName, newStatus, area)
    resetOfflineTimer()
  }, [driverName]) // eslint-disable-line react-hooks/exhaustive-deps

  // Call on every GPS coordinate update to keep driver "alive"
  const onGPSUpdate = useCallback((area = null) => {
    resetOfflineTimer()
    saveDriverStatus(driverName, status, area)
  }, [driverName, status]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync status from ride lifecycle event string
  const syncFromRideState = useCallback((rideState, area = null) => {
    const map = {
      started:   'driving',
      paused:    'waiting',
      resumed:   'driving',
      completed: 'available',
      cancelled: 'available',
    }
    const mapped = map[rideState]
    if (mapped) updateStatus(mapped, area)
  }, [updateStatus])

  useEffect(() => {
    if (driverName) resetOfflineTimer()
    return () => { if (offlineTimer.current) clearTimeout(offlineTimer.current) }
  }, [driverName]) // eslint-disable-line react-hooks/exhaustive-deps

  const cfg = getStatusCfg(status)

  return {
    status,
    cfg,
    statusLabel: cfg.label,
    statusBadge: cfg.badge,
    statusDot:   cfg.dot,
    updateStatus,
    onGPSUpdate,
    syncFromRideState,
    allStatuses: STATUS_CONFIG,
  }
}

export default useDriverStatus

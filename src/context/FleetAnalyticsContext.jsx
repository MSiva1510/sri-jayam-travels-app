// ─── Fleet Analytics Context ───────────────────────────────────
// Day 36: Provides all analytics data to the FleetAnalytics page.
// Wraps fleetAnalyticsRepository with state management, filters,
// and loading/error handling.

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import {
  fleetAnalyticsRepository,
  rangeForPreset,
} from '../repositories/fleetAnalyticsRepository'

const FleetAnalyticsContext = createContext(null)

const INITIAL_FILTER = {
  preset:     'month',   // today | yesterday | week | month | quarter | custom
  customFrom: '',
  customTo:   '',
  vehicleId:  '',
  driverId:   '',
}

export function FleetAnalyticsProvider({ children }) {
  const [filter,      setFilter]      = useState(INITIAL_FILTER)
  const [activeTab,   setActiveTab]   = useState('kpi')

  // Data buckets — each loaded independently
  const [fleetSummary,     setFleetSummary]     = useState(null)
  const [vehicleSummary,   setVehicleSummary]   = useState([])
  const [driverSummary,    setDriverSummary]     = useState([])
  const [tripSummary,      setTripSummary]       = useState(null)
  const [alertSummary,     setAlertSummary]      = useState(null)
  const [geofenceSummary,  setGeofenceSummary]   = useState(null)
  const [distanceSummary,  setDistanceSummary]   = useState(null)

  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  // Derived date range from filter
  const dateRange = useMemo(
    () => rangeForPreset(filter.preset, filter.customFrom, filter.customTo),
    [filter.preset, filter.customFrom, filter.customTo]
  )

  // Load all data for the active tab
  const loadTab = useCallback(async (tab, range, vId, dId) => {
    setLoading(true); setError(null)
    try {
      switch (tab) {
        case 'kpi':
          setFleetSummary(await fleetAnalyticsRepository.getFleetSummary(range))
          break
        case 'vehicles':
          setVehicleSummary(await fleetAnalyticsRepository.getVehicleSummary(range, vId || null))
          break
        case 'drivers':
          setDriverSummary(await fleetAnalyticsRepository.getDriverSummary(range, dId || null))
          break
        case 'trips':
          setTripSummary(await fleetAnalyticsRepository.getTripSummary(range))
          setDistanceSummary(await fleetAnalyticsRepository.getDistanceSummary(range))
          break
        case 'alerts':
          setAlertSummary(await fleetAnalyticsRepository.getAlertSummary(range))
          break
        case 'geofence':
          setGeofenceSummary(await fleetAnalyticsRepository.getGeofenceSummary())
          break
        default:
          break
      }
    } catch (err) {
      setError(err?.message ?? 'Analytics load failed')
    } finally {
      setLoading(false)
    }
  }, [])

  // Load on tab / filter change
  useEffect(() => {
    loadTab(activeTab, dateRange, filter.vehicleId, filter.driverId)
  }, [activeTab, dateRange, filter.vehicleId, filter.driverId, loadTab])

  // Also load KPI on mount regardless of active tab
  useEffect(() => {
    if (activeTab !== 'kpi') {
      fleetAnalyticsRepository.getFleetSummary(dateRange).then(setFleetSummary).catch(() => {})
    }
  }, [dateRange])  // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    loadTab(activeTab, dateRange, filter.vehicleId, filter.driverId)
  }, [loadTab, activeTab, dateRange, filter.vehicleId, filter.driverId])

  const value = {
    // Filters
    filter, setFilter, dateRange,
    // Tab
    activeTab, setActiveTab,
    // Data
    fleetSummary, vehicleSummary, driverSummary, tripSummary,
    alertSummary, geofenceSummary, distanceSummary,
    // State
    loading, error, refresh,
  }

  return (
    <FleetAnalyticsContext.Provider value={value}>
      {children}
    </FleetAnalyticsContext.Provider>
  )
}

export function useFleetAnalytics() {
  const ctx = useContext(FleetAnalyticsContext)
  if (!ctx) throw new Error('useFleetAnalytics must be used within FleetAnalyticsProvider')
  return ctx
}

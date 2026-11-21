// ─── Driver Data — Supabase drivers + bookings tables ────────
// Provides the cached driver registry used by driver pages.

import { TRIP_TYPE_CONFIG } from './tripTypes'
import { withCache } from '../utils/dataCache'
import { driverRepository } from '../repositories/driverRepository'

// Trip type display map (used by driver-facing pages)
export const TRIP_TYPES = Object.fromEntries(
  Object.entries(TRIP_TYPE_CONFIG).map(([k, v]) => [k, v.label])
)

async function _loadDrivers() {
  try {
    return await driverRepository.getAll()
  } catch (error) {
    console.error('[driverData] loadDrivers failed:', error)
    throw error
  }
}

export const loadDrivers = withCache('drivers', _loadDrivers)

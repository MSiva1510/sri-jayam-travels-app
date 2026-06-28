// ─────────────────────────────────────────────────────────────────────
// GPS REPOSITORY
// Handles GPS tracking and route data
// ─────────────────────────────────────────────────────────────────────

import { BaseRepository } from './baseRepository'
import supabase from '../lib/supabase'
import { getDatabaseProvider, DATABASE_PROVIDERS } from '../config/database'
import { dataService } from '../services/dataService'

const GPS_STORAGE_KEY = 'sjt_gps_history'
const ROUTES_STORAGE_KEY = 'sjt_trip_routes'

/**
 * GPSRepository - Manages GPS data
 */
export class GPSRepository {
  async getAllGPSLogs() {
    const provider = getDatabaseProvider()
    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      return this._getAllGPSLogsFromSupabase()
    }
    return this._getAllGPSLogsFromLocal()
  }

  async getGPSLogsByTrip(tripId) {
    const provider = getDatabaseProvider()
    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      try {
        const { data, error } = await supabase
          .from('trip_timelines')
          .select('*')
          .eq('booking_id', tripId)
        if (error) throw error
        return data || []
      } catch (error) {
        return this._getGPSLogsByTripLocal(tripId)
      }
    }
    return this._getGPSLogsByTripLocal(tripId)
  }

  async createGPSLog(data) {
    const provider = getDatabaseProvider()
    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      return this._createGPSLogInSupabase(data)
    }
    return this._createGPSLogInLocal(data)
  }

  async getRouteByTrip(tripId) {
    const provider = getDatabaseProvider()
    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      try {
        const { data, error } = await supabase
          .from('trip_routes')
          .select('*')
          .eq('booking_id', tripId)
          .single()
        if (error && error.code === 'PGRST116') return null
        if (error) throw error
        return data || null
      } catch (error) {
        return this._getRouteByTripLocal(tripId)
      }
    }
    return this._getRouteByTripLocal(tripId)
  }

  async saveRoute(tripId, routeData) {
    const provider = getDatabaseProvider()
    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      return this._saveRouteInSupabase(tripId, routeData)
    }
    return this._saveRouteInLocal(tripId, routeData)
  }

  // ── LOCAL METHODS ──────────────────────────────────────────────

  _getAllGPSLogsFromLocal() {
    const items = dataService.get(GPS_STORAGE_KEY, [])
    return Promise.resolve(items)
  }

  _getGPSLogsByTripLocal(tripId) {
    const items = dataService.get(GPS_STORAGE_KEY, [])
    return Promise.resolve(items.filter(log => log.trip_id === tripId))
  }

  _createGPSLogInLocal(data) {
    const items = dataService.get(GPS_STORAGE_KEY, [])
    const log = {
      ...data,
      id: data.id || `GPS-${Date.now()}`,
      created_at: new Date().toISOString(),
    }
    items.push(log)
    dataService.set(GPS_STORAGE_KEY, items)
    return Promise.resolve(log)
  }

  _getRouteByTripLocal(tripId) {
    const routes = dataService.get(ROUTES_STORAGE_KEY, [])
    const route = routes.find(r => r.trip_id === tripId)
    return Promise.resolve(route || null)
  }

  _saveRouteInLocal(tripId, routeData) {
    const routes = dataService.get(ROUTES_STORAGE_KEY, [])
    const index = routes.findIndex(r => r.trip_id === tripId)
    const route = {
      trip_id: tripId,
      route_data: routeData,
      created_at: new Date().toISOString(),
    }
    if (index === -1) {
      routes.push(route)
    } else {
      routes[index] = route
    }
    dataService.set(ROUTES_STORAGE_KEY, routes)
    return Promise.resolve(route)
  }

  // ── SUPABASE METHODS ──────────────────────────────────────────

  async _getAllGPSLogsFromSupabase() {
    try {
      const { data, error } = await supabase
        .from('trip_timelines')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching GPS logs:', error)
      return this._getAllGPSLogsFromLocal()
    }
  }

  async _createGPSLogInSupabase(data) {
    try {
      const log = {
        ...data,
        created_at: new Date().toISOString(),
      }
      const { data: created, error } = await supabase
        .from('trip_timelines')
        .insert([log])
        .select()
        .single()
      if (error) throw error
      return created
    } catch (error) {
      console.error('Error creating GPS log:', error)
      return this._createGPSLogInLocal(data)
    }
  }

  async _saveRouteInSupabase(tripId, routeData) {
    try {
      const route = {
        booking_id: tripId,
        route_data: routeData,
      }
      const { data, error } = await supabase
        .from('trip_routes')
        .upsert([route])
        .select()
        .single()
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error saving route:', error)
      return this._saveRouteInLocal(tripId, routeData)
    }
  }
}

export const gpsRepository = new GPSRepository()
export default GPSRepository
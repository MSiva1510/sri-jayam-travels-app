// ─────────────────────────────────────────────────────────────────────
// TRIP REPOSITORY
// Handles trip data operations with Supabase and localStorage
// ─────────────────────────────────────────────────────────────────────

import { BaseRepository } from './baseRepository'
import supabase from '../lib/supabase'
import { getDatabaseProvider, DATABASE_PROVIDERS } from '../config/database'
import { dataService } from '../services/dataService'

const TRIPS_STORAGE_KEY = 'sjt_trips'

/**
 * TripRepository - Manages trip data
 */
export class TripRepository extends BaseRepository {
  constructor() {
    super('bookings', 'id')
  }

  async getAll() {
    const provider = getDatabaseProvider()
    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      return this._getAllFromSupabase()
    }
    return this._getAllFromLocal()
  }

  async getById(id) {
    const provider = getDatabaseProvider()
    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      return this._getByIdFromSupabase(id)
    }
    return this._getByIdFromLocal(id)
  }

  async getByStatus(status) {
    const provider = getDatabaseProvider()
    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('*')
          .eq('status', status)
        if (error) throw error
        return data || []
      } catch (error) {
        console.error('Get by status failed:', error)
        return this._getByStatusLocal(status)
      }
    }
    return this._getByStatusLocal(status)
  }

  async getByDriver(driverId) {
    const provider = getDatabaseProvider()
    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('*')
          .eq('driver_id', driverId)
        if (error) throw error
        return data || []
      } catch (error) {
        console.error('Get by driver failed:', error)
        return this._getByDriverLocal(driverId)
      }
    }
    return this._getByDriverLocal(driverId)
  }

  async getByCustomer(customerId) {
    const provider = getDatabaseProvider()
    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('*')
          .eq('customer_id', customerId)
        if (error) throw error
        return data || []
      } catch (error) {
        console.error('Get by customer failed:', error)
        return this._getByCustomerLocal(customerId)
      }
    }
    return this._getByCustomerLocal(customerId)
  }

  async create(data) {
    const provider = getDatabaseProvider()
    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      return this._createInSupabase(data)
    }
    return this._createInLocal(data)
  }

  async update(id, data) {
    const provider = getDatabaseProvider()
    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      return this._updateInSupabase(id, data)
    }
    return this._updateInLocal(id, data)
  }

  async delete(id) {
    const provider = getDatabaseProvider()
    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      return this._deleteFromSupabase(id)
    }
    return this._deleteFromLocal(id)
  }

  // ── LOCAL METHODS ──────────────────────────────────────────────

  _getAllFromLocal() {
    const items = dataService.get(TRIPS_STORAGE_KEY, [])
    return Promise.resolve(items)
  }

  _getByIdFromLocal(id) {
    const items = dataService.get(TRIPS_STORAGE_KEY, [])
    const item = items.find(t => t.id === id)
    return Promise.resolve(item || null)
  }

  _getByStatusLocal(status) {
    const items = dataService.get(TRIPS_STORAGE_KEY, [])
    return Promise.resolve(items.filter(t => t.status === status))
  }

  _getByDriverLocal(driverId) {
    const items = dataService.get(TRIPS_STORAGE_KEY, [])
    return Promise.resolve(items.filter(t => t.driver_id === driverId))
  }

  _getByCustomerLocal(customerId) {
    const items = dataService.get(TRIPS_STORAGE_KEY, [])
    return Promise.resolve(items.filter(t => t.customer_id === customerId))
  }

  _createInLocal(data) {
    const items = dataService.get(TRIPS_STORAGE_KEY, [])
    const trip = {
      ...data,
      id: data.id || `TRIP-${Date.now().toString().slice(-6)}`,
      created_at: data.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    items.push(trip)
    dataService.set(TRIPS_STORAGE_KEY, items)
    return Promise.resolve(trip)
  }

  _updateInLocal(id, data) {
    const items = dataService.get(TRIPS_STORAGE_KEY, [])
    const index = items.findIndex(t => t.id === id)
    if (index === -1) {
      return Promise.reject(new Error(`Trip ${id} not found`))
    }
    const updated = {
      ...items[index],
      ...data,
      updated_at: new Date().toISOString(),
    }
    items[index] = updated
    dataService.set(TRIPS_STORAGE_KEY, items)
    return Promise.resolve(updated)
  }

  _deleteFromLocal(id) {
    const items = dataService.get(TRIPS_STORAGE_KEY, [])
    const filtered = items.filter(t => t.id !== id)
    dataService.set(TRIPS_STORAGE_KEY, filtered)
    return Promise.resolve(true)
  }

  // ── SUPABASE METHODS ──────────────────────────────────────────

  async _getAllFromSupabase() {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching trips from Supabase:', error)
      return this._getAllFromLocal()
    }
  }

  async _getByIdFromSupabase(id) {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', id)
        .single()
      if (error && error.code === 'PGRST116') {
        return null
      }
      if (error) throw error
      return data || null
    } catch (error) {
      console.error('Error fetching trip from Supabase:', error)
      return this._getByIdFromLocal(id)
    }
  }

  async _createInSupabase(data) {
    try {
      const trip = {
        ...data,
        id: data.id || `TRIP-${Date.now().toString().slice(-6)}`,
        created_at: data.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const { data: created, error } = await supabase
        .from('bookings')
        .insert([trip])
        .select()
        .single()
      if (error) throw error
      return created
    } catch (error) {
      console.error('Error creating trip in Supabase:', error)
      return this._createInLocal(data)
    }
  }

  async _updateInSupabase(id, data) {
    try {
      const { data: updated, error } = await supabase
        .from('bookings')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return updated
    } catch (error) {
      console.error('Error updating trip in Supabase:', error)
      return this._updateInLocal(id, data)
    }
  }

  async _deleteFromSupabase(id) {
    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id)
      if (error) throw error
      return true
    } catch (error) {
      console.error('Error deleting trip from Supabase:', error)
      return this._deleteFromLocal(id)
    }
  }
}

export const tripRepository = new TripRepository()
export default TripRepository
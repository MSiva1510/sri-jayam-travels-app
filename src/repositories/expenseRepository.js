// ─────────────────────────────────────────────────────────────────────
// EXPENSE REPOSITORY
// Handles expense data management
// ─────────────────────────────────────────────────────────────────────

import { BaseRepository } from './baseRepository'
import supabase from '../lib/supabase'
import { getDatabaseProvider, DATABASE_PROVIDERS } from '../config/database'
import { dataService } from '../services/dataService'

const EXPENSES_STORAGE_KEY = 'sjt_expenses'

/**
 * ExpenseRepository - Manages expense data
 */
export class ExpenseRepository extends BaseRepository {
  constructor() {
    super('expenses', 'id')
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

  async getByDriver(driverId) {
    const provider = getDatabaseProvider()
    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      try {
        const { data, error } = await supabase
          .from('expenses')
          .select('*')
          .eq('driver_id', driverId)
        if (error) throw error
        return data || []
      } catch (error) {
        return this._getByDriverLocal(driverId)
      }
    }
    return this._getByDriverLocal(driverId)
  }

  async getByTrip(tripId) {
    const provider = getDatabaseProvider()
    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      try {
        const { data, error } = await supabase
          .from('expenses')
          .select('*')
          .eq('booking_id', tripId)
        if (error) throw error
        return data || []
      } catch (error) {
        return this._getByTripLocal(tripId)
      }
    }
    return this._getByTripLocal(tripId)
  }

  async getByStatus(status) {
    const provider = getDatabaseProvider()
    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      try {
        const { data, error } = await supabase
          .from('expenses')
          .select('*')
          .eq('status', status)
        if (error) throw error
        return data || []
      } catch (error) {
        return this._getByStatusLocal(status)
      }
    }
    return this._getByStatusLocal(status)
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
    return Promise.resolve(dataService.get(EXPENSES_STORAGE_KEY, []))
  }

  _getByIdFromLocal(id) {
    const items = dataService.get(EXPENSES_STORAGE_KEY, [])
    return Promise.resolve(items.find(e => e.id === id) || null)
  }

  _getByDriverLocal(driverId) {
    const items = dataService.get(EXPENSES_STORAGE_KEY, [])
    return Promise.resolve(items.filter(e => e.driver_id === driverId))
  }

  _getByTripLocal(tripId) {
    const items = dataService.get(EXPENSES_STORAGE_KEY, [])
    return Promise.resolve(items.filter(e => e.booking_id === tripId))
  }

  _getByStatusLocal(status) {
    const items = dataService.get(EXPENSES_STORAGE_KEY, [])
    return Promise.resolve(items.filter(e => e.status === status))
  }

  _createInLocal(data) {
    const items = dataService.get(EXPENSES_STORAGE_KEY, [])
    const expense = {
      ...data,
      id: data.id || `EXP-${Date.now().toString().slice(-6)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    items.push(expense)
    dataService.set(EXPENSES_STORAGE_KEY, items)
    return Promise.resolve(expense)
  }

  _updateInLocal(id, data) {
    const items = dataService.get(EXPENSES_STORAGE_KEY, [])
    const index = items.findIndex(e => e.id === id)
    if (index === -1) return Promise.reject(new Error('Not found'))
    const updated = { ...items[index], ...data, updated_at: new Date().toISOString() }
    items[index] = updated
    dataService.set(EXPENSES_STORAGE_KEY, items)
    return Promise.resolve(updated)
  }

  _deleteFromLocal(id) {
    const items = dataService.get(EXPENSES_STORAGE_KEY, [])
    dataService.set(EXPENSES_STORAGE_KEY, items.filter(e => e.id !== id))
    return Promise.resolve(true)
  }

  // ── SUPABASE METHODS ──────────────────────────────────────────

  async _getAllFromSupabase() {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    } catch (error) {
      return this._getAllFromLocal()
    }
  }

  async _getByIdFromSupabase(id) {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('id', id)
        .single()
      if (error && error.code === 'PGRST116') return null
      if (error) throw error
      return data || null
    } catch (error) {
      return this._getByIdFromLocal(id)
    }
  }

  async _createInSupabase(data) {
    try {
      const expense = {
        ...data,
        id: data.id || `EXP-${Date.now().toString().slice(-6)}`,
        created_at: data.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const { data: created, error } = await supabase
        .from('expenses')
        .insert([expense])
        .select()
        .single()
      if (error) throw error
      return created
    } catch (error) {
      return this._createInLocal(data)
    }
  }

  async _updateInSupabase(id, data) {
    try {
      const { data: updated, error } = await supabase
        .from('expenses')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return updated
    } catch (error) {
      return this._updateInLocal(id, data)
    }
  }

  async _deleteFromSupabase(id) {
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) throw error
      return true
    } catch (error) {
      return this._deleteFromLocal(id)
    }
  }
}

export const expenseRepository = new ExpenseRepository()
export default ExpenseRepository
// ─────────────────────────────────────────────────────────────────────
// EXPENSE REPOSITORY
// Handles expense data management
// ─────────────────────────────────────────────────────────────────────

import { BaseRepository } from './baseRepository'
import supabase from '../lib/supabase'
import { getDatabaseProvider, DATABASE_PROVIDERS } from '../config/database'
import { dataService } from '../services/dataService'

const EXPENSES_STORAGE_KEY = 'sjt_expenses'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Detail-column aliases and SELECT strings live in a pure module so they can
// be unit-tested without the Supabase/browser dependency chain.
import {
  BASE_EXPENSE_SELECT, DETAIL_COLUMNS, DETAIL_COLUMN_RE,
  EXPENSE_SELECT, toDbExpense,
} from '../utils/expenseMapping'

export { EXPENSE_SELECT, toDbExpense }

// Reads retry without the detail columns if 20261118_expense_type_details.sql
// has not been applied yet; the verdict is remembered per session.
let detailColumnsSupported = null

/**
 * ExpenseRepository - Manages expense data
 */
export class ExpenseRepository extends BaseRepository {
  constructor() {
    super('expenses', 'id')
  }

  _expenseSelect(withDetails = true) {
    return withDetails ? EXPENSE_SELECT : BASE_EXPENSE_SELECT
  }

  _isMissingDetailColumnRead(error) {
    const msg = String(error?.message || '')
    return /column .* does not exist|Could not find the '.*' column/i.test(msg) &&
      DETAIL_COLUMN_RE.test(msg)
  }

  _isMissingDetailColumnError(error) {
    return this._isMissingDetailColumnRead(error)
  }

  _withoutDetailColumns(obj = {}) {
    return Object.fromEntries(Object.entries(obj).filter(([key]) => !DETAIL_COLUMNS.includes(key)))
  }

  // Runs an expenses read with detail columns, falling back to the base
  // column set once per session if the migration has not been applied.
  async _readExpenses(build, fallback = []) {
    if (detailColumnsSupported === false) {
      const result = await build(false)
      if (result.error) throw result.error
      return result.data ?? fallback
    }
    const first = await build(true)
    if (!first.error) {
      detailColumnsSupported = true
      return first.data ?? fallback
    }
    if (this._isMissingDetailColumnRead(first.error)) {
      detailColumnsSupported = false
      const retry = await build(false)
      if (retry.error) throw retry.error
      return retry.data ?? fallback
    }
    throw first.error
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
        return await this._readExpenses(withDetails => supabase
          .from('expenses')
          .select(this._expenseSelect(withDetails))
          .eq('driver_id', driverId))
      } catch (error) {
        console.error(error)
        throw error
      }
    }
    return this._getByDriverLocal(driverId)
  }

  async getByTrip(tripId) {
    const provider = getDatabaseProvider()
    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      try {
        return await this._readExpenses(withDetails => supabase
          .from('expenses')
          .select(this._expenseSelect(withDetails))
          .eq('booking_id', tripId))
      } catch (error) {
        console.error(error)
        throw error
      }
    }
    return this._getByTripLocal(tripId)
  }

  async getByStatus(status) {
    const provider = getDatabaseProvider()
    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      try {
        return await this._readExpenses(withDetails => supabase
          .from('expenses')
          .select(this._expenseSelect(withDetails))
          .eq('status', status))
      } catch (error) {
        console.error(error)
        throw error
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
      return await this._readExpenses(withDetails => supabase
        .from('expenses')
        .select(this._expenseSelect(withDetails))
        .order('created_at', { ascending: false }))
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  async _getByIdFromSupabase(id) {
    if (!UUID_RE.test(String(id))) return null
    try {
      return await this._readExpenses(async withDetails => {
        const { data, error } = await supabase
          .from('expenses')
          .select(this._expenseSelect(withDetails))
          .eq('id', id)
          .single()
        if (error?.code === 'PGRST116') return { data: null, error: null }
        return { data, error }
      }, null)
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  async _createInSupabase(data) {
    try {
      const expense = {
        ...toDbExpense(data),
        ...(UUID_RE.test(String(data.id || '')) ? { id: data.id } : {}),
        created_at: data.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      try {
        const { data: created, error } = await supabase
          .from('expenses')
          .insert([expense])
          .select()
          .single()
        if (error) throw error
        return created
      } catch (error) {
        if (!this._isMissingDetailColumnError(error)) throw error
        console.warn('[expenseRepository] type detail columns missing — saving expense without parking/toll/bata/maintenance details. Apply migration 20261118_expense_type_details.')
        const { data: created, error: retryError } = await supabase
          .from('expenses')
          .insert([this._withoutDetailColumns(expense)])
          .select()
          .single()
        if (retryError) throw retryError
        return created
      }
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  async _updateInSupabase(id, data) {
    if (!UUID_RE.test(String(id))) {
      throw new Error(`Cannot update expense ${id}: Supabase expense id must be a UUID`)
    }
    try {
      const expense = { ...toDbExpense(data), updated_at: new Date().toISOString() }
      try {
        const { data: updated, error } = await supabase
          .from('expenses')
          .update(expense)
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return updated
      } catch (error) {
        if (!this._isMissingDetailColumnError(error)) throw error
        console.warn('[expenseRepository] type detail columns missing — updating expense without parking/toll/bata/maintenance details. Apply migration 20261118_expense_type_details.')
        const { data: updated, error: retryError } = await supabase
          .from('expenses')
          .update(this._withoutDetailColumns(expense))
          .eq('id', id)
          .select()
          .single()
        if (retryError) throw retryError
        return updated
      }
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  async _deleteFromSupabase(id) {
    if (!UUID_RE.test(String(id))) {
      throw new Error(`Cannot delete expense ${id}: Supabase expense id must be a UUID`)
    }
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) throw error
      return true
    } catch (error) {
      console.error(error)
      throw error
    }
  }
}

export const expenseRepository = new ExpenseRepository()
export default ExpenseRepository

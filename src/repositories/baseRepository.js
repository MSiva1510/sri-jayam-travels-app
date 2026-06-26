// ─────────────────────────────────────────────────────────────────────
// BASE REPOSITORY
// Abstract base class for all data repositories
// Provides common CRUD operations interface
// ─────────────────────────────────────────────────────────────────────

import { dataService } from '../services/dataService'
import { getDatabaseProvider, DATABASE_PROVIDERS } from '../config/database'
import supabase from '../lib/supabase'

/**
 * BaseRepository - Abstract base class for data access
 * 
 * Usage:
 * class UserRepository extends BaseRepository {
 *   constructor() {
 *     super('users', 'id')
 *   }
 * }
 * 
 * const repo = new UserRepository()
 * const user = await repo.getById('user-123')
 */
export class BaseRepository {
  /**
   * @param {string} tableName - Name of the table/collection
   * @param {string} primaryKey - Name of the primary key field (default: 'id')
   */
  constructor(tableName, primaryKey = 'id') {
    this.tableName = tableName
    this.primaryKey = primaryKey
  }

  /**
   * Get storage key for localStorage
   * @returns {string} Storage key
   */
  getStorageKey() {
    return `sjt_${this.tableName}`
  }

  /**
   * Get all items
   * @returns {Promise<Array>} Array of items
   */
  async getAll() {
    const provider = getDatabaseProvider()

    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      return this._getAllFromSupabase()
    }

    return this._getAllFromLocal()
  }

  /**
   * Get item by ID
   * @param {string|number} id - Item ID
   * @returns {Promise<Object|null>} Item or null
   */
  async getById(id) {
    const provider = getDatabaseProvider()

    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      return this._getByIdFromSupabase(id)
    }

    return this._getByIdFromLocal(id)
  }

  /**
   * Create item
   * @param {Object} data - Item data
   * @returns {Promise<Object>} Created item
   */
  async create(data) {
    const provider = getDatabaseProvider()

    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      return this._createInSupabase(data)
    }

    return this._createInLocal(data)
  }

  /**
   * Update item
   * @param {string|number} id - Item ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated item
   */
  async update(id, data) {
    const provider = getDatabaseProvider()

    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      return this._updateInSupabase(id, data)
    }

    return this._updateInLocal(id, data)
  }

  /**
   * Delete item
   * @param {string|number} id - Item ID
   * @returns {Promise<boolean>} Success status
   */
  async delete(id) {
    const provider = getDatabaseProvider()

    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      return this._deleteFromSupabase(id)
    }

    return this._deleteFromLocal(id)
  }

  // ── LOCAL STORAGE METHODS ──────────────────────────────────────────

  /**
   * Get all items from localStorage
   * @private
   */
  _getAllFromLocal() {
    const items = dataService.get(this.getStorageKey(), [])
    return Promise.resolve(items)
  }

  /**
   * Get item by ID from localStorage
   * @private
   */
  _getByIdFromLocal(id) {
    const items = dataService.get(this.getStorageKey(), [])
    const item = items.find(i => i[this.primaryKey] === id)
    return Promise.resolve(item || null)
  }

  /**
   * Create item in localStorage
   * @private
   */
  _createInLocal(data) {
    const items = dataService.get(this.getStorageKey(), [])
    const item = {
      ...data,
      [this.primaryKey]: data[this.primaryKey] || `${this.tableName}-${Date.now()}`,
      createdAt: data.createdAt || new Date().toISOString(),
    }
    items.push(item)
    dataService.set(this.getStorageKey(), items)
    return Promise.resolve(item)
  }

  /**
   * Update item in localStorage
   * @private
   */
  _updateInLocal(id, data) {
    const items = dataService.get(this.getStorageKey(), [])
    const index = items.findIndex(i => i[this.primaryKey] === id)
    if (index === -1) {
      return Promise.reject(new Error(`${this.tableName} with ID ${id} not found`))
    }
    const updated = {
      ...items[index],
      ...data,
      updatedAt: new Date().toISOString(),
    }
    items[index] = updated
    dataService.set(this.getStorageKey(), items)
    return Promise.resolve(updated)
  }

  /**
   * Delete item from localStorage
   * @private
   */
  _deleteFromLocal(id) {
    const items = dataService.get(this.getStorageKey(), [])
    const filtered = items.filter(i => i[this.primaryKey] !== id)
    dataService.set(this.getStorageKey(), filtered)
    return Promise.resolve(true)
  }

  // ── SUPABASE METHODS ──────────────────────────────────────────────

  /**
   * Get all items from Supabase
   * @private
   */
  async _getAllFromSupabase() {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')

      if (error) throw error
      return data || []
    } catch (error) {
      console.error(`Error fetching ${this.tableName}:`, error)
      // Fallback to localStorage on error
      return this._getAllFromLocal()
    }
  }

  /**
   * Get item by ID from Supabase
   * @private
   */
  async _getByIdFromSupabase(id) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq(this.primaryKey, id)
        .single()

      if (error && error.code === 'PGRST116') {
        return null  // Not found
      }

      if (error) throw error
      return data || null
    } catch (error) {
      console.error(`Error fetching ${this.tableName} by ID:`, error)
      // Fallback to localStorage on error
      return this._getByIdFromLocal(id)
    }
  }

  /**
   * Create item in Supabase
   * @private
   */
  async _createInSupabase(data) {
    try {
      const item = {
        ...data,
        createdAt: data.createdAt || new Date().toISOString(),
      }

      const { data: created, error } = await supabase
        .from(this.tableName)
        .insert([item])
        .select()
        .single()

      if (error) throw error
      return created
    } catch (error) {
      console.error(`Error creating ${this.tableName}:`, error)
      // Fallback to localStorage on error
      return this._createInLocal(data)
    }
  }

  /**
   * Update item in Supabase
   * @private
   */
  async _updateInSupabase(id, data) {
    try {
      const update = {
        ...data,
        updatedAt: new Date().toISOString(),
      }

      const { data: updated, error } = await supabase
        .from(this.tableName)
        .update(update)
        .eq(this.primaryKey, id)
        .select()
        .single()

      if (error) throw error
      return updated
    } catch (error) {
      console.error(`Error updating ${this.tableName}:`, error)
      // Fallback to localStorage on error
      return this._updateInLocal(id, data)
    }
  }

  /**
   * Delete item from Supabase
   * @private
   */
  async _deleteFromSupabase(id) {
    try {
      const { error } = await supabase
        .from(this.tableName)
        .delete()
        .eq(this.primaryKey, id)

      if (error) throw error
      return true
    } catch (error) {
      console.error(`Error deleting ${this.tableName}:`, error)
      // Fallback to localStorage on error
      return this._deleteFromLocal(id)
    }
  }
}

export default BaseRepository
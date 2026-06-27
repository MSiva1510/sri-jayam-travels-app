// ─────────────────────────────────────────────────────────────────────
// DRIVER REPOSITORY
// Handles driver data operations with Supabase and localStorage
// ─────────────────────────────────────────────────────────────────────

import { BaseRepository } from './baseRepository'
import supabase from '../lib/supabase'
import { getDatabaseProvider, DATABASE_PROVIDERS } from '../config/database'
import { dataService } from '../services/dataService'

const DRIVERS_STORAGE_KEY = 'sjt_drivers'

/**
 * DriverRepository - Manages driver data
 */
export class DriverRepository extends BaseRepository {
  constructor() {
    super('drivers', 'id')
  }

  /**
   * Get all drivers
   * @returns {Promise<Array>}
   */
  async getAll() {
    const provider = getDatabaseProvider()

    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      return this._getAllFromSupabase()
    }

    return this._getAllFromLocal()
  }

  /**
   * Get driver by ID
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async getById(id) {
    const provider = getDatabaseProvider()

    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      return this._getByIdFromSupabase(id)
    }

    return this._getByIdFromLocal(id)
  }

  /**
   * Search drivers by name
   * @param {string} name
   * @returns {Promise<Array>}
   */
  async searchByName(name) {
    const provider = getDatabaseProvider()

    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      try {
        const { data, error } = await supabase
          .from('drivers')
          .select('*')
          .ilike('name', `%${name}%`)

        if (error) throw error
        return data || []
      } catch (error) {
        console.error('Search driver by name failed:', error)
        return this._searchByNameLocal(name)
      }
    }

    return this._searchByNameLocal(name)
  }

  /**
   * Search drivers by phone
   * @param {string} phone
   * @returns {Promise<Array>}
   */
  async searchByPhone(phone) {
    const provider = getDatabaseProvider()

    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      try {
        const { data, error } = await supabase
          .from('drivers')
          .select('*')
          .ilike('phone', `%${phone}%`)

        if (error) throw error
        return data || []
      } catch (error) {
        console.error('Search driver by phone failed:', error)
        return this._searchByPhoneLocal(phone)
      }
    }

    return this._searchByPhoneLocal(phone)
  }

  /**
   * Create driver
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async create(data) {
    const provider = getDatabaseProvider()

    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      return this._createInSupabase(data)
    }

    return this._createInLocal(data)
  }

  /**
   * Update driver
   * @param {string} id
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async update(id, data) {
    const provider = getDatabaseProvider()

    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      return this._updateInSupabase(id, data)
    }

    return this._updateInLocal(id, data)
  }

  /**
   * Delete driver
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    const provider = getDatabaseProvider()

    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      return this._deleteFromSupabase(id)
    }

    return this._deleteFromLocal(id)
  }

  /**
   * Update driver status
   * @param {string} id
   * @param {string} status - 'available' | 'assigned' | 'driving' | 'offline'
   * @returns {Promise<Object>}
   */
  async updateStatus(id, status) {
    return this.update(id, { status, updated_at: new Date().toISOString() })
  }

  /**
   * Get drivers with status
   * @param {string} status
   * @returns {Promise<Array>}
   */
  async getByStatus(status) {
    const drivers = await this.getAll()
    return drivers.filter(d => d.status === status)
  }

  /**
   * Upload driver license image
   * @param {string} driverId
   * @param {File} file
   * @returns {Promise<string>} URL of uploaded file
   */
  async uploadLicenseImage(driverId, file) {
    if (!supabase) {
      return null
    }

    try {
      const fileName = `driver-licenses/${driverId}-${Date.now()}.jpg`
      const { data, error } = await supabase.storage
        .from('documents')
        .upload(fileName, file, { upsert: false })

      if (error) throw error

      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(data.path)

      return urlData.publicUrl
    } catch (error) {
      console.error('License upload failed:', error)
      return null
    }
  }

  /**
   * Upload driver profile photo
   * @param {string} driverId
   * @param {File} file
   * @returns {Promise<string>} URL of uploaded file
   */
  async uploadProfilePhoto(driverId, file) {
    if (!supabase) {
      return null
    }

    try {
      const fileName = `driver-photos/${driverId}-${Date.now()}.jpg`
      const { data, error } = await supabase.storage
        .from('documents')
        .upload(fileName, file, { upsert: false })

      if (error) throw error

      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(data.path)

      return urlData.publicUrl
    } catch (error) {
      console.error('Profile photo upload failed:', error)
      return null
    }
  }

  /**
   * Get driver phone uniqueness status
   * @param {string} phone
   * @param {string} excludeId
   * @returns {Promise<boolean>}
   */
  async isPhoneUnique(phone, excludeId = null) {
    const drivers = await this.getAll()
    return !drivers.some(d => d.phone === phone && d.id !== excludeId)
  }

  /**
   * Get driver license uniqueness status
   * @param {string} licenseNumber
   * @param {string} excludeId
   * @returns {Promise<boolean>}
   */
  async isLicenseUnique(licenseNumber, excludeId = null) {
    const drivers = await this.getAll()
    return !drivers.some(d => d.license_number === licenseNumber && d.id !== excludeId)
  }

  // ── LOCAL METHODS ──────────────────────────────────────────────

  _getAllFromLocal() {
    const items = dataService.get(DRIVERS_STORAGE_KEY, [])
    return Promise.resolve(items)
  }

  _getByIdFromLocal(id) {
    const items = dataService.get(DRIVERS_STORAGE_KEY, [])
    const item = items.find(d => d.id === id)
    return Promise.resolve(item || null)
  }

  _createInLocal(data) {
    const items = dataService.get(DRIVERS_STORAGE_KEY, [])
    const driver = {
      ...data,
      id: data.id || `DRV-${Date.now().toString().slice(-6)}`,
      created_at: data.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    items.push(driver)
    dataService.set(DRIVERS_STORAGE_KEY, items)
    return Promise.resolve(driver)
  }

  _updateInLocal(id, data) {
    const items = dataService.get(DRIVERS_STORAGE_KEY, [])
    const index = items.findIndex(d => d.id === id)
    if (index === -1) {
      return Promise.reject(new Error(`Driver ${id} not found`))
    }
    const updated = {
      ...items[index],
      ...data,
      updated_at: new Date().toISOString(),
    }
    items[index] = updated
    dataService.set(DRIVERS_STORAGE_KEY, items)
    return Promise.resolve(updated)
  }

  _deleteFromLocal(id) {
    const items = dataService.get(DRIVERS_STORAGE_KEY, [])
    const filtered = items.filter(d => d.id !== id)
    dataService.set(DRIVERS_STORAGE_KEY, filtered)
    return Promise.resolve(true)
  }

  _searchByNameLocal(name) {
    const items = dataService.get(DRIVERS_STORAGE_KEY, [])
    const lowerName = name.toLowerCase()
    return Promise.resolve(items.filter(d => d.name?.toLowerCase().includes(lowerName)))
  }

  _searchByPhoneLocal(phone) {
    const items = dataService.get(DRIVERS_STORAGE_KEY, [])
    return Promise.resolve(items.filter(d => d.phone?.includes(phone)))
  }

  // ── SUPABASE METHODS ──────────────────────────────────────────

  async _getAllFromSupabase() {
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching drivers from Supabase:', error)
      return this._getAllFromLocal()
    }
  }

  async _getByIdFromSupabase(id) {
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('id', id)
        .single()

      if (error && error.code === 'PGRST116') {
        return null
      }

      if (error) throw error
      return data || null
    } catch (error) {
      console.error('Error fetching driver from Supabase:', error)
      return this._getByIdFromLocal(id)
    }
  }

  async _createInSupabase(data) {
    try {
      const driver = {
        ...data,
        id: data.id || `DRV-${Date.now().toString().slice(-6)}`,
        created_at: data.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const { data: created, error } = await supabase
        .from('drivers')
        .insert([driver])
        .select()
        .single()

      if (error) throw error
      return created
    } catch (error) {
      console.error('Error creating driver in Supabase:', error)
      return this._createInLocal(data)
    }
  }

  async _updateInSupabase(id, data) {
    try {
      const { data: updated, error } = await supabase
        .from('drivers')
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
      console.error('Error updating driver in Supabase:', error)
      return this._updateInLocal(id, data)
    }
  }

  async _deleteFromSupabase(id) {
    try {
      const { error } = await supabase
        .from('drivers')
        .delete()
        .eq('id', id)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error deleting driver from Supabase:', error)
      return this._deleteFromLocal(id)
    }
  }
}

export const driverRepository = new DriverRepository()
export default DriverRepository
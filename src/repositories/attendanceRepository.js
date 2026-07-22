// ─────────────────────────────────────────────────────────────────────
// ATTENDANCE REPOSITORY
// Handles driver attendance data
// ─────────────────────────────────────────────────────────────────────

import { BaseRepository } from './baseRepository'
import supabase from '../lib/supabase'
import { getDatabaseProvider, DATABASE_PROVIDERS } from '../config/database'
import { dataService } from '../services/dataService'

const ATTENDANCE_STORAGE_KEY = 'sjt_attendance'

/**
 * AttendanceRepository - Manages attendance data
 */
export class AttendanceRepository extends BaseRepository {
  constructor() {
    super('attendance', 'id')
  }

  async getAll() {
    const provider = getDatabaseProvider()
    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      return this._getAllFromSupabase()
    }
    return this._getAllFromLocal()
  }

  async getByDriver(driverId) {
    const provider = getDatabaseProvider()
    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      try {
        const { data, error } = await supabase
          .from('attendance')
          .select('*')
          .eq('driver_id', driverId)
        if (error) throw error
        return data || []
      } catch (error) {
        console.error(error)
        throw error
      }
    }
    return this._getByDriverLocal(driverId)
  }

  async getByDate(date) {
    const provider = getDatabaseProvider()
    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      try {
        const { data, error } = await supabase
          .from('attendance')
          .select('*')
          .eq('attendance_date', date)
        if (error) throw error
        return data || []
      } catch (error) {
        console.error(error)
        throw error
      }
    }
    return this._getByDateLocal(date)
  }

  async getByMonth(month, year) {
    const provider = getDatabaseProvider()
    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      try {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`
        const endDate = `${year}-${String(month).padStart(2, '0')}-31`
        const { data, error } = await supabase
          .from('attendance')
          .select('*')
          .gte('attendance_date', startDate)
          .lte('attendance_date', endDate)
        if (error) throw error
        return data || []
      } catch (error) {
        console.error(error)
        throw error
      }
    }
    return this._getByMonthLocal(month, year)
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
    const items = dataService.get(ATTENDANCE_STORAGE_KEY, [])
    return Promise.resolve(items)
  }

  _getByDriverLocal(driverId) {
    const items = dataService.get(ATTENDANCE_STORAGE_KEY, [])
    return Promise.resolve(items.filter(a => a.driver_id === driverId))
  }

  _getByDateLocal(date) {
    const items = dataService.get(ATTENDANCE_STORAGE_KEY, [])
    return Promise.resolve(items.filter(a => a.attendance_date === date))
  }

  _getByMonthLocal(month, year) {
    const items = dataService.get(ATTENDANCE_STORAGE_KEY, [])
    return Promise.resolve(items.filter(a => {
      const d = new Date(a.attendance_date)
      return d.getMonth() + 1 === month && d.getFullYear() === year
    }))
  }

  _createInLocal(data) {
    const items = dataService.get(ATTENDANCE_STORAGE_KEY, [])
    const record = {
      ...data,
      id: data.id || `ATT-${Date.now().toString().slice(-6)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    items.push(record)
    dataService.set(ATTENDANCE_STORAGE_KEY, items)
    return Promise.resolve(record)
  }

  _updateInLocal(id, data) {
    const items = dataService.get(ATTENDANCE_STORAGE_KEY, [])
    const index = items.findIndex(a => a.id === id)
    if (index === -1) return Promise.reject(new Error('Not found'))
    const updated = {
      ...items[index],
      ...data,
      updated_at: new Date().toISOString(),
    }
    items[index] = updated
    dataService.set(ATTENDANCE_STORAGE_KEY, items)
    return Promise.resolve(updated)
  }

  _deleteFromLocal(id) {
    const items = dataService.get(ATTENDANCE_STORAGE_KEY, [])
    const filtered = items.filter(a => a.id !== id)
    dataService.set(ATTENDANCE_STORAGE_KEY, filtered)
    return Promise.resolve(true)
  }

  // ── SUPABASE METHODS ──────────────────────────────────────────

  async _getAllFromSupabase() {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .order('attendance_date', { ascending: false })
      if (error) throw error
      return data || []
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  async _createInSupabase(data) {
    try {
      const record = {
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const { data: created, error } = await supabase
        .from('attendance')
        .insert([record])
        .select()
        .single()
      if (error) throw error
      return created
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  async _updateInSupabase(id, data) {
    try {
      const { data: updated, error } = await supabase
        .from('attendance')
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
      console.error(error)
      throw error
    }
  }

  async _deleteFromSupabase(id) {
    try {
      const { error } = await supabase
        .from('attendance')
        .delete()
        .eq('id', id)
      if (error) throw error
      return true
    } catch (error) {
      console.error(error)
      throw error
    }
  }
}

export const attendanceRepository = new AttendanceRepository()
export default AttendanceRepository
// ---------------------------------------------------------------------
// ATTENDANCE REPOSITORY (Supabase only)
// Handles driver attendance data
// ---------------------------------------------------------------------

import { BaseRepository } from './baseRepository'
import supabase from '../lib/supabase'

/**
 * AttendanceRepository - Manages attendance data via Supabase
 */
export class AttendanceRepository extends BaseRepository {
  constructor() {
    super('attendance', 'id')
  }

  async getAll() {
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

  async getByDriver(driverId) {
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

  async getByDate(date) {
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

  async getByMonth(month, year) {
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

  async create(data) {
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

  async update(id, data) {
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

  async delete(id) {
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

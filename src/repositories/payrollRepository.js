// ─────────────────────────────────────────────────────────────────────
// PAYROLL REPOSITORY
// Handles payroll and settlement data
// ─────────────────────────────────────────────────────────────────────

import { BaseRepository } from './baseRepository'
import supabase from '../lib/supabase'
import { getDatabaseProvider, DATABASE_PROVIDERS } from '../config/database'
import { dataService } from '../services/dataService'

const PAYSLIPS_STORAGE_KEY = 'sjt_payslips'
const SETTLEMENTS_STORAGE_KEY = 'sjt_settlements'

/**
 * PayrollRepository - Manages payroll data
 */
export class PayrollRepository {
  async getAllPayslips() {
    const provider = getDatabaseProvider()
    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      return this._getAllPayslipsFromSupabase()
    }
    return this._getAllPayslipsFromLocal()
  }

  async getPayslipsByDriver(driverId) {
    const provider = getDatabaseProvider()
    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      try {
        const { data, error } = await supabase
          .from('trip_payslips')
          .select('*')
          .eq('driver_id', driverId)
        if (error) throw error
        return data || []
      } catch (error) {
        return this._getPayslipsByDriverLocal(driverId)
      }
    }
    return this._getPayslipsByDriverLocal(driverId)
  }

  async createPayslip(data) {
    const provider = getDatabaseProvider()
    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      return this._createPayslipInSupabase(data)
    }
    return this._createPayslipInLocal(data)
  }

  async getAllSettlements() {
    const provider = getDatabaseProvider()
    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      return this._getAllSettlementsFromSupabase()
    }
    return this._getAllSettlementsFromLocal()
  }

  async getSettlementsByDriver(driverId) {
    const provider = getDatabaseProvider()
    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      try {
        const { data, error } = await supabase
          .from('settlements')
          .select('*')
          .eq('driver_id', driverId)
        if (error) throw error
        return data || []
      } catch (error) {
        return this._getSettlementsByDriverLocal(driverId)
      }
    }
    return this._getSettlementsByDriverLocal(driverId)
  }

  async createSettlement(data) {
    const provider = getDatabaseProvider()
    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      return this._createSettlementInSupabase(data)
    }
    return this._createSettlementInLocal(data)
  }

  // ── LOCAL METHODS ──────────────────────────────────────────────

  _getAllPayslipsFromLocal() {
    return Promise.resolve(dataService.get(PAYSLIPS_STORAGE_KEY, []))
  }

  _getPayslipsByDriverLocal(driverId) {
    const items = dataService.get(PAYSLIPS_STORAGE_KEY, [])
    return Promise.resolve(items.filter(p => p.driver_id === driverId))
  }

  _createPayslipInLocal(data) {
    const items = dataService.get(PAYSLIPS_STORAGE_KEY, [])
    const payslip = {
      ...data,
      id: data.id || `PAY-${Date.now().toString().slice(-6)}`,
      created_at: new Date().toISOString(),
    }
    items.push(payslip)
    dataService.set(PAYSLIPS_STORAGE_KEY, items)
    return Promise.resolve(payslip)
  }

  _getAllSettlementsFromLocal() {
    return Promise.resolve(dataService.get(SETTLEMENTS_STORAGE_KEY, []))
  }

  _getSettlementsByDriverLocal(driverId) {
    const items = dataService.get(SETTLEMENTS_STORAGE_KEY, [])
    return Promise.resolve(items.filter(s => s.driver_id === driverId))
  }

  _createSettlementInLocal(data) {
    const items = dataService.get(SETTLEMENTS_STORAGE_KEY, [])
    const settlement = {
      ...data,
      id: data.id || `SET-${Date.now().toString().slice(-6)}`,
      created_at: new Date().toISOString(),
    }
    items.push(settlement)
    dataService.set(SETTLEMENTS_STORAGE_KEY, items)
    return Promise.resolve(settlement)
  }

  // ── SUPABASE METHODS ──────────────────────────────────────────

  async _getAllPayslipsFromSupabase() {
    try {
      const { data, error } = await supabase
        .from('trip_payslips')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    } catch (error) {
      return this._getAllPayslipsFromLocal()
    }
  }

  async _createPayslipInSupabase(data) {
    try {
      const payslip = {
        ...data,
        id: data.id || `PAY-${Date.now().toString().slice(-6)}`,
        created_at: data.created_at || new Date().toISOString(),
      }
      const { data: created, error } = await supabase
        .from('trip_payslips')
        .insert([payslip])
        .select()
        .single()
      if (error) throw error
      return created
    } catch (error) {
      return this._createPayslipInLocal(data)
    }
  }

  async _getAllSettlementsFromSupabase() {
    try {
      const { data, error } = await supabase
        .from('settlements')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    } catch (error) {
      return this._getAllSettlementsFromLocal()
    }
  }

  async _createSettlementInSupabase(data) {
    try {
      const settlement = {
        ...data,
        id: data.id || `SET-${Date.now().toString().slice(-6)}`,
        created_at: data.created_at || new Date().toISOString(),
      }
      const { data: created, error } = await supabase
        .from('settlements')
        .insert([settlement])
        .select()
        .single()
      if (error) throw error
      return created
    } catch (error) {
      return this._createSettlementInLocal(data)
    }
  }
}

export const payrollRepository = new PayrollRepository()
export default PayrollRepository
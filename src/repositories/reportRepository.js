// ─────────────────────────────────────────────────────────────────────
// REPORT REPOSITORY
// Generates reports from Supabase data
// ─────────────────────────────────────────────────────────────────────

import supabase from '../lib/supabase'
import { isSupabaseConfigured } from '../lib/supabase'
import { getDatabaseProvider, DATABASE_PROVIDERS } from '../config/database'
import { dataService } from '../services/dataService'

const REPORT_CACHE_KEY = 'sjt_report_cache'

/**
 * ReportRepository - Generates reports
 */
export class ReportRepository {
  async getDashboardStats() {
    const provider = getDatabaseProvider()
    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      return this._getDashboardStatsFromSupabase()
    }
    return this._getDashboardStatsFromLocal()
  }

  async getRevenueReport(startDate, endDate) {
    const provider = getDatabaseProvider()
    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      return this._getRevenueReportFromSupabase(startDate, endDate)
    }
    return this._getRevenueReportFromLocal(startDate, endDate)
  }

  async getTripsReport(startDate, endDate) {
    const provider = getDatabaseProvider()
    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      return this._getTripsReportFromSupabase(startDate, endDate)
    }
    return this._getTripsReportFromLocal(startDate, endDate)
  }

  async getDriverPerformance() {
    const provider = getDatabaseProvider()
    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      return this._getDriverPerformanceFromSupabase()
    }
    return this._getDriverPerformanceFromLocal()
  }

  async getExpenseReport() {
    const provider = getDatabaseProvider()
    if (provider === DATABASE_PROVIDERS.SUPABASE) {
      return this._getExpenseReportFromSupabase()
    }
    return this._getExpenseReportFromLocal()
  }

  // ── LOCAL METHODS ──────────────────────────────────────────────

  _getDashboardStatsFromLocal() {
    const cache = dataService.get(REPORT_CACHE_KEY, {})
    return Promise.resolve(cache.dashboardStats || { trips: 0, completed: 0, revenue: 0 })
  }

  _getRevenueReportFromLocal() {
    return Promise.resolve({ total: 0, trips: 0, data: [] })
  }

  _getTripsReportFromLocal() {
    return Promise.resolve({ total: 0, completed: 0, cancelled: 0, data: [] })
  }

  _getDriverPerformanceFromLocal() {
    return Promise.resolve([])
  }

  _getExpenseReportFromLocal() {
    return Promise.resolve({ total: 0, byCategory: {} })
  }

  // ── SUPABASE METHODS ──────────────────────────────────────────

  async _getDashboardStatsFromSupabase() {
    try {
      const { data: bookings } = await supabase.from('bookings').select('*')
      const trips = bookings?.length || 0
      const completed = bookings?.filter(b => b.status === 'completed').length || 0
      const revenue = bookings?.reduce((sum, b) => sum + (b.total_fare || 0), 0) || 0

      return { trips, completed, revenue }
    } catch (error) {
      console.error('Dashboard stats error:', error)
      return this._getDashboardStatsFromLocal()
    }
  }

  async _getRevenueReportFromSupabase(startDate, endDate) {
    try {
      const { data } = await supabase
        .from('bookings')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate)

      const total = data?.reduce((sum, b) => sum + (b.total_fare || 0), 0) || 0
      return { total, trips: data?.length || 0, data: data || [] }
    } catch (error) {
      return this._getRevenueReportFromLocal()
    }
  }

  async _getTripsReportFromSupabase(startDate, endDate) {
    try {
      const { data } = await supabase
        .from('bookings')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate)

      const completed = data?.filter(b => b.status === 'completed').length || 0
      const cancelled = data?.filter(b => b.status === 'cancelled').length || 0

      return { total: data?.length || 0, completed, cancelled, data: data || [] }
    } catch (error) {
      return this._getTripsReportFromLocal()
    }
  }

  async _getDriverPerformanceFromSupabase() {
    try {
      const { data } = await supabase.from('drivers').select('*')
      return data || []
    } catch (error) {
      return this._getDriverPerformanceFromLocal()
    }
  }

  async _getExpenseReportFromSupabase() {
    try {
      const { data } = await supabase.from('expenses').select('*')

      const total = data?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0
      const byCategory = {}
      data?.forEach(e => {
        byCategory[e.type] = (byCategory[e.type] || 0) + (e.amount || 0)
      })

      return { total, byCategory, data: data || [] }
    } catch (error) {
      return this._getExpenseReportFromLocal()
    }
  }
}

export const reportRepository = new ReportRepository()
export default ReportRepository
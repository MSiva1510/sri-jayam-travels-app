// ─────────────────────────────────────────────────────────────────────
// PAYROLL MIGRATION SERVICE
// Handles migration of payroll and settlement data
// ─────────────────────────────────────────────────────────────────────

import { payrollRepository } from '../../repositories/payrollRepository'
import { dataService } from '../../services/dataService'
import {
  isMigrationCompleted,
  completeMigration,
  failMigration,
} from '../../utils/migrationHelper'
import { isSupabaseConfigured } from '../../lib/supabase'
import { getDatabaseProvider, DATABASE_PROVIDERS } from '../../config/database'

const LOCAL_PAYSLIPS_KEY = 'sjt_payslips'
const LOCAL_SETTLEMENTS_KEY = 'sjt_settlements'

/**
 * Migrate payroll data from localStorage to Supabase
 * @returns {Promise<Object>}
 */
export async function migratePayroll() {
  if (isMigrationCompleted('payroll')) {
    console.log('Payroll migration already completed')
    return { success: true, message: 'Migration already completed', recordCount: 0 }
  }

  if (!isSupabaseConfigured() || getDatabaseProvider() !== DATABASE_PROVIDERS.SUPABASE) {
    console.log('Supabase not configured, skipping payroll migration')
    return { success: true, message: 'Supabase not configured', recordCount: 0 }
  }

  try {
    const payslips = dataService.get(LOCAL_PAYSLIPS_KEY, [])
    const settlements = dataService.get(LOCAL_SETTLEMENTS_KEY, [])

    let successCount = 0
    const errors = []

    for (const payslip of payslips) {
      try {
        const normalized = normalizePayslipData(payslip)
        await payrollRepository.createPayslip(normalized)
        successCount++
      } catch (error) {
        errors.push(`Payslip: ${error.message}`)
        console.error('Failed to migrate payslip:', error)
      }
    }

    for (const settlement of settlements) {
      try {
        const normalized = normalizeSettlementData(settlement)
        await payrollRepository.createSettlement(normalized)
        successCount++
      } catch (error) {
        errors.push(`Settlement: ${error.message}`)
        console.error('Failed to migrate settlement:', error)
      }
    }

    completeMigration('payroll', successCount, errors)
    console.log(`Payroll migration completed: ${successCount} records migrated`)

    return {
      success: errors.length === 0,
      message: `Migrated ${successCount} payroll records`,
      recordCount: successCount,
      errors: errors.length > 0 ? errors : undefined,
    }
  } catch (error) {
    console.error('Payroll migration failed:', error)
    failMigration('payroll', error.message)
    return {
      success: false,
      message: error.message,
      recordCount: 0,
      error: error.message,
    }
  }
}

function normalizePayslipData(payslip) {
  return {
    id: payslip.id,
    payslip_id: payslip.payslip_id || payslip.id,
    booking_id: payslip.booking_id,
    driver_id: payslip.driver_id,
    base_amount: payslip.base_amount,
    incentive_amount: payslip.incentive_amount || 0,
    deduction_amount: payslip.deduction_amount || 0,
    net_amount: payslip.net_amount,
    status: payslip.status || 'pending',
    generated_at: payslip.generated_at || new Date().toISOString(),
    approved_at: payslip.approved_at,
    paid_at: payslip.paid_at,
    created_at: payslip.created_at || new Date().toISOString(),
    updated_at: payslip.updated_at || new Date().toISOString(),
  }
}

function normalizeSettlementData(settlement) {
  return {
    id: settlement.id,
    settlement_id: settlement.settlement_id || settlement.id,
    driver_id: settlement.driver_id,
    month: settlement.month,
    year: settlement.year,
    basic_pay: settlement.basic_pay,
    incentive: settlement.incentive || 0,
    deductions: settlement.deductions || 0,
    net_amount: settlement.net_amount,
    status: settlement.status || 'pending',
    payment_method: settlement.payment_method,
    payment_date: settlement.payment_date,
    notes: settlement.notes,
    created_at: settlement.created_at || new Date().toISOString(),
    updated_at: settlement.updated_at || new Date().toISOString(),
  }
}

/**
 * Verify payroll migration
 * @returns {Promise<Object>}
 */
export async function verifyPayrollMigration() {
  try {
    const localPayslips = dataService.get(LOCAL_PAYSLIPS_KEY, [])
    const supabasePayslips = await payrollRepository.getAllPayslips()

    const localSettlements = dataService.get(LOCAL_SETTLEMENTS_KEY, [])
    const supabaseSettlements = await payrollRepository.getAllSettlements()

    return {
      payslips: {
        localCount: localPayslips.length,
        supabaseCount: supabasePayslips.length,
        verified: localPayslips.length === supabasePayslips.length,
      },
      settlements: {
        localCount: localSettlements.length,
        supabaseCount: supabaseSettlements.length,
        verified: localSettlements.length === supabaseSettlements.length,
      },
    }
  } catch (error) {
    console.error('Verification failed:', error)
    return { error: error.message }
  }
}

export default {
  migratePayroll,
  verifyPayrollMigration,
}
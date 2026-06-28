// ─────────────────────────────────────────────────────────────────────
// EXPENSE MIGRATION SERVICE
// Handles migration of expense data
// ─────────────────────────────────────────────────────────────────────

import { expenseRepository } from '../../repositories/expenseRepository'
import { dataService } from '../../services/dataService'
import {
  isMigrationCompleted,
  completeMigration,
  failMigration,
} from '../../utils/migrationHelper'
import { isSupabaseConfigured } from '../../lib/supabase'
import { getDatabaseProvider, DATABASE_PROVIDERS } from '../../config/database'

const LOCAL_EXPENSES_KEY = 'sjt_expenses'

/**
 * Migrate expenses from localStorage to Supabase
 * @returns {Promise<Object>}
 */
export async function migrateExpenses() {
  if (isMigrationCompleted('expenses')) {
    console.log('Expense migration already completed')
    return { success: true, message: 'Migration already completed', recordCount: 0 }
  }

  if (!isSupabaseConfigured() || getDatabaseProvider() !== DATABASE_PROVIDERS.SUPABASE) {
    console.log('Supabase not configured, skipping expense migration')
    return { success: true, message: 'Supabase not configured', recordCount: 0 }
  }

  try {
    const expenses = dataService.get(LOCAL_EXPENSES_KEY, [])

    if (expenses.length === 0) {
      completeMigration('expenses', 0, [])
      return { success: true, message: 'No expenses to migrate', recordCount: 0 }
    }

    console.log(`Starting migration of ${expenses.length} expenses...`)

    const errors = []
    let successCount = 0

    for (const expense of expenses) {
      try {
        const existing = await expenseRepository.getById(expense.id)
        if (existing) {
          successCount++
          continue
        }

        const normalized = normalizeExpenseData(expense)
        await expenseRepository.create(normalized)
        successCount++
      } catch (error) {
        errors.push(`Expense ${expense.id}: ${error.message}`)
        console.error(`Failed to migrate expense ${expense.id}:`, error)
      }
    }

    completeMigration('expenses', successCount, errors)
    console.log(`Expense migration completed: ${successCount}/${expenses.length} succeeded`)

    return {
      success: errors.length === 0,
      message: `Migrated ${successCount} expenses`,
      recordCount: successCount,
      errors: errors.length > 0 ? errors : undefined,
    }
  } catch (error) {
    console.error('Expense migration failed:', error)
    failMigration('expenses', error.message)
    return {
      success: false,
      message: error.message,
      recordCount: 0,
      error: error.message,
    }
  }
}

function normalizeExpenseData(expense) {
  return {
    id: expense.id,
    expense_id: expense.expense_id || expense.id,
    booking_id: expense.booking_id,
    driver_id: expense.driver_id,
    type: expense.type,
    amount: expense.amount,
    expense_date: expense.expense_date,
    location: expense.location,
    notes: expense.notes,
    bill_image_url: expense.bill_image_url,
    status: expense.status || 'pending',
    created_by: expense.created_by,
    approved_by: expense.approved_by,
    created_at: expense.created_at || new Date().toISOString(),
    updated_at: expense.updated_at || new Date().toISOString(),
  }
}

/**
 * Verify expense migration
 * @returns {Promise<Object>}
 */
export async function verifyExpenseMigration() {
  try {
    const localExpenses = dataService.get(LOCAL_EXPENSES_KEY, [])
    const supabaseExpenses = await expenseRepository.getAll()

    const localIds = new Set(localExpenses.map(e => e.id))
    const supabaseIds = new Set(supabaseExpenses.map(e => e.id))

    const missing = [...localIds].filter(id => !supabaseIds.has(id))

    return {
      localCount: localExpenses.length,
      supabaseCount: supabaseExpenses.length,
      missing: missing.length > 0 ? missing : undefined,
      verified: missing.length === 0,
    }
  } catch (error) {
    console.error('Verification failed:', error)
    return { verified: false, error: error.message }
  }
}

export default {
  migrateExpenses,
  verifyExpenseMigration,
}
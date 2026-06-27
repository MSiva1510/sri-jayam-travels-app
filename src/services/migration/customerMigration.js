// ─────────────────────────────────────────────────────────────────────
// CUSTOMER MIGRATION SERVICE
// Handles migration of customers from localStorage to Supabase
// ─────────────────────────────────────────────────────────────────────

import { customerRepository } from '../../repositories/customerRepository'
import { dataService } from '../../services/dataService'
import {
  isMigrationCompleted,
  completeMigration,
  failMigration,
  validateMigrationItem,
} from '../../utils/migrationHelper'
import { isSupabaseConfigured } from '../../lib/supabase'
import { getDatabaseProvider, DATABASE_PROVIDERS } from '../../config/database'

const LOCAL_CUSTOMERS_KEY = 'sjt_customers'

/**
 * Migrate customers from localStorage to Supabase
 * @returns {Promise<Object>} Migration result
 */
export async function migrateCustomers() {
  // Check if migration already completed
  if (isMigrationCompleted('customers')) {
    console.log('Customer migration already completed')
    return { success: true, message: 'Migration already completed', recordCount: 0 }
  }

  // Check if Supabase is configured and active
  if (!isSupabaseConfigured() || getDatabaseProvider() !== DATABASE_PROVIDERS.SUPABASE) {
    console.log('Supabase not configured or not active, skipping migration')
    return { success: true, message: 'Supabase not configured', recordCount: 0 }
  }

  try {
    // Get customers from localStorage
    const localCustomers = dataService.get(LOCAL_CUSTOMERS_KEY, [])

    if (localCustomers.length === 0) {
      console.log('No customers to migrate')
      completeMigration('customers', 0, [])
      return { success: true, message: 'No customers to migrate', recordCount: 0 }
    }

    console.log(`Starting migration of ${localCustomers.length} customers...`)

    const errors = []
    let successCount = 0

    // Migrate each customer
    for (const customer of localCustomers) {
      try {
        // Validate customer data
        const validation = validateMigrationItem('customer', customer)
        if (!validation.valid) {
          errors.push(`Customer ${customer.id}: ${validation.errors.join(', ')}`)
          continue
        }

        // Check for duplicates in Supabase
        const existing = await customerRepository.getById(customer.id)
        if (existing) {
          console.log(`Customer ${customer.id} already exists in Supabase, skipping`)
          successCount++
          continue
        }

        // Create customer in Supabase
        await customerRepository.create(customer)
        successCount++
      } catch (error) {
        errors.push(`Customer ${customer.id}: ${error.message}`)
        console.error(`Failed to migrate customer ${customer.id}:`, error)
      }
    }

    // Mark migration as complete
    completeMigration('customers', successCount, errors)

    console.log(`Customer migration completed: ${successCount}/${localCustomers.length} succeeded`)

    return {
      success: errors.length === 0,
      message: `Migrated ${successCount} customers`,
      recordCount: successCount,
      errors: errors.length > 0 ? errors : undefined,
    }
  } catch (error) {
    console.error('Customer migration failed:', error)
    failMigration('customers', error.message)
    return {
      success: false,
      message: error.message,
      recordCount: 0,
      error: error.message,
    }
  }
}

/**
 * Verify customer migration
 * @returns {Promise<Object>} Verification result
 */
export async function verifyCustomerMigration() {
  try {
    const localCustomers = dataService.get(LOCAL_CUSTOMERS_KEY, [])
    const supabaseCustomers = await customerRepository.getAll()

    const localIds = new Set(localCustomers.map(c => c.id))
    const supabaseIds = new Set(supabaseCustomers.map(c => c.id))

    const missing = [...localIds].filter(id => !supabaseIds.has(id))
    const extra = [...supabaseIds].filter(id => !localIds.has(id))

    return {
      localCount: localCustomers.length,
      supabaseCount: supabaseCustomers.length,
      missing: missing.length > 0 ? missing : undefined,
      extra: extra.length > 0 ? extra : undefined,
      verified: missing.length === 0 && extra.length === 0,
    }
  } catch (error) {
    console.error('Verification failed:', error)
    return {
      verified: false,
      error: error.message,
    }
  }
}

/**
 * Rollback customer migration (copy Supabase data back to localStorage)
 * @returns {Promise<Object>}
 */
export async function rollbackCustomerMigration() {
  try {
    const supabaseCustomers = await customerRepository.getAll()
    dataService.set(LOCAL_CUSTOMERS_KEY, supabaseCustomers)

    return {
      success: true,
      message: `Rolled back ${supabaseCustomers.length} customers to localStorage`,
      recordCount: supabaseCustomers.length,
    }
  } catch (error) {
    console.error('Rollback failed:', error)
    return {
      success: false,
      message: error.message,
      error: error.message,
    }
  }
}

export default {
  migrateCustomers,
  verifyCustomerMigration,
  rollbackCustomerMigration,
}
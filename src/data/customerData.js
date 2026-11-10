// ─── Customer Data & Storage ──────────────────────────────────
// Storage: Supabase `customers` table via customerRepository

import { customerRepository } from '../repositories/customerRepository'
import { withCache, cacheClear } from '../utils/dataCache'
import { translateDbError } from './errorUtils'

export const CUSTOMER_TYPES = [
  { key:'individual', label:'Individual',   badge:'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',       dot:'bg-blue-500'   },
  { key:'corporate',  label:'Corporate',    badge:'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300', dot:'bg-violet-500' },
  { key:'agent',      label:'Travel Agent', badge:'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',         dot:'bg-teal-500'   },
]
export const getCustomerTypeCfg = key => CUSTOMER_TYPES.find(t => t.key === key) || CUSTOMER_TYPES[0]

export function generateCustomerId() {
  const ts = Date.now().toString().slice(-6)
  return `CUS-${ts}`
}

// ── Supabase customer store ───────────────────────────────────
// All functions are async — callers must await them.

// Maps raw Supabase `customers` row (snake_case) to the shape the UI reads
// (camelCase). Without this, fields like mobile/companyName/gst were
// silently undefined because the repository returns raw DB rows and the
// column names don't match 1:1 with what the pages read.
export function normalizeCustomer(row = {}) {
  return {
    ...row,
    id:            row.id,
    customer_id:   row.customer_id ?? null,
    name:          row.name ?? '',
    type:          row.type ?? 'individual',
    status:        row.status ?? 'active',
    mobile:        row.mobile ?? row.primary_mobile ?? '',
    altMobile:     row.altMobile ?? row.alternate_mobile ?? '',
    email:         row.email ?? '',
    city:          row.city ?? '',
    address:       row.address ?? '',
    billingAddress:row.address ?? '',
    companyName:   row.companyName ?? row.company_name ?? '',
    contactPerson: row.contactPerson ?? row.contact_person ?? '',
    gst:           row.gst ?? row.gstin ?? '',
    notes:         row.notes ?? '',
    isVip:         row.is_vip ?? false,
    isFrequentTraveller: row.is_frequent_traveller ?? false,
    isBlacklisted: row.is_blacklisted ?? false,
    createdAt:     row.createdAt ?? row.created_at ?? null,
    updatedAt:     row.updatedAt ?? row.updated_at ?? null,
  }
}

async function _loadCustomers() {
  try {
    const rows = await customerRepository.getAll()
    return (Array.isArray(rows) ? rows : []).map(normalizeCustomer)
  } catch (err) {
    console.error('[customerData] loadCustomers failed:', err)
    throw err
  }
}
export const loadCustomers = withCache('customers', _loadCustomers)
export const getCustomers = loadCustomers



export async function saveCustomer(customer) {
  const { id, ...rest } = customer
  const existing = id ? await customerRepository.getById(id) : null
  try {
    const result = existing
      ? await customerRepository.update(id, { ...rest, updatedAt: new Date().toISOString() })
      : await customerRepository.create({ id: id || generateCustomerId(), ...rest })
    cacheClear('customers')
    return result
  } catch (err) {
    cacheClear('customers')
    throw translateDbError(err, 'saveCustomer')
  }
}

export async function deleteCustomer(id) {
  const result = await customerRepository.delete(id)
  cacheClear('customers')
  return result
}

export async function findCustomerByMobile(mobile) {
  if (!mobile || mobile.length < 10) return null
  try {
    const matches = await customerRepository.searchByMobile(mobile)
    return Array.isArray(matches) ? matches[0] || null : matches
  } catch (err) {
    console.error('[customerData] findCustomerByMobile failed:', err)
    return null
  }
}

export async function upsertCustomerFromBooking({ name, mobile, address }) {
  if (!name?.trim()) return null
  try {
    const existing = mobile ? await findCustomerByMobile(mobile) : null
    if (existing) return existing
    const now = new Date().toISOString()
    const customer = {
      id:             generateCustomerId(),
      type:           'individual',
      status:         'active',
      name:           name.trim(),
      mobile:         mobile || '',
      altMobile:      '',
      email:          '',
      address:        address || '',
      city:           '',
      state:          '',
      gst:            '',
      companyName:    '',
      contactPerson:  '',
      billingAddress: '',
      notes:          'Auto-created from booking.',
      createdAt:      now,
      updatedAt:      now,
    }
    return await customerRepository.create(customer)
  } catch (err) {
    console.error('[customerData] upsertCustomerFromBooking failed:', err)
    return null
  }
}

// ── Computed stats (no storage — derived from bookings array) ─
export function getCustomerStats(customerId, customerName, bookings) {
  const mine = bookings.filter(b => b.customer === customerName || b.customer_name === customerName)
  return {
    totalTrips:     mine.length,
    completedTrips: mine.filter(b => b.status === 'completed').length,
    cancelledTrips: mine.filter(b => b.status === 'cancelled').length,
    activeTrips:    mine.filter(b => ['assigned','started'].includes(b.status)).length,
    totalRevenue:   mine.reduce((s, b) => s + (b.fare || 0), 0),
    lastTrip:       mine.sort((a, b) => (b.createdAt||'').localeCompare(a.createdAt||''))[0] || null,
    upcoming:       mine.filter(b => ['draft','confirmed','assigned'].includes(b.status))
                        .sort((a, b) => (a.startDate||'').localeCompare(b.startDate||'')),
    recent:         mine.filter(b => b.status === 'completed')
                        .sort((a, b) => (b.createdAt||'').localeCompare(a.createdAt||''))
                        .slice(0, 5),
  }
}

// ── Auto-flag thresholds ──────────────────────────────────────
// Derived flags are never written to the DB — they're computed on read so
// they stay honest as trips are added. Manual flags (set in the Customers
// page) always win over auto flags for VIP / Frequent; Blacklisted is
// manual-only and never auto-set.
export const FLAG_THRESHOLDS = {
  frequentTrips:   5,   // completed trips to be "Frequent Traveller"
  vipRevenue:      10000, // lifetime revenue to be "VIP" (₹)
}

// Compute which flags should be auto-set from a customer's booking history.
// Returns { autoIsFrequentTraveller, autoIsVip, reasons: string[] }.
export function computeAutoFlags(customer, bookings) {
  const stats = getCustomerStats(customer.id, customer.name, bookings)
  const reasons = []
  let autoFrequent = false
  let autoVip = false

  if (stats.completedTrips >= FLAG_THRESHOLDS.frequentTrips) {
    autoFrequent = true
    reasons.push(`${stats.completedTrips} completed trips`)
  }
  if (stats.totalRevenue >= FLAG_THRESHOLDS.vipRevenue) {
    autoVip = true
    reasons.push(`₹${stats.totalRevenue.toLocaleString('en-IN')} lifetime spend`)
  } else if (autoFrequent && (customer.type === 'corporate' || customer.type === 'agent')) {
    autoVip = true
    reasons.push('Frequent corporate/agent customer')
  }

  return {
    autoIsFrequentTraveller: autoFrequent,
    autoIsVip: autoVip,
    reasons,
    stats,
  }
}

// Effective flag = manual override || auto-derived. Callers decide whether to
// persist the manual value; auto values are always recomputed from bookings.
export function effectiveFlags(customer, auto) {
  return {
    isVip:             customer.isVip  || auto.autoIsVip,
    isFrequentTraveller: customer.isFrequentTraveller || auto.autoIsFrequentTraveller,
    isBlacklisted:     customer.isBlacklisted,
  }
}

// ── Seed / reference data ─────────────────────────────────────

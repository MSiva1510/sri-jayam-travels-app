// ─── Settlement & Payroll Data Layer ─────────────────────────
// Storage: Supabase `settlements` + `trip_payslips` + `settings`
//          tables via payrollRepository and supabase client

import { payrollRepository } from '../repositories/payrollRepository'
import supabase               from '../lib/supabase'
import { withCache, cacheClear } from '../utils/dataCache'

// ── Settlement status config ──────────────────────────────────
export const SETTLEMENT_STATUSES = [
  { key:'draft',    label:'Draft',            badge:'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',               dot:'bg-slate-400'   },
  { key:'pending',  label:'Pending Approval', badge:'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',                 dot:'bg-blue-500'    },
  { key:'approved', label:'Approved',         badge:'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',         dot:'bg-violet-500'  },
  { key:'paid',     label:'Paid',             badge:'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',     dot:'bg-emerald-500' },
]
export const getSettlementStatusCfg = key => SETTLEMENT_STATUSES.find(s => s.key === key) || SETTLEMENT_STATUSES[0]

export const PAYMENT_METHODS = ['Cash','Bank Transfer','UPI']

export const DEDUCTION_TYPES = [
  { key:'advance',  label:'Advance Salary' },
  { key:'penalty',  label:'Penalty'        },
  { key:'fine',     label:'Fine'           },
  { key:'misc',     label:'Miscellaneous'  },
]

export const DEFAULT_PAYROLL_SETTINGS = {
  // Per-driver daily wage, keyed by driver id (legacy rows may use the name).
  // No punched-in names here — wages resolve from Supabase drivers + settings.
  drivers: {},
  // Fallback daily wage (Rs./day) when a driver has no configured wage.
  defaultDailyWage: 600,
  incentiveRules: [
    { minTrips: 1,   maxTrips: 20,  bonus: 0    },
    { minTrips: 21,  maxTrips: 40,  bonus: 500  },
    { minTrips: 41,  maxTrips: 60,  bonus: 1000 },
    { minTrips: 61,  maxTrips: 999, bonus: 2000 },
  ],
  updatedAt: null,
}

// ── Daily wage resolution ───────────────────────────────────────
// Prefers driver-specific wage (by id, then name); understands legacy
// monthly shapes ({ baseSalary } → per-day, { dailyBata } as wage).
export function resolveDailyWage(driverIdOrName, settings, driverNameFallback) {
  const table = settings?.drivers || {}
  const byId = driverIdOrName != null ? table[driverIdOrName] : undefined
  const byName = driverNameFallback ? table[driverNameFallback] : undefined
  const cfg = byId || byName || table[driverIdOrName]
  if (cfg) {
    if (Number(cfg.dailyWage) > 0) return Number(cfg.dailyWage)
    if (Number(cfg.dailyBata) > 0) return Number(cfg.dailyBata)
    if (Number(cfg.baseSalary) > 0) return Math.round(Number(cfg.baseSalary) / 26)
  }
  return Number(settings?.defaultDailyWage) > 0 ? Number(settings.defaultDailyWage) : 600
}

// ── Trip money split ────────────────────────────────────────────
// Bata goes straight to the driver (never company money).
// A trip payslip therefore records: fare = company, bata = driver.
export function tripDriverAmount(p = {}) {
  return Number(p.driver_amount ?? p.bata ?? 0)
}
export function tripCompanyAmount(p = {}) {
  return Number(p.company_amount ?? p.fare ?? 0)
}

// ── Supabase payroll settings ─────────────────────────────────
// Stored in `settings` table: { key: 'payroll_settings', value: JSON }

export async function loadPayrollSettings() {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'payroll_settings')
      .single()
    if (error && error.code === 'PGRST116') return DEFAULT_PAYROLL_SETTINGS
    if (error) throw error
    return data?.value || DEFAULT_PAYROLL_SETTINGS
  } catch (err) {
    console.error('[settlementData] loadPayrollSettings failed:', err)
    return DEFAULT_PAYROLL_SETTINGS
  }
}

export async function savePayrollSettings(cfg) {
  const value = { ...cfg, updatedAt: new Date().toISOString() }
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'payroll_settings', value }, { onConflict: 'key' })
  if (error) {
    console.error('[settlementData] savePayrollSettings failed:', error)
    throw error
  }
}

// ── Incentive calculation ─────────────────────────────────────
export function calculateIncentive(completedTrips, rules) {
  const sorted = [...rules].sort((a, b) => b.minTrips - a.minTrips)
  for (const rule of sorted) {
    if (completedTrips >= rule.minTrips && completedTrips <= rule.maxTrips) return rule.bonus
  }
  return 0
}

// ── Build settlement (pure computation — no storage) ──────────
// Daily-wage model: drivers are paid per day they drive
// (wagePay = dailyWage × daysWorked). Bata goes straight to the
// driver, so it is reported as info (bataDirect) and NEVER added
// to the company payout.
export function buildSettlement({
  driver, driverId, month, year, workingDays, daysWorked,
  completedTrips, totalTrips,
  deductions = [],
  manualFuel = 0, manualParking = 0,
  bonus = 0, notes = '',
  addedBy = '',
}, expenses, settings) {
  const dailyWage     = resolveDailyWage(driverId || driver, settings, driver)
  const days          = Number(daysWorked ?? workingDays ?? 0)
  const monthKey      = `${year}-${String(month).padStart(2,'0')}`
  const driverExps    = (expenses || []).filter(e =>
    (e.driver === driver || (driverId != null && e.driverId === driverId)) &&
    e.date?.startsWith(monthKey) &&
    e.status === 'approved'
  )
  const expBata    = driverExps.filter(e => e.type === 'bata').reduce((s,e) => s+e.amount, 0)
  const expFuel    = driverExps.filter(e => e.type === 'fuel').reduce((s,e) => s+e.amount, 0)
  const expParking = driverExps.filter(e => e.type === 'parking').reduce((s,e) => s+e.amount, 0)

  const bataDirect = expBata
  const fuelAmt    = expFuel    || manualFuel
  const parkingAmt = expParking || manualParking

  const wagePay         = dailyWage * days
  const incentive       = calculateIncentive(completedTrips, settings?.incentiveRules || DEFAULT_PAYROLL_SETTINGS.incentiveRules)
  const totalDeductions = deductions.reduce((s,d) => s + (d.amount || 0), 0)
  const grossAmount     = wagePay + fuelAmt + parkingAmt + incentive + bonus
  const netAmount       = Math.max(0, grossAmount - totalDeductions)

  return {
    dailyWage, daysWorked: days, wagePay,
    bataDirect, fuelAmt, parkingAmt,
    incentive, bonus,
    grossAmount, totalDeductions, netAmount,
    deductions,
    expBata, expFuel, expParking,
    notes,
  }
}

// ── ID generators ─────────────────────────────────────────────
export function generateSettlementId() {
  const d  = new Date()
  const y  = d.getFullYear().toString().slice(-2)
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const ts = Date.now().toString().slice(-4)
  return `STL-${y}${m}-${ts}`
}

export function generateTripPayslipId() {
  const d  = new Date()
  const y  = d.getFullYear().toString().slice(-2)
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const ts = Date.now().toString().slice(-5)
  return `TPS-${y}${m}-${ts}`
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
export function monthLabel(month, year) {
  return `${MONTHS[(month||1)-1]} ${year}`
}

// ── Supabase settlements store ────────────────────────────────

async function _loadSettlements() {
  try {
    const rows = await payrollRepository.getAllSettlements()
    return (Array.isArray(rows) ? rows : []).map(normalizeSettlement)
  } catch (err) {
    console.error('[settlementData] loadSettlements failed:', err)
    throw err
  }
}
export const loadSettlements = withCache('settlements', _loadSettlements)

export function normalizeSettlement(row = {}) {
  const deductionsArray = Array.isArray(row.deductions) ? row.deductions : []
  const totalDeductions = Array.isArray(row.deductions)
    ? row.deductions.reduce((s, d) => s + (Number(d.amount) || 0), 0)
    : Number(row.totalDeductions ?? row.deductions ?? 0)
  const baseSalary = Number(row.baseSalary ?? row.basic_pay ?? 0)
  const dailyWage = Number(row.dailyWage ?? row.daily_wage ?? 0)
  const daysWorked = Number(row.daysWorked ?? row.days_worked ?? row.workingDays ?? row.working_days ?? 0)
  const wagePay = Number(row.wagePay ?? row.wage_pay ?? (dailyWage > 0 && daysWorked > 0 ? dailyWage * daysWorked : baseSalary))
  const bataDirect = Number(row.bataDirect ?? row.bata_direct ?? row.bataAmt ?? row.bata_amt ?? 0)
  const incentive = Number(row.incentive ?? 0)
  const bonus = Number(row.bonus ?? 0)
  const grossAmount = Number(row.grossAmount ?? row.gross_amount ?? (wagePay + incentive + bonus))
  return {
    ...row,
    id: row.id || row.settlement_id,
    driver: row.driver ?? row.driver_name ?? row.driver_id ?? '',
    baseSalary,
    dailyWage,
    daysWorked,
    wagePay,
    bataDirect,
    incentive,
    bonus,
    grossAmount,
    totalDeductions,
    netAmount: Number(row.netAmount ?? row.net_amount ?? Math.max(0, grossAmount - totalDeductions)),
    deductions: deductionsArray,
    paymentDate: row.paymentDate ?? row.payment_date ?? null,
    paymentMethod: row.paymentMethod ?? row.payment_method ?? '',
    createdAt: row.createdAt ?? row.created_at ?? '',
    updatedAt: row.updatedAt ?? row.updated_at ?? row.created_at ?? '',
  }
}


export async function saveSettlement(settlement) {
  try {
    const { id, ...rest } = settlement
    const existing = id ? await payrollRepository.getSettlementById?.(id) : null
    const result = existing
      ? await payrollRepository.updateSettlement(id, { ...rest, updatedAt: new Date().toISOString() })
      : await payrollRepository.createSettlement({ id: id || generateSettlementId(), ...rest })
    cacheClear('settlements')
    return result
  } catch (err) {
    console.error('[settlementData] saveSettlement failed:', err)
    return null
  }
}

export async function deleteSettlement(id) {
  try {
    const { error } = await supabase.from('settlements').delete().eq('id', id)
    if (error) throw error
    cacheClear('settlements')
    return true
  } catch (err) {
    console.error('[settlementData] deleteSettlement failed:', err)
    return false
  }
}

export async function settlementExists(driver, month, year) {
  try {
    const all = await payrollRepository.getAllSettlements()
    return all.some(s => s.driver === driver && s.month === month && s.year === year)
  } catch {
    return false
  }
}

// ── Monthly payslips (summary snapshots) ─────────────────────

async function _loadPayslips() {
  try {
    const rows = await payrollRepository.getAllPayslips()
    return (Array.isArray(rows) ? rows : []).map(normalizeTripPayslip)
  } catch (err) {
    console.error('[settlementData] loadPayslips failed:', err)
    return []
  }
}
export const loadPayslips = withCache('payslips', _loadPayslips)


export async function savePayslip(payslip) {
  try {
    const existing = await payrollRepository.getPayslipsByDriver?.(payslip.settlementId)
    if (existing?.find?.(p => p.settlement_id === payslip.settlementId)) {
      const { error } = await supabase
        .from('trip_payslips')
        .update(payslip)
        .eq('id', payslip.id)
      if (error) throw error
      return payslip
    }
    return await payrollRepository.createPayslip(payslip)
  } catch (err) {
    console.error('[settlementData] savePayslip failed:', err)
    return null
  }
}

// ── Per-trip payslips ─────────────────────────────────────────

async function _loadTripPayslips() {
  try {
    const rows = await payrollRepository.getAllPayslips()
    return (Array.isArray(rows) ? rows : []).map(normalizeTripPayslip)
  } catch (err) {
    console.error('[settlementData] loadTripPayslips failed:', err)
    return []
  }
}
export const loadTripPayslips = withCache('tripPayslips', _loadTripPayslips)

export function normalizeTripPayslip(row = {}) {
  const fare = Number(row.fare ?? row.base_amount ?? 0)
  const bata = Number(row.bata ?? row.incentive_amount ?? 0)
  return {
    ...row,
    id: row.id || row.payslip_id,
    bookingId: row.bookingId ?? row.booking_id ?? '',
    bookingNo: row.bookingNo ?? row.booking_number ?? row.booking_id ?? '',
    driver: row.driver ?? row.driver_name ?? row.driver_id ?? '',
    fare,
    bata,
    fuel: Number(row.fuel ?? 0),
    parking: Number(row.parking ?? 0),
    // Driver's take = bata (straight to driver); company keeps the fare.
    driver_amount: Number(row.driver_amount ?? bata),
    company_amount: Number(row.company_amount ?? fare),
    net: Number(row.net ?? row.net_amount ?? bata),
    paidAt: row.paidAt ?? row.paid_at ?? null,
    createdAt: row.createdAt ?? row.created_at ?? row.generated_at ?? '',
  }
}


export async function saveTripPayslip(payslip) {
  try {
    const { id, ...rest } = payslip
    // Try upsert by id
    const { data, error } = await supabase
      .from('trip_payslips')
      .upsert({ id: id || generateTripPayslipId(), ...rest })
      .select()
      .single()
    if (error) throw error
    return data
  } catch (err) {
    console.error('[settlementData] saveTripPayslip failed:', err)
    return null
  }
}

// ── Build a per-trip payslip from a completed booking ────────
// Bata goes straight to the driver: the trip's own bata is the
// driver's take, the fare stays with the company.
export function buildTripPayslip(booking) {
  const fare      = Number(booking.fare || 0)
  const bata      = Number(booking.bata || 0)
  return {
    id:        generateTripPayslipId(),
    bookingId: booking.id,
    bookingNo: booking.bookingNo || booking.id,
    driver:    booking.driver || '',
    vehicle:   booking.vehicle || '',
    customer:  booking.customer || '',
    pickup:    booking.pickup || '',
    drop:      booking.drop || '',
    date:      booking.startDate || new Date().toISOString().slice(0, 10),
    fare,
    bata,
    fuel:      0,
    parking:   0,
    driver_amount:  bata,
    company_amount: fare,
    net:       bata,
    status:    'pending',
    paidAt:    null,
    paidBy:    null,
    createdAt: new Date().toISOString(),
  }
}

// ── Seed / reference data ───────────────────────────────────── 
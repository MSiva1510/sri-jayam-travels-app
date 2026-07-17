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
  drivers: {
    Ramanan:      { baseSalary: 18000, dailyBata: 300, perTripIncentive: 0 },
    Babu:         { baseSalary: 17000, dailyBata: 300, perTripIncentive: 0 },
    Rajasekharan: { baseSalary: 16000, dailyBata: 300, perTripIncentive: 0 },
  },
  incentiveRules: [
    { minTrips: 1,   maxTrips: 20,  bonus: 0    },
    { minTrips: 21,  maxTrips: 40,  bonus: 500  },
    { minTrips: 41,  maxTrips: 60,  bonus: 1000 },
    { minTrips: 61,  maxTrips: 999, bonus: 2000 },
  ],
  updatedAt: null,
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
  try {
    await supabase
      .from('settings')
      .upsert({ key: 'payroll_settings', value }, { onConflict: 'key' })
  } catch (err) {
    console.error('[settlementData] savePayrollSettings failed:', err)
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
export function buildSettlement({
  driver, month, year, workingDays,
  completedTrips, totalTrips,
  deductions = [],
  manualBata = 0, manualFuel = 0, manualParking = 0,
  bonus = 0, notes = '',
  addedBy = '',
}, expenses, settings) {
  const driverCfg   = settings?.drivers?.[driver] || { baseSalary: 15000, dailyBata: 250 }
  const monthKey    = `${year}-${String(month).padStart(2,'0')}`
  const driverExps  = (expenses || []).filter(e =>
    e.driver === driver &&
    e.date?.startsWith(monthKey) &&
    e.status === 'approved'
  )
  const expBata    = driverExps.filter(e => e.type === 'bata').reduce((s,e) => s+e.amount, 0)
  const expFuel    = driverExps.filter(e => e.type === 'fuel').reduce((s,e) => s+e.amount, 0)
  const expParking = driverExps.filter(e => e.type === 'parking').reduce((s,e) => s+e.amount, 0)

  const bataAmt    = expBata    || manualBata
  const fuelAmt    = expFuel    || manualFuel
  const parkingAmt = expParking || manualParking

  const baseSalary      = driverCfg.baseSalary || 15000
  const incentive       = calculateIncentive(completedTrips, settings?.incentiveRules || DEFAULT_PAYROLL_SETTINGS.incentiveRules)
  const totalDeductions = deductions.reduce((s,d) => s + (d.amount || 0), 0)
  const grossAmount     = baseSalary + bataAmt + fuelAmt + parkingAmt + incentive + bonus
  const netAmount       = Math.max(0, grossAmount - totalDeductions)

  return {
    baseSalary, bataAmt, fuelAmt, parkingAmt,
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
    return MOCK_SETTLEMENTS
  }
}
export const loadSettlements = withCache('settlements', _loadSettlements)

export function normalizeSettlement(row = {}) {
  const deductionsArray = Array.isArray(row.deductions) ? row.deductions : []
  const totalDeductions = Array.isArray(row.deductions)
    ? row.deductions.reduce((s, d) => s + (Number(d.amount) || 0), 0)
    : Number(row.totalDeductions ?? row.deductions ?? 0)
  const baseSalary = Number(row.baseSalary ?? row.basic_pay ?? 0)
  const incentive = Number(row.incentive ?? 0)
  const bonus = Number(row.bonus ?? 0)
  const grossAmount = Number(row.grossAmount ?? row.gross_amount ?? (baseSalary + incentive + bonus))
  return {
    ...row,
    id: row.id || row.settlement_id,
    driver: row.driver ?? row.driver_name ?? row.driver_id ?? '',
    baseSalary,
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
    if (existing) {
      return await payrollRepository.updateSettlement(id, { ...rest, updatedAt: new Date().toISOString() })
    }
    return await payrollRepository.createSettlement({ id: id || generateSettlementId(), ...rest })
  } catch (err) {
    console.error('[settlementData] saveSettlement failed:', err)
    return null
  }
}

export async function deleteSettlement(id) {
  try {
    const { error } = await supabase.from('settlements').delete().eq('id', id)
    if (error) throw error
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
  return {
    ...row,
    id: row.id || row.payslip_id,
    bookingId: row.bookingId ?? row.booking_id ?? '',
    bookingNo: row.bookingNo ?? row.booking_number ?? row.booking_id ?? '',
    driver: row.driver ?? row.driver_name ?? row.driver_id ?? '',
    fare: Number(row.fare ?? row.base_amount ?? 0),
    bata: Number(row.bata ?? row.incentive_amount ?? 0),
    fuel: Number(row.fuel ?? 0),
    parking: Number(row.parking ?? 0),
    net: Number(row.net ?? row.net_amount ?? 0),
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
export function buildTripPayslip(booking, settings) {
  const driverCfg = settings?.drivers?.[booking.driver] || {}
  const bata      = driverCfg.dailyBata || 0
  const fare      = booking.fare || 0
  const net       = fare + bata
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
    net,
    status:    'pending',
    paidAt:    null,
    paidBy:    null,
    createdAt: new Date().toISOString(),
  }
}

// ── Seed / reference data ─────────────────────────────────────
export const MOCK_SETTLEMENTS = [
  {
    id:'STL-2604-001', driver:'Ramanan', month:4, year:2026,
    status:'paid', workingDays:26, completedTrips:38, totalTrips:40,
    baseSalary:18000, bataAmt:2800, fuelAmt:1200, parkingAmt:0,
    incentive:500, bonus:0, grossAmount:22500, totalDeductions:0, netAmount:22500,
    deductions:[],
    paymentDate:'2026-05-02', paymentMethod:'Bank Transfer', paymentRemarks:'April salary paid',
    createdBy:'manager', approvedBy:'admin', createdAt:'2026-05-01T09:00:00Z', updatedAt:'2026-05-02T10:00:00Z',
    notes:'Good performance month',
  },
  {
    id:'STL-2604-002', driver:'Babu', month:4, year:2026,
    status:'paid', workingDays:25, completedTrips:34, totalTrips:36,
    baseSalary:17000, bataAmt:2600, fuelAmt:980, parkingAmt:120,
    incentive:500, bonus:0, grossAmount:21200, totalDeductions:1000, netAmount:20200,
    deductions:[{ type:'advance', label:'Advance Salary', amount:1000 }],
    paymentDate:'2026-05-02', paymentMethod:'Bank Transfer', paymentRemarks:'April salary — advance deducted',
    createdBy:'manager', approvedBy:'admin', createdAt:'2026-05-01T09:30:00Z', updatedAt:'2026-05-02T10:30:00Z',
    notes:'',
  },
  {
    id:'STL-2604-003', driver:'Rajasekharan', month:4, year:2026,
    status:'paid', workingDays:22, completedTrips:28, totalTrips:30,
    baseSalary:16000, bataAmt:2400, fuelAmt:0, parkingAmt:0,
    incentive:500, bonus:500, grossAmount:19400, totalDeductions:0, netAmount:19400,
    deductions:[],
    paymentDate:'2026-05-03', paymentMethod:'Cash', paymentRemarks:'April salary',
    createdBy:'manager', approvedBy:'admin', createdAt:'2026-05-01T10:00:00Z', updatedAt:'2026-05-03T09:00:00Z',
    notes:'',
  },
  {
    id:'STL-2605-004', driver:'Ramanan', month:5, year:2026,
    status:'approved', workingDays:27, completedTrips:42, totalTrips:44,
    baseSalary:18000, bataAmt:3100, fuelAmt:2200, parkingAmt:340,
    incentive:1000, bonus:0, grossAmount:24640, totalDeductions:0, netAmount:24640,
    deductions:[],
    paymentDate:null, paymentMethod:'', paymentRemarks:'',
    createdBy:'manager', approvedBy:'admin', createdAt:'2026-06-01T09:00:00Z', updatedAt:'2026-06-01T14:00:00Z',
    notes:'Bangalore trip expense included',
  },
  {
    id:'STL-2605-005', driver:'Babu', month:5, year:2026,
    status:'pending', workingDays:26, completedTrips:36, totalTrips:38,
    baseSalary:17000, bataAmt:2700, fuelAmt:1800, parkingAmt:120,
    incentive:500, bonus:0, grossAmount:22120, totalDeductions:0, netAmount:22120,
    deductions:[],
    paymentDate:null, paymentMethod:'', paymentRemarks:'',
    createdBy:'manager', approvedBy:null, createdAt:'2026-06-01T10:00:00Z', updatedAt:'2026-06-01T10:00:00Z',
    notes:'',
  },
  {
    id:'STL-2605-006', driver:'Rajasekharan', month:5, year:2026,
    status:'draft', workingDays:20, completedTrips:24, totalTrips:26,
    baseSalary:16000, bataAmt:2200, fuelAmt:0, parkingAmt:0,
    incentive:500, bonus:0, grossAmount:18700, totalDeductions:500, netAmount:18200,
    deductions:[{ type:'penalty', label:'Penalty', amount:500 }],
    paymentDate:null, paymentMethod:'', paymentRemarks:'',
    createdBy:'manager', approvedBy:null, createdAt:'2026-06-01T11:00:00Z', updatedAt:'2026-06-01T11:00:00Z',
    notes:'On leave for 8 days',
  },
]

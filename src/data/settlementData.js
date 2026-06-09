// ─── Settlement & Payroll Data Layer ─────────────────────────
// Follows the same localStorage-merge pattern as tripTypes.js etc.

export const SETTLEMENTS_KEY      = 'sjt_settlements'
export const PAYSLIPS_KEY         = 'sjt_payslips'
export const PAYROLL_SETTINGS_KEY = 'sjt_payroll_settings'

// ── Settlement status config ──────────────────────────────────
export const SETTLEMENT_STATUSES = [
  { key:'draft',    label:'Draft',            badge:'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',                  dot:'bg-slate-400'   },
  { key:'pending',  label:'Pending Approval', badge:'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',                    dot:'bg-blue-500'    },
  { key:'approved', label:'Approved',         badge:'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',            dot:'bg-violet-500'  },
  { key:'paid',     label:'Paid',             badge:'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',        dot:'bg-emerald-500' },
]
export const getSettlementStatusCfg = key => SETTLEMENT_STATUSES.find(s => s.key === key) || SETTLEMENT_STATUSES[0]

// ── Payment methods ───────────────────────────────────────────
export const PAYMENT_METHODS = ['Cash','Bank Transfer','UPI']

// ── Deduction types ───────────────────────────────────────────
export const DEDUCTION_TYPES = [
  { key:'advance',  label:'Advance Salary' },
  { key:'penalty',  label:'Penalty'        },
  { key:'fine',     label:'Fine'           },
  { key:'misc',     label:'Miscellaneous'  },
]

// ── Default payroll settings ──────────────────────────────────
export const DEFAULT_PAYROLL_SETTINGS = {
  drivers: {
    Ramanan:      { baseSalary: 18000, dailyBata: 300, perTripIncentive: 0 },
    Babu:         { baseSalary: 17000, dailyBata: 300, perTripIncentive: 0 },
    Rajasekharan: { baseSalary: 16000, dailyBata: 300, perTripIncentive: 0 },
  },
  incentiveRules: [
    { minTrips: 1,  maxTrips: 20, bonus: 0    },
    { minTrips: 21, maxTrips: 40, bonus: 500  },
    { minTrips: 41, maxTrips: 60, bonus: 1000 },
    { minTrips: 61, maxTrips: 999,bonus: 2000 },
  ],
  updatedAt: null,
}

// ── localStorage helpers ──────────────────────────────────────
export function loadPayrollSettings() {
  try {
    const raw = localStorage.getItem(PAYROLL_SETTINGS_KEY)
    return raw ? JSON.parse(raw) : DEFAULT_PAYROLL_SETTINGS
  } catch { return DEFAULT_PAYROLL_SETTINGS }
}
export function savePayrollSettings(cfg) {
  try { localStorage.setItem(PAYROLL_SETTINGS_KEY, JSON.stringify({ ...cfg, updatedAt: new Date().toISOString() })) } catch {}
}

// ── Incentive calculation (Module 7) ──────────────────────────
export function calculateIncentive(completedTrips, rules) {
  const sorted = [...rules].sort((a, b) => b.minTrips - a.minTrips)
  for (const rule of sorted) {
    if (completedTrips >= rule.minTrips && completedTrips <= rule.maxTrips) return rule.bonus
  }
  return 0
}

// ── Build settlement from inputs + expense data ───────────────
// Module 12: reads bata/fuel/parking from expenseData automatically
export function buildSettlement({
  driver, month, year, workingDays,
  completedTrips, totalTrips,
  deductions = [],
  manualBata = 0, manualFuel = 0, manualParking = 0,
  bonus = 0, notes = '',
  addedBy = '',
}, expenses, settings) {
  const driverCfg = settings?.drivers?.[driver] || { baseSalary: 15000, dailyBata: 250 }

  // Module 12: sum from approved expenses for this driver in this month
  const monthKey    = `${year}-${String(month).padStart(2,'0')}`
  const driverExps  = expenses.filter(e =>
    e.driver === driver &&
    e.date?.startsWith(monthKey) &&
    e.status === 'approved'
  )
  const expBata     = driverExps.filter(e => e.type === 'bata').reduce((s,e) => s+e.amount, 0)
  const expFuel     = driverExps.filter(e => e.type === 'fuel').reduce((s,e) => s+e.amount, 0)
  const expParking  = driverExps.filter(e => e.type === 'parking').reduce((s,e) => s+e.amount, 0)

  const bataAmt     = expBata     || manualBata
  const fuelAmt     = expFuel     || manualFuel
  const parkingAmt  = expParking  || manualParking

  const baseSalary  = driverCfg.baseSalary || 15000
  const incentive   = calculateIncentive(completedTrips, settings?.incentiveRules || DEFAULT_PAYROLL_SETTINGS.incentiveRules)
  const totalDeductions = deductions.reduce((s,d) => s + (d.amount || 0), 0)

  const grossAmount = baseSalary + bataAmt + fuelAmt + parkingAmt + incentive + bonus
  const netAmount   = Math.max(0, grossAmount - totalDeductions)

  return {
    baseSalary, bataAmt, fuelAmt, parkingAmt,
    incentive, bonus,
    grossAmount, totalDeductions, netAmount,
    deductions,
    expBata, expFuel, expParking,   // breakdown of what came from expenses
    notes,
  }
}

// ── ID generator ──────────────────────────────────────────────
let _settlSeq = 6
export function generateSettlementId() {
  _settlSeq++
  const d = new Date()
  return `STL-${d.getFullYear().toString().slice(-2)}${String(d.getMonth()+1).padStart(2,'0')}-${String(_settlSeq).padStart(3,'0')}`
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
export function monthLabel(month, year) {
  return `${MONTHS[(month||1)-1]} ${year}`
}

// ── Mock seed data ────────────────────────────────────────────
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

export function loadSettlements() {
  try {
    const raw    = localStorage.getItem(SETTLEMENTS_KEY)
    const stored = raw ? JSON.parse(raw) : []
    const storedIds = new Set(stored.map(s => s.id))
    return [...stored, ...MOCK_SETTLEMENTS.filter(s => !storedIds.has(s.id) && !s._deleted)]
      .filter(s => !s._deleted)
      .sort((a,b) => {
        const dateA = `${a.year}-${String(a.month).padStart(2,'0')}`
        const dateB = `${b.year}-${String(b.month).padStart(2,'0')}`
        return dateB.localeCompare(dateA)
      })
  } catch { return MOCK_SETTLEMENTS }
}

export function saveSettlement(settlement) {
  try {
    const raw    = localStorage.getItem(SETTLEMENTS_KEY)
    const stored = raw ? JSON.parse(raw) : []
    const idx    = stored.findIndex(s => s.id === settlement.id)
    if (idx >= 0) stored[idx] = settlement
    else          stored.unshift(settlement)
    localStorage.setItem(SETTLEMENTS_KEY, JSON.stringify(stored))
  } catch {}
}

export function deleteSettlement(id) {
  try {
    const raw    = localStorage.getItem(SETTLEMENTS_KEY)
    const stored = raw ? JSON.parse(raw) : []
    const isMock = MOCK_SETTLEMENTS.find(s => s.id === id)
    if (isMock) {
      const updated = stored.filter(s => s.id !== id)
      updated.push({ id, _deleted: true })
      localStorage.setItem(SETTLEMENTS_KEY, JSON.stringify(updated))
    } else {
      localStorage.setItem(SETTLEMENTS_KEY, JSON.stringify(stored.filter(s => s.id !== id)))
    }
  } catch {}
}

// Payslips (generated snapshots)
export function loadPayslips() {
  try { const r = localStorage.getItem(PAYSLIPS_KEY); return r ? JSON.parse(r) : [] } catch { return [] }
}
export function savePayslip(payslip) {
  try {
    const arr = loadPayslips()
    const idx = arr.findIndex(p => p.settlementId === payslip.settlementId)
    if (idx >= 0) arr[idx] = payslip; else arr.unshift(payslip)
    localStorage.setItem(PAYSLIPS_KEY, JSON.stringify(arr))
  } catch {}
}

// Duplicate prevention
export function settlementExists(driver, month, year) {
  return loadSettlements().some(s => s.driver === driver && s.month === month && s.year === year && !s._deleted)
}

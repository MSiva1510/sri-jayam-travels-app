// ─── Expense Data & Storage ───────────────────────────────────
// Same localStorage-merge pattern as tripTypes.js / customerData.js

export const EXPENSES_KEY = 'sjt_expenses_v2'

// ── Expense type config ───────────────────────────────────────
export const EXPENSE_TYPES = [
  { key:'fuel',        label:'Fuel',         icon:'⛽', color:'from-orange-500 to-amber-500',  badge:'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',  dot:'bg-orange-500'  },
  { key:'toll',        label:'Toll',         icon:'🛣',  color:'from-blue-500 to-indigo-500',   badge:'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',           dot:'bg-blue-500'    },
  { key:'parking',     label:'Parking',      icon:'🅿',  color:'from-teal-500 to-cyan-500',     badge:'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',           dot:'bg-teal-500'    },
  { key:'bata',        label:'Driver Bata',  icon:'💵', color:'from-emerald-600 to-green-500', badge:'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',dot:'bg-emerald-500' },
  { key:'food',        label:'Food',         icon:'🍽',  color:'from-rose-500 to-pink-500',     badge:'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',           dot:'bg-rose-500'    },
  { key:'maintenance', label:'Maintenance',  icon:'🔧', color:'from-slate-500 to-slate-600',   badge:'bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300',       dot:'bg-slate-500'   },
  { key:'repair',      label:'Repair',       icon:'🔩', color:'from-red-500 to-rose-600',      badge:'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',               dot:'bg-red-500'     },
  { key:'permit',      label:'Permit',       icon:'📋', color:'from-violet-500 to-purple-600', badge:'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',   dot:'bg-violet-500'  },
  { key:'insurance',   label:'Insurance',    icon:'🛡',  color:'from-sky-500 to-blue-600',      badge:'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',              dot:'bg-sky-500'     },
  { key:'misc',        label:'Miscellaneous',icon:'📦', color:'from-amber-500 to-yellow-500',  badge:'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',       dot:'bg-amber-500'   },
]

export const getExpTypeCfg = key => EXPENSE_TYPES.find(t => t.key === key) || EXPENSE_TYPES[EXPENSE_TYPES.length - 1]

// ── Approval status config ────────────────────────────────────
export const APPROVAL_STATUSES = [
  { key:'draft',     label:'Draft',     badge:'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',                dot:'bg-slate-400'   },
  { key:'submitted', label:'Submitted', badge:'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',                  dot:'bg-blue-500'    },
  { key:'approved',  label:'Approved',  badge:'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',      dot:'bg-emerald-500' },
  { key:'rejected',  label:'Rejected',  badge:'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',                     dot:'bg-red-500'     },
]
export const getApprovalCfg = key => APPROVAL_STATUSES.find(s => s.key === key) || APPROVAL_STATUSES[0]

// ── ID generator ──────────────────────────────────────────────
let _seq = 8
export function generateExpenseId() {
  _seq++
  const d = new Date()
  return `EXP-${d.getFullYear().toString().slice(-2)}${String(d.getMonth()+1).padStart(2,'0')}-${String(_seq).padStart(3,'0')}`
}

// ── Driver-submittable types ──────────────────────────────────
export const DRIVER_ALLOWED_TYPES = ['toll','parking','food','bata']

// ── Mock seed data ────────────────────────────────────────────
// Seeds are enriched from existing mockData.js EXPENSES and TRIPS
export const MOCK_EXPENSES = [
  {
    id:'EXP-2605-001', type:'maintenance', status:'approved',
    date:'2026-05-15', amount:4800, description:'Tyre replacement — PY01CY1255',
    tripRef:'', driver:'Ramanan', vehicle:'PY01CY1255', addedBy:'admin',
    receiptName:'receipt_tyre_may15.jpg', receiptDate:'2026-05-15',
    notes:'Front two tyres replaced', createdAt:'2026-05-15T10:00:00Z', updatedAt:'2026-05-15T14:00:00Z',
  },
  {
    id:'EXP-2605-002', type:'maintenance', status:'approved',
    date:'2026-05-10', amount:1800, description:'Engine oil service — PY01DF1255',
    tripRef:'', driver:'Babu', vehicle:'PY01DF1255', addedBy:'manager',
    receiptName:'receipt_service_may10.jpg', receiptDate:'2026-05-10',
    notes:'45,000 km service', createdAt:'2026-05-10T09:00:00Z', updatedAt:'2026-05-10T16:00:00Z',
  },
  {
    id:'EXP-2605-003', type:'misc', status:'approved',
    date:'2026-05-08', amount:2000, description:'FASTag recharge — all 3 vehicles',
    tripRef:'', driver:'', vehicle:'', addedBy:'admin',
    receiptName:'', receiptDate:'',
    notes:'Prepaid toll wallet', createdAt:'2026-05-08T08:00:00Z', updatedAt:'2026-05-08T08:00:00Z',
  },
  {
    id:'EXP-2605-004', type:'misc', status:'approved',
    date:'2026-05-05', amount:1200, description:'GPRS tracking subscription',
    tripRef:'', driver:'', vehicle:'', addedBy:'admin',
    receiptName:'receipt_gprs_may.pdf', receiptDate:'2026-05-05',
    notes:'Monthly renewal', createdAt:'2026-05-05T07:00:00Z', updatedAt:'2026-05-05T07:00:00Z',
  },
  {
    id:'EXP-2604-005', type:'insurance', status:'approved',
    date:'2026-04-28', amount:12500, description:'Insurance renewal — PY01VF1255',
    tripRef:'', driver:'Rajasekharan', vehicle:'PY01VF1255', addedBy:'admin',
    receiptName:'policy_ertiga_2026.pdf', receiptDate:'2026-04-28',
    notes:'Annual premium', createdAt:'2026-04-28T09:00:00Z', updatedAt:'2026-04-28T09:00:00Z',
  },
  {
    id:'EXP-2604-006', type:'repair', status:'approved',
    date:'2026-04-20', amount:3200, description:'Brake pads + disc — PY01DF1255',
    tripRef:'', driver:'Babu', vehicle:'PY01DF1255', addedBy:'manager',
    receiptName:'receipt_brakes_apr.jpg', receiptDate:'2026-04-20',
    notes:'Front axle', createdAt:'2026-04-20T08:00:00Z', updatedAt:'2026-04-20T08:00:00Z',
  },
  {
    id:'EXP-2604-007', type:'bata', status:'approved',
    date:'2026-04-12', amount:2000, description:'Driver advance — Babu',
    tripRef:'', driver:'Babu', vehicle:'PY01DF1255', addedBy:'manager',
    receiptName:'', receiptDate:'',
    notes:'Festival advance', createdAt:'2026-04-12T10:00:00Z', updatedAt:'2026-04-12T10:00:00Z',
  },
  // Driver-submitted entries pending approval
  {
    id:'EXP-2606-008', type:'fuel', status:'submitted',
    date:'2026-06-01', amount:2200, description:'Fuel fill — Ramanan trip to Bangalore',
    tripRef:'BK-2605-002', driver:'Ramanan', vehicle:'PY01CY1255', addedBy:'ramanan',
    receiptName:'fuel_bunk_june1.jpg', receiptDate:'2026-06-01',
    notes:'Full tank at HP bunk, Hosur', createdAt:'2026-06-01T09:30:00Z', updatedAt:'2026-06-01T09:30:00Z',
  },
  {
    id:'EXP-2606-009', type:'toll', status:'submitted',
    date:'2026-06-01', amount:340, description:'Toll charges — Puducherry to Bangalore',
    tripRef:'BK-2605-002', driver:'Ramanan', vehicle:'PY01CY1255', addedBy:'ramanan',
    receiptName:'', receiptDate:'',
    notes:'3 toll plazas', createdAt:'2026-06-01T10:00:00Z', updatedAt:'2026-06-01T10:00:00Z',
  },
  {
    id:'EXP-2606-010', type:'parking', status:'draft',
    date:'2026-06-02', amount:120, description:'Parking at Bangalore airport',
    tripRef:'BK-2605-002', driver:'Ramanan', vehicle:'PY01CY1255', addedBy:'ramanan',
    receiptName:'', receiptDate:'',
    notes:'4 hours parking', createdAt:'2026-06-02T14:00:00Z', updatedAt:'2026-06-02T14:00:00Z',
  },
]

// ── localStorage helpers ──────────────────────────────────────
export function loadExpenses() {
  try {
    const raw    = localStorage.getItem(EXPENSES_KEY)
    const stored = raw ? JSON.parse(raw) : []
    const storedIds = new Set(stored.map(e => e.id))
    return [...stored, ...MOCK_EXPENSES.filter(e => !storedIds.has(e.id) && !e._deleted)]
      .filter(e => !e._deleted)
      .sort((a, b) => b.date.localeCompare(a.date))
  } catch { return MOCK_EXPENSES }
}

export function saveExpense(expense) {
  try {
    const raw    = localStorage.getItem(EXPENSES_KEY)
    const stored = raw ? JSON.parse(raw) : []
    const idx    = stored.findIndex(e => e.id === expense.id)
    if (idx >= 0) stored[idx] = expense
    else          stored.unshift(expense)
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(stored))
  } catch {}
}

export function deleteExpense(id) {
  try {
    const raw    = localStorage.getItem(EXPENSES_KEY)
    const stored = raw ? JSON.parse(raw) : []
    const isMock = MOCK_EXPENSES.find(e => e.id === id)
    if (isMock) {
      // Mark deleted so it doesn't re-appear from seed merge
      const updated = stored.filter(e => e.id !== id)
      updated.push({ id, _deleted: true })
      localStorage.setItem(EXPENSES_KEY, JSON.stringify(updated))
    } else {
      localStorage.setItem(EXPENSES_KEY, JSON.stringify(stored.filter(e => e.id !== id)))
    }
  } catch {}
}

// ── Date range helpers ────────────────────────────────────────
export function isToday(dateStr) {
  return dateStr === new Date().toISOString().slice(0, 10)
}
export function isThisWeek(dateStr) {
  const d   = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0,0,0,0)
  return d >= startOfWeek
}
export function isThisMonth(dateStr) {
  return dateStr.startsWith(new Date().toISOString().slice(0, 7))
}

// ── Category summary ──────────────────────────────────────────
export function summariseByType(expenses) {
  return EXPENSE_TYPES.map(t => ({
    ...t,
    total: expenses.filter(e => e.type === t.key).reduce((s, e) => s + (e.amount || 0), 0),
    count: expenses.filter(e => e.type === t.key).length,
  })).filter(t => t.total > 0).sort((a, b) => b.total - a.total)
}

// ── Trip expense summary ──────────────────────────────────────
export function getTripExpenses(tripRef, expenses) {
  return expenses.filter(e => e.tripRef === tripRef)
}

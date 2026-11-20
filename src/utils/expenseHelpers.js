// ─── Pure expense helpers ──────────────────────────────────────
// Shared by the expense data facade and dashboard calculations. No Supabase
// imports here so these functions can be unit tested and reused safely.

export const EXPENSE_TYPES = [
  { key:'fuel',        label:'Fuel',          icon:'⛽', color:'from-orange-500 to-amber-500',  badge:'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',  dot:'bg-orange-500'  },
  { key:'toll',        label:'Toll',          icon:'🛣',  color:'from-blue-500 to-indigo-500',   badge:'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',           dot:'bg-blue-500'    },
  { key:'parking',     label:'Parking',       icon:'🅿',  color:'from-teal-500 to-cyan-500',     badge:'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',           dot:'bg-teal-500'    },
  { key:'bata',        label:'Driver Bata',   icon:'💵', color:'from-emerald-600 to-green-500', badge:'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',dot:'bg-emerald-500' },
  { key:'food',        label:'Food',          icon:'🍽',  color:'from-rose-500 to-pink-500',     badge:'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',           dot:'bg-rose-500'    },
  { key:'maintenance', label:'Maintenance',   icon:'🔧', color:'from-slate-500 to-slate-600',   badge:'bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300',       dot:'bg-slate-500'   },
  { key:'repair',      label:'Repair',        icon:'🔩', color:'from-red-500 to-rose-600',      badge:'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',               dot:'bg-red-500'     },
  { key:'permit',      label:'Permit',        icon:'📋', color:'from-violet-500 to-purple-600', badge:'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',   dot:'bg-violet-500'  },
  { key:'insurance',   label:'Insurance',     icon:'🛡',  color:'from-sky-500 to-blue-600',      badge:'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',              dot:'bg-sky-500'     },
  { key:'misc',        label:'Miscellaneous', icon:'📦', color:'from-amber-500 to-yellow-500',  badge:'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',       dot:'bg-amber-500'   },
]

export const getExpTypeCfg = key => EXPENSE_TYPES.find(t => t.key === key) || EXPENSE_TYPES[EXPENSE_TYPES.length - 1]

// Accepts a full expense object OR a raw date string. Supabase may return
// expense_date, date, created_at, or createdAt.
export function getExpenseDate(expenseOrStr) {
  if (!expenseOrStr) return null
  if (typeof expenseOrStr === 'string') return expenseOrStr.slice(0, 10)
  const raw = expenseOrStr.expense_date
    ?? expenseOrStr.date
    ?? expenseOrStr.created_at
    ?? expenseOrStr.createdAt
    ?? null
  if (!raw) return null
  return typeof raw === 'string' ? raw.slice(0, 10) : null
}

const toLocalDateStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function isToday(expenseOrDateStr) {
  const date = getExpenseDate(expenseOrDateStr)
  return !!date && date === toLocalDateStr()
}

export function isThisWeek(expenseOrDateStr) {
  const date = getExpenseDate(expenseOrDateStr)
  if (!date) return false
  const expDate = new Date(`${date}T00:00:00`)
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  return expDate >= startOfWeek
}

export function isThisMonth(expenseOrDateStr) {
  const date = getExpenseDate(expenseOrDateStr)
  return !!date && date.startsWith(toLocalDateStr().slice(0, 7))
}

export function summariseByType(expenses) {
  return EXPENSE_TYPES.map(type => ({
    ...type,
    total: (expenses ?? []).filter(expense => expense.type === type.key).reduce((sum, expense) => sum + (expense.amount || 0), 0),
    count: (expenses ?? []).filter(expense => expense.type === type.key).length,
  })).filter(type => type.total > 0).sort((a, b) => b.total - a.total)
}

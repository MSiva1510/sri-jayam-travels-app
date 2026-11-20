// ─── Expense Data & Storage ───────────────────────────────────
// Storage: Supabase `expenses` table via expenseRepository

import { expenseRepository } from '../repositories/expenseRepository'
import { withCache, cacheClear } from '../utils/dataCache'
import { normalizeExpense } from '../utils/expenseMapping'

export { normalizeExpense }
export {
  EXPENSE_TYPES, getExpTypeCfg, getExpenseDate,
  isToday, isThisWeek, isThisMonth, summariseByType,
} from '../utils/expenseHelpers.js'

export const APPROVAL_STATUSES = [
  { key:'pending',   label:'Pending',   badge:'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',                  dot:'bg-blue-500'    },
  { key:'approved',  label:'Approved',  badge:'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',      dot:'bg-emerald-500' },
  { key:'rejected',  label:'Rejected',  badge:'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',                     dot:'bg-red-500'     },
]
export const getApprovalCfg = key => APPROVAL_STATUSES.find(s => s.key === key) || APPROVAL_STATUSES[0]

export function generateExpenseId() {
  const d  = new Date()
  const y  = d.getFullYear().toString().slice(-2)
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const ts = Date.now().toString().slice(-4)
  return `EXP-${y}${m}-${ts}`
}

// The `expenses.expense_no` column is NOT NULL with no DB default, so the
// client generates the next number for the current month.
export function generateExpenseNo(expenses = []) {
  const d = new Date()
  const prefix = `EXP-${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}-`
  const max = (expenses || []).reduce((m, e) => {
    const no = String(e?.expenseNo || e?.expense_no || '')
    if (!no.startsWith(prefix)) return m
    const n = parseInt(no.slice(prefix.length), 10)
    return Number.isFinite(n) ? Math.max(m, n) : m
  }, 0)
  return `${prefix}${String(max + 1).padStart(4, '0')}`
}

export const DRIVER_ALLOWED_TYPES = ['toll','parking','food','bata']

// ── Supabase expense store ────────────────────────────────────
// All functions are async — callers must await them.

async function _loadExpenses() {
  try {
    const rows = await expenseRepository.getAll()
    return (Array.isArray(rows) ? rows : []).map(normalizeExpense)
  } catch (err) {
    console.error('[expenseData] loadExpenses failed:', err)
    throw err
  }
}
export const loadExpenses = withCache('expenses', _loadExpenses)
export const getExpenses = loadExpenses

export async function saveExpense(expense) {
  const { id, ...rest } = expense
  const existing = id ? await expenseRepository.getById(id) : null
  const result = existing
    ? await expenseRepository.update(id, { ...rest, updatedAt: new Date().toISOString() })
    : await expenseRepository.create({ id: id || generateExpenseId(), ...rest })
  cacheClear('expenses')
  return result
}

export async function deleteExpense(id) {
  const result = await expenseRepository.delete(id)
  cacheClear('expenses')
  return result
}

// Date/category helpers live in utils/expenseHelpers.js and are re-exported
// above. They are pure so dashboard calculations can import them directly.

export function getTripExpenses(tripRef, expenses) {
  return (expenses ?? []).filter(e => e.tripRef === tripRef)
}

// ── Seed / reference data ─────────────────────────────────────
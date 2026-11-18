// ─── Expense form — pure helpers ─────────────────────────────────
// Shared by the premium Expense modal and its unit tests. Field names,
// defaults, validation messages and payload keys mirror the previous
// inline modal exactly.

export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024
export const RECEIPT_MIMES = Object.freeze(['image/jpeg', 'image/png', 'application/pdf'])

export function todayLocalISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function createEmptyExpense({ today = todayLocalISO(), addedBy = '', driver = '' } = {}) {
  return {
    id: '', type: 'fuel', status: 'pending',
    date: today,
    amount: '', description: '', tripRef: '',
    driver, vehicle: '', addedBy,
    receiptName: '', receiptUrl: '', receiptDate: '', notes: '',
  }
}

export function validateExpenseForm(form = {}, today = todayLocalISO()) {
  const errors = {}
  if (!form.type) errors.type = 'Expense type is required'
  if (!form.amount || form.amount <= 0) errors.amount = 'Valid amount is required'
  if (!form.date) {
    errors.date = 'Expense date is required'
  } else if (form.date > today) {
    errors.date = 'Date cannot be in the future'
  }
  return errors
}

export function validateReceiptFile(file) {
  if (!file) return ''
  if (!RECEIPT_MIMES.includes(file.type)) return 'Use a JPG, PNG or PDF file'
  if (file.size > RECEIPT_MAX_BYTES) return 'Receipt must be 10 MB or less'
  return ''
}

// Same payload the previous modal handed to saveExpense().
export function buildExpensePayload(form = {}, options = {}) {
  const {
    now = new Date().toISOString(),
    newId = '',
    newExpenseNo = '',
    receipt = {},
  } = options
  return {
    ...form,
    receiptName: receipt.name ?? form.receiptName ?? '',
    receiptUrl: receipt.url ?? form.receiptUrl ?? '',
    id: form.id || newId,
    expenseNo: form.expenseNo || newExpenseNo,
    amount: Number(form.amount),
    status: form.status || 'pending',
    createdAt: form.createdAt || now,
    updatedAt: now,
  }
}

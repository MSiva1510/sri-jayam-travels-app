// Pins the pure helpers behind the premium Expense modal: original field
// names, date/amount rules, receipt limits and the exact payload shape
// handed to the existing saveExpense() path.

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createEmptyExpense, validateExpenseForm, validateReceiptFile,
  buildExpensePayload, RECEIPT_MIMES, RECEIPT_MAX_BYTES,
} from '../src/utils/expenseForm.js'

const TODAY = '2026-11-18'

const VALID = {
  ...createEmptyExpense({ today: TODAY, addedBy: 'Office', driver: 'Ravi' }),
  amount: '1250.50',
  description: 'Diesel for Chennai trip',
  type: 'fuel',
}

test('defaults preserve original expense field names and driver/current-user prefill', () => {
  const empty = createEmptyExpense({ today: TODAY, addedBy: 'Office', driver: 'Ravi' })
  for (const key of [
    'id', 'type', 'status', 'date', 'amount', 'description', 'tripRef',
    'driver', 'vehicle', 'addedBy', 'receiptName', 'receiptUrl',
    'receiptDate', 'notes',
  ]) {
    assert.ok(key in empty, `missing ${key}`)
  }
  assert.equal(empty.type, 'fuel')
  assert.equal(empty.status, 'pending')
  assert.equal(empty.date, TODAY)
  assert.equal(empty.addedBy, 'Office')
  assert.equal(empty.driver, 'Ravi')
})

test('validation keeps required type, positive amount and future-date rules', () => {
  assert.deepEqual(validateExpenseForm(createEmptyExpense({ today: TODAY }), TODAY), {
    amount: 'Valid amount is required',
  })

  assert.deepEqual(validateExpenseForm({ ...VALID, type: '' }, TODAY), {
    type: 'Expense type is required',
  })
  assert.equal(validateExpenseForm({ ...VALID, amount: '0' }, TODAY).amount,
    'Valid amount is required')
  assert.equal(validateExpenseForm({ ...VALID, amount: '-5' }, TODAY).amount,
    'Valid amount is required')
  assert.equal(validateExpenseForm({ ...VALID, date: '' }, TODAY).date,
    'Expense date is required')
  assert.equal(validateExpenseForm({ ...VALID, date: '2026-11-19' }, TODAY).date,
    'Date cannot be in the future')
  assert.deepEqual(validateExpenseForm(VALID, TODAY), {})
})

test('receipt validation keeps JPG/PNG/PDF and 10 MB limits', () => {
  assert.deepEqual(RECEIPT_MIMES, ['image/jpeg', 'image/png', 'application/pdf'])
  assert.equal(RECEIPT_MAX_BYTES, 10 * 1024 * 1024)

  assert.equal(validateReceiptFile(null), '')
  assert.equal(validateReceiptFile({ type: 'image/jpeg', size: 1024 }), '')
  assert.equal(validateReceiptFile({ type: 'image/png', size: 1024 }), '')
  assert.equal(validateReceiptFile({ type: 'application/pdf', size: 1024 }), '')
  assert.equal(validateReceiptFile({ type: 'text/plain', size: 10 }),
    'Use a JPG, PNG or PDF file')
  assert.equal(validateReceiptFile({ type: 'image/jpeg', size: RECEIPT_MAX_BYTES + 1 }),
    'Receipt must be 10 MB or less')
})

test('payload keeps all form fields and only adds id, timestamps and uploaded receipt', () => {
  const form = {
    ...VALID,
    id: 'EXP-2611-0001',
    expenseNo: 'EXP-2611-0001',
    odometerKm: '45230',
    litresFilled: '20',
    fuelStation: 'HP Pump',
    fuelRate: '102.50',
    parkingLocation: 'Airport',
    tollName: 'Tindivanam Toll',
    notes: 'Paid by office',
    createdAt: '2026-11-01T00:00:00.000Z',
    receiptName: 'old-bill.jpg',
    receiptUrl: 'https://old.example/bill.jpg',
  }

  const payload = buildExpensePayload(form, {
    now: '2026-11-18T10:00:00.000Z',
    newId: 'EXP-IGNORED',
    newExpenseNo: 'EXP-IGNORED',
    receipt: { url: 'https://new.example/bill.pdf', name: 'bill.pdf' },
  })

  assert.equal(payload.id, 'EXP-2611-0001')
  assert.equal(payload.expenseNo, 'EXP-2611-0001')
  assert.equal(payload.createdAt, '2026-11-01T00:00:00.000Z')
  assert.equal(payload.updatedAt, '2026-11-18T10:00:00.000Z')
  assert.equal(payload.amount, 1250.5)
  assert.equal(payload.receiptUrl, 'https://new.example/bill.pdf')
  assert.equal(payload.receiptName, 'bill.pdf')

  for (const key of [
    'type', 'status', 'date', 'description', 'tripRef', 'driver', 'vehicle',
    'addedBy', 'notes', 'odometerKm', 'litresFilled', 'fuelStation', 'fuelRate',
    'parkingLocation', 'tollName',
  ]) {
    assert.deepEqual(payload[key], form[key], `payload changed ${key}`)
  }

  const fresh = buildExpensePayload(VALID, {
    now: 'now',
    newId: 'EXP-NEW',
    newExpenseNo: 'EXP-2611-0002',
  })
  assert.equal(fresh.id, 'EXP-NEW')
  assert.equal(fresh.expenseNo, 'EXP-2611-0002')
  assert.equal(fresh.createdAt, 'now')
  assert.equal(fresh.amount, 1250.5)
})

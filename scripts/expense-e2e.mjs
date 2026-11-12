// End-to-end expense (bill) create/delete test against the live Supabase DB.
// Uses the app's real mapping + normalization code, so it exercises exactly
// what the Expense form sends. Run with:
//   $env:SUPABASE_URL='https://<ref>.supabase.co'
//   $env:SUPABASE_SERVICE_KEY='<service key>'
//   node scripts/expense-e2e.mjs
import { createClient } from '@supabase/supabase-js'
import { toDbExpense, EXPENSE_SELECT } from '../src/repositories/expenseRepository.js'
import { normalizeExpense, generateExpenseNo, EXPENSE_TYPES } from '../src/data/expenseData.js'
import fs from 'node:fs'

const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_KEY
if (!URL || !KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY')
  process.exit(2)
}

const sb = createClient(URL, KEY, { auth: { persistSession: false } })
const BUCKET = 'expense-bills'
// App select + the two columns the UI never reads but the test asserts on.
const SELECT = `${EXPENSE_SELECT}, expense_type, approval_status`
const results = []
const inserted = new Set()
const uploaded = new Set()

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function check(cond, msg) {
  if (!cond) throw new Error(msg)
}

function record(name, status, detail = '') {
  results.push({ name, status, detail })
  console.log(`${status === 'PASS' ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`)
}

async function runCase(name, fn) {
  try {
    const detail = await fn()
    record(name, 'PASS', detail || '')
  } catch (err) {
    record(name, 'FAIL', err.message)
  }
}

async function currentExpenseNos() {
  const { data, error } = await sb.from('expenses').select('expense_no')
  if (error) throw new Error(error.message)
  return (data || []).map(r => ({ expenseNo: r.expense_no }))
}

async function createExpense(form, label) {
  const now = new Date().toISOString()
  const payload = {
    ...toDbExpense(form),
    created_at: now,
    updated_at: now,
  }
  const { data, error } = await sb.from('expenses').insert([payload]).select(SELECT).single()
  if (error) throw new Error(`${error.code || ''} ${error.message}`.trim())
  inserted.add(data.id)
  return data
}

async function deleteExpense(id) {
  const { error } = await sb.from('expenses').delete().eq('id', id)
  if (error) throw new Error(`delete failed: ${error.message}`)
  inserted.delete(id)
  const { data, error: readErr } = await sb.from('expenses').select('id').eq('id', id)
  if (readErr) throw new Error(`verify delete failed: ${readErr.message}`)
  return (data || []).length === 0
}

async function fetchContext() {
  const { data: bookings, error } = await sb
    .from('bookings')
    .select('id, booking_number, customer_name, vehicle_reg')
    .limit(5)
  if (error) throw new Error(`bookings: ${error.message}`)
  const booking = (bookings || []).find(b => b.id) || null

  let reg = booking?.vehicle_reg
  if (!reg) {
    const { data: vehicles } = await sb.from('vehicles').select('registration').limit(1)
    reg = vehicles?.[0]?.registration
  }
  return { booking, reg: reg || 'PY01DF1255' }
}

const TYPE_FIELDS = {
  fuel:        { odometerKm: 45230, litresFilled: 20.5, fuelStation: 'E2E Pump', fuelRate: 102.5 },
  toll:        { description: 'E2E toll bill' },
  parking:     { description: 'E2E parking bill' },
  bata:        { description: 'E2E bata bill' },
  food:        { description: 'E2E food bill' },
  maintenance: { description: 'E2E maintenance bill' },
  repair:      { description: 'E2E repair bill' },
  permit:      { description: 'E2E permit bill' },
  insurance:   { description: 'E2E insurance bill' },
  misc:        { description: 'E2E misc bill' },
}

async function verifyCommon(row, form, expectedNo) {
  check(row.expense_no === expectedNo, `expense_no ${row.expense_no} != ${expectedNo}`)
  check(Number(row.amount) === Number(form.amount), `amount ${row.amount}`)
  check(row.expense_date === form.date, `date ${row.expense_date}`)
  check(row.vehicle_reg === form.vehicle, `vehicle_reg ${row.vehicle_reg}`)
  check(row.driver_name === form.driver, `driver_name ${row.driver_name}`)
  if (form.bookingId) {
    check(row.booking_id === form.bookingId, `booking_id ${row.booking_id}`)
    check(row.trip_ref === form.tripRef, `trip_ref ${row.trip_ref}`)
  }
  const norm = normalizeExpense(row)
  check(norm.expenseNo === expectedNo, 'normalize expenseNo')
  check(norm.vehicle === form.vehicle, `normalize vehicle ${norm.vehicle}`)
  check(norm.amount === Number(form.amount), `normalize amount ${norm.amount}`)
  check(norm.date === form.date, `normalize date ${norm.date}`)
  if (form.bookingId) check(norm.tripRef === form.tripRef, `normalize tripRef ${norm.tripRef}`)
  return norm
}

const context = await fetchContext()
console.log(`Context: booking=${context.booking?.booking_number || 'none'} vehicle=${context.reg}\n`)

// ── 1. Create + verify + delete for every expense type ──────────
for (const { key } of EXPENSE_TYPES) {
  await runCase(`type: ${key}`, async () => {
    const expectedNo = generateExpenseNo(await currentExpenseNos())
    const form = {
      id: '', type: key, status: 'pending', date: today(), amount: '1250.50', expenseNo: expectedNo,
      description: TYPE_FIELDS[key].description || `E2E ${key} bill`,
      tripRef: context.booking?.booking_number || '',
      bookingId: context.booking?.id || '',
      driver: 'E2E Driver', vehicle: context.reg, addedBy: 'e2e-tester',
      receiptName: '', receiptUrl: '', notes: `e2e ${key}`,
      ...TYPE_FIELDS[key],
    }
    const row = await createExpense(form)
    try {
      const expectedType = key === 'misc' ? 'other' : key
      check(row.type === expectedType, `type ${row.type} != ${expectedType}`)
      check(row.status === 'pending', `status ${row.status}`)
      check(row.expense_type === (['fuel', 'toll'].includes(expectedType) ? expectedType : 'other'),
        `expense_type ${row.expense_type}`)
      const norm = await verifyCommon(row, form, expectedNo)
      check(norm.status === 'pending', `normalize status ${norm.status}`)
      if (key === 'fuel') {
        check(Number(row.odometer_km) === 45230, `odometer ${row.odometer_km}`)
        check(Number(row.litres_filled) === 20.5, `litres ${row.litres_filled}`)
        check(row.fuel_station === 'E2E Pump', `station ${row.fuel_station}`)
        check(Number(row.fuel_rate) === 102.5, `rate ${row.fuel_rate}`)
        check(norm.odometerKm === 45230, 'normalize odometer')
        check(norm.fuelStation === 'E2E Pump', 'normalize station')
      }
      check(await deleteExpense(row.id), 'row still exists after delete')
      return `no=${row.expense_no}, deleted`
    } catch (err) {
      if (inserted.has(row.id)) await deleteExpense(row.id).catch(() => {})
      throw err
    }
  })
}

// ── 2. Status mapping (DB check constraint) ────────────────────
const STATUS_CASES = [
  ['pending', 'pending'],
  ['approved', 'approved'],
  ['rejected', 'rejected'],
  ['draft', 'pending'],     // legacy value must map
  ['submitted', 'pending'], // legacy value must map
]
for (const [input, expected] of STATUS_CASES) {
  await runCase(`status: ${input} -> ${expected}`, async () => {
    const expectedNo = generateExpenseNo(await currentExpenseNos())
    const form = {
      id: '', type: 'toll', status: input, date: today(), amount: '99', expenseNo: expectedNo,
      description: `E2E status ${input}`, tripRef: '', bookingId: '', driver: 'E2E Driver',
      vehicle: context.reg, addedBy: 'e2e-tester',
    }
    const row = await createExpense(form)
    try {
      check(row.status === expected, `stored status ${row.status} != ${expected}`)
      check(row.approval_status === expected, `approval_status ${row.approval_status}`)
      check(row.expense_no === expectedNo, `expense_no ${row.expense_no}`)
      check(await deleteExpense(row.id), 'row still exists after delete')
      return `stored=${row.status}, deleted`
    } catch (err) {
      if (inserted.has(row.id)) await deleteExpense(row.id).catch(() => {})
      throw err
    }
  })
}

// ── 3. Approval transition pending -> approved -> rejected ─────
await runCase('flow: approve then reject', async () => {
  const expectedNo = generateExpenseNo(await currentExpenseNos())
  const form = {
    id: '', type: 'food', status: 'pending', date: today(), amount: '450', expenseNo: expectedNo,
    description: 'E2E approval flow', tripRef: '', bookingId: '', driver: 'E2E Driver',
    vehicle: context.reg, addedBy: 'e2e-tester',
  }
  const row = await createExpense(form)
  try {
    for (const next of ['approved', 'rejected']) {
      const { data, error } = await sb
        .from('expenses')
        .update({ ...toDbExpense({ ...form, status: next }), updated_at: new Date().toISOString() })
        .eq('id', row.id)
        .select(SELECT)
        .single()
      if (error) throw new Error(`${next}: ${error.message}`)
      check(data.status === next, `update to ${next} stored ${data.status}`)
      check(data.approval_status === next, `approval_status ${data.approval_status}`)
      check(data.expense_no === expectedNo, 'expense_no changed on update')
    }
    check(await deleteExpense(row.id), 'row still exists after delete')
    return 'pending -> approved -> rejected, deleted'
  } catch (err) {
    if (inserted.has(row.id)) await deleteExpense(row.id).catch(() => {})
    throw err
  }
})

// ── 4. Receipt formats: upload -> sign -> save -> delete ───────
const RECEIPT_FORMATS = [
  { ext: 'jpg',  mime: 'image/jpeg',      bytes: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]) },
  { ext: 'png',  mime: 'image/png',       bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]) },
  { ext: 'pdf',  mime: 'application/pdf', bytes: Buffer.from('%PDF-1.4\n% E2E receipt\n1 0 obj<<>>endobj\n') },
]

for (const fmt of RECEIPT_FORMATS) {
  await runCase(`receipt: ${fmt.ext} upload + bill`, async () => {
    const path = `${new Date().getFullYear()}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fmt.ext}`
    const up = await sb.storage.from(BUCKET).upload(path, fmt.bytes, {
      upsert: false,
      contentType: fmt.mime,
    })
    if (up.error) throw new Error(`upload: ${up.error.message}`)
    uploaded.add(path)

    const signed = await sb.storage.from(BUCKET).createSignedUrl(path, 3600)
    if (signed.error || !signed.data?.signedUrl) {
      throw new Error(`sign: ${signed.error?.message || 'no URL'}`)
    }

    const expectedNo = generateExpenseNo(await currentExpenseNos())
    const form = {
      id: '', type: 'maintenance', status: 'pending', date: today(), amount: '3200', expenseNo: expectedNo,
      description: `E2E receipt ${fmt.ext}`, tripRef: '', bookingId: '', driver: 'E2E Driver',
      vehicle: context.reg, addedBy: 'e2e-tester',
      receiptName: `receipt.${fmt.ext}`, receiptUrl: signed.data.signedUrl,
    }
    const row = await createExpense(form)
    try {
      check(row.expense_no === expectedNo, `expense_no ${row.expense_no}`)
      check(row.receipt_name === form.receiptName, `receipt_name ${row.receipt_name}`)
      check(row.receipt_url === form.receiptUrl, 'receipt_url not stored')
      const norm = normalizeExpense(row)
      check(norm.receiptName === form.receiptName, `normalize receiptName ${norm.receiptName}`)
      check(norm.receiptUrl === form.receiptUrl, 'normalize receiptUrl')
      check(await deleteExpense(row.id), 'row still exists after delete')
    } catch (err) {
      if (inserted.has(row.id)) await deleteExpense(row.id).catch(() => {})
      throw err
    }

    const del = await sb.storage.from(BUCKET).remove([path])
    if (del.error) throw new Error(`remove file: ${del.error.message}`)
    uploaded.delete(path)
    return 'uploaded, signed, saved, deleted'
  })
}

// ── 5. Unsupported formats/sizes must be rejected by the bucket ─
await runCase('receipt: webp rejected by bucket', async () => {
  const path = `e2e-reject/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`
  const up = await sb.storage.from(BUCKET).upload(path, Buffer.from('RIFF0000WEBPVP8 ', 'ascii'), {
    upsert: false,
    contentType: 'image/webp',
  })
  if (!up.error) {
    await sb.storage.from(BUCKET).remove([path]).catch(() => {})
    throw new Error('bucket accepted image/webp')
  }
  return up.error.message
})

await runCase('receipt: >10MB rejected by bucket', async () => {
  const path = `e2e-reject/${Date.now()}-big.pdf`
  const big = Buffer.alloc(10 * 1024 * 1024 + 1, 0x20)
  const up = await sb.storage.from(BUCKET).upload(path, big, {
    upsert: false,
    contentType: 'application/pdf',
  })
  if (!up.error) {
    await sb.storage.from(BUCKET).remove([path]).catch(() => {})
    throw new Error('bucket accepted a file over 10 MB')
  }
  return up.error.message
})

// ── Cleanup any leftovers ─────────────────────────────────────
let cleanupFailures = 0
for (const id of [...inserted]) {
  try { await deleteExpense(id) } catch { cleanupFailures++ }
}
for (const path of [...uploaded]) {
  try { await sb.storage.from(BUCKET).remove([path]) } catch { cleanupFailures++ }
}

const passed = results.filter(r => r.status === 'PASS').length
const failed = results.filter(r => r.status === 'FAIL').length

// ── Report ────────────────────────────────────────────────────
const lines = []
lines.push('# Expense (bill) E2E Report')
lines.push('')
lines.push(`- Date: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`)
lines.push(`- Project: ${URL}`)
lines.push(`- Booking used: ${context.booking?.booking_number || 'none'}`)
lines.push(`- Vehicle used: ${context.reg}`)
lines.push(`- Cases: ${results.length} | Passed: ${passed} | Failed: ${failed}`)
lines.push(`- Leftover test rows: ${inserted.size} | Leftover files: ${uploaded.size} | Cleanup errors: ${cleanupFailures}`)
lines.push('')
lines.push('| # | Test case | Result | Detail |')
lines.push('|---|---|---|---|')
results.forEach((r, i) => {
  lines.push(`| ${i + 1} | ${r.name} | ${r.status === 'PASS' ? '✅ PASS' : '❌ FAIL'} | ${String(r.detail).replace(/\|/g, '\\|')} |`)
})
lines.push('')

const dir = 'reports'
if (!fs.existsSync(dir)) fs.mkdirSync(dir)
const reportPath = `${dir}/expense-e2e-report.md`
fs.writeFileSync(reportPath, lines.join('\n'), 'utf8')

console.log(`\n${passed}/${results.length} passed, ${failed} failed`)
console.log(`Report: ${reportPath}`)
console.log(`Leftovers: rows=${inserted.size} files=${uploaded.size} cleanupErrors=${cleanupFailures}`)
process.exit(failed > 0 || cleanupFailures > 0 || inserted.size > 0 || uploaded.size > 0 ? 1 : 0)

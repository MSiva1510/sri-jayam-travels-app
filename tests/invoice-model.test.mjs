import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildWhatsAppUrl,
  calcDocumentTotals,
  createManualNumber,
  formatINR,
  invoiceEligibility,
  invoiceSummary,
  matchesSearch,
  matchesTab,
  normalizeInvoice,
} from '../src/data/invoiceModel.js'
import { amountInWords } from '../src/utils/amountInWords.js'

test('booking eligibility uses existing completed/closed rule and excludes cancellations', () => {
  assert.deepEqual(invoiceEligibility({ id: 'b1', status: 'completed' }), { eligible: true, reason: null })
  assert.deepEqual(invoiceEligibility({ id: 'b2', status: 'closed' }), { eligible: true, reason: null })
  assert.deepEqual(invoiceEligibility({ id: 'b3', status: 'cancelled' }), { eligible: false, reason: 'cancelled' })
  assert.deepEqual(invoiceEligibility({ id: 'b4', status: 'assigned' }), { eligible: false, reason: 'not-completed' })
})

test('already invoiced bookings are blocked', () => {
  const records = [{ source_type: 'booking', source_id: 'b1', status: 'pending' }]
  assert.deepEqual(invoiceEligibility({ id: 'b1', status: 'completed' }, records),
    { eligible: false, reason: 'already-invoiced' })
})

test('manual totals preserve existing line-item arithmetic with rounding', () => {
  const totals = calcDocumentTotals({
    lineItems: [
      { description: 'One', quantity: 2, unitPrice: 100.5 },
      { description: 'Two', quantity: 1, unitPrice: 49.25 },
    ],
  })
  assert.equal(totals.subtotal, 250.25)
  assert.equal(totals.total, 250.25)
})

test('legacy documents keep the fare plus charges total', () => {
  const invoice = normalizeInvoice({
    source: { id: 'm1', bookingNo: 'MB-1', customer: 'Test', fare: 100, toll: 20, parking: 5, isManual: true },
  })
  assert.equal(invoice.total, 125)
  assert.equal(invoice.lineItems.length, 3)
  assert.equal(invoice.paymentStatus, 'pending')
})

test('payments derive paid, partial and balance without overwriting history', () => {
  const source = { id: 'm2', bookingNo: 'MB-2', customer: 'Test', fare: 500, isManual: true }
  const record = { id: 'r2', source_type: 'manual', source_id: 'm2', status: 'partial', total_amount: 500 }
  const payments = [
    { id: 'p1', invoice_id: 'r2', amount: 200, status: 'recorded' },
    { id: 'p2', invoice_id: 'r2', amount: 100, status: 'reversed' },
    { id: 'p3', invoice_id: 'r2', amount: 50, status: 'refunded' },
  ]
  const invoice = normalizeInvoice({ source, records: [record], payments })
  assert.equal(invoice.paid, 200)
  assert.equal(invoice.balance, 300)
  assert.equal(invoice.paymentStatus, 'partial')
  // History keeps every row; only valid money reduces the balance.
  assert.equal(invoice.paymentRecords.length, 3)
})

test('overdue is derived from due date only when a balance remains', () => {
  const invoice = normalizeInvoice({
    source: { id: 'm3', bookingNo: 'MB-3', customer: 'Test', fare: 100, isManual: true, dueDate: '2020-01-01' },
  })
  assert.equal(invoice.paymentStatus, 'overdue')
  assert.equal(matchesTab(invoice, 'overdue'), true)
})

test('summary uses actual invoice and payment amounts', () => {
  const invoices = [
    { total: 100, paid: 100, paymentStatus: 'paid' },
    { total: 200, paid: 50, paymentStatus: 'partial' },
    { total: 300, paid: 0, paymentStatus: 'overdue' },
  ]
  assert.deepEqual(invoiceSummary(invoices), { total: 600, received: 150, pending: 450, overdue: 300 })
})

test('currency formatting uses Indian grouping', () => {
  assert.equal(formatINR(1234567), 'Rs. 12,34,567')
  assert.equal(formatINR(250.5), 'Rs. 250.50')
})

test('manual and quotation numbers keep the existing prefixes', () => {
  const now = new Date(2026, 10, 21, 13, 45, 0)
  assert.match(createManualNumber('invoice', now), /^MB-261121-\d{4}$/)
  assert.match(createManualNumber('quotation', now), /^QT-261121-\d{4}$/)
})

test('search covers invoice number, customer, reference and route', () => {
  const invoice = normalizeInvoice({
    source: {
      id: 'm4', bookingNo: 'MB-4', bookingRef: 'REF-77', customer: 'Kumar',
      pickup: 'Chennai', drop: 'Salem', isManual: true, fare: 100,
    },
  })
  assert.equal(matchesSearch(invoice, 'ref-77'), true)
  assert.equal(matchesSearch(invoice, 'salem'), true)
  assert.equal(matchesSearch(invoice, 'MB-4'), true)
  assert.equal(matchesSearch(invoice, 'nobody'), false)
})

test('WhatsApp share text only contains customer-facing document facts', () => {
  const invoice = normalizeInvoice({
    source: {
      id: 'internal-id', bookingNo: 'MB-5', customer: 'Kumar',
      pickup: 'Chennai', drop: 'Salem', isManual: true, fare: 500, km: 120,
    },
  })
  const url = buildWhatsAppUrl(
    invoice,
    { name: 'Sri Jayam Travels', phone: '9999999999' },
    'Rs.',
    { footerText: 'Thank you for travelling with us!' },
  )
  assert.match(url, /^https:\/\/wa\.me\/\?text=/)
  const text = decodeURIComponent(url.split('?text=')[1])
  assert.match(text, /MB-5/)
  assert.match(text, /Kumar/)
  assert.match(text, /Distance: 120 km/)
  assert.match(text, /Fare: Rs\. 500/)
  assert.match(text, /Rs\. 500/)
  assert.match(text, /Thank you for travelling with us!/)
  assert.equal(text.includes('internal-id'), false)
})

test('amount in words follows the Indian numbering system', () => {
  assert.equal(amountInWords(0), 'Zero Rupees Only')
  assert.equal(amountInWords(1234567), 'Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven Rupees Only')
})

// ─── Invoice model ─────────────────────────────────────────────
// Pure helpers shared by the invoice dashboard, editors and preview.
// No Supabase access here so the business rules can be unit-tested.

export const BOOKING_STATUSES = {
  billable: ['completed', 'closed'],
  cancelled: ['cancelled'],
  ongoing: ['draft', 'pending', 'approved', 'confirmed', 'assigned', 'started'],
}

export const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Other']

// Money that came back to the customer never reduces the balance. Reversed and
// refunded payment rows stay in history for audit; they simply are not valid.
export const NON_COUNTING_PAYMENT_STATUSES = ['reversed', 'refunded']

export const INVOICE_TABS = [
  { key: 'all',      label: 'All Invoices' },
  { key: 'paid',     label: 'Paid' },
  { key: 'partial',  label: 'Partially Paid' },
  { key: 'pending',  label: 'Pending' },
  { key: 'overdue',  label: 'Overdue' },
  { key: 'draft',    label: 'Draft' },
]

const STATUS_ALIASES = {
  paid: 'paid',
  settled: 'paid',
  partial: 'partial',
  partially_paid: 'partial',
  pending: 'pending',
  unpaid: 'pending',
  overdue: 'overdue',
  draft: 'draft',
  cancelled: 'cancelled',
  void: 'cancelled',
}

export const roundMoney = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : 0
}

export const num = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function formatINR(value, currency = 'Rs.') {
  return `${currency} ${roundMoney(value).toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(roundMoney(value)) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}

export function shortDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function shortLocation(value) {
  const text = String(value || '').trim()
  if (!text) return '—'
  const first = text.split(/[,|\n]/)[0].trim()
  return first.length > 34 ? `${first.slice(0, 33)}…` : first || '—'
}

export function invoiceKey(sourceType, sourceId) {
  return `${sourceType}:${sourceId}`
}

export function isBillableBooking(booking) {
  return BOOKING_STATUSES.billable.includes(String(booking?.status || '').toLowerCase())
}

export function isCancelledBooking(booking) {
  return BOOKING_STATUSES.cancelled.includes(String(booking?.status || '').toLowerCase())
}

export function isOngoingBooking(booking) {
  return BOOKING_STATUSES.ongoing.includes(String(booking?.status || '').toLowerCase())
}

export function alreadyInvoiced(booking, records = []) {
  const id = booking?.id
  if (!id) return null
  return records.find(r => r.source_type === 'booking'
    && String(r.source_id) === String(id)
    && r.status !== 'cancelled') || null
}

export function invoiceEligibility(booking, records = []) {
  const status = String(booking?.status || '').toLowerCase()
  if (isCancelledBooking(booking)) return { eligible: false, reason: 'cancelled' }
  if (!isBillableBooking(booking)) return { eligible: false, reason: 'not-completed' }
  if (alreadyInvoiced(booking, records)) return { eligible: false, reason: 'already-invoiced' }
  return { eligible: true, reason: null }
}

// Legacy documents store money in fixed columns. New documents store line
// items and adjustments in the description JSON but keep total_fare as the
// authoritative grand total.
export function lineItemsFromLegacy(doc = {}) {
  const rows = [
    ['Trip Fare', doc.fare],
    ['Toll Charges', doc.toll],
    ['Driver Bata', doc.bata],
    ['Fuel / Petrol', doc.petrol],
    ['Parking', doc.parking],
    ['Other Charges', doc.extras],
  ]
  return rows
    .map(([description, amount]) => ({ description, quantity: 1, unitPrice: num(amount), total: roundMoney(amount) }))
    .filter(row => row.total !== 0 || row.description === 'Trip Fare')
}

export function docLineItems(doc = {}) {
  if (Array.isArray(doc.lineItems) && doc.lineItems.length > 0) {
    return doc.lineItems.map(item => ({
      description: item.description || 'Line item',
      quantity: num(item.quantity),
      unitPrice: roundMoney(item.unitPrice),
      total: roundMoney(item.total ?? num(item.quantity) * num(item.unitPrice)),
    }))
  }
  return lineItemsFromLegacy(doc)
}

// Charge components are the only supported fare fields in this app. There is
// no tax, discount or round-off rule anywhere in the existing billing flow, so
// the total stays the sum of the printed lines.
export function calcDocumentTotals(doc = {}) {
  if (Array.isArray(doc.lineItems) && doc.lineItems.length > 0) {
    const total = roundMoney(doc.lineItems.reduce(
      (sum, item) => sum + roundMoney(num(item.total ?? num(item.quantity) * num(item.unitPrice))), 0))
    return { subtotal: total, total }
  }
  const items = lineItemsFromLegacy(doc)
  const total = roundMoney(items.reduce((sum, item) => sum + item.total, 0))
  return { subtotal: total, total }
}

// Preserve the existing MB-/QT-YYMMDD-NNNN numbering used by the old form.
export function createManualNumber(kind = 'invoice', now = new Date()) {
  const stamp = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getTime()).slice(-4)}`
  return `${kind === 'quotation' ? 'QT' : 'MB'}-${stamp}`
}

function normalizeStatus(value, dueDate, total, paid, fallback = 'pending') {
  const key = STATUS_ALIASES[String(value || '').toLowerCase()] || fallback
  if (key === 'cancelled' || key === 'draft') return key
  if (total > 0 && paid >= total) return 'paid'
  if (paid > 0) return 'partial'
  if (dueDate && new Date(`${String(dueDate).slice(0, 10)}T23:59:59`) < new Date()) return 'overdue'
  return key === 'paid' || key === 'partial' ? 'pending' : key
}

export function normalizeInvoice({ source, records = [], payments = [] } = {}) {
  const doc = source || {}
  const isManual = !!doc.isManual
  const isQuote = doc.docType === 'quotation'
  const sourceType = isManual ? (isQuote ? 'quotation' : 'manual') : 'booking'
  const sourceId = doc.id || doc.bookingNo || ''
  // Never print an internal DB id as a customer-facing number.
  const invoiceNo = doc.invoiceNo || doc.invoice_no || doc.bookingNo || doc.billNo || '—'
  const totals = calcDocumentTotals(doc)
  const relatedRecords = records.filter(r => {
    if (r.source_type === sourceType && String(r.source_id) === String(sourceId)) return true
    return !isManual && String(r.invoice_number) === String(invoiceNo)
  })
  const record = relatedRecords.find(r => r.status !== 'cancelled') || null
  // Once issued, the persisted record is the financial source of truth.
  const total = roundMoney(record?.total_amount ?? doc.totalAmount ?? totals.total ?? doc.fare ?? 0)
  const relatedPayments = payments.filter(p => {
    if (record && p.invoice_id === record.id) return true
    return p.invoice_number && String(p.invoice_number) === String(invoiceNo)
  })
  const validPayments = relatedPayments
    .filter(p => !NON_COUNTING_PAYMENT_STATUSES.includes(String(p.status || '').toLowerCase()))

  const paid = roundMoney(validPayments.reduce((sum, p) => sum + num(p.amount), 0))
  const balance = Math.max(0, roundMoney(total - paid))
  const dueDate = doc.dueDate || record?.due_date || null
  const status = isQuote
    ? 'draft'
    : normalizeStatus(doc.status || record?.status, dueDate, total, paid, 'pending')

  return {
    key: invoiceKey(sourceType, sourceId),
    sourceType,
    sourceId,
    invoiceNo,
    customer: doc.customer || doc.customer_name || '—',
    contact: doc.contact || doc.customer_contact || '',
    customerGstin: doc.customerGstin || '',
    billingAddress: doc.billingAddress || '',
    bookingRef: isManual ? (doc.bookingRef || '') : (doc.bookingNo || ''),
    invoiceDate: doc.invoiceDate || doc.invoice_date || doc.startDate || '',
    dueDate,
    tripDate: doc.startDate || doc.tripDate || '',
    pickup: doc.pickup || '',
    drop: doc.drop || '',
    vehicle: doc.vehicle || doc.vehicleReg || '',
    driver: doc.driver || '',
    driverMobile: doc.driverMobile || doc.driver_contact || '',
    km: num(doc.km),
    status: doc.status || record?.status || '',
    lineItems: docLineItems(doc),
    subtotal: totals.subtotal,
    total,
    paid,
    balance,
    paymentStatus: status,
    paymentRecords: relatedPayments,
    record,
    notes: doc.notes || '',
    terms: doc.terms || doc.termsText || '',
    validUntil: doc.validUntil || '',
    isManual,
    isQuote,
    raw: doc,
  }
}

export function matchesTab(invoice, tab) {
  if (!tab || tab === 'all') return true
  return invoice.paymentStatus === tab
}

export function matchesSearch(invoice, query = '') {
  const q = String(query).trim().toLowerCase()
  if (!q) return true
  return [invoice.invoiceNo, invoice.customer, invoice.bookingRef, invoice.pickup, invoice.drop, invoice.contact]
    .some(value => String(value || '').toLowerCase().includes(q))
}

export function invoiceSummary(invoices = []) {
  const totals = invoices.reduce((acc, inv) => {
    const total = roundMoney(inv.total)
    const paid = roundMoney(inv.paid)
    acc.total += total
    acc.received += paid
    acc.pending += Math.max(0, roundMoney(total - paid))
    if (inv.paymentStatus === 'overdue') acc.overdue += Math.max(0, roundMoney(total - paid))
    return acc
  }, { total: 0, received: 0, pending: 0, overdue: 0 })
  return {
    total: roundMoney(totals.total),
    received: roundMoney(totals.received),
    pending: roundMoney(totals.pending),
    overdue: roundMoney(totals.overdue),
  }
}

export function buildWhatsAppUrl(invoice, biz = {}, currency = 'Rs.', settings = {}) {
  const fareLine = (invoice.lineItems || []).find(item =>
    String(item.description || '').toLowerCase().includes('trip fare'))
  const fare = roundMoney(fareLine?.total ?? invoice.raw?.fare ?? invoice.subtotal ?? invoice.total)
  const lines = [
    `*${biz.name || 'Sri Jayam Travels'}*`,
    `${invoice.isQuote ? 'Quotation' : 'Invoice'}: ${invoice.invoiceNo}`,
    `Customer: ${invoice.customer}`,
    `Date: ${shortDate(invoice.invoiceDate)}`,
    `${invoice.pickup || '—'} → ${invoice.drop || '—'}`,
    ...(num(invoice.km) > 0 ? [`Distance: ${num(invoice.km).toLocaleString('en-IN')} km`] : []),
    `Fare: ${formatINR(fare, currency)}`,
    `*Total: ${formatINR(invoice.total, currency)}*`,
    `Balance: ${formatINR(invoice.balance, currency)}`,
    '',
    settings.footerText || '',
    biz.phone || '',
  ].filter(Boolean)
  return `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`
}

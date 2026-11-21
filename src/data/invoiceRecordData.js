// ─── Invoice Records & Payments ───────────────────────────────
// Persistence for the invoice redesign. Issuance metadata lives in
// `invoice_records`; customer payments live in `invoice_payments`.
// Trip invoices themselves are still derived from completed/closed
// bookings and manual bills/quotations still use
// `manager_non_trip_invoices` — this layer only stamps and settles them.
//
// All writes go through the SECURITY DEFINER RPCs introduced in
// 20261121_invoice_management.sql so an idempotency key can be honoured
// without granting clients direct write access to the tables.

import supabase from '../lib/supabase.js'
import { translateDbError } from './errorUtils.js'

export const INVOICE_RECORDS_TABLE = 'invoice_records'
export const INVOICE_PAYMENTS_TABLE = 'invoice_payments'

const pick = (input, camel, snake) => {
  if (!input || typeof input !== 'object') return null
  const value = input[camel] ?? input[snake]
  return value === undefined ? null : value
}

function randomId() {
  const webCrypto = typeof globalThis !== 'undefined' ? globalThis.crypto : null
  if (webCrypto && typeof webCrypto.randomUUID === 'function') {
    try {
      return webCrypto.randomUUID()
    } catch {
      // Fall through to the local generator.
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = Math.floor(Math.random() * 16)
    const v = ch === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function stableHash(value) {
  let hash = 2166136261
  const text = String(value)
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

// Stable for a given part (so a retried submit reuses one key), with a
// crypto.randomUUID() fallback when no part is supplied.
export function invoicePaymentKey(part) {
  const seed = part == null ? '' : String(part).trim()
  return seed ? `pay-${stableHash(seed)}` : randomId()
}

function requireSupabase(operation) {
  if (!supabase) throw new Error(`Supabase is not configured (${operation})`)
  return supabase
}

export async function loadInvoiceRecords() {
  if (!supabase) return []
  const { data, error } = await supabase.from(INVOICE_RECORDS_TABLE).select('*')
  if (error) throw translateDbError(error, 'loadInvoiceRecords')
  return data || []
}

export async function loadInvoicePayments() {
  if (!supabase) return []
  const { data, error } = await supabase.from(INVOICE_PAYMENTS_TABLE).select('*')
  if (error) throw translateDbError(error, 'loadInvoicePayments')
  return data || []
}

export async function createInvoiceRecord(input = {}) {
  const db = requireSupabase('createInvoiceRecord')
  const { data, error } = await db.rpc('create_invoice_record', {
    p_invoice_number: pick(input, 'invoiceNumber', 'invoice_number'),
    p_source_type: pick(input, 'sourceType', 'source_type'),
    p_source_id: pick(input, 'sourceId', 'source_id'),
    p_booking_id: pick(input, 'bookingId', 'booking_id'),
    p_customer_name: pick(input, 'customerName', 'customer_name'),
    p_customer_contact: pick(input, 'customerContact', 'customer_contact'),
    p_total_amount: pick(input, 'totalAmount', 'total_amount'),
    p_invoice_date: pick(input, 'invoiceDate', 'invoice_date'),
    p_due_date: pick(input, 'dueDate', 'due_date'),
    p_status: pick(input, 'status', 'status'),
    p_idempotency_key:
      pick(input, 'idempotencyKey', 'idempotency_key') || randomId(),
    p_subtotal: pick(input, 'subtotal', 'subtotal'),
    p_discount: pick(input, 'discount', 'discount'),
    p_tax_percent: pick(input, 'taxPercent', 'tax_percent'),
  })
  if (error) throw translateDbError(error, 'createInvoiceRecord')
  return data
}

export async function recordInvoicePayment(input = {}) {
  const db = requireSupabase('recordInvoicePayment')
  const { data, error } = await db.rpc('record_invoice_payment', {
    p_invoice_id: pick(input, 'invoiceId', 'invoice_id'),
    p_amount: pick(input, 'amount', 'amount'),
    p_method: pick(input, 'method', 'method') ?? pick(input, 'paymentMethod', 'payment_method'),
    p_reference: pick(input, 'reference', 'reference') ?? pick(input, 'paymentReference', 'payment_reference'),
    p_payment_date: pick(input, 'paymentDate', 'payment_date'),
    p_idempotency_key:
      pick(input, 'idempotencyKey', 'idempotency_key') ||
      invoicePaymentKey(pick(input, 'idempotencyPart', 'idempotency_part')),
  })
  if (error) throw translateDbError(error, 'recordInvoicePayment')
  return data
}

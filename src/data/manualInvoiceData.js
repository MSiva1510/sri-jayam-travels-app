// ─── Manual Invoices & Quotations ─────────────────────────────
// Bills created without a trip record. They are business documents, so
// they live in the `manager_non_trip_invoices` table — closing the tab
// must not delete a bill, and managers can write this table (unlike
// `settings`, which is admin-only).
//
// The table has fixed money columns plus a `description` text column.
// Fields the table has no column for (route, driver, vehicle, km, notes,
// lead source, document type …) are serialised into `description` as JSON
// and parsed back on load. Old plain-text descriptions still load as notes.

import supabase from '../lib/supabase'

export const MANUAL_INVOICES_TABLE = 'manager_non_trip_invoices'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (v) => UUID_RE.test(String(v || ''))
const num = (v) => Number(v) || 0

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function parseExtras(description) {
  if (!description) return { extras: {}, notes: '' }
  const text = String(description).trim()
  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text)
      if (parsed && typeof parsed === 'object') {
        return { extras: parsed, notes: parsed.notes || '' }
      }
    } catch {
      // Fall through: legacy free-text description.
    }
  }
  return { extras: {}, notes: text }
}

function toRow(doc = {}) {
  const extras = {
    pickup:        doc.pickup || '',
    drop:          doc.drop || '',
    driver:        doc.driver || '',
    driverMobile:  doc.driverMobile || doc.driver_contact || '',
    driver_contact: doc.driver_contact || doc.driverMobile || '',
    vehicle:       doc.vehicle || '',
    km:            num(doc.km),
    notes:         doc.notes || '',
    leadSource:    doc.leadSource || '',
    source:        doc.source || doc.leadSource || '',
    status:        doc.status || 'pending',
    docType:       doc.docType || 'invoice',
    isManual:      true,
    createdAt:     doc.createdAt || new Date().toISOString(),
    type:          doc.type || '',
  }
  return {
    invoice_number:   doc.bookingNo || `MAN-${Date.now().toString().slice(-6)}`,
    customer_name:    doc.customer || '',
    customer_contact: doc.contact || '',
    invoice_date:     doc.startDate || today(),
    description:      JSON.stringify(extras),
    total_fare:       num(doc.fare),
    invoice_toll:     num(doc.toll),
    invoice_bata:     num(doc.bata),
    invoice_fuel:     num(doc.petrol),
    invoice_parking:  num(doc.parking),
    invoice_extras:   num(doc.extras),
  }
}

function fromRow(row = {}) {
  const { extras, notes } = parseExtras(row.description)
  return {
    id:             row.id,
    bookingNo:      row.invoice_number || '',
    customer:       row.customer_name || '',
    contact:        row.customer_contact || '',
    pickup:         extras.pickup || '',
    drop:           extras.drop || '',
    driver:         extras.driver || '',
    driverMobile:   extras.driverMobile || extras.driver_contact || '',
    driver_contact: extras.driver_contact || extras.driverMobile || '',
    vehicle:        extras.vehicle || '',
    km:             num(extras.km),
    fare:           num(row.total_fare),
    toll:           num(row.invoice_toll),
    bata:           num(row.invoice_bata),
    petrol:         num(row.invoice_fuel),
    parking:        num(row.invoice_parking),
    extras:         num(row.invoice_extras),
    startDate:      row.invoice_date || '',
    type:           extras.type || '',
    notes,
    leadSource:     extras.leadSource || '',
    source:         extras.source || extras.leadSource || '',
    status:         extras.status || 'pending',
    docType:        extras.docType || 'invoice',
    isManual:       true,
    createdAt:      extras.createdAt || row.created_at || null,
  }
}

export async function loadManualInvoices() {
  const { data, error } = await requireSupabase()
    .from(MANUAL_INVOICES_TABLE)
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message || 'Could not load manual invoices')
  return (data || []).map(fromRow)
}

// Writes every document in `list`. Rows already in Supabase are matched by
// their row id; new documents are inserted. Nothing is deleted here — see
// deleteManualInvoice, so a failed load can never wipe the saved bills.
export async function saveManualInvoices(list) {
  const docs = Array.isArray(list) ? list : []
  const db = requireSupabase()

  for (const doc of docs) {
    const row = toRow(doc)
    if (isUuid(doc.id)) {
      const { data, error } = await db
        .from(MANUAL_INVOICES_TABLE)
        .update(row)
        .eq('id', doc.id)
        .select('id')
      if (error) throw new Error(error.message || 'Could not save this bill')
      if (Array.isArray(data) && data.length > 0) continue
      // The row disappeared (e.g. deleted in another tab) — insert it again.
    }

    const { error } = await db.from(MANUAL_INVOICES_TABLE).insert(row)
    if (error) throw new Error(error.message || 'Could not save this bill')
  }

  return loadManualInvoices()
}

export async function deleteManualInvoice(id) {
  if (!isUuid(id)) return true
  const { error } = await requireSupabase()
    .from(MANUAL_INVOICES_TABLE)
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message || 'Could not delete this bill')
  return true
}

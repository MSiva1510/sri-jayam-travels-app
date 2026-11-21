// ─── DocumentEditor ─────────────────────────────────────────────
// Split form + live preview for booking invoices, manual bills and
// quotations. Uses the same normalization and printable component as the
// detail view, so what is previewed is exactly what is issued.

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, Eye, Plus, Printer, Trash2, X } from 'lucide-react'
import ModalOverlay from '../ui/ModalOverlay'
import Button from '../ui/Button'
import IconButton from '../ui/IconButton'
import Field, { fieldCls, Select as FieldSelect } from '../ui/Field'
import Callout from '../ui/Callout'
import InvoiceDocument from './InvoiceDocument'
import { getBizInfo, getInvoiceSettings, DEFAULT_SETTINGS } from '../../data/settingsData'
import { calcDocumentTotals, createManualNumber, formatINR, normalizeInvoice } from '../../data/invoiceModel'
import { printDocument } from '../../utils/printDocument'

const TRIP_TYPES = [
  { key: '', label: 'Select trip type' },
  { key: 'one_way', label: 'One Way' },
  { key: 'round_trip', label: 'Round Trip' },
  { key: 'multi_loc', label: 'Multi Location' },
  { key: 'local_visit', label: 'Local Visit' },
  { key: 'multi_day', label: 'Multi Day' },
  { key: 'self_drive', label: 'Self Drive' },
]

const CHARGE_SUGGESTIONS = [
  'Trip Fare', 'Toll Charges', 'Driver Bata', 'Fuel / Petrol', 'Parking', 'Other Charges',
]
const CHARGE_COLUMN = {
  'trip fare': 'fare', toll: 'toll', 'toll charges': 'toll',
  bata: 'bata', 'driver bata': 'bata',
  petrol: 'petrol', fuel: 'petrol', 'fuel / petrol': 'petrol',
  parking: 'parking', extras: 'extras', other: 'extras', 'other charges': 'extras',
}

const today = () => new Date().toISOString().slice(0, 10)
const emptyItem = () => ({ description: 'Trip Fare', quantity: 1, unitPrice: '' })

function itemsFromLegacy(doc = {}) {
  return [
    ['Trip Fare', doc.fare], ['Toll Charges', doc.toll], ['Driver Bata', doc.bata],
    ['Fuel / Petrol', doc.petrol], ['Parking', doc.parking], ['Other Charges', doc.extras],
  ]
    .filter(([, value]) => Number(value) > 0)
    .map(([description, value]) => ({ description, quantity: 1, unitPrice: String(value || '') }))
}

function formFromSource({ source, kind, booking }) {
  const base = source || booking || {}
  const lineItems = Array.isArray(base.lineItems) && base.lineItems.length
    ? base.lineItems
    : itemsFromLegacy(base)
  return {
    number: base.invoiceNo || base.invoice_no || base.bookingNo || createManualNumber(kind),
    date: base.invoiceDate || base.invoice_date || base.startDate || today(),
    customer: base.customer || base.customer_name || '',
    contact: base.contact || base.customer_contact || '',
    customerGstin: base.customerGstin || '',
    billingAddress: base.billingAddress || '',
    pickup: base.pickup || '',
    drop: base.drop || '',
    tripType: base.type || '',
    vehicle: base.vehicle || base.vehicleReg || '',
    driver: base.driver || '',
    driverMobile: base.driverMobile || base.driver_contact || '',
    km: String(base.km || ''),
    dueDate: base.dueDate || base.due_date || '',
    validUntil: base.validUntil || '',
    leadSource: base.leadSource || base.source || '',
    notes: base.notes || '',
    terms: base.terms || base.termsText || '',
    items: lineItems.length ? lineItems.map(item => ({
      description: item.description || '',
      quantity: String(item.quantity ?? 1),
      unitPrice: String(item.unitPrice ?? item.total ?? ''),
    })) : [emptyItem()],
  }
}

function buildDoc(form, { source, kind, booking }) {
  const base = source || booking || {}
  // A booking invoice is only created from an actual booking; a blank form is
  // always a manual document (invoice or quotation), never a fake trip bill.
  const isBooking = !source?.isManual && !!booking
  const items = form.items
    .map(item => ({
      description: String(item.description || '').trim(),
      quantity: Number(item.quantity) || 1,
      unitPrice: Number(item.unitPrice) || 0,
      total: Math.round((Number(item.quantity) || 1) * (Number(item.unitPrice) || 0) * 100) / 100,
    }))
    .filter(item => item.description || item.unitPrice)
  const charges = { fare: 0, toll: 0, bata: 0, petrol: 0, parking: 0, extras: 0 }
  items.forEach(item => {
    const column = CHARGE_COLUMN[item.description.toLowerCase()]
    if (column) charges[column] += item.total
  })
  const totals = calcDocumentTotals({ lineItems: items })
  return {
    ...base,
    id: base.id || `manual-${Date.now()}`,
    bookingNo: form.number.trim() || createManualNumber(kind),
    invoiceNo: form.number.trim() || createManualNumber(kind),
    invoiceDate: form.date,
    startDate: form.date,
    customer: form.customer.trim(),
    customer_name: form.customer.trim(),
    contact: form.contact.trim(),
    customer_contact: form.contact.trim(),
    customerGstin: form.customerGstin.trim(),
    billingAddress: form.billingAddress.trim(),
    pickup: form.pickup.trim(),
    drop: form.drop.trim(),
    type: form.tripType,
    vehicle: form.vehicle.trim(),
    driver: form.driver.trim(),
    driverMobile: form.driverMobile.trim(),
    driver_contact: form.driverMobile.trim(),
    km: Number(form.km) || 0,
    dueDate: form.dueDate || '',
    validUntil: form.validUntil || '',
    leadSource: form.leadSource.trim(),
    source: form.leadSource.trim(),
    notes: form.notes.trim(),
    terms: form.terms.trim(),
    status: base.status || 'pending',
    docType: isBooking ? 'invoice' : kind,
    isManual: !isBooking,
    lineItems: items,
    discount: 0,
    taxPercent: 0,
    ...charges,
    fare: charges.fare,
    totalAmount: totals.total,
    total: totals.total,
    createdAt: base.createdAt || new Date().toISOString(),
  }
}

export default function DocumentEditor({
  kind = 'invoice', source = null, booking = null, customers = [],
  records = [], payments = [], currency = 'Rs.', canCreate = true,
  busy = false, error = '', onClose, onSubmit,
}) {
  const isBooking = !source?.isManual && !!booking
  const [form, setForm] = useState(() => formFromSource({ source, kind, booking }))
  const [mobilePreview, setMobilePreview] = useState(false)
  const [biz, setBiz] = useState(DEFAULT_SETTINGS.biz)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS.invoice)
  const previewRef = useRef(null)

  useEffect(() => {
    getBizInfo().then(setBiz).catch(err => console.error('[DocumentEditor] biz settings:', err))
    getInvoiceSettings().then(setSettings).catch(err => console.error('[DocumentEditor] invoice settings:', err))
  }, [])

  const set = (key) => (event) => setForm(prev => ({ ...prev, [key]: event.target.value }))
  const setItem = (index, key, value) => setForm(prev => ({
    ...prev,
    items: prev.items.map((item, i) => i === index ? { ...item, [key]: value } : item),
  }))
  const addItem = () => setForm(prev => ({ ...prev, items: [...prev.items, emptyItem()] }))
  const removeItem = (index) => setForm(prev => ({
    ...prev, items: prev.items.length === 1 ? prev.items : prev.items.filter((_, i) => i !== index),
  }))

  const chooseCustomer = (event) => {
    const found = customers.find(c => c.id === event.target.value)
    setForm(prev => ({
      ...prev,
      customer: found?.name || prev.customer,
      contact: found?.mobile || prev.contact,
      customerGstin: found?.gst || '',
      billingAddress: found?.address || '',
    }))
  }

  const draftDoc = useMemo(() => buildDoc(form, { source, kind, booking }), [form, source, kind, booking])
  const draftInvoice = useMemo(
    () => normalizeInvoice({ source: draftDoc, records, payments }),
    [draftDoc, records, payments],
  )
  const valid = form.customer.trim().length > 0 && draftInvoice.total > 0
  const isQuote = kind === 'quotation'
  const submitLabel = isBooking ? 'Issue Invoice' : isQuote ? 'Save Draft' : 'Save Invoice'

  const submit = () => {
    if (!valid || busy || !canCreate) return
    onSubmit?.(draftInvoice, draftDoc)
  }

  const inputCls = `${fieldCls} h-11`
  const labelCls = 'text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider'

  return (
    <ModalOverlay onClose={onClose} center>
      <div className="w-[96vw] max-w-6xl max-h-[94vh] ap-surface rounded-[20px] shadow-2xl overflow-hidden animate-fade-up flex flex-col"
        role="dialog" aria-modal="true"
        aria-label={isBooking ? 'Review trip invoice' : isQuote ? 'Create quotation' : 'Create manual invoice'}>
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-[var(--ap-border)]">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-sf font-semibold text-slate-800 dark:text-white text-sm">
                {isBooking ? 'Review & issue trip invoice' : isQuote ? 'New quotation' : 'New manual invoice'}
              </p>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                isQuote ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
              }`}>
                {isQuote ? 'Estimate' : 'Invoice'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">{draftDoc.bookingNo} · Live preview updates as you type</p>
          </div>
          <IconButton icon={X} label="Close editor" onClick={onClose} />
        </div>

        {error && (
          <div className="px-4 pt-3">
            <Callout tone="red" icon={AlertTriangle} title={error} />
          </div>
        )}

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
          {/* Form */}
          <div className={`overflow-y-auto p-4 space-y-4 ${mobilePreview ? 'hidden lg:block' : ''}`}>
            <div className="rounded-[16px] border border-[var(--ap-border)] p-3.5 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Document</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label={isQuote ? 'Quote No.' : 'Invoice No.'} required>
                  <input value={form.number} onChange={set('number')} className={inputCls} disabled={isBooking} />
                </Field>
                <Field label={isQuote ? 'Quote Date' : 'Invoice Date'} required>
                  <input type="date" value={form.date} onChange={set('date')} className={inputCls} />
                </Field>
                {!isQuote && (
                  <Field label="Due date (optional)">
                    <input type="date" value={form.dueDate} onChange={set('dueDate')} className={inputCls} />
                  </Field>
                )}
                {isQuote && (
                  <Field label="Valid until">
                    <input type="date" value={form.validUntil} onChange={set('validUntil')} className={inputCls} />
                  </Field>
                )}
              </div>
            </div>

            <div className="rounded-[16px] border border-[var(--ap-border)] p-3.5 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Customer</p>
              {isBooking ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Name">
                    <input value={form.customer} readOnly className={`${inputCls} opacity-70`} />
                  </Field>
                  <Field label="Contact">
                    <input value={form.contact} readOnly className={`${inputCls} opacity-70`} />
                  </Field>
                </div>
              ) : (
                <>
                  <Field label="Existing customer (optional)" hint="Prefills name and contact; the bill stays a plain-text document.">
                    <FieldSelect value="" onChange={chooseCustomer}>
                      <option value="">Enter a new customer</option>
                      {customers.map(customer => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}{customer.mobile ? ` · ${customer.mobile}` : ''}
                        </option>
                      ))}
                    </FieldSelect>
                  </Field>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Customer name" required>
                      <input value={form.customer} onChange={set('customer')} placeholder="Full name" className={inputCls} />
                    </Field>
                    <Field label="Contact">
                      <input value={form.contact} onChange={set('contact')} inputMode="tel" placeholder="Mobile" className={inputCls} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="GSTIN (optional)">
                      <input value={form.customerGstin} onChange={set('customerGstin')} className={inputCls} />
                    </Field>
                    <Field label="Billing address (optional)">
                      <input value={form.billingAddress} onChange={set('billingAddress')} className={inputCls} />
                    </Field>
                  </div>
                </>
              )}
            </div>

            <div className="rounded-[16px] border border-[var(--ap-border)] p-3.5 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Trip details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Pickup">
                  <input value={form.pickup} onChange={set('pickup')} className={inputCls} disabled={isBooking} />
                </Field>
                <Field label="Drop">
                  <input value={form.drop} onChange={set('drop')} className={inputCls} disabled={isBooking} />
                </Field>
                <Field label="Trip type">
                  <FieldSelect value={form.tripType} onChange={set('tripType')} disabled={isBooking}>
                    {TRIP_TYPES.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
                  </FieldSelect>
                </Field>
                <Field label="Vehicle">
                  <input value={form.vehicle} onChange={set('vehicle')} className={inputCls} disabled={isBooking} />
                </Field>
                <Field label="KM">
                  <input value={form.km} onChange={set('km')} inputMode="decimal" className={inputCls} disabled={isBooking} />
                </Field>
                <Field label="Driver">
                  <input value={form.driver} onChange={set('driver')} className={inputCls} disabled={isBooking} />
                </Field>
              </div>
            </div>

            <div className="rounded-[16px] border border-[var(--ap-border)] p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Fare components</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {isBooking ? 'Taken from the trip — no tax or discount rules exist in this app.' : 'Only supported charge components are available.'}
                  </p>
                </div>
                {!isBooking && (
                  <Button variant="ghost" size="sm" icon={Plus} onClick={addItem}>Add</Button>
                )}
              </div>
              <datalist id="sjt-charge-components">
                {CHARGE_SUGGESTIONS.map(value => <option key={value} value={value} />)}
              </datalist>
              <div className="space-y-2">
                {form.items.map((item, index) => (
                  <div key={index} className="rounded-xl border border-[var(--ap-border)] p-2.5 grid grid-cols-[1fr_64px_100px_auto] items-end gap-2">
                    <label className="block min-w-0">
                      <span className={labelCls}>Item</span>
                      <input list="sjt-charge-components" value={item.description}
                        onChange={e => setItem(index, 'description', e.target.value)}
                        className={`${inputCls} px-2.5`} disabled={isBooking} />
                    </label>
                    <label className="block">
                      <span className={labelCls}>Qty</span>
                      <input type="number" min="1" step="1" value={item.quantity}
                        onChange={e => setItem(index, 'quantity', e.target.value)}
                        className={`${inputCls} px-2`} disabled={isBooking} />
                    </label>
                    <label className="block">
                      <span className={labelCls}>Rate</span>
                      <input type="number" min="0" step="0.01" value={item.unitPrice}
                        onChange={e => setItem(index, 'unitPrice', e.target.value)}
                        className={`${inputCls} px-2`} disabled={isBooking} />
                    </label>
                    {isBooking ? <span className="w-9" /> : (
                      <IconButton icon={Trash2} tone="danger" label="Remove line item"
                        onClick={() => removeItem(index)} disabled={form.items.length === 1} />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between rounded-xl bg-[var(--ap-surface-2)] px-3 py-2.5">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Live total</span>
                <span className="font-sf text-base font-bold text-slate-800 dark:text-white tabular-nums">
                  {formatINR(draftInvoice.total, currency)}
                </span>
              </div>
            </div>

            <div className="rounded-[16px] border border-[var(--ap-border)] p-3.5 space-y-3">
              <Field label="Notes">
                <textarea value={form.notes} onChange={set('notes')} rows={2}
                  className={`${fieldCls} h-auto min-h-[64px] py-2.5 resize-y`}
                  placeholder="Anything that should appear on the document…" />
              </Field>
              <Field label={isQuote ? 'Terms & conditions' : 'Payment terms'}>
                <textarea value={form.terms} onChange={set('terms')} rows={2}
                  className={`${fieldCls} h-auto min-h-[64px] py-2.5 resize-y`}
                  placeholder="Optional terms for this document…" />
              </Field>
            </div>

            {!valid && (
              <p className="text-[11px] text-slate-400">Add a customer and a positive fare to preview and save.</p>
            )}
          </div>

          {/* Live preview */}
          <div className={`min-h-0 overflow-y-auto bg-slate-100 dark:bg-black/20 ${mobilePreview ? 'block' : 'hidden lg:block'}`}>
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-3 py-2 bg-[var(--ap-surface-2)] border-b border-[var(--ap-border)]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Live preview</p>
              <Button variant="ghost" size="sm" icon={Printer}
                onClick={() => printDocument(previewRef.current, `${isQuote ? 'Quotation' : 'Invoice'} — ${draftDoc.bookingNo}`)}>
                Print preview
              </Button>
            </div>
            <div className="p-3 sm:p-4">
              <div className="mx-auto max-w-[210mm] rounded-2xl overflow-hidden shadow-xl">
                <InvoiceDocument ref={previewRef} invoice={draftInvoice} biz={biz} settings={settings} />
              </div>
            </div>
          </div>
        </div>

        {/* Fixed bottom actions */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-[var(--ap-border)] bg-[var(--ap-surface)] flex-shrink-0">
          <div className="lg:hidden">
            <Button variant="secondary" size="sm" icon={mobilePreview ? ArrowLeft : Eye}
              onClick={() => setMobilePreview(prev => !prev)}>
              {mobilePreview ? 'Edit' : 'Preview'}
            </Button>
          </div>
          <div className="hidden lg:block text-[10px] text-slate-400">
            Customer-facing preview · no database IDs printed
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" icon={Printer} className="hidden sm:inline-flex"
              disabled={!valid}
              onClick={() => printDocument(previewRef.current, `${isQuote ? 'Quotation' : 'Invoice'} — ${draftDoc.bookingNo}`)}>
              Print
            </Button>
            <Button size="sm" disabled={!valid || busy || !canCreate} onClick={submit}>
              {busy ? 'Saving…' : submitLabel}
            </Button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  )
}

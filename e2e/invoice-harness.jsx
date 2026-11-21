// Offline harness for the invoice redesign. The fixtures below exist only in
// this test file; production always reads Supabase. Real invoice components
// are rendered with inert callbacks so Playwright can exercise layout, state
// and payloads without auth or a database.
import { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/index.css'

import InvoiceChooser from '../src/components/invoice/InvoiceChooser'
import BookingPicker from '../src/components/invoice/BookingPicker'
import DocumentEditor from '../src/components/invoice/DocumentEditor'
import InvoiceModal from '../src/components/invoice/InvoiceModal'
import PaymentPanel from '../src/components/invoice/PaymentPanel'
import { normalizeInvoice } from '../src/data/invoiceModel'

const params = new URLSearchParams(window.location.search)
const VIEWS = ['chooser', 'bookings', 'editor', 'booking-editor', 'modal', 'payment']
const requestedView = params.get('view')
const initialView = VIEWS.includes(requestedView) ? requestedView : 'chooser'
const kindFromUrl = params.get('kind') === 'quotation' ? 'quotation' : 'invoice'
const docFromUrl = ['manual', 'quote', 'trip', 'unissued'].includes(params.get('doc'))
  ? params.get('doc')
  : 'trip'
const canCreate = params.get('canCreate') !== '0'
const darkFromUrl = params.get('theme') === 'dark'

document.documentElement.classList.toggle('dark', darkFromUrl)
document.documentElement.style.colorScheme = darkFromUrl ? 'dark' : 'light'

// Fixed, explicit dates keep every assertion deterministic.
const DATE = '2026-11-21'
const TRIP_UUID = '5f2c1a90-1d2e-4f3a-9b11-0c22d4e6a701'
const TRIP_RECORD_ID = 'rec-trip-001'
const MANUAL_RECORD_ID = 'rec-manual-001'

const bookings = [
  {
    id: TRIP_UUID,
    bookingNo: 'BK-2026-011',
    reference: 'REF-7781',
    customer: 'Anand Travels',
    contact: '9876543210',
    status: 'completed',
    startDate: DATE,
    startTime: '09:30',
    pickup: 'No 14 Subburaya Pillai Street Ariyakuppam Puducherry',
    drop: 'Tiruppur',
    driver: 'Ravi Kumar',
    driverMobile: '9000000001',
    vehicle: 'TN 37 AB 1234',
    type: 'one_way',
    km: 420,
    startKm: 12400,
    endKm: 12820,
    fare: 4200,
    toll: 180,
    bata: 300,
    parking: 120,
  },
  {
    id: 'bk-done-2',
    bookingNo: 'BK-2026-012',
    reference: 'REF-7782',
    customer: 'Meera Nair',
    contact: '9876543211',
    status: 'closed',
    startDate: '2026-11-20',
    pickup: 'Coimbatore',
    drop: 'Airport',
    driver: 'Suresh',
    vehicle: 'TN 37 CD 5678',
    type: 'local_visit',
    km: 60,
    fare: 2500,
    toll: 0,
    bata: 150,
    parking: 50,
  },
  {
    id: 'bk-cancelled',
    bookingNo: 'BK-2026-013',
    reference: 'REF-7783',
    customer: 'Blue Lines Ltd',
    status: 'cancelled',
    startDate: '2026-11-19',
    pickup: 'Erode',
    drop: 'Salem',
    driver: 'Ravi Kumar',
    vehicle: 'TN 37 AB 1234',
    fare: 1500,
  },
  {
    id: 'bk-invoiced',
    bookingNo: 'BK-2026-014',
    reference: 'REF-7784',
    customer: 'Kavya',
    status: 'completed',
    startDate: '2026-11-18',
    pickup: 'Puducherry',
    drop: 'Chennai',
    driver: 'Suresh',
    vehicle: 'TN 37 CD 5678',
    fare: 1800,
    toll: 100,
  },
  {
    id: 'bk-ongoing',
    bookingNo: 'BK-2026-015',
    reference: 'REF-7785',
    customer: 'Raj Tours',
    status: 'confirmed',
    startDate: '2026-11-22',
    pickup: 'Salem',
    drop: 'Chennai',
    driver: 'Suresh',
    vehicle: 'TN 37 EF 9012',
    fare: 3000,
  },
]

const tripDoc = { ...bookings[0], invoiceNo: 'INV-2026-021', invoiceDate: DATE }
const unissuedDoc = {
  ...bookings[0],
  id: 'bk-unissued',
  bookingNo: 'BK-2026-099',
  invoiceNo: 'INV-2026-099',
  invoiceDate: DATE,
}

const manualDoc = {
  id: 'manual-doc-001',
  isManual: true,
  invoiceNo: 'MB-261121-0001',
  invoiceDate: DATE,
  customer: 'Blue Lines Ltd',
  contact: '9876543220',
  pickup: 'Puducherry',
  drop: 'Bengaluru',
  type: 'one_way',
  vehicle: 'TN 37 AB 1234',
  driver: 'Ravi Kumar',
  km: 300,
  lineItems: [
    { description: 'Trip Fare', quantity: 1, unitPrice: 6000, total: 6000 },
    { description: 'Toll Charges', quantity: 1, unitPrice: 1500, total: 1500 },
  ],
  fare: 6000,
  toll: 1500,
  totalAmount: 7500,
  total: 7500,
  status: 'issued',
  notes: 'Corporate billing',
  terms: 'Payment within 15 days.',
}

const quoteDoc = {
  id: 'quote-doc-001',
  isManual: true,
  docType: 'quotation',
  invoiceNo: 'QT-261121-0001',
  invoiceDate: DATE,
  validUntil: '2026-12-21',
  customer: 'Raj Tours',
  contact: '9876543221',
  pickup: 'Salem',
  drop: 'Chennai',
  lineItems: [{ description: 'Trip Fare', quantity: 1, unitPrice: 9500, total: 9500 }],
  totalAmount: 9500,
  total: 9500,
  terms: 'Quote valid for 30 days.',
}

// Editor sources stay empty so tests drive every field explicitly.
const manualEditorSource = {
  isManual: true,
  id: 'manual-editor-seed',
  invoiceNo: 'MB-261121-0001',
  invoiceDate: DATE,
  customer: '',
  contact: '',
  lineItems: [{ description: 'Trip Fare', quantity: 1, unitPrice: '' }],
}
const quoteEditorSource = {
  ...manualEditorSource,
  id: 'quote-editor-seed',
  docType: 'quotation',
  invoiceNo: 'QT-261121-0001',
  validUntil: '',
  terms: '',
}

const records = [
  {
    id: TRIP_RECORD_ID,
    source_type: 'booking',
    source_id: TRIP_UUID,
    invoice_number: 'INV-2026-021',
    total_amount: 4800,
    status: 'issued',
    due_date: '2026-12-05',
  },
  {
    id: 'rec-invoiced-001',
    source_type: 'booking',
    source_id: 'bk-invoiced',
    invoice_number: 'BK-2026-014',
    total_amount: 1900,
    status: 'issued',
  },
  {
    id: MANUAL_RECORD_ID,
    source_type: 'manual',
    source_id: manualDoc.id,
    invoice_number: manualDoc.invoiceNo,
    total_amount: 7500,
    status: 'issued',
  },
]

const basePayments = [
  {
    id: 'pay-001',
    invoice_id: TRIP_RECORD_ID,
    invoice_number: 'INV-2026-021',
    amount: 1800,
    method: 'UPI',
    reference: 'UPIREF-4455',
    payment_date: DATE,
    status: 'completed',
  },
  {
    id: 'pay-002',
    invoice_id: TRIP_RECORD_ID,
    amount: 1200,
    method: 'Cash',
    reference: '',
    payment_date: '2026-11-20',
    status: 'completed',
  },
  {
    id: 'pay-003',
    invoice_id: TRIP_RECORD_ID,
    amount: 5000,
    method: 'Bank Transfer',
    reference: 'REVERSED-REF',
    payment_date: '2026-11-19',
    status: 'reversed',
  },
  {
    id: 'pay-004',
    invoice_id: MANUAL_RECORD_ID,
    amount: 2500,
    method: 'Cheque',
    reference: 'CHQ-8899',
    payment_date: '2026-11-18',
    status: 'completed',
  },
]

// The trip record belongs to the detail-view fixture only. Leaving it in the
// picker would make its booking look already billed and remove it from the
// eligible rows.
const pickerRecords = records.filter(record => record.id !== TRIP_RECORD_ID)

const customers = [
  {
    id: 'cust-1',
    name: 'Anand Travels',
    mobile: '9876543210',
    gst: '33AABCA1234A1Z5',
    address: '12 Main Road, Chennai',
  },
  { id: 'cust-2', name: 'Meera Nair', mobile: '9876543211' },
]

const biz = {
  name: 'Sri Jayam Travels',
  address: 'Puducherry – 605007',
  phone: '+91 94423 37470',
  email: 'srijayamtravels1255@gmail.com',
}
const settings = {
  currency: 'Rs.',
  footerText: 'Thank you for choosing Sri Jayam Travels!',
  termsText: 'Payment due upon service completion.',
}

const ARRAY_KEYS = ['closes', 'choices', 'selects', 'opens', 'submits', 'issues', 'payments', 'deletes']

const harness = {
  closes: [],
  choices: [],
  selects: [],
  opens: [],
  submits: [],
  issues: [],
  payments: [],
  deletes: [],
  bookingId: TRIP_UUID,
  tripRecordId: TRIP_RECORD_ID,
  fixtures: { bookings, records, payments: basePayments, manualDoc, quoteDoc, customers },
}
window.__invoiceHarness = harness

const clone = value => JSON.parse(JSON.stringify(value))

function Harness() {
  const [view, setView] = useState(initialView)
  const [editorKind, setEditorKind] = useState(kindFromUrl)
  const [editorSource, setEditorSource] = useState(
    initialView === 'editor' ? (kindFromUrl === 'quotation' ? quoteEditorSource : manualEditorSource) : null,
  )
  const [booking, setBooking] = useState(initialView === 'booking-editor' ? bookings[0] : null)
  const [selected, setSelected] = useState(null)
  const [dark, setDark] = useState(darkFromUrl)
  const [paymentRows, setPaymentRows] = useState(basePayments)
  const [paymentVersion, setPaymentVersion] = useState(0)

  const paymentSource = docFromUrl === 'unissued' ? unissuedDoc : tripDoc
  const paymentInvoice = useMemo(
    () => normalizeInvoice({ source: paymentSource, records, payments: paymentRows }),
    [paymentSource, paymentRows, paymentVersion],
  )
  const modalSource = docFromUrl === 'manual' ? manualDoc
    : docFromUrl === 'quote' ? quoteDoc
      : docFromUrl === 'unissued' ? unissuedDoc
        : tripDoc
  const modalInvoice = selected?.invoice
    || normalizeInvoice({ source: modalSource, records, payments: paymentRows })

  const reset = () => {
    ARRAY_KEYS.forEach(key => { harness[key].length = 0 })
    setView(initialView)
    setEditorKind(kindFromUrl)
    setEditorSource(initialView === 'editor'
      ? (kindFromUrl === 'quotation' ? quoteEditorSource : manualEditorSource)
      : null)
    setBooking(initialView === 'booking-editor' ? bookings[0] : null)
    setSelected(null)
    setPaymentRows(basePayments)
    setPaymentVersion(0)
  }

  // Helpers let a single test drive the same component through several paths
  // without reloading (and without clearing the recorded callback log).
  harness.reset = reset
  harness.show = next => setView(next)
  harness.invoice = view === 'payment' ? paymentInvoice : view === 'modal' ? modalInvoice : null

  const close = label => {
    harness.closes.push(label)
    setView(null)
  }

  const choose = key => {
    harness.choices.push(key)
    if (key === 'booking') {
      setBooking(null)
      setView('bookings')
      return
    }
    const nextKind = key === 'quotation' ? 'quotation' : 'invoice'
    setEditorKind(nextKind)
    setEditorSource(nextKind === 'quotation' ? quoteEditorSource : manualEditorSource)
    setSelected(null)
    setView('editor')
  }

  const selectBooking = value => {
    harness.selects.push(clone(value))
    setBooking(value)
    setSelected(null)
    setView('booking-editor')
  }

  const openInvoice = invoice => {
    harness.opens.push(clone(invoice))
    setSelected({ invoice })
    setView('modal')
  }

  const submit = (invoice, doc) => {
    harness.submits.push(clone({ invoice, doc }))
    setSelected({ invoice, doc })
    setView('modal')
  }

  const toggleTheme = () => setDark(previous => {
    const next = !previous
    document.documentElement.classList.toggle('dark', next)
    document.documentElement.style.colorScheme = next ? 'dark' : 'light'
    return next
  })

  // Payments are logged inertly first. Applying them simulates the server
  // round-trip and is the only thing that resets PaymentPanel's submit guard.
  const applyPayments = () => {
    setPaymentRows([
      ...basePayments,
      ...harness.payments.map((payment, index) => ({
        id: `applied-${index}`,
        invoice_id: TRIP_RECORD_ID,
        amount: payment.amount,
        method: payment.method,
        reference: payment.reference,
        payment_date: payment.paymentDate,
        status: 'completed',
      })),
    ])
    setPaymentVersion(version => version + 1)
  }

  // Tailwind's content globs exclude e2e/, so harness-only utility classes
  // would not be generated. Inline styles keep these controls above the
  // portal layers regardless of the app's CSS build.
  const barStyle = { position: 'fixed', left: 8, top: 8, zIndex: 200, display: 'flex', alignItems: 'center', gap: 8 }
  const controlStyle = {
    borderRadius: 8,
    border: '1px solid var(--ap-border)',
    background: 'var(--ap-surface)',
    color: 'var(--ap-text-1)',
    padding: '4px 8px',
    fontSize: 10,
    fontWeight: 700,
    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
    cursor: 'pointer',
  }

  return (
    <>
      <div id="harness-root" className="min-h-screen bg-[var(--ap-bg)] p-4 text-slate-800 dark:text-slate-100">
        {/* Fixed above the portal layers so theme and status stay reachable. */}
        <div style={barStyle}>
          <span id="harness-status" style={controlStyle}>Harness ready</span>
          <button id="theme-toggle" type="button" style={controlStyle} onClick={toggleTheme}>
            Toggle theme
          </button>
        </div>

        <div className="mx-auto max-w-3xl space-y-3 pt-10">
          <h1 className="font-sf text-lg font-bold">Invoice redesign harness</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Offline fixtures rendered through the real invoice components.
          </p>
          <div className="flex flex-wrap gap-2">
            <button id="open-chooser" type="button" style={controlStyle} onClick={() => setView('chooser')}>Open chooser</button>
            <button id="open-bookings" type="button" style={controlStyle} onClick={() => setView('bookings')}>Open bookings</button>
            <button id="open-editor" type="button" style={controlStyle} onClick={() => { setEditorSource(editorKind === 'quotation' ? quoteEditorSource : manualEditorSource); setView('editor') }}>Open editor</button>
            <button id="open-modal" type="button" style={controlStyle} onClick={() => { setSelected(null); setView('modal') }}>Open modal</button>
            <button id="open-payment" type="button" style={controlStyle} onClick={() => setView('payment')}>Open payment</button>
          </div>

          {view === 'payment' && (
            <section className="mx-auto max-w-md rounded-2xl border border-[var(--ap-border)] bg-[var(--ap-surface)] p-4">
              <h2 className="text-sm font-bold">Payment panel</h2>
              <button id="apply-payments" type="button" style={{ ...controlStyle, margin: '8px 0 12px' }} onClick={applyPayments}>
                Apply recorded payments
              </button>
              <PaymentPanel
                invoice={paymentInvoice}
                currency="Rs."
                onRecord={payment => harness.payments.push(clone(payment))}
                paymentVersion={paymentVersion}
              />
            </section>
          )}
        </div>
      </div>

      {view === 'chooser' && (
        <InvoiceChooser onClose={() => close('chooser')} onChoose={choose} />
      )}

      {view === 'bookings' && (
        <BookingPicker
          bookings={bookings}
          records={pickerRecords}
          payments={paymentRows}
          currency="Rs."
          onClose={() => close('bookings')}
          onSelect={selectBooking}
          onOpenInvoice={openInvoice}
        />
      )}

      {view === 'editor' && (
        <DocumentEditor
          kind={editorKind}
          source={editorSource}
          customers={customers}
          records={records}
          payments={paymentRows}
          currency="Rs."
          canCreate={canCreate}
          onClose={() => close('editor')}
          onSubmit={submit}
        />
      )}

      {view === 'booking-editor' && booking && (
        <DocumentEditor
          kind="invoice"
          booking={booking}
          customers={customers}
          records={records}
          payments={paymentRows}
          currency="Rs."
          canCreate={canCreate}
          onClose={() => close('booking-editor')}
          onSubmit={submit}
        />
      )}

      {view === 'modal' && (
        <InvoiceModal
          invoice={modalInvoice}
          booking={null}
          records={records}
          payments={paymentRows}
          biz={biz}
          settings={settings}
          canCreate={canCreate}
          canManage={canCreate}
          canDelete={canCreate}
          onClose={() => close('modal')}
          onIssue={invoice => harness.issues.push(clone(invoice))}
          onRecordPayment={payment => harness.payments.push(clone(payment))}
          onDelete={invoice => { harness.deletes.push(clone(invoice)); setView(null) }}
        />
      )}
    </>
  )
}

createRoot(document.getElementById('root')).render(<Harness />)

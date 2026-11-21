import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertTriangle, Check, Columns3, Eye, FileText, IndianRupee,
  Plus, Printer, Search, Wallet,
} from 'lucide-react'
import Avatar        from '../components/ui/Avatar'
import Button        from '../components/ui/Button'
import PageHeader    from '../components/ui/PageHeader'
import MetricCard    from '../components/ui/MetricCard'
import IconButton    from '../components/ui/IconButton'
import StatusPill    from '../components/ui/StatusPill'
import Callout       from '../components/ui/Callout'
import EmptyState    from '../components/ui/EmptyState'
import SegmentedControl from '../components/ui/SegmentedControl'
import { fieldCls } from '../components/ui/Field'
import InvoiceChooser  from '../components/invoice/InvoiceChooser'
import BookingPicker   from '../components/invoice/BookingPicker'
import DocumentEditor  from '../components/invoice/DocumentEditor'
import InvoiceModal    from '../components/invoice/InvoiceModal'
import { useAuth }   from '../context/AuthContext'
import { loadBookings } from '../data/tripTypes'
import {
  loadManualInvoices, saveManualInvoice, deleteManualInvoice,
} from '../data/manualInvoiceData'
import {
  loadInvoiceRecords, loadInvoicePayments, createInvoiceRecord, recordInvoicePayment,
} from '../data/invoiceRecordData'
import { loadCustomers } from '../data/customerData'
import { getInvoiceSettings, DEFAULT_SETTINGS } from '../data/settingsData'
import {
  INVOICE_TABS, formatINR, invoiceEligibility, invoiceSummary,
  matchesSearch, matchesTab, normalizeInvoice, shortDate, shortLocation,
} from '../data/invoiceModel'
import { pageSizeFor } from '../utils/zoomPageSize'

const COLS_KEY = 'sjt-invoice-cols-v2'
const LEGACY_COLS_KEY = 'sjt-invoice-cols'
const ALL_COLUMNS = [
  { key: 'invoiceNo', label: 'Invoice No', on: true },
  { key: 'date',      label: 'Date',       on: true },
  { key: 'route',     label: 'Route',      on: false },
  { key: 'driver',    label: 'Driver',     on: false },
  { key: 'vehicle',   label: 'Vehicle',    on: false },
  { key: 'km',        label: 'KM',         on: false },
  { key: 'total',     label: 'Total',      on: true },
  { key: 'balance',   label: 'Balance',    on: true },
  { key: 'status',    label: 'Status',     on: true },
]
const DEFAULT_COLS = ALL_COLUMNS.filter(c => c.on).map(c => c.key)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const PAYMENT_TONE = {
  paid: 'green', partial: 'amber', pending: 'gray', overdue: 'red', draft: 'gray',
}

function loadCols() {
  try {
    const known = new Set(ALL_COLUMNS.map(c => c.key))
    const read = (raw, migrate = false) => {
      const arr = JSON.parse(raw)
      const renamed = migrate ? { bookingNo: 'invoiceNo', fare: 'total' } : {}
      const clean = (Array.isArray(arr) ? arr : [])
        .map(k => renamed[k] || k)
        .filter(k => known.has(k))
      return [...new Set(clean)]
    }
    const raw = localStorage.getItem(COLS_KEY)
    if (raw) {
      const saved = read(raw)
      return saved.length > 0 ? saved : DEFAULT_COLS
    }
    // Carry the old column choice forward instead of silently resetting it.
    const legacy = localStorage.getItem(LEGACY_COLS_KEY)
    if (legacy) {
      const migrated = read(legacy, true)
      if (migrated.length > 0) {
        localStorage.setItem(COLS_KEY, JSON.stringify(migrated))
        return migrated
      }
    }
    return DEFAULT_COLS
  } catch { return DEFAULT_COLS }
}

const asArray = (value) => Array.isArray(value) ? value : []

function settle(result, fallback = []) {
  return result?.status === 'fulfilled' ? (asArray(result.value)) : fallback
}

export default function Invoices() {
  const { can, isAdmin } = useAuth()
  const canCreate = can('invoices')
  // Deletion is deliberately admin-only even when a manager was granted
  // generate_invoice; creation and settlement do not imply destructive access.
  const canDelete = isAdmin
  const [params, setParams] = useSearchParams()

  const view = params.get('view') || ''
  const docKey = params.get('doc') || ''
  const editKey = params.get('edit') || ''
  const bookingParam = params.get('booking') || ''
  const editorKind = params.get('kind') === 'quotation' ? 'quotation' : 'invoice'
  const autoPrint = params.get('print') === '1'

  const [bookings, setBookings] = useState([])
  const [manualDocs, setManualDocs] = useState([])
  const [records, setRecords] = useState([])
  const [payments, setPayments] = useState([])
  const [customers, setCustomers] = useState([])
  const [settings, setSettings] = useState(DEFAULT_SETTINGS.invoice)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [manualError, setManualError] = useState('')
  const [billingError, setBillingError] = useState('')
  const [actionError, setActionError] = useState('')
  const [paymentError, setPaymentError] = useState('')
  const [busy, setBusy] = useState(false)
  const [paymentBusy, setPaymentBusy] = useState(false)
  const [paymentVersion, setPaymentVersion] = useState(0)
  const [creatingKey, setCreatingKey] = useState('')
  // React state lags a render; refs block a second click in the same tick.
  const busyRef = useRef(false)
  const paymentBusyRef = useRef(false)

  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [visibleCols, setVisibleCols] = useState(loadCols)
  const [colsOpen, setColsOpen] = useState(false)
  const colsRef = useRef(null)
  const currency = settings.currency || 'Rs.'

  // ── URL-backed overlays: deep-linkable, Back closes the top dialog ──
  const patch = useCallback((mutate) => {
    const next = new URLSearchParams(params)
    mutate(next)
    setParams(next)
  }, [params, setParams])

  // Closing a dialog replaces the current history entry so Back returns to
  // the page before the dialog rather than reopening it.
  const replaceParams = useCallback((mutate) => {
    const next = new URLSearchParams(params)
    mutate(next)
    setParams(next, { replace: true })
  }, [params, setParams])

  const clearOverlay = useCallback(() => {
    replaceParams(next => {
      ['view', 'doc', 'edit', 'booking', 'kind', 'print'].forEach(key => next.delete(key))
    })
    setActionError('')
    setPaymentError('')
  }, [replaceParams])

  const openChooser = () => patch(next => {
    ['doc', 'edit', 'booking', 'kind', 'print'].forEach(key => next.delete(key))
    next.set('view', 'create')
  })
  const openBookings = () => patch(next => {
    ['doc', 'edit', 'booking', 'kind', 'print'].forEach(key => next.delete(key))
    next.set('view', 'bookings')
  })
  const openEditor = (kind, sourceId = '') => patch(next => {
    ['doc', 'booking', 'print'].forEach(key => next.delete(key))
    next.set('view', 'editor')
    next.set('kind', kind)
    if (sourceId) next.set('edit', sourceId)
    else next.delete('edit')
  })
  const openBookingEditor = (booking) => patch(next => {
    ['doc', 'edit', 'kind', 'print'].forEach(key => next.delete(key))
    next.set('view', 'booking-editor')
    next.set('booking', booking.id || booking.bookingNo || '')
  })
  const openDoc = (invoice, print = false, { clearErrors = true } = {}) => {
    patch(next => {
      ['view', 'edit', 'booking', 'kind'].forEach(key => next.delete(key))
      next.set('doc', invoice.key)
      if (print) next.set('print', '1')
      else next.delete('print')
    })
    // A failed document save still opens the saved doc; keep its warning
    // visible when the caller asks us to preserve the error.
    if (clearErrors) {
      setActionError('')
      setPaymentError('')
    }
  }
  const closeDoc = () => replaceParams(next => {
    next.delete('doc')
    next.delete('print')
  })

  // ── Data loading ──────────────────────────────────────────────
  const reloadAll = useCallback(async () => {
    setLoading(true)
    const [b, m, r, p, c, s] = await Promise.allSettled([
      loadBookings(), loadManualInvoices(), loadInvoiceRecords(),
      loadInvoicePayments(), loadCustomers(), getInvoiceSettings(),
    ])
    setBookings(settle(b))
    setManualDocs(settle(m))
    setRecords(settle(r))
    setPayments(settle(p))
    setCustomers(settle(c))
    if (s.status === 'fulfilled') setSettings(s.value || DEFAULT_SETTINGS.invoice)
    const billingIssues = [r, p]
      .filter(result => result.status === 'rejected')
      .map(result => result.reason?.message || 'Could not load invoice tracking.')
    setBillingError(billingIssues.length ? [...new Set(billingIssues)].join(' ') : '')
    setLoadError(b.status === 'rejected' ? (b.reason?.message || 'Could not load bookings.') : '')
    setManualError(m.status === 'rejected' ? (m.reason?.message || 'Could not load manual bills.') : '')
    setLoading(false)
  }, [])

  useEffect(() => { reloadAll() }, [reloadAll])

  const refreshBilling = useCallback(async () => {
    const [r, p] = await Promise.allSettled([loadInvoiceRecords(), loadInvoicePayments()])
    if (r.status === 'fulfilled') setRecords(asArray(r.value))
    if (p.status === 'fulfilled') setPayments(asArray(p.value))
    const issues = [r, p]
      .filter(result => result.status === 'rejected')
      .map(result => result.reason?.message || 'Could not load invoice tracking.')
    setBillingError(issues.length ? [...new Set(issues)].join(' ') : '')
  }, [])

  useEffect(() => {
    if (!colsOpen) return
    const fn = e => { if (colsRef.current && !colsRef.current.contains(e.target)) setColsOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [colsOpen])

  const toggleCol = (key) => setVisibleCols(prev => {
    const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    const safe = next.length === 0 ? prev : next
    try { localStorage.setItem(COLS_KEY, JSON.stringify(safe)) } catch { /* storage disabled */ }
    return safe
  })

  // ── Derived model ─────────────────────────────────────────────
  const invoices = useMemo(() => {
    const fromBookings = bookings
      .filter(b => ['completed', 'closed'].includes(String(b.status || '').toLowerCase()))
      .map(b => normalizeInvoice({ source: b, records, payments }))
    const fromManual = manualDocs.map(doc => normalizeInvoice({ source: doc, records, payments }))
    return [...fromManual, ...fromBookings].sort((a, b) =>
      String(b.invoiceDate || b.tripDate || '').localeCompare(String(a.invoiceDate || a.tripDate || '')))
  }, [bookings, manualDocs, records, payments])

  // KPIs are financial facts: only documents that were actually issued (and
  // therefore have a persisted invoice record) count. Completed trips that
  // have not been issued yet stay visible in the list but are not "invoiced".
  const billableInvoices = useMemo(
    () => invoices.filter(inv => !inv.isQuote && inv.record),
    [invoices],
  )
  const summary = useMemo(() => invoiceSummary(billableInvoices), [billableInvoices])
  const thisMonthKey = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })()
  const thisMonthFare = billableInvoices
    .filter(inv => String(inv.invoiceDate || '').startsWith(thisMonthKey))
    .reduce((sum, inv) => sum + inv.total, 0)
  const avgBill = billableInvoices.length
    ? Math.round(summary.total / billableInvoices.length) : 0

  const filtered = useMemo(() => invoices
    .filter(inv => matchesTab(inv, tab) && matchesSearch(inv, search)),
  [invoices, tab, search])

  const selectedInvoice = useMemo(
    () => invoices.find(inv => inv.key === docKey) || null,
    [invoices, docKey],
  )
  const editingDoc = useMemo(
    () => manualDocs.find(doc => String(doc.id) === editKey) || null,
    [manualDocs, editKey],
  )
  // Issued records are the financial source of truth. Editing the underlying
  // manual document would leave the printed total and payments stale, so the
  // editor is locked for issued documents.
  const editingDocLocked = useMemo(() => {
    if (!editingDoc) return false
    const sourceType = editingDoc.docType === 'quotation' ? 'quotation' : 'manual'
    return invoices.some(inv => inv.sourceType === sourceType
      && String(inv.sourceId) === String(editingDoc.id) && !!inv.record)
  }, [editingDoc, invoices])
  const editingBooking = useMemo(
    () => bookings.find(b => String(b.id) === bookingParam) || null,
    [bookings, bookingParam],
  )

  // ── Pagination ────────────────────────────────────────────────
  const [pageSize, setPageSize] = useState(() => pageSizeFor(6, 5))
  const [page, setPage] = useState(1)
  const [goPage, setGoPage] = useState('')
  useEffect(() => {
    const onResize = () => setPageSize(prev => {
      const next = pageSizeFor(6, 5)
      if (next !== prev) setPage(1)
      return next
    })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
  useEffect(() => {
    setPage(p => Math.min(Math.max(1, p), Math.max(1, Math.ceil(filtered.length / pageSize))))
  }, [filtered.length, pageSize])

  const pageItems = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const set = new Set([1, 2, safePage - 1, safePage, safePage + 1, totalPages - 1, totalPages])
    const nums = [...set].filter(n => n >= 1 && n <= totalPages).sort((a, b) => a - b)
    const out = []
    nums.forEach((n, i) => {
      if (i > 0 && n - nums[i - 1] > 1) out.push('…')
      out.push(n)
    })
    return out
  })()
  const goToPage = () => {
    const n = parseInt(goPage, 10)
    if (!Number.isNaN(n)) setPage(Math.min(Math.max(1, n), totalPages))
    setGoPage('')
  }

  // ── Mutations ─────────────────────────────────────────────────
  const recordArgs = (invoice) => ({
    invoiceNumber: invoice.invoiceNo,
    sourceType: invoice.sourceType,
    sourceId: invoice.sourceId,
    bookingId: invoice.sourceType === 'booking' && UUID_RE.test(invoice.sourceId) ? invoice.sourceId : null,
    customerName: invoice.customer,
    customerContact: invoice.contact,
    totalAmount: invoice.total,
    invoiceDate: invoice.invoiceDate || new Date().toISOString().slice(0, 10),
    dueDate: invoice.dueDate || null,
    status: 'pending',
    // Stable per source: concurrent double-submits return the same record.
    idempotencyKey: `issue:${invoice.key}`,
    subtotal: invoice.subtotal,
    discount: 0,
    taxPercent: 0,
  })

  const issueInvoice = async (invoice, { silent = false, locked = false } = {}) => {
    if (!canCreate || (!locked && busyRef.current) || invoice.record || invoice.isQuote) return null
    const ownsLock = !locked
    if (ownsLock) {
      busyRef.current = true
      setBusy(true)
    }
    setActionError('')
    setCreatingKey(invoice.key)
    try {
      const id = await createInvoiceRecord(recordArgs(invoice))
      await refreshBilling()
      return id
    } catch (err) {
      // A concurrent submit from another tab may have created it first.
      // A failed lookup (e.g. migration not applied) must not mask the
      // original error or abort the surrounding manual-document save.
      await refreshBilling()
      let existing = null
      try {
        existing = asArray(await loadInvoiceRecords()).find(r =>
          r.source_type === invoice.sourceType && String(r.source_id) === String(invoice.sourceId))
      } catch { /* keep the original RPC error */ }
      if (existing) return existing.id
      if (!silent) setActionError(err.message || 'Could not issue this invoice.')
      return null
    } finally {
      setCreatingKey('')
      if (ownsLock) {
        busyRef.current = false
        setBusy(false)
      }
    }
  }

  const submitDocument = async (invoice, doc) => {
    if (!canCreate || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setActionError('')
    try {
      if (!invoice.isManual) {
        const id = await issueInvoice(invoice, { locked: true })
        if (id) openDoc(invoice)
        return
      }

      const saved = await saveManualInvoice(doc)
      const savedKey = `${invoice.sourceType}:${saved.id || doc.id}`
      let issued = true
      if (!invoice.isQuote) {
        issued = await issueInvoice({
          ...invoice,
          sourceId: saved.id || doc.id,
          key: savedKey,
        }, { silent: true, locked: true })
        if (!issued) {
          setActionError('Document saved, but invoice tracking is unavailable. Apply the invoice management migration.')
        }
      }
      await reloadAll()
      openDoc({ ...invoice, sourceId: saved.id || doc.id, key: savedKey }, false, { clearErrors: !!issued })
    } catch (err) {
      console.error('[Invoices] save document failed:', err)
      setActionError(err.message || 'Could not save this document.')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const submitPayment = async (payload) => {
    if (paymentBusyRef.current) return
    paymentBusyRef.current = true
    setPaymentBusy(true)
    setPaymentError('')
    try {
      await recordInvoicePayment(payload)
      await refreshBilling()
      setPaymentVersion(v => v + 1)
    } catch (err) {
      setPaymentError(err.message || 'Could not record this payment.')
    } finally {
      paymentBusyRef.current = false
      setPaymentBusy(false)
    }
  }

  const deleteDocument = async (invoice) => {
    if (!invoice.isManual || !canDelete || busyRef.current) return
    if (invoice.record) {
      setActionError('Issued documents are locked. Delete and edit are unavailable so payment history stays intact.')
      return
    }
    const label = invoice.isQuote ? 'quotation' : 'manual invoice'
    if (!window.confirm(`Delete this ${label}? This cannot be undone.`)) return
    busyRef.current = true
    setBusy(true)
    try {
      await deleteManualInvoice(invoice.sourceId)
      await reloadAll()
      if (docKey === invoice.key) closeDoc()
    } catch (err) {
      setActionError(err.message || `Could not delete this ${label}.`)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const eligibilityFor = (booking) => invoiceEligibility(booking, records)
  const openBooking = (booking) => {
    if (!eligibilityFor(booking).eligible) return
    openBookingEditor(booking)
  }

  // ── Table cell rendering ──────────────────────────────────────
  const colLabel = key => ALL_COLUMNS.find(c => c.key === key)?.label || key
  const cellFor = (inv, key) => {
    switch (key) {
      case 'invoiceNo':
        return <td key={key} className="px-4 py-3 md:py-2 text-xs font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">{inv.invoiceNo}</td>
      case 'date':
        return <td key={key} className="px-4 py-3 md:py-2 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap tabular-nums">{shortDate(inv.invoiceDate || inv.tripDate)}</td>
      case 'route':
        return <td key={key} className="px-4 py-3 md:py-2 text-xs text-slate-600 dark:text-slate-300 max-w-[200px] truncate">{shortLocation(inv.pickup)} <span className="text-slate-300 dark:text-slate-600 mx-1">→</span> {shortLocation(inv.drop)}</td>
      case 'driver':
        return <td key={key} className="px-4 py-3 md:py-2 text-xs text-slate-600 dark:text-slate-300 max-w-[130px] truncate">{inv.driver || '—'}</td>
      case 'vehicle':
        return <td key={key} className="px-4 py-3 md:py-2 text-xs font-mono text-slate-500 dark:text-slate-400 max-w-[120px] truncate">{inv.vehicle || '—'}</td>
      case 'km':
        return <td key={key} className="px-4 py-3 md:py-2 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap tabular-nums">{inv.km ? `${inv.km} km` : '—'}</td>
      case 'total':
        return <td key={key} className="px-4 py-3 md:py-2 text-xs font-bold text-navy-800 dark:text-blue-300 whitespace-nowrap tabular-nums">{formatINR(inv.total, currency)}</td>
      case 'balance':
        return <td key={key} className="px-4 py-3 md:py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap tabular-nums">{formatINR(inv.balance, currency)}</td>
      case 'status':
        return <td key={key} className="px-4 py-3 md:py-2"><StatusPill tone={PAYMENT_TONE[inv.paymentStatus] || 'gray'}>{inv.paymentStatus}</StatusPill></td>
      default:
        return null
    }
  }

  return (
    <div className="space-y-4 md:space-y-3 animate-fade-up">
      {/* URL-backed overlays */}
      {view === 'create' && (
        <InvoiceChooser onClose={clearOverlay}
          onChoose={choice => {
            if (choice === 'booking') openBookings()
            else openEditor(choice)
          }} />
      )}

      {view === 'bookings' && (
        <BookingPicker
          bookings={bookings} records={records} payments={payments} currency={currency}
          busyKey={creatingKey}
          onClose={clearOverlay}
          onSelect={openBooking}
          onOpenInvoice={openDoc}
        />
      )}

      {view === 'editor' && editingDoc && editingDocLocked && (
        <Callout tone="amber" icon={AlertTriangle}
          title="This document has been issued and is locked."
          sub="Edit and delete are unavailable so the printed total and payment history stay in sync."
          actionLabel="Close" onAction={clearOverlay} />
      )}

      {view === 'editor' && (!editingDoc || !editingDocLocked) && (
        <DocumentEditor
          kind={editorKind}
          source={editingDoc}
          customers={customers}
          records={records}
          payments={payments}
          currency={currency}
          canCreate={canCreate}
          busy={busy}
          error={actionError}
          onClose={clearOverlay}
          onSubmit={submitDocument}
        />
      )}

      {view === 'booking-editor' && editingBooking && (
        <DocumentEditor
          kind="invoice"
          booking={editingBooking}
          customers={customers}
          records={records}
          payments={payments}
          currency={currency}
          canCreate={canCreate}
          busy={busy}
          error={actionError}
          onClose={clearOverlay}
          onSubmit={submitDocument}
        />
      )}

      {docKey && selectedInvoice && (
        <InvoiceModal
          invoice={selectedInvoice}
          records={records}
          payments={payments}
          canCreate={canCreate}
          canManage={canCreate}
          canDelete={canDelete}
          busy={busy}
          paymentBusy={paymentBusy}
          paymentError={paymentError}
          paymentVersion={paymentVersion}
          autoPrint={autoPrint}
          error={actionError}
          onClose={closeDoc}
          onIssue={inv => issueInvoice(inv)}
          onRecordPayment={submitPayment}
          onDelete={deleteDocument}
        />
      )}

      {docKey && !selectedInvoice && !loading && (
        <Callout tone="amber" icon={AlertTriangle} title="This invoice is no longer available." actionLabel="Close" onAction={closeDoc} />
      )}

      <PageHeader
        title="Invoices"
        subtitle="Trip bills, manual invoices, quotations & settlement"
        action={canCreate ? <Button icon={Plus} variant="primary" onClick={openChooser}>New Invoice</Button> : null}
      />

      {loadError && <Callout tone="red" icon={AlertTriangle} title={loadError} actionLabel="Retry" onAction={reloadAll} />}
      {manualError && <Callout tone="red" icon={AlertTriangle} title={manualError} actionLabel="Retry" onAction={reloadAll} />}
      {billingError && (
        <Callout tone="red" icon={AlertTriangle}
          title={`Invoice tracking unavailable: ${billingError}`}
          actionLabel="Retry" onAction={reloadAll} />
      )}
      {actionError && !view && !docKey && (
        <Callout tone="red" icon={AlertTriangle} title={actionError} onAction={() => setActionError('')} actionLabel="Dismiss" />
      )}

      {/* Finance-first KPIs — sourced from issued records and payments */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <MetricCard label="Total Invoiced" value={formatINR(summary.total, currency)}
          sub={`${billableInvoices.length} invoice${billableInvoices.length === 1 ? '' : 's'}`}
          icon={FileText} tone="blue" onClick={() => setTab('all')} />
        <MetricCard label="Amount Received" value={formatINR(summary.received, currency)}
          sub="Valid recorded payments" icon={Wallet} tone="green" onClick={() => setTab('paid')} />
        <MetricCard label="Pending Amount" value={formatINR(summary.pending, currency)}
          sub="Invoice total less payments" icon={IndianRupee} tone="amber" onClick={() => setTab('pending')} />
        <MetricCard label="Overdue Amount" value={formatINR(summary.overdue, currency)}
          sub={`This month ${formatINR(thisMonthFare, currency)} · Avg ${formatINR(avgBill, currency)}`}
          icon={AlertTriangle} tone="red" onClick={() => setTab('overdue')} />
      </div>

      {/* Status tabs + search + column picker */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <SegmentedControl
          ariaLabel="Invoice status"
          value={tab}
          onChange={setTab}
          scroll
          options={INVOICE_TABS.map(item => ({ key: item.key, label: item.label }))}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <label className="relative block">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search invoices…" aria-label="Search invoices"
              className={`${fieldCls} h-10 pl-9 w-[190px] sm:w-[240px]`} />
          </label>
          <div className="relative flex-shrink-0" ref={colsRef}>
            <button onClick={() => setColsOpen(v => !v)} aria-label="Customize table columns"
              aria-expanded={colsOpen} aria-haspopup="menu"
              className="flex items-center gap-1.5 px-3 min-h-[40px] rounded-[10px] border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-xs font-bold text-slate-600 dark:text-slate-300 active:scale-95 transition-all">
              <Columns3 size={14} /> Columns
            </button>
            {colsOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 ap-surface rounded-[20px] shadow-2xl border border-[var(--ap-border)] overflow-hidden z-50 animate-fade-up"
                role="menu" aria-label="Table columns">
                <p className="px-4 pt-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Show columns</p>
                <div className="p-1.5">
                  {ALL_COLUMNS.map(c => {
                    const on = visibleCols.includes(c.key)
                    return (
                      <button key={c.key} onClick={() => toggleCol(c.key)} role="menuitemcheckbox" aria-checked={on}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-600 dark:text-slate-300 hover:bg-[var(--ap-surface-2)] transition-colors text-left">
                        <span className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${on ? 'bg-blue-600 border-blue-600 text-white' : 'border-[var(--ap-border)] text-transparent'}`}>
                          <Check size={13} strokeWidth={3} />
                        </span>
                        {c.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3" role="status" aria-busy="true" aria-label="Loading invoices">
          <span className="sr-only">Loading invoices…</span>
          <div className="ap-surface rounded-[20px] p-4 space-y-2.5 hidden md:block" aria-hidden="true">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="skeleton w-7 h-7 rounded-full flex-shrink-0" />
                <div className="skeleton h-3.5 flex-1 rounded" />
                <div className="skeleton h-4 w-20 rounded" />
                <div className="skeleton h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
          <div className="md:hidden space-y-2.5" aria-hidden="true">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="ap-surface p-3.5 space-y-2">
                <div className="skeleton h-4 w-2/3 rounded" />
                <div className="skeleton h-3 w-1/2 rounded" />
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && (
        <>
          {/* Desktop table */}
          <div className="ap-surface rounded-[20px] overflow-hidden hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--ap-border)] bg-[var(--ap-surface-2)]">
                  <th className="px-4 py-3 md:py-2 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Customer</th>
                  {visibleCols.map(key => (
                    <th key={key} className="px-4 py-3 md:py-2 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{colLabel(key)}</th>
                  ))}
                  <th className="px-4 py-3 md:py-2 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={visibleCols.length + 2} className="!border-0">
                    <EmptyState icon={FileText} title="No invoices found" description="Completed trips and saved bills appear here." />
                  </td></tr>
                ) : pageRows.map(inv => (
                  <tr key={inv.key} className="border-b border-[var(--ap-border)] hover:bg-[var(--ap-surface-2)] transition-colors cursor-pointer"
                    onClick={() => openDoc(inv)}>
                    <td className="px-4 py-3 md:py-2">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={inv.customer} size={28} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate max-w-[160px]">{inv.customer}</p>
                            {inv.isManual && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0 ${
                                inv.isQuote ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-violet-500/10 text-violet-700 dark:text-violet-300'
                              }`}>{inv.isQuote ? 'Quote' : 'Manual'}</span>
                            )}
                          </div>
                          <p className="text-[10px] font-mono text-slate-400 truncate max-w-[160px]">{inv.bookingRef || inv.invoiceNo}</p>
                        </div>
                      </div>
                    </td>
                    {visibleCols.map(key => cellFor(inv, key))}
                    <td className="px-4 py-3 md:py-2">
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <IconButton icon={Eye} size={15} tone="brand"
                          label={`View invoice for ${inv.customer}`} onClick={() => openDoc(inv)} />
                        <IconButton icon={Printer} size={15}
                          label={`Print invoice for ${inv.customer}`} onClick={() => openDoc(inv, true)} />
                        {inv.isManual && canDelete && !inv.record && (
                          <IconButton icon={FileText} size={15}
                            label={`Edit ${inv.isQuote ? 'quotation' : 'manual invoice'} for ${inv.customer}`}
                            onClick={() => openEditor(inv.isQuote ? 'quotation' : 'invoice', inv.sourceId)} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2.5">
            {filtered.length === 0 ? (
              <EmptyState icon={FileText} title="No invoices found" description="Completed trips and saved bills appear here."
                className="ap-surface rounded-[20px]" />
            ) : pageRows.map(inv => (
              <button key={inv.key} type="button" onClick={() => openDoc(inv)}
                className="ap-surface ios-press p-3.5 w-full text-left">
                <div className="flex items-center gap-2.5 mb-2">
                  <Avatar name={inv.customer} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{inv.customer}</p>
                      {inv.isManual && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-300 uppercase flex-shrink-0">
                          {inv.isQuote ? 'Quote' : 'Manual'}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono truncate">{inv.invoiceNo}</p>
                  </div>
                  <StatusPill tone={PAYMENT_TONE[inv.paymentStatus] || 'gray'}>{inv.paymentStatus}</StatusPill>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug truncate">
                  {shortLocation(inv.pickup)} <span className="text-slate-300 dark:text-slate-600 mx-0.5">→</span> {shortLocation(inv.drop)}
                </p>
                <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-[var(--ap-border)]">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {shortDate(inv.invoiceDate || inv.tripDate)} · {formatINR(inv.balance, currency)} due
                  </p>
                  <p className="text-xs font-semibold text-navy-800 dark:text-blue-300 tabular-nums flex-shrink-0">
                    {formatINR(inv.total, currency)}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {/* Pagination */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                Page {safePage} of {totalPages} · {filtered.length} document{filtered.length !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button onClick={() => setPage(safePage - 1)} disabled={safePage <= 1} aria-label="Previous page"
                  className="min-w-[36px] min-h-[36px] px-2.5 rounded-[10px] border border-[var(--ap-border)] text-xs font-bold text-slate-600 dark:text-slate-300 active:scale-95 disabled:opacity-40">
                  ←
                </button>
                {pageItems.map((n, i) => n === '…'
                  ? <span key={`e${i}`} className="text-xs text-slate-400 px-1">…</span>
                  : (
                    <button key={n} onClick={() => setPage(n)} aria-label={`Go to page ${n}`}
                      aria-current={n === safePage ? 'page' : undefined}
                      className={`min-w-[36px] min-h-[36px] px-2.5 rounded-[10px] text-xs font-bold tabular-nums active:scale-95 ${
                        n === safePage ? 'bg-[var(--ap-accent)] text-white shadow'
                          : 'border border-[var(--ap-border)] text-slate-600 dark:text-slate-300'
                      }`}>{n}</button>
                  ))}
                <button onClick={() => setPage(safePage + 1)} disabled={safePage >= totalPages} aria-label="Next page"
                  className="min-w-[36px] min-h-[36px] px-2.5 rounded-[10px] border border-[var(--ap-border)] text-xs font-bold text-slate-600 dark:text-slate-300 active:scale-95 disabled:opacity-40">
                  →
                </button>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-1">Go to</span>
                <input value={goPage} onChange={e => setGoPage(e.target.value.replace(/[^0-9]/g, ''))}
                  onKeyDown={e => { if (e.key === 'Enter') goToPage() }} onBlur={() => { if (goPage) goToPage() }}
                  placeholder={String(totalPages)} inputMode="numeric"
                  aria-label={`Go to page, 1 to ${totalPages}`}
                  className="w-14 min-h-[36px] rounded-[10px] border border-[var(--ap-border)] bg-[var(--ap-surface-2)] px-2 text-center text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 tabular-nums" />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

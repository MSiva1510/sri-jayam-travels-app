import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Printer, Eye, AlertTriangle, FileText, X, Columns3, Check } from 'lucide-react'
import Avatar        from '../components/ui/Avatar'
import Button        from '../components/ui/Button'
import PageHeader    from '../components/ui/PageHeader'
import ModalOverlay  from '../components/ui/ModalOverlay'
import InvoiceModal  from '../components/invoice/InvoiceModal'
import { loadBookings, getStatusCfg } from '../data/tripTypes'

// ── Customizable columns (Actions is always on; preference persists) ──
const ALL_COLUMNS = [
  { key: 'bookingNo', label: 'Booking No', on: false },
  { key: 'date',      label: 'Date',       on: true  },
  { key: 'route',     label: 'Route',      on: false },
  { key: 'driver',    label: 'Driver',     on: false },
  { key: 'vehicle',   label: 'Vehicle',    on: false },
  { key: 'km',        label: 'KM',         on: false },
  { key: 'fare',      label: 'Fare',       on: true  },
  { key: 'status',    label: 'Status',     on: true  },
]
const COLS_KEY = 'sjt-invoice-cols'

function loadCols() {
  try {
    const raw = localStorage.getItem(COLS_KEY)
    if (!raw) return ALL_COLUMNS.filter(c => c.on).map(c => c.key)
    const arr = JSON.parse(raw)
    const known = new Set(ALL_COLUMNS.map(c => c.key))
    const clean = (Array.isArray(arr) ? arr : []).filter(k => known.has(k))
    return clean.length > 0 ? clean : ALL_COLUMNS.filter(c => c.on).map(c => c.key)
  } catch { return ALL_COLUMNS.filter(c => c.on).map(c => c.key) }
}

// ── Manual bill / quotation form ─────────────────────────────
const MANUAL_TRIP_TYPES = [
  { key: '',           label: 'Select type…' },
  { key: 'one_way',    label: 'One Way' },
  { key: 'round_trip', label: 'Round Trip' },
  { key: 'multi_loc',  label: 'Multi Location' },
  { key: 'local_visit', label: 'Local Visit' },
  { key: 'multi_day',  label: 'Multi Day' },
  { key: 'self_drive', label: 'Self Drive' },
]

function blankManual(kind) {
  const d = new Date()
  const stamp = `${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${Date.now().toString().slice(-4)}`
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return {
    billNo: `${kind === 'quotation' ? 'QT' : 'MB'}-${stamp}`,
    date: today, customer: '', contact: '', pickup: '', drop: '',
    tripType: '', vehicle: '', driver: '', driverMobile: '',
    km: '', fare: '', toll: '', bata: '', fuel: '', parking: '',
    leadSource: '', notes: '',
  }
}

function MF({ label, ...props }) {
  return (
    <label className="block min-w-0">
      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</span>
      <input
        {...props}
        className="mt-1 w-full rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 px-3 min-h-[40px] text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 transition-colors"
      />
    </label>
  )
}

function StatusBadge({ status }) {
  const cfg = getStatusCfg(status)
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

export default function Invoices() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const reloadBookings = useCallback(async () => {
    setLoading(true)
    try {
      const b = await loadBookings()
      setBookings(Array.isArray(b) ? b : [])
      setLoadError(null)
    } catch (err) {
      console.error('[Invoices] load failed:', err)
      setLoadError('Could not load bookings. Try refreshing.')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { reloadBookings() }, [reloadBookings])

  const [selected, setSelected] = useState(null)   // booking shown in InvoiceModal
  const [pickerOpen, setPickerOpen] = useState(false) // "New Invoice" booking picker
  const [visibleCols, setVisibleCols] = useState(loadCols)
  const [colsOpen, setColsOpen] = useState(false)
  const colsRef = useRef(null)

  // Close the column picker on outside tap
  useEffect(() => {
    if (!colsOpen) return
    const fn = e => { if (colsRef.current && !colsRef.current.contains(e.target)) setColsOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [colsOpen])

  const toggleCol = (key) => {
    setVisibleCols(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      // Keep at least one data column visible
      const safe = next.length === 0 ? prev : next
      try { localStorage.setItem(COLS_KEY, JSON.stringify(safe)) } catch {}
      return safe
    })
  }

  const colLabel = (key) => ALL_COLUMNS.find(c => c.key === key)?.label || key

  // Render one data cell for a visible column key (Customer + Actions are fixed)
  const cellFor = (b, key) => {
    switch (key) {
      case 'bookingNo':
        return <td key={key} className="px-4 py-3 md:py-2 text-xs font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">{b.bookingNo || b.id}</td>
      case 'date':
        return <td key={key} className="px-4 py-3 md:py-2 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap tabular-nums">{b.startDate || '—'}</td>
      case 'route':
        return <td key={key} className="px-4 py-3 md:py-2 text-xs text-slate-600 dark:text-slate-300 max-w-[200px] truncate">{b.pickup || '—'} <span className="text-slate-300 dark:text-slate-500 mx-1">→</span> {b.drop || '—'}</td>
      case 'driver':
        return <td key={key} className="px-4 py-3 md:py-2 text-xs text-slate-600 dark:text-slate-300 max-w-[130px] truncate">{b.driver || '—'}</td>
      case 'vehicle':
        return <td key={key} className="px-4 py-3 md:py-2 text-xs font-mono text-slate-500 dark:text-slate-400 max-w-[120px] truncate">{b.vehicle || '—'}</td>
      case 'km':
        return <td key={key} className="px-4 py-3 md:py-2 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap tabular-nums">{b.km ? `${b.km} km` : '—'}</td>
      case 'fare':
        return <td key={key} className="px-4 py-3 md:py-2 text-xs font-bold text-navy-800 dark:text-blue-300 whitespace-nowrap tabular-nums">{b.fare ? `Rs. ${b.fare.toLocaleString('en-IN')}` : '—'}</td>
      case 'status':
        return <td key={key} className="px-4 py-3 md:py-2"><StatusBadge status={b.status} /></td>
      default:
        return null
    }
  }

  // Picker tabs: billable (completed/closed) vs new or non-complete trips
  const [pickTab, setPickTab] = useState('completed') // 'completed' | 'ongoing'
  // Manual bills/quotations live in-session and list under New/Ongoing only
  const [manualDocs, setManualDocs] = useState([])
  // Manual bill / quotation creator
  const [manualOpen, setManualOpen] = useState(false)
  const [manualKind, setManualKind] = useState('invoice') // 'invoice' | 'quotation'
  const [manualForm, setManualForm] = useState(() => blankManual('invoice'))

  const openManual = (kind) => {
    setManualKind(kind)
    setManualForm(blankManual(kind))
    setPickerOpen(false)
    setManualOpen(true)
  }
  const updManual = (k) => (e) => setManualForm(f => ({ ...f, [k]: e.target.value }))
  const manualValid = manualForm.customer.trim() !== '' && Number(manualForm.fare) > 0

  const createManual = () => {
    if (!manualValid) return
    const num = (v) => Number(v) || 0
    const doc = {
      id: `manual-${Date.now()}`,
      bookingNo: manualForm.billNo.trim() || `MAN-${Date.now().toString().slice(-6)}`,
      customer: manualForm.customer.trim(),
      contact: manualForm.contact.trim(),
      pickup: manualForm.pickup.trim(),
      drop: manualForm.drop.trim(),
      driver: manualForm.driver.trim(),
      driverMobile: manualForm.driverMobile.trim(),
      driver_contact: manualForm.driverMobile.trim(),
      vehicle: manualForm.vehicle.trim(),
      km: num(manualForm.km),
      fare: num(manualForm.fare),
      toll: num(manualForm.toll),
      bata: num(manualForm.bata),
      petrol: num(manualForm.fuel),
      parking: num(manualForm.parking),
      extras: 0,
      startDate: manualForm.date,
      type: manualForm.tripType,
      notes: manualForm.notes.trim(),
      leadSource: manualForm.leadSource.trim(),
      source: manualForm.leadSource.trim(),
      status: 'draft',
      docType: manualKind,
      isManual: true,
    }
    // Lists under New/Ongoing only — preview it right away
    setManualDocs(prev => [doc, ...prev])
    setSelected(doc)
    setManualOpen(false)
  }
  const completedList = bookings.filter(b => b.status === 'completed' || b.status === 'closed')
  const ongoingList = [...manualDocs, ...bookings.filter(b => b.status !== 'completed' && b.status !== 'closed')]
  const pickList = pickTab === 'completed' ? completedList : ongoingList

  // Main list shows completed trips only — ongoing lives in Trips + picker
  const filtered = completedList

  // ── Pagination: 7 rows per page + go-to-page ────────────────
  const PAGE_SIZE = 7
  const [page, setPage] = useState(1)
  const [goPage, setGoPage] = useState('')
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  // Clamp back into range when the list shrinks (e.g. fresh load)
  useEffect(() => {
    setPage(p => Math.min(Math.max(1, p), Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))))
  }, [filtered.length])

  // Compact page buttons: 1 … window … last
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

  const totalFare      = completedList.reduce((s, b) => s + (b.fare || 0), 0)
  const completedCount = completedList.length

  return (
    <div className="space-y-4 md:space-y-3 animate-fade-up">

      {/* Invoice preview / print / share modal */}
      {selected && <InvoiceModal booking={selected} onClose={() => setSelected(null)} />}

      {/* New Invoice — pick a billable booking to invoice */}
      {pickerOpen && (
        <ModalOverlay onClose={() => setPickerOpen(false)} center>
          <div className="w-[92vw] max-w-md max-h-[70vh] flex flex-col rounded-[20px] bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 shadow-2xl overflow-hidden animate-fade-up" role="dialog" aria-modal="true" aria-label="New invoice — select booking">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-navy-700">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[12px] bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <FileText size={15} className="text-navy-700 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-slate-800 dark:text-white leading-tight">New Invoice</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">Select a completed booking</p>
                </div>
              </div>
              <button onClick={() => setPickerOpen(false)}
                aria-label="Close booking picker"
                className="min-w-[36px] min-h-[36px] w-9 h-9 rounded-[12px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 active:scale-95 transition-all flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            <div className="flex gap-1 bg-slate-100 dark:bg-navy-800 rounded-xl p-1 mx-3 mt-3" role="group" aria-label="Booking type">
              {[
                { key: 'completed', label: `Completed (${completedList.length})` },
                { key: 'ongoing', label: `New / Ongoing (${ongoingList.length})` },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setPickTab(t.key)}
                  aria-pressed={pickTab === t.key}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    pickTab === t.key
                      ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="overflow-y-auto p-3 space-y-2">
              {pickList.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                  {pickTab === 'completed'
                    ? 'No completed trips available to invoice yet.'
                    : 'No new or ongoing trips right now.'}
                </p>
              ) : pickList.map(b => (
                <button key={b.id} onClick={() => { setSelected(b); setPickerOpen(false) }}
                  className="ios-card ios-press w-full text-left p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{b.customer}</p>
                      <StatusBadge status={b.status} />
                      {b.isManual && (
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0 ${
                          b.docType === 'quotation'
                            ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
                            : 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                        }`}>
                          {b.docType === 'quotation' ? 'Quote' : 'Manual'}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-mono text-slate-400 truncate mt-0.5">{b.bookingNo || b.id} · {b.pickup} → {b.drop}</p>
                  </div>
                  <span className="text-xs font-extrabold text-navy-800 dark:text-blue-300 whitespace-nowrap tabular-nums flex-shrink-0">
                    {b.fare ? `Rs. ${b.fare.toLocaleString('en-IN')}` : '—'}
                  </span>
                </button>
              ))}
            </div>
            {pickTab === 'ongoing' && (
            <div className="p-3 border-t border-slate-100 dark:border-navy-700 grid grid-cols-2 gap-2">
              <button onClick={() => openManual('invoice')}
                className="px-3 min-h-[40px] rounded-[12px] bg-navy-900 dark:bg-blue-600 text-white text-xs font-bold active:scale-95 transition-all">
                + Manual Invoice
              </button>
              <button onClick={() => openManual('quotation')}
                className="px-3 min-h-[40px] rounded-[12px] border border-slate-200 dark:border-navy-600 text-xs font-bold text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 active:scale-95 transition-all">
                + Quotation
              </button>
            </div>
            )}
          </div>
        </ModalOverlay>
      )}

      {/* Manual bill / quotation creator */}
      {manualOpen && (
        <ModalOverlay onClose={() => setManualOpen(false)} center>
          <div className="w-[94vw] max-w-lg max-h-[85vh] flex flex-col rounded-[20px] bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 shadow-2xl overflow-hidden animate-fade-up" role="dialog" aria-modal="true" aria-label="Create manual bill">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-navy-700">
              <div>
                <p className="text-sm font-extrabold text-slate-800 dark:text-white leading-tight">Manual {manualKind === 'quotation' ? 'Quotation' : 'Invoice'}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">Enter details — preview before print/share</p>
              </div>
              <button onClick={() => setManualOpen(false)}
                aria-label="Close manual bill form"
                className="min-w-[36px] min-h-[36px] w-9 h-9 rounded-[12px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 active:scale-95 transition-all flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-3">
              <div className="flex gap-1 bg-slate-100 dark:bg-navy-800 rounded-xl p-1" role="group" aria-label="Document type">
                {[
                  { key: 'invoice', label: 'Invoice' },
                  { key: 'quotation', label: 'Quotation' },
                ].map(t => (
                  <button
                    key={t.key}
                    onClick={() => {
                      setManualKind(t.key)
                      setManualForm(f => ({ ...f, billNo: blankManual(t.key).billNo }))
                    }}
                    aria-pressed={manualKind === t.key}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      manualKind === t.key
                        ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MF label={manualKind === 'quotation' ? 'Quote No.' : 'Bill No.'} value={manualForm.billNo} onChange={updManual('billNo')} />
                <MF label="Trip Date" type="date" value={manualForm.date} onChange={updManual('date')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MF label="Customer *" placeholder="Full name" value={manualForm.customer} onChange={updManual('customer')} />
                <MF label="Contact" placeholder="Mobile" inputMode="tel" value={manualForm.contact} onChange={updManual('contact')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MF label="Pickup" placeholder="From" value={manualForm.pickup} onChange={updManual('pickup')} />
                <MF label="Drop" placeholder="To" value={manualForm.drop} onChange={updManual('drop')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block min-w-0">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Trip Type</span>
                  <select value={manualForm.tripType} onChange={updManual('tripType')}
                    className="mt-1 w-full rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 px-3 min-h-[40px] text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 transition-colors">
                    {MANUAL_TRIP_TYPES.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                </label>
                <MF label="Lead Source" placeholder="Phone Call" value={manualForm.leadSource} onChange={updManual('leadSource')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MF label="Vehicle" placeholder="Reg no." value={manualForm.vehicle} onChange={updManual('vehicle')} />
                <MF label="KM" placeholder="0" inputMode="decimal" value={manualForm.km} onChange={updManual('km')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MF label="Driver" placeholder="Name" value={manualForm.driver} onChange={updManual('driver')} />
                <MF label="Driver Mobile" placeholder="Mobile" inputMode="tel" value={manualForm.driverMobile} onChange={updManual('driverMobile')} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <MF label="Fare (Rs.) *" placeholder="0" inputMode="decimal" value={manualForm.fare} onChange={updManual('fare')} />
                <MF label="Toll" placeholder="0" inputMode="decimal" value={manualForm.toll} onChange={updManual('toll')} />
                <MF label="Bata" placeholder="0" inputMode="decimal" value={manualForm.bata} onChange={updManual('bata')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MF label="Fuel" placeholder="0" inputMode="decimal" value={manualForm.fuel} onChange={updManual('fuel')} />
                <MF label="Parking" placeholder="0" inputMode="decimal" value={manualForm.parking} onChange={updManual('parking')} />
              </div>
              <label className="block">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Notes</span>
                <textarea value={manualForm.notes} onChange={updManual('notes')} rows={2} placeholder="Anything on the bill…"
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 transition-colors resize-none" />
              </label>
              {!manualValid && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500">Add a customer name and a fare above Rs. 0 to preview.</p>
              )}
            </div>
            <div className="p-3 border-t border-slate-100 dark:border-navy-700">
              <button onClick={createManual} disabled={!manualValid}
                className="w-full min-h-[44px] rounded-[12px] bg-navy-900 dark:bg-blue-600 text-white text-sm font-bold active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                Preview {manualKind === 'quotation' ? 'Quotation' : 'Invoice'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      <PageHeader
        title="Invoices"
        subtitle="Trip bills, pay slips & invoice management"
        action={<Button icon={Plus} variant="primary" onClick={() => setPickerOpen(true)}>New Invoice</Button>}
      />

      {/* Loading skeleton (iPhone shimmer, mirrors the real layout) */}
      {loading && (
        <div className="space-y-4" role="status" aria-busy="true" aria-label="Loading invoices">
          <span className="sr-only">Loading invoices…</span>
          <div className="flex gap-3 flex-wrap">
            {[1, 2, 3].map(i => (
              <div key={i} className="ios-card px-4 py-2.5 flex items-center gap-2" aria-hidden="true">
                <div className="skeleton h-3 w-16 rounded" />
                <div className="skeleton h-4 w-14 rounded" />
              </div>
            ))}
          </div>
          <div className="skeleton h-9 w-full max-w-md rounded-xl" aria-hidden="true" />
          {/* Desktop table skeleton */}
          <div className="glass-card rounded-[20px] p-4 space-y-2.5 hidden md:block" aria-hidden="true">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="skeleton w-7 h-7 rounded-full flex-shrink-0" />
                <div className="skeleton h-3.5 flex-1 rounded" />
                <div className="skeleton h-3.5 w-16 rounded" />
                <div className="skeleton h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
          {/* Mobile card skeletons */}
          <div className="md:hidden space-y-2.5" aria-hidden="true">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="ios-card p-3.5 space-y-2">
                <div className="flex items-center gap-2.5">
                  <div className="skeleton w-8 h-8 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="skeleton h-4 w-2/3 rounded" />
                    <div className="skeleton h-3 w-1/2 rounded" />
                  </div>
                  <div className="skeleton h-5 w-16 rounded-full" />
                </div>
                <div className="skeleton h-3 w-full rounded" />
              </div>
            ))}
          </div>
        </div>
      )}

      {loadError && (
        <div className="bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800/30 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="text-sm font-bold text-red-700 dark:text-red-400">{loadError}</p>
          </div>
          <button onClick={reloadBookings}
            className="px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-400 text-white text-xs font-bold transition-all active:scale-95 shadow-md flex-shrink-0">
            Retry
          </button>
        </div>
      )}

      {!loading && (
      <>
      {/* Summary chips + column picker in one row (completed invoices only) */}
      <div className="flex items-center justify-between gap-2 flex-wrap md:shrink-0">
      <div className="flex gap-2.5 flex-wrap">
        {[
          { label: 'Total Fare',     value: `Rs. ${totalFare.toLocaleString('en-IN')}`, color: 'text-blue-600 dark:text-blue-400'       },
          { label: 'Invoices Done',  value: completedCount,                             color: 'text-emerald-600 dark:text-emerald-400' },
        ].map(c => (
          <div key={c.label} className="ios-card px-3.5 py-2 flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">{c.label}</span>
            <span className={`text-sm font-black tabular-nums ${c.color}`}>{c.value}</span>
          </div>
        ))}
      </div>

      {/* Column picker */}
      <div className="relative flex-shrink-0" ref={colsRef}>
        <button
          onClick={() => setColsOpen(v => !v)}
          aria-label="Customize table columns"
          aria-expanded={colsOpen}
          aria-haspopup="menu"
          className="flex items-center gap-1.5 px-3 min-h-[36px] rounded-[12px] border border-slate-200 dark:border-navy-700 bg-white/60 dark:bg-navy-800/60 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 active:scale-95 transition-all"
        >
          <Columns3 size={14} /> Columns
        </button>
        {colsOpen && (
          <div className="absolute right-0 top-full mt-2 w-56 glass-card rounded-[20px] shadow-2xl border border-slate-200 dark:border-navy-700 overflow-hidden z-50 animate-fade-up" role="menu" aria-label="Table columns">
            <p className="px-4 pt-3 pb-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Show columns</p>
            <div className="p-1.5">
              {ALL_COLUMNS.map(c => {
                const on = visibleCols.includes(c.key)
                return (
                  <button
                    key={c.key}
                    onClick={() => toggleCol(c.key)}
                    role="menuitemcheckbox"
                    aria-checked={on}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors text-left"
                  >
                    <span className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${on ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-navy-600 text-transparent'}`}>
                      <Check size={13} strokeWidth={3} />
                    </span>
                    {c.label}
                  </button>
                )
              })}
            </div>
            <p className="px-4 py-2 border-t border-slate-100 dark:border-navy-700 text-[10px] text-slate-400 dark:text-slate-500">Customer + Actions always shown</p>
          </div>
        )}
      </div>
      </div>
      </>
      )}

      {!loading && (
      <>
      {/* Desktop table — full height, no inner scroll */}
      <div className="glass-card rounded-[20px] overflow-hidden hidden md:block">
        <div>
          <table className="w-full text-sm">
            <thead className="md:sticky md:top-0 md:z-10">
              <tr className="border-b border-slate-100 dark:border-navy-700 bg-slate-50 dark:bg-navy-800">
                <th className="px-4 py-3 md:py-2 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Customer</th>
                {visibleCols.map(k => (
                  <th key={k} className="px-4 py-3 md:py-2 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{colLabel(k)}</th>
                ))}
                <th className="px-4 py-3 md:py-2 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={visibleCols.length + 2} className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                    No bookings found
                  </td>
                </tr>
              ) : pageRows.map(b => (
                <tr key={b.id} onClick={() => setSelected(b)} className="border-b border-slate-50 dark:border-navy-800 hover:bg-blue-50/40 dark:hover:bg-navy-800/40 transition-colors cursor-pointer">
                  <td className="px-4 py-3 md:py-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={b.customer} size={28} />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate max-w-[160px]">{b.customer}</p>
                        <p className="text-[10px] font-mono text-slate-400 truncate max-w-[160px]">{b.bookingNo || b.id}</p>
                      </div>
                    </div>
                  </td>
                  {visibleCols.map(k => cellFor(b, k))}
                  <td className="px-4 py-3 md:py-2">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setSelected(b)}
                        aria-label={`View invoice for ${b.customer}`}
                        title="View Invoice"
                        className="min-w-[36px] min-h-[36px] w-9 h-9 rounded-[12px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-900/50 active:scale-95 transition-all"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        onClick={() => setSelected(b)}
                        aria-label={`Print invoice for ${b.customer}`}
                        title="Print Invoice"
                        className="min-w-[36px] min-h-[36px] w-9 h-9 rounded-[12px] bg-slate-50 dark:bg-navy-700 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-navy-600 active:scale-95 transition-all"
                      >
                        <Printer size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards — stacked, no horizontal slider */}
      <div className="md:hidden space-y-2.5">
        {filtered.length === 0 ? (
          <div className="glass-card rounded-[20px] px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
            No bookings found
          </div>
        ) : pageRows.map(b => (
          <div key={b.id} onClick={() => setSelected(b)}
            className="ios-card ios-press p-3.5 cursor-pointer">
            <div className="flex items-center gap-2.5 mb-2">
              <Avatar name={b.customer} size={32} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{b.customer}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono truncate">{b.bookingNo || b.id} · {b.startDate || ''}</p>
              </div>
              <StatusBadge status={b.status} />
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug truncate">
              {b.pickup || '—'} <span className="text-slate-300 dark:text-slate-500 mx-0.5">→</span> {b.drop || '—'}
            </p>
            <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-white/5">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{b.driver || 'No driver'} · {b.km ? `${b.km} km` : '—'}</p>
              <p className="text-xs font-extrabold text-navy-800 dark:text-blue-300 tabular-nums flex-shrink-0">
                {b.fare ? `Rs. ${b.fare.toLocaleString('en-IN')}` : '—'}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination — 7 rows per page */}
      {filtered.length > 0 && (
      <div className="flex items-center justify-between gap-3 flex-wrap md:shrink-0">
        <p className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
          Page {safePage} of {totalPages} · {filtered.length} invoice{filtered.length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={() => setPage(safePage - 1)} disabled={safePage <= 1}
            aria-label="Previous page"
            className="min-w-[36px] min-h-[36px] px-2.5 rounded-[12px] border border-slate-200 dark:border-navy-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            ←
          </button>
          {pageItems.map((n, i) => n === '…'
            ? <span key={`e${i}`} className="text-xs text-slate-400 px-1">…</span>
            : (
              <button key={n} onClick={() => setPage(n)}
                aria-label={`Go to page ${n}`}
                aria-current={n === safePage ? 'page' : undefined}
                className={`min-w-[36px] min-h-[36px] px-2.5 rounded-[12px] text-xs font-bold tabular-nums active:scale-95 transition-all ${
                  n === safePage
                    ? 'bg-navy-900 dark:bg-blue-600 text-white shadow'
                    : 'border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700'
                }`}>
                {n}
              </button>
            ))}
          <button onClick={() => setPage(safePage + 1)} disabled={safePage >= totalPages}
            aria-label="Next page"
            className="min-w-[36px] min-h-[36px] px-2.5 rounded-[12px] border border-slate-200 dark:border-navy-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            →
          </button>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-1">Go to</span>
          <input
            value={goPage}
            onChange={e => setGoPage(e.target.value.replace(/[^0-9]/g, ''))}
            onKeyDown={e => { if (e.key === 'Enter') goToPage() }}
            onBlur={() => { if (goPage) goToPage() }}
            placeholder={String(totalPages)}
            inputMode="numeric"
            aria-label={`Go to page, 1 to ${totalPages}`}
            className="w-14 min-h-[36px] rounded-[12px] border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 px-2 text-center text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 tabular-nums"
          />
        </div>
      </div>
      )}
      </>
      )}
    </div>
  )
}
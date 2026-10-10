import { useState, useEffect, useMemo } from 'react'
import {
  Plus, Search, ChevronDown, ChevronUp,
  X, Edit2, Trash2, CheckCircle, AlertTriangle,
  Receipt, Calendar, User, Car, FileText,
  TrendingDown, BarChart3, Paperclip,
} from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import ModalOverlay from '../components/ui/ModalOverlay'
import Button     from '../components/ui/Button'
import MetricCard from '../components/ui/MetricCard'
import IconButton from '../components/ui/IconButton'
import StatusPill from '../components/ui/StatusPill'
import Callout    from '../components/ui/Callout'
import EmptyState from '../components/ui/EmptyState'
import SegmentedControl from '../components/ui/SegmentedControl'
import { fieldCls, Select as FieldSelect } from '../components/ui/Field'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../context/AuthContext'
import {
  loadExpenses, saveExpense, deleteExpense, generateExpenseId,
  EXPENSE_TYPES, APPROVAL_STATUSES, DRIVER_ALLOWED_TYPES,
  getExpTypeCfg, getApprovalCfg,
  isToday, isThisWeek, isThisMonth,
  summariseByType, getExpenseDate,
} from '../data/expenseData'
import { loadBookings } from '../data/tripTypes'
import { loadDrivers } from '../data/driverData'
import { loadVehicles } from '../data/vehicleData'
import { addAuditEvent } from '../data/auditLogData'
import { pageSizeFor } from '../utils/zoomPageSize'

// ─────────────────────────────────────────────────────────────
//  Shared badges
// ─────────────────────────────────────────────────────────────
const APPROVAL_TONE = { draft: 'gray', submitted: 'blue', approved: 'green', rejected: 'red' }

function ApprovalBadge({ status }) {
  const cfg = getApprovalCfg(status)
  return <StatusPill tone={APPROVAL_TONE[status] || 'gray'}>{cfg.label}</StatusPill>
}

// ─────────────────────────────────────────────────────────────
//  Add / Edit Expense Modal — Modules 2 & 3
// ─────────────────────────────────────────────────────────────
const EMPTY = {
  id:'', type:'fuel', status:'draft',
  date: new Date().toISOString().slice(0,10),
  amount:'', description:'', tripRef:'',
  driver:'', vehicle:'', addedBy:'',
  receiptName:'', receiptDate:'', notes:'',
}

// ── EF and ESel defined OUTSIDE modal so React doesn't remount on every keystroke ──
function EF({ label, field, type='text', required, placeholder, value, onChange, error }) {
  const handleChange = (e) => {
    let v = e.target.value
    if (type === 'number' && field === 'amount' && (isNaN(v) || Number(v) < 0)) v = ''
    if (field === 'description' || field === 'notes') v = v.slice(0, 200)
    if (field === 'driver' && v.length > 0 && !/^[a-zA-Z\s\-'.]*$/.test(v)) v = v.slice(0, -1)
    onChange(field, v)
  }
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input type={type} value={value || ''} placeholder={placeholder}
        onChange={handleChange} required={required}
        className={`${fieldCls} ${error ? 'border-red-400 dark:border-red-600' : ''}`} />
      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
    </div>
  )
}

function ESel({ label, field, children, required, value, onChange, error }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <FieldSelect value={value || ''} onChange={e => onChange(field, e.target.value)}>
        {children}
      </FieldSelect>
      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
    </div>
  )
}

function ExpenseModal({ expense, drivers, vehicles, onClose, onSave, currentUser, isDriver: isDrv }) {
  const [bookings, setBookings] = useState([])
  useEffect(() => { loadBookings().then(b => setBookings(Array.isArray(b) ? b : [])) }, [])
  const isEdit   = !!expense?.id
  const [form,   setForm]   = useState(() => expense || { ...EMPTY, addedBy: currentUser?.name || '' })
  const [errors, setErrors] = useState({})
  const upd = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const allowedTypes = isDrv ? EXPENSE_TYPES.filter(t => DRIVER_ALLOWED_TYPES.includes(t.key)) : EXPENSE_TYPES

  const validate = () => {
    const e = {}
    if (!form.type)               e.type   = 'Expense type is required'
    if (!form.amount || form.amount <= 0) e.amount = 'Valid amount is required'
    return e
  }

  const handleSave = () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    const now = new Date().toISOString()
    onSave({
      ...form,
      id:        form.id || generateExpenseId(),
      amount:    Number(form.amount),
      status:    form.status || 'draft',
      createdAt: form.createdAt || now,
      updatedAt: now,
    })
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="relative w-full sm:w-[480px] max-h-[92vh] sm:max-h-[85vh] ap-surface rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col animate-fade-up">
        <div className="w-10 h-1 bg-[var(--ap-border)] rounded-full mx-auto mt-3 sm:hidden flex-shrink-0" />
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--ap-border)] flex-shrink-0">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{isEdit ? 'Edit Expense' : 'Add Expense'}</p>
            <h3 className="font-sf font-semibold text-slate-800 dark:text-white text-base">
              {isEdit ? form.id : 'New Expense'}
            </h3>
          </div>
          <IconButton icon={X} label="Close expense form" onClick={onClose} />
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <ESel label="Expense Type" field="type" required value={form.type} onChange={upd} error={errors.type}>
              <option value="">— Select type —</option>
              {allowedTypes.map(t => (
                <option key={t.key} value={t.key}>{t.icon} {t.label}</option>
              ))}
            </ESel>
            <EF label="Date"   field="date"   type="date" required value={form.date} onChange={upd} error={errors.date} />
            <EF label="Amount (Rs.)" field="amount" type="number" required placeholder="0" value={form.amount} onChange={upd} error={errors.amount} />
            {!isDrv && (
              <ESel label="Status" field="status" value={form.status} onChange={upd} error={errors.status}>
                {APPROVAL_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </ESel>
            )}
          </div>

          <EF label="Description" field="description" placeholder="What was this expense for?" value={form.description} onChange={upd} error={errors.description} />

          <div className="grid grid-cols-2 gap-3">
            {!isDrv ? (
              <ESel label="Driver" field="driver" value={form.driver} onChange={upd} error={errors.driver}>
                <option value="">— None —</option>
                {(drivers||[]).map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </ESel>
            ) : (
              <EF label="Driver" field="driver" placeholder={currentUser?.name} value={form.driver} onChange={upd} error={errors.driver} />
            )}
            <ESel label="Vehicle" field="vehicle" value={form.vehicle} onChange={upd} error={errors.vehicle}>
              <option value="">— None —</option>
              {(vehicles||[]).map(v => <option key={v.id} value={v.reg}>{v.reg} — {v.type}</option>)}
            </ESel>
          </div>

          {/* Trip reference */}
          <ESel label="Trip Reference (optional)" field="tripRef" value={form.tripRef} onChange={upd} error={errors.tripRef}>
            <option value="">— No trip linked —</option>
            {bookings.map(b => (
              <option key={b.id} value={b.bookingNo}>{b.bookingNo} — {b.customer}</option>
            ))}
          </ESel>

          {/* Module 4: Dynamic type-specific fields */}
          {form.type === 'fuel' && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-900/30">
              <EF label="Odometer (KM)"   field="odometerKm"   type="number" placeholder="e.g. 45230"   value={form.odometerKm}   onChange={upd} />
              <EF label="Litres Filled"   field="litresFilled" type="number" placeholder="e.g. 20"      value={form.litresFilled} onChange={upd} />
              <EF label="Fuel Station"    field="fuelStation"               placeholder="Station name"   value={form.fuelStation}  onChange={upd} />
              <EF label="Rate per Litre"  field="fuelRate"     type="number" placeholder="e.g. 102.50"  value={form.fuelRate}     onChange={upd} />
            </div>
          )}
          {form.type === 'parking' && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-teal-50 dark:bg-teal-900/10 rounded-xl border border-teal-100 dark:border-teal-900/30">
              <EF label="Parking Location" field="parkingLocation" placeholder="Airport, Mall, etc." value={form.parkingLocation} onChange={upd} />
              <EF label="Duration (hours)" field="parkingDuration" type="number" placeholder="e.g. 3" value={form.parkingDuration} onChange={upd} />
            </div>
          )}
          {form.type === 'toll' && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30">
              <EF label="Toll Name/Plaza" field="tollName"  placeholder="e.g. Tindivanam Toll" value={form.tollName}  onChange={upd} />
              <EF label="Route"           field="tollRoute" placeholder="e.g. ECR Chennai"     value={form.tollRoute} onChange={upd} />
            </div>
          )}
          {form.type === 'bata' && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
              <EF label="Driver Name"    field="bataDriver" placeholder="Driver name" value={form.bataDriver} onChange={upd} />
              <EF label="Trip Reference" field="bataTrip"   placeholder="BK-XXXX"    value={form.bataTrip}   onChange={upd} />
            </div>
          )}
          {form.type === 'maintenance' && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700/50">
              <EF label="Vendor Name"    field="maintenanceVendor"  placeholder="Workshop/Garage name" value={form.maintenanceVendor}  onChange={upd} />
              <EF label="Invoice Number" field="maintenanceInvoice" placeholder="INV-XXXX"             value={form.maintenanceInvoice} onChange={upd} />
            </div>
          )}

          {/* Receipt attachment */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
              Receipt (Mock — future Google Drive)
            </label>
            <div className="flex gap-2">
              <input type="text" value={form.receiptName || ''} onChange={e => upd('receiptName', e.target.value)}
                placeholder="receipt_filename.jpg" className={`${fieldCls} flex-1`} />
              <Button type="button" variant="secondary" size="sm" icon={Paperclip} className="whitespace-nowrap"
                onClick={() => upd('receiptName', `receipt_${form.type}_${form.date}.jpg`)}>
                Attach
              </Button>
            </div>
            {form.receiptName && (
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                <CheckCircle size={10} /> {form.receiptName}
              </p>
            )}
            <p className="text-[10px] text-slate-400 mt-1">Google Drive integration planned for a future release.</p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Notes</label>
            <textarea value={form.notes || ''} onChange={e => upd('notes', e.target.value)}
              placeholder="Additional details…" rows={2}
              className={`${fieldCls} h-auto py-3 resize-none`} />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[var(--ap-border)] flex gap-2 flex-shrink-0">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="amber" className="flex-1" onClick={handleSave}>
            {isEdit ? 'Save Changes' : isDrv ? 'Submit Expense' : 'Add Expense'}
          </Button>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ─────────────────────────────────────────────────────────────
//  Simple bar chart for category breakdown — Module 9
// ─────────────────────────────────────────────────────────────
function CategoryBar({ expenses }) {
  const summary  = summariseByType(expenses)
  const maxTotal = summary[0]?.total || 1
  return (
    <div className="space-y-3">
      {summary.slice(0, 6).map(t => (
        <div key={t.key}>
          <div className="flex justify-between text-xs mb-1">
            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
              <span>{t.icon}</span>{t.label}
              <span className="text-slate-500 dark:text-slate-400">({t.count})</span>
            </span>
            <span className="font-bold text-amber-600 dark:text-amber-400">Rs. {t.total.toLocaleString('en-IN')}</span>
          </div>
          <div className="h-1.5 bg-[var(--ap-border)] rounded-full overflow-hidden">
            <div className={`h-full rounded-full bg-gradient-to-r ${t.color}`}
              style={{ width: `${Math.round((t.total / maxTotal) * 100)}%`, transition:'width .5s' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Monthly trend sparkline — Module 9
// ─────────────────────────────────────────────────────────────
function TrendBars({ expenses }) {
  // Last 6 months (local YYYY-MM keys — toISOString drifts for IST)
  const months = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const lbl = d.toLocaleString('en-IN', { month: 'short' })
    const tot = expenses.filter(e => (getExpenseDate(e) || '').startsWith(key)).reduce((s,e) => s+(e.amount||0), 0)
    months.push({ key, lbl, tot })
  }
  const max = Math.max(...months.map(m => m.tot), 1)
  return (
    <div className="flex items-end gap-1.5 h-16">
      {months.map((m, i) => {
        const isLast = i === months.length - 1
        const pct    = Math.max(6, Math.round((m.tot / max) * 100))
        return (
          <div key={m.key} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full relative group">
              <div className={`w-full rounded-t-md ${isLast ? 'bg-gradient-to-t from-amber-500 to-amber-400' : 'bg-[var(--ap-border)]'}`}
                style={{ height: `${pct * 0.6}px` }} />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-navy-900 text-white text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap pointer-events-none z-10">
                Rs. {m.tot.toLocaleString('en-IN')}
              </div>
            </div>
            <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400">{m.lbl}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Expense row detail panel
// ─────────────────────────────────────────────────────────────
function ExpenseDetail({ expense, onEdit, onDelete, onApprove, onReject, canEdit, canDelete, canApprove }) {
  const isApproved = expense.status === 'approved'
  const isRejected = expense.status === 'rejected'
  const isDone     = isApproved || isRejected

  return (
    <div className="border-t border-[var(--ap-border)] p-4 bg-[var(--ap-surface-2)] space-y-3">
      {/* Detail grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {[
          { label:'Expense ID', value: expense.id,          mono: true    },
          { label:'Date',       value: expense.date                        },
          { label:'Amount',     value: `Rs. ${expense.amount.toLocaleString('en-IN')}`, hi: true },
          { label:'Driver',     value: expense.driver  || '—'             },
          { label:'Vehicle',    value: expense.vehicle || '—'             },
          { label:'Trip Ref',   value: expense.tripRef || 'None',  mono: true },
          { label:'Added By',   value: expense.addedBy || '—'             },
        ].map(d => (
          <div key={d.label} className="bg-[var(--ap-surface-2)] rounded-xl p-2.5 border border-[var(--ap-border)]">
            <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-0.5">{d.label}</p>
            <p className={`text-xs font-bold leading-tight ${d.mono ? 'font-mono' : ''} ${d.hi ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-200'}`}>
              {d.value}
            </p>
          </div>
        ))}
      </div>

      {expense.notes && (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/15 rounded-lg px-3 py-2.5 border border-amber-100 dark:border-amber-800/30">
          <AlertTriangle size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">{expense.notes}</p>
        </div>
      )}

      {/* Module 5: Receipt */}
      {expense.receiptName && (
        <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/15 rounded-lg px-3 py-2 border border-blue-100 dark:border-blue-800/30">
          <FileText size={12} className="text-blue-500 flex-shrink-0" />
          <span className="text-xs font-medium text-blue-700 dark:text-blue-400 flex-1 truncate">{expense.receiptName}</span>
          <span className="text-[10px] text-blue-500">Stored locally</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap pt-1">
        {/* Module 6: Approval actions */}
        {canApprove && expense.status === 'submitted' && (
          <>
            <Button variant="teal" size="sm" icon={CheckCircle} onClick={() => onApprove(expense)}>Approve</Button>
            <Button variant="danger" size="sm" icon={X} onClick={() => onReject(expense)}>Reject</Button>
          </>
        )}
        {canEdit && !isApproved && (
          <Button variant="secondary" size="sm" icon={Edit2} onClick={() => onEdit(expense)}>Edit</Button>
        )}
        {canDelete && !isApproved && (
          <Button variant="danger" size="sm" icon={Trash2} onClick={() => onDelete(expense.id)}>Delete</Button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Main Expenses Page
// ─────────────────────────────────────────────────────────────
export default function Expenses() {
  const { user, isAdmin, isManager, isDriver } = useAuth()
  const { toast } = useToast()

  const canAdd     = true          // all roles can add (drivers: limited types)
  const canEdit    = isAdmin || isManager
  const canDelete  = isAdmin
  const canApprove = isAdmin || isManager

  const [expenses,   setExpenses]  = useState([])
  const [drivers,    setDrivers]   = useState([])
  const [vehicles,   setVehicles]  = useState([])
  const [loading,    setLoading]   = useState(true)
  const [search,     setSearch]    = useState('')
  const [typeFilter, setTypeFilter]= useState('all')
  const [statFilter, setStatFilter]= useState('all')
  const [dateRange,  setDateRange] = useState('month')  // today | week | month | all
  const [expanded,   setExpanded]  = useState(null)
  const [showAdd,    setShowAdd]   = useState(false)
  const [editExp,    setEditExp]   = useState(null)
  const [page,       setPage]      = useState(1)
  const [goPage,     setGoPage]    = useState('')
  const [showAnalytics, setShowAnalytics] = useState(false)

  // ── Pagination: zoom-adaptive rows per page ─────────────────
  // 90% → 6 · 100% → 5 · 110%+ → 4 (phones stay at 5).
  const [pageSize, setPageSize] = useState(() => pageSizeFor(5, 5))
  useEffect(() => {
    const onResize = () => {
      setPageSize(prev => {
        const next = pageSizeFor(5, 5)
        if (next !== prev) setPage(1)
        return next
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const showToast = msg => { toast?.({ type: 'success', title: msg }) }
  const showError = msg => { toast?.({ type: 'error', title: msg }) }
  const [loadError, setLoadError] = useState(null)
  const reload = async () => {
    setLoading(true)
    try {
      const [e, d, v] = await Promise.allSettled([
        loadExpenses(), loadDrivers(), loadVehicles(),
      ])
      setExpenses(e.status === 'fulfilled' && Array.isArray(e.value) ? e.value : [])
      setDrivers( d.status === 'fulfilled' && Array.isArray(d.value) ? d.value : [])
      setVehicles(v.status === 'fulfilled' && Array.isArray(v.value) ? v.value : [])
      if (e.status === 'rejected') {
        console.error('[Expenses] load failed:', e.reason)
        setLoadError('Could not load expenses. Try refreshing.')
      } else {
        setLoadError(null)
      }
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { reload() }, [])

  // Driver sees only their own expenses — Module 7
  const myExpenses = isDriver
    ? expenses.filter(e => e.addedBy === user?.username || e.addedBy === user?.name || e.driver === user?.name)
    : expenses

  // Date range filter
  const rangeFiltered = useMemo(() => myExpenses.filter(e => {
    if (dateRange === 'today') return isToday(e)
    if (dateRange === 'week')  return isThisWeek(e)
    if (dateRange === 'month') return isThisMonth(e)
    return true
  }), [myExpenses, dateRange])

  // Search + type + status filter
  const filtered = useMemo(() => {
    return rangeFiltered.filter(e => {
      const q = search.toLowerCase()
      const matchSearch = !q || e.description?.toLowerCase().includes(q)
        || e.driver?.toLowerCase().includes(q)
        || e.vehicle?.toLowerCase().includes(q)
        || e.tripRef?.toLowerCase().includes(q)
        || e.id?.toLowerCase().includes(q)
      const matchType = typeFilter === 'all' || e.type === typeFilter
      const matchStat = statFilter === 'all' || e.status === statFilter
      return matchSearch && matchType && matchStat
    })
  }, [rangeFiltered, search, typeFilter, statFilter])

  // Pagination: zoom-adaptive rows per page + go-to-page
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const paginated = filtered.slice((safePage-1)*pageSize, safePage*pageSize)
  useEffect(() => { setPage(1) }, [search, typeFilter, statFilter, dateRange, filtered.length, pageSize])

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

  // Summary totals for dashboard (Module 1)
  const totalAmt     = rangeFiltered.reduce((s,e) => s + e.amount, 0)
  const fuelAmt      = rangeFiltered.filter(e=>e.type==='fuel').reduce((s,e)=>s+e.amount,0)
  const bataAmt      = rangeFiltered.filter(e=>e.type==='bata').reduce((s,e)=>s+e.amount,0)
  const tollAmt      = rangeFiltered.filter(e=>e.type==='toll').reduce((s,e)=>s+e.amount,0)
  const parkAmt      = rangeFiltered.filter(e=>e.type==='parking').reduce((s,e)=>s+e.amount,0)
  const pendingCount = rangeFiltered.filter(e=>e.status==='submitted').length

  const handleSave = async (exp) => {
    try {
      await saveExpense(exp)
      addAuditEvent('EXPENSE_ADDED', {
        description: `${exp.type} — Rs. ${(exp.amount||0).toLocaleString('en-IN')} by ${exp.driver || 'Staff'}`,
        driver: exp.driver,
      })
      await reload()
      setShowAdd(false)
      setEditExp(null)
      showToast(editExp ? 'Expense updated' : 'Expense added')
      setPage(1)
    } catch (err) {
      console.error('[Expenses] save failed:', err)
      showError('Could not save expense. Please try again.')
    }
  }

  const handleDelete = async id => {
    if (!window.confirm('Delete this expense?')) return
    try {
      await deleteExpense(id)
      await reload()
      setExpanded(null)
      showToast('Expense deleted')
    } catch (err) {
      console.error('[Expenses] delete failed:', err)
      showError('Could not delete expense. Please try again.')
    }
  }

  const handleApprove = async exp => {
    try {
      await saveExpense({ ...exp, status: 'approved', updatedAt: new Date().toISOString() })
      await reload()
      showToast(`${exp.id} approved`)
    } catch (err) {
      console.error('[Expenses] approve failed:', err)
      showError('Could not approve expense. Please try again.')
    }
  }

  const handleReject = async exp => {
    try {
      await saveExpense({ ...exp, status: 'rejected', updatedAt: new Date().toISOString() })
      await reload()
      showToast(`${exp.id} rejected`)
    } catch (err) {
      console.error('[Expenses] reject failed:', err)
      showError('Could not reject expense. Please try again.')
    }
  }

  // Compact density fits one screen at 100% zoom; the page flows
  // naturally (sticky pagination included) so 90–110% zoom never clips.
  return (
    <div className="space-y-3 md:space-y-2 animate-fade-up">
      <PageHeader compact
        title={isDriver ? 'My Expenses' : 'Expense Management'}
        subtitle={isDriver ? 'Submit and track your expenses' : 'Operational cost tracker & approval'}
        action={
          <Button variant="amber" icon={Plus} onClick={() => setShowAdd(true)}>
            {isDriver ? 'Submit Expense' : 'Add Expense'}
          </Button>
        }
      />

      {loadError && (
        <Callout tone="red" icon={AlertTriangle} title={loadError} actionLabel="Retry" onAction={reload} />
      )}

      {pendingCount > 0 && canApprove && (
        <Callout
          tone="blue"
          icon={Receipt}
          title={`${pendingCount} expense${pendingCount!==1?'s':''} awaiting approval`}
          actionLabel="Review"
          onAction={() => setStatFilter('submitted')}
        />
      )}

      {/* Date range tabs + analytics toggle in one row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <SegmentedControl
          ariaLabel="Date range"
          value={dateRange}
          onChange={k => { setDateRange(k); setPage(1) }}
          options={[
            { key: 'today', label: 'Today' },
            { key: 'week',  label: 'This Week' },
            { key: 'month', label: 'This Month' },
            { key: 'all',   label: 'All Time' },
          ]}
        />
        <Button variant="outline" size="sm" icon={showAnalytics ? ChevronUp : ChevronDown}
          onClick={() => setShowAnalytics(v => !v)}>Analytics</Button>
      </div>

      {/* KPI strip — one row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
        <MetricCard label="Total"   value={`Rs. ${(totalAmt/1000).toFixed(1)}k`} icon={Receipt} tone="amber" />
        <MetricCard label="Fuel"    value={`Rs. ${(fuelAmt/1000).toFixed(1)}k`}  icon={Car} tone="amber" />
        <MetricCard label="Toll"    value={`Rs. ${tollAmt.toLocaleString('en-IN')}`} icon={FileText} tone="blue" />
        <MetricCard label="Parking" value={`Rs. ${parkAmt.toLocaleString('en-IN')}`} icon={Calendar} tone="teal" />
        <MetricCard label="Bata"    value={`Rs. ${bataAmt.toLocaleString('en-IN')}`} icon={User} tone="green" />
        <MetricCard label="Entries" value={rangeFiltered.length} icon={BarChart3} tone="gray" />
      </div>

      {/* Module 9: Analytics (collapsible — keeps the page to one screen) */}
      {showAnalytics && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Category breakdown */}
        <div className="ap-surface rounded-2xl p-5">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">By Category</p>
          <h3 className="font-sf font-semibold text-slate-800 dark:text-white text-base mb-4">Breakdown</h3>
          {rangeFiltered.length > 0
            ? <CategoryBar expenses={rangeFiltered} />
            : <p className="text-xs text-slate-400 text-center py-4">No expenses in this period</p>
          }
        </div>

        {/* Trend */}
        <div className="ap-surface rounded-2xl p-5">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Monthly Trend</p>
          <h3 className="font-sf font-semibold text-slate-800 dark:text-white text-base mb-4">6-Month View</h3>
          <TrendBars expenses={myExpenses} />
          <div className="mt-3 pt-3 border-t border-[var(--ap-border)] flex justify-between text-xs">
            <span className="text-slate-500">This month</span>
            <span className="font-bold text-amber-600 dark:text-amber-400">
              Rs. {myExpenses.filter(e=>isThisMonth(e)).reduce((s,e)=>s+e.amount,0).toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Top categories */}
        <div className="ap-surface rounded-2xl p-5">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Top Categories</p>
          <h3 className="font-sf font-semibold text-slate-800 dark:text-white text-base mb-4">All Time</h3>
          <div className="space-y-2.5">
            {summariseByType(myExpenses).slice(0, 5).map((t, i) => (
              <div key={t.key} className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-lg bg-[var(--ap-surface-2)] flex items-center justify-center text-xs flex-shrink-0">
                  {i + 1}
                </span>
                <span className="text-sm flex-shrink-0">{t.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{t.label}</p>
                  <p className="text-[10px] text-slate-400">{t.count} entries</p>
                </div>
                <p className="text-xs font-bold text-amber-600 dark:text-amber-400 flex-shrink-0">
                  Rs. {t.total.toLocaleString('en-IN')}
                </p>
              </div>
            ))}
            {summariseByType(myExpenses).length === 0 && (
              <p className="text-xs text-slate-400 text-center py-4">No expense data yet</p>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Module 3: Expense list */}
      <div className="ap-surface rounded-[20px] overflow-hidden">
        {/* List controls — single slim row */}
        <div className="px-3 py-2 border-b border-[var(--ap-border)] flex items-center gap-2 flex-wrap">
          <h3 className="font-sf font-semibold text-slate-800 dark:text-white text-sm tabular-nums">
            {filtered.length} Expenses
          </h3>
          <div className="relative flex-1 min-w-[140px] max-w-[240px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input type="text" value={search} onChange={e=>{ setSearch(e.target.value); setPage(1) }}
              placeholder="Search…" aria-label="Search expenses"
              className={`${fieldCls} pl-9`} />
          </div>
          <div className="w-[150px]">
            <FieldSelect value={typeFilter} onChange={e=>{ setTypeFilter(e.target.value); setPage(1) }} aria-label="Filter by type">
              <option value="all">All Types</option>
              {EXPENSE_TYPES.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
            </FieldSelect>
          </div>
          <SegmentedControl
            ariaLabel="Filter by approval status"
            value={statFilter}
            onChange={k => { setStatFilter(k); setPage(1) }}
            options={[
              { key:'all',       label:`All ${rangeFiltered.length}` },
              { key:'submitted', label:`Pending ${rangeFiltered.filter(e=>e.status==='submitted').length}` },
              { key:'approved',  label:`Approved ${rangeFiltered.filter(e=>e.status==='approved').length}` },
              { key:'rejected',  label:`Rejected ${rangeFiltered.filter(e=>e.status==='rejected').length}` },
            ]}
          />
        </div>

        {/* Expense rows */}
        {loading ? (
          <div className="p-3 space-y-2" role="status" aria-busy="true" aria-label="Loading expenses">
            <span className="sr-only">Loading expenses…</span>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="flex items-center gap-2.5" aria-hidden="true">
                <div className="skeleton w-8 h-8 rounded-[10px] flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton h-3.5 w-1/3 rounded" />
                  <div className="skeleton h-3 w-2/3 rounded" />
                </div>
                <div className="space-y-1.5 flex flex-col items-end flex-shrink-0">
                  <div className="skeleton h-4 w-14 rounded" />
                  <div className="skeleton h-5 w-16 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : paginated.length === 0 ? (
          <EmptyState icon={TrendingDown} title="No expenses found" description="Try adjusting your filters or add a new expense." />
        ) : (
          <div>
            {paginated.map(exp => {
              const isOpen  = expanded === exp.id
              const typeCfg = getExpTypeCfg(exp.type)
              return (
                <div key={exp.id} className="border-b border-[var(--ap-border)] last:border-0">
                  {/* Row */}
                  <div className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-amber-50/30 hover:bg-[var(--ap-surface-2)] transition-colors select-none"
                       onClick={() => setExpanded(isOpen ? null : exp.id)}>
                    {/* Type icon */}
                    <div className={`w-8 h-8 rounded-[10px] bg-gradient-to-br ${typeCfg.color} flex items-center justify-center text-base flex-shrink-0 shadow-sm`}>
                      {typeCfg.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-slate-700 dark:text-slate-200 truncate">{exp.description || typeCfg.label}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate leading-tight mt-0.5 tabular-nums">
                        {exp.date}{exp.driver ? ` · ${exp.driver}` : ''}{exp.tripRef ? ` · ${exp.tripRef}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex flex-col items-end gap-1">
                        <p className="text-[13px] font-semibold text-amber-600 dark:text-amber-400 tabular-nums whitespace-nowrap">
                          Rs. {exp.amount.toLocaleString('en-IN')}
                        </p>
                        <ApprovalBadge status={exp.status} />
                      </div>
                      {exp.receiptName && <Paperclip size={12} className="text-blue-500 flex-shrink-0" aria-label="Has receipt" />}
                      {isOpen ? <ChevronUp size={13} className="text-slate-400 flex-shrink-0" />
                               : <ChevronDown size={13} className="text-slate-400 flex-shrink-0" />}
                    </div>
                  </div>

                  {isOpen && (
                    <ExpenseDetail
                      expense={exp}
                      onEdit={setEditExp}
                      onDelete={handleDelete}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      canApprove={canApprove}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Pagination — 5 per page (hidden while a row is open) */}
      {!loading && filtered.length > 0 && !expanded && (
      <div className="mt-3 mb-1 rounded-2xl border border-[var(--ap-border)] ap-surface px-2.5 sm:px-3 py-2 flex items-center justify-between gap-2 sm:gap-3 flex-wrap shadow-lg">
        <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
          Page {safePage} of {totalPages} · {filtered.length} expense{filtered.length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-1 sm:gap-1.5">
          <button onClick={() => setPage(safePage - 1)} disabled={safePage <= 1}
            aria-label="Previous page"
            className="min-w-[32px] min-h-[32px] sm:min-w-[36px] sm:min-h-[36px] px-2 sm:px-2.5 rounded-[10px] sm:rounded-[12px] border border-[var(--ap-border)] text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-[var(--ap-surface-2)] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            ←
          </button>
          <span className="hidden sm:contents">
          {pageItems.map((n, i) => n === '…'
            ? <span key={`e${i}`} className="text-xs text-slate-400 px-1">…</span>
            : (
              <button key={n} onClick={() => setPage(n)}
                aria-label={`Go to page ${n}`}
                aria-current={n === safePage ? 'page' : undefined}
                className={`min-w-[36px] min-h-[36px] px-2.5 rounded-[12px] text-xs font-bold tabular-nums active:scale-95 transition-all ${
                  n === safePage
                    ? 'bg-[var(--ap-accent)] text-white shadow'
                    : 'border border-[var(--ap-border)] text-slate-600 dark:text-slate-300 hover:bg-[var(--ap-surface-2)]'
                }`}>
                {n}
              </button>
            ))}
          </span>
          <button onClick={() => setPage(safePage + 1)} disabled={safePage >= totalPages}
            aria-label="Next page"
            className="min-w-[32px] min-h-[32px] sm:min-w-[36px] sm:min-h-[36px] px-2 sm:px-2.5 rounded-[10px] sm:rounded-[12px] border border-[var(--ap-border)] text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-[var(--ap-surface-2)] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            →
          </button>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-0.5 sm:ml-1">Go to</span>
          <input
            value={goPage}
            onChange={e => setGoPage(e.target.value.replace(/[^0-9]/g, ''))}
            onKeyDown={e => { if (e.key === 'Enter') goToPage() }}
            onBlur={() => { if (goPage) goToPage() }}
            placeholder={String(totalPages)}
            inputMode="numeric"
            aria-label={`Go to page, 1 to ${totalPages}`}
            className="w-12 sm:w-14 min-h-[32px] sm:min-h-[36px] rounded-[10px] sm:rounded-[12px] border border-[var(--ap-border)] bg-[var(--ap-surface-2)] px-2 text-center text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 tabular-nums"
          />
        </div>
      </div>
      )}

      {/* Modals */}
      {(showAdd || editExp) && (
        <ExpenseModal
          expense={editExp}
          drivers={drivers}
          vehicles={vehicles}
          onClose={() => { setShowAdd(false); setEditExp(null) }}
          onSave={handleSave}
          currentUser={user}
          isDriver={isDriver}
        />
      )}
    </div>
  )
}

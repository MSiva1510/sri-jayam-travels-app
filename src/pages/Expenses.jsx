import { useState, useEffect, useMemo } from 'react'
import {
  Plus, Search, ChevronDown, ChevronUp,
  X, Edit2, Trash2, CheckCircle, AlertTriangle,
  Receipt, Calendar, User, Car, FileText,
  TrendingDown, BarChart3, Paperclip, Eye,
} from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import ExpenseModal from '../components/expenses/ExpenseModal'
import Button     from '../components/ui/Button'
import MetricCard from '../components/ui/MetricCard'
import StatusPill from '../components/ui/StatusPill'
import Callout    from '../components/ui/Callout'
import EmptyState from '../components/ui/EmptyState'
import SegmentedControl from '../components/ui/SegmentedControl'
import SparkChart from '../components/ui/SparkChart'
import { fieldCls, Select as FieldSelect } from '../components/ui/Field'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../context/AuthContext'
import {
  loadExpenses, saveExpense, deleteExpense,
  EXPENSE_TYPES, getExpTypeCfg, getApprovalCfg,
  isToday, isThisWeek, isThisMonth,
  summariseByType, getExpenseDate,
} from '../data/expenseData'
import { loadDrivers } from '../data/driverData'
import { loadVehicles } from '../data/vehicleData'
import { addAuditEvent } from '../data/auditLogData'
import { pageSizeFor } from '../utils/zoomPageSize'
import supabase from '../lib/supabase'

// ── Receipt storage ───────────────────────────────────────────
// Bills go to the private `expense-bills` bucket; the row keeps the file
// name and a long-lived signed link (the bucket is not public).
const RECEIPT_BUCKET = 'expense-bills'
const RECEIPT_TTL     = 60 * 60 * 24 * 365

async function uploadReceipt(file) {
  if (!supabase) throw new Error('Supabase is not configured')
  const ext  = (file.name.split('.').pop() || 'bin').toLowerCase()
  const path = `${new Date().getFullYear()}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || undefined })
  if (error) throw new Error(error.message || 'Receipt upload failed')

  const { data, error: signError } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .createSignedUrl(path, RECEIPT_TTL)
  if (signError || !data?.signedUrl) throw new Error(signError?.message || 'Could not create a receipt link')
  return { url: data.signedUrl, name: file.name }
}

// ─────────────────────────────────────────────────────────────
//  Shared badges
// ─────────────────────────────────────────────────────────────
const APPROVAL_TONE = { pending: 'blue', approved: 'green', rejected: 'red' }

function ApprovalBadge({ status }) {
  const cfg = getApprovalCfg(status)
  return <StatusPill tone={APPROVAL_TONE[status] || 'gray'}>{cfg.label}</StatusPill>
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
//  Monthly trend area — Module 9 (house area-chart style)
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
  if (months.every(m => m.tot === 0)) {
    return <p className="text-xs text-slate-400 text-center py-4">No expenses in this period</p>
  }
  return (
    <SparkChart data={months} valueKey="tot" labelKey="lbl" height={110} accent="#f59e0b"
      format={(v) => `Rs. ${Number(v || 0).toLocaleString('en-IN')}`} />
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
          { label:'Expense ID', value: expense.expenseNo || String(expense.id).slice(0, 8), mono: true    },
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
          {expense.receiptUrl ? (
            <a href={expense.receiptUrl} target="_blank" rel="noopener noreferrer"
              className="text-[10px] font-bold text-blue-600 dark:text-blue-400 underline flex items-center gap-1 flex-shrink-0">
              <Eye size={11} /> View
            </a>
          ) : (
            <span className="text-[10px] text-slate-400 flex-shrink-0">No file</span>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap pt-1">
        {/* Module 6: Approval actions */}
        {canApprove && expense.status === 'pending' && (
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
  // 90% → 5 · 100% → 4 · 110%+ → 3 (phones stay at 5).
  const [pageSize, setPageSize] = useState(() => pageSizeFor(4, 5))
  useEffect(() => {
    const onResize = () => {
      setPageSize(prev => {
        const next = pageSizeFor(4, 5)
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
  const pendingCount = rangeFiltered.filter(e=>e.status==='pending').length

  const handleSave = async (exp) => {
    try {
      await saveExpense(exp)
      // Editing an existing bill is an update, not a new expense.
      addAuditEvent(editExp ? 'EXPENSE_UPDATED' : 'EXPENSE_ADDED', {
        description: editExp
          ? `${exp.type} — Rs. ${(exp.amount||0).toLocaleString('en-IN')} updated by ${exp.driver || 'Staff'}`
          : `${exp.type} — Rs. ${(exp.amount||0).toLocaleString('en-IN')} by ${exp.driver || 'Staff'}`,
        driver: exp.driver,
      })
      await reload()
      // The modal owns its exit animation and calls onClose when it finishes.
      showToast(editExp ? 'Expense updated' : 'Expense added')
      setPage(1)
    } catch (err) {
      console.error('[Expenses] save failed:', err)
      showError('Could not save expense. Please try again.')
      throw err
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
          onAction={() => setStatFilter('pending')}
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
              { key:'pending', label:`Pending ${rangeFiltered.filter(e=>e.status==='pending').length}` },
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
          existingExpenses={expenses}
          onClose={() => { setShowAdd(false); setEditExp(null) }}
          onSave={handleSave}
          currentUser={user}
          isDriver={isDriver}
          uploadReceipt={uploadReceipt}
        />
      )}
    </div>
  )
}


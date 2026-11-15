// ─── Audit Log Page ───────────────────────────────────────────
// Displays audit events from Supabase `audit_logs` on the app's design table
// (same surface / header / pagination language as Communications & Expenses).

import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react'
import PageHeader from '../components/ui/PageHeader'
import {
  Search as SearchIcon, RefreshCw, ChevronLeft, ChevronRight, AlertTriangle,
} from 'lucide-react'
import { AUDIT_ACTIONS, fmtAuditTime, loadAuditEventsFromDB } from '../data/auditLogData'

const FALLBACK_ROW_H  = 52   // desktop row height until a real row is measured
const FALLBACK_CARD_H = 96   // mobile card height until a real card is measured
const SAFE_GAP        = 10   // breathing room above the bottom edge (px)
const MIN_ROWS        = 3
const MAX_ROWS        = 40

// Rows per page are driven by the *actual rendered layout* instead of guessed
// chrome heights: after every render we compare the bottom of the pagination bar
// with the bottom of the scroll viewport (`main`) and grow/shrink the page size
// until the pager sits exactly inside it. That guarantees one screen with no
// vertical scrollbar at any zoom (90 / 100 / 110 %), window size or font scale.
function useFitRows({ rootRef, pagerRef, signature, total }) {
  const [rows, setRows] = useState(8)
  const triesRef  = useRef(0)
  const sigRef    = useRef(signature)

  useLayoutEffect(() => {
    const root  = rootRef.current
    const pager = pagerRef.current
    const main  = root?.closest('main')
    if (!root || !pager || !main) return

    if (sigRef.current !== signature) {
      sigRef.current = signature
      triesRef.current = 0
    }
    if (triesRef.current > 12) return

    const mobile = window.innerWidth < 768
    const rowSel = mobile ? '[data-audit-card]' : '[data-audit-row]'
    const rowEl  = root.querySelector(rowSel)
    const rowH   = rowEl ? rowEl.getBoundingClientRect().height : (mobile ? FALLBACK_CARD_H : FALLBACK_ROW_H)
    if (!rowH || rowH < 20) return
    const shown = root.querySelectorAll(rowSel).length

    // Scroll-relative maths: both rects move together when `main` scrolls.
    const slack = (main.getBoundingClientRect().bottom - SAFE_GAP)
      - pager.getBoundingClientRect().bottom
      - main.scrollTop

    setRows(prev => {
      let next = prev
      if (slack < -1) {
        next = prev - Math.max(1, Math.ceil(-slack / rowH))
      } else if (shown >= prev && slack >= rowH) {
        // Only grow on a full page — a short last page would otherwise make the
        // table look empty and send the count back up every render.
        next = prev + Math.floor(slack / rowH)
      }
      next = Math.max(MIN_ROWS, Math.min(MAX_ROWS, next, Math.max(MIN_ROWS, total || MIN_ROWS)))

      if (next === prev) { triesRef.current = 0; return prev }
      triesRef.current += 1
      return next
    })
  })

  return rows
}

const SEV_CFG = {
  info:     { label: 'Info',     badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',       dot: 'bg-blue-500'    },
  warning:  { label: 'Warning',  badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',   dot: 'bg-amber-500'   },
  error:    { label: 'Error',    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',           dot: 'bg-red-500'     },
  critical: { label: 'Critical', badge: 'bg-red-200 text-red-800 dark:bg-red-900/60 dark:text-red-200',           dot: 'bg-red-600'     },
}

const selCls = 'px-3 py-2 rounded-lg text-xs font-bold border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-600 dark:text-slate-300 outline-none focus:border-blue-500 cursor-pointer'

export default function AuditLog() {
  const [events, setEvents]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [fromCache, setFromCache] = useState(false)
  const [search, setSearch]     = useState('')
  const [moduleFilter, setModuleFilter] = useState('all')
  const [sevFilter, setSevFilter]       = useState('all')
  const [page, setPage]         = useState(1)
  const [goPage, setGoPage]     = useState('')

  const rootRef  = useRef(null)
  const pagerRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, fromCache: cached, error: err } = await loadAuditEventsFromDB(200)
    setEvents(Array.isArray(data) ? data : [])
    setFromCache(cached)
    setError(err)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const modules = useMemo(
    () => [...new Set(events.map(e => e.module).filter(Boolean))].sort(),
    [events]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return events.filter(e => {
      if (moduleFilter !== 'all' && e.module !== moduleFilter) return false
      if (sevFilter !== 'all' && (e.severity || 'info') !== sevFilter) return false
      if (!q) return true
      return [
        e.action,
        AUDIT_ACTIONS[e.action]?.label,
        e.module,
        e.user_name,
        e.changed_by,
        e.table_name,
        e.record_id,
        e.new_values?.description,
      ].filter(Boolean).some(v => String(v).toLowerCase().includes(q))
    })
  }, [events, search, moduleFilter, sevFilter])

  const rowsPerPage = useFitRows({
    rootRef, pagerRef,
    total: filtered.length,
    signature: `${loading}|${filtered.length}|${moduleFilter}|${sevFilter}|${search}`,
  })

  useEffect(() => { setPage(1); setGoPage('') }, [search, moduleFilter, sevFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage))
  const safePage   = Math.min(Math.max(1, page), totalPages)
  const pageRows   = filtered.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage)
  const from       = filtered.length === 0 ? 0 : (safePage - 1) * rowsPerPage + 1
  const to         = Math.min(safePage * rowsPerPage, filtered.length)

  const pageNums = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    return [...new Set([1, safePage - 1, safePage, safePage + 1, totalPages])]
      .filter(p => p >= 1 && p <= totalPages)
      .sort((a, b) => a - b)
  }, [totalPages, safePage])

  const goToPage = () => {
    const n = Number(goPage)
    if (Number.isInteger(n) && n >= 1 && n <= totalPages) setPage(n)
    setGoPage('')
  }

  const hasFilters = search || moduleFilter !== 'all' || sevFilter !== 'all'
  const clearFilters = () => { setSearch(''); setModuleFilter('all'); setSevFilter('all') }

  return (
    <div ref={rootRef} className="space-y-4 animate-fade-up">
      <PageHeader
        title="Audit Log"
        subtitle={`${events.length} recent event${events.length === 1 ? '' : 's'}${fromCache ? ' · showing cached copy' : ''}`}
        action={
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-600 dark:text-slate-300 hover:opacity-80 active:scale-95 transition-all disabled:opacity-50">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />

      {error && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs font-semibold text-amber-800 dark:text-amber-300">
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
          Live audit log is unavailable right now ({error}).
        </div>
      )}

      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--ap-border)] bg-[var(--ap-surface-2)] flex-1 min-w-[180px] max-w-xs">
          <SearchIcon size={13} className="text-slate-400 flex-shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search action, user, module…"
            aria-label="Search audit events"
            className="bg-transparent text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none w-full" />
        </div>
        <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)} aria-label="Filter by module" className={selCls}>
          <option value="all">All Modules</option>
          {modules.map(m => <option key={m} value={m}>{prettyModule(m)}</option>)}
        </select>
        <select value={sevFilter} onChange={e => setSevFilter(e.target.value)} aria-label="Filter by severity" className={selCls}>
          <option value="all">All Severity</option>
          {Object.entries(SEV_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {hasFilters && (
          <button onClick={clearFilters}
            className="px-3 py-2 text-xs font-bold rounded-lg text-slate-500 hover:bg-[var(--ap-surface-2)] transition-colors">
            Clear
          </button>
        )}
      </div>

      {/* Table / states */}
      <div>
        {loading ? (
          <SkeletonRows n={Math.min(rowsPerPage, 6)} />
        ) : filtered.length === 0 ? (
          <div className="ap-surface rounded-2xl p-10 text-center">
            <div className="text-3xl mb-2 opacity-60">🗂️</div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
              {hasFilters ? 'No events match these filters' : 'No audit events yet'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {hasFilters ? 'Try clearing search or choosing a different filter.' : 'System activity appears here as it happens.'}
            </p>
          </div>
        ) : (<>
          {/* Desktop table */}
          <div className="ap-surface rounded-2xl overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--ap-surface-2)]/95 border-b border-[var(--ap-border)]">
                    {['#', 'Time', 'Action', 'Module', 'User', 'Severity', 'Description'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((e, i) => {
                    const def = AUDIT_ACTIONS[e.action]
                    return (
                      <tr key={e.id || i} data-audit-row
                        className="border-b border-[var(--ap-border)] last:border-0 hover:bg-[var(--ap-surface-2)] transition-colors">
                        <td className="px-3 py-2.5 text-xs text-slate-400 tabular-nums">{(safePage - 1) * rowsPerPage + i + 1}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="block text-xs font-semibold text-slate-600 dark:text-slate-300">{fmtAuditTime(e.changed_at || e.timestamp)}</span>
                          <span className="block text-[10px] text-slate-400 tabular-nums">{fmtDateTime(e.changed_at || e.timestamp)}</span>
                        </td>
                        <td className="px-3 py-2.5 max-w-[220px]">
                          <span className="flex items-center gap-1.5">
                            <span className="text-[13px]" aria-hidden="true">{def?.icon || '📌'}</span>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{def?.label || prettyAction(e.action)}</span>
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          {e.module
                            ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize bg-[var(--ap-surface-2)] text-slate-500 dark:text-slate-400">{e.module}</span>
                            : <span className="text-xs text-slate-400">—</span>}
                        </td>
                        <td className="px-3 py-2.5 max-w-[150px]">
                          <span className="block text-xs text-slate-600 dark:text-slate-300 truncate">{e.user_name || e.changed_by || '—'}</span>
                        </td>
                        <td className="px-3 py-2.5"><SeverityBadge severity={e.severity} /></td>
                        <td className="px-3 py-2.5 max-w-[380px]">
                          <span className="block text-xs text-slate-600 dark:text-slate-300 truncate">
                            {e.new_values?.description || e.description || e.table_name || '—'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {pageRows.map((e, i) => {
              const def = AUDIT_ACTIONS[e.action]
              return (
                <div key={e.id || i} data-audit-card className="ap-surface rounded-2xl p-3.5">
                  <div className="flex items-start gap-2.5">
                    <span className="w-8 h-8 rounded-[10px] bg-[var(--ap-surface-2)] flex items-center justify-center text-[13px] flex-shrink-0">
                      {def?.icon || '📌'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{def?.label || prettyAction(e.action)}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {e.new_values?.description || e.description || e.table_name || '—'}
                      </p>
                    </div>
                    <SeverityBadge severity={e.severity} />
                  </div>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    {e.module && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize bg-[var(--ap-surface-2)] text-slate-500 dark:text-slate-400">{e.module}</span>
                    )}
                    <span className="text-[10px] text-slate-400 truncate">{e.user_name || e.changed_by || 'System'}</span>
                    <span className="text-[10px] text-slate-400 ml-auto tabular-nums">{fmtAuditTime(e.changed_at || e.timestamp)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </>)}
      </div>

      {/* Pagination */}
      {!loading && filtered.length > 0 && (
        <div ref={pagerRef} className="rounded-2xl border border-[var(--ap-border)] ap-surface px-2.5 sm:px-3 py-2 flex items-center justify-between gap-2 sm:gap-3 flex-wrap shadow-lg">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            Showing {from}–{to} of {filtered.length} event{filtered.length !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-1 sm:gap-1.5">
            <button onClick={() => setPage(safePage - 1)} disabled={safePage <= 1} aria-label="Previous page"
              className="min-w-[32px] min-h-[32px] sm:min-w-[36px] sm:min-h-[36px] px-2 rounded-[10px] sm:rounded-[12px] border border-[var(--ap-border)] text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-[var(--ap-surface-2)] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronLeft size={14} />
            </button>
            <span className="hidden sm:contents">
              {pageNums.map((n, i) => {
                const gap = i > 0 && n - pageNums[i - 1] > 1
                return (
                  <span key={n} className="contents">
                    {gap && <span className="text-xs text-slate-400 px-1">…</span>}
                    <button onClick={() => setPage(n)} aria-label={`Go to page ${n}`}
                      aria-current={n === safePage ? 'page' : undefined}
                      className={`min-w-[36px] min-h-[36px] px-2.5 rounded-[12px] text-xs font-bold tabular-nums active:scale-95 transition-all ${
                        n === safePage
                          ? 'bg-[var(--ap-accent)] text-white shadow'
                          : 'border border-[var(--ap-border)] text-slate-600 dark:text-slate-300 hover:bg-[var(--ap-surface-2)]'
                      }`}>
                      {n}
                    </button>
                  </span>
                )
              })}
            </span>
            <span className="sm:hidden text-[11px] font-bold text-slate-500 dark:text-slate-400 tabular-nums px-1">
              {safePage} / {totalPages}
            </span>
            <button onClick={() => setPage(safePage + 1)} disabled={safePage >= totalPages} aria-label="Next page"
              className="min-w-[32px] min-h-[32px] sm:min-w-[36px] sm:min-h-[36px] px-2 rounded-[10px] sm:rounded-[12px] border border-[var(--ap-border)] text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-[var(--ap-surface-2)] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronRight size={14} />
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
    </div>
  )
}

function SeverityBadge({ severity }) {
  const cfg = SEV_CFG[severity] || SEV_CFG.info
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} aria-hidden="true" />
      {cfg.label}
    </span>
  )
}

function SkeletonRows({ n = 6 }) {
  return (
    <div className="ap-surface rounded-2xl overflow-hidden">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-[var(--ap-border)] last:border-0">
          <div className="h-3 w-6 rounded skeleton" />
          <div className="h-8 w-8 rounded-[10px] skeleton flex-shrink-0" />
          <div className="flex-1 space-y-1.5"><div className="h-3 w-40 rounded skeleton" /><div className="h-2 w-24 rounded skeleton" /></div>
          <div className="h-5 w-16 rounded-full skeleton" />
        </div>
      ))}
    </div>
  )
}

function fmtDateTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  } catch { return '' }
}

function prettyAction(action) {
  if (!action) return 'Activity'
  return String(action)
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function prettyModule(module) {
  if (!module) return ''
  return String(module)
    .split(/[_\s]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

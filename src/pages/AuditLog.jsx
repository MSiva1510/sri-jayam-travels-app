// ─── Audit Log Page ───────────────────────────────────────────
// Displays audit events from Supabase `audit_logs` table.

import { useState, useEffect, useMemo, useCallback } from 'react'
import PageHeader from '../components/ui/PageHeader'
import { pageSizeForZoom } from '../utils/zoomPageSize'
import { Search as SearchIcon } from 'lucide-react'
import {
  AUDIT_ACTIONS, SEVERITY, fmtAuditTime,
  loadAuditEventsFromDB,
} from '../data/auditLogData'
import { fieldCls, Select as FieldSelect } from '../components/ui/Field'

export default function AuditLog() {
  const [events, setEvents]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [fromCache, setFromCache] = useState(false)
  const [search, setSearch]     = useState('')
  const [moduleFilter, setModuleFilter] = useState('all')
  const [page, setPage]           = useState(1)
  // Base rows at 100% zoom — browser zoom adjusts ±1 row per 10% step
  // (+1 per 10% zoomed out, −1 per 10% zoomed in) via resize listener.
  const [baseSize, setBaseSize]   = useState(7)
  const [pageSize, setPageSize]   = useState(() => pageSizeForZoom(7))
  const [goTo, setGoTo]           = useState('')

  useEffect(() => {
    setPageSize(pageSizeForZoom(baseSize))
    const onResize = () => {
      setPageSize(prev => {
        const next = pageSizeForZoom(baseSize)
        if (next !== prev) setPage(1)
        return next
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [baseSize])

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
    () => ['all', ...new Set(events.map(e => e.module).filter(Boolean))],
    [events]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return events.filter(e => {
      if (moduleFilter !== 'all' && e.module !== moduleFilter) return false
      if (!q) return true
      return [e.action, e.table_name, e.user_name, e.changed_by, e.record_id]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(q))
    })
  }, [events, search, moduleFilter])

  // Top modules by audit volume — one-click presets next to the dropdown.
  const topModules = useMemo(() => {
    const counts = new Map()
    events.forEach(e => {
      if (!e.module) return
      counts.set(e.module, (counts.get(e.module) || 0) + 1)
    })
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([module, count]) => ({ module, count }))
  }, [events])

  // Reset to first page whenever the result set or page size changes
  useEffect(() => { setPage(1); setGoTo('') }, [search, moduleFilter, pageSize, baseSize, events.length])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
  const from = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1
  const to = Math.min(safePage * pageSize, filtered.length)
  // Compact numbered window (1 … 4 5 6 … 12)
  const pageNums = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const set = new Set([1, 2, safePage - 1, safePage, safePage + 1, totalPages - 1, totalPages])
    return [...set].filter(p => p >= 1 && p <= totalPages).sort((a, b) => a - b)
  }, [totalPages, safePage])
  const submitGoTo = () => {
    const n = Number(goTo)
    if (Number.isInteger(n) && n >= 1 && n <= totalPages) setPage(n)
    setGoTo('')
  }

  return (
    <div className="p-4">
      <PageHeader
        title="Audit Log"
        subtitle={`${events.length} recent event${events.length === 1 ? '' : 's'}${fromCache ? ' (showing cached copy — live sync unavailable)' : ''}`}
        action={
          <button
            onClick={load}
            className="px-4 py-2 rounded-xl bg-[var(--ap-accent)] text-white text-sm font-bold hover:opacity-90 transition-all"
          >
            Refresh
          </button>
        }
      />

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300">
          Live audit log is unavailable right now ({error}). Showing the last locally cached events instead.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[180px] max-w-xs">
          <div className="relative">
            <SearchIcon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search actions, users, modules…"
              className="w-full px-3 py-2.5 rounded-xl border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-blue-500 pl-9"
            />
          </div>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-shrink-0">
          <FieldSelect value={typeFilter} onChange={e => setModuleFilter(e.target.value)} aria-label="Filter by module">
            <option value="all">All Modules</option>
            {CUSTOMER_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </FieldSelect>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-slate-500 dark:text-slate-400">
              <th className="text-left pb-2">Time</th>
              <th className="text-left pb-2">Action</th>
              <th className="text-left pb-2">Module</th>
              <th className="text-left pb-2">User</th>
              <th className="text-left pb-2">Severity</th>
              <th className="text-left pb-2">Description</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map(e => (
              <tr key={e.id} className="border-b border-[var(--ap-border)]">
                <td className="py-2 text-slate-600 dark:text-slate-300">{fmtAuditTime(e.changed_at || e.timestamp)}</td>
                <td className="py-2 font-medium text-slate-800 dark:text-slate-200">{e.action}</td>
                <td className="py-2 text-slate-500 dark:text-slate-400">{e.module || '—'}</td>
                <td className="py-2 text-slate-600 dark:text-slate-300">{e.user_name || '—'}</td>
                <td className="py-2"><SeverityBadge severity={e.severity} /></td>
                <td className="py-2 text-slate-700 dark:text-slate-200 truncate max-w-[400px]">{e.description || e.action}</td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-slate-500 dark:text-slate-400">
                  No audit events found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap flex-shrink-0">
          Page {safePage} of {totalPages} · {filtered.length} event{filtered.length !== 1 ? 's' : ''}
        </div>
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-shrink-0">
          <button
            onClick={() => setPage(safePage - 1)}
            disabled={safePage <= 1}
            className="px-3 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed
              bg-[var(--ap-surface-2)] text-slate-600 dark:text-slate-300 hover:bg-[var(--ap-surface-3)]"
          >
            ←
          </button>
          {pageNums.map((n) => n === '…' ? (
            <span key="dots" className="px-2 text-xs text-slate-500">…</span>
          ) : (
            <button
              key={n}
              onClick={() => setPage(n)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                n === safePage
                  ? 'bg-[var(--ap-accent)] text-white'
                  : 'bg-[var(--ap-surface-2)] text-slate-600 dark:text-slate-300 hover:bg-[var(--ap-surface-3)]'
              }`}
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => setPage(safePage + 1)}
            disabled={safePage >= totalPages}
            className="px-3 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed
              bg-[var(--ap-surface-2)] text-slate-600 dark:text-slate-300 hover:bg-[var(--ap-surface-3)]"
          >
            →
          </button>
        </div>
      </div>
    </div>
  )
}

function SeverityBadge({ severity }) {
  const styles = {
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    error:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    warning:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    info:     'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-amber-300',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${styles[severity] || styles.info}`}>
      {severity || 'info'}
    </span>
  )
}

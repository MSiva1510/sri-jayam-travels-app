// ─── Reports workspace chrome ──────────────────────────────────
// Shared shell, filters, states and export surface for every report tab.
// Uses only existing ap-* tokens and shared UI primitives.

import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, CalendarDays, ChevronDown, ChevronLeft, ChevronRight,
  Download, FileSpreadsheet, FileText, Loader2, Search, Table2, X,
} from 'lucide-react'
import Button from '../ui/Button'
import Callout from '../ui/Callout'
import EmptyState from '../ui/EmptyState'
import MetricCard from '../ui/MetricCard'
import SectionHeader from '../ui/SectionHeader'
import StatusPill from '../ui/StatusPill'
import Surface from '../ui/Surface'
import { exportToCSV, exportToExcel, exportToPDF } from '../../data/reportData'
import { REPORT_PRESETS, formatRangeLabel, presetRange } from './reportUtils'

export function useReportExport(onRegisterExport, config) {
  useEffect(() => {
    onRegisterExport?.(config)
    return () => onRegisterExport?.(null)
  }, [onRegisterExport, config])
}

export function ReportPanel({ title, eyebrow, sub, icon: Icon, action, children, className = '' }) {
  const heading = (
    <span className="flex items-center gap-2 min-w-0">
      {Icon && (
        <span className="w-8 h-8 rounded-[10px] bg-[var(--ap-surface-2)] text-[var(--ap-accent)] flex items-center justify-center flex-shrink-0">
          <Icon size={15} />
        </span>
      )}
      <span className="truncate">{title}</span>
    </span>
  )
  return (
    <Surface className={`min-w-0 ${className}`}>
      <SectionHeader eyebrow={eyebrow} title={heading} action={action} />
      {sub && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 -mb-1">{sub}</p>}
      <div className="mt-4">{children}</div>
    </Surface>
  )
}

export function ReportKpiGrid({ items, columns = 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4', className = '' }) {
  return (
    <div className={`grid ${columns} gap-3 ${className}`}>
      {items.map(item => <MetricCard key={item.label} {...item} />)}
    </div>
  )
}

export function ReportIntro({ title, description, scope, action }) {
  return (
    <Surface className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--ap-accent)] mb-1">Report</p>
          <h2 className="font-sf text-lg sm:text-xl font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>
          {scope && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">{scope}</p>}
        </div>
        {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
      </div>
    </Surface>
  )
}

export function ReportScope({ label, tone = 'blue' }) {
  return <StatusPill tone={tone}>{label}</StatusPill>
}

export function ReportSkeleton({ variant = 'panel' }) {
  const classes = {
    kpi: 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3',
    panel: 'space-y-3',
    chart: 'space-y-4',
    table: 'space-y-2',
  }
  const count = variant === 'kpi' ? 4 : variant === 'table' ? 6 : variant === 'chart' ? 3 : 2
  return (
    <div className={classes[variant] || classes.panel} role="status" aria-busy="true" aria-label="Loading report">
      <span className="sr-only">Loading report…</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={variant === 'kpi' ? 'skeleton h-28 rounded-[18px]' : 'skeleton h-16 rounded-2xl'} />
      ))}
    </div>
  )
}

export function ReportState({
  resource, skeleton = 'panel', empty = false, emptyIcon: EmptyIcon,
  emptyTitle, emptyDescription, emptyAction, children,
}) {
  if (resource?.error) {
    return (
      <Callout tone="red" icon={AlertTriangle} title="Could not load this report"
        sub={resource.error.message || 'Something went wrong while loading report data.'}
        actionLabel="Retry" onAction={resource.retry} />
    )
  }
  if (resource?.loading) return <ReportSkeleton variant={skeleton} />
  if (empty) {
    return (
      <EmptyState icon={EmptyIcon || Table2} title={emptyTitle || 'No data in this view'}
        description={emptyDescription} action={emptyAction} />
    )
  }
  return children
}

export function ReportToolbar({ children, className = '' }) {
  return (
    <Surface padded={false} className={`p-3 ${className}`}>
      <div className="flex flex-wrap items-end gap-2">{children}</div>
    </Surface>
  )
}

export function FilterSelect({ label, value, onChange, children, className = '', ...rest }) {
  return (
    <label className={`flex flex-col gap-1 min-w-[140px] ${className}`}>
      {label && <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-500 dark:text-slate-400">{label}</span>}
      <select value={value} onChange={event => onChange(event.target.value)}
        className="ap-field ap-focus h-10 rounded-[10px] px-3 text-xs font-semibold py-0"
        aria-label={label || rest['aria-label']} {...rest}>
        {children}
      </select>
    </label>
  )
}

export function SearchInput({ value, onChange, placeholder = 'Search…', label = 'Search', className = '' }) {
  return (
    <label className={`flex flex-col gap-1 min-w-[180px] flex-1 max-w-xs ${className}`}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-500 dark:text-slate-400">{label}</span>
      <span className="flex items-center gap-2 ap-field ap-focus h-10 rounded-[10px] px-3">
        <Search size={14} className="text-slate-400 flex-shrink-0" aria-hidden="true" />
        <input value={value} onChange={event => onChange(event.target.value)}
          placeholder={placeholder} aria-label={label}
          className="bg-transparent text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none w-full min-w-0" />
      </span>
    </label>
  )
}

export function DateInput({ label, value, onChange, min, max, className = '' }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-500 dark:text-slate-400">{label}</span>
      <input type="date" value={value} min={min} max={max} onChange={event => onChange(event.target.value)}
        aria-label={label}
        className="ap-field ap-focus h-10 rounded-[10px] px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 py-0" />
    </label>
  )
}

export function ClearFilters({ onClick, activeCount = 0, label = 'Clear filters' }) {
  return (
    <Button variant="ghost" size="sm" icon={X} onClick={onClick} className="self-end">
      {label}{activeCount > 0 ? ` (${activeCount})` : ''}
    </Button>
  )
}

export function ReportPager({ page, totalPages, total, pageSize, onPage, label = 'records' }) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const pages = Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
    let p = i + 1
    if (totalPages > 5) {
      if (page > 3 && page < totalPages - 1) p = page - 2 + i
      else if (page >= totalPages - 1) p = totalPages - 4 + i
    }
    return p
  })
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
      <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
        Showing {from} to {to} of {total} {label}
      </p>
      {totalPages > 1 && (
        <nav className="flex items-center gap-1" aria-label={`${label} pages`}>
          <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"
            className="w-8 h-8 rounded-[10px] border border-[var(--ap-border)] flex items-center justify-center text-slate-500 ap-focus disabled:opacity-40 hover:bg-[var(--ap-surface-2)]">
            <ChevronLeft size={14} />
          </button>
          {pages.map(p => (
            <button key={p} type="button" onClick={() => onPage(p)} aria-current={p === page ? 'page' : undefined}
              className={`min-w-[32px] h-8 px-1.5 rounded-[10px] text-xs font-semibold tabular-nums ap-focus transition-colors ${
                p === page ? 'bg-[var(--ap-accent)] text-white shadow-sm' : 'text-slate-500 hover:bg-[var(--ap-surface-2)]'
              }`}>{p}</button>
          ))}
          <button type="button" disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page"
            className="w-8 h-8 rounded-[10px] border border-[var(--ap-border)] flex items-center justify-center text-slate-500 ap-focus disabled:opacity-40 hover:bg-[var(--ap-surface-2)]">
            <ChevronRight size={14} />
          </button>
        </nav>
      )}
    </div>
  )
}

export function RankRows({ rows, primary, secondary, value, share, tone = 'blue', emptyText = 'No data yet.' }) {
  const bars = {
    blue: 'bg-blue-500', green: 'bg-emerald-500', amber: 'bg-amber-500',
    violet: 'bg-violet-500', red: 'bg-red-500', teal: 'bg-teal-500',
  }
  if (!rows.length) return <p className="text-xs text-slate-400 text-center py-8">{emptyText}</p>
  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div key={row.id || row.name || row.route || row.cat || index} className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="w-5 h-5 rounded-md bg-[var(--ap-surface-2)] text-[10px] font-bold text-slate-500 flex items-center justify-center tabular-nums flex-shrink-0">
              {index + 1}
            </span>
            <div className="flex-1 min-w-0">
              {primary(row, index)}
              {secondary?.(row, index)}
            </div>
            <div className="flex-shrink-0 text-right">{value(row, index)}</div>
          </div>
          {share != null && (
            <div className="ml-8 mt-1.5 h-1.5 rounded-full bg-[var(--ap-surface-2)] overflow-hidden">
              <div className={`h-full rounded-full ${bars[tone] || bars.blue}`} style={{ width: `${Math.max(2, Math.min(100, share(row)))}%` }} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export function ReportDateRange({ value, onChange }) {
  const preset = value?.preset || 'this-month'
  const applyPreset = (next) => {
    if (next === 'custom') {
      onChange({ preset: 'custom', from: value?.from || '', to: value?.to || '' })
      return
    }
    onChange({ preset: next, ...presetRange(next) })
  }
  return (
    <Surface padded={false} className="px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarDays size={15} className="text-[var(--ap-accent)] flex-shrink-0" aria-hidden="true" />
        <label className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-500 dark:text-slate-400">Period</span>
          <select value={preset} onChange={event => applyPreset(event.target.value)} aria-label="Quick period"
            className="ap-field ap-focus h-9 rounded-[10px] px-2.5 text-xs font-semibold py-0">
            {REPORT_PRESETS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
          </select>
        </label>
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 tabular-nums px-2 py-1 rounded-lg bg-[var(--ap-surface-2)]">
          {formatRangeLabel(value?.from, value?.to)}
        </span>
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={value?.from || ''} max={value?.to || undefined} aria-label="Custom from date"
              onChange={event => onChange({ preset: 'custom', from: event.target.value, to: value?.to || '' })}
              className="ap-field ap-focus h-9 rounded-[10px] px-2.5 text-xs font-semibold py-0" />
            <span className="text-xs text-slate-400">to</span>
            <input type="date" value={value?.to || ''} min={value?.from || undefined} aria-label="Custom to date"
              onChange={event => onChange({ preset: 'custom', from: value?.from || '', to: event.target.value })}
              className="ap-field ap-focus h-9 rounded-[10px] px-2.5 text-xs font-semibold py-0" />
          </div>
        )}
      </div>
    </Surface>
  )
}

const FORMATS = [
  { key: 'csv', label: 'CSV', icon: Table2 },
  { key: 'excel', label: 'Excel', icon: FileSpreadsheet },
  { key: 'pdf', label: 'PDF', icon: FileText },
]

export function ExportMenu({ config, disabled = false }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    const close = (event) => { if (!ref.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const run = async (format) => {
    if (!config?.rows?.length) {
      setError('This report has no rows to export.')
      return
    }
    setBusy(format)
    setError('')
    try {
      const { rows, columns, filename, title } = config
      if (format === 'csv') exportToCSV(rows, columns, filename)
      else if (format === 'excel') await exportToExcel(rows, columns, filename)
      else exportToPDF(rows, columns, filename, title || filename)
      setOpen(false)
    } catch (reason) {
      setError(reason?.message || 'Export failed. Please try again.')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="relative" ref={ref}>
      <Button variant="primary" size="sm" icon={busy ? Loader2 : Download}
        disabled={disabled || !!busy} onClick={() => setOpen(value => !value)}
        className={busy ? '[&_svg]:animate-spin' : ''}>
        {busy ? `Exporting ${busy.toUpperCase()}…` : 'Export Report'}
        <ChevronDown size={13} className="ml-0.5" aria-hidden="true" />
      </Button>
      {open && (
        <div className="absolute right-0 top-11 z-30 min-w-[150px] overflow-hidden rounded-[14px] border border-[var(--ap-border)] bg-[var(--ap-surface-elev)] p-1 shadow-xl">
          {FORMATS.map(format => (
            <button key={format.key} type="button" disabled={!!busy}
              onClick={() => run(format.key)}
              className="ap-focus flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-[var(--ap-surface-2)] disabled:opacity-50">
              <format.icon size={14} /> {format.label}
            </button>
          ))}
        </div>
      )}
      {error && <p className="absolute right-0 top-[92px] z-30 w-56 text-[11px] text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}

// ─── Business alerts ───────────────────────────────────────────
// Keeps the exact getBusinessAlerts() priority logic. It groups alerts for
// readability but never resolves, suppresses or invents an alert.

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, CalendarDays, CheckCircle2, FileText,
  Gauge, Search, ShieldCheck, Wrench, X,
} from 'lucide-react'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import StatusPill from '../ui/StatusPill'
import Surface from '../ui/Surface'
import {
  ClearFilters, FilterSelect, ReportIntro, ReportKpiGrid,
  ReportPanel, SearchInput, useReportExport,
} from './ReportChrome'
import { EMPTY_ARRAY, fullDt, num } from './reportUtils'

const TYPE_ICONS = {
  insurance: ShieldCheck,
  permit: FileText,
  fc: FileText,
  puc: Gauge,
  service: Wrench,
}

const PRIORITY_META = {
  high: { label: 'Critical', tone: 'red', title: 'Critical' },
  medium: { label: 'Warning', tone: 'amber', title: 'Warning' },
  low: { label: 'Informational', tone: 'blue', title: 'Informational' },
}

const PRIORITY_FILTERS = [
  { key: 'all', label: 'All priorities' },
  { key: 'high', label: 'Critical' },
  { key: 'medium', label: 'Warning' },
  { key: 'low', label: 'Informational' },
]

const EXPORT_COLUMNS = [
  { label: 'Alert', key: 'label' },
  { label: 'Type', key: 'type' },
  { label: 'Expires', key: 'expiry' },
  { label: 'Priority', key: 'priority' },
  { label: 'Days', key: 'days' },
]

const alertKey = (alert, index) => `${alert.label || 'alert'}-${alert.expiry || ''}-${index}`

const dueText = (alert) => {
  const days = num(alert.days)
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Due today'
  return `${days}d left`
}

export default function AlertsReport({ alertsResource, resetKey, onRegisterExport }) {
  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState('all')
  const alerts = Array.isArray(alertsResource.data) ? alertsResource.data : EMPTY_ARRAY

  useEffect(() => { setSearch(''); setPriority('all') }, [resetKey])

  const grouped = useMemo(() => {
    const critical = alerts.filter(alert => alert.priority === 'high')
    const others = alerts.filter(alert => alert.priority !== 'high')
    const filtered = others.filter(alert => {
      if (priority !== 'all' && alert.priority !== priority) return false
      if (!search) return true
      const query = search.toLowerCase()
      return [alert.label, alert.type, alert.expiry, PRIORITY_META[alert.priority]?.label]
        .some(value => String(value ?? '').toLowerCase().includes(query))
    })
    return {
      critical,
      warning: filtered.filter(alert => alert.priority === 'medium'),
      informational: filtered.filter(alert => !['high', 'medium'].includes(alert.priority)),
    }
  }, [alerts, priority, search])

  const visible = useMemo(
    () => [...grouped.critical, ...grouped.warning, ...grouped.informational],
    [grouped],
  )
  const overdue = alerts.filter(alert => num(alert.days) < 0).length
  const activeFilters = [search, priority !== 'all'].filter(Boolean).length

  const exportConfig = useMemo(() => ({
    rows: visible.map(alert => ({
      label: alert.label,
      type: alert.type,
      expiry: alert.expiry,
      priority: PRIORITY_META[alert.priority]?.label || alert.priority,
      days: num(alert.days),
    })),
    columns: EXPORT_COLUMNS,
    filename: 'business_alerts',
    title: 'Business Alerts',
  }), [visible])

  useReportExport(onRegisterExport, exportConfig)

  if (alertsResource.error) {
    return (
      <div className="space-y-4">
        <ReportIntro title="Business alerts"
          description="Document expiry and vehicle service reminders generated from current vehicle records." />
        <Surface className="p-10 text-center" role="alert">
          <AlertTriangle size={34} className="mx-auto text-amber-500 mb-3" aria-hidden="true" />
          <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">Couldn’t load document alerts</p>
          <p className="text-xs text-slate-400 mt-1 mb-3">
            This is a loading failure — not a confirmation that everything is up to date.
          </p>
          <Button variant="secondary" size="sm" onClick={alertsResource.retry}>Retry</Button>
        </Surface>
      </div>
    )
  }

  if (alertsResource.loading) {
    return (
      <div className="space-y-4">
        <ReportIntro title="Business alerts"
          description="Document expiry and vehicle service reminders generated from current vehicle records." />
        <Surface className="p-10 text-center" role="status" aria-busy="true">
          <span className="sr-only">Checking documents and service dates…</span>
          <span className="inline-block w-7 h-7 rounded-full border-2 border-[var(--ap-border)] border-t-[var(--ap-accent)] animate-spin mb-3" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Checking documents and service dates…</p>
        </Surface>
      </div>
    )
  }

  if (alerts.length === 0) {
    return (
      <div className="space-y-4">
        <ReportIntro title="Business alerts"
          description="Document expiry and vehicle service reminders generated from current vehicle records." />
        <Surface className="p-10 text-center">
          <EmptyState icon={CheckCircle2} title="All documents are up to date"
            description="No alerts at this time." />
        </Surface>
      </div>
    )
  }

  const kpis = [
    { label: 'Total Alerts', value: alerts.length, sub: 'Documents & service', icon: AlertTriangle, tone: 'amber' },
    { label: 'Critical', value: grouped.critical.length, sub: 'Always shown', icon: X, tone: 'red' },
    { label: 'Overdue', value: overdue, sub: 'Expired already', icon: CalendarDays, tone: 'violet' },
  ]

  const section = (key, rows, emptyText) => (
    <ReportPanel
      eyebrow="Priority group"
      title={PRIORITY_META[key].title}
      icon={key === 'high' ? AlertTriangle : key === 'medium' ? CalendarDays : FileText}
      sub={key === 'high' ? 'Critical alerts remain visible in every view' : emptyText}
    >
      {rows.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-6">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((alert, index) => {
            const Icon = TYPE_ICONS[alert.type] || AlertTriangle
            const meta = PRIORITY_META[alert.priority] || PRIORITY_META.low
            return (
              <div key={alertKey(alert, index)}
                className={`flex items-center gap-3 rounded-[14px] border px-3.5 py-3 ${
                  meta.tone === 'red'
                    ? 'bg-red-500/[0.06] border-red-500/20'
                    : meta.tone === 'amber'
                      ? 'bg-amber-500/[0.06] border-amber-500/20'
                      : 'bg-blue-500/[0.06] border-blue-500/20'
                }`}>
                <span className={`w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0 ${
                  meta.tone === 'red' ? 'text-red-600 dark:text-red-400' : meta.tone === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'
                }`}>
                  <Icon size={16} aria-hidden="true" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{alert.label}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Expires: {fullDt(alert.expiry)} · {dueText(alert)}
                  </p>
                </div>
                <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
              </div>
            )
          })}
        </div>
      )}
    </ReportPanel>
  )

  return (
    <div className="space-y-4">
      <ReportIntro
        title="Business alerts"
        description="Document expiry and vehicle service reminders generated from current vehicle records."
        scope="All alerts use the existing priority logic. Critical alerts stay visible even when another priority or search is selected."
      />
      <ReportKpiGrid items={kpis} columns="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" />

      <div className="flex flex-wrap items-end gap-2 rounded-[16px] border border-[var(--ap-border)] bg-[var(--ap-surface-2)] p-3">
        <SearchInput label="Search alerts" value={search} onChange={setSearch} placeholder="Vehicle, document or expiry…" />
        <FilterSelect label="Priority" value={priority} onChange={setPriority}>
          {PRIORITY_FILTERS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
        </FilterSelect>
        <ClearFilters onClick={() => { setSearch(''); setPriority('all') }} activeCount={activeFilters} label="Clear filters" />
        <p className="text-[11px] text-slate-400 ml-auto pb-2">Showing {visible.length} of {alerts.length} alerts</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        {section('high', grouped.critical, 'No critical alerts.')}
        {section('medium', grouped.warning, 'No warning alerts match this view.')}
        {section('low', grouped.informational, 'No informational alerts match this view.')}
      </div>

      {visible.length === 0 && (
        <EmptyState icon={CheckCircle2} title="No alerts match these filters"
          description="Critical alerts are never hidden. Clear the filters to return to the full list."
          action={<Button variant="ghost" size="sm" onClick={() => { setSearch(''); setPriority('all') }}>Clear filters</Button>} />
      )}
    </div>
  )
}

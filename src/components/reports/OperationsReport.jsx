// ─── Operations monitor ────────────────────────────────────────
// Presents only the metrics returned by getOperationsMonitor(). It does not
// infer timestamps, health scores or activity that the report does not supply.

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Car, CheckCircle2, ClipboardList, Navigation, RefreshCw,
  UserRound, Wrench,
} from 'lucide-react'
import Button from '../ui/Button'
import StatusPill from '../ui/StatusPill'
import useReportResource from './useReportResource'
import {
  ReportIntro, ReportKpiGrid, ReportPanel, ReportState, useReportExport,
} from './ReportChrome'
import { getOperationsMonitor } from '../../data/reportData'
import { num } from './reportUtils'

const EMPTY = {
  drivers: { available: 0, onLeave: 0 },
  vehicles: { available: 0, maintenance: 0, assigned: 0 },
  trips: { scheduled: 0, assigned: 0, inProgress: 0, completed: 0, cancelled: 0 },
}

const TONE_DOT = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  violet: 'bg-violet-500',
}

export default function OperationsReport({ refreshKey, onRegisterExport }) {
  const navigate = useNavigate()
  const resource = useReportResource('operations-monitor', () => getOperationsMonitor(), { refreshKey })
  const ops = resource.data || EMPTY

  const groups = useMemo(() => {
    const d = ops.drivers || {}
    const v = ops.vehicles || {}
    const t = ops.trips || {}
    return [
      {
        key: 'healthy', title: 'Healthy', tone: 'green', route: '/drivers',
        description: 'Ready and completed work',
        items: [
          { label: 'Available drivers', value: d.available, tone: 'green' },
          { label: 'Available vehicles', value: v.available, tone: 'green' },
          { label: 'Scheduled trips', value: t.scheduled, tone: 'blue' },
          { label: 'Completed trips', value: t.completed, tone: 'green' },
        ],
      },
      {
        key: 'attention', title: 'Needs attention', tone: 'amber', route: '/trips',
        description: 'In progress or away',
        items: [
          { label: 'Drivers on leave', value: d.onLeave, tone: 'amber' },
          { label: 'Assigned vehicles', value: v.assigned, tone: 'blue' },
          { label: 'Assigned trips', value: t.assigned, tone: 'violet' },
          { label: 'Trips in progress', value: t.inProgress, tone: 'amber' },
        ],
      },
      {
        key: 'critical', title: 'Critical', tone: 'red', route: '/vehicles',
        description: 'Unavailable or cancelled',
        items: [
          { label: 'Vehicles in maintenance', value: v.maintenance, tone: 'red' },
          { label: 'Cancelled trips', value: t.cancelled, tone: 'red' },
        ],
      },
    ]
  }, [ops])

  const kpis = [
    { label: 'Available Drivers', value: num(ops.drivers?.available), sub: 'Ready to assign', icon: UserRound, tone: 'green' },
    { label: 'Available Vehicles', value: num(ops.vehicles?.available), sub: 'Ready to assign', icon: Car, tone: 'blue' },
    { label: 'In Progress Trips', value: num(ops.trips?.inProgress), sub: 'Currently started', icon: Navigation, tone: 'amber' },
    { label: 'Vehicles in Maintenance', value: num(ops.vehicles?.maintenance), sub: 'Unavailable', icon: Wrench, tone: 'red' },
  ]

  const exportConfig = useMemo(() => ({
    rows: groups.flatMap(group => group.items.map(item => ({
      state: group.title, metric: item.label, value: num(item.value),
    }))),
    columns: [
      { label: 'State', key: 'state' },
      { label: 'Metric', key: 'metric' },
      { label: 'Value', key: 'value' },
    ],
    filename: 'operations_monitor',
    title: 'Operations Monitor',
  }), [groups])

  useReportExport(onRegisterExport, exportConfig)

  return (
    <div className="space-y-4">
      <ReportIntro
        title="Operations monitor"
        description="A current snapshot of drivers, vehicles and trip states across the operation."
        scope="Values come directly from getOperationsMonitor(). No timestamp is supplied by this report, so none is shown."
      />

      <ReportState resource={resource} skeleton="kpi" empty={false}>
        <ReportKpiGrid items={kpis} columns="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" />
      </ReportState>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {groups.map(group => (
          <ReportPanel key={group.key} eyebrow={group.description}
            title={
              <span className="flex items-center gap-2">
                {group.title}
                <StatusPill tone={group.tone}>{group.items.length} metrics</StatusPill>
              </span>
            }
            icon={group.key === 'healthy' ? CheckCircle2 : group.key === 'attention' ? RefreshCw : Wrench}
            action={<Button variant="ghost" size="sm" onClick={() => navigate(group.route)}>View details →</Button>}>
            <ReportState resource={resource} skeleton="panel" empty={false}>
              <div className="space-y-2">
                {group.items.map(item => (
                  <div key={item.label} className="flex items-center justify-between gap-3 rounded-[12px] bg-[var(--ap-surface-2)] px-3 py-2.5">
                    <span className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 min-w-0">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${TONE_DOT[item.tone] || TONE_DOT.blue}`} aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    <span className="font-sf text-base font-semibold tabular-nums text-slate-800 dark:text-white flex-shrink-0">
                      {num(item.value).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            </ReportState>
          </ReportPanel>
        ))}
      </div>

      <ReportPanel eyebrow="Navigation" title="Open source modules"
        icon={ClipboardList} sub="Each group links to the module that owns its records">
        <div className="flex flex-wrap gap-2">
          {[['Drivers', '/drivers', UserRound], ['Vehicles', '/vehicles', Car], ['Trips', '/trips', Navigation]].map(([label, route, Icon]) => (
            <Button key={route} variant="outline" size="sm" icon={Icon} onClick={() => navigate(route)}>{label}</Button>
          ))}
        </div>
      </ReportPanel>
    </div>
  )
}

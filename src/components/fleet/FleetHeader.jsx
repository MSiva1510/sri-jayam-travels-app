import { Loader2, Maximize2, Minimize2, Radio, RefreshCw, Satellite } from 'lucide-react'
import Button from '../ui/Button'
import StatusPill from '../ui/StatusPill'

/**
 * Compact header for the Live Fleet workspace. Connection reflects the GPS
 * provider health; it is deliberately separate from vehicle movement state.
 */
export default function FleetHeader({
  connection = { tone: 'green', label: 'Connected', pulse: true },
  lastUpdated = '—',
  countdown = null,
  refreshing = false,
  onRefresh,
  mapFocus = false,
  onToggleMapFocus,
}) {
  const ConnectionIcon = connection.tone === 'red' || connection.tone === 'amber' ? Satellite : Radio
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-2xl ap-surface-elevated ap-hairline flex items-center justify-center text-blue-600 dark:text-blue-300 flex-shrink-0">
          <Satellite size={20} strokeWidth={2.1} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            Operations · Live tracking
          </p>
          <h1 className="text-[26px] sm:text-[28px] font-sf font-semibold tracking-tight text-slate-900 dark:text-white leading-tight">
            Live Fleet
          </h1>
          <p className="text-xs sm:text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">
            Track your vehicles and monitor fleet activity in real time.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2.5 rounded-2xl ap-surface ap-hairline px-3 py-2 min-w-0">
          <ConnectionIcon size={15} className="text-slate-400 dark:text-slate-500 flex-shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <StatusPill tone={connection.tone} pulse={connection.pulse}>
              {connection.label}
            </StatusPill>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5 truncate">
              Last updated {lastUpdated}
              {countdown ? <span className="hidden sm:inline"> · {countdown}</span> : null}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing || !onRefresh}
          aria-label="Refresh GPS data"
        >
          {refreshing
            ? <span className="animate-spin inline-flex"><Loader2 size={15} /></span>
            : <RefreshCw size={15} />}
          {refreshing ? 'Refreshing' : 'Refresh'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onToggleMapFocus}
          disabled={!onToggleMapFocus}
          icon={mapFocus ? Minimize2 : Maximize2}
          aria-pressed={mapFocus}
        >
          {mapFocus ? 'Exit map focus' : 'Fullscreen map'}
        </Button>
      </div>
    </header>
  )
}

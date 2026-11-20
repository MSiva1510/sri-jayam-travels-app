import { Car, CheckCircle, Wrench, Route, Zap, PauseCircle, Navigation, WifiOff } from 'lucide-react'
import Surface from '../ui/Surface'
import SectionHeader from '../ui/SectionHeader'
import StatusPill from '../ui/StatusPill'
import MiniStat from './MiniStat'
import DataUnavailable from './DataUnavailable'
import FleetMap from '../fleet/FleetMap'

export default function FleetOverview({
  vehicleCounts, gps, snapshots = [], vehiclesUnavailable, onVehicles, onGps,
}) {
  const stale = gps.state !== 'live'
  const statuses = [
    { key: 'moving', label: 'Moving', icon: Zap, tone: 'green' },
    { key: 'idle', label: 'Idle', icon: PauseCircle, tone: 'amber' },
    { key: 'stopped', label: 'Stopped', icon: Car, tone: 'blue' },
    { key: 'offline', label: 'Offline', icon: WifiOff, tone: 'gray' },
  ]

  return (
    <section>
      <SectionHeader
        className="mb-3"
        eyebrow="Fleet management"
        title="Fleet & GPS"
        badge={<StatusPill tone={gps.tone} pulse={gps.isLive}>{gps.label}</StatusPill>}
        action={
          <button
            type="button"
            onClick={onGps}
            aria-label="View GPS fleet"
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors"
          >
            View GPS →
          </button>
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {vehiclesUnavailable ? (
          <DataUnavailable label="Vehicle counts unavailable" description="Fleet availability is hidden until the vehicle registry loads." />
        ) : (
          <Surface className="py-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Vehicles</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Fleet availability</p>
              </div>
              <button
                type="button"
                onClick={onVehicles}
                aria-label="Manage vehicles"
                className="ap-action-link text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors"
              >
                Manage →
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <MiniStat icon={Car} tone="blue" value={vehicleCounts.total} label="Total vehicles" onClick={onVehicles} />
              <MiniStat icon={CheckCircle} tone="green" value={vehicleCounts.available} label="Available" onClick={onVehicles} />
              <MiniStat icon={Route} tone="violet" value={vehicleCounts.onTrip} label="On trip" onClick={onVehicles} />
              <MiniStat icon={Wrench} tone="amber" value={vehicleCounts.maintenance} label="Maintenance" onClick={onVehicles} />
            </div>
          </Surface>
        )}

        <Surface as="section" aria-label="Live fleet map" className={`py-4 ${stale ? 'border-amber-500/25' : ''}`}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Live fleet map</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                Last successful fix: {gps.lastUpdate} · refresh {gps.interval}s
              </p>
            </div>
            <Navigation size={15} className={stale ? 'text-amber-500' : 'text-blue-500'} aria-hidden="true" />
          </div>

          <div className="grid grid-cols-4 gap-2">
            {statuses.map(item => (
              <button
                key={item.key}
                type="button"
                onClick={onGps}
                aria-label={`${item.label} vehicles: ${gps.counts[item.key]}`}
                className="ap-focus rounded-xl border ap-hairline bg-slate-500/[0.02] px-2 py-2 text-center transition-colors hover:bg-[var(--ap-surface-2)] dark:bg-white/[0.02]"
              >
                <item.icon
                  size={13}
                  className={`mx-auto ${item.tone === 'green' ? 'text-emerald-600 dark:text-emerald-300' : item.tone === 'amber' ? 'text-amber-600 dark:text-amber-300' : item.tone === 'blue' ? 'text-blue-600 dark:text-blue-300' : 'text-slate-500 dark:text-slate-300'}`}
                  aria-hidden="true"
                />
                <span className="mt-1 block text-sm font-semibold leading-none tabular-nums text-slate-900 dark:text-white">
                  {gps.counts[item.key]}
                </span>
                <span className="mt-1 block text-[10px] leading-tight text-slate-500 dark:text-slate-400">
                  {item.label}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl border ap-hairline">
            <FleetMap snapshots={snapshots} onSelect={onGps} height={230} />
          </div>

          {stale && (
            <p className="mt-3 rounded-xl bg-amber-500/[0.08] border border-amber-500/15 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
              {gps.state === 'no-data'
                ? 'No GPS snapshots are available yet. Counts are not live vehicle positions.'
                : gps.state === 'disconnected'
                  ? 'GPS provider is disconnected. Shown positions are from the last stored fix, not live tracking.'
                  : gps.state === 'paused'
                    ? 'GPS sync is paused. Shown positions are from the last stored fix, not live tracking.'
                    : 'Live fixes are stale. Shown positions are from the last stored fix, not live tracking.'}
            </p>
          )}
        </Surface>
      </div>
    </section>
  )
}

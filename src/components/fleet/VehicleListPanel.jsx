import { Car, ChevronRight, LocateFixed, Search, X } from 'lucide-react'
import Surface from '../ui/Surface'
import EmptyState from '../ui/EmptyState'
import IconButton from '../ui/IconButton'
import SegmentedControl from '../ui/SegmentedControl'
import StatusPill from '../ui/StatusPill'
import { FLEET_STATUSES, freshnessLabel, speedText, vehStatus } from './fleetStatus'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'moving', label: 'Moving' },
  { key: 'stopped', label: 'Stopped' },
  { key: 'offline', label: 'Offline' },
]

/** Shared search + status controls, used in the list panel and other views. */
export function FleetFilters({ search = '', onSearch, status = 'all', onStatus, className = '' }) {
  const active = Boolean(search.trim()) || status !== 'all'
  return (
    <div className={`flex flex-col gap-2 sm:flex-row sm:items-center ${className}`}>
      <div className="relative min-w-0 flex-1">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={e => onSearch?.(e.target.value)}
          placeholder="Search registration, model or driver"
          aria-label="Search vehicles"
          className="ap-field ap-focus w-full py-2 pl-9 pr-3 text-xs rounded-xl outline-none"
        />
      </div>
      <div className="flex items-center gap-2">
        <SegmentedControl
          scroll
          className="flex-1 sm:flex-none"
          ariaLabel="Filter vehicles by movement status"
          value={status}
          onChange={onStatus}
          options={FILTERS}
        />
        {active && (
          <button
            type="button"
            onClick={() => { onSearch?.(''); onStatus?.('all') }}
            className="ap-focus inline-flex items-center gap-1 rounded-xl px-2.5 py-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-500/10 dark:hover:bg-white/10 flex-shrink-0"
            aria-label="Clear vehicle filters"
          >
            <X size={12} /> Clear
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * A vehicle row. The transparent overlay keeps the complete row clickable
 * without nesting buttons; the action cluster re-enables pointer events.
 */
export function VehicleCard({ s, selected = false, onView, onLocate }) {
  const status = FLEET_STATUSES[vehStatus(s)] || FLEET_STATUSES.offline
  const thumbnail = s.image_url || s.photo_url || s.vehicle_image
  // Fresh object so FleetMap re-centers even when the same card is clicked.
  const locate = () => onLocate?.({ ...s })

  return (
    <div className={`ap-surface relative rounded-2xl border border-l-[3px] transition-all duration-200 ${
      selected
        ? 'border-[var(--ap-accent)] border-l-[3px] bg-blue-500/[0.04] ring-2 ring-[var(--ap-accent)]/15 dark:bg-blue-500/10'
        : 'border-transparent hover:border-[var(--ap-border)]'
    }`}>
      <button
        type="button"
        aria-label={`Locate ${s.registration || 'vehicle'} on map`}
        onClick={locate}
        className="ap-focus absolute inset-0 z-0 rounded-2xl cursor-pointer"
      />
      <div className="relative z-10 pointer-events-none p-3.5">
        <div className="flex items-start gap-3">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt=""
              className="w-10 h-10 rounded-xl object-cover flex-shrink-0 ap-hairline"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-300 flex items-center justify-center flex-shrink-0">
              <Car size={19} strokeWidth={2} />
            </div>
          )}
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-sf font-semibold tracking-wide text-slate-900 dark:text-white truncate">
                {s.registration || '—'}
              </p>
              <StatusPill tone={status.tone}>{status.label}</StatusPill>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {s.vehicle_model || s.model || 'Vehicle'}
            </p>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0 pointer-events-auto">
            <IconButton icon={ChevronRight} label="View details" onClick={() => onView?.(s)} />
            <IconButton icon={LocateFixed} label="Locate on map" onClick={locate} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-3 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="truncate">Driver: {s.driver_name || 'Unassigned'}</span>
          <span className="tabular-nums truncate text-right">Speed: {speedText(s)}</span>
          <span className="tabular-nums truncate col-span-2">Updated: {freshnessLabel(s)}</span>
        </div>
      </div>
    </div>
  )
}

export default function VehicleListPanel({
  snapshots = [],
  search = '',
  onSearch,
  status = 'all',
  onStatus,
  selectedId,
  onSelect,
  onView,
}) {
  return (
    <Surface padded={false} data-testid="vehicle-panel" className="flex flex-col overflow-hidden lg:h-[520px]">
      <div className="border-b ap-hairline p-3.5 space-y-3 flex-shrink-0">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-sf font-semibold text-slate-900 dark:text-white">Fleet Vehicles</h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {snapshots.length} {snapshots.length === 1 ? 'vehicle' : 'vehicles'} shown
          </p>
        </div>
        <FleetFilters search={search} onSearch={onSearch} status={status} onStatus={onStatus} />
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {snapshots.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No vehicles match"
            description="Try a different registration, model, driver or status."
          />
        ) : snapshots.map(s => (
          <VehicleCard
            key={s.id}
            s={s}
            selected={selectedId != null && String(selectedId) === String(s.id)}
            onView={onView}
            onLocate={onSelect}
          />
        ))}
      </div>
    </Surface>
  )
}

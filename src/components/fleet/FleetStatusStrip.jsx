import { Clock3, Navigation2, Truck, WifiOff } from 'lucide-react'
import Surface from '../ui/Surface'
import { FLEET_STATUSES } from './fleetStatus'

const ITEMS = [
  { key: 'all',     label: 'Total vehicles', icon: Truck,      color: 'var(--ap-accent)' },
  { key: 'moving',  label: 'Moving',         icon: Navigation2, color: FLEET_STATUSES.moving.color },
  { key: 'stopped', label: 'Stopped',        icon: Clock3,      color: FLEET_STATUSES.stopped.color },
  { key: 'offline', label: 'Offline',        icon: WifiOff,     color: FLEET_STATUSES.offline.color },
]

export default function FleetStatusStrip({ counts = {}, total = 0, active = 'all', onChange }) {
  return (
    <Surface padded={false} className="overflow-hidden">
      <div className="grid grid-cols-2 gap-px bg-[var(--ap-border)] sm:flex sm:gap-0 sm:bg-transparent sm:divide-x sm:divide-[var(--ap-border)]">
        {ITEMS.map(({ key, label, icon: Icon, color }) => {
          const value = key === 'all' ? total : (counts[key] ?? 0)
          const selected = active === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange?.(key)}
              aria-pressed={selected}
              aria-label={`Filter vehicles: ${label}`}
              className={`ap-focus ios-press min-w-0 px-4 py-3 text-left transition-colors sm:flex-1 ${
                selected
                  ? 'bg-[var(--ap-surface-2)]'
                  : 'bg-[var(--ap-surface)] hover:bg-[var(--ap-surface-2)]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `color-mix(in srgb, ${color} 13%, transparent)`, color }}
                >
                  <Icon size={14} strokeWidth={2.2} />
                </span>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">{label}</span>
              </div>
              <p className="mt-1.5 text-xl font-sf font-semibold tracking-tight text-slate-900 dark:text-white tabular-nums">
                {value}
              </p>
            </button>
          )
        })}
      </div>
    </Surface>
  )
}

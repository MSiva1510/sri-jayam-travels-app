import { AlertTriangle } from 'lucide-react'
import Surface from '../ui/Surface'

// Used when a load fails. Never fall back to zeros that read as real data.
export default function DataUnavailable({
  label = 'Data unavailable',
  description = 'This section could not be loaded. Use Retry above to try again.',
}) {
  return (
    <Surface className="flex items-center gap-3 min-h-[120px]">
      <span className="w-9 h-9 rounded-[11px] flex items-center justify-center bg-slate-500/10 text-slate-500 dark:text-slate-300 flex-shrink-0" aria-hidden="true">
        <AlertTriangle size={17} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
      </div>
    </Surface>
  )
}

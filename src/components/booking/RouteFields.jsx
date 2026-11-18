// ─── RouteFields ──────────────────────────────────────────────────
// Pickup / destination with the existing LocationPicker (typed text,
// maps link, live location, map marker + popup) plus swap and clear.

import { ArrowUpDown, X } from 'lucide-react'
import LocationPicker from '../ui/LocationPicker'

function RouteColumn({ dot, label, value, onChange, error, required, placeholder }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </span>
        {!!value && (
          <button type="button" onClick={() => onChange('')} title={`Clear ${label.toLowerCase()}`}
            aria-label={`Clear ${label.toLowerCase()}`}
            className="ap-focus w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-[var(--ap-surface-2)] transition-colors">
            <X size={12} />
          </button>
        )}
      </div>
      <LocationPicker
        value={value || ''}
        onChange={onChange}
        error={error}
        required={!!required}
        label={label}
        showLabel={false}
        placeholder={placeholder}
      />
    </div>
  )
}

export default function RouteFields({ pickup, drop, onChange, errors = {} }) {
  return (
    <div className="rounded-2xl border border-[var(--ap-border)] bg-[var(--ap-surface)] p-3.5 sm:p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-[10px] font-bold text-[var(--ap-text-3)] uppercase tracking-widest">
          Route details
        </p>
        <button type="button"
          onClick={() => onChange({ pickup: drop || '', drop: pickup || '' })}
          disabled={!pickup && !drop}
          title="Swap pickup and destination"
          className="ap-focus flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-blue-600 bg-[var(--ap-surface-2)] hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed">
          <ArrowUpDown size={12} /> Swap
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <RouteColumn dot="bg-emerald-500" label="Pickup" value={pickup}
          onChange={v => onChange({ pickup: v })} error={errors.pickup} required placeholder="Where the trip starts" />
        <RouteColumn dot="bg-red-500" label="Destination" value={drop}
          onChange={v => onChange({ drop: v })} error={errors.drop} placeholder="Where the trip ends" />
      </div>
    </div>
  )
}

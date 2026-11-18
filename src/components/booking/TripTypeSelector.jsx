// ─── TripTypeSelector ─────────────────────────────────────────────
// Premium radio-card selector for the six existing trip types.
// Values come straight from TRIP_TYPE_LIST — no database values change.

import { useRef } from 'react'
import {
  ArrowRight, Repeat2, MapPin, CalendarRange, CarFront, KeyRound, Check,
} from 'lucide-react'
import { TRIP_TYPE_LIST } from '../../data/tripTypes'

const ICONS = {
  one_way: ArrowRight,
  round_trip: Repeat2,
  local_visit: MapPin,
  multi_day: CalendarRange,
  rental_with_driver: CarFront,
  self_drive: KeyRound,
}

const TONES = {
  blue:    'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  violet:  'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  amber:   'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  teal:    'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  fuchsia: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400',
}

export default function TripTypeSelector({ value, onChange, error }) {
  const refs = useRef([])

  const move = (from, delta) => {
    const next = (from + delta + TRIP_TYPE_LIST.length) % TRIP_TYPE_LIST.length
    onChange(TRIP_TYPE_LIST[next].id)
    refs.current[next]?.focus()
  }

  return (
    <div>
      <div role="radiogroup" aria-label="Trip type" aria-invalid={!!error}
        className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {TRIP_TYPE_LIST.map((type, i) => {
          const Icon = ICONS[type.id] || CarFront
          const tone  = TONES[type.color] || TONES.blue
          const active = value === type.id
          const cardCls = active
            ? 'border-blue-600 bg-[var(--ap-surface-2)] shadow-sm'
            : 'border-[var(--ap-border)] bg-[var(--ap-surface)] hover:bg-[var(--ap-surface-2)] hover:border-blue-600/40'
          return (
            <button
              key={type.id}
              ref={el => { refs.current[i] = el }}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(type.id)}
              onKeyDown={e => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(i, 1) }
                if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(i, -1) }
              }}
              className={`ap-focus relative flex flex-col items-start gap-2 rounded-2xl border p-3.5 text-left transition-all duration-200 active:scale-[0.98] ${cardCls}`}
            >
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${tone.icon}`}>
                <Icon size={17} strokeWidth={2} />
              </span>
              <span className="text-[12px] font-semibold leading-tight text-slate-800 dark:text-slate-100">
                {type.label}
              </span>
              <span className="text-[10px] leading-snug text-slate-500 dark:text-slate-400 line-clamp-2">
                {type.description}
              </span>
              {active && (
                <span className="absolute top-3 right-3 w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-sm">
                  <Check size={10} strokeWidth={3} />
                </span>
              )}
            </button>
          )
        })}
      </div>
      {error && <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400 mt-1.5">{error}</p>}
    </div>
  )
}

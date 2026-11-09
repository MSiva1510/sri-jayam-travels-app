// ─── StatusPill — refined status indicator ─────────────────────
// Dot + label, restrained tint. Tones: green | amber | red | blue |
// violet | gray. Use for alert priority, attendance, live states.
const TONES = {
  green:  { wrap: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  amber:  { wrap: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',       dot: 'bg-amber-500' },
  red:    { wrap: 'bg-red-500/10 text-red-700 dark:text-red-300',             dot: 'bg-red-500' },
  blue:   { wrap: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',          dot: 'bg-blue-500' },
  violet: { wrap: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',    dot: 'bg-violet-500' },
  gray:   { wrap: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',       dot: 'bg-slate-400' },
}

export default function StatusPill({ tone = 'gray', children, pulse = false, className = '' }) {
  const t = TONES[tone] || TONES.gray
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${t.wrap} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.dot} ${pulse ? 'animate-pulse' : ''}`} aria-hidden="true" />
      {children}
    </span>
  )
}

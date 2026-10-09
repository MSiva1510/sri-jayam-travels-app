// ─── MetricCard — Apple KPI tile ───────────────────────────────
// Neutral value (near-black / white), a single-hue translucent icon
// chip, optional trend pill. Press feedback instead of hover lift.
export const METRIC_TONES = {
  blue:   'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  green:  'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  teal:   'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  amber:  'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  red:    'bg-red-500/10 text-red-600 dark:text-red-400',
  gray:   'bg-slate-500/10 text-slate-500 dark:text-slate-300',
}

export default function MetricCard({
  label, value, sub, icon: Icon, tone = 'blue', trend, trendUp,
  onClick, className = '',
}) {
  const chip = METRIC_TONES[tone] || METRIC_TONES.blue
  const interactive = typeof onClick === 'function'
  const Comp = interactive ? 'button' : 'div'
  return (
    <Comp
      type={interactive ? 'button' : undefined}
      onClick={onClick}
      aria-label={interactive ? `${label}: ${value}${sub ? `, ${sub}` : ''}` : undefined}
      className={`ap-surface ap-focus text-left w-full p-4 transition-transform duration-150 ${interactive ? 'ios-press cursor-pointer' : ''} ${className}`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        {Icon && (
          <span className={`w-9 h-9 rounded-[11px] flex items-center justify-center flex-shrink-0 ${chip}`} aria-hidden="true">
            <Icon size={17} strokeWidth={2.25} />
          </span>
        )}
        {trend !== undefined && (
          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md tabular-nums ${
            trendUp
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-red-500/10 text-red-600 dark:text-red-400'
          }`}>
            {trendUp ? '↑' : '↓'} {trend}%
          </span>
        )}
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400 mb-0.5">
        {label}
      </p>
      <p className="font-sf text-[26px] font-semibold tracking-tight text-slate-900 dark:text-white leading-none tabular-nums">
        {value}
      </p>
      {sub && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">{sub}</p>}
    </Comp>
  )
}

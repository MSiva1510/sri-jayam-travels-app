// ─── DonutChart — shared status donut ──────────────────────────
// The single definition used across pages (extracted from Fleet).
// Segments: [{ label, value, color }]; center shows total + label.
export default function DonutChart({ segments, total, totalLabel }) {
  const R = 52, C = 2 * Math.PI * R
  const sum = segments.reduce((s, g) => s + g.value, 0) || 1
  let acc = 0
  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-shrink-0" style={{ width: 128, height: 128 }}>
        <svg viewBox="0 0 132 132" className="w-full h-full -rotate-90" role="img"
          aria-label={`${totalLabel}: ${segments.map(g => `${g.label} ${g.value}`).join(', ')}`}>
          <circle cx="66" cy="66" r={R} fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="16" />
          {segments.map((g, i) => {
            const frac = g.value / sum
            const el = <circle key={i} cx="66" cy="66" r={R} fill="none" stroke={g.color} strokeWidth="16"
              strokeDasharray={`${(frac * C).toFixed(1)} ${C.toFixed(1)}`} strokeDashoffset={(-acc * C).toFixed(1)} />
            acc += frac
            return el
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="font-sf text-[26px] font-semibold text-slate-900 dark:text-white leading-none tabular-nums">{total}</p>
          <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-1">{totalLabel}</p>
        </div>
      </div>
      <div className="flex-1 space-y-1.5 min-w-0">
        {segments.map(g => (
          <div key={g.label} className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: g.color }} />
            <span className="text-slate-500 dark:text-slate-400 flex-1 truncate">{g.label}</span>
            <span className="font-sf font-semibold text-slate-900 dark:text-white tabular-nums">{g.value}</span>
            <span className="font-sf font-medium tabular-nums w-11 text-right" style={{ color: g.color }}>{Math.round(g.value / sum * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
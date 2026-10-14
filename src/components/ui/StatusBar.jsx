// ─── StatusBar — the interesting donut replacement ─────────────
// Composition as one glowing stacked bar (same area-card idiom as
// SparkChart) + legend with counts and shares + total footer.
// Use everywhere a circle graph used to be.
export default function StatusBar({
  segments = [], total, totalLabel,
  format = (v) => Number(v || 0).toLocaleString('en-IN'),
}) {
  const sum = segments.reduce((s, g) => s + (Number(g.value) || 0), 0)
  const shown = total ?? sum
  if (!segments.length) return null

  return (
    <div>
      <div
        className="flex h-3.5 w-full overflow-hidden rounded-full bg-slate-500/10 dark:bg-white/10 shadow-[inset_0_1px_3px_rgba(0,0,0,0.2)]"
        role="img"
        aria-label={`${totalLabel || 'Total'} ${format(shown)}: ${segments.map(g => `${g.label} ${format(g.value)}`).join(', ')}`}
      >
        {segments.map((g, i) => {
          const v = Number(g.value) || 0
          if (v <= 0 || !sum) return null
          return (
            <div
              key={g.label || i}
              title={`${g.label}: ${format(v)}`}
              className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-500"
              style={{
                width: `${(v / sum) * 100}%`,
                background: `linear-gradient(180deg, ${g.color}, ${g.color})`,
                boxShadow: `0 0 8px ${g.color}66, inset 0 1px 0 rgba(255,255,255,0.45)`,
              }}
            />
          )
        })}
      </div>
      <div className="mt-3 space-y-1.5">
        {segments.map((g, i) => {
          const v = Number(g.value) || 0
          return (
            <div key={g.label || i} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: g.color, boxShadow: `0 0 6px ${g.color}88` }} />
              <span className="text-slate-500 dark:text-slate-400 flex-1 truncate">{g.label}</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{format(v)}</span>
              <span className="font-bold tabular-nums w-11 text-right" style={{ color: g.color }}>
                {sum ? Math.round((v / sum) * 100) : 0}%
              </span>
            </div>
          )
        })}
      </div>
      {(total !== undefined || totalLabel) && (
        <div className="mt-3 pt-2.5 border-t ap-hairline flex justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>{totalLabel || 'Total'}</span>
          <span className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{format(shown)}</span>
        </div>
      )}
    </div>
  )
}

// ─── Analytics lists ───────────────────────────────────────────
// Time-series graphs and composition visuals live in the shared kit
// now (SparkChart areas + StatusBar). This module keeps the ranked
// helpers: horizontal mini-bar lists and stat pills.
// Fully responsive, dark-mode aware via Tailwind.

// ── 1. Horizontal mini-bar list ─────────────────────────────────
export function MiniBarList({ items = [], valueKey = 'value', labelKey = 'label', color = 'bg-gradient-to-r from-blue-500 to-indigo-500', suffix = '' }) {
  const max = Math.max(1, ...items.map(x => Number(x[valueKey] ?? 0)))
  if (!items.length) return <Empty />
  return (
    <div className="space-y-2.5">
      {items.map((item, i) => {
        const val = Number(item[valueKey] ?? 0)
        const pct = Math.round((val / max) * 100)
        return (
          <div key={i}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-600 dark:text-slate-300 font-medium truncate max-w-[160px]">{item[labelKey]}</span>
              <span className="font-bold text-slate-700 dark:text-slate-200 flex-shrink-0 ml-2">{val.toLocaleString('en-IN')}{suffix}</span>
            </div>
            <div className="h-1.5 bg-[var(--ap-surface-2)] rounded-full overflow-hidden">
              <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── 2. Stat pill ────────────────────────────────────────────────
export function StatPill({ label, value, color = 'bg-slate-100 text-slate-700 dark:bg-[var(--ap-surface-2)] dark:text-slate-300' }) {
  return (
    <div className={`flex flex-col items-center px-3 py-2 rounded-xl ${color}`}>
      <span className="text-lg font-semibold leading-none">{value}</span>
      <span className="text-[10px] mt-0.5 opacity-80 uppercase tracking-wide font-bold">{label}</span>
    </div>
  )
}

// ── Empty state ─────────────────────────────────────────────────
function Empty({ size }) {
  return (
    <div className="flex items-center justify-center text-xs text-slate-400 dark:text-slate-600 py-4 w-full" style={size ? {width:size,height:size} : {}}>
      No data
    </div>
  )
}

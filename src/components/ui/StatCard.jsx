// ─── StatCard — iPhone widget style ─────────────────────────────
// 20pt rounded card, squircle icon, tabular numbers, tap feedback.
// Decorative layers are aria-hidden; content stays a plain reading order.

export default function StatCard({ label, value, sub, icon: Icon, gradient, trend, trendUp }) {
  return (
    <div className="ios-card ios-press p-4 animate-fade-up">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center ${gradient || 'bg-slate-400'} shadow-md`} aria-hidden="true">
          {Icon ? <Icon size={19} className="text-white" strokeWidth={2.25} /> : null}
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full tabular-nums ${
            trendUp
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
              : 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'
          }`}>
            {trendUp ? '↑' : '↓'} {trend}%
          </span>
        )}
      </div>

      <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-0.5">
        {label}
      </p>
      <p className="text-[22px] font-display font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight tabular-nums">
        {value}
      </p>
      {sub && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{sub}</p>
      )}
    </div>
  )
}

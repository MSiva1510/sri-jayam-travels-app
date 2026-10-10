// ─── Callout — inline alert / notice ───────────────────────────
// Single-hue tinted banner with optional action. Extracted from the
// Dashboard so every page shares one notice style.
const TONES = {
  red:    { wrap: 'bg-red-500/10 border-red-500/20',       text: 'text-red-700 dark:text-red-300',          btn: 'bg-red-600 hover:bg-red-500' },
  amber:  { wrap: 'bg-amber-500/10 border-amber-500/20',   text: 'text-amber-700 dark:text-amber-300',      btn: 'bg-amber-600 hover:bg-amber-500' },
  blue:   { wrap: 'bg-blue-500/10 border-blue-500/20',     text: 'text-blue-700 dark:text-blue-300',        btn: 'bg-blue-600 hover:bg-blue-500' },
  violet: { wrap: 'bg-violet-500/10 border-violet-500/20', text: 'text-violet-700 dark:text-violet-300',    btn: 'bg-violet-600 hover:bg-violet-500' },
  green:  { wrap: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300', btn: 'bg-emerald-600 hover:bg-emerald-500' },
}

export default function Callout({
  tone = 'blue', icon: Icon, title, sub, actionLabel, onAction, actionDisabled, className = '', children,
}) {
  const t = TONES[tone] || TONES.blue
  return (
    <div className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 flex-wrap ${t.wrap} ${className}`}>
      <div className="flex items-center gap-2.5 min-w-[200px] flex-1">
        {Icon && (
          <span className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${t.text}`} aria-hidden="true">
            <Icon size={15} strokeWidth={2.25} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${t.text}`}>{title}</p>
          {sub && <p className={`text-xs opacity-80 ${t.text}`}>{sub}</p>}
          {children}
        </div>
      </div>
      {actionLabel && (
        <button onClick={onAction} disabled={actionDisabled}
          className={`px-3 py-1.5 rounded-xl text-white text-xs font-semibold transition-all active:scale-95 shadow-sm flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${t.btn}`}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}

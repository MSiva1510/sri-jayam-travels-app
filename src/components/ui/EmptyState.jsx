// ─── EmptyState — calm empty/placeholder card ──────────────────
export default function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center gap-2 py-10 px-6 ${className}`}>
      {Icon && (
        <span className="w-11 h-11 rounded-2xl bg-slate-500/10 text-slate-400 dark:text-slate-500 flex items-center justify-center mb-1" aria-hidden="true">
          <Icon size={20} strokeWidth={2} />
        </span>
      )}
      {title && <p className="font-sf text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p>}
      {description && <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

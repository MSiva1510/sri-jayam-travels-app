// ─── SectionHeader — eyebrow + title + trailing action ─────────
// Apple grouping header: quiet uppercase eyebrow, tight title.
export default function SectionHeader({
  eyebrow, title, badge, action, className = '',
}) {
  return (
    <div className={`flex items-end justify-between gap-4 flex-wrap ${className}`}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
            {eyebrow}
          </p>
        )}
        <h3 className="font-sf text-[17px] font-semibold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <span className="truncate">{title}</span>
          {badge}
        </h3>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}

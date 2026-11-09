export default function PageHeader({ title, subtitle, action, compact, icon: Icon }) {
  return (
    <div className={`flex items-start justify-between gap-4 flex-wrap ${compact ? 'mb-3' : 'mb-6'}`}>
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <span className="w-10 h-10 rounded-[12px] bg-[var(--ap-accent)] flex items-center justify-center flex-shrink-0" aria-hidden="true">
            <Icon size={18} className="text-white" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className={`font-sf font-semibold text-slate-900 dark:text-white ${compact ? 'text-xl' : 'text-2xl'}`}>
            {title}
          </h1>
          {subtitle && (
            <p className={`${compact ? 'text-xs' : 'text-sm'} text-slate-500 dark:text-slate-400 mt-0.5`}>{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

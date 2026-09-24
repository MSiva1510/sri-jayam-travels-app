export default function PageHeader({ title, subtitle, action, compact }) {
  return (
    <div className={`flex items-start justify-between gap-4 flex-wrap ${compact ? 'mb-3' : 'mb-6'}`}>
      <div>
        <h1 className={`font-display font-black text-slate-800 dark:text-white ${compact ? 'text-xl' : 'text-2xl'}`}>
          {title}
        </h1>
        {subtitle && (
          <p className={`${compact ? 'text-xs' : 'text-sm'} text-slate-500 dark:text-slate-400 mt-0.5`}>{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

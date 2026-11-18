// ─── FormSection ──────────────────────────────────────────────────
// Quiet section heading for the Create Booking form — hierarchy without
// stacking extra cards (Apple-style: spacing + typography do the work).

export default function FormSection({ icon: Icon, title, subtitle, action, children, className = '' }) {
  return (
    <section className={`space-y-3 ${className}`}>
      <div className="flex items-start gap-2.5">
        {Icon && (
          <span className="w-8 h-8 rounded-xl bg-[var(--ap-surface-2)] text-blue-600 flex items-center justify-center flex-shrink-0">
            <Icon size={15} strokeWidth={2} />
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-sf text-[13px] font-semibold tracking-tight text-[var(--ap-text-1)]">
              {title}
            </h4>
            {action}
          </div>
          {subtitle && (
            <p className="text-[11px] leading-snug text-[var(--ap-text-3)] mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  )
}

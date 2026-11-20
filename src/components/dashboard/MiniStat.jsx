import { METRIC_TONES } from '../ui/MetricCard'

// Compact metric tile shared by the fleet, customer and payroll summaries.
export default function MiniStat({ icon: Icon, value, label, tone = 'blue', onClick }) {
  const chip = METRIC_TONES[tone] || METRIC_TONES.blue
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`ap-surface ap-focus p-3.5 flex items-center gap-3 text-left w-full ${onClick ? 'ios-press cursor-pointer' : ''}`}
    >
      <span className={`w-9 h-9 rounded-[11px] flex items-center justify-center flex-shrink-0 ${chip}`} aria-hidden="true">
        <Icon size={16} strokeWidth={2.25} />
      </span>
      <span className="min-w-0">
        <span className="block font-sf text-xl font-semibold leading-none tracking-tight text-slate-900 dark:text-white tabular-nums">{value}</span>
        <span className="block text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-tight">{label}</span>
      </span>
    </Comp>
  )
}

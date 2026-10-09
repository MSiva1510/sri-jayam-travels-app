// ─── IconButton — small square icon action ─────────────────────
const TONES = {
  default: 'text-slate-500 dark:text-slate-400 hover:bg-slate-500/10 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white',
  brand:   'text-slate-400 hover:text-blue-600 hover:bg-blue-500/10 dark:hover:bg-blue-500/15',
  danger:  'text-slate-400 hover:text-red-600 hover:bg-red-500/10',
}

export default function IconButton({ icon: Icon, label, onClick, size = 14, tone = 'default', className = '', ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`ap-focus w-8 h-8 rounded-lg inline-flex items-center justify-center transition-colors disabled:opacity-40 disabled:pointer-events-none ${TONES[tone] || TONES.default} ${className}`}
      {...rest}
    >
      <Icon size={size} />
    </button>
  )
}

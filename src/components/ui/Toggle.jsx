export default function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group select-none">
      <div
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-all duration-300 flex-shrink-0 ${
          checked
            ? 'bg-navy-800 dark:bg-navy-400'
            : 'bg-navy-200 dark:bg-white/20'
        }`}
      >
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-300 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`} />
      </div>
      {label && (
        <span className="text-sm font-medium text-navy-700 dark:text-white/70 group-hover:text-navy-900 dark:group-hover:text-white transition-colors">
          {label}
        </span>
      )}
    </label>
  )
}

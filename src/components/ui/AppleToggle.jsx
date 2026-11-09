// ─── AppleToggle — shared iOS-style switch ──────────────────────
// Replaces the per-page local Toggle copies as pages adopt skins.
export default function AppleToggle({ checked, onChange, size = 'md', label, disabled = false }) {
  const dims = size === 'sm'
    ? { track: 'w-10 h-6', knob: 'w-[20px] h-[20px]', on: 'translate-x-4', off: 'translate-x-0.5' }
    : { track: 'w-[51px] h-[31px]', knob: 'w-[27px] h-[27px]', on: 'translate-x-[22px]', off: 'translate-x-0.5' }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={label || 'Toggle'}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`relative rounded-full transition-colors duration-200 flex-shrink-0 disabled:opacity-40 ${
        dims.track
      } ${checked
        ? 'bg-[var(--ap-accent)] shadow-[inset_0_1px_3px_rgba(0,0,0,0.25),0_1px_2px_rgba(37,99,235,0.4)]'
        : 'bg-slate-300 dark:bg-white/15 border border-black/10 dark:border-white/10 shadow-[inset_0_1px_3px_rgba(0,0,0,0.2)]'}`}
    >
      <span className={`absolute top-0.5 left-0 ${dims.knob} bg-white rounded-full shadow-[0_2px_5px_rgba(0,0,0,0.35),0_0_1px_rgba(0,0,0,0.3)] transition-transform duration-200 ${checked ? dims.on : dims.off}`} />
    </button>
  )
}

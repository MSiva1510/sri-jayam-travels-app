// ─── SegmentedControl — macOS-style segmented picker ───────────
// Accessible tablist; arrow-key navigation; controlled value.
import { useRef } from 'react'

export default function SegmentedControl({
  options = [], value, onChange, ariaLabel, className = '', scroll = false,
}) {
  const ref = useRef(null)

  const move = (dir) => {
    const i = options.findIndex(o => o.key === value)
    if (i === -1) return
    const next = options[(i + dir + options.length) % options.length]
    if (next) onChange?.(next.key)
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(1) }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
    else if (e.key === 'Home') { e.preventDefault(); onChange?.(options[0]?.key) }
    else if (e.key === 'End') { e.preventDefault(); onChange?.(options[options.length - 1]?.key) }
  }

  return (
    <div ref={ref} role="radiogroup" aria-label={ariaLabel}
      className={`ap-seg ${scroll ? 'max-w-full overflow-x-auto no-scrollbar' : ''} ${className}`} onKeyDown={onKeyDown}>
      {options.map(o => {
        const active = value === o.key
        const OptionIcon = o.icon
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange?.(o.key)}
            className={`ap-seg-btn inline-flex items-center gap-1.5 ${active ? 'ap-seg-active' : ''}`}
          >
            {OptionIcon && <OptionIcon size={13} />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── AppleSlider — iOS-style slider ─────────────────────────────
// Drag / tap / arrow keys. Track fills with accent; thumb is a white
// physical knob with drop shadow (skeuomorphic affordance).
import { useRef } from 'react'

export default function AppleSlider({
  min = 0, max = 100, step = 1, value = 0, onChange,
  label, format, disabled = false,
}) {
  const trackRef = useRef(null)

  const ratio = max === min ? 0 : Math.min(1, Math.max(0, (value - min) / (max - min)))

  const setFromClientX = (clientX) => {
    const el = trackRef.current
    if (!el || disabled) return
    const r = el.getBoundingClientRect()
    const t = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    const stepped = Math.round((min + t * (max - min)) / step) * step
    onChange?.(Math.min(max, Math.max(min, stepped)))
  }

  return (
    <div className={disabled ? 'opacity-50 pointer-events-none' : ''}>
      {(label || format) && (
        <div className="flex items-baseline justify-between mb-2">
          {label && <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>}
          {format && <span className="text-sm font-bold text-slate-800 dark:text-slate-100 tabular-nums">{format(value)}</span>}
        </div>
      )}
      <div
        ref={trackRef}
        className="apple-slider-track"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId)
          setFromClientX(e.clientX)
          const move = (ev) => setFromClientX(ev.clientX)
          const up = () => {
            e.currentTarget.removeEventListener('pointermove', move)
            e.currentTarget.removeEventListener('pointerup', up)
          }
          e.currentTarget.addEventListener('pointermove', move)
          e.currentTarget.addEventListener('pointerup', up)
        }}
      >
        <div className="apple-slider-fill" style={{ width: `${ratio * 100}%` }} />
        <div
          className="apple-slider-thumb"
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={label || 'Slider'}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          style={{ left: `calc(${(ratio * 100).toFixed(2)}% - 14px)` }}
          onKeyDown={(e) => {
            if (disabled) return
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange?.(Math.min(max, value + step)) }
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange?.(Math.max(min, value - step)) }
            else if (e.key === 'Home') { e.preventDefault(); onChange?.(min) }
            else if (e.key === 'End') { e.preventDefault(); onChange?.(max) }
          }}
        />
      </div>
    </div>
  )
}

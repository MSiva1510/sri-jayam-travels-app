// ─── WheelPicker — iOS-style drum picker ────────────────────────
// columns: [{ values: [...], value, onChange, label }]
// Scroll-snap column(s) with a centred selection band. Controlled:
// scroll settles → nearest row wins → onChange fires.
import { useEffect, useRef } from 'react'

const ITEM_H = 36

function Column({ values = [], value, onChange, label }) {
  const ref = useRef(null)
  const skipRef = useRef(false)
  const valueRef = useRef(value)
  valueRef.current = value
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const idx = Math.max(0, values.indexOf(value))

  // Keep the drum on the controlled value (trip switches, resets).
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const target = idx * ITEM_H
    if (Math.abs(el.scrollTop - target) > 2) {
      skipRef.current = true
      el.scrollTo({ top: target })
      const t = setTimeout(() => { skipRef.current = false }, 80)
      return () => clearTimeout(t)
    }
  }, [idx])

  const settle = () => {
    const el = ref.current
    if (!el || skipRef.current) return
    const i = Math.min(values.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)))
    if (values[i] !== undefined && values[i] !== valueRef.current) onChangeRef.current?.(values[i])
    else el.scrollTo({ top: i * ITEM_H, behavior: 'smooth' })
  }

  return (
    <div className="flex-1 min-w-0">
      {label && (
        <p className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">{label}</p>
      )}
      <div className="relative">
        <div className="apple-wheel" ref={ref}
          onScroll={() => { clearTimeout(ref.current?._t); ref.current._t = setTimeout(settle, 130) }}>
          <div style={{ height: ITEM_H * 2 }} />
          {values.map((v, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onChangeRef.current?.(v)}
              className={`apple-wheel-item ${v === value ? 'apple-wheel-item-active' : ''}`}
              style={{ height: ITEM_H }}
            >
              {String(v)}
            </button>
          ))}
          <div style={{ height: ITEM_H * 2 }} />
        </div>
        <div className="apple-wheel-band" aria-hidden="true" />
      </div>
    </div>
  )
}

export default function WheelPicker({ columns = [] }) {
  return (
    <div className="apple-wheel-wrap">
      <div className="flex gap-1 relative">
        {columns.map((c, i) => (
          <Column key={c.key || i} values={c.values} value={c.value} onChange={c.onChange} label={c.label} />
        ))}
      </div>
    </div>
  )
}

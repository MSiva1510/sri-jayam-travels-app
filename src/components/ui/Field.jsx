// ─── Field — form primitives ───────────────────────────────────
// Text/Select/Textarea on the .ap-field material, 48px touch target,
// labeled with hint/error support. Additive; pages opt in.
import { ChevronDown } from 'lucide-react'

const base = 'ap-field ap-focus w-full h-12 rounded-[12px] px-3.5 text-sm font-medium outline-none transition-colors'
export const fieldCls = base

export function Input(props) {
  return <input className={base} {...props} />
}

export function Select({ children, ...props }) {
  return (
    <span className="relative block">
      <select className={`${base} appearance-none pr-9 cursor-pointer`} {...props}>
        {children}
      </select>
      <ChevronDown size={14} strokeWidth={2.5}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" aria-hidden="true" />
    </span>
  )
}

export function Textarea({ rows = 3, ...props }) {
  return <textarea className={`${base} h-auto min-h-[72px] py-3 leading-relaxed resize-y`} rows={rows} {...props} />
}

export default function Field({
  label, htmlFor, hint, error, children, required, className = '',
}) {
  const descId = htmlFor ? `${htmlFor}-${error ? 'err' : 'hint'}` : undefined
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-slate-700 dark:text-slate-200">
          {label}
          {required && <span className="text-red-600 dark:text-red-400 ml-0.5" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={descId} role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
      ) : hint ? (
        <p id={descId} className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </div>
  )
}
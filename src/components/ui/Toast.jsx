// ─── Toast — shared notification system ────────────────────────
// Single ToastProvider mounted once in the tree; pages call
// useToast().toast({ type, title, description }). Renders a
// portal stack (top-right, top-center on small screens). Motion
// respects prefers-reduced-motion via the global CSS guard.
import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react'

const ToastCtx = createContext(null)
export const useToast = () => useContext(ToastCtx)

let seed = 0
const ICON = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}
const TONE = {
  success: 'text-emerald-600 dark:text-emerald-400',
  error:   'text-red-600 dark:text-red-400',
  warning: 'text-amber-600 dark:text-amber-400',
  info:    'text-blue-600 dark:text-blue-400',
}

function ToastItem({ t, onClose }) {
  const Icon = ICON[t.type] || Info
  return (
    <div
      role="status"
      className="ap-surface-elevated pointer-events-auto animate-fade-up flex items-start gap-2.5 rounded-2xl px-3.5 py-3"
    >
      <span className={`mt-0.5 flex-shrink-0 ${TONE[t.type] || TONE.info}`} aria-hidden="true">
        <Icon size={17} strokeWidth={2.25} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">{t.title}</p>
        {t.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{t.description}</p>}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss notification"
        className="ap-focus flex-shrink-0 p-1 -m-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id))
    const h = timers.current.get(id)
    if (h) { clearTimeout(h); timers.current.delete(id) }
  }, [])

  const toast = useCallback(({ type = 'info', title, description, duration = 3800 } = {}) => {
    const id = ++seed
    setToasts(prev => [...prev.slice(-4), { id, type, title, description }])
    timers.current.set(id, setTimeout(() => dismiss(id), duration))
    return id
  }, [dismiss])

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <div
          aria-live="polite"
          aria-label="Notifications"
          className="pointer-events-none fixed top-4 right-4 z-[9999] flex w-[min(92vw,360px)] flex-col gap-2"
        >
          {toasts.map(t => <ToastItem key={t.id} t={t} onClose={() => dismiss(t.id)} />)}
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  )
}
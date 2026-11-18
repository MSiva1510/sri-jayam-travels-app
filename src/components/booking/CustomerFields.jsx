// ─── CustomerFields ───────────────────────────────────────────────
// Search + autocomplete + mobile autofill for the booking form.
// Reuses the existing customer store; new customers are still created
// by the existing upsertCustomerFromBooking() call on save.

import { useEffect, useRef, useState } from 'react'
import { Search, Phone, UserPlus, Check, Loader2 } from 'lucide-react'
import { fieldCls } from '../ui/Field'
import { loadCustomers, findCustomerByMobile } from '../../data/customerData'

// Same customer-name sanitisation the previous booking form applied.
function cleanName(value) {
  return String(value).replace(/[^a-zA-Z0-9\s\-'.&()]/g, '').slice(0, 60)
}

export default function CustomerFields({ name, contact, onChange, errors = {}, inputRef }) {
  const [customers, setCustomers] = useState([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [recognized, setRecognized] = useState(null)
  const [lookingUp, setLookingUp] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    let alive = true
    loadCustomers()
      .then(rows => { if (alive) setCustomers(Array.isArray(rows) ? rows.filter(c => !c._deleted) : []) })
      .catch(() => { if (alive) setCustomers([]) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    const onDown = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // 10-digit mobile lookup: safely fills the name only when it is empty,
  // so a manager typing a different name is never overwritten.
  useEffect(() => {
    if (!/^\d{10}$/.test(contact || '')) { setRecognized(null); setLookingUp(false); return }
    let alive = true
    setLookingUp(true)
    findCustomerByMobile(contact)
      .then(c => {
        if (!alive) return
        setRecognized(c || null)
        if (c?.name && !String(name || '').trim()) onChange({ customer: c.name })
      })
      .catch(() => { if (alive) setRecognized(null) })
      .finally(() => { if (alive) setLookingUp(false) })
    return () => { alive = false }
    // name/onChange intentionally excluded: the lookup must only react to mobile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact])

  const query = String(name || '').trim().toLowerCase()
  const suggestions = query.length >= 2
    ? customers.filter(c =>
        (c.name || '').toLowerCase().includes(query) || (c.mobile || '').includes(query)
      ).slice(0, 5)
    : []

  const select = c => {
    onChange({ customer: c.name, contact: c.mobile || contact })
    setRecognized(c)
    setOpen(false)
  }

  const onNameKey = e => {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => (i + 1) % suggestions.length) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => (i - 1 + suggestions.length) % suggestions.length) }
    if (e.key === 'Enter') { e.preventDefault(); select(suggestions[active] || suggestions[0]) }
    if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="relative" ref={wrapRef}>
        <label htmlFor="bk-customer" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
          Customer name<span className="text-red-500 ml-1">*</span>
        </label>
        <div className="relative">
          <input
            id="bk-customer"
            ref={inputRef}
            type="text"
            value={name || ''}
            autoComplete="off"
            placeholder="Search existing or enter new name"
            aria-invalid={!!errors.customer}
            onChange={e => {
              const next = cleanName(e.target.value)
              onChange({ customer: next })
              setOpen(next.trim().length >= 2)
              setActive(0)
            }}
            onFocus={() => { if (String(name || '').trim().length >= 2) setOpen(true) }}
            onKeyDown={onNameKey}
            className={`${fieldCls} pl-10`}
          />
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
        {errors.customer && <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400 mt-1">{errors.customer}</p>}

        {open && suggestions.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 ap-surface-elevated border border-[var(--ap-border)] rounded-2xl shadow-xl overflow-hidden max-h-60 overflow-y-auto animate-fade-up">
            {suggestions.map((c, i) => (
              <button key={c.id || `${c.name}-${i}`} type="button" onClick={() => select(c)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${i === active ? 'bg-[var(--ap-surface-2)]' : 'hover:bg-[var(--ap-surface-2)]'}`}>
                <span className="w-8 h-8 rounded-full bg-blue-600/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-blue-600">
                  {(c.name || '?').charAt(0).toUpperCase()}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-semibold text-[var(--ap-text-1)] truncate">{c.name}</span>
                  <span className="block text-[10px] text-[var(--ap-text-3)]">{c.mobile || 'No mobile on file'}</span>
                </span>
                <Check size={13} className="text-blue-600 flex-shrink-0" />
              </button>
            ))}
            <div className="border-t border-[var(--ap-border)] px-3 py-2 text-[10px] text-[var(--ap-text-3)]">
              Select a customer, or keep typing to add a new one
            </div>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="bk-contact" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
          Mobile number
        </label>
        <div className="relative">
          <input
            id="bk-contact"
            type="tel"
            inputMode="numeric"
            value={contact || ''}
            placeholder="10-digit mobile"
            aria-invalid={!!errors.contact}
            onChange={e => onChange({ contact: e.target.value.replace(/\D/g, '').slice(0, 10) })}
            className={`${fieldCls} pl-10`}
          />
          <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          {lookingUp && <Loader2 size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-blue-600 animate-spin" />}
        </div>
        {errors.contact && <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400 mt-1">{errors.contact}</p>}
        {!errors.contact && recognized && (
          <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            <Check size={11} /> Existing customer · {recognized.name}
          </p>
        )}
        {!errors.contact && !recognized && /^\d{10}$/.test(contact || '') && !lookingUp && (
          <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-[var(--ap-text-3)]">
            <UserPlus size={11} /> New number — a customer record will be created on save
          </p>
        )}
      </div>
    </div>
  )
}

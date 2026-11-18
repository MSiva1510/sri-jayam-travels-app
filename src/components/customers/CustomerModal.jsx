// ─── CustomerModal — premium Add/Edit Customer form ───────────────
// UI-only redesign. Every field, validation rule, and payload key is
// unchanged from the previous inline modal in Customers.jsx.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  UserRound, MapPin, StickyNote, HeartHandshake, Building2,
  SlidersHorizontal, Star, Repeat2, Ban, Check, X, Loader2, AlertCircle,
  Phone, Mail,
} from 'lucide-react'
import ModalOverlay from '../ui/ModalOverlay'
import Button from '../ui/Button'
import IconButton from '../ui/IconButton'
import SegmentedControl from '../ui/SegmentedControl'
import { fieldCls } from '../ui/Field'
import { CUSTOMER_TYPES, generateCustomerId } from '../../data/customerData'
import {
  EMPTY_CUSTOMER, FIELD_RESTRICTIONS, sanitizeField,
  validateCustomerForm, buildCustomerPayload, isBusinessCustomer,
} from '../../utils/customerForm'

function Section({ icon: Icon, title, subtitle, children, className = '' }) {
  return (
    <section className={`space-y-3 ${className}`}>
      <div className="flex items-start gap-2.5">
        <span className="w-8 h-8 rounded-xl bg-[var(--ap-surface-2)] text-[var(--ap-accent)] flex items-center justify-center flex-shrink-0">
          <Icon size={15} strokeWidth={2} />
        </span>
        <div className="flex-1 min-w-0">
          <h4 className="font-sf text-[13px] font-semibold tracking-tight text-[var(--ap-text-1)]">
            {title}
          </h4>
          {subtitle && (
            <p className="text-[11px] leading-snug text-[var(--ap-text-3)] mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  )
}

function TextField({
  field, label, value, onChange, onBlur, error, type = 'text', inputMode,
  required, placeholder, icon: Icon, counter = true, inputRef,
}) {
  const rule = FIELD_RESTRICTIONS[field]
  const max = rule?.maxLength
  const length = String(value ?? '').length
  const id = `cus-${field}`

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <label htmlFor={id} className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
          {label}{required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {max && counter && (
          <span className={`text-[10px] font-semibold tabular-nums ${
            length > max * 0.9 ? 'text-red-500' : length > max * 0.7 ? 'text-amber-500' : 'text-[var(--ap-text-3)]'
          }`}>
            {length}/{max}
          </span>
        )}
      </div>
      <div className="relative">
        {Icon && (
          <Icon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        )}
        <input
          ref={inputRef}
          id={id}
          name={field}
          type={type}
          inputMode={inputMode}
          value={value ?? ''}
          placeholder={placeholder || rule?.placeholder}
          maxLength={max || undefined}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={e => onChange(sanitizeField(field, e.target.value))}
          onBlur={onBlur}
          className={`${fieldCls} ${Icon ? 'pl-10' : ''} ${error ? '!border-red-400 dark:!border-red-500' : ''}`}
        />
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-red-600 dark:text-red-400">
          <AlertCircle size={11} className="flex-shrink-0" /> {error}
        </p>
      )}
    </div>
  )
}

function AutoTextarea({ value, onChange, ...props }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 88), 200)}px`
  }, [value])
  return <textarea ref={ref} value={value} onChange={onChange} {...props} />
}

const FLAGS = [
  {
    key: 'isVip', label: 'VIP Customer', Icon: Star,
    active: 'border-amber-400/70 bg-amber-50/80 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300',
    chip: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
  },
  {
    key: 'isFrequentTraveller', label: 'Frequent Traveller', Icon: Repeat2,
    active: 'border-blue-500/60 bg-blue-50/80 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
    chip: 'bg-blue-500/15 text-blue-600 dark:text-blue-300',
  },
  {
    key: 'isBlacklisted', label: 'Blacklisted', Icon: Ban,
    active: 'border-red-400/70 bg-red-50/80 text-red-700 dark:bg-red-500/10 dark:text-red-300',
    chip: 'bg-red-500/15 text-red-600 dark:text-red-300',
  },
]

export default function CustomerModal({ customer, onClose, onSave }) {
  const isEdit = !!customer?.id
  // Edit keeps the exact incoming shape; new customers get the original defaults.
  const [form, setForm] = useState(() => customer ? { ...customer } : { ...EMPTY_CUSTOMER })
  const [serverErrors, setServerErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [blacklistConfirmed, setBlacklistConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [closing, setClosing] = useState(false)
  const savingRef = useRef(false)
  const closeTimer = useRef(null)
  const dialogRef = useRef(null)
  const firstFieldRef = useRef(null)

  const validation = useMemo(() => validateCustomerForm(form), [form])
  const errors = useMemo(() => {
    const visible = { ...serverErrors }
    Object.entries(validation).forEach(([field, message]) => {
      if (submitted || touched[field]) visible[field] = message
    })
    return visible
  }, [serverErrors, validation, submitted, touched])

  const upd = patch => {
    setForm(prev => ({ ...prev, ...patch }))
    setServerErrors(prev => {
      if (!Object.keys(prev).length) return prev
      const next = { ...prev }
      Object.keys(patch).forEach(key => { delete next[key] })
      return next
    })
  }

  const markTouched = field => setTouched(prev => ({ ...prev, [field]: true }))

  const requestClose = () => {
    if (savingRef.current || closing) return
    setClosing(true)
    closeTimer.current = window.setTimeout(onClose, 150)
  }

  useEffect(() => () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
  }, [])

  useEffect(() => { firstFieldRef.current?.focus() }, [])
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape' && !e.defaultPrevented) requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saving, closing])

  // Keep Tab inside the dialog (native inputs/buttons only).
  useEffect(() => {
    const node = dialogRef.current
    if (!node) return
    const onTab = e => {
      if (e.key !== 'Tab') return
      const focusable = Array.from(node.querySelectorAll(
        'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter(el => el.tabIndex >= 0 && (el.offsetParent !== null || el === document.activeElement))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    node.addEventListener('keydown', onTab)
    return () => node.removeEventListener('keydown', onTab)
  }, [])

  const toggleFlag = key => {
    const next = !form[key]
    if (key === 'isBlacklisted') {
      if (!next) {
        setBlacklistConfirmed(false)
        upd({ isBlacklisted: false })
        return
      }
      const ok = window.confirm(
        'Blacklist this customer? Blacklisted customers are flagged for review and may be blocked from bookings. Continue?'
      )
      if (!ok) return
      setBlacklistConfirmed(true)
    }
    upd({ [key]: next })
  }

  const handleSubmit = async () => {
    if (savingRef.current || closing) return
    setSubmitted(true)
    const found = validateCustomerForm(form)
    if (Object.keys(found).length) {
      requestAnimationFrame(() => {
        dialogRef.current?.querySelector('[aria-invalid="true"]')?.focus()
      })
      return
    }
    if (form.isBlacklisted && !blacklistConfirmed) {
      const ok = window.confirm('This customer is marked Blacklisted. Save this status?')
      if (!ok) return
      setBlacklistConfirmed(true)
    }
    savingRef.current = true
    setSaving(true)
    setServerErrors({})
    const payload = buildCustomerPayload(form, {
      now: new Date().toISOString(),
      newId: generateCustomerId(),
    })
    let saved = false
    try {
      await onSave(payload)
      saved = true
    } catch (err) {
      const info = err && typeof err === 'object' ? err : { message: String(err) }
      if (info.field) {
        setServerErrors({ [info.field]: info.message })
      } else {
        setServerErrors({ _general: info.message || 'Could not save customer. Please try again.' })
      }
    } finally {
      savingRef.current = false
      setSaving(false)
      if (saved) requestClose()
    }
  }

  const requiredValid = !validation.name && !validation.mobile

  return (
    <ModalOverlay onClose={requestClose} closing={closing}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-modal-title"
        className={`w-full h-[100dvh] sm:h-auto sm:w-[680px] lg:w-[700px] max-h-[100dvh] sm:max-h-[90vh] ap-surface rounded-none sm:rounded-[22px] border border-[var(--ap-border)] shadow-2xl flex flex-col animate-fade-up transition-[transform,opacity] duration-150 ease-out overflow-hidden ${
          closing ? 'opacity-0 translate-y-2 sm:translate-y-0 sm:scale-[0.98]' : ''
        }`}
      >
        {/* Fixed header */}
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b border-[var(--ap-border)] flex-shrink-0 bg-[var(--ap-surface)]">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-[var(--ap-text-3)] uppercase tracking-[0.14em]">
              Customer Management
            </p>
            <h3 id="customer-modal-title" className="font-sf font-semibold text-[17px] tracking-tight text-[var(--ap-text-1)] truncate mt-0.5">
              {isEdit ? 'Edit Customer' : 'New Customer'}
            </h3>
            <p className="text-[11px] text-[var(--ap-text-3)] mt-0.5">
              {isEdit ? 'Update customer information and preferences.' : 'Add customer information and preferences.'}
            </p>
          </div>
          <IconButton icon={X} label="Close customer form" size={16} onClick={requestClose}
            className="w-9 h-9 rounded-xl bg-[var(--ap-surface-2)] flex-shrink-0" />
        </div>

        {/* Scrollable form */}
        <div className="overflow-y-auto scroll-smooth flex-1 px-4 sm:px-6 py-5 space-y-6">
          {errors._general && (
            <div role="alert" className="rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 px-3.5 py-3 flex items-start gap-2">
              <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-red-700 dark:text-red-300">{errors._general}</p>
            </div>
          )}

          <Section icon={UserRound} title="Customer information"
            subtitle="Basic contact details for this customer.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2">
                <TextField
                  field="name" label="Customer Name" required
                  value={form.name} onChange={v => upd({ name: v })} error={errors.name}
                  onBlur={() => markTouched('name')} inputRef={firstFieldRef}
                />
              </div>
              <TextField
                field="mobile" label="Mobile Number" required type="tel" inputMode="numeric" icon={Phone}
                value={form.mobile} onChange={v => upd({ mobile: v })} error={errors.mobile}
                onBlur={() => markTouched('mobile')}
              />
              <TextField
                field="altMobile" label="Alternate Number" type="tel" inputMode="numeric"
                value={form.altMobile} onChange={v => upd({ altMobile: v })} error={errors.altMobile}
                onBlur={() => markTouched('altMobile')}
              />
              <TextField
                field="email" label="Email" type="email" icon={Mail}
                value={form.email} onChange={v => upd({ email: v })} error={errors.email}
                onBlur={() => markTouched('email')}
              />
              <div className="min-w-0">
                <p className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
                  Customer Type
                </p>
                <SegmentedControl
                  ariaLabel="Customer type"
                  options={CUSTOMER_TYPES}
                  value={form.type}
                  onChange={value => upd({ type: value })}
                  scroll
                  className="w-full"
                />
              </div>
            </div>
          </Section>

          <Section icon={MapPin} title="Address" subtitle="Where this customer is based.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2">
                <TextField
                  field="address" label="Street Address"
                  value={form.address} onChange={v => upd({ address: v })} error={errors.address}
                  onBlur={() => markTouched('address')}
                />
              </div>
              <TextField
                field="city" label="City"
                value={form.city} onChange={v => upd({ city: v })} error={errors.city}
                onBlur={() => markTouched('city')}
              />
              <TextField
                field="state" label="State"
                value={form.state} onChange={v => upd({ state: v })} error={errors.state}
                onBlur={() => markTouched('state')}
              />
            </div>
          </Section>

          {isBusinessCustomer(form.type) && (
            <Section icon={Building2} title="Corporate Details"
              subtitle="Shown for corporate customers and travel agents.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <TextField
                    field="companyName" label="Company Name"
                    value={form.companyName} onChange={v => upd({ companyName: v })} error={errors.companyName}
                    onBlur={() => markTouched('companyName')}
                  />
                </div>
                <TextField
                  field="contactPerson" label="Contact Person"
                  value={form.contactPerson} onChange={v => upd({ contactPerson: v })} error={errors.contactPerson}
                  onBlur={() => markTouched('contactPerson')}
                />
                <TextField
                  field="gst" label="GST Number"
                  value={form.gst} onChange={v => upd({ gst: v })} error={errors.gst}
                  onBlur={() => markTouched('gst')}
                />
                <div className="sm:col-span-2">
                  <TextField
                    field="billingAddress" label="Billing Address"
                    value={form.billingAddress} onChange={v => upd({ billingAddress: v })} error={errors.billingAddress}
                    onBlur={() => markTouched('billingAddress')}
                  />
                </div>
              </div>
            </Section>
          )}

          <Section icon={StickyNote} title="Customer Notes" subtitle="Optional details for the office and drivers.">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label htmlFor="cus-notes" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                  Notes
                </label>
                <span className={`text-[10px] font-semibold tabular-nums ${
                  String(form.notes || '').length > 270 ? 'text-red-500' : 'text-[var(--ap-text-3)]'
                }`}>
                  {String(form.notes || '').length}/300
                </span>
              </div>
              <AutoTextarea
                id="cus-notes"
                value={form.notes || ''}
                onChange={e => upd({ notes: sanitizeField('notes', e.target.value) })}
                onBlur={() => markTouched('notes')}
                placeholder="Preferred driver, vehicle preferences, payment terms..."
                maxLength={300}
                className={`${fieldCls} h-auto min-h-[88px] py-3 leading-relaxed resize-none`}
              />
            </div>
          </Section>

          <Section icon={HeartHandshake} title="Emergency Contact"
            subtitle="Optional — who should we contact in an emergency?">
            <div className="rounded-2xl border border-[var(--ap-border)] bg-[var(--ap-surface-2)] p-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <TextField
                  field="emergencyName" label="Contact Name" counter={false}
                  value={form.emergencyName} onChange={v => upd({ emergencyName: v })}
                />
                <TextField
                  field="emergencyContact" label="Mobile Number" type="tel" inputMode="numeric" counter={false}
                  value={form.emergencyContact}
                  onChange={v => upd({ emergencyContact: String(v).replace(/\D/g, '').slice(0, 10) })}
                />
              </div>
            </div>
          </Section>

          <Section icon={SlidersHorizontal} title="Preferences & Flags"
            subtitle="Optional. Blacklisting always asks for confirmation first.">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {FLAGS.map(({ key, label, Icon, active, chip }) => {
                const on = !!form[key]
                return (
                  <label key={key}
                    className={`ap-focus relative flex items-center gap-2.5 rounded-2xl border px-3 py-3 cursor-pointer transition-all duration-200 focus-within:ring-2 focus-within:ring-[var(--ap-accent)] ${
                      on ? active : 'border-[var(--ap-border)] bg-[var(--ap-surface)] hover:bg-[var(--ap-surface-2)]'
                    }`}>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={on}
                      onChange={() => toggleFlag(key)}
                    />
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${on ? chip : 'bg-[var(--ap-surface-2)] text-[var(--ap-text-3)]'}`}>
                      <Icon size={15} strokeWidth={2} />
                    </span>
                    <span className="flex-1 min-w-0 text-[11px] font-semibold leading-tight">{label}</span>
                    {on && <Check size={12} strokeWidth={3} className="flex-shrink-0" />}
                  </label>
                )
              })}
            </div>
          </Section>
        </div>

        {/* Sticky footer */}
        <div className="flex flex-col sm:flex-row gap-2 px-5 sm:px-6 py-4 border-t border-[var(--ap-border)] flex-shrink-0 bg-[var(--ap-surface)] pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button variant="outline" onClick={requestClose} disabled={saving}
            className="w-full sm:w-auto">Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving || !requiredValid}
            className="w-full sm:w-auto sm:ml-auto sm:min-w-[170px]">
            {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
              : isEdit ? 'Update Customer' : 'Create Customer'}
          </Button>
        </div>
      </div>
    </ModalOverlay>
  )
}

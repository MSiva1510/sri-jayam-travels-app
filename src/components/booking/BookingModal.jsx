// ─── BookingModal — premium Create/Edit Booking form ──────────────
// Product design: quiet macOS-style sections, generous spacing,
// one accent, no decorative controls. Every field writes to the same
// booking shape used by Supabase via tripTypes.saveBooking().

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarDays, UserRound, MapPinned, Wallet, BadgeCheck, FileText,
  X, Loader2, AlertCircle,
} from 'lucide-react'
import ModalOverlay from '../ui/ModalOverlay'
import Button from '../ui/Button'
import IconButton from '../ui/IconButton'
import { fieldCls, Select as FieldSelect, Textarea as FieldTextarea } from '../ui/Field'
import TripTypeSelector from './TripTypeSelector'
import FormSection from './FormSection'
import CustomerFields from './CustomerFields'
import RouteFields from './RouteFields'
import PricingFields from './PricingFields'
import {
  BOOKING_STATUSES, generateBookingNumber, getWorkflowTransitions,
} from '../../data/tripTypes'
import { upsertCustomerFromBooking } from '../../data/customerData'
import {
  BOOKING_FORM_DEFAULTS, scheduleFieldsFor, validateBookingForm,
  buildBookingPayload, formatINR,
} from '../../utils/bookingForm'

export default function BookingModal({ booking, onClose, onSave, userName }) {
  const isEdit = !!booking?.bookingNo
  const initialStatus = booking?.status || 'draft'
  const [form, setForm] = useState(() => ({ ...BOOKING_FORM_DEFAULTS, ...(booking || {}) }))
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [saving, setSaving] = useState(false)
  const [overrideWorkflow, setOverrideWorkflow] = useState(false)
  const firstFieldRef = useRef(null)
  const dialogRef = useRef(null)
  const initialSnapshot = useRef(JSON.stringify(form))
  const dirty = JSON.stringify(form) !== initialSnapshot.current

  const upd = patch => {
    setForm(f => ({ ...f, ...patch }))
    setErrors(prev => {
      const next = { ...prev }
      Object.keys(patch).forEach(k => { delete next[k] })
      return next
    })
    setSubmitError('')
  }

  const requestClose = () => {
    if (saving) return
    if (dirty && !window.confirm('Discard unsaved changes?')) return
    onClose()
  }

  useEffect(() => { firstFieldRef.current?.focus() }, [])
  useEffect(() => {
    const onBeforeUnload = e => {
      if (!dirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape' && !e.defaultPrevented) requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, saving])

  // Keep Tab inside the dialog. Leaflet's map controls are included when the
  // map picker is open; hidden radio cards (tabIndex -1) are skipped.
  useEffect(() => {
    const node = dialogRef.current
    if (!node) return
    const onTab = e => {
      if (e.key !== 'Tab') return
      const focusable = Array.from(node.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
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

  const schedule = useMemo(() => scheduleFieldsFor(form.type), [form.type])
  const transitions = useMemo(() => getWorkflowTransitions(initialStatus), [initialStatus])
  const statusChanged = isEdit && form.status !== initialStatus
  const invalidTransition = statusChanged && !transitions.some(t => t.to === form.status)

  const handleSubmit = async (patch = {}) => {
    if (saving) return
    const candidate = { ...form, ...patch }
    const found = validateBookingForm(candidate)
    if (invalidTransition && !overrideWorkflow) {
      found.status = 'Not a valid next status for this booking'
    }
    if (Object.keys(found).length) {
      setErrors(found)
      requestAnimationFrame(() => {
        dialogRef.current
          ?.querySelector('[aria-invalid="true"]:not([role="radiogroup"])')
          ?.focus()
      })
      return
    }
    setErrors({})
    setSaving(true)
    setSubmitError('')
    const payload = buildBookingPayload(candidate, {
      userName,
      newId: generateBookingNumber(),
      newBookingNo: generateBookingNumber(),
    })
    try {
      await Promise.resolve(upsertCustomerFromBooking({ name: candidate.customer, mobile: candidate.contact }))
      await onSave(payload)
    } catch (err) {
      console.error('[BookingModal] save failed:', err)
      setSubmitError('Could not save booking. Check your connection and retry.')
    } finally {
      setSaving(false)
    }
  }

  const fieldError = key => errors[key]

  return (
    <ModalOverlay onClose={requestClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-modal-title"
        className="w-full h-[100dvh] sm:h-auto sm:w-[860px] lg:w-[900px] max-h-[100dvh] sm:max-h-[90vh] ap-surface rounded-none sm:rounded-2xl shadow-2xl flex flex-col animate-fade-up overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-[var(--ap-border)] flex-shrink-0 bg-[var(--ap-surface)]">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-[var(--ap-text-3)] uppercase tracking-widest">
              {isEdit ? 'Edit Booking' : 'New Booking'}
            </p>
            <h3 id="booking-modal-title" className="font-sf font-semibold text-[var(--ap-text-1)] text-[17px] tracking-tight truncate">
              {isEdit ? (form.bookingNo || 'Edit Booking') : 'Create Booking'}
            </h3>
          </div>
          <IconButton icon={X} label="Close booking form" size={16} onClick={requestClose}
            className="w-9 h-9 rounded-xl bg-[var(--ap-surface-2)] flex-shrink-0" />
        </div>

        {/* Scrollable form body */}
        <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-5 space-y-7">
          <FormSection icon={CalendarDays} title="Trip type"
            subtitle="Choose the kind of trip — the schedule below adapts automatically.">
            <TripTypeSelector value={form.type} onChange={v => upd({ type: v })} error={fieldError('type')} />
          </FormSection>

          <FormSection icon={UserRound} title="Customer"
            subtitle="Search an existing customer, or enter a new name and mobile.">
            <CustomerFields
              name={form.customer} contact={form.contact}
              onChange={upd} errors={errors} inputRef={firstFieldRef}
            />
          </FormSection>

          <FormSection icon={MapPinned} title="Route"
            subtitle="Type a place, paste a maps link, share live location, or drop a pin on the map.">
            <RouteFields
              pickup={form.pickup} drop={form.drop} onChange={upd} errors={errors}
            />
          </FormSection>

          <FormSection icon={CalendarDays} title="Schedule"
            subtitle="Dates and times for this trip.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {schedule.map(field => (
                <div key={field.key}>
                  <label htmlFor={`bk-${field.key}`}
                    className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
                    {field.label}{field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <input
                    id={`bk-${field.key}`}
                    type={field.inputType}
                    min={field.key === 'returnDate' ? (form.startDate || undefined) : undefined}
                    value={form[field.key] || ''}
                    aria-invalid={!!fieldError(field.key)}
                    onChange={e => upd({ [field.key]: e.target.value })}
                    className={`${fieldCls} tabular-nums`}
                  />
                  {fieldError(field.key) && (
                    <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400 mt-1">
                      {fieldError(field.key)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </FormSection>

          <FormSection icon={Wallet} title="Financial information"
            subtitle="Amounts are recorded separately — fare is never assumed to include allowance or bata.">
            <PricingFields
              fare={form.fare} driverAllowance={form.driverAllowance} bata={form.bata}
              onChange={upd}
            />
          </FormSection>

          <FormSection icon={BadgeCheck} title="Booking status"
            subtitle={isEdit ? 'Use a valid next step, or explicitly override when correcting a record.' : 'New bookings start as Draft.'}>
            <div>
              <FieldSelect value={form.status} onChange={e => upd({ status: e.target.value })}
                aria-invalid={!!fieldError('status')} aria-label="Booking status">
                {BOOKING_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </FieldSelect>
              {isEdit && transitions.length > 0 && (
                <p className="text-[10px] text-[var(--ap-text-3)] mt-1.5">
                  Next steps: {transitions.map(t => t.label).join(' · ')}
                </p>
              )}
              {fieldError('status') && (
                <div className="mt-2 rounded-xl border border-amber-300 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/15 px-3 py-2.5">
                  <p role="alert" className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                    <AlertCircle size={12} /> {fieldError('status')}
                  </p>
                  <label className="mt-2 flex items-center gap-2 text-[11px] text-amber-800 dark:text-amber-300 cursor-pointer">
                    <input type="checkbox" checked={overrideWorkflow}
                      onChange={e => { setOverrideWorkflow(e.target.checked); if (fieldError('status')) upd({ status: form.status }) }}
                      className="w-3.5 h-3.5 accent-[var(--ap-accent)]" />
                    Allow manual status override
                  </label>
                </div>
              )}
            </div>
          </FormSection>

          <FormSection icon={FileText} title="Additional details"
            subtitle="Anything the driver or office should know about this trip.">
            <FieldTextarea value={form.notes || ''} onChange={e => upd({ notes: e.target.value })}
              rows={3} placeholder="Special instructions, passenger count, landmarks…" aria-label="Notes" />
          </FormSection>
        </div>

        {/* Sticky footer */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap px-5 sm:px-6 py-4 border-t border-[var(--ap-border)] flex-shrink-0 bg-[var(--ap-surface)] pb-[max(1rem,env(safe-area-inset-bottom))]">
          {submitError && (
            <p role="alert" className="w-full rounded-xl bg-red-50 dark:bg-red-900/25 border border-red-200 dark:border-red-800/50 px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-300 text-center">
              {submitError}
            </p>
          )}
          <Button variant="outline" onClick={requestClose} disabled={saving}
            className="order-3 sm:order-1 w-full sm:w-auto">Cancel</Button>
          <div className="order-1 sm:order-2 sm:ml-auto text-center sm:text-right">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--ap-text-3)]">Customer fare</p>
            <p className="font-sf text-lg font-semibold text-[var(--ap-text-1)] tabular-nums leading-tight">
              {formatINR(form.fare)}
            </p>
            {(Number(form.bata) > 0 || Number(form.driverAllowance) > 0) && (
              <p className="text-[10px] text-[var(--ap-text-3)] tabular-nums">
                {Number(form.bata) > 0 && <span>+ bata {formatINR(form.bata)}</span>}
                {Number(form.bata) > 0 && Number(form.driverAllowance) > 0 && <span> · </span>}
                {Number(form.driverAllowance) > 0 && <span>allowance {formatINR(form.driverAllowance)} (separate)</span>}
              </p>
            )}
          </div>
          <Button variant="primary" onClick={() => handleSubmit()} disabled={saving}
            className="order-2 sm:order-3 w-full sm:w-auto min-w-[150px]">
            {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
              : isEdit ? 'Save Changes' : 'Create Booking'}
          </Button>
        </div>
      </div>
    </ModalOverlay>
  )
}

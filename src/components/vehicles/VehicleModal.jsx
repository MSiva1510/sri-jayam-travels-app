// ─── VehicleModal — premium Add/Edit Vehicle form ───────────────
// UI-only redesign. Field names, defaults, dropdown options, sanitising,
// create/edit handlers and the repository payload stay identical to the
// previous inline VehicleModal in pages/Vehicles.jsx.
//
// The expiry and service indicators are read-only: they derive from the
// dates/KMs already stored on the vehicle and never write anything.

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Car, CarFront, Gauge, Fuel, Palette, Hash, CalendarDays,
  Wrench, Shield, FileText, BadgeCheck, Leaf, Building2, Route,
  X, Plus, Loader2, AlertTriangle, ChevronDown, CheckCircle2,
} from 'lucide-react'
import ModalOverlay from '../ui/ModalOverlay'
import Button from '../ui/Button'
import IconButton from '../ui/IconButton'
import { fieldCls } from '../ui/Field'
import { vehicleRepository } from '../../repositories/vehicleRepository'
import { docStatus, daysLabel } from '../../utils/vehicleUtils'
import {
  createEmptyVehicle, vehicleToForm, sanitizeVehicleField, validateVehicleForm,
  isVehicleFormReady, buildVehicleInput, serviceStatus,
  VEHICLE_TYPES, FUEL_TYPES, statusOptionsFor,
  MODEL_MAX_LENGTH, COLOR_MAX_LENGTH,
} from '../../utils/vehicleForm'

const COLOR_SWATCH = {
  white: '#f4f5f7', black: '#1f2430', silver: '#cbd5e1', grey: '#9aa4b2',
  gray: '#9aa4b2', red: '#ef4444', blue: '#3b82f6', green: '#22c55e',
  yellow: '#eab308', orange: '#f97316', brown: '#a16207', maroon: '#7f1d1d',
}

function swatchFor(color) {
  return COLOR_SWATCH[String(color || '').trim().toLowerCase()] || null
}

// ── Small building blocks ───────────────────────────────────────

function Section({ icon: Icon, title, subtitle, status, card = false, children }) {
  return (
    <section className={`space-y-3.5 ${card
      ? 'rounded-2xl border border-[var(--ap-border)] bg-[var(--ap-surface-2)] p-3.5 sm:p-4'
      : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-xl bg-[var(--ap-accent)]/10 text-[var(--ap-accent)] flex items-center justify-center flex-shrink-0">
            <Icon size={15} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <h4 className="font-sf text-[13px] font-semibold tracking-tight text-[var(--ap-text-1)]">
              {title}
            </h4>
            {subtitle && (
              <p className="text-[11px] leading-snug text-[var(--ap-text-3)] mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {status}
      </div>
      {children}
    </section>
  )
}

function FieldLabel({ id, label, required, trailing }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-1.5">
      <label htmlFor={id} className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {trailing}
    </div>
  )
}

function Hint({ id, error, hint, errorId }) {
  if (error) {
    return (
      <p id={errorId} role="alert" className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-red-600 dark:text-red-400">
        <AlertTriangle size={11} className="flex-shrink-0" /> {error}
      </p>
    )
  }
  if (!hint) return null
  return <p id={id} className="mt-1 text-[11px] text-[var(--ap-text-3)]">{hint}</p>
}

function TextField({
  field, label, value, onChange, onBlur, error, type = 'text', inputMode,
  required, placeholder, icon: Icon, hint, suffix, maxLength, min, max,
  autoComplete = 'off', trailing, inputRef,
}) {
  const id = `veh-${field}`
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  return (
    <div className="min-w-0">
      <FieldLabel id={id} label={label} required={required} />
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
          placeholder={placeholder}
          required={required}
          min={min}
          max={max}
          maxLength={maxLength}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          onChange={e => onChange(field, e.target.value)}
          onBlur={onBlur}
          className={`${fieldCls} ${Icon ? 'pl-10' : ''} ${(suffix || trailing) ? 'pr-12' : ''} ${error ? '!border-red-400 dark:!border-red-500' : ''}`}
        />
        {suffix && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[var(--ap-text-3)] pointer-events-none">
            {suffix}
          </span>
        )}
        {trailing}
      </div>
      <Hint id={hintId} errorId={errorId} error={error} hint={hint} />
    </div>
  )
}

function SelectField({ field, label, value, options, onChange, icon: Icon, hint, required }) {
  const id = `veh-${field}`
  return (
    <div className="min-w-0">
      <FieldLabel id={id} label={label} required={required} />
      <div className="relative">
        {Icon && (
          <Icon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        )}
        <select
          id={id}
          name={field}
          value={value ?? ''}
          onChange={e => onChange(field, e.target.value)}
          className={`${fieldCls} appearance-none pr-9 cursor-pointer ${Icon ? 'pl-10' : ''}`}
        >
          {options.map(o => {
            const optValue = o.value ?? o
            return <option key={optValue} value={optValue} disabled={!!o.disabled}>{o.label ?? o}</option>
          })}
        </select>
        <ChevronDown size={14} strokeWidth={2.5}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
      </div>
      <Hint id={`${id}-hint`} hint={hint} />
    </div>
  )
}

function ExpiryChip({ date }) {
  if (!date) return null
  const st = docStatus(date)
  const label = st.key === 'active' ? 'Valid' : st.label
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold whitespace-nowrap ${st.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
      {label}
      {st.days != null && (
        <span className="font-medium opacity-75 tabular-nums">· {daysLabel(st.days)}</span>
      )}
    </span>
  )
}

function ServiceChip({ form }) {
  const st = useMemo(() => serviceStatus(form), [form])
  if (st.key === 'unknown') return null

  if (st.key === 'overdue') {
    const why = st.kmDue ? 'Odometer limit reached' : `${Math.abs(st.days)}d overdue`
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-1 text-[10px] font-semibold whitespace-nowrap">
        <AlertTriangle size={11} /> Service due · {why}
      </span>
    )
  }
  if (st.key === 'due-soon') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-1 text-[10px] font-semibold whitespace-nowrap">
        <Wrench size={11} /> Due in {st.days}d
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-1 text-[10px] font-semibold whitespace-nowrap">
      <CheckCircle2 size={11} /> On schedule
    </span>
  )
}

// ── Modal ──────────────────────────────────────────────────────

export default function VehicleModal({ vehicle, onClose, onSave }) {
  const isEditMode = !!vehicle?.id

  const [initialForm] = useState(() => (
    vehicle ? vehicleToForm(vehicle) : { ...createEmptyVehicle(), id: `VEH-${Date.now()}` }
  ))
  const [form, setForm] = useState(() => ({ ...initialForm }))
  const [touched, setTouched] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [closing, setClosing] = useState(false)
  const [saveError, setSaveError] = useState('')

  const savingRef = useRef(false)
  const closeTimer = useRef(null)
  const dialogRef = useRef(null)
  const firstFieldRef = useRef(null)

  const validation = useMemo(() => validateVehicleForm(form), [form])
  const errors = useMemo(() => {
    const visible = {}
    if (saveError) visible.save = saveError
    Object.entries(validation).forEach(([field, message]) => {
      if (submitted || touched[field]) visible[field] = message
    })
    return visible
  }, [validation, submitted, touched, saveError])

  const upd = (field, value) => {
    setForm(prev => ({ ...prev, [field]: sanitizeVehicleField(field, value) }))
    setSaveError('')
  }
  const markTouched = field => setTouched(prev => ({ ...prev, [field]: true }))
  const blur = field => () => markTouched(field)

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
  }, [closing])

  // Keep Tab inside the dialog.
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

  const handleSave = async () => {
    if (savingRef.current || closing) return
    setSubmitted(true)
    if (Object.keys(validateVehicleForm(form)).length) {
      requestAnimationFrame(() => {
        dialogRef.current?.querySelector('[aria-invalid="true"]')?.focus()
      })
      return
    }

    savingRef.current = true
    setSaving(true)
    setSaveError('')
    let saved = false
    try {
      const payload = buildVehicleInput(form)
      const result = isEditMode
        ? await vehicleRepository.update(vehicle.id, payload)
        : await vehicleRepository.create(payload)
      await onSave(result || payload)
      saved = true
    } catch (err) {
      console.error('VehicleModal save failed:', err)
      setSaveError('Failed to save. Please try again.')
    } finally {
      savingRef.current = false
      setSaving(false)
      if (saved) requestClose()
    }
  }

  const ready = isVehicleFormReady(form)
  const colourSwatch = swatchFor(form.color)
  const statusOptions = useMemo(() => statusOptionsFor(form.status), [form.status])

  return (
    <ModalOverlay onClose={requestClose} closing={closing}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vehicle-modal-title"
        className={`w-full h-[100dvh] sm:h-auto sm:w-[900px] max-h-[100dvh] sm:max-h-[90vh] ap-surface rounded-none sm:rounded-[22px] border border-[var(--ap-border)] shadow-2xl flex flex-col animate-fade-up transition-[transform,opacity] duration-150 ease-out overflow-hidden ${
          closing ? 'opacity-0 translate-y-2 sm:translate-y-0 sm:scale-[0.98]' : ''
        }`}
      >
        {/* Fixed header */}
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b border-[var(--ap-border)] flex-shrink-0 bg-[var(--ap-surface)]">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
              <Car size={19} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-[var(--ap-text-3)] uppercase tracking-[0.14em]">
                Fleet Management
              </p>
              <h3 id="vehicle-modal-title" className="font-sf font-semibold text-[17px] tracking-tight text-[var(--ap-text-1)] truncate mt-0.5">
                {isEditMode ? 'Edit Vehicle' : 'Add Vehicle'}
              </h3>
              <p className="text-[11px] text-[var(--ap-text-3)] mt-0.5">
                {isEditMode
                  ? 'Update this vehicle and its compliance details.'
                  : 'Register a vehicle and manage its compliance details.'}
              </p>
            </div>
          </div>
          <IconButton icon={X} label="Close vehicle form" size={16} onClick={requestClose}
            className="w-9 h-9 rounded-xl bg-[var(--ap-surface-2)] flex-shrink-0" />
        </div>

        {/* Scrollable form */}
        <div className="overflow-y-auto scroll-smooth flex-1 px-4 sm:px-6 py-5 space-y-5">
          {errors.save && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 px-3.5 py-3">
              <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-red-700 dark:text-red-300">{errors.save}</p>
            </div>
          )}

          {/* 1 — Vehicle Identity */}
          <Section icon={CarFront} title="Vehicle Information"
            subtitle="Registration, specification and current status.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <TextField
                field="reg" label="Registration Number" required icon={CarFront}
                placeholder="PY01AB1234"
                autoComplete="off" inputRef={firstFieldRef}
                value={form.reg} error={errors.reg}
                onChange={(_, v) => upd('reg', String(v).toUpperCase())}
                onBlur={blur('reg')}
              />
              <SelectField
                field="type" label="Vehicle Type" icon={CarFront}
                value={form.type} options={VEHICLE_TYPES} onChange={upd}
              />
              <TextField
                field="model" label="Model" required icon={Car}
                placeholder="e.g. Swift Dzire" maxLength={MODEL_MAX_LENGTH}
                value={form.model} error={errors.model}
                onChange={upd} onBlur={blur('model')}
              />
              <TextField
                field="year" label="Manufacturing Year" inputMode="numeric"
                placeholder={String(initialForm.year)} maxLength={4}
                value={form.year} error={errors.year}
                onChange={upd} onBlur={blur('year')}
              />
              <TextField
                field="km" label="Current Odometer" inputMode="numeric" icon={Gauge}
                suffix="km" placeholder="0"
                value={form.km} error={errors.km}
                onChange={upd} onBlur={blur('km')}
              />
              <SelectField
                field="fuelType" label="Fuel Type" icon={Fuel}
                value={form.fuelType} options={FUEL_TYPES} onChange={upd}
              />
              <TextField
                field="color" label="Vehicle Colour" icon={Palette}
                placeholder="White" maxLength={COLOR_MAX_LENGTH}
                value={form.color} error={errors.color}
                onChange={upd} onBlur={blur('color')}
                trailing={colourSwatch ? (
                  <span
                    aria-hidden="true"
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-black/10 dark:border-white/20 shadow-inner"
                    style={{ backgroundColor: colourSwatch }}
                  />
                ) : null}
              />
              <SelectField
                field="status" label="Vehicle Status"
                value={form.status}
                options={statusOptions}
                onChange={upd}
              />
            </div>
          </Section>

          {/* 2 — Service Tracking */}
          <Section icon={Wrench} title="Service Tracking"
            subtitle="Last recorded service and the next due point." status={<ServiceChip form={form} />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <TextField
                field="lastServiceDate" label="Last Service Date" type="date" icon={CalendarDays}
                value={form.lastServiceDate} error={errors.lastServiceDate}
                onChange={upd} onBlur={blur('lastServiceDate')}
              />
              <TextField
                field="lastServiceKm" label="Last Service Odometer" inputMode="numeric" icon={Hash}
                suffix="km" placeholder="e.g. 48000"
                value={form.lastServiceKm} error={errors.lastServiceKm}
                onChange={upd} onBlur={blur('lastServiceKm')}
                hint="Odometer reading at the last service."
              />
              <TextField
                field="nextServiceDate" label="Next Service Date" type="date" icon={CalendarDays}
                value={form.nextServiceDate} error={errors.nextServiceDate}
                onChange={upd} onBlur={blur('nextServiceDate')}
                hint="Leave blank if no service is scheduled."
              />
              <TextField
                field="nextServiceKm" label="Next Service Odometer" inputMode="numeric" icon={Route}
                suffix="km" placeholder="e.g. 55000"
                value={form.nextServiceKm} error={errors.nextServiceKm}
                onChange={upd} onBlur={blur('nextServiceKm')}
                hint="Service is due when the odometer reaches this reading."
              />
            </div>
          </Section>

          {/* 3 — Insurance */}
          <Section icon={Shield} title="Insurance Details" card
            subtitle="Policy provider, number and cover expiry."
            status={<ExpiryChip date={form.insExpiry} />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <TextField
                field="insProvider" label="Insurance Provider" icon={Building2}
                placeholder="e.g. TATA AIG" value={form.insProvider} error={errors.insProvider}
                onChange={upd} onBlur={blur('insProvider')}
              />
              <TextField
                field="insNumber" label="Policy Number" icon={FileText}
                placeholder="Policy number" value={form.insNumber} error={errors.insNumber}
                onChange={upd} onBlur={blur('insNumber')}
              />
              <div className="sm:col-span-2">
                <TextField
                  field="insExpiry" label="Insurance Expiry Date" type="date" icon={CalendarDays}
                  value={form.insExpiry} error={errors.insExpiry}
                  onChange={upd} onBlur={blur('insExpiry')}
                />
              </div>
            </div>
          </Section>

          {/* 4 — Permit */}
          <Section icon={FileText} title="Permit Details" card
            subtitle="State permit number and validity."
            status={<ExpiryChip date={form.permitExpiry} />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <TextField
                field="permitNumber" label="Permit Number" icon={Hash}
                placeholder="Permit number" value={form.permitNumber} error={errors.permitNumber}
                onChange={upd} onBlur={blur('permitNumber')}
              />
              <TextField
                field="permitExpiry" label="Permit Expiry Date" type="date" icon={CalendarDays}
                value={form.permitExpiry} error={errors.permitExpiry}
                onChange={upd} onBlur={blur('permitExpiry')}
              />
            </div>
          </Section>

          {/* 5 — Fitness Certificate */}
          <Section icon={BadgeCheck} title="Fitness Certificate (FC)" card
            subtitle="Vehicle fitness certification."
            status={<ExpiryChip date={form.fcExpiry} />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <TextField
                field="fcNumber" label="FC Number" icon={Hash}
                placeholder="Certificate number" value={form.fcNumber} error={errors.fcNumber}
                onChange={upd} onBlur={blur('fcNumber')}
              />
              <TextField
                field="fcExpiry" label="FC Expiry Date" type="date" icon={CalendarDays}
                value={form.fcExpiry} error={errors.fcExpiry}
                onChange={upd} onBlur={blur('fcExpiry')}
              />
            </div>
          </Section>

          {/* 6 — Pollution Certificate */}
          <Section icon={Leaf} title="Pollution Certificate (PUC)" card
            subtitle="Emission compliance certificate."
            status={<ExpiryChip date={form.pucExpiry} />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <TextField
                field="pucNumber" label="PUC Number" icon={Hash}
                placeholder="Certificate number" value={form.pucNumber} error={errors.pucNumber}
                onChange={upd} onBlur={blur('pucNumber')}
              />
              <TextField
                field="pucExpiry" label="PUC Expiry Date" type="date" icon={CalendarDays}
                value={form.pucExpiry} error={errors.pucExpiry}
                onChange={upd} onBlur={blur('pucExpiry')}
              />
            </div>
          </Section>
        </div>

        {/* Sticky footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-[var(--ap-border)] flex-shrink-0 bg-[var(--ap-surface)] pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2">
            <Button variant="ghost" onClick={requestClose} disabled={saving}
              className="w-full sm:w-auto sm:min-w-[96px]">
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={saving || !ready}
              aria-busy={saving}
              className="w-full sm:w-auto sm:ml-auto sm:min-w-[160px]">
              {saving ? (
                <><Loader2 size={15} className="animate-spin" /> Saving…</>
              ) : (
                <><Plus size={15} /> {isEditMode ? 'Save Changes' : 'Add Vehicle'}</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ─── ExpenseModal — premium Add/Edit Expense form ───────────────
// UI-only redesign. Field names, defaults, validation, dropdown values,
// type-specific panels, receipt storage and save payload stay identical to
// the previous inline modal in Expenses.jsx.

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ReceiptText, Fuel, Route, ParkingCircle, Banknote, Utensils, Wrench,
  Hammer, ClipboardCheck, ShieldCheck, Package, CalendarDays, UserRound,
  CarFront, UploadCloud, CheckCircle2, AlertTriangle, Loader2, ChevronDown,
  Search, Gauge, Droplets, Building2, FileText, RotateCcw, X, MapPin, Plus,
} from 'lucide-react'
import ModalOverlay from '../ui/ModalOverlay'
import Button from '../ui/Button'
import IconButton from '../ui/IconButton'
import { fieldCls, Select as FieldSelect } from '../ui/Field'
import {
  EXPENSE_TYPES, APPROVAL_STATUSES, DRIVER_ALLOWED_TYPES,
  generateExpenseId, generateExpenseNo,
} from '../../data/expenseData'
import { loadBookings } from '../../data/tripTypes'
import {
  createEmptyExpense, validateExpenseForm, validateReceiptFile,
  buildExpensePayload, todayLocalISO,
} from '../../utils/expenseForm'

const TYPE_ICONS = {
  fuel: Fuel, toll: Route, parking: ParkingCircle, bata: Banknote,
  food: Utensils, maintenance: Wrench, repair: Hammer, permit: ClipboardCheck,
  insurance: ShieldCheck, misc: Package,
}

const TYPE_PANELS = {
  fuel: {
    title: 'Fuel Information',
    subtitle: 'Odometer and pump details for this fill.',
    Icon: Fuel,
    tone: 'border-amber-200/80 bg-amber-50/70 dark:border-amber-500/20 dark:bg-amber-500/5',
    fields: [
      { field: 'odometerKm', label: 'Odometer (KM)', type: 'number', placeholder: 'e.g. 45230', icon: Gauge },
      { field: 'litresFilled', label: 'Litres Filled', type: 'number', placeholder: 'e.g. 20', icon: Droplets },
      { field: 'fuelStation', label: 'Fuel Station', placeholder: 'Station name', icon: Building2 },
      { field: 'fuelRate', label: 'Rate per Litre (₹)', type: 'number', placeholder: 'e.g. 102.50', prefix: '₹' },
    ],
  },
  parking: {
    title: 'Parking Details',
    subtitle: 'Where the vehicle was parked.',
    Icon: ParkingCircle,
    tone: 'border-teal-200/70 bg-teal-50/60 dark:border-teal-500/20 dark:bg-teal-500/5',
    fields: [
      { field: 'parkingLocation', label: 'Parking Location', placeholder: 'Airport, Mall, etc.', icon: Building2 },
      { field: 'parkingDuration', label: 'Duration (hours)', type: 'number', placeholder: 'e.g. 3', icon: CalendarDays },
    ],
  },
  toll: {
    title: 'Toll Details',
    subtitle: 'Plaza and route used for this toll.',
    Icon: Route,
    tone: 'border-blue-200/70 bg-blue-50/60 dark:border-blue-500/20 dark:bg-blue-500/5',
    fields: [
      { field: 'tollName', label: 'Toll Name/Plaza', placeholder: 'e.g. Tindivanam Toll', icon: Route },
      { field: 'tollRoute', label: 'Route', placeholder: 'e.g. ECR Chennai', icon: MapPin },
    ],
  },
  bata: {
    title: 'Driver Bata Details',
    subtitle: 'Linked driver and trip for this payment.',
    Icon: Banknote,
    tone: 'border-emerald-200/70 bg-emerald-50/60 dark:border-emerald-500/20 dark:bg-emerald-500/5',
    fields: [
      { field: 'bataDriver', label: 'Driver Name', placeholder: 'Driver name', icon: UserRound },
      { field: 'bataTrip', label: 'Trip Reference', placeholder: 'BK-XXXX', icon: Route },
    ],
  },
  maintenance: {
    title: 'Maintenance Details',
    subtitle: 'Vendor and invoice for this service.',
    Icon: Wrench,
    tone: 'border-slate-200/80 bg-slate-50/70 dark:border-slate-600/40 dark:bg-slate-500/5',
    fields: [
      { field: 'maintenanceVendor', label: 'Vendor Name', placeholder: 'Workshop/Garage name', icon: Building2 },
      { field: 'maintenanceInvoice', label: 'Invoice Number', placeholder: 'INV-XXXX', icon: FileText },
    ],
  },
}

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
  placeholder, icon: Icon, prefix, required, min, max, step, inputRef,
}) {
  const id = `exp-${field}`
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <label htmlFor={id} className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
          {label}{required && <span className="text-red-500 ml-1">*</span>}
        </label>
      </div>
      <div className="relative">
        {prefix ? (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-[var(--ap-text-3)] pointer-events-none">
            {prefix}
          </span>
        ) : Icon ? (
          <Icon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        ) : null}
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
          step={step}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={e => onChange(field, e.target.value)}
          onBlur={onBlur}
          className={`${fieldCls} ${prefix || Icon ? 'pl-10' : ''} ${error ? '!border-red-400 dark:!border-red-500' : ''}`}
        />
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-red-600 dark:text-red-400">
          <AlertTriangle size={11} className="flex-shrink-0" /> {error}
        </p>
      )}
    </div>
  )
}

function SelectField({ field, label, value, onChange, onBlur, children, required, error, icon: Icon }) {
  const id = `exp-${field}`
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="relative">
        {Icon && <Icon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />}
        <FieldSelect
          id={id}
          value={value || ''}
          required={required}
          onChange={e => onChange(field, e.target.value)}
          onBlur={onBlur}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${Icon ? 'pl-10' : ''} ${error ? '!border-red-400 dark:!border-red-500' : ''}`}
        >
          {children}
        </FieldSelect>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-red-600 dark:text-red-400">
          <AlertTriangle size={11} className="flex-shrink-0" /> {error}
        </p>
      )}
    </div>
  )
}

function SearchableSelect({
  field, label, value, options, onChange, onBlur,
  placeholder = '— None —', icon: Icon, error, searchable = true,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)
  const optionRefs = useRef([])
  const listId = `exp-${field}-listbox`
  const triggerId = `exp-${field}`

  const selected = options.find(o => o.value === value)
  const SelectedIcon = selected?.icon || Icon
  const filtered = !searchable ? options : options.filter(o =>
    `${o.label} ${o.sublabel || ''}`.toLowerCase().includes(query.trim().toLowerCase())
  )

  useEffect(() => {
    if (!open) return undefined
    const frame = requestAnimationFrame(() => {
      if (searchable) inputRef.current?.focus()
      else optionRefs.current[active]?.focus()
    })
    return () => cancelAnimationFrame(frame)
    // Focus only when the list opens; keyboard handlers move focus afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, searchable])

  useEffect(() => {
    const onDown = e => {
      if (open && wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const choose = option => {
    onChange?.(field, option.value)
    onBlur?.()
    setOpen(false)
    setQuery('')
  }

  const focusOption = index => {
    setActive(index)
    optionRefs.current[index]?.focus()
  }

  const onListKeyDown = e => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      focusOption(Math.min(active + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      focusOption(Math.max(active - 1, 0))
    } else if (e.key === 'Enter' && filtered[active]) {
      e.preventDefault()
      choose(filtered[active])
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      e.nativeEvent.stopImmediatePropagation?.()
      setOpen(false)
      setQuery('')
    }
  }

  const onTriggerKeyDown = e => {
    if (open) {
      onListKeyDown(e)
      return
    }
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault()
      setOpen(true)
      setQuery('')
      setActive(Math.max(0, options.findIndex(o => o.value === value)))
    }
  }

  return (
    <div ref={wrapRef} className="relative min-w-0">
      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      <button
        id={triggerId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={!!error}
        aria-describedby={error ? `exp-${field}-error` : undefined}
        onClick={() => {
          setOpen(v => !v)
          setQuery('')
          setActive(Math.max(0, options.findIndex(o => o.value === value)))
        }}
        onKeyDown={onTriggerKeyDown}
        className={`${fieldCls} flex items-center justify-between gap-2 text-left ${error ? '!border-red-400 dark:!border-red-500' : ''}`}
      >
        <span className="flex items-center gap-2 min-w-0">
          {SelectedIcon && <SelectedIcon size={14} className="text-slate-400 flex-shrink-0" />}
          <span className={`truncate ${selected?.value ? 'text-[var(--ap-text-1)]' : 'text-[var(--ap-text-3)]'}`}>
            {selected?.label || placeholder}
          </span>
        </span>
        <ChevronDown size={14} className={`text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1.5 w-full ap-surface rounded-2xl border border-[var(--ap-border)] shadow-2xl overflow-hidden animate-fade-up">
          {searchable && (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--ap-border)]">
              <Search size={13} className="text-slate-400 flex-shrink-0" />
              <input
                ref={inputRef}
                role="combobox"
                aria-controls={listId}
                aria-expanded="true"
                value={query}
                onChange={e => { setQuery(e.target.value); setActive(0) }}
                onKeyDown={onListKeyDown}
                placeholder="Search…"
                className="flex-1 min-w-0 bg-transparent text-xs text-[var(--ap-text-1)] placeholder-[var(--ap-text-3)] outline-none"
              />
            </div>
          )}
          <div id={listId} role="listbox" className="max-h-56 overflow-y-auto p-1">
            {filtered.length ? filtered.map((option, i) => {
              const OptionIcon = option.icon
              return (
                <button
                  ref={el => { optionRefs.current[i] = el }}
                  key={`${option.value || 'none'}-${i}`}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(option)}
                  onKeyDown={onListKeyDown}
                  className={`w-full flex items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors ${
                    i === active ? 'bg-[var(--ap-surface-2)]' : ''
                  }`}
                >
                  {OptionIcon
                    ? <OptionIcon size={14} className="text-slate-400 flex-shrink-0" />
                    : <span className="w-[14px] flex-shrink-0" aria-hidden="true" />}
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-semibold text-[var(--ap-text-1)] truncate">{option.label}</span>
                    {option.sublabel && (
                      <span className="block text-[10px] text-[var(--ap-text-3)] truncate">{option.sublabel}</span>
                    )}
                  </span>
                  {option.value === value && <CheckCircle2 size={13} className="text-[var(--ap-accent)] flex-shrink-0" />}
                </button>
              )
            }) : (
              <p className="px-3 py-4 text-center text-[11px] text-[var(--ap-text-3)]">No matches</p>
            )}
          </div>
        </div>
      )}
      {error && (
        <p id={`exp-${field}-error`} role="alert" className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-red-600 dark:text-red-400">
          <AlertTriangle size={11} className="flex-shrink-0" /> {error}
        </p>
      )}
    </div>
  )
}

function AutoTextarea({ value, onChange, ...props }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 76), 160)}px`
  }, [value])
  return <textarea ref={ref} value={value} onChange={onChange} {...props} />
}

export default function ExpenseModal({
  expense, drivers, vehicles, existingExpenses, onClose, onSave,
  currentUser, isDriver: isDrv, uploadReceipt,
}) {
  const today = useMemo(() => todayLocalISO(), [])
  const [bookings, setBookings] = useState([])
  useEffect(() => { loadBookings().then(b => setBookings(Array.isArray(b) ? b : [])) }, [])

  const isEdit = !!expense?.id
  const [form, setForm] = useState(() => expense || createEmptyExpense({
    addedBy: currentUser?.name || '',
    driver: currentUser?.name || '',
  }))
  const [serverErrors, setServerErrors] = useState({})
  const [receiptError, setReceiptError] = useState('')
  const [touched, setTouched] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [closing, setClosing] = useState(false)
  const [receiptFile, setReceiptFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [dragging, setDragging] = useState(false)
  const savingRef = useRef(false)
  const closeTimer = useRef(null)
  const fileInputRef = useRef(null)
  const dialogRef = useRef(null)

  const validation = useMemo(() => validateExpenseForm(form, today), [form, today])
  const errors = useMemo(() => {
    const visible = { ...serverErrors }
    if (receiptError) visible.receipt = receiptError
    Object.entries(validation).forEach(([field, message]) => {
      if (submitted || touched[field]) visible[field] = message
    })
    return visible
  }, [serverErrors, receiptError, validation, submitted, touched])

  useEffect(() => {
    if (!receiptFile || !receiptFile.type.startsWith('image/')) {
      setPreviewUrl('')
      return undefined
    }
    const url = URL.createObjectURL(receiptFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [receiptFile])

  const upd = (field, value) => {
    setForm(f => ({ ...f, [field]: value }))
    setServerErrors(prev => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const markTouched = field => setTouched(prev => ({ ...prev, [field]: true }))

  const handleFieldChange = (field, raw) => {
    let value = raw
    if (field === 'amount' && (Number.isNaN(Number(value)) || Number(value) < 0)) value = ''
    if (field === 'description' || field === 'notes') value = value.slice(0, 200)
    if (field === 'driver' && value.length > 0 && !/^[a-zA-Z\s\-'.]*$/.test(value)) {
      value = value.slice(0, -1)
    }
    upd(field, value)
  }

  const requestClose = () => {
    if (savingRef.current || closing) return
    setClosing(true)
    closeTimer.current = window.setTimeout(onClose, 150)
  }

  useEffect(() => () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
  }, [])

  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape' && !e.defaultPrevented) requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saving, closing])

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

  const handleReceiptFiles = files => {
    const file = files?.[0]
    if (!file) { setReceiptFile(null); return }
    const message = validateReceiptFile(file)
    if (message) {
      setReceiptError(message)
      setReceiptFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setReceiptError('')
    setReceiptFile(file)
    upd('receiptName', file.name)
  }

  const handleReceiptChange = e => handleReceiptFiles(e.target.files)

  const clearReceipt = e => {
    e?.stopPropagation()
    setReceiptFile(null)
    setReceiptError('')
    setForm(f => ({ ...f, receiptName: '', receiptUrl: '' }))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleReset = () => {
    if (savingRef.current) return
    setForm(createEmptyExpense({ today, addedBy: currentUser?.name || '', driver: currentUser?.name || '' }))
    setServerErrors({})
    setReceiptError('')
    setTouched({})
    setSubmitted(false)
    setReceiptFile(null)
    setPreviewUrl('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSave = async () => {
    if (savingRef.current || closing) return
    setSubmitted(true)
    const found = validateExpenseForm(form, today)
    if (Object.keys(found).length) {
      requestAnimationFrame(() => {
        dialogRef.current?.querySelector('[aria-invalid="true"]')?.focus()
      })
      return
    }
    savingRef.current = true
    setSaving(true)
    setServerErrors({})
    let saved = false
    try {
      let receipt = { url: form.receiptUrl || '', name: form.receiptName || '' }
      if (receiptFile) receipt = await uploadReceipt(receiptFile)
      const payload = buildExpensePayload(form, {
        now: new Date().toISOString(),
        newId: generateExpenseId(),
        newExpenseNo: generateExpenseNo(existingExpenses),
        receipt,
      })
      await onSave(payload)
      saved = true
    } catch (err) {
      console.error('[Expenses] save failed:', err)
      setServerErrors({ save: err.message || 'Could not save this expense. Please try again.' })
    } finally {
      savingRef.current = false
      setSaving(false)
      if (saved) requestClose()
    }
  }

  const allowedTypes = isDrv
    ? EXPENSE_TYPES.filter(t => DRIVER_ALLOWED_TYPES.includes(t.key))
    : EXPENSE_TYPES
  const typeOptions = allowedTypes.map(t => ({
    value: t.key,
    label: t.label,
    icon: TYPE_ICONS[t.key] || ReceiptText,
  }))
  const panel = TYPE_PANELS[form.type]

  const driverOptions = [
    { value: '', label: '— None —' },
    ...(drivers || []).map(d => ({ value: d.name, label: d.name, sublabel: d.mobile || d.license || '' })),
  ]
  const vehicleOptions = [
    { value: '', label: '— None —' },
    ...(vehicles || []).map(v => ({
      value: v.registration || v.reg,
      label: `${v.registration || v.reg} — ${v.vehicle_type || v.type || v.model || 'Vehicle'}`,
      sublabel: [v.make, v.model].filter(Boolean).join(' · '),
    })),
  ]
  const tripOptions = [
    { value: '', label: '— No trip linked —' },
    ...bookings.map(b => ({
      value: b.bookingNo,
      label: `${b.bookingNo} — ${b.customer}`,
      sublabel: [b.pickup, b.drop].filter(Boolean).join(' → '),
    })),
  ]

  const hasReceipt = !!(form.receiptName || receiptFile)
  const imageReceipt = !!(previewUrl || /\.(jpe?g|png)$/i.test(form.receiptName || form.receiptUrl || ''))

  return (
    <ModalOverlay onClose={requestClose} closing={closing}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="expense-modal-title"
        className={`w-full h-[100dvh] sm:h-auto sm:w-[900px] max-h-[100dvh] sm:max-h-[90vh] ap-surface rounded-none sm:rounded-[22px] border border-[var(--ap-border)] shadow-2xl flex flex-col animate-fade-up transition-[transform,opacity] duration-150 ease-out overflow-hidden ${
          closing ? 'opacity-0 translate-y-2 sm:translate-y-0 sm:scale-[0.98]' : ''
        }`}
      >
        {/* Fixed header */}
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b border-[var(--ap-border)] flex-shrink-0 bg-[var(--ap-surface)]">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
              <ReceiptText size={19} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-[var(--ap-text-3)] uppercase tracking-[0.14em]">
                Expense Management
              </p>
              <h3 id="expense-modal-title" className="font-sf font-semibold text-[17px] tracking-tight text-[var(--ap-text-1)] truncate mt-0.5">
                {isEdit ? (form.expenseNo || form.description?.trim() || 'Edit Expense') : 'New Expense'}
              </h3>
              <p className="text-[11px] text-[var(--ap-text-3)] mt-0.5">
                {isEdit
                  ? 'Update expense details for your fleet operations.'
                  : 'Add expense details for your fleet operations.'}
              </p>
            </div>
          </div>
          <IconButton icon={X} label="Close expense form" size={16} onClick={requestClose}
            className="w-9 h-9 rounded-xl bg-[var(--ap-surface-2)] flex-shrink-0" />
        </div>

        {/* Scrollable form */}
        <div className="overflow-y-auto scroll-smooth flex-1 px-4 sm:px-6 py-5 space-y-6">
          <Section icon={ReceiptText} title="Expense Details" subtitle="What was spent and when.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <SearchableSelect
                field="type" label="Expense Type" required
                value={form.type} options={typeOptions}
                onChange={handleFieldChange} onBlur={() => markTouched('type')}
                placeholder="— Select type —" error={errors.type}
                searchable={false}
              />
              <TextField
                field="date" label="Date" type="date" required
                value={form.date} error={errors.date} max={today}
                onChange={handleFieldChange} onBlur={() => markTouched('date')}
                icon={CalendarDays}
              />
              <TextField
                field="amount" label="Amount (Rs.)" type="number" required
                inputMode="decimal" prefix="₹" placeholder="0" min="0" step="0.01"
                value={form.amount} error={errors.amount}
                onChange={handleFieldChange} onBlur={() => markTouched('amount')}
              />
              {!isDrv && (
                <SelectField
                  field="status" label="Status"
                  value={form.status} error={errors.status}
                  onChange={handleFieldChange} onBlur={() => markTouched('status')}
                >
                  {APPROVAL_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </SelectField>
              )}
              <div className="sm:col-span-2">
                <TextField
                  field="description" label="Description"
                  placeholder="What was this expense for?"
                  value={form.description} error={errors.description}
                  onChange={handleFieldChange} onBlur={() => markTouched('description')}
                />
              </div>
            </div>
          </Section>

          <Section icon={Route} title="Trip & Vehicle" subtitle="Optional links to the driver, vehicle and booking.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {!isDrv ? (
                <SearchableSelect
                  field="driver" label="Driver" icon={UserRound}
                  options={driverOptions} value={form.driver}
                  onChange={(field, value) => upd(field, value)}
                  onBlur={() => markTouched('driver')} error={errors.driver}
                />
              ) : (
                <TextField
                  field="driver" label="Driver" icon={UserRound}
                  placeholder={currentUser?.name}
                  value={form.driver} error={errors.driver}
                  onChange={handleFieldChange} onBlur={() => markTouched('driver')}
                />
              )}
              <SearchableSelect
                field="vehicle" label="Vehicle" icon={CarFront}
                options={vehicleOptions} value={form.vehicle}
                onChange={(field, value) => upd(field, value)}
                onBlur={() => markTouched('vehicle')} error={errors.vehicle}
              />
              <div className="sm:col-span-2">
                <SearchableSelect
                  field="tripRef" label="Trip Reference (optional)" icon={Route}
                  options={tripOptions} value={form.tripRef}
                  onChange={(field, value) => {
                    const b = bookings.find(x => x.bookingNo === value)
                    upd(field, value)
                    upd('bookingId', b?.id || '')
                  }}
                  onBlur={() => markTouched('tripRef')} error={errors.tripRef}
                />
              </div>
            </div>
          </Section>

          {panel && (
            <Section icon={panel.Icon} title={panel.title} subtitle={panel.subtitle} className={`rounded-2xl border p-3.5 ${panel.tone}`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {panel.fields.map(f => (
                  <TextField
                    key={f.field}
                    field={f.field}
                    label={f.label}
                    type={f.type || 'text'}
                    inputMode={f.type === 'number' ? 'decimal' : undefined}
                    placeholder={f.placeholder}
                    icon={f.icon}
                    prefix={f.prefix}
                    value={form[f.field]}
                    onChange={handleFieldChange}
                    onBlur={() => markTouched(f.field)}
                    error={errors[f.field]}
                  />
                ))}
              </div>
            </Section>
          )}

          <Section icon={UploadCloud} title="Receipt Upload" subtitle="A bill or invoice can be attached to this expense.">
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => {
                e.preventDefault()
                setDragging(false)
                handleReceiptFiles(e.dataTransfer.files)
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-2xl border border-dashed px-4 py-5 text-center cursor-pointer transition-colors ${
                dragging
                  ? 'border-amber-500 bg-amber-500/5'
                  : 'border-[var(--ap-border)] bg-[var(--ap-surface-2)] hover:border-[var(--ap-accent)]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={handleReceiptChange}
                className="hidden"
                aria-label="Upload receipt"
              />
              <UploadCloud size={24} className="mx-auto text-[var(--ap-accent)] mb-2" />
              <p className="text-sm font-semibold text-[var(--ap-text-1)]">Upload Receipt (Optional)</p>
              <p className="text-[11px] text-[var(--ap-text-3)] mt-1">Click to browse or drag and drop · JPG, PNG or PDF · up to 10 MB</p>

              {hasReceipt && (
                <div
                  onClick={e => e.stopPropagation()}
                  className="mt-3 mx-auto max-w-md flex items-center gap-3 rounded-xl border border-[var(--ap-border)] bg-[var(--ap-surface)] p-2.5 text-left"
                >
                  {imageReceipt && (previewUrl || form.receiptUrl) ? (
                    <img src={previewUrl || form.receiptUrl} alt="Receipt preview" className="w-10 h-10 rounded-lg object-cover border border-[var(--ap-border)]" />
                  ) : (
                    <span className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center flex-shrink-0">
                      <FileText size={16} />
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[var(--ap-text-1)] truncate">{form.receiptName}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {form.receiptUrl && !receiptFile && (
                        <a href={form.receiptUrl} target="_blank" rel="noopener noreferrer"
                          className="text-[11px] font-semibold text-[var(--ap-accent)] hover:underline">
                          View
                        </a>
                      )}
                      <button type="button" onClick={() => fileInputRef.current?.click()}
                        className="text-[11px] font-semibold text-[var(--ap-accent)] hover:underline">
                        Replace
                      </button>
                      <button type="button" onClick={clearReceipt}
                        className="text-[11px] font-semibold text-red-600 dark:text-red-400 hover:underline">
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {errors.receipt && (
              <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-red-600 dark:text-red-400">
                <AlertTriangle size={11} /> {errors.receipt}
              </p>
            )}
          </Section>

          <Section icon={FileText} title="Notes" subtitle="Internal context for the office and drivers.">
            <div>
              <label htmlFor="exp-notes" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
                Notes (Optional)
              </label>
              <AutoTextarea
                id="exp-notes"
                value={form.notes || ''}
                onChange={e => handleFieldChange('notes', e.target.value)}
                onBlur={() => markTouched('notes')}
                placeholder="Any additional notes..."
                maxLength={200}
                className={`${fieldCls} h-auto min-h-[76px] py-3 leading-relaxed resize-none`}
              />
            </div>
          </Section>
        </div>

        {/* Sticky footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-[var(--ap-border)] flex-shrink-0 bg-[var(--ap-surface)] pb-[max(1rem,env(safe-area-inset-bottom))]">
          {errors.save && (
            <div role="alert" className="mb-2.5 flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 px-3 py-2">
              <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-600 dark:text-red-400">{errors.save}</p>
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2">
            {!isEdit && (
              <Button variant="ghost" size="sm" icon={RotateCcw} onClick={handleReset} disabled={saving}
                className="self-start sm:self-auto sm:mr-auto">
                Reset
              </Button>
            )}
            <Button variant="outline" onClick={requestClose} disabled={saving}
              className="w-full sm:w-auto sm:min-w-[96px]">
              Cancel
            </Button>
            <Button variant="amber" onClick={handleSave} disabled={saving}
              className="w-full sm:w-auto sm:min-w-[148px]">
              {saving ? (
                <><Loader2 size={15} className="animate-spin" /> Saving…</>
              ) : (
                <><Plus size={15} /> {isEdit ? 'Save Changes' : isDrv ? 'Submit Expense' : 'Add Expense'}</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  )
}

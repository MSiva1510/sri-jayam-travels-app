// ─── AddDriverModal — premium Add/Edit Driver form ──────────────
// UI-only redesign. Field names, defaults, validation rules, login
// creation and the save payload stay identical to the previous inline
// AddDriverModal in Drivers.jsx.

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  UserRound, IdCard, Phone, CarFront, CalendarDays, BadgeCheck,
  Stethoscope, Lock, Eye, EyeOff, Landmark, CreditCard, Hash,
  UploadCloud, FileText, CheckCircle2, AlertTriangle, Loader2,
  RotateCcw, X, Plus, HeartHandshake, NotebookPen, KeyRound, Mail,
} from 'lucide-react'
import ModalOverlay from '../ui/ModalOverlay'
import Button from '../ui/Button'
import IconButton from '../ui/IconButton'
import AppleToggle from '../ui/AppleToggle'
import { fieldCls } from '../ui/Field'
import { driverRepository } from '../../repositories/driverRepository'
import { authRepository } from '../../repositories/authRepository'
import {
  driverToForm, validateDriverForm, validateLicenceFile,
  buildDriverPayload, MOBILE_LENGTH, MIN_PASSWORD_LENGTH,
  NOTES_MAX_LENGTH,
} from '../../utils/driverForm'

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
  required, placeholder, icon: Icon, counter, hint, min, max, maxLength,
  trailing, inputRef, autoComplete,
}) {
  const id = `drv-${field}`
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <label htmlFor={id} className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
          {label}{required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {counter && (
          <span className={`text-[10px] font-semibold tabular-nums ${
            counter.atLimit ? 'text-red-500' : 'text-[var(--ap-text-3)]'
          }`}>
            {counter.text}
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
          placeholder={placeholder}
          required={required}
          min={min}
          max={max}
          maxLength={maxLength}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          onChange={e => onChange(field, e.target.value)}
          onBlur={onBlur}
          className={`${fieldCls} ${Icon ? 'pl-10' : ''} ${trailing ? 'pr-11' : ''} ${error ? '!border-red-400 dark:!border-red-500' : ''}`}
        />
        {trailing}
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-red-600 dark:text-red-400">
          <AlertTriangle size={11} className="flex-shrink-0" /> {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-[11px] text-[var(--ap-text-3)]">{hint}</p>
      ) : null}
    </div>
  )
}

function AutoTextarea({ value, onChange, ...props }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 88), 200)}px`
  }, [value])
  return <textarea ref={ref} value={value} onChange={onChange} {...props} />
}

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImageSrc(src) {
  return /^data:image\//i.test(src) || /\.(jpe?g|png|webp|gif|avif)$/i.test(src)
}

export default function AddDriverModal({ driver, onClose, onSaved }) {
  const isEditMode = !!driver?.id
  const [initialForm] = useState(() => driverToForm(driver))
  const [form, setForm] = useState(() => ({ ...initialForm }))
  const [serverErrors, setServerErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [closing, setClosing] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [licenceImg, setLicenceImg] = useState(null)
  const [licenceFile, setLicenceFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [licenceError, setLicenceError] = useState('')
  const [dragging, setDragging] = useState(false)
  const savingRef = useRef(false)
  const closeTimer = useRef(null)
  const fileRef = useRef(null)
  const dialogRef = useRef(null)
  const firstFieldRef = useRef(null)
  const existingLicence = isEditMode ? (driver?.license_photo_url || '') : ''

  const validation = useMemo(() => validateDriverForm(form), [form])
  const errors = useMemo(() => {
    const visible = { ...serverErrors }
    if (licenceError) visible.licence = licenceError
    Object.entries(validation).forEach(([field, message]) => {
      if (submitted || touched[field]) visible[field] = message
    })
    return visible
  }, [serverErrors, licenceError, validation, submitted, touched])

  const upd = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setServerErrors(prev => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
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

  const handleLicenceFiles = files => {
    const file = files?.[0]
    if (!file) return
    const message = validateLicenceFile(file)
    if (message) {
      setLicenceError(message)
      setLicenceFile(null)
      setLicenceImg(null)
      setPreview(null)
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    setLicenceError('')
    setLicenceFile({ name: file.name, size: file.size, type: file.type })
    const reader = new FileReader()
    reader.onload = ev => {
      setLicenceImg(ev.target.result)
      setPreview(file.type.startsWith('image/') ? ev.target.result : null)
    }
    reader.readAsDataURL(file)
  }

  const clearLicence = e => {
    e?.stopPropagation()
    setLicenceImg(null)
    setLicenceFile(null)
    setPreview(null)
    setLicenceError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleReset = () => {
    if (savingRef.current) return
    setForm({ ...initialForm })
    setServerErrors({})
    setTouched({})
    setSubmitted(false)
    setLicenceImg(null)
    setLicenceFile(null)
    setPreview(null)
    setLicenceError('')
    setShowPassword(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleSave = async () => {
    if (savingRef.current || closing) return
    setSubmitted(true)
    const found = validateDriverForm(form)
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
      const payload = buildDriverPayload(form, {
        isEdit: isEditMode,
        id: `DRV-${Date.now()}`,
        now: new Date().toISOString(),
        licenceImg,
      })

      if (isEditMode) {
        const updated = await driverRepository.update(driver.id, payload)
        onSaved(updated || { ...driver, ...payload })
      } else {
        const created = await driverRepository.create(payload)
        const savedDriver = created || payload

        // Driver login: auth user + driver profile (admin session restored after).
        if (form.createLogin) {
          try {
            await authRepository.adminCreateUser({
              email: form.email.trim(),
              password: form.password,
              full_name: form.name.trim(),
              role: 'driver',
              phone: form.mobile.trim() || null,
            })
          } catch (userErr) {
            console.error('Driver login creation failed:', userErr)
            alert(`Driver saved, but login creation failed: ${userErr.message || userErr}`)
          }
        }
        onSaved(savedDriver)
      }
      saved = true
    } catch (err) {
      console.error('AddDriver failed:', err)
      setServerErrors({ save: 'Failed to save driver. Please try again.' })
    } finally {
      savingRef.current = false
      setSaving(false)
      if (saved) requestClose()
    }
  }

  const requiredFilled =
    !!form.name.trim() && !!form.mobile.trim() && !!form.license.trim() &&
    (!form.createLogin || (!!form.email.trim() && !!form.password))

  const hasLicence = !!(licenceFile || existingLicence)
  const previewSrc = preview || (existingLicence && isImageSrc(existingLicence) ? existingLicence : '')
  const notesLength = String(form.notes || '').length

  const passwordToggle = (
    <button
      type="button"
      onClick={() => setShowPassword(v => !v)}
      aria-label={showPassword ? 'Hide password' : 'Show password'}
      className="ap-focus absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
    >
      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
    </button>
  )

  return (
    <ModalOverlay onClose={requestClose} closing={closing}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="driver-modal-title"
        className={`w-full h-[100dvh] sm:h-auto sm:w-[900px] max-h-[100dvh] sm:max-h-[90vh] ap-surface rounded-none sm:rounded-[22px] border border-[var(--ap-border)] shadow-2xl flex flex-col animate-fade-up transition-[transform,opacity] duration-150 ease-out overflow-hidden ${
          closing ? 'opacity-0 translate-y-2 sm:translate-y-0 sm:scale-[0.98]' : ''
        }`}
      >
        {/* Fixed header */}
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b border-[var(--ap-border)] flex-shrink-0 bg-[var(--ap-surface)]">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
              <UserRound size={19} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-[var(--ap-text-3)] uppercase tracking-[0.14em]">
                Driver Management
              </p>
              <h3 id="driver-modal-title" className="font-sf font-semibold text-[17px] tracking-tight text-[var(--ap-text-1)] truncate mt-0.5">
                {isEditMode ? (form.name || 'Edit Driver') : 'New Driver'}
              </h3>
              <p className="text-[11px] text-[var(--ap-text-3)] mt-0.5">
                {isEditMode ? 'Update driver details for your fleet.' : 'Add driver details to your fleet.'}
              </p>
            </div>
          </div>
          <IconButton icon={X} label="Close driver form" size={16} onClick={requestClose}
            className="w-9 h-9 rounded-xl bg-[var(--ap-surface-2)] flex-shrink-0" />
        </div>

        {/* Scrollable form */}
        <div className="overflow-y-auto scroll-smooth flex-1 px-4 sm:px-6 py-5 space-y-6">
          {errors.save && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 px-3.5 py-3">
              <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-red-700 dark:text-red-300">{errors.save}</p>
            </div>
          )}

          <Section icon={UserRound} title="Personal Information"
            subtitle="Identity, licence and vehicle details.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <TextField
                field="name" label="Name" required icon={UserRound} placeholder="Full name"
                value={form.name} error={errors.name} inputRef={firstFieldRef}
                onChange={upd} onBlur={() => markTouched('name')}
              />
              <TextField
                field="mobile" label="Mobile" required type="tel" inputMode="numeric" icon={Phone}
                placeholder="10-digit mobile number" maxLength={MOBILE_LENGTH}
                counter={{ text: `${String(form.mobile || '').length}/${MOBILE_LENGTH}`, atLimit: String(form.mobile || '').length >= MOBILE_LENGTH }}
                value={form.mobile} error={errors.mobile}
                onChange={(_, v) => upd('mobile', String(v).replace(/\D/g, '').slice(0, MOBILE_LENGTH))}
                onBlur={() => markTouched('mobile')}
              />
              <TextField
                field="vehicle" label="Vehicle Registration" icon={CarFront} placeholder="e.g. PY01XX1234"
                value={form.vehicle} error={errors.vehicle}
                onChange={upd} onBlur={() => markTouched('vehicle')}
              />
              <TextField
                field="vehicleType" label="Vehicle Type" icon={CarFront} placeholder="4+1 Sedan / 7+1 SUV"
                value={form.vehicleType} error={errors.vehicleType}
                onChange={upd} onBlur={() => markTouched('vehicleType')}
              />
              <TextField
                field="license" label="Licence Number" required icon={IdCard} placeholder="TN1234567890"
                value={form.license} error={errors.license}
                onChange={upd} onBlur={() => markTouched('license')}
              />
              <TextField
                field="licenseExpiry" label="Licence Expiry" type="date" icon={CalendarDays}
                value={form.licenseExpiry} error={errors.licenseExpiry}
                onChange={upd} onBlur={() => markTouched('licenseExpiry')}
              />
              <TextField
                field="badge" label="Badge Number" icon={BadgeCheck} placeholder="Badge number"
                value={form.badge} error={errors.badge}
                onChange={upd} onBlur={() => markTouched('badge')}
              />
              <TextField
                field="medicalExpiry" label="Medical Certificate Expiry" type="date" icon={Stethoscope}
                value={form.medicalExpiry} error={errors.medicalExpiry}
                onChange={upd} onBlur={() => markTouched('medicalExpiry')}
              />
              <TextField
                field="joined" label="Join Date" type="date" icon={CalendarDays}
                value={form.joined} error={errors.joined}
                onChange={upd} onBlur={() => markTouched('joined')}
              />
            </div>
          </Section>

          <Section icon={Lock} title="Driver Login" subtitle="App access for this driver."
            className="rounded-2xl border border-blue-200/70 bg-blue-50/60 dark:border-blue-500/20 dark:bg-blue-500/5 p-3.5">
            {!isEditMode ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-[var(--ap-text-2)]">
                    Create a login so the driver can sign in to the mobile app.
                  </p>
                  <label className="flex items-center gap-2 text-[11px] font-semibold text-[var(--ap-text-2)]">
                    <span>Create login</span>
                    <AppleToggle
                      checked={form.createLogin}
                      onChange={v => upd('createLogin', v)}
                      label="Create login"
                    />
                  </label>
                </div>
                {form.createLogin ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                    <TextField
                      field="email" label="Login Email" required type="email" icon={Mail}
                      placeholder="driver@example.com" autoComplete="off"
                      value={form.email} error={errors.email}
                      onChange={upd} onBlur={() => markTouched('email')}
                    />
                    <TextField
                      field="password" label="Temporary Password" required
                      type={showPassword ? 'text' : 'password'} icon={KeyRound}
                      placeholder={`Min ${MIN_PASSWORD_LENGTH} characters`}
                      hint={`At least ${MIN_PASSWORD_LENGTH} characters. The driver can change it after signing in.`}
                      autoComplete="new-password" trailing={passwordToggle}
                      value={form.password} error={errors.password}
                      onChange={upd} onBlur={() => markTouched('password')}
                    />
                  </div>
                ) : (
                  <p className="text-[11px] text-[var(--ap-text-3)]">
                    No app login will be created for this driver.
                  </p>
                )}
              </>
            ) : (
              <p className="text-[11px] text-[var(--ap-text-3)]">
                Login credentials are set when a driver is created and can&apos;t be changed here.
              </p>
            )}
          </Section>

          <Section icon={Landmark} title="Bank Details"
            subtitle="Optional. Used for salary and bata payouts.">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <TextField
                field="bankName" label="Bank Name" icon={Landmark} placeholder="e.g. State Bank of India"
                value={form.bankName} error={errors.bankName}
                onChange={upd} onBlur={() => markTouched('bankName')}
              />
              <TextField
                field="accountNo" label="Account Number" icon={CreditCard} inputMode="numeric"
                placeholder="Account number"
                value={form.accountNo} error={errors.accountNo}
                onChange={upd} onBlur={() => markTouched('accountNo')}
              />
              <TextField
                field="ifscCode" label="IFSC Code" icon={Hash} placeholder="e.g. SBIN0001234"
                value={form.ifscCode} error={errors.ifscCode}
                onChange={(_, v) => upd('ifscCode', String(v).toUpperCase())}
                onBlur={() => markTouched('ifscCode')}
              />
            </div>
          </Section>

          <Section icon={HeartHandshake} title="Emergency Contact"
            subtitle="Optional. Who should we contact in an emergency?">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <TextField
                field="emergencyName" label="Contact Name" icon={UserRound} placeholder="Contact name"
                value={form.emergencyName} error={errors.emergencyName}
                onChange={upd} onBlur={() => markTouched('emergencyName')}
              />
              <TextField
                field="emergencyContact" label="Mobile Number" type="tel" inputMode="numeric" icon={Phone}
                placeholder="10-digit mobile number" maxLength={MOBILE_LENGTH}
                value={form.emergencyContact} error={errors.emergencyContact}
                onChange={(_, v) => upd('emergencyContact', String(v).replace(/\D/g, '').slice(0, MOBILE_LENGTH))}
                onBlur={() => markTouched('emergencyContact')}
              />
            </div>
          </Section>

          <Section icon={UploadCloud} title="Driving Licence"
            subtitle="Upload the licence (image or PDF, up to 2 MB).">
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => {
                e.preventDefault()
                setDragging(false)
                handleLicenceFiles(e.dataTransfer.files)
              }}
              onClick={() => fileRef.current?.click()}
              className={`rounded-2xl border border-dashed px-4 py-5 text-center cursor-pointer transition-colors ${
                dragging
                  ? 'border-teal-500 bg-teal-500/5'
                  : 'border-teal-300 dark:border-teal-700/50 bg-teal-50/60 dark:bg-teal-900/10 hover:border-teal-400'
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={e => handleLicenceFiles(e.target.files)}
                className="hidden"
                aria-label="Upload driving licence"
              />
              {hasLicence ? (
                <div
                  onClick={e => e.stopPropagation()}
                  className="mx-auto max-w-md flex items-center gap-3 rounded-xl border border-[var(--ap-border)] bg-[var(--ap-surface)] p-2.5 text-left"
                >
                  {previewSrc ? (
                    <img src={previewSrc} alt="Licence preview" className="w-12 h-12 rounded-lg object-cover border border-[var(--ap-border)] flex-shrink-0" />
                  ) : (
                    <span className="w-12 h-12 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center flex-shrink-0">
                      <FileText size={18} />
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[var(--ap-text-1)] truncate">
                      {licenceFile ? licenceFile.name : 'Current licence on file'}
                    </p>
                    <p className="text-[11px] text-[var(--ap-text-3)] mt-0.5">
                      {licenceFile
                        ? `${formatBytes(licenceFile.size)} · ${licenceFile.type === 'application/pdf' ? 'PDF' : 'Image'}`
                        : 'Stored with this driver'}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <button type="button" onClick={() => fileRef.current?.click()}
                        className="text-[11px] font-semibold text-[var(--ap-accent)] hover:underline">
                        {licenceFile ? 'Replace' : 'Upload new'}
                      </button>
                      {licenceFile && (
                        <button type="button" onClick={clearLicence}
                          className="text-[11px] font-semibold text-red-600 dark:text-red-400 hover:underline">
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                  {licenceFile && <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />}
                </div>
              ) : (
                <div className="py-1">
                  <UploadCloud size={24} className="mx-auto text-teal-600 dark:text-teal-400 mb-2" />
                  <p className="text-sm font-semibold text-[var(--ap-text-1)]">Upload Licence (image / PDF)</p>
                  <p className="text-[11px] text-[var(--ap-text-3)] mt-1">
                    Click to browse or drag and drop · JPG, PNG or PDF · up to 2 MB
                  </p>
                </div>
              )}
            </div>
            {errors.licence && (
              <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-red-600 dark:text-red-400">
                <AlertTriangle size={11} className="flex-shrink-0" /> {errors.licence}
              </p>
            )}
          </Section>

          <Section icon={NotebookPen} title="Notes" subtitle="Anything the office should know about this driver.">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label htmlFor="drv-notes" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                  Notes (Optional)
                </label>
                <span className={`text-[10px] font-semibold tabular-nums ${
                  notesLength > NOTES_MAX_LENGTH * 0.9 ? 'text-red-500' : 'text-[var(--ap-text-3)]'
                }`}>
                  {notesLength}/{NOTES_MAX_LENGTH}
                </span>
              </div>
              <AutoTextarea
                id="drv-notes"
                value={form.notes || ''}
                onChange={e => upd('notes', e.target.value)}
                onBlur={() => markTouched('notes')}
                placeholder="Any additional notes about the driver..."
                maxLength={NOTES_MAX_LENGTH}
                className={`${fieldCls} h-auto min-h-[88px] py-3 leading-relaxed resize-none`}
              />
            </div>
          </Section>
        </div>

        {/* Sticky footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-[var(--ap-border)] flex-shrink-0 bg-[var(--ap-surface)] pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2">
            <Button variant="ghost" size="sm" icon={RotateCcw} onClick={handleReset} disabled={saving}
              className="self-start sm:self-auto sm:mr-auto">
              Reset
            </Button>
            <Button variant="outline" onClick={requestClose} disabled={saving}
              className="w-full sm:w-auto sm:min-w-[96px]">
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={saving || !requiredFilled}
              className="w-full sm:w-auto sm:min-w-[150px]">
              {saving ? (
                <><Loader2 size={15} className="animate-spin" /> Saving…</>
              ) : (
                <><Plus size={15} /> {isEditMode ? 'Save Changes' : 'Add Driver'}</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  )
}

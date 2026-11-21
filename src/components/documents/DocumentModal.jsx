// ─── DocumentModal — premium Add/Edit Document form ───────────
// UI redesign only: every stored value and Supabase operation is preserved.
// The page injects upload/save/preview callbacks so this component stays
// testable without Supabase credentials.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, Building2, CalendarDays, CarFront, Check, CheckCircle2,
  Eye, FileText, Image as ImageIcon, Info, Loader2, Paperclip, RotateCcw,
  ScanLine, ShieldCheck, Sparkles, Trash2, UploadCloud, UserRound, X,
} from 'lucide-react'

import ModalOverlay from '../ui/ModalOverlay'
import Button from '../ui/Button'
import IconButton from '../ui/IconButton'
import Callout from '../ui/Callout'
import StatusPill from '../ui/StatusPill'
import { Input, Select, Textarea } from '../ui/Field'
import {
  DOCUMENT_CATEGORIES,
  IMAGE_MIMES,
  REMINDER_INTERVALS,
  STATUS_CFG,
  changeCategory,
  documentStatus,
  documentToForm,
  entityOptionsFor,
  formatFileSize,
  mapOcrFields,
  requiresEntity,
  suggestReminderDate,
  typeHasExpiry,
  typeOptionsFor,
  validateDocumentForm,
  validateFile,
} from '../../utils/documentForm.js'

const CATEGORY_ICONS = { driver: UserRound, vehicle: CarFront, company: Building2 }
const CATEGORY_HINTS = {
  driver: 'Link this document to a driver.',
  vehicle: 'Link this document to a vehicle.',
  company: 'Kept at company level — no linked person or vehicle.',
}
const TONE = { active: 'green', expiring_soon: 'amber', expired: 'red', no_expiry: 'gray', pending: 'gray' }

function Section({ icon: Icon, title, subtitle, children, status }) {
  return (
    <section className="space-y-3.5">
      <div className="flex items-start gap-2.5">
        <span className="w-8 h-8 rounded-xl bg-[var(--ap-surface-2)] text-[var(--ap-accent)] flex items-center justify-center flex-shrink-0">
          <Icon size={15} strokeWidth={2} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-sf text-[13px] font-semibold tracking-tight text-[var(--ap-text-1)]">{title}</h4>
            {status}
          </div>
          {subtitle && <p className="text-[11px] leading-snug text-[var(--ap-text-3)] mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function Label({ htmlFor, children, required, hint }) {
  return (
    <div className="flex items-baseline justify-between gap-2 mb-1.5">
      <label htmlFor={htmlFor} className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
        {children}{required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
      </label>
      {hint && <span className="text-[10px] text-[var(--ap-text-3)]">{hint}</span>}
    </div>
  )
}

function ErrorText({ id, children }) {
  if (!children) return null
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-start gap-1.5 text-[11px] font-medium text-red-600 dark:text-red-400">
      <AlertTriangle size={12} className="mt-px flex-shrink-0" /> {children}
    </p>
  )
}

function CategoryCard({ category, selected, onClick }) {
  const Icon = CATEGORY_ICONS[category.key] || FileText
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`group relative flex flex-col items-start gap-2 rounded-2xl border px-3 py-3 text-left transition-all duration-200 active:scale-[0.98] ${
        selected
          ? 'border-[var(--ap-accent)] bg-[var(--ap-accent)]/[0.06] ring-2 ring-[var(--ap-accent)]/20 shadow-sm'
          : 'border-[var(--ap-border)] bg-[var(--ap-surface-2)] hover:border-[var(--ap-accent)]/50 hover:bg-[var(--ap-surface)]'
      }`}
    >
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
        selected ? 'bg-[var(--ap-accent)] text-white' : 'bg-[var(--ap-surface)] text-[var(--ap-text-2)] group-hover:text-[var(--ap-accent)]'
      }`}>
        <Icon size={17} strokeWidth={2} />
      </span>
      <span className="flex items-center gap-1.5">
        <span className="font-sf text-[13px] font-semibold text-[var(--ap-text-1)]">{category.label}</span>
        {selected && <Check size={13} className="text-[var(--ap-accent)]" aria-hidden="true" />}
      </span>
      <span className="text-[10px] leading-snug text-[var(--ap-text-3)]">{CATEGORY_HINTS[category.key]}</span>
    </button>
  )
}

function UploadSlot({
  side, title, file, preview, fileName, fileSize, storedUrl, error, busy,
  onPick, onDrop, onClear, onPreview, onScan, canScan, ocrRunning,
}) {
  const [dragging, setDragging] = useState(false)
  const isImage = file && IMAGE_MIMES.includes(file.type)
  const isPdf = /\.(pdf)$/i.test(String(fileName || file?.name || ''))
  const hasFile = !!file || !!storedUrl

  return (
    <div className="rounded-2xl border border-[var(--ap-border)] bg-[var(--ap-surface-2)] p-3.5 sm:p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <p className="font-sf text-[13px] font-semibold text-[var(--ap-text-1)]">{title}</p>
          <p className="text-[10px] text-[var(--ap-text-3)] mt-0.5">
            {side === 'back' ? 'Optional — for two-page documents.' : 'JPG, PNG, PDF, DOC or DOCX · up to 10 MB'}
          </p>
        </div>
        {hasFile && <StatusPill tone="green"><span className="inline-flex items-center gap-1"><Check size={10} /> Attached</span></StatusPill>}
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); onDrop(e) }}
        className={`rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-all duration-200 ${
          dragging
            ? 'border-[var(--ap-accent)] bg-[var(--ap-accent)]/[0.06] scale-[1.005]'
            : 'border-[var(--ap-border)] bg-[var(--ap-surface)]'
        }`}
      >
        {hasFile ? (
          <div className="flex flex-col sm:flex-row items-center gap-3 text-left">
            <button
              type="button"
              onClick={onPreview}
              className="w-16 h-16 rounded-xl overflow-hidden bg-[var(--ap-surface-2)] border border-[var(--ap-border)] flex items-center justify-center flex-shrink-0"
              aria-label={`Preview ${fileName || 'attachment'}`}
            >
              {preview || (file && isImage) ? (
                <img src={preview} alt="" className="w-full h-full object-cover" />
              ) : isPdf ? (
                <span className="text-[10px] font-bold text-red-500">PDF</span>
              ) : (
                <FileText size={22} className="text-[var(--ap-text-3)]" />
              )}
            </button>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="text-[12px] font-semibold text-[var(--ap-text-1)] break-all">{fileName || 'Attached file'}</p>
              <p className="text-[10px] text-[var(--ap-text-3)] mt-0.5">
                {fileSize ? formatFileSize(fileSize) : 'Existing attachment'}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" size="sm" variant="outline" icon={Eye} onClick={onPreview}>Preview</Button>
              <Button type="button" size="sm" variant="ghost" icon={RotateCcw} onClick={onPick} disabled={busy}>Replace</Button>
              <Button type="button" size="sm" variant="ghost" icon={Trash2} onClick={onClear} disabled={busy}>Remove</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="w-11 h-11 rounded-2xl bg-[var(--ap-accent)]/10 text-[var(--ap-accent)] flex items-center justify-center">
              <UploadCloud size={20} />
            </span>
            <p className="font-sf text-[13px] font-semibold text-[var(--ap-text-1)]">
              {dragging ? 'Drop the file here' : 'Drag and drop a file'}
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-1">
              <Button type="button" size="sm" variant="outline" icon={Paperclip} onClick={() => onPick(false)} disabled={busy}>Browse files</Button>
              <Button type="button" size="sm" variant="ghost" icon={ImageIcon} onClick={() => onPick(true)} disabled={busy}>
                Camera / Scan
              </Button>
            </div>
          </div>
        )}
      </div>

      {busy && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-[var(--ap-accent)]" role="status">
          <Loader2 size={12} className="animate-spin" /> Uploading {side}…
        </p>
      )}
      <ErrorText id={`doc-${side}-error`}>{error}</ErrorText>

      {side === 'front' && hasFile && (
        <Button
          type="button" size="sm" variant="secondary" icon={ocrRunning ? Loader2 : ScanLine}
          className="mt-3 w-full sm:w-auto" onClick={onScan}
          disabled={ocrRunning || busy || !canScan}
        >
          {ocrRunning ? 'Scanning…' : 'Scan & Auto Fill'}
        </Button>
      )}
    </div>
  )
}

export default function DocumentModal({
  document: initialDocument,
  drivers = [], vehicles = [], customers = [],
  onClose, onSave, uploadFile, scanDocument, onPreview,
}) {
  const [form, setForm] = useState(() => documentToForm(initialDocument))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(null)
  const [closing, setClosing] = useState(false)
  const [noExpiry, setNoExpiry] = useState(
    () => !form.expiry_date && !typeHasExpiry(form.category, form.doc_type)
  )
  const [reminderTouched, setReminderTouched] = useState(false)
  const [files, setFiles] = useState({ front: null, back: null })
  const [previews, setPreviews] = useState({ front: null, back: null })
  const [notice, setNotice] = useState(null)
  const [ocr, setOcr] = useState(null)
  const [ocrRunning, setOcrRunning] = useState(false)
  const [suggestions, setSuggestions] = useState([])

  const dialogRef = useRef(null)
  const inputRefs = { front: useRef(null), back: useRef(null) }
  const savingRef = useRef(false)
  const closeTimer = useRef(null)
  const previewUrls = useRef(new Set())

  const isEdit = !!initialDocument?.id
  // Kept in sync so an OCR result is merged with the form as it is when the
  // scan finishes, not the snapshot from when it started.
  const formRef = useRef(form)
  const upd = useCallback(patch => {
    setForm(f => {
      const next = { ...f, ...patch }
      formRef.current = next
      return next
    })
  }, [])

  useEffect(() => { formRef.current = form }, [form])

  useEffect(() => {
    const next = documentToForm(initialDocument)
    formRef.current = next
    setForm(next)
    setNoExpiry(!next.expiry_date && !typeHasExpiry(next.category, next.doc_type))
    setReminderTouched(false)
    setFiles({ front: null, back: null })
    setOcr(null)
    setSuggestions([])
    setErrors({})
  }, [initialDocument])

  useEffect(() => {
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current)
      for (const url of previewUrls.current) URL.revokeObjectURL(url)
    }
  }, [])

  const requestClose = useCallback(() => {
    if (savingRef.current || closing) return
    setClosing(true)
    closeTimer.current = window.setTimeout(onClose, 150)
  }, [closing, onClose])

  useEffect(() => {
    dialogRef.current?.querySelector('#doc-entity, #doc-title')?.focus()
    const onKey = e => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault()
        requestClose()
        return
      }
      if (e.key !== 'Tab') return
      const root = dialogRef.current
      if (!root) return
      const focusables = [...root.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )].filter(el => el.offsetParent !== null)
      if (!focusables.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [requestClose])

  const entityOptions = useMemo(
    () => entityOptionsFor(form.category, drivers, vehicles, customers),
    [form.category, drivers, vehicles, customers]
  )
  const typeOptions = useMemo(
    () => typeOptionsFor(form.category, form.doc_type),
    [form.category, form.doc_type]
  )
  const statusKey = noExpiry ? 'no_expiry' : documentStatus(form.expiry_date, form.status)
  const statusCfg = STATUS_CFG[statusKey] || STATUS_CFG.no_expiry
  const showExpiry = !noExpiry && (
    typeHasExpiry(form.category, form.doc_type) || !!form.expiry_date || !!initialDocument?.expiry_date
  )

  const setError = (key, value) => setErrors(prev => ({ ...prev, [key]: value }))

  const clearFile = side => {
    const preview = previews[side]
    if (preview) {
      URL.revokeObjectURL(preview)
      previewUrls.current.delete(preview)
    }
    files[side] = null
    setFiles({ ...files })
    setPreviews(prev => ({ ...prev, [side]: null }))
    if (inputRefs[side].current) inputRefs[side].current.value = ''
    if (side === 'front') {
      upd({
        frontFileUrl: null, frontFileName: '', frontFileSize: null, frontFilePath: null,
        _existingFrontUrl: null,
      })
      setOcr(null)
      setSuggestions([])
    } else {
      upd({
        backFileUrl: null, backFileName: '', backFileSize: null, backFilePath: null,
        _existingBackUrl: null,
      })
    }
    setError(side, null)
  }

  const acceptFile = (side, file, camera = false) => {
    if (!file) return
    const problem = validateFile(file)
    if (problem) {
      setError(side, problem)
      return
    }
    const previous = previews[side]
    if (previous) {
      URL.revokeObjectURL(previous)
      previewUrls.current.delete(previous)
    }
    files[side] = file
    setFiles({ ...files })
    setError(side, null)
    const localPreview = IMAGE_MIMES.includes(file.type) ? URL.createObjectURL(file) : null
    if (localPreview) previewUrls.current.add(localPreview)
    setPreviews(prev => ({ ...prev, [side]: localPreview }))
    if (side === 'front') {
      upd({ frontFileUrl: null, frontFileName: file.name, frontFileSize: file.size, frontFilePath: null })
      setOcr(null)
      setSuggestions([])
    } else {
      upd({ backFileUrl: null, backFileName: file.name, backFileSize: file.size, backFilePath: null })
    }
    if (camera) setNotice({ tone: 'blue', text: 'Photo selected. Review it, then save or scan for details.' })
  }

  const onPick = (side, camera = false) => {
    const input = inputRefs[side].current
    if (!input) return
    if (camera) input.setAttribute('capture', 'environment')
    else input.removeAttribute('capture')
    input.click()
  }

  const onDrop = (side, e) => acceptFile(side, e.dataTransfer?.files?.[0])

  const runScan = async () => {
    const file = files.front
    if (!file) {
      setError('front', 'Choose an image or PDF to scan first')
      return
    }
    setOcrRunning(true)
    setOcr({ ok: false, error: null, fields: null, confidence: null, provider: null })
    setNotice(null)
    try {
      const result = await (scanDocument || (async () => ({
        ok: false, error: 'Scanning is not available in this deployment',
      })))(file)
      setOcr(result)
      if (result?.ok && result.fields) {
        const base = formRef.current
        const mapped = mapOcrFields(result.fields, base, base.category)
        formRef.current = mapped.form
        setForm(mapped.form)
        setSuggestions(mapped.suggestions)
        if (mapped.form.expiry_date && !reminderTouched && !mapped.form.reminder_date) {
          upd({ reminder_date: suggestReminderDate(mapped.form.expiry_date, mapped.form.reminder_interval) })
        }
        if (mapped.form.expiry_date) setNoExpiry(false)
      }
    } catch (err) {
      setOcr({ ok: false, error: err?.message || 'Could not scan this document' })
    } finally {
      setOcrRunning(false)
    }
  }

  const previewFile = async side => {
    if (files[side]) {
      const local = previews[side]
      if (local) window.open(local, '_blank', 'noopener,noreferrer')
      return
    }
    const url = await onPreview?.(initialDocument, side)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  const onExpiryChange = value => {
    const patch = { expiry_date: value }
    if (!value) {
      patch.reminder_date = ''
      setReminderTouched(false)
    } else if (!reminderTouched) {
      patch.reminder_date = suggestReminderDate(value, form.reminder_interval)
    }
    upd(patch)
    setError('expiry_date', null)
    setError('reminder_date', null)
  }

  const onIntervalChange = value => {
    const interval = Number(value)
    const patch = { reminder_interval: interval }
    if (!reminderTouched && form.expiry_date) {
      patch.reminder_date = suggestReminderDate(form.expiry_date, interval)
    }
    upd(patch)
  }

  const handleSave = async () => {
    if (savingRef.current) return
    const found = validateDocumentForm(form, files.front)
    // The pure validator uses the generic `file` key; the modal shows it on
    // the attachment slot so the user can act on it directly.
    if (found.file) {
      found.front = found.file
      delete found.file
    }
    if (errors.front) found.front = errors.front
    if (errors.back) found.back = errors.back
    if (Object.keys(found).length) {
      setErrors(found)
      return
    }
    savingRef.current = true
    setSaving(true)
    setErrors({})
    setNotice(null)
    try {
      let frontMeta = null
      let backMeta = null
      if (files.front) {
        setUploading('front')
        frontMeta = await uploadFile(files.front, { category: form.category, side: 'front' })
      }
      if (files.back) {
        setUploading('back')
        backMeta = await uploadFile(files.back, { category: form.category, side: 'back' })
      }
      setUploading(null)
      const saved = await onSave(form, { frontMeta, backMeta })
      setNotice({ tone: 'green', text: isEdit ? 'Document updated.' : 'Document saved.' })
      closeTimer.current = window.setTimeout(() => {
        savingRef.current = false
        onClose()
      }, 250)
    } catch (err) {
      console.error('[Documents] save failed:', err)
      setErrors({ save: err?.message || 'Could not save the document. Please try again.' })
      setSaving(false)
      savingRef.current = false
      setUploading(null)
    }
  }

  const disabled = saving || !!uploading

  return (
    <ModalOverlay onClose={requestClose} closing={closing}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-modal-title"
        className={`w-full h-[100dvh] sm:h-auto sm:w-[880px] max-h-[100dvh] sm:max-h-[90vh] ap-surface rounded-none sm:rounded-[22px] border border-[var(--ap-border)] shadow-2xl flex flex-col animate-fade-up transition-[transform,opacity] duration-150 ease-out overflow-hidden ${
          closing ? 'opacity-0 translate-y-2 sm:translate-y-0 sm:scale-[0.98]' : ''
        }`}
      >
        {/* Sticky header */}
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b border-[var(--ap-border)] flex-shrink-0 bg-[var(--ap-surface)]">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
              <FileText size={19} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-[var(--ap-text-3)] uppercase tracking-[0.14em]">Document management</p>
              <h3 id="document-modal-title" className="font-sf font-semibold text-[17px] tracking-tight text-[var(--ap-text-1)] truncate mt-0.5">
                {isEdit ? 'Edit Document' : 'Add Document'}
              </h3>
              <p className="text-[11px] text-[var(--ap-text-3)] mt-0.5">
                {isEdit ? 'Update the details and attachments for this document.' : 'Keep licences, permits and company records in one place.'}
              </p>
            </div>
          </div>
          <IconButton icon={X} label="Close document form" size={16} onClick={requestClose}
            className="w-9 h-9 rounded-xl bg-[var(--ap-surface-2)] flex-shrink-0" />
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto scroll-smooth flex-1 px-4 sm:px-6 py-5 space-y-6">
          <Section icon={FileText} title="Document" subtitle="Choose where this record belongs and what it is.">
            <div>
              <Label>Category</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5" role="radiogroup" aria-label="Document category">
                {DOCUMENT_CATEGORIES.map(cat => (
                  <CategoryCard
                    key={cat.key}
                    category={cat}
                    selected={form.category === cat.key}
                    onClick={() => {
                      if (form.category === cat.key) return
                      setForm(f => {
                        const next = changeCategory(f, cat.key)
                        formRef.current = next
                        return next
                      })
                      setErrors(prev => ({ ...prev, entity_id: null, category: null }))
                      setNoExpiry(false)
                    }}
                  />
                ))}
              </div>
            </div>

            {requiresEntity(form.category) ? (
              <div>
                <Label htmlFor="doc-entity" required>{form.category === 'vehicle' ? 'Vehicle' : form.category === 'customer' ? 'Customer' : 'Driver'}</Label>
                <Select
                  id="doc-entity"
                  value={form.entity_id}
                  onChange={e => upd({ entity_id: e.target.value })}
                  aria-invalid={!!errors.entity_id}
                  aria-describedby={errors.entity_id ? 'doc-entity-error' : undefined}
                  className={errors.entity_id ? '!border-red-400 dark:!border-red-500' : ''}
                >
                  <option value="">— Select {form.category === 'vehicle' ? 'a vehicle' : form.category === 'customer' ? 'a customer' : 'a driver'} —</option>
                  {entityOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  {form.entity_id && !entityOptions.some(o => String(o.value) === String(form.entity_id)) && (
                    <option value={form.entity_id}>Current linked record (not listed)</option>
                  )}
                </Select>
                <ErrorText id="doc-entity-error">{errors.entity_id}</ErrorText>
              </div>
            ) : form.category === 'company' ? (
              <Callout tone="blue" icon={ShieldCheck} title="Company-level document" sub={CATEGORY_HINTS.company} />
            ) : (
              <Callout tone="amber" icon={Info}
                title="Legacy document category"
                sub="This record predates the current categories. Choose Drivers, Vehicles or Company above before saving." />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <Label htmlFor="doc-type">Document type</Label>
                <Select id="doc-type" value={form.doc_type} onChange={e => {
                  const docType = e.target.value
                  upd({ doc_type: docType })
                  if (typeHasExpiry(form.category, docType)) setNoExpiry(false)
                }}>
                  {typeOptions.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="doc-title" required>Title</Label>
                <Input
                  id="doc-title"
                  value={form.title}
                  onChange={e => upd({ title: e.target.value })}
                  placeholder="e.g. Ravi — Driving Licence 2026"
                  aria-invalid={!!errors.title}
                  aria-describedby={errors.title ? 'doc-title-error' : undefined}
                  className={errors.title ? '!border-red-400 dark:!border-red-500' : ''}
                />
                <ErrorText id="doc-title-error">{errors.title}</ErrorText>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <Label htmlFor="doc-number">Document / reference number</Label>
                <Input id="doc-number" value={form.document_number}
                  onChange={e => upd({ document_number: e.target.value })}
                  placeholder="e.g. DL-042026001234" />
              </div>
              <div>
                <Label htmlFor="doc-authority">Issuing authority</Label>
                <Input id="doc-authority" value={form.issuing_authority}
                  onChange={e => upd({ issuing_authority: e.target.value })}
                  placeholder="e.g. Transport Department" />
              </div>
            </div>
            <div>
              <Label htmlFor="doc-issue">Issue date</Label>
              <Input id="doc-issue" type="date" value={form.issue_date}
                onChange={e => upd({ issue_date: e.target.value })} />
            </div>
          </Section>

          <div className="h-px bg-[var(--ap-border)]" />

          <Section
            icon={CalendarDays}
            title="Validity & reminders"
            subtitle="Dates are stored as calendar days and checked against today."
            status={<StatusPill tone={TONE[statusKey] || 'gray'}>{statusCfg.label}</StatusPill>}
          >
            <label className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--ap-border)] bg-[var(--ap-surface-2)] px-3.5 py-3 cursor-pointer">
              <span className="flex items-start gap-2.5">
                <Info size={15} className="text-[var(--ap-accent)] mt-0.5" aria-hidden="true" />
                <span>
                  <span className="block font-sf text-[12px] font-semibold text-[var(--ap-text-1)]">This document has no expiry</span>
                  <span className="block text-[10px] text-[var(--ap-text-3)] mt-0.5">Use for permanent IDs and registrations.</span>
                </span>
              </span>
              <input
                type="checkbox"
                checked={noExpiry}
                onChange={e => {
                  const checked = e.target.checked
                  setNoExpiry(checked)
                  if (checked) {
                    upd({ expiry_date: '', reminder_date: '' })
                    setReminderTouched(false)
                    setErrors(prev => ({ ...prev, expiry_date: null, reminder_date: null }))
                  }
                }}
                className="w-4 h-4 accent-[var(--ap-accent)]"
                aria-label="This document has no expiry"
              />
            </label>

            {showExpiry && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <Label htmlFor="doc-expiry">Expiry date</Label>
                    <Input id="doc-expiry" type="date" value={form.expiry_date}
                      onChange={e => onExpiryChange(e.target.value)}
                      aria-invalid={!!errors.expiry_date}
                      className={errors.expiry_date ? '!border-red-400 dark:!border-red-500' : ''} />
                    <ErrorText id="doc-expiry-error">{errors.expiry_date}</ErrorText>
                  </div>
                  <div>
                    <Label htmlFor="doc-reminder">Reminder date</Label>
                    <Input id="doc-reminder" type="date" value={form.reminder_date}
                      onChange={e => { setReminderTouched(true); upd({ reminder_date: e.target.value }); setError('reminder_date', null) }}
                      aria-invalid={!!errors.reminder_date}
                      className={errors.reminder_date ? '!border-red-400 dark:!border-red-500' : ''} />
                    <ErrorText id="doc-reminder-error">{errors.reminder_date}</ErrorText>
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--ap-border)] bg-[var(--ap-surface-2)] p-3.5">
                  <label className="flex items-center justify-between gap-3 cursor-pointer">
                    <span className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-xl bg-[var(--ap-accent)]/10 text-[var(--ap-accent)] flex items-center justify-center">
                        <Sparkles size={15} />
                      </span>
                      <span>
                        <span className="block font-sf text-[12px] font-semibold text-[var(--ap-text-1)]">Reminder enabled</span>
                        <span className="block text-[10px] text-[var(--ap-text-3)] mt-0.5">Reminder is cleared when turned off.</span>
                      </span>
                    </span>
                    <input type="checkbox" checked={!!form.reminder_enabled}
                      onChange={e => {
                        const enabled = e.target.checked
                        upd(enabled ? { reminder_enabled: true } : { reminder_enabled: false, reminder_date: '' })
                        if (!enabled) {
                          setReminderTouched(false)
                          setError('reminder_date', null)
                        }
                      }}
                      className="w-4 h-4 accent-[var(--ap-accent)]" aria-label="Reminder enabled" />
                  </label>
                  {form.reminder_enabled && (
                    <div className="mt-3">
                      <Label htmlFor="doc-interval">Remind me before expiry</Label>
                      <Select id="doc-interval" value={form.reminder_interval}
                        onChange={e => onIntervalChange(e.target.value)}>
                        {REMINDER_INTERVALS.map(n => <option key={n} value={n}>{n} days before</option>)}
                      </Select>
                      <p className="text-[10px] text-[var(--ap-text-3)] mt-1.5">
                        {form.reminder_date
                          ? `Reminder set for ${form.reminder_date}. You can edit the date above.`
                          : 'Pick an expiry date to calculate a reminder.'}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </Section>

          <div className="h-px bg-[var(--ap-border)]" />

          <Section icon={Paperclip} title="Attachments" subtitle="Files stay in the private document store. Previews use signed links.">
            <div className="space-y-3.5">
              <UploadSlot
                side="front"
                title="Front / primary file"
                file={files.front}
                preview={previews.front}
                fileName={form.frontFileName}
                fileSize={form.frontFileSize}
                storedUrl={form.frontFileUrl}
                error={errors.front}
                busy={uploading === 'front'}
                canScan={!!files.front}
                ocrRunning={ocrRunning}
                onPick={camera => onPick('front', camera)}
                onDrop={e => onDrop('front', e)}
                onClear={() => clearFile('front')}
                onPreview={() => previewFile('front')}
                onScan={runScan}
              />
              <UploadSlot
                side="back"
                title="Back / second page"
                file={files.back}
                preview={previews.back}
                fileName={form.backFileName}
                fileSize={form.backFileSize}
                storedUrl={form.backFileUrl}
                error={errors.back}
                busy={uploading === 'back'}
                onPick={camera => onPick('back', camera)}
                onDrop={e => onDrop('back', e)}
                onClear={() => clearFile('back')}
                onPreview={() => previewFile('back')}
              />

              <input
                ref={inputRefs.front}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
                className="hidden"
                onChange={e => acceptFile('front', e.target.files?.[0])}
              />
              <input
                ref={inputRefs.back}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
                className="hidden"
                onChange={e => acceptFile('back', e.target.files?.[0])}
              />

              {ocr && !ocr.ok && (
                <Callout tone="amber" icon={AlertTriangle}
                  title="Scan could not complete"
                  sub={ocr.error || 'Scanning is not available for this deployment. You can still fill the form manually.'} />
              )}
              {ocr?.ok && (
                <Callout tone="violet" icon={Sparkles}
                  title="Suggested details added"
                  sub={`Provider: ${ocr.provider || 'ocr'} · confidence ${ocr.confidence ?? '—'}. Review every field before saving.`} />
              )}
              {suggestions.length > 0 && (
                <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.05] p-3.5">
                  <p className="text-[11px] font-semibold text-violet-700 dark:text-violet-300 mb-2">
                    Extracted suggestions — editable, never saved automatically
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((s, i) => (
                      <span key={`${s.key}-${i}`} className="rounded-lg bg-[var(--ap-surface)] border border-[var(--ap-border)] px-2 py-1 text-[10px] text-[var(--ap-text-2)]">
                        <span className="font-semibold text-[var(--ap-text-3)]">{s.label}:</span> {s.value}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>

          <div className="h-px bg-[var(--ap-border)]" />

          <Section icon={FileText} title="Notes & tags" subtitle="Internal context only. Avoid pasting sensitive numbers here.">
            <div>
              <Label htmlFor="doc-notes">Notes</Label>
              <Textarea id="doc-notes" rows={3} value={form.notes}
                onChange={e => upd({ notes: e.target.value })}
                placeholder="Renewal contact, filing notes, or other context…" />
            </div>
            <div>
              <Label htmlFor="doc-tags" hint="comma separated">Optional tags</Label>
              <Input id="doc-tags" value={(form.tags || []).join(', ')}
                onChange={e => upd({ tags: e.target.value.split(',').map(v => v.trim()).filter(Boolean) })}
                placeholder="fleet, important, renewed" />
            </div>
          </Section>
        </div>

        {/* Sticky footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-[var(--ap-border)] flex-shrink-0 bg-[var(--ap-surface)] pb-[max(1rem,env(safe-area-inset-bottom))]">
          {notice && (
            <Callout tone={notice.tone} icon={notice.tone === 'green' ? CheckCircle2 : Info} title={notice.text} className="mb-2.5" />
          )}
          {errors.save && (
            <Callout tone="red" icon={AlertTriangle} title="Could not save" sub={errors.save} className="mb-2.5" />
          )}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2">
            <Button variant="outline" onClick={requestClose} disabled={disabled}
              className="w-full sm:w-auto sm:min-w-[104px]">Cancel</Button>
            <Button variant="primary" onClick={handleSave} disabled={disabled}
              aria-busy={saving} className="w-full sm:w-auto sm:ml-auto sm:min-w-[180px]">
              {saving ? <><Loader2 size={15} className="animate-spin" /> {uploading ? 'Uploading…' : 'Saving…'}</>
                : isEdit ? <><Check size={15} /> Update Document</> : <><FileText size={15} /> Save Document</>}
            </Button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ─── Documents Page — Module 3 ────────────────────────────
// Centralised document management with expiry tracking, per-entity
// categories and localStorage/Supabase dual-write.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  FileText, Plus, Search, Calendar, AlertTriangle,
  CheckCircle, Clock, Download, Trash2, X, RefreshCw,
  Car, User, Route, FolderOpen, Eye, Columns3,
} from 'lucide-react'
import PageHeader   from '../components/ui/PageHeader'
import ModalOverlay from '../components/ui/ModalOverlay'
import { useAuth }  from '../context/AuthContext'
import supabase     from '../lib/supabase'
import { loadDrivers } from '../data/driverData'
import { loadVehicles } from '../data/vehicleData'
import { loadCustomers } from '../data/customerData'

// ── Document type catalogue per category ─────────────────────
const DOC_TYPES = {
  driver: [
    { key:'license',     label:"Driver's Licence",   hasExpiry:true  },
    { key:'badge',       label:'Badge / ID',          hasExpiry:true  },
    { key:'medical',     label:'Medical Certificate', hasExpiry:true  },
    { key:'police_cert', label:'Police Certificate',  hasExpiry:true  },
    { key:'aadhar',      label:'Aadhaar Card',        hasExpiry:false },
    { key:'bank',        label:'Bank Passbook',       hasExpiry:false },
    { key:'other',       label:'Other',               hasExpiry:false },
  ],
  vehicle: [
    { key:'rc_book',   label:'RC Book',             hasExpiry:false },
    { key:'insurance', label:'Insurance',           hasExpiry:true  },
    { key:'permit',    label:'Permit',              hasExpiry:true  },
    { key:'puc',       label:'Pollution (PUC)',     hasExpiry:true  },
    { key:'fitness',   label:'Fitness Certificate', hasExpiry:true  },
    { key:'tax_token', label:'Tax Token',           hasExpiry:true  },
    { key:'other',     label:'Other',               hasExpiry:false },
  ],
  trip: [
    { key:'permit',       label:'Trip Permit',        hasExpiry:true,   icon:'📋' },
    { key:'authorization',label:'Trip Authorization', hasExpiry:true,   icon:'📑' },
    { key:'itinerary',    label:'Trip Itinerary',     hasExpiry:false,  icon:'🗺' },
    { key:'manifest',     label:'Trip Manifest',      hasExpiry:false,  icon:'📄' },
    { key:'inspection',   label:'Vehicle Inspection', hasExpiry:true,   icon:'🔍' },
    { key:'other',        label:'Other',              hasExpiry:false,  icon:'📎' },
  ],
}

const CATEGORIES = [
  { key:'all',      label:'All Docs',  Icon:FolderOpen, color:'text-slate-500'  },
  { key:'driver',   label:'Drivers',   Icon:User,       color:'text-blue-500'   },
  { key:'vehicle',  label:'Vehicles',  Icon:Car,        color:'text-amber-500'  },
  { key:'trip',     label:'Trips',     Icon:Route,      color:'text-emerald-500'},
]

const STATUS_CFG = {
  active:        { label:'Valid',          badge:'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', dot:'bg-emerald-500'               },
  expiring_soon: { label:'Expiring Soon',  badge:'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',         dot:'bg-amber-500 animate-pulse'   },
  expired:       { label:'Expired',        badge:'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',                  dot:'bg-red-500'                   },
  pending:       { label:'Pending',        badge:'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',             dot:'bg-slate-400'                 },
}

// ── Column selection (desktop table; Actions always on) ──────
const ALL_DOC_COLS = [
  { key:'doc',      label:'Document Name', on:true },
  { key:'type',     label:'Type',          on:true },
  { key:'owner',    label:'Owner',         on:true },
  { key:'number',   label:'Document No.',  on:true },
  { key:'expiry',   label:'Expiry Date',   on:true },
  { key:'status',   label:'Status',        on:true },
  { key:'uploaded', label:'Uploaded On',   on:true },
]
const DOC_COLS_KEY = 'sjt-doc-cols'
function loadDocCols() {
  try {
    const raw = localStorage.getItem(DOC_COLS_KEY)
    if (!raw) return ALL_DOC_COLS.filter(c => c.on).map(c => c.key)
    const arr = JSON.parse(raw)
    const known = new Set(ALL_DOC_COLS.map(c => c.key))
    const clean = (Array.isArray(arr) ? arr : []).filter(k => known.has(k))
    return clean.length > 0 ? clean : ALL_DOC_COLS.filter(c => c.on).map(c => c.key)
  } catch { return ALL_DOC_COLS.filter(c => c.on).map(c => c.key) }
}

// Flattened type catalogue for the Type filter: key → "Category — Label".
const TYPE_OPTIONS = Object.entries(DOC_TYPES).flatMap(([cat, list]) =>
  list.map(t => ({
    key: t.key,
    label: `${CATEGORIES.find(c => c.key === cat)?.label || cat} — ${t.label}`,
  }))
)
function typeLabel(key) {
  const found = TYPE_OPTIONS.find(t => t.key === key)
  if (found) return found.label.split(' — ')[1]
  return String(key || 'document').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function fmtDate(d) {
  if (!d) return '—'
  const dt = new Date(d + 'T00:00:00')
  if (Number.isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
}

// ── Helpers ───────────────────────────────────────────────────
function calcStatus(expiryDate) {
  if (!expiryDate) return 'active'
  const today  = new Date(); today.setHours(0,0,0,0)
  const expiry = new Date(expiryDate + 'T00:00:00')
  const diff   = Math.floor((expiry - today) / 86400000)
  if (diff < 0)   return 'expired'
  if (diff <= 30) return 'expiring_soon'
  return 'active'
}
function daysLeft(d) {
  if (!d) return null
  const today = new Date(); today.setHours(0,0,0,0)
  return Math.floor((new Date(d + 'T00:00:00') - today) / 86400000)
}

// ── Local store ───────────────────────────────────────────────
const LS_KEY = 'sjt_documents'
function readLocal()  { try { return JSON.parse(localStorage.getItem(LS_KEY)||'[]') } catch { return [] } }
function writeLocal(d){ try { localStorage.setItem(LS_KEY, JSON.stringify(d)) } catch {} }
let _local = readLocal()

async function fetchDocs() {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('documents').select('*').order('created_at', { ascending:false })
      if (!error && data) return data
    } catch {}
  }
  return _local
}

async function upsertDoc(doc) {
  const payload = {
    document_type: doc.doc_type || 'other',
    related_entity: doc.category,
    title:          doc.title,
    category:       doc.category,
    doc_type:       doc.doc_type,
    status:         calcStatus(doc.expiry_date),
    expiry_date:    doc.expiry_date  || null,
    reminder_date:  doc.reminder_date|| null,
    notes:          doc.notes        || null,
    driver_id:      doc.driver_id    || null,
    vehicle_id:     doc.vehicle_id   || null,
    customer_id:    doc.customer_id  || null,
    file_name:      doc.file_name    || doc.fileName    || null,
    file_url:       doc.file_url     || doc.fileUrl     || null,
  }
  if (supabase) {
    try {
      const { data, error } = await supabase.from('documents').insert(payload).select().single()
      if (!error && data) { _local = [data, ..._local]; writeLocal(_local); return data }
    } catch {}
  }
  const saved = { ...payload, id: `local-${Date.now()}`, created_at: new Date().toISOString() }
  _local = [saved, ..._local]
  writeLocal(_local)
  return saved
}

async function removeDoc(id) {
  if (supabase && !String(id).startsWith('local-')) {
    try { await supabase.from('documents').delete().eq('id', id) } catch {}
  }
  _local = _local.filter(d => d.id !== id)
  writeLocal(_local)
}

// ── Status badge ──────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.active
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// ── Add Document Modal ─────────────────────────────────────
function AddDocModal({ onClose, onSave, drivers, vehicles }) {
  const [form, setForm] = useState({
    category:'driver', doc_type:'license', title:'',
    entity_id:'', expiry_date:'', reminder_date:'', notes:'',
    fileUrl: null, fileName: ''
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [preview, setPreview] = useState(null)
  const fileInputRef = useRef(null)
  const upd = patch => setForm(f => ({ ...f, ...patch }))

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) {
      setPreview(null)
      return
    }

    // Validate file type (optional)
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      setErrors(prev => ({ ...prev, file: 'Only JPG, PNG, and PDF files are allowed' }))
      return
    }

    // Validate file size (optional - 5MB max)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      setErrors(prev => ({ ...prev, file: 'File size must be less than 5MB' }))
      return
    }

    // Clear file error
    setErrors(prev => ({ ...prev, file: '' }))

    // Create preview URL
    const reader = new FileReader()
    reader.onload = (ev) => {
      setPreview(ev.target.result)
      setForm(f => ({ ...f, fileUrl: ev.target.result, fileName: file.name }))
    }
    reader.onerror = (ev) => {
      setErrors(prev => ({ ...prev, file: 'Failed to read file' }))
    }
    reader.readAsDataURL(file)
  }

  const docTypes    = DOC_TYPES[form.category] || []
  const currentType = docTypes.find(t => t.key === form.doc_type)

  const entityOptions = useMemo(() => {
    if (form.category === 'driver')   return drivers.map(d   => ({ value: d.id, label: d.name }))
    if (form.category === 'vehicle')  return vehicles.map(v  => ({ value: v.id, label: `${v.reg || v.registration} · ${v.model || ''}` }))
    return []
  }, [form.category, drivers, vehicles])

  const validate = () => {
    const e = {}
    if (!form.title.trim())                        e.title     = 'Required'
    if (form.category !== 'trip' && !form.entity_id) e.entity_id = 'Select one'
    return e
  }

  const handleSave = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        title:       form.title.trim(),
        driver_id:   form.category === 'driver'   ? form.entity_id : null,
        vehicle_id:  form.category === 'vehicle'  ? form.entity_id : null,
        customer_id: form.category === 'customer' ? form.entity_id : null,
      }
      const saved = await upsertDoc(payload)
      onSave(saved)
    } catch (err) { console.error(err) }
    setSaving(false)
  }

  const INP = 'w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800/60 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/25'

  return (
    <ModalOverlay onClose={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Add document"
        className="relative w-full sm:w-[500px] max-h-[92vh] sm:max-h-[88vh] bg-white dark:bg-navy-900 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col animate-fade-up">
        <div className="w-10 h-1 bg-slate-200 dark:bg-navy-700 rounded-full mx-auto mt-3 sm:hidden flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-navy-700 flex-shrink-0">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Document</p>
            <h3 className="font-display font-black text-slate-800 dark:text-white text-base">Add Document</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-navy-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wide">Category</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.filter(c => c.key !== 'all').map(cat => {
                const { Icon } = cat
                return (
                  <button key={cat.key} type="button"
                    onClick={() => upd({ category:cat.key, doc_type:DOC_TYPES[cat.key]?.[0]?.key||'', entity_id:'' })}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${
                      form.category === cat.key
                        ? 'border-navy-400 bg-navy-50 dark:bg-navy-800 ring-2 ring-navy-400/30'
                        : 'border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800/40 hover:bg-slate-50 dark:hover:bg-navy-800'
                    }`}>
                    <Icon size={15} className={cat.color} />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{cat.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Entity */}
          {form.category !== 'trip' && (
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                {form.category === 'vehicle' ? 'Vehicle' : 'Driver'} <span className="text-red-500">*</span>
              </label>
              <select value={form.entity_id} onChange={e => upd({ entity_id:e.target.value })}
                className={`${INP} appearance-none`}>
                <option value="">— Select —</option>
                {entityOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {errors.entity_id && <p className="text-xs text-red-500 mt-1">{errors.entity_id}</p>}
            </div>
          )}

          {/* Doc type */}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Document Type</label>
            <select value={form.doc_type} onChange={e => upd({ doc_type:e.target.value })}
              className={`${INP} appearance-none`}>
              {docTypes.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
              Title <span className="text-red-500">*</span>
            </label>
            <input value={form.title} onChange={e => upd({ title:e.target.value })}
              placeholder="e.g. Ramanan – Driving Licence 2026"
              className={INP} />
            {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
          </div>

          {/* Dates */}
          {currentType?.hasExpiry && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Expiry Date</label>
                <input type="date" value={form.expiry_date} onChange={e => upd({ expiry_date:e.target.value })} className={INP} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Reminder Date</label>
                <input type="date" value={form.reminder_date} onChange={e => upd({ reminder_date:e.target.value })} className={INP} />
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Notes</label>
            <textarea value={form.notes} onChange={e => upd({ notes:e.target.value })}
              placeholder="Document number, remarks…" rows={2}
              className={`${INP} resize-none`} />
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
              File <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-col items-start">
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={handleFileChange}
                className={`${INP} ${errors.file ? 'border-red-400' : ''}`}
              />
              {errors.file && <p className="text-xs text-red-500 mt-1">{errors.file}</p>}
              {preview && (
                <div className="mt-2 flex items-center gap-3">
                  {(form.fileUrl || '').startsWith('data:image/') && (
                    <img src={preview} alt="Preview" className="w-16 h-16 object-cover rounded" />
                  )}
                  {(form.fileUrl || '').startsWith('data:application/pdf') && (
                    <div className="w-16 h-16 bg-blue-500/20 rounded flex items-center justify-center">
                      <div className="text-xs font-bold text-blue-600">PDF</div>
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{form.fileName || 'No file selected'}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setPreview(null)
                        setForm(f => ({ ...f, fileUrl: null, fileName: '' }))
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 dark:border-navy-700 flex gap-2 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-navy-900 dark:bg-blue-700 text-white text-sm font-bold hover:bg-navy-800 dark:hover:bg-blue-600 transition-all shadow-md active:scale-95 disabled:opacity-50">
            {saving ? 'Saving…' : 'Add Document'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function Documents() {
  const { isAdmin, isManager } = useAuth()
  const canManage = isAdmin || isManager

  const [docs,      setDocs]      = useState([])
  const [drivers,   setDrivers]   = useState([])
  const [vehicles,  setVehicles]  = useState([])
  const [customers, setCustomers] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [category,  setCategory]  = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [ownerFilter, setOwnerFilter] = useState('all') // 'all' | `driver:id` | `vehicle:id`
  const [search,    setSearch]    = useState('')
  const [showAdd,   setShowAdd]   = useState(false)
  const [page,      setPage]      = useState(1)
  const [visibleCols, setVisibleCols] = useState(loadDocCols)
  const [colsOpen, setColsOpen] = useState(false)
  const colsRef = useRef(null)

  useEffect(() => {
    if (!colsOpen) return
    const onDown = e => { if (colsRef.current && !colsRef.current.contains(e.target)) setColsOpen(false) }
    const onKey = e => { if (e.key === 'Escape') setColsOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [colsOpen])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [d, dr, veh, cust] = await Promise.allSettled([
        fetchDocs(),
        loadDrivers(),
        loadVehicles(),
        loadCustomers(),
      ])
      setDocs(d.status === 'fulfilled' ? d.value : [])
      setDrivers(dr.status === 'fulfilled' ? dr.value : [])
      setVehicles(veh.status === 'fulfilled' ? veh.value : [])
      setCustomers(cust.status === 'fulfilled' ? cust.value.filter(c => !c._deleted) : [])
    } catch { setError('Failed to load documents') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const enriched = useMemo(() =>
    docs.map(doc => ({
      ...doc,
      computedStatus: doc.expiry_date ? calcStatus(doc.expiry_date) : (doc.status || 'active'),
      daysLeft:       daysLeft(doc.expiry_date),
    }))
  , [docs])

  // Owner lookup maps from real entity data (ids stored on the doc).
  const ownerMaps = useMemo(() => ({
    driver:   new Map(drivers.map(d => [String(d.id), d.name])),
    vehicle:  new Map(vehicles.map(v => [String(v.id), v.reg || v.registration || v.model || ''])),
    customer: new Map(customers.map(c => [String(c.id), c.name])),
  }), [drivers, vehicles, customers])

  const ownerOf = useCallback((doc) => {
    if (doc.category === 'driver' && doc.driver_id != null) {
      const name = ownerMaps.driver.get(String(doc.driver_id))
      if (name) return { kind:'driver', label:'Driver', name }
    }
    if (doc.category === 'vehicle' && doc.vehicle_id != null) {
      const name = ownerMaps.vehicle.get(String(doc.vehicle_id))
      if (name) return { kind:'vehicle', label:'Vehicle', name }
    }
    if (doc.category === 'customer' && doc.customer_id != null) {
      const name = ownerMaps.customer.get(String(doc.customer_id))
      if (name) return { kind:'customer', label:'Customer', name }
    }
    return null
  }, [ownerMaps])

  // Owner dropdown options built from actual database owners.
  const ownerOptions = useMemo(() => {
    const opts = []
    drivers.forEach(d => opts.push({ value:`driver:${d.id}`, label:`${d.name} (Driver)` }))
    vehicles.forEach(v => opts.push({ value:`vehicle:${v.id}`, label:`${v.reg || v.registration || v.model || v.id} (Vehicle)` }))
    return opts
  }, [drivers, vehicles, customers])

  const filtered = useMemo(() =>
    enriched.filter(doc => {
      if (category !== 'all' && doc.category !== category) return false
      if (statusFilter !== 'all' && doc.computedStatus !== statusFilter) return false
      if (typeFilter !== 'all' && (doc.doc_type || 'other') !== typeFilter) return false
      if (ownerFilter !== 'all') {
        const [kind, id] = ownerFilter.split(':')
        if (kind === 'driver' && String(doc.driver_id) !== id) return false
        if (kind === 'vehicle' && String(doc.vehicle_id) !== id) return false
        if (kind === 'customer' && String(doc.customer_id) !== id) return false
      }
      if (search) {
        const q = search.toLowerCase()
        if (![doc.title, doc.notes, doc.doc_type, doc.file_name].some(v => v?.toLowerCase().includes(q))) return false
      }
      return true
    })
  , [enriched, category, statusFilter, typeFilter, ownerFilter, search])

  const PAGE_SIZE = 10
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  // Reset to page 1 whenever filters change (pagination preserves them otherwise).
  useEffect(() => { setPage(1) }, [search, category, statusFilter, typeFilter, ownerFilter])

  const pageItems = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const set = new Set([1, 2, safePage - 1, safePage, safePage + 1, totalPages - 1, totalPages])
    const nums = [...set].filter(n => n >= 1 && n <= totalPages).sort((a, b) => a - b)
    const out = []
    nums.forEach((n, i) => {
      if (i > 0 && n - nums[i - 1] > 1) out.push('…')
      out.push(n)
    })
    return out
  })()

  const colLabel = (key) => ALL_DOC_COLS.find(c => c.key === key)?.label || key
  const toggleCol = (key) => {
    setVisibleCols(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      const safe = next.length === 0 ? prev : next
      try { localStorage.setItem(DOC_COLS_KEY, JSON.stringify(safe)) } catch {}
      return safe
    })
  }

  const exportCsv = () => {
    const rows = [['Title', 'Type', 'Category', 'Owner', 'Owner Type', 'Reference', 'Expiry Date', 'Status', 'Uploaded On']]
    filtered.forEach(doc => {
      const owner = ownerOf(doc)
      rows.push([
        doc.title || '', typeLabel(doc.doc_type || 'other'), doc.category || '',
        owner ? owner.name : '', owner ? owner.label : '',
        doc.notes || doc.file_name || '',
        doc.expiry_date || '',
        (STATUS_CFG[doc.computedStatus] || STATUS_CFG.active).label,
        (doc.created_at || '').slice(0, 10),
      ])
    })
    const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'documents.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const counts = useMemo(() => ({
    total:    enriched.length,
    valid:    enriched.filter(d => d.computedStatus === 'active').length,
    expiring: enriched.filter(d => d.computedStatus === 'expiring_soon').length,
    expired:  enriched.filter(d => d.computedStatus === 'expired').length,
  }), [enriched])

  const handleSave = doc => { setDocs(prev => [doc, ...prev.filter(d => d.id !== doc.id)]); setShowAdd(false) }
  const handleDelete = async id => {
    if (!window.confirm('Delete this document?')) return
    await removeDoc(id)
    setDocs(prev => prev.filter(d => d.id !== id))
  }

  const getCategoryIcon = cat => {
    const c = CATEGORIES.find(c => c.key === cat)
    if (!c) return null
    const { Icon } = c
    return <Icon size={13} className={c.color} />
  }

  const clearFilters = () => {
    setSearch('')
    setCategory('all')
    setStatusFilter('all')
    setTypeFilter('all')
    setOwnerFilter('all')
  }
  const hasActiveFilters = search !== '' || category !== 'all' || statusFilter !== 'all' || typeFilter !== 'all' || ownerFilter !== 'all'

  return (
    <div className="space-y-4 animate-fade-up">
      {/* 1. Page header — compact, ~64px */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-[12px] bg-navy-900 dark:bg-blue-700 flex items-center justify-center flex-shrink-0">
            <FileText size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[28px] leading-tight font-display font-black text-slate-800 dark:text-white">Documents</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Manage driver and vehicle documents</p>
          </div>
        </div>
        {canManage && (
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 min-h-[40px] rounded-lg bg-navy-900 dark:bg-blue-700 text-white text-[13px] font-bold hover:bg-navy-800 dark:hover:bg-blue-600 transition-all active:scale-95 flex-shrink-0">
            <Plus size={15} /> Add Document
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800/30 rounded-lg px-3 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle size={14} className="text-red-600 flex-shrink-0" />
            <p className="text-[13px] font-bold text-red-700 dark:text-red-400 truncate">Unable to load documents — {error}</p>
          </div>
          <button onClick={load} className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-400 text-white text-xs font-bold flex items-center gap-1.5 flex-shrink-0">
            <RefreshCw size={12} /> Try again
          </button>
        </div>
      )}

      {/* 2. Summary KPIs — compact operational cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
        {[
          { label:'Total Documents', value:counts.total,    color:'text-blue-600 dark:text-blue-400',         bg:'bg-blue-100 dark:bg-blue-900/30',         Icon: FileText,     filter:'all'          },
          { label:'Valid',           value:counts.valid,    color:'text-emerald-600 dark:text-emerald-400',   bg:'bg-emerald-100 dark:bg-emerald-900/30',   Icon: CheckCircle,  filter:'active'       },
          { label:'Expiring (30 days)', value:counts.expiring, color:'text-amber-600 dark:text-amber-400',   bg:'bg-amber-100 dark:bg-amber-900/30',       Icon: Clock,        filter:'expiring_soon'},
          { label:'Expired',         value:counts.expired,  color:'text-red-600 dark:text-red-400',           bg:'bg-red-100 dark:bg-red-900/30',           Icon: AlertTriangle, filter:'expired'      },
        ].map(s => (
          <button key={s.label} onClick={() => setStatusFilter(s.filter)} aria-label={`Filter: ${s.label}`}
            className="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 px-3.5 py-3 text-left hover:shadow-md active:scale-[0.99] transition-all min-h-[80px]">
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${s.bg}`}>
              <s.Icon size={15} className={s.color} />
            </span>
            <span className="min-w-0">
              <span className={`block text-[26px] leading-none font-display font-black tabular-nums ${s.color}`}>{s.value}</span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-tight">{s.label}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Category tabs (existing filter) */}
      <div className="flex gap-1 bg-slate-100 dark:bg-navy-800 rounded-lg p-1 w-fit max-w-full overflow-x-auto" role="group" aria-label="Filter by category">
        {CATEGORIES.map(cat => {
          const { Icon } = cat
          return (
            <button key={cat.key} onClick={() => setCategory(cat.key)} aria-pressed={category === cat.key}
              className={`flex items-center gap-1.5 px-3 min-h-[32px] rounded-md text-xs font-bold transition-all whitespace-nowrap ${
                category === cat.key
                  ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}>
              <Icon size={12} />
              <span className="hidden sm:inline">{cat.label}</span>
            </button>
          )
        })}
      </div>

      {/* 3. Search + filters + export toolbar — one row, wraps */}
      <div className="flex items-center gap-2 flex-wrap rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 px-3 py-2">
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <Search size={14} className="text-slate-400 flex-shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents, owner, number…"
            aria-label="Search documents"
            className="bg-transparent text-[13px] text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none w-full font-body" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} aria-label="Filter by document type"
          className="px-2.5 min-h-[36px] text-xs font-bold rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-200 focus:outline-none font-body max-w-[150px]">
          <option value="all">All Types</option>
          {TYPE_OPTIONS.map(t => <option key={`${t.key}`} value={t.key}>{t.label}</option>)}
        </select>
        <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} aria-label="Filter by owner"
          className="px-2.5 min-h-[36px] text-xs font-bold rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-200 focus:outline-none font-body max-w-[160px]">
          <option value="all">All Owners</option>
          {ownerOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filter by status"
          className="px-2.5 min-h-[36px] text-xs font-bold rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-200 focus:outline-none font-body">
          <option value="all">All Status</option>
          <option value="active">Valid</option>
          <option value="expiring_soon">Expiring</option>
          <option value="expired">Expired</option>
        </select>
        {hasActiveFilters && (
          <button onClick={clearFilters}
            className="px-3 min-h-[36px] rounded-lg text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors whitespace-nowrap">
            Clear Filters
          </button>
        )}
        <button onClick={exportCsv} aria-label="Export filtered documents to CSV"
          className="flex items-center gap-1.5 px-3 min-h-[36px] rounded-lg border border-slate-200 dark:border-navy-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 active:scale-95 transition-all whitespace-nowrap">
          <Download size={13} /> Export
        </button>
        <div className="relative" ref={colsRef}>
          <button onClick={() => setColsOpen(v => !v)}
            aria-label="Choose table columns" aria-expanded={colsOpen} aria-haspopup="menu"
            className="flex items-center gap-1.5 px-3 min-h-[36px] rounded-lg border border-slate-200 dark:border-navy-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 active:scale-95 transition-all whitespace-nowrap">
            <Columns3 size={13} /> Columns
          </button>
          {colsOpen && (
            <div role="menu" aria-label="Table columns"
              className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-2xl overflow-hidden z-50">
              <p className="px-3.5 pt-3 pb-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Show columns</p>
              <div className="p-1.5">
                {ALL_DOC_COLS.map(c => {
                  const on = visibleCols.includes(c.key)
                  return (
                    <button key={c.key} onClick={() => toggleCol(c.key)} role="menuitemcheckbox" aria-checked={on}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors text-left">
                      <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 text-[10px] font-black transition-colors ${on ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-navy-600 text-transparent'}`}>✓</span>
                      {c.label}
                    </button>
                  )
                })}
              </div>
              <p className="px-3.5 py-2 border-t border-slate-100 dark:border-navy-700 text-[10px] text-slate-400 dark:text-slate-500">Actions always shown</p>
            </div>
          )}
        </div>
      </div>

      {/* 4. Main data table */}
      {loading ? (
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 overflow-hidden" role="status" aria-busy="true" aria-label="Loading documents">
          <span className="sr-only">Loading documents…</span>
          <div className="hidden md:grid px-4 py-2.5 gap-3 border-b border-slate-100 dark:border-navy-800" style={{ gridTemplateColumns: `repeat(${visibleCols.length}, minmax(0,1fr)) 120px` }} aria-hidden="true">
            {visibleCols.map(k => <div key={k} className="skeleton h-3 rounded" />)}
            <div className="skeleton h-3 rounded" />
          </div>
          {[1,2,3,4,5].map(i => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-navy-800 last:border-0" aria-hidden="true">
              <div className="skeleton w-8 h-8 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton h-3.5 w-2/5 rounded" />
                <div className="skeleton h-3 w-1/4 rounded" />
              </div>
              <div className="skeleton h-5 w-16 rounded-full flex-shrink-0 hidden sm:block" />
              <div className="skeleton h-8 w-20 rounded-lg flex-shrink-0" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 px-4 py-12 text-center">
          <FileText size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          {docs.length === 0 ? (
            <>
              <p className="text-slate-600 dark:text-slate-300 font-bold text-sm">No documents found</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Upload a document to get started.</p>
              {canManage && (
                <button onClick={() => setShowAdd(true)}
                  className="mt-4 inline-flex items-center gap-2 px-4 min-h-[40px] rounded-lg bg-navy-900 dark:bg-blue-700 text-white text-[13px] font-bold hover:bg-navy-800 transition-all">
                  <Plus size={14} /> Add Document
                </button>
              )}
            </>
          ) : (
            <>
              <p className="text-slate-600 dark:text-slate-300 font-bold text-sm">No documents match your filters.</p>
              <button onClick={clearFilters}
                className="mt-4 px-4 min-h-[40px] rounded-lg border border-slate-200 dark:border-navy-700 text-[13px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
                Clear Filters
              </button>
            </>
          )}
        </div>
      ) : (
        <>
        {/* Desktop table */}
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 overflow-hidden hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/70">
                {visibleCols.map(k => (
                  <th key={k} className="px-3 py-2.5 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{colLabel(k)}</th>
                ))}
                <th className="px-3 py-2.5 text-right text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map(doc => {
                const owner = ownerOf(doc)
                const ref = doc.notes || doc.file_name || '—'
                const days = doc.daysLeft
                return (
                  <tr key={doc.id} className="border-b border-slate-100 dark:border-navy-800 last:border-0 hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors">
                    {visibleCols.map(k => {
                      if (k === 'doc') return (
                        <td key={k} className="px-3 py-3 max-w-[240px]">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              doc.computedStatus === 'expired' ? 'bg-red-100 dark:bg-red-900/30' :
                              doc.computedStatus === 'expiring_soon' ? 'bg-amber-100 dark:bg-amber-900/30' :
                              'bg-slate-100 dark:bg-navy-800'}`}>
                              <FileText size={15} className={
                                doc.computedStatus === 'expired' ? 'text-red-500' :
                                doc.computedStatus === 'expiring_soon' ? 'text-amber-500' :
                                'text-slate-500 dark:text-slate-400'} />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[13px] font-bold text-slate-700 dark:text-slate-200 truncate">{doc.title}</span>
                              <span className="block text-[11px] text-slate-400 dark:text-slate-500 truncate capitalize">{(doc.doc_type || 'document').replace(/_/g, ' ')}</span>
                            </span>
                          </div>
                        </td>
                      )
                      if (k === 'type') {
                        const catColor = doc.category === 'driver' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          : doc.category === 'vehicle' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                          : doc.category === 'customer' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                        return (
                          <td key={k} className="px-3 py-3 whitespace-nowrap">
                            <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-md ${catColor}`}>{typeLabel(doc.doc_type || 'other')}</span>
                          </td>
                        )
                      }
                      if (k === 'owner') return (
                        <td key={k} className="px-3 py-3 max-w-[170px]">
                          {owner ? (
                            <span className="flex items-center gap-2 min-w-0">
                              <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-navy-700 flex items-center justify-center text-[10px] font-black text-slate-600 dark:text-slate-300 flex-shrink-0">
                                {(owner.name || '?').charAt(0).toUpperCase()}
                              </span>
                              <span className="min-w-0">
                                <span className="block text-[13px] font-bold text-slate-700 dark:text-slate-200 truncate">{owner.name}</span>
                                <span className="block text-[11px] text-slate-400 dark:text-slate-500">{owner.label}</span>
                              </span>
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      )
                      if (k === 'number') return (
                        <td key={k} className="px-3 py-3 text-xs font-mono text-slate-500 dark:text-slate-400 max-w-[160px] truncate" title={ref}>{ref}</td>
                      )
                      if (k === 'expiry') return (
                        <td key={k} className="px-3 py-3 whitespace-nowrap">
                          <span className="block text-[13px] font-bold text-slate-700 dark:text-slate-200 tabular-nums">{fmtDate(doc.expiry_date)}</span>
                          {days != null && (
                            <span className={`block text-[11px] tabular-nums ${
                              days < 0 ? 'text-red-500 font-bold' : days <= 30 ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-400 dark:text-slate-500'}`}>
                              {days < 0 ? `Expired ${Math.abs(days)}d ago` : days === 0 ? 'Expires today' : `in ${days} days`}
                            </span>
                          )}
                        </td>
                      )
                      if (k === 'status') return (
                        <td key={k} className="px-3 py-3 whitespace-nowrap"><StatusBadge status={doc.computedStatus} /></td>
                      )
                      if (k === 'uploaded') return (
                        <td key={k} className="px-3 py-3 text-[13px] text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">{fmtDate((doc.created_at || '').slice(0, 10))}</td>
                      )
                      return null
                    })}
                    <td className="px-3 py-3 whitespace-nowrap text-right">
                      <span className="inline-flex gap-1">
                        {doc.file_url && (
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer" title="View document" aria-label={`View ${doc.title}`}
                            className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 hover:text-slate-800 dark:hover:text-white transition-colors">
                            <Eye size={14} />
                          </a>
                        )}
                        {doc.file_url && (
                          <a href={doc.file_url} download={doc.file_name || 'document'} title="Download document" aria-label={`Download ${doc.title}`}
                            className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 hover:text-slate-800 dark:hover:text-white transition-colors">
                            <Download size={14} />
                          </a>
                        )}
                        {canManage && (
                          <button onClick={() => handleDelete(doc.id)} title="Delete document" aria-label={`Delete ${doc.title}`}
                            className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {pageRows.map(doc => {
            const owner = ownerOf(doc)
            const days = doc.daysLeft
            return (
              <div key={doc.id} className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-3.5">
                <div className="flex items-center gap-2.5">
                  <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    doc.computedStatus === 'expired' ? 'bg-red-100 dark:bg-red-900/30' :
                    doc.computedStatus === 'expiring_soon' ? 'bg-amber-100 dark:bg-amber-900/30' :
                    'bg-slate-100 dark:bg-navy-800'}`}>
                    <FileText size={16} className={
                      doc.computedStatus === 'expired' ? 'text-red-500' :
                      doc.computedStatus === 'expiring_soon' ? 'text-amber-500' :
                      'text-slate-500 dark:text-slate-400'} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-slate-700 dark:text-slate-200 truncate">{doc.title}</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                      {owner ? `${owner.name} · ` : ''}{typeLabel(doc.doc_type || 'other')}
                    </p>
                  </div>
                  <StatusBadge status={doc.computedStatus} />
                </div>
                <div className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-slate-100 dark:border-navy-800">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    {doc.expiry_date ? <>Exp {fmtDate(doc.expiry_date)}{days != null && (
                      <span className={days < 0 ? 'text-red-500 font-bold' : days <= 30 ? 'text-amber-600 dark:text-amber-400 font-bold' : ''}>
                        {` · ${days < 0 ? `Expired ${Math.abs(days)}d ago` : days === 0 ? 'today' : `in ${days}d`}`}
                      </span>
                    )}</> : 'No expiry'}
                  </p>
                  <span className="inline-flex gap-1 flex-shrink-0">
                    {doc.file_url && (
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer" title="View" aria-label={`View ${doc.title}`}
                        className="w-9 h-9 rounded-lg inline-flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
                        <Eye size={15} />
                      </a>
                    )}
                    {doc.file_url && (
                      <a href={doc.file_url} download={doc.file_name || 'document'} title="Download" aria-label={`Download ${doc.title}`}
                        className="w-9 h-9 rounded-lg inline-flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
                        <Download size={15} />
                      </a>
                    )}
                    {canManage && (
                      <button onClick={() => handleDelete(doc.id)} title="Delete" aria-label={`Delete ${doc.title}`}
                        className="w-9 h-9 rounded-lg inline-flex items-center justify-center text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* 5. Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              Showing {(safePage - 1) * PAGE_SIZE + 1} to {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} documents
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(safePage - 1)} disabled={safePage <= 1} aria-label="Previous page"
                className="min-w-[32px] min-h-[32px] px-2 rounded-lg border border-slate-200 dark:border-navy-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                ‹
              </button>
              {pageItems.map((n, i) => n === '…'
                ? <span key={`e${i}`} className="text-xs text-slate-400 px-1">…</span>
                : (
                  <button key={n} onClick={() => setPage(n)} aria-label={`Go to page ${n}`} aria-current={n === safePage ? 'page' : undefined}
                    className={`min-w-[32px] min-h-[32px] px-2 rounded-lg text-xs font-bold tabular-nums active:scale-95 transition-all ${
                      n === safePage
                        ? 'bg-navy-900 dark:bg-blue-600 text-white shadow'
                        : 'border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800'
                    }`}>
                    {n}
                  </button>
                ))}
              <button onClick={() => setPage(safePage + 1)} disabled={safePage >= totalPages} aria-label="Next page"
                className="min-w-[32px] min-h-[32px] px-2 rounded-lg border border-slate-200 dark:border-navy-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                ›
              </button>
            </div>
          </div>
        )}
        </>
      )}

      {showAdd && (
        <AddDocModal
          onClose={() => setShowAdd(false)}
          onSave={handleSave}
          drivers={drivers}
          vehicles={vehicles}
        />
      )}
    </div>
  )
}
// ─── Documents Page — Module 3 ────────────────────────────
// Centralised document management with expiry tracking, per-entity
// categories. Metadata lives in the Supabase `documents` table and the
// actual files in the private `trip-documents` storage bucket.

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  FileText, Plus, AlertTriangle,
  Download, Trash2, X,
  Car, User, FolderOpen, Eye, Building2, Pencil, Printer,
} from 'lucide-react'
import PageHeader   from '../components/ui/PageHeader'
import ModalOverlay from '../components/ui/ModalOverlay'
import Button       from '../components/ui/Button'
import IconButton   from '../components/ui/IconButton'
import StatusPill   from '../components/ui/StatusPill'
import Callout      from '../components/ui/Callout'
import EmptyState   from '../components/ui/EmptyState'
import { useAuth }  from '../context/AuthContext'
import DocumentModal from '../components/documents/DocumentModal'
import DocumentFilters from '../components/documents/DocumentFilters'
import DocumentStatusCards from '../components/documents/DocumentStatusCards'
import { loadDrivers } from '../data/driverData'
import { loadVehicles } from '../data/vehicleData'
import { loadCustomers } from '../data/customerData'
import {
  fetchDocuments, uploadDocumentFile, saveDocument, deleteDocument,
  deleteDocumentFiles, getDocumentFileUrl,
} from '../data/documentData'
import { runOcrWorkflow } from '../services/ocrService'
import {
  DOCUMENT_TYPES as DOC_TYPES,
  STATUS_CFG,
  documentStatus,
  formatTypeLabel as typeLabel,
} from '../utils/documentForm.js'
import { daysUntil as daysLeft } from '../utils/vehicleUtils.js'
import { pageSizeFor } from '../utils/zoomPageSize'

const CATEGORIES = [
  { key:'all',      label:'All Docs',  Icon:FolderOpen, color:'text-slate-500'  },
  { key:'driver',   label:'Drivers',   Icon:User,       color:'text-blue-500'   },
  { key:'vehicle',  label:'Vehicles',  Icon:Car,        color:'text-amber-500'  },
  { key:'company',  label:'Company',   Icon:Building2, color:'text-violet-500'  },
]

// Only the last four characters are shown in list/export views. Identity and
// banking references stay out of cards and CSV files.
function maskRef(value) {
  const text = String(value || '').trim()
  if (!text) return '—'
  return text.length <= 4 ? text : `••••${text.slice(-4)}`
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
// ('Trips' keeps its label even though it has no category tab.)
const TYPE_OPTIONS = Object.entries(DOC_TYPES).flatMap(([cat, list]) =>
  list.map(t => ({
    key: t.key,
    value: `${cat}:${t.key}`,
    label: `${CATEGORIES.find(c => c.key === cat)?.label || (cat === 'trip' ? 'Trips' : cat === 'customer' ? 'Customers' : cat)} — ${t.label}`,
  }))
)

function fmtDate(d) {
  if (!d) return '—'
  const dt = new Date(d + 'T00:00:00')
  if (Number.isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
}

const STATUS_TONE = { active: 'green', expiring_soon: 'amber', expired: 'red', pending: 'gray', no_expiry: 'gray' }

// ── Status badge ──────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.active
  return <StatusPill tone={STATUS_TONE[status] || 'gray'}>{cfg.label}</StatusPill>
}

// PDF/DOC files have no useful thumbnail. Show a deliberate file tile instead
// of a broken <img>, and use the freshly minted signed URL for images.
function DocThumb({ doc, className = '' }) {
  const url = doc.frontUrl
  const name = String(doc.file_name || '')
  const kind = /\.pdf$/i.test(name) ? 'PDF' : /\.(docx?)$/i.test(name) ? 'DOC' : ''
  if (kind) {
    return (
      <div className={`w-full h-full flex flex-col items-center justify-center gap-1.5 bg-[var(--ap-surface-2)] ${className}`}>
        <FileText size={26} className="text-[var(--ap-text-3)]" />
        <span className="text-[10px] font-bold tracking-wide text-[var(--ap-text-3)]">{kind}</span>
      </div>
    )
  }
  if (!url) {
    return (
      <div className={`w-full h-full flex items-center justify-center ${className}`}>
        <FileText size={26} className="text-slate-400 dark:text-slate-500" />
      </div>
    )
  }
  return <img src={url} alt="" loading="lazy" className={`w-full h-full object-cover ${className}`} />
}

// ── Document Detail Modal ───────────────────────────────────
function AttachmentPreview({ doc, url, name, label }) {
  const isPdf = /\.pdf$/i.test(String(name || ''))
  const isWord = /\.(docx?)$/i.test(String(name || ''))
  return (
    <div className="rounded-xl overflow-hidden border border-[var(--ap-border)] bg-black/5 dark:bg-black/30 h-44 flex items-center justify-center">
      {url && isPdf ? (
        <iframe src={url} title={`${label} preview`} className="w-full h-full border-0 bg-white" />
      ) : url && !isWord ? (
        <img src={url} alt={`${label} preview`} className="w-full h-full object-contain" />
      ) : (
        <div className="flex flex-col items-center gap-2 text-slate-400">
          <FileText size={28} />
          <p className="text-xs font-bold">{url ? `${isWord ? 'DOC' : 'FILE'} preview unavailable` : `No ${label.toLowerCase()} attached`}</p>
        </div>
      )}
    </div>
  )
}

function DocDetailModal({ doc, owner, onClose, onEdit, onDelete, canManage }) {
  const days = doc.daysLeft
  const handlePrint = () => {
    const url = doc.frontUrl
    if (!url) return
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write('<!doctype html><html><head><title>Print document</title></head><body style="margin:0"></body></html>')
    w.document.close()
    const frame = w.document.createElement('iframe')
    frame.style.cssText = 'width:100vw;height:100vh;border:0'
    frame.onload = () => {
      try {
        frame.contentWindow?.focus()
        frame.contentWindow?.print()
      } catch { /* cross-origin preview — the browser still shows the file */ }
    }
    frame.src = url
    w.document.body.appendChild(frame)
  }
  const reminder = doc.reminder_enabled && doc.reminder_date
    ? `${fmtDate(doc.reminder_date)} · ${doc.reminder_interval || 30} days before`
    : 'Off'
  const meta = [
    { l: 'Document No', v: doc.document_number || doc.reference_number || '—' },
    { l: 'Issuing authority', v: doc.issuing_authority || '—' },
    { l: 'Owner', v: owner ? `${owner.name} (${owner.label})` : '—' },
    { l: 'Category', v: doc.category ? doc.category.charAt(0).toUpperCase() + doc.category.slice(1) : '—' },
    { l: 'Type', v: typeLabel(doc.doc_type || 'other') },
    { l: 'Issue date', v: fmtDate(doc.issue_date) },
    { l: 'Expiry date', v: fmtDate(doc.expiry_date) },
    { l: 'Reminder', v: reminder },
    { l: 'Status', v: (STATUS_CFG[doc.computedStatus] || STATUS_CFG.active).label },
    { l: 'Uploaded', v: fmtDate((doc.created_at || '').slice(0, 10)) },
    { l: 'Modified', v: fmtDate((doc.updated_at || '').slice(0, 10)) },
    { l: 'File size', v: doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : '—' },
  ]
  return (
    <ModalOverlay onClose={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`Document — ${doc.title}`}
        className="relative w-full sm:w-[620px] max-h-[92vh] sm:max-h-[88vh] ap-surface rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col animate-fade-up">
        <div className="w-10 h-1 bg-[var(--ap-border)] rounded-full mx-auto mt-3 sm:hidden flex-shrink-0" />
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 flex-shrink-0 border-b border-[var(--ap-border)]">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Document details</p>
            <h3 className="font-sf font-semibold text-slate-800 dark:text-white text-base truncate">{doc.title}</h3>
            <p className="text-xs text-slate-400">{typeLabel(doc.doc_type || 'other')} · {doc.category}</p>
          </div>
          <StatusBadge status={doc.computedStatus} />
          <IconButton icon={X} label="Close" size={16} onClick={onClose} className="flex-shrink-0" />
        </div>
        <div className="overflow-y-auto flex-1 px-5 pb-5 pt-4 space-y-4">
          <AttachmentPreview doc={doc} url={doc.frontUrl} name={doc.file_name} label="Front" />

          {doc.backUrl && (
            <AttachmentPreview doc={doc} url={doc.backUrl} name={doc.back_file_name} label="Back" />
          )}

          {doc.expiry_date && (
            <div className={`rounded-xl px-3 py-2.5 border text-[12px] font-medium ${
              days < 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-300'
                : days <= 30 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-300'
                  : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300'
            }`}>
              {days < 0 ? `Expired ${Math.abs(days)} day(s) ago` : days === 0 ? 'Expires today' : `Expires in ${days} day(s)`}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {meta.map(m => (
              <div key={m.l} className="bg-[var(--ap-surface-2)] rounded-xl px-3 py-2.5 border border-[var(--ap-border)]">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">{m.l}</p>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 break-words">{m.v}</p>
              </div>
            ))}
          </div>

          {Array.isArray(doc.tags) && doc.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {doc.tags.map(tag => (
                <span key={tag} className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-[var(--ap-surface-2)] text-[var(--ap-text-2)]">{tag}</span>
              ))}
            </div>
          )}

          {doc.notes && (
            <div className="rounded-xl border border-[var(--ap-border)] bg-[var(--ap-surface-2)] px-3 py-2.5">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words">{doc.notes}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {doc.frontUrl && (
              <a href={doc.frontUrl} target="_blank" rel="noopener noreferrer" download={doc.file_name || 'document'}
                className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--ap-surface-2)] border border-[var(--ap-border)] text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-[var(--ap-surface)] transition-colors">
                <Download size={13} /> Download
              </a>
            )}
            {canManage && (
              <Button variant="secondary" className="flex-1 min-w-[140px]" icon={Pencil} onClick={() => onEdit(doc)}>Edit</Button>
            )}
            {doc.frontUrl && (
              <Button variant="secondary" className="flex-1 min-w-[140px]" icon={Printer} onClick={handlePrint}>Print</Button>
            )}
            {canManage && (
              <Button variant="danger" className="flex-1 min-w-[140px]" icon={Trash2} onClick={() => onDelete(doc)}>Delete</Button>
            )}
          </div>
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
  const [deleteError, setDeleteError] = useState(null)
  const [page,      setPage]      = useState(1)
  const [visibleCols, setVisibleCols] = useState(loadDocCols)
  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem('sjt-docs-view') === 'list' ? 'list' : 'grid' } catch { return 'grid' }
  })
  const setView = (v) => {
    setViewMode(v)
    try { localStorage.setItem('sjt-docs-view', v) } catch { /* private mode */ }
  }
  const [docDetail, setDocDetail] = useState(null)
  const [editingDoc, setEditingDoc] = useState(null)
  // Signed links stored on legacy rows can expire. When a storage path is
  // available we mint a short-lived replacement for this session only.
  const [fileUrls, setFileUrls] = useState({})

  const refreshLinks = useCallback(async (rows = []) => {
    const entries = await Promise.all(rows.map(async doc => {
      const safeGet = side => getDocumentFileUrl(doc, side).catch(err => {
        console.warn(`[Documents] could not refresh ${side} link:`, err?.message || err)
        return null
      })
      const [front, back] = await Promise.all([safeGet('front'), safeGet('back')])
      return [doc.id, { front, back }]
    }))
    const map = Object.fromEntries(entries)
    setFileUrls(prev => ({ ...prev, ...map }))
    return map
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const [d, dr, veh, cust] = await Promise.allSettled([
      fetchDocuments(),
      loadDrivers(),
      loadVehicles(),
      loadCustomers(),
    ])
    if (d.status === 'fulfilled') {
      setDocs(d.value)
      setFileUrls({})
      refreshLinks(d.value)
    } else {
      console.error('[Documents] load failed:', d.reason)
      setDocs([])
      setError(d.reason?.message || 'Failed to load documents')
    }
    setDrivers(dr.status === 'fulfilled' ? dr.value : [])
    setVehicles(veh.status === 'fulfilled' ? veh.value : [])
    setCustomers(cust.status === 'fulfilled' ? cust.value.filter(c => !c._deleted) : [])
    setLoading(false)
  }, [refreshLinks])

  useEffect(() => { load() }, [load])

  const enriched = useMemo(() =>
    docs.map(doc => ({
      ...doc,
      frontUrl:       fileUrls[doc.id]?.front ?? doc.file_url ?? null,
      backUrl:        fileUrls[doc.id]?.back ?? doc.back_file_url ?? null,
      docNumber:      doc.document_number || doc.reference_number || '',
      computedStatus: documentStatus(doc.expiry_date, doc.status),
      daysLeft:       daysLeft(doc.expiry_date),
    }))
  , [docs, fileUrls])

  // Owner lookup maps from real entity data (ids stored on the doc).
  const ownerMaps = useMemo(() => ({
    driver:   new Map(drivers.map(d => [String(d.id), d.name])),
    vehicle:  new Map(vehicles.map(v => [String(v.id), v.reg || v.registration || v.model || ''])),
    customer: new Map(customers.map(c => [String(c.id), c.name])),
  }), [drivers, vehicles, customers])

  const ownerOf = useCallback((doc) => {
    if (doc.category === 'company') return { kind:'company', label:'Company', name: doc.title || 'Company' }
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
    customers.forEach(c => opts.push({ value:`customer:${c.id}`, label:`${c.name || c.id} (Customer)` }))
    opts.push({ value: 'company:company', label: 'Company' })
    return opts
  }, [drivers, vehicles, customers])

  const filtered = useMemo(() =>
    enriched.filter(doc => {
      if (category !== 'all' && doc.category !== category) return false
      if (statusFilter !== 'all' && doc.computedStatus !== statusFilter) return false
      if (typeFilter !== 'all' && `${doc.category}:${doc.doc_type || 'other'}` !== typeFilter) return false
      if (ownerFilter !== 'all') {
        const [kind, id] = ownerFilter.split(':')
        if (kind === 'driver') { if (String(doc.driver_id) !== id) return false }
        if (kind === 'vehicle') { if (String(doc.vehicle_id) !== id) return false }
        if (kind === 'customer') { if (String(doc.customer_id) !== id) return false }
        if (kind === 'company') { if (doc.category !== 'company') return false }
      }
      if (search) {
        const q = search.toLowerCase()
        const ownerName = ownerOf(doc)?.name || ''
        const haystack = [
          doc.title, doc.notes, doc.doc_type, doc.file_name, doc.docNumber,
          doc.issuing_authority, ownerName, ...(Array.isArray(doc.tags) ? doc.tags : []),
        ]
        if (!haystack.some(v => String(v || '').toLowerCase().includes(q))) return false
      }
      return true
    })
  , [enriched, category, statusFilter, typeFilter, ownerFilter, search, ownerOf])

  // ── Pagination: zoom-adaptive rows per page ─────────────────
  // 90% → 6 · 100% → 5 · 110%+ → 4 (phones stay at 5).
  const [pageSize, setPageSize] = useState(() => pageSizeFor(5, 5))
  useEffect(() => {
    const onResize = () => {
      setPageSize(prev => {
        const next = pageSizeFor(5, 5)
        if (next !== prev) setPage(1)
        return next
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const PAGE_SIZE = pageSize
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(Math.max(1, page), totalPages)
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

  // ── List-view sorting (click a column header) ───────────────
  const SORTABLE = ['doc', 'type', 'owner', 'number', 'expiry', 'status', 'uploaded']
  const [sort, setSort] = useState({ key: 'uploaded', dir: 'desc' })
  const toggleSort = (k) => setSort(s => (s.key === k ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'asc' }))
  const sortVal = (k, doc) => {
    switch (k) {
      case 'doc':     return String(doc.title || '')
      case 'type':    return String(typeLabel(doc.doc_type || 'other') || '')
      case 'owner':   return String(ownerOf(doc)?.name || '')
      case 'number':  return String(doc.docNumber || '')
      case 'expiry':  return String(doc.expiry_date || '')
      case 'status':  return String(doc.computedStatus || '')
      case 'uploaded': return String((doc.created_at || '').slice(0,10))
      default: return ''
    }
  }
  // Sort the full filtered set before paginating so page 2 continues the
  // ordering instead of each page being sorted independently.
  const sortedPageRows = useMemo(() => {
    const rows = SORTABLE.includes(sort.key)
      ? [...filtered].sort((a, b) => {
        const dir = sort.dir === 'asc' ? 1 : -1
        const av = sortVal(sort.key, a)
        const bv = sortVal(sort.key, b)
        const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
        return cmp * dir
      })
      : filtered
    return rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  }, [filtered, sort, safePage, PAGE_SIZE, ownerOf])

  // Shared pager body — rendered inside the desktop table footer and
  // below the mobile cards (same state, two placements).
  const pagerBody = () => (
    <>
      <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap flex-shrink-0">
        Showing {(safePage - 1) * PAGE_SIZE + 1} to {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} documents
      </p>
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-shrink-0">
        <button onClick={() => setPage(safePage - 1)} disabled={safePage <= 1} aria-label="Previous page"
          className="min-w-[32px] min-h-[32px] px-2 rounded-lg border border-[var(--ap-border)] text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-[var(--ap-surface-2)] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
          ‹
        </button>
        {pageItems.map((n, i) => n === '…'
          ? <span key={`e${i}`} className="text-xs text-slate-400 px-1">…</span>
          : (
            <button key={n} onClick={() => setPage(n)} aria-label={`Go to page ${n}`} aria-current={n === safePage ? 'page' : undefined}
              className={`min-w-[32px] min-h-[32px] px-2 rounded-lg text-xs font-bold tabular-nums active:scale-95 transition-all ${
                n === safePage
                  ? 'bg-[var(--ap-accent)] text-white shadow'
                  : 'border border-[var(--ap-border)] text-slate-600 dark:text-slate-300 hover:bg-[var(--ap-surface-2)]'
              }`}>
              {n}
            </button>
          ))}
        <button onClick={() => setPage(safePage + 1)} disabled={safePage >= totalPages} aria-label="Next page"
          className="min-w-[32px] min-h-[32px] px-2 rounded-lg border border-[var(--ap-border)] text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-[var(--ap-surface-2)] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
          ›
        </button>
      </div>
    </>
  )

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
        maskRef(doc.docNumber),
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
    all:            enriched.length,
    active:         enriched.filter(d => d.computedStatus === 'active').length,
    expiring_soon:  enriched.filter(d => d.computedStatus === 'expiring_soon').length,
    expired:        enriched.filter(d => d.computedStatus === 'expired').length,
    no_expiry:      enriched.filter(d => d.computedStatus === 'no_expiry').length,
  }), [enriched])

  const closeModal = () => { setShowAdd(false); setEditingDoc(null) }
  const openAdd = () => { setEditingDoc(null); setShowAdd(true) }
  const openEdit = doc => { setEditingDoc(doc); setDocDetail(null); setShowAdd(true) }
  const openDetail = async doc => {
    // Re-mint short-lived links when a record is opened; a long-lived tab may
    // otherwise hold a preview URL that expired an hour after load.
    const fresh = await refreshLinks([doc])
    setDocDetail({
      ...doc,
      frontUrl: fresh[doc.id]?.front ?? doc.frontUrl ?? doc.file_url ?? null,
      backUrl:  fresh[doc.id]?.back  ?? doc.backUrl  ?? doc.back_file_url ?? null,
    })
  }

  const handleSave = async (form, meta = {}) => {
    const saved = await saveDocument(form, meta)
    setDocs(prev => [saved, ...prev.filter(d => String(d.id) !== String(saved.id))])
    await refreshLinks([saved])

    // Clean up replaced or removed objects only after the database write has
    // succeeded. A cleanup failure must never undo a successful save.
    const oldPaths = [editingDoc?.file_path, editingDoc?.back_file_path].filter(Boolean)
    const newPaths = [saved.file_path, saved.back_file_path].filter(Boolean)
    const stale = oldPaths.filter(path => !newPaths.includes(path))
    if (stale.length) deleteDocumentFiles(stale)

    return saved
  }

  const handleDelete = async doc => {
    if (!window.confirm(`Delete “${doc.title}”?`)) return false
    setDeleteError(null)
    try {
      await deleteDocument(doc.id)
      await deleteDocumentFiles([doc.file_path, doc.back_file_path])
      setDocs(prev => prev.filter(d => String(d.id) !== String(doc.id)))
      setFileUrls(prev => {
        const next = { ...prev }
        delete next[doc.id]
        return next
      })
      if (docDetail?.id === doc.id) setDocDetail(null)
      return true
    } catch (err) {
      console.error('[Documents] delete failed:', err)
      setDeleteError(err.message || 'Could not delete this document. Please try again.')
      return false
    }
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
      {/* 1. Page header */}
      <PageHeader
        title="Documents"
        subtitle="Manage driver, vehicle and company records"
        icon={FileText}
        action={canManage && (
          <Button variant="primary" icon={Plus} onClick={openAdd}>Add Document</Button>
        )}
      />

      {error && (
        <Callout tone="red" icon={AlertTriangle} title={`Unable to load documents — ${error}`}
          actionLabel="Try again" onAction={load} />
      )}

      {deleteError && (
        <Callout tone="red" icon={AlertTriangle} title={deleteError}
          actionLabel="Dismiss" onAction={() => setDeleteError(null)} />
      )}

      {/* 2. Status-first summary; tiles double as filter shortcuts */}
      <DocumentStatusCards
        counts={counts}
        active={statusFilter}
        onSelect={setStatusFilter}
      />

      {/* Expiry alert for managers — one tap to the expiring bucket */}
      {(isAdmin || isManager) && counts.expiring_soon > 0 && (
        <div className="ap-surface rounded-2xl px-4 py-3 flex items-center gap-3">
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
          <p className="text-xs text-slate-600 dark:text-slate-300 flex-1 min-w-0">
            <span className="font-bold">{counts.expiring_soon}</span> document{counts.expiring_soon !== 1 ? 's' : ''} expiring within 30 days.
          </p>
          <Button variant="ghost" size="sm" onClick={() => setStatusFilter('expiring_soon')}>Review</Button>
        </div>
      )}

      {/* 3. Category, search, type/owner/status filters and view controls */}
      <DocumentFilters
        categories={CATEGORIES}
        category={category}
        onCategory={setCategory}
        search={search}
        onSearch={setSearch}
        typeOptions={TYPE_OPTIONS}
        typeFilter={typeFilter}
        onTypeFilter={setTypeFilter}
        ownerOptions={ownerOptions}
        ownerFilter={ownerFilter}
        onOwnerFilter={setOwnerFilter}
        statusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        onExport={exportCsv}
        viewMode={viewMode}
        onViewMode={setView}
        allCols={ALL_DOC_COLS}
        visibleCols={visibleCols}
        onToggleCol={toggleCol}
      />

      {/* 5. Main data table — loading / empty / rows + desktop pager */}
      {loading ? (
        <div className="rounded-2xl border border-[var(--ap-border)] ap-surface overflow-hidden" role="status" aria-busy="true" aria-label="Loading documents">
          <span className="sr-only">Loading documents…</span>
          <div className="hidden md:grid px-4 py-2.5 gap-3 border-b border-[var(--ap-border)]" style={{ gridTemplateColumns: `repeat(${visibleCols.length}, minmax(0,1fr)) 120px` }} aria-hidden="true">
            {visibleCols.map(k => <div key={k} className="skeleton h-3 rounded" />)}
            <div className="skeleton h-3 rounded" />
          </div>
          {[1,2,3,4,5].map(i => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-[var(--ap-border)] last:border-0" aria-hidden="true">
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
        docs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No documents found"
            description="Upload a document to get started."
            className="ap-surface"
            action={canManage && <Button variant="primary" icon={Plus} onClick={openAdd}>Add Document</Button>}
          />
        ) : (
          <EmptyState
            icon={FileText}
            title="No documents match your filters."
            className="ap-surface"
            action={<Button variant="secondary" onClick={clearFilters}>Clear Filters</Button>}
          />
        )
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {sortedPageRows.map(doc => {
            const owner = ownerOf(doc)
            return (
              <div key={doc.id} className="ap-surface rounded-2xl p-3.5 flex flex-col gap-3">
                <button type="button" onClick={() => openDetail(doc)}
                  className="relative h-32 rounded-xl overflow-hidden border border-[var(--ap-border)] bg-[var(--ap-surface-2)] w-full text-left"
                  aria-label={`Open details for ${doc.title}`}>
                  <DocThumb doc={doc} />
                  <span className="absolute top-2 right-2"><StatusBadge status={doc.computedStatus} /></span>
                </button>
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => openDetail(doc)}
                    className="text-[13px] font-bold text-slate-700 dark:text-slate-200 truncate block w-full text-left hover:text-[var(--ap-accent)]">
                    {doc.title}
                  </button>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">{typeLabel(doc.doc_type || 'other')}</span>
                    {doc.docNumber && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-[var(--ap-surface-2)] text-[var(--ap-text-3)]" title="Reference number masked">
                        {maskRef(doc.docNumber)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="w-6 h-6 rounded-full bg-[var(--ap-border)] flex items-center justify-center text-[10px] font-semibold text-slate-600 dark:text-slate-300 flex-shrink-0">
                      {(owner?.name || '?').charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-slate-700 dark:text-slate-200 truncate">{owner?.name || '—'}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">{owner?.label || doc.category}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2">
                    {doc.expiry_date ? `Expires ${fmtDate(doc.expiry_date)}` : 'No expiry'}
                    {doc.created_at ? ` · Uploaded ${fmtDate(String(doc.created_at || '').slice(0,10))}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 pt-2 border-t border-[var(--ap-border)]">
                  <button type="button" onClick={() => openDetail(doc)} title="View details" aria-label={`View ${doc.title}`}
                    className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-[var(--ap-surface-2)] hover:text-slate-800 dark:hover:text-white transition-colors">
                    <Eye size={14} />
                  </button>
                  {doc.frontUrl && (
                    <a href={doc.frontUrl} target="_blank" rel="noopener noreferrer" download={doc.file_name || 'document'} title="Download document" aria-label={`Download ${doc.title}`}
                      className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-[var(--ap-surface-2)] hover:text-slate-800 dark:hover:text-white transition-colors">
                      <Download size={14} />
                    </a>
                  )}
                  {canManage && (
                    <button type="button" onClick={() => openEdit(doc)} aria-label={`Edit ${doc.title}`}
                      className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-[var(--ap-surface-2)] hover:text-slate-800 dark:hover:text-white transition-colors">
                      <Pencil size={14} />
                    </button>
                  )}
                  {canManage && (
                    <IconButton icon={Trash2} size={14} tone="danger" label={`Delete ${doc.title}`}
                      onClick={() => handleDelete(doc)} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <>
        {/* Desktop table */}
        <div className="rounded-2xl border border-[var(--ap-border)] ap-surface overflow-hidden hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--ap-border)] bg-[var(--ap-surface-2)]">
                {visibleCols.map(k => (
                  <th key={k}
                    className={`px-3 py-2.5 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap ${SORTABLE.includes(k) ? 'cursor-pointer select-none' : ''}`}
                    onClick={SORTABLE.includes(k) ? () => toggleSort(k) : undefined}
                    aria-sort={sort.key === k ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                    {colLabel(k)}{sort.key === k ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedPageRows.map(doc => {
                const owner = ownerOf(doc)
                const ref = doc.docNumber ? maskRef(doc.docNumber) : '—'
                const days = doc.daysLeft
                return (
                  <tr key={doc.id} className="border-b border-[var(--ap-border)] last:border-0 hover:bg-[var(--ap-surface-2)]/50 transition-colors">
                    {visibleCols.map(k => {
                      if (k === 'doc') return (
                        <td key={k} className="px-3 py-3 max-w-[240px]">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              doc.computedStatus === 'expired' ? 'bg-red-100 dark:bg-red-900/30' :
                              doc.computedStatus === 'expiring_soon' ? 'bg-amber-100 dark:bg-amber-900/30' :
                              'bg-[var(--ap-surface-2)]'}`}>
                              <FileText size={15} className={
                                doc.computedStatus === 'expired' ? 'text-red-500' :
                                doc.computedStatus === 'expiring_soon' ? 'text-amber-500' :
                                'text-slate-500 dark:text-slate-400'} />
                            </span>
                            <span className="min-w-0">
                              <button type="button" onClick={() => openDetail(doc)}
                                className="block text-[13px] font-bold text-slate-700 dark:text-slate-200 truncate w-full text-left hover:text-[var(--ap-accent)]">
                                {doc.title}
                              </button>
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
                              <span className="w-6 h-6 rounded-full bg-[var(--ap-border)] flex items-center justify-center text-[10px] font-semibold text-slate-600 dark:text-slate-300 flex-shrink-0">
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
                        <button type="button" onClick={() => openDetail(doc)} title="View details" aria-label={`View ${doc.title}`}
                          className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-[var(--ap-surface-2)] hover:text-slate-800 dark:hover:text-white transition-colors">
                          <Eye size={14} />
                        </button>
                        {doc.frontUrl && (
                          <a href={doc.frontUrl} target="_blank" rel="noopener noreferrer" download={doc.file_name || 'document'} title="Download document" aria-label={`Download ${doc.title}`}
                            className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-[var(--ap-surface-2)] hover:text-slate-800 dark:hover:text-white transition-colors">
                            <Download size={14} />
                          </a>
                        )}
                        {canManage && (
                          <IconButton icon={Pencil} size={14} label={`Edit ${doc.title}`} onClick={() => openEdit(doc)} />
                        )}
                        {canManage && (
                          <IconButton icon={Trash2} size={14} tone="danger" label={`Delete ${doc.title}`}
                            onClick={() => handleDelete(doc)} />
                        )}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {/* 6. Pagination — footer inside the table card (desktop) */}
          {totalPages > 1 && (
            <div className="hidden md:flex items-center justify-between gap-3 px-3 py-2 border-t border-[var(--ap-border)] bg-[var(--ap-surface-2)]/50">
              {pagerBody()}
            </div>
          )}
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {sortedPageRows.map(doc => {
            const owner = ownerOf(doc)
            const days = doc.daysLeft
            return (
              <div key={doc.id} className="rounded-2xl border border-[var(--ap-border)] ap-surface p-3.5">
                <div className="flex items-center gap-2.5">
                  <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    doc.computedStatus === 'expired' ? 'bg-red-100 dark:bg-red-900/30' :
                    doc.computedStatus === 'expiring_soon' ? 'bg-amber-100 dark:bg-amber-900/30' :
                    'bg-[var(--ap-surface-2)]'}`}>
                    <FileText size={16} className={
                      doc.computedStatus === 'expired' ? 'text-red-500' :
                      doc.computedStatus === 'expiring_soon' ? 'text-amber-500' :
                      'text-slate-500 dark:text-slate-400'} />
                  </span>
                  <button type="button" onClick={() => openDetail(doc)} className="flex-1 min-w-0 text-left">
                    <p className="text-[13px] font-bold text-slate-700 dark:text-slate-200 truncate">{doc.title}</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                      {owner ? `${owner.name} · ` : ''}{typeLabel(doc.doc_type || 'other')}
                      {doc.docNumber ? ` · ${maskRef(doc.docNumber)}` : ''}
                    </p>
                  </button>
                  <StatusBadge status={doc.computedStatus} />
                </div>
                <div className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-[var(--ap-border)]">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    {doc.expiry_date ? <>Exp {fmtDate(doc.expiry_date)}{days != null && (
                      <span className={days < 0 ? 'text-red-500 font-bold' : days <= 30 ? 'text-amber-600 dark:text-amber-400 font-bold' : ''}>
                        {` · ${days < 0 ? `Expired ${Math.abs(days)}d ago` : days === 0 ? 'today' : `in ${days}d`}`}
                      </span>
                    )}</> : 'No expiry'}
                  </p>
                  <span className="inline-flex gap-1 flex-shrink-0">
                    <button type="button" onClick={() => openDetail(doc)} title="View details" aria-label={`View ${doc.title}`}
                      className="w-9 h-9 rounded-lg inline-flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-[var(--ap-surface-2)] transition-colors">
                      <Eye size={15} />
                    </button>
                    {doc.frontUrl && (
                      <a href={doc.frontUrl} target="_blank" rel="noopener noreferrer" download={doc.file_name || 'document'} title="Download" aria-label={`Download ${doc.title}`}
                        className="w-9 h-9 rounded-lg inline-flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-[var(--ap-surface-2)] transition-colors">
                        <Download size={15} />
                      </a>
                    )}
                    {canManage && (
                      <IconButton icon={Pencil} size={15} label={`Edit ${doc.title}`} onClick={() => openEdit(doc)} />
                    )}
                    {canManage && (
                      <IconButton icon={Trash2} size={15} tone="danger" label={`Delete ${doc.title}`}
                        onClick={() => handleDelete(doc)} />
                    )}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* 6. Pagination — below the cards (mobile) */}
        {totalPages > 1 && (
          <div className="md:hidden ap-surface rounded-2xl px-3 py-2 mt-2 flex items-center justify-between gap-3">
            {pagerBody()}
          </div>
        )}
        </>
      )}

      {/* 7. Add / edit document modal */}
      {showAdd && (
        <DocumentModal
          document={editingDoc}
          drivers={drivers}
          vehicles={vehicles}
          customers={customers}
          onClose={closeModal}
          onSave={handleSave}
          uploadFile={uploadDocumentFile}
          scanDocument={file => runOcrWorkflow({ file })}
          onPreview={(doc, side) => getDocumentFileUrl(doc || {}, side)}
        />
      )}
      {docDetail && (
        <DocDetailModal
          doc={docDetail}
          owner={ownerOf(docDetail)}
          onClose={() => setDocDetail(null)}
          canManage={canManage}
          onEdit={() => openEdit(docDetail)}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}

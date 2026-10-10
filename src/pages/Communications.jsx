// ─── Communications Page ─────────────────────────────────────
// Full notification center + communication logs + analytics.
// Accessible to Admin and Manager.

import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Bell, MessageSquare, BarChart2, Settings, Search,
  Filter, RefreshCw, CheckCheck, Archive, Trash2,
  AlertTriangle, CheckCircle, Clock, ChevronDown,
  Smartphone, Phone, Globe, BookOpen, Zap, Send,
  Download, Eye, Copy, X, ChevronLeft, ChevronRight,
  ExternalLink, XCircle,
} from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import StatusPill from '../components/ui/StatusPill'
import { useCommunicationCtx } from '../hooks/useCommunication'
import { exportToCSV } from '../data/reportData'
import { fmtAuditTime } from '../data/auditLogData'
import { getCommunicationLogs, openWhatsApp, scheduler } from '../services/communicationService'

// ── Constants ─────────────────────────────────────────────────
const TABS = [
  { key:'notifications', label:'Notifications', Icon:Bell         },
  { key:'logs',          label:'Comm Logs',     Icon:MessageSquare},
  { key:'schedule',      label:'Scheduled',     Icon:Clock        },
]

const CHANNEL_CFG = {
  in_app:   { label:'In-App',   icon:'🔔', color:'text-blue-500',    bg:'bg-blue-100 dark:bg-blue-900/30'    },
  whatsapp: { label:'WhatsApp', icon:'💬', color:'text-emerald-500', bg:'bg-emerald-100 dark:bg-emerald-900/30'},
  sms:      { label:'SMS',      icon:'📱', color:'text-teal-500',    bg:'bg-teal-100 dark:bg-teal-900/30'    },
  push:     { label:'Push',     icon:'📲', color:'text-violet-500',  bg:'bg-violet-100 dark:bg-violet-900/30'},
  webhook:  { label:'Webhook',  icon:'🌐', color:'text-amber-500',   bg:'bg-amber-100 dark:bg-amber-900/30'  },
  email:    { label:'Email',    icon:'📧', color:'text-rose-500',    bg:'bg-rose-100 dark:bg-rose-900/30'    },
}

const STATUS_CFG = {
  pending:    { label:'Pending',    badge:'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
  processing: { label:'Processing', badge:'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'         },
  queued:     { label:'Queued',     badge:'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'         },
  delivered:  { label:'Delivered',  badge:'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'},
  failed:     { label:'Failed',     badge:'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'             },
  retrying:   { label:'Retrying',   badge:'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  cancelled:  { label:'Cancelled',  badge:'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'        },
  unread:     { label:'Unread',     badge:'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'         },
  read:       { label:'Read',       badge:'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'        },
  archived:   { label:'Archived',   badge:'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'        },
}

const CAT_COLORS = {
  booking:    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  trip:       'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  expense:    'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  payroll:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  driver:     'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  vehicle:    'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  customer:   'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  document:   'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  attendance: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  finance:    'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  system:     'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  general:    'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
}

const STATUS_TONE = {
  pending: 'amber', processing: 'blue', queued: 'blue', delivered: 'green',
  failed: 'red', retrying: 'amber', cancelled: 'gray', unread: 'blue', read: 'gray', archived: 'gray',
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.pending
  return <StatusPill tone={STATUS_TONE[status] || 'gray'}>{cfg.label}</StatusPill>
}

function ChannelChip({ channel }) {
  const cfg = CHANNEL_CFG[channel] || { label:channel, icon:'📨', bg:'bg-slate-100 dark:bg-slate-800', color:'text-slate-500' }
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

// ── Shared ops UI ─────────────────────────────────────────────
// Absolute timestamps (logs carry real created_at / sent_at only).
function fmtDT(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return {
    date: d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }),
    time: d.toLocaleTimeString('en-IN', { hour:'numeric', minute:'2-digit', hour12:true }).toUpperCase(),
  }
}
function TimeCell({ iso }) {
  const t = fmtDT(iso)
  if (!t) return <span className="text-slate-300 dark:text-slate-600">—</span>
  return (
    <span className="block leading-tight">
      <span className="block text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">{t.date}</span>
      <span className="block text-[10px] text-slate-400 tabular-nums">{t.time}</span>
    </span>
  )
}
const copyText = async (t) => { try { await navigator.clipboard.writeText(String(t ?? '')); return true } catch { return false } };

// Compact KPI card (icon tile + value + label + sub note)
function Kpi({ icon, value, label, sub, tone }) {
  const tones = {
    navy:     'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    green:    'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    red:      'bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400',
    amber:    'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    violet:   'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
    teal:     'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400',
    slate:    'bg-[var(--ap-surface-2)] text-slate-500 dark:text-slate-400',
  }
  return (
    <div className="ap-surface rounded-xl px-3 py-3 flex items-center gap-2.5">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base ${tones[tone] || tones.slate}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xl font-sf font-semibold text-slate-800 dark:text-white tabular-nums leading-none">{value}</p>
        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1">{label}</p>
        {sub && <p className="text-[9px] text-slate-400 truncate">{sub}</p>}
      </div>
    </div>
  )
}
function KpiSkeleton() {
  return (
    <div className="ap-surface rounded-xl px-3 py-3 flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl skeleton flex-shrink-0" />
      <div className="flex-1 space-y-1.5"><div className="h-4 w-12 rounded skeleton" /><div className="h-2 w-16 rounded skeleton" /></div>
    </div>
  )
}
function SectionTitle({ children, right }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2.5">
      <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{children}</p>
      {right}
    </div>
  )
}
function EmptyState({ icon, title, sub }) {
  return (
    <div className="ap-surface rounded-2xl p-10 text-center">
      <div className="text-3xl mb-2 opacity-60">{icon}</div>
      <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">{title}</p>
      {sub && <p className="text-slate-400 text-xs mt-1">{sub}</p>}
    </div>
  )
}
function SkeletonRows({ n = 6 }) {
  return (
    <div className="ap-surface rounded-2xl overflow-hidden">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-[var(--ap-border)] last:border-0">
          <div className="h-3 w-8 rounded skeleton" />
          <div className="flex-1 space-y-1.5"><div className="h-3 w-40 rounded skeleton" /><div className="h-2 w-24 rounded skeleton" /></div>
          <div className="h-5 w-16 rounded-full skeleton" />
          <div className="h-3 w-20 rounded skeleton hidden sm:block" />
        </div>
      ))}
    </div>
  )
}
function Pager({ page, totalPages, total, pageSize, onPage }) {
  if (total === 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <p className="text-xs text-slate-400 tabular-nums">Showing {from} to {to} of {total} records</p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1.5">
          <button disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"
            className="w-8 h-8 rounded-lg border border-[var(--ap-border)] flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-[var(--ap-surface-2)] transition-colors">
            <ChevronLeft size={14} />
          </button>
          <span className="min-w-[32px] h-8 px-2 rounded-lg bg-[var(--ap-accent)] text-white text-xs font-bold flex items-center justify-center tabular-nums">{page}</span>
          <button disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page"
            className="w-8 h-8 rounded-lg border border-[var(--ap-border)] flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-[var(--ap-surface-2)] transition-colors">
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
// Right-side detail drawer (full-screen sheet on mobile)
function Drawer({ title, sub, onClose, children, actions }) {
  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 sm:inset-x-auto sm:right-0 sm:top-0 sm:bottom-0 sm:w-[440px] max-h-[92vh] sm:max-h-none ap-surface rounded-t-3xl sm:rounded-none shadow-2xl flex flex-col animate-fade-up">
        <div className="w-10 h-1 bg-[var(--ap-border)] rounded-full mx-auto mt-3 sm:hidden flex-shrink-0" />
        <div className="flex items-start justify-between gap-3 px-5 pt-4 sm:pt-5 pb-3 border-b border-[var(--ap-border)] flex-shrink-0">
          <div className="min-w-0">
            <h3 className="font-sf font-semibold text-slate-800 dark:text-white text-base">{title}</h3>
            {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
          </div>
          <button onClick={onClose} aria-label="Close details"
            className="w-8 h-8 rounded-xl bg-[var(--ap-surface-2)] flex items-center justify-center text-slate-500 hover:bg-[var(--ap-surface-2)] transition-colors flex-shrink-0">
            <X size={15} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">{children}</div>
        {actions && (
          <div className="px-5 py-3.5 border-t border-[var(--ap-border)] flex gap-2 flex-shrink-0">{actions}</div>
        )}
      </div>
    </div>,
    document.body
  )
}
function MetaGrid({ items }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(m => (
        <div key={m.label} className="bg-[var(--ap-surface-2)] rounded-xl px-3 py-2 border border-[var(--ap-border)] min-w-0">
          <p className="text-[9px] text-slate-400 uppercase tracking-wide font-bold">{m.label}</p>
          <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5 break-words">{m.value}</div>
        </div>
      ))}
    </div>
  )
}
// Date-range presets (absolute ranges over real record timestamps)
const RANGE_OPTS = [
  { key:'today', label:'Today' },
  { key:'7d',    label:'7 Days' },
  { key:'30d',   label:'30 Days' },
  { key:'month', label:'This Month' },
  { key:'last',  label:'Last Month' },
  { key:'all',   label:'All Time' },
]
function rangeStartMs(key) {
  const now = new Date()
  const sod = new Date(now); sod.setHours(0, 0, 0, 0)
  if (key === 'today') return sod.getTime()
  if (key === '7d')  return sod.getTime() - 6 * 86400000
  if (key === '30d') return sod.getTime() - 29 * 86400000
  if (key === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  if (key === 'last')  return new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime()
  return 0
}
function rangeEndMs(key) {
  const now = new Date()
  if (key === 'last') return new Date(now.getFullYear(), now.getMonth(), 1).getTime() - 1
  return now.getTime()
}
const prettyEvent = (e) => String(e || 'general').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

// ── Notifications Tab ─────────────────────────────────────────
function NotificationsTab() {
  const { notifications, notifLoading, loadNotifs, markRead, markAllRead, archive, dismiss, unreadCount } = useCommunicationCtx()
  const [filter, setFilter]   = useState('all')
  const [search, setSearch]   = useState('')
  const [catFilter, setCat]   = useState('all')

  const filtered = useMemo(() => {
    return notifications.filter(n => {
      if (filter === 'unread'   && n.status !== 'unread')   return false
      if (filter === 'archived' && n.status !== 'archived') return false
      if (filter === 'read'     && n.status !== 'read')     return false
      if (catFilter !== 'all'   && n.category !== catFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return [n.title, n.message, n.category].some(v => v?.toLowerCase().includes(q))
      }
      return true
    })
  }, [notifications, filter, search, catFilter])

  const categories = [...new Set(notifications.map(n => n.category).filter(Boolean))]

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--ap-border)] bg-[var(--ap-surface-2)] flex-1 min-w-[160px] max-w-xs">
          <Search size={13} className="text-slate-400" />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search notifications…"
            className="bg-transparent text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none w-full" />
        </div>

        <div className="flex gap-1 bg-[var(--ap-surface-2)] rounded-xl p-1">
          {[['all','All'],['unread','Unread'],['read','Read'],['archived','Archived']].map(([k,l]) => (
            <button key={k} onClick={()=>setFilter(k)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${filter===k?'bg-[var(--ap-surface-elevated)] text-slate-900 dark:text-white shadow':'text-slate-500 dark:text-slate-400'}`}>
              {l}
              {k==='unread'&&unreadCount>0&&<span className="ml-1 text-[9px] bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full">{unreadCount}</span>}
            </button>
          ))}
        </div>

        {categories.length > 0 && (
          <select value={catFilter} onChange={e=>setCat(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-700 dark:text-slate-200 focus:outline-none">
            <option value="all">All Categories</option>
            {categories.map(c=><option key={c} value={c} className="capitalize">{c}</option>)}
          </select>
        )}

        <div className="flex gap-2 ml-auto">
          {unreadCount > 0 && (
            <button onClick={markAllRead}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-600 dark:text-slate-300 hover:bg-[var(--ap-surface-2)] transition-colors">
              <CheckCheck size={13}/> Mark All Read
            </button>
          )}
          <button onClick={loadNotifs}
            className="w-8 h-8 rounded-lg border border-[var(--ap-border)] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-[var(--ap-surface-2)] transition-colors">
            <RefreshCw size={13}/>
          </button>
        </div>
      </div>

      {/* List */}
      {notifLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i=><div key={i} className="h-16 ap-surface rounded-xl animate-pulse"/>)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="ap-surface rounded-2xl p-12 text-center">
          <Bell size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3"/>
          <p className="text-slate-400 text-sm">No notifications found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => {
            const isUnread = n.status === 'unread'
            const catColor = CAT_COLORS[n.category] || CAT_COLORS.general
            return (
              <div key={n.id}
                className={`ap-surface rounded-xl overflow-hidden border-l-4 ${isUnread?'border-blue-500':'border-transparent'}`}>
                <div className="flex items-start gap-3 p-3.5">
                  <div className="w-9 h-9 rounded-xl bg-[var(--ap-surface-2)] flex items-center justify-center flex-shrink-0 text-base">
                    {n.icon||'🔔'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className={`text-sm font-bold ${isUnread?'text-slate-800 dark:text-white':'text-slate-600 dark:text-slate-300'}`}>
                        {n.title}
                      </p>
                      {isUnread&&<span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"/>}
                    </div>
                    {n.message&&<p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{n.message}</p>}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize ${catColor}`}>{n.category||'general'}</span>
                      <StatusBadge status={n.status}/>
                      <span className="text-[10px] text-slate-400">{fmtAuditTime(n.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isUnread&&<button onClick={()=>markRead(n.id)} title="Mark read"
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"><BookOpen size={12}/></button>}
                    <button onClick={()=>archive(n.id)} title="Archive"
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-[var(--ap-surface-2)] transition-colors"><Archive size={12}/></button>
                    <button onClick={()=>dismiss(n.id)} title="Dismiss"
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><Trash2 size={12}/></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Comm Logs Tab ─────────────────────────────────────────────
// Technical audit of every communication. Real communication_logs records
// only: no attempts/provider/read fields exist, and no retry API exists —
// so the UI shows exactly what the backend stores (View + Copy + optional
// WhatsApp follow-up), never a fake Retry.
const LOG_PAGE_SIZE = 10
function CommLogsTab() {
  const [logs, setLogs]       = useState([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [search, setSearch]   = useState('')
  const [channel, setChannel] = useState('all')
  const [status, setStatus]   = useState('all')
  const [recipient, setRecipient] = useState('all')
  const [trigger, setTrigger] = useState('all')
  const [range, setRange]     = useState('all')
  const [page, setPage]       = useState(1)
  const [drawer, setDrawer]   = useState(null)
  const [copied, setCopied]   = useState(false)

  const reload = async () => {
    setLoading(true); setLoadError(null)
    try {
      const { data, count } = await getCommunicationLogs({ limit: 200 })
      setLogs(Array.isArray(data) ? data : [])
      setTotal(count || 0)
    } catch {
      setLoadError('Unable to load communication logs')
    }
    setLoading(false)
  }
  useEffect(() => { reload() }, [])
  useEffect(() => { setPage(1) }, [search, channel, status, recipient, trigger, range])

  const channels = useMemo(() => [...new Set(logs.map(l => l.channel).filter(Boolean))], [logs])
  const recipients = useMemo(() => [...new Set(logs.map(l => l.recipient_name).filter(Boolean))].sort(), [logs])
  const triggers = useMemo(() => [...new Set(logs.map(l => l.event_type || l.category).filter(Boolean))].sort(), [logs])
  const statuses = useMemo(() => [...new Set(logs.map(l => l.status).filter(Boolean))], [logs])

  const filtered = useMemo(() => {
    const from = rangeStartMs(range), to = rangeEndMs(range)
    return logs.filter(l => {
      if (channel !== 'all' && l.channel !== channel) return false
      if (status !== 'all' && l.status !== status) return false
      if (recipient !== 'all' && l.recipient_name !== recipient) return false
      if (trigger !== 'all' && (l.event_type || l.category) !== trigger) return false
      const t = l.created_at ? new Date(l.created_at).getTime() : 0
      if (t < from || t > to) return false
      if (search) {
        const q = search.toLowerCase()
        if (![l.subject, l.body, l.recipient_name, l.recipient_contact, l.event_type, l.category, l.id]
          .some(v => String(v ?? '').toLowerCase().includes(q))) return false
      }
      return true
    })
  }, [logs, channel, status, recipient, trigger, range, search])

  // KPIs from the loaded window (real records only)
  const kTotal = logs.length
  const kDelivered = logs.filter(l => l.status === 'delivered').length
  const kFailed = logs.filter(l => l.status === 'failed').length
  const kPending = logs.filter(l => ['pending', 'processing', 'queued', 'retrying'].includes(l.status)).length

  const totalPages = Math.max(1, Math.ceil(filtered.length / LOG_PAGE_SIZE))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const pageRows = filtered.slice((safePage - 1) * LOG_PAGE_SIZE, safePage * LOG_PAGE_SIZE)

  const selCls = 'px-3 py-2 text-xs rounded-lg border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-700 dark:text-slate-200 focus:outline-none max-w-[150px]'
  const clearFilters = () => { setSearch(''); setChannel('all'); setStatus('all'); setRecipient('all'); setTrigger('all'); setRange('all') }
  const hasFilters = search || channel !== 'all' || status !== 'all' || recipient !== 'all' || trigger !== 'all' || range !== 'all'

  const handleExport = () => exportToCSV(filtered, [
    { label:'ID', key:'id' },
    { label:'Created', key:'created_at' },
    { label:'Sent', key:'sent_at' },
    { label:'Channel', key:'channel' },
    { label:'Category', key:'category' },
    { label:'Trigger', key:'event_type' },
    { label:'Recipient', key:'recipient_name' },
    { label:'Contact', key:'recipient_contact' },
    { label:'Subject', key:'subject' },
    { label:'Body', key:'body' },
    { label:'Status', key:'status' },
    { label:'Failure Reason', key:'failure_reason' },
    { label:'Priority', key:'priority' },
  ], 'comm_logs')

  const doCopy = async (l) => {
    const ok = await copyText(`${l.subject || ''}\n${l.body || ''}`.trim())
    setCopied(ok)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-sf font-semibold text-slate-800 dark:text-white text-base">Communication Logs</h3>
        <p className="text-xs text-slate-400 mt-0.5">Track message delivery, failures, retries and communication history</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[0, 1, 2, 3].map(i => <KpiSkeleton key={i} />)}</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kpi icon="📨" value={kTotal} label="TOTAL MESSAGES" sub={`${total} in store`} tone="navy" />
          <Kpi icon="✅" value={kDelivered} label="DELIVERED" sub={kTotal ? `${Math.round(kDelivered / kTotal * 100)}% of loaded` : '—'} tone="green" />
          <Kpi icon="❌" value={kFailed} label="FAILED" sub={kFailed ? 'Needs attention' : 'None'} tone="red" />
          <Kpi icon="⏳" value={kPending} label="PENDING" sub="Awaiting delivery" tone="amber" />
        </div>
      )}

      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--ap-border)] bg-[var(--ap-surface-2)] flex-1 min-w-[180px] max-w-xs">
          <Search size={13} className="text-slate-400 flex-shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search message, recipient, ID…"
            className="bg-transparent text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none w-full" />
        </div>
        <select value={channel} onChange={e => setChannel(e.target.value)} className={selCls}>
          <option value="all">All Channels</option>
          {channels.map(c => <option key={c} value={c}>{CHANNEL_CFG[c]?.label || c}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className={selCls}>
          <option value="all">All Status</option>
          {statuses.map(s => <option key={s} value={s}>{STATUS_CFG[s]?.label || s}</option>)}
        </select>
        <select value={recipient} onChange={e => setRecipient(e.target.value)} className={selCls}>
          <option value="all">All Recipients</option>
          {recipients.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={trigger} onChange={e => setTrigger(e.target.value)} className={selCls}>
          <option value="all">All Triggers</option>
          {triggers.map(t => <option key={t} value={t}>{prettyEvent(t)}</option>)}
        </select>
        <select value={range} onChange={e => setRange(e.target.value)} className={selCls}>
          {RANGE_OPTS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
        {hasFilters && (
          <button onClick={clearFilters}
            className="px-3 py-2 text-xs font-bold rounded-lg text-slate-500 hover:bg-[var(--ap-surface-2)] transition-colors">
            Clear
          </button>
        )}
        <div className="flex gap-2 ml-auto">
          <button onClick={reload} title="Refresh" aria-label="Refresh logs"
            className="w-8 h-8 rounded-lg border border-[var(--ap-border)] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-[var(--ap-surface-2)] transition-colors">
            <RefreshCw size={13} />
          </button>
          <button onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-600 dark:text-slate-300 hover:bg-[var(--ap-surface-2)] transition-colors">
            <Download size={13} /> Export Logs
          </button>
        </div>
      </div>

      {/* Table / states */}
      {loading ? (
        <SkeletonRows n={7} />
      ) : loadError ? (
        <div className="ap-surface rounded-2xl p-10 text-center">
          <AlertTriangle size={28} className="mx-auto text-red-400 mb-2" />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{loadError}</p>
          <button onClick={reload}
            className="mt-3 px-4 py-2 rounded-xl bg-[var(--ap-accent)] text-white text-xs font-bold hover:opacity-90 transition-all">
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="📭" title={hasFilters ? 'No logs match these filters' : 'No communication logs yet'}
          sub={hasFilters ? 'Try clearing search or choosing a different filter.' : 'Logs appear here once the system sends communications.'} />
      ) : (<>
        <div className="ap-surface rounded-2xl overflow-hidden hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="bg-[var(--ap-surface-2)]/95 border-b border-[var(--ap-border)]">
                  {['#', 'Message', 'Channel', 'Recipient', 'Trigger', 'Status', 'Sent At', 'Delivered At', 'Actions'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((l, i) => (
                  <tr key={l.id || i} onClick={() => setDrawer(l)}
                    className="border-b border-[var(--ap-border)] hover:bg-[var(--ap-surface-2)] transition-colors cursor-pointer">
                    <td className="px-3 py-2.5 text-xs text-slate-400 tabular-nums">{(safePage - 1) * LOG_PAGE_SIZE + i + 1}</td>
                    <td className="px-3 py-2.5 max-w-[220px]">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{l.subject || prettyEvent(l.event_type)}</p>
                      <p className="text-[10px] text-slate-400 truncate">{l.body ? l.body.slice(0, 60) : String(l.id || '').slice(0, 12)}</p>
                      {l.status === 'failed' && l.failure_reason && (
                        <p className="text-[10px] text-red-500 truncate">⚠ {l.failure_reason}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5"><ChannelChip channel={l.channel} /></td>
                    <td className="px-3 py-2.5 max-w-[140px]">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{l.recipient_name || '—'}</p>
                      {l.recipient_contact && <p className="text-[10px] text-slate-400 truncate">{l.recipient_contact}</p>}
                    </td>
                    <td className="px-3 py-2.5 max-w-[130px]">
                      <p className="text-xs text-slate-600 dark:text-slate-300 truncate">{prettyEvent(l.event_type)}</p>
                      {l.category && <p className="text-[10px] text-slate-400 capitalize">{l.category}</p>}
                    </td>
                    <td className="px-3 py-2.5"><StatusBadge status={l.status} /></td>
                    <td className="px-3 py-2.5"><TimeCell iso={l.created_at} /></td>
                    <td className="px-3 py-2.5"><TimeCell iso={l.sent_at} /></td>
                    <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setDrawer(l)} title="View details" aria-label="View details"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                          <Eye size={13} />
                        </button>
                        <button onClick={() => doCopy(l)} title="Copy message" aria-label="Copy message"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-[var(--ap-surface-2)] transition-colors">
                          <Copy size={13} />
                        </button>
                        {l.channel === 'whatsapp' && l.recipient_contact && (
                          <button onClick={() => openWhatsApp(l.recipient_contact, `${l.subject || ''}\n${l.body || ''}`.trim())}
                            title="Open in WhatsApp" aria-label="Open in WhatsApp"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                            <ExternalLink size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {/* Mobile cards */}
        <div className="space-y-2 md:hidden">
          {pageRows.map((l, i) => (
            <div key={l.id || i} onClick={() => setDrawer(l)}
              className="ap-surface rounded-2xl p-3.5 cursor-pointer active:scale-[0.99] transition-transform">
              <div className="flex items-center gap-2 mb-1.5">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate flex-1">{l.subject || prettyEvent(l.event_type)}</p>
                <StatusBadge status={l.status} />
              </div>
              <p className="text-[11px] text-slate-400 truncate mb-2">{l.body ? l.body.slice(0, 80) : String(l.id || '')}</p>
              {l.status === 'failed' && l.failure_reason && (
                <p className="text-[11px] text-red-500 truncate mb-2">⚠ {l.failure_reason}</p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <ChannelChip channel={l.channel} />
                <span className="text-[10px] text-slate-400 truncate">{l.recipient_name || '—'}</span>
                <span className="text-[10px] text-slate-400 ml-auto tabular-nums">{fmtDT(l.created_at)?.date || '—'}</span>
              </div>
            </div>
          ))}
        </div>
        <Pager page={safePage} totalPages={totalPages} total={filtered.length} pageSize={LOG_PAGE_SIZE} onPage={setPage} />
      </>)}

      {/* Detail drawer */}
      {drawer && (
        <Drawer title="Communication Details" sub={`${drawer.subject || prettyEvent(drawer.event_type)}`}
          onClose={() => setDrawer(null)}
          actions={<>
            <button onClick={() => doCopy(drawer)}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-[var(--ap-border)] text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-[var(--ap-surface-2)] transition-colors">
              <Copy size={13} /> {copied ? 'Copied!' : 'Copy'}
            </button>
            {drawer.channel === 'whatsapp' && drawer.recipient_contact && (
              <button onClick={() => openWhatsApp(drawer.recipient_contact, `${drawer.subject || ''}\n${drawer.body || ''}`.trim())}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-all active:scale-95">
                <ExternalLink size={13} /> WhatsApp
              </button>
            )}
            <button onClick={() => setDrawer(null)}
              className="flex-1 py-2.5 rounded-xl bg-[var(--ap-accent)] text-white text-xs font-bold hover:opacity-90 transition-all">
              Close
            </button>
          </>}>
          <div className="flex items-center gap-2">
            <StatusBadge status={drawer.status} />
            <ChannelChip channel={drawer.channel} />
          </div>
          {drawer.status === 'failed' && (
            <div className="bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800/30 rounded-xl px-3.5 py-3">
              <p className="text-xs font-semibold text-red-600 dark:text-red-400">Delivery failed</p>
              <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">Reason: {drawer.failure_reason || 'Unknown'}</p>
              <p className="text-[10px] text-red-500/70 dark:text-red-400/60 mt-1">No automatic retry is configured — copy the message or follow up on {drawer.channel || 'the channel'} manually.</p>
            </div>
          )}
          <div>
            <SectionTitle>Message Info</SectionTitle>
            <MetaGrid items={[
              { label: 'Message ID', value: <span className="font-mono text-[10px]">{drawer.id || '—'}</span> },
              { label: 'Trigger', value: prettyEvent(drawer.event_type) },
              { label: 'Category', value: <span className="capitalize">{drawer.category || '—'}</span> },
              { label: 'Priority', value: <span className="capitalize">{drawer.priority || 'medium'}</span> },
              { label: 'Created At', value: drawer.created_at ? `${fmtDT(drawer.created_at).date} ${fmtDT(drawer.created_at).time}` : '—' },
              { label: 'Delivered At', value: drawer.sent_at ? `${fmtDT(drawer.sent_at).date} ${fmtDT(drawer.sent_at).time}` : '—' },
              { label: 'Recipient', value: drawer.recipient_name || '—' },
            ]} />
          </div>
          <div>
            <SectionTitle>Message Content</SectionTitle>
            <div className="bg-[var(--ap-surface-2)] rounded-xl px-3.5 py-3 border border-[var(--ap-border)]">
              <p className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words">{drawer.body || drawer.subject || '—'}</p>
            </div>
          </div>
          <div>
            <SectionTitle>Delivery Information</SectionTitle>
            <MetaGrid items={[
              { label: 'Contact', value: drawer.recipient_contact || '—' },
              { label: 'Recipient Type', value: <span className="capitalize">{drawer.recipient_type || '—'}</span> },
              { label: 'Related', value: drawer.related_entity_type ? `${drawer.related_entity_type} · ${String(drawer.related_entity_id || '').slice(0, 14)}` : '—' },
              { label: 'Scheduled For', value: drawer.scheduled_at ? `${fmtDT(drawer.scheduled_at).date} ${fmtDT(drawer.scheduled_at).time}` : '—' },
              ...(drawer.failure_reason ? [{ label: 'Error Message', value: drawer.failure_reason }] : []),
              ...((drawer.metadata && typeof drawer.metadata === 'object' && Object.keys(drawer.metadata).length)
                ? Object.entries(drawer.metadata).slice(0, 6).map(([k, v]) => ({ label: k, value: String(v).slice(0, 40) }))
                : []),
            ]} />
          </div>
          <div>
            <SectionTitle>Recipients (1)</SectionTitle>
            <div className="flex items-center gap-2.5 bg-[var(--ap-surface-2)] rounded-xl px-3 py-2.5 border border-[var(--ap-border)]">
              <div className="w-8 h-8 rounded-full bg-[var(--ap-surface-2)] flex items-center justify-center text-xs font-semibold text-slate-700 dark:text-slate-200 flex-shrink-0">
                {(drawer.recipient_name || '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{drawer.recipient_name || '—'}</p>
                <p className="text-[10px] text-slate-400 truncate">{drawer.recipient_contact || '—'}</p>
              </div>
              <StatusBadge status={drawer.status} />
            </div>
          </div>
        </Drawer>
      )}
    </div>
  )
}

// ── Scheduled Tab ─────────────────────────────────────────────
// Upcoming system automations (trip reminders, expiry reminders, summaries).
// Jobs carry type + run time + payload only: no channel, recipients, message
// body, edit or pause exist in the backend — so the UI shows exactly that,
// with the one real action available (Cancel). No fake scheduling form.
const SCHED_PAGE_SIZE = 10
const SCHED_STATUS = {
  scheduled: { label: 'Scheduled', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  active:    { label: 'Active',    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  overdue:   { label: 'Overdue',   badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
}
function schedStatus(job) {
  if (job.recurring) return 'active'
  if (job.runAt && new Date(job.runAt).getTime() < Date.now()) return 'overdue'
  return 'scheduled'
}
function schedDetail(payload = {}) {
  if (payload.bookingId) return `Booking ${payload.bookingId}`
  if (payload.docType || payload.entityId)
    return `${prettyEvent(payload.docType)}${payload.daysLeft != null ? ` — ${payload.daysLeft}d left` : ''}${payload.expiryDate ? ` · exp ${payload.expiryDate}` : ''}`
  if (payload.auto) return 'Automatic summary'
  const keys = Object.keys(payload)
  return keys.length ? keys.slice(0, 2).map(k => `${k}: ${String(payload[k]).slice(0, 20)}`).join(' · ') : 'System automation'
}
function schedRepeat(job) {
  if (!job.recurring) return 'Once'
  const h = (job.intervalMs || 0) / 3600000
  if (h >= 24 && h % 24 === 0) return `Every ${h / 24}d`
  return `Every ${Math.round(h * 10) / 10}h`
}
function ScheduledTab() {
  const { scheduledJobs, setScheduledJobs } = useCommunicationCtx()
  const [search, setSearch] = useState('')
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [drawer, setDrawer] = useState(null)

  const refresh = () => setScheduledJobs([...scheduler.getJobs()])
  useEffect(() => { refresh() }, [])
  useEffect(() => { setPage(1) }, [search, type, status])

  const types = useMemo(() => [...new Set(scheduledJobs.map(j => j.type).filter(Boolean))].sort(), [scheduledJobs])

  const filtered = useMemo(() => scheduledJobs.filter(j => {
    if (type !== 'all' && j.type !== type) return false
    if (status !== 'all' && schedStatus(j) !== status) return false
    if (search) {
      const q = search.toLowerCase()
      if (![j.id, j.type, schedDetail(j.payload)].some(v => String(v ?? '').toLowerCase().includes(q))) return false
    }
    return true
  }), [scheduledJobs, type, status, search])

  const now = Date.now()
  const sod = new Date(); sod.setHours(0, 0, 0, 0)
  const eod = sod.getTime() + 86400000
  const kTotal = scheduledJobs.length
  const kToday = scheduledJobs.filter(j => !j.recurring && j.runAt && new Date(j.runAt).getTime() >= sod.getTime() && new Date(j.runAt).getTime() < eod).length
  const k24 = scheduledJobs.filter(j => !j.recurring && j.runAt && new Date(j.runAt).getTime() >= now && new Date(j.runAt).getTime() < now + 86400000).length
  const kRecurring = scheduledJobs.filter(j => j.recurring).length

  const totalPages = Math.max(1, Math.ceil(filtered.length / SCHED_PAGE_SIZE))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const pageRows = filtered.slice((safePage - 1) * SCHED_PAGE_SIZE, safePage * SCHED_PAGE_SIZE)

  const selCls = 'px-3 py-2 text-xs rounded-lg border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-700 dark:text-slate-200 focus:outline-none max-w-[150px]'
  const hasFilters = search || type !== 'all' || status !== 'all'

  const handleCancel = (job) => {
    if (!window.confirm(`Cancel scheduled ${prettyEvent(job.type)} (${job.id})?`)) return
    scheduler.cancel(job.id)
    refresh()
    if (drawer?.id === job.id) setDrawer(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <h3 className="font-sf font-semibold text-slate-800 dark:text-white text-base">Scheduled Communications</h3>
          <p className="text-xs text-slate-400 mt-0.5">Manage upcoming messages and automated notifications</p>
        </div>
        <button onClick={refresh} title="Refresh" aria-label="Refresh schedules"
          className="w-8 h-8 rounded-lg border border-[var(--ap-border)] flex items-center justify-center text-slate-400 hover:bg-[var(--ap-surface-2)] transition-colors">
          <RefreshCw size={13} />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi icon="🗓️" value={kTotal} label="SCHEDULED" sub="Upcoming jobs" tone="navy" />
        <Kpi icon="📌" value={kToday} label="TODAY" sub="Runs due today" tone="amber" />
        <Kpi icon="⏰" value={k24} label="NEXT 24 HOURS" sub="Due within a day" tone="violet" />
        <Kpi icon="🔁" value={kRecurring} label="RECURRING" sub="Active automations" tone="green" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--ap-border)] bg-[var(--ap-surface-2)] flex-1 min-w-[180px] max-w-xs">
          <Search size={13} className="text-slate-400 flex-shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search scheduled messages…"
            className="bg-transparent text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none w-full" />
        </div>
        <select value={type} onChange={e => setType(e.target.value)} className={selCls}>
          <option value="all">All Types</option>
          {types.map(t => <option key={t} value={t}>{prettyEvent(t)}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className={selCls}>
          <option value="all">All Status</option>
          <option value="scheduled">Scheduled</option>
          <option value="active">Active</option>
          <option value="overdue">Overdue</option>
        </select>
        {hasFilters && (
          <button onClick={() => { setSearch(''); setType('all'); setStatus('all') }}
            className="px-3 py-2 text-xs font-bold rounded-lg text-slate-500 hover:bg-[var(--ap-surface-2)] transition-colors">
            Clear
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="🗓️" title={hasFilters ? 'No schedules match these filters' : 'No scheduled communications'}
          sub={hasFilters ? 'Try clearing search or choosing a different filter.' : 'Schedules are created automatically when bookings, documents, or trips are added.'} />
      ) : (<>
        <div className="ap-surface rounded-2xl overflow-hidden hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="bg-[var(--ap-surface-2)]/95 border-b border-[var(--ap-border)]">
                  {['#', 'Schedule', 'Detail', 'Scheduled For', 'Repeat', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((j, i) => {
                  const st = schedStatus(j)
                  return (
                    <tr key={j.id || i} onClick={() => setDrawer(j)}
                      className="border-b border-[var(--ap-border)] hover:bg-[var(--ap-surface-2)] transition-colors cursor-pointer">
                      <td className="px-3 py-2.5 text-xs text-slate-400 tabular-nums">{(safePage - 1) * SCHED_PAGE_SIZE + i + 1}</td>
                      <td className="px-3 py-2.5 max-w-[200px]">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{prettyEvent(j.type)}</p>
                        <p className="text-[10px] font-mono text-slate-400 truncate">{j.id}</p>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300 max-w-[200px] truncate">{schedDetail(j.payload)}</td>
                      <td className="px-3 py-2.5">
                        {j.recurring
                          ? <span className="text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">{schedRepeat(j)}</span>
                          : <TimeCell iso={j.runAt} />}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">{schedRepeat(j)}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${SCHED_STATUS[st].badge}`}>{SCHED_STATUS[st].label}</span>
                      </td>
                      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setDrawer(j)} title="View details" aria-label="View details"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                            <Eye size={13} />
                          </button>
                          <button onClick={() => handleCancel(j)} title="Cancel schedule" aria-label="Cancel schedule"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <XCircle size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="space-y-2 md:hidden">
          {pageRows.map((j, i) => {
            const st = schedStatus(j)
            return (
              <div key={j.id || i} onClick={() => setDrawer(j)}
                className="ap-surface rounded-2xl p-3.5 cursor-pointer active:scale-[0.99] transition-transform">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate flex-1">{prettyEvent(j.type)}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${SCHED_STATUS[st].badge}`}>{SCHED_STATUS[st].label}</span>
                </div>
                <p className="text-[11px] text-slate-400 truncate mb-1.5">{schedDetail(j.payload)}</p>
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <Clock size={10} />
                  <span>{j.recurring ? schedRepeat(j) : (fmtDT(j.runAt) ? `${fmtDT(j.runAt).date} ${fmtDT(j.runAt).time}` : '—')}</span>
                  <span className="ml-auto">{schedRepeat(j)}</span>
                </div>
              </div>
            )
          })}
        </div>
        <Pager page={safePage} totalPages={totalPages} total={filtered.length} pageSize={SCHED_PAGE_SIZE} onPage={setPage} />
      </>)}

      {drawer && (
        <Drawer title="Schedule Details" sub={prettyEvent(drawer.type)}
          onClose={() => setDrawer(null)}
          actions={<>
            <button onClick={() => handleCancel(drawer)}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-500 transition-all active:scale-95">
              <XCircle size={13} /> Cancel Schedule
            </button>
            <button onClick={() => setDrawer(null)}
              className="flex-1 py-2.5 rounded-xl bg-[var(--ap-accent)] text-white text-xs font-bold hover:opacity-90 transition-all">
              Close
            </button>
          </>}>
          <div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${SCHED_STATUS[schedStatus(drawer)].badge}`}>
              {SCHED_STATUS[schedStatus(drawer)].label}
            </span>
          </div>
          <div>
            <SectionTitle>Schedule Info</SectionTitle>
            <MetaGrid items={[
              { label: 'Schedule ID', value: <span className="font-mono text-[10px]">{drawer.id || '—'}</span> },
              { label: 'Type', value: prettyEvent(drawer.type) },
              { label: 'Scheduled', value: drawer.recurring ? schedRepeat(drawer) : (drawer.runAt && fmtDT(drawer.runAt) ? `${fmtDT(drawer.runAt).date} ${fmtDT(drawer.runAt).time}` : '—') },
              { label: 'Repeat', value: schedRepeat(drawer) },
              { label: 'Detail', value: schedDetail(drawer.payload) },
              { label: 'Status', value: SCHED_STATUS[schedStatus(drawer)].label },
            ]} />
          </div>
          <div>
            <SectionTitle>Trigger Payload</SectionTitle>
            <div className="bg-[var(--ap-surface-2)] rounded-xl px-3.5 py-3 border border-[var(--ap-border)]">
              {drawer.payload && Object.keys(drawer.payload).length ? (
                <div className="space-y-1">
                  {Object.entries(drawer.payload).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 text-xs">
                      <span className="text-slate-400 capitalize flex-shrink-0">{k.replace(/_/g, ' ')}</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200 text-right break-all">{String(v)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No payload attached.</p>
              )}
            </div>
          </div>
          <p className="text-[10px] text-slate-400">
            System automation — cancelling stops future runs. Completed runs are removed automatically.
          </p>
        </Drawer>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function Communications() {
  const [tab, setTab] = useState('notifications')
  const { unreadCount } = useCommunicationCtx()

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Communications"
        subtitle="Notification center, delivery logs, and channel analytics"
        action={
          <a href="/communications-settings"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-[var(--ap-surface-2)] transition-colors">
            <Settings size={15}/> Settings
          </a>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--ap-surface-2)] rounded-xl p-1 overflow-x-auto no-scrollbar w-fit">
        {TABS.map(t=>{
          const { Icon } = t
          return (
            <button key={t.key} onClick={()=>setTab(t.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                tab===t.key?'bg-[var(--ap-surface-elevated)] text-slate-900 dark:text-white shadow':'text-slate-500 dark:text-slate-400'
              }`}>
              <Icon size={12}/>
              {t.label}
              {t.key==='notifications'&&unreadCount>0&&(
                <span className="text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded-full">{unreadCount}</span>
              )}
            </button>
          )
        })}
      </div>

      {tab==='notifications' && <NotificationsTab/>}
      {tab==='logs'          && <CommLogsTab/>}
      {tab==='schedule'      && <ScheduledTab/>}
    </div>
  )
}

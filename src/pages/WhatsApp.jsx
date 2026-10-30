// ─── WhatsApp inbox ───────────────────────────────────────────
// Staff read and answer customers' WhatsApp chats. The bot answers
// automatically; "Talk to staff" pauses it and flags needs_staff.
// Reads go straight to Supabase (RLS: staff SELECT, UPDATE on
// conversations only); replies / resume go through the Netlify
// function POST /api/whatsapp/send with the staff session token.
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  MessageCircle, Search, Phone, ArrowLeft, Send, Bot, AlertTriangle,
  Check, CheckCheck, Clock, AlertCircle, RefreshCw, Inbox,
} from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import Callout from '../components/ui/Callout'
import EmptyState from '../components/ui/EmptyState'
import StatusPill from '../components/ui/StatusPill'
import SegmentedControl from '../components/ui/SegmentedControl'
import { fieldCls } from '../components/ui/Field'
import supabase from '../lib/supabase'
import {
  formatPhone, displayName, isWithinReplyWindow, isBotPaused, senderLabel,
  statusLabel, mergeThread, upsertById, sortConversations, filterConversations,
  shortTime, latestByPhone,
} from '../utils/whatsappInbox'

const SEND_PATH = '/api/whatsapp/send'
const THREAD_LIMIT = 200

// Same pattern as the GPS proxy: attach the Supabase session JWT.
async function authHeader() {
  if (!supabase) return {}
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function postSend(payload) {
  let res
  try {
    res = await fetch(SEND_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    return { ok: false, status: 0, data: { error: err?.message || 'Network error — could not reach the server' } }
  }
  const text = await res.text().catch(() => '')
  let data = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = {} }
  if (!res.ok && !data.error) {
    data = { ...data, error: `Server error ${res.status}${res.status === 404 ? ' — the WhatsApp function is not available here (it runs on Netlify)' : ''}` }
  }
  return { ok: res.ok, status: res.status, data }
}

// ── Small pieces ──────────────────────────────────────────────
function StatusTick({ status }) {
  const s = String(status || 'queued').toLowerCase()
  const label = statusLabel(s)
  let Icon = Clock
  let cls = 'text-white/70'
  if (s === 'sent') Icon = Check
  else if (s === 'delivered') Icon = CheckCheck
  else if (s === 'read') { Icon = CheckCheck; cls = 'text-sky-200' }
  else if (s === 'failed') { Icon = AlertCircle; cls = 'text-red-200' }
  return (
    <span className={`inline-flex items-center gap-0.5 ${cls}`} title={label}>
      <Icon size={12} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  )
}

function ConversationRow({ conv, preview, active, now, onOpen }) {
  const name = displayName(conv)
  const unread = Number(conv.unread) || 0
  const paused = isBotPaused(conv.bot_paused_until, now)
  return (
    <button type="button" onClick={() => onOpen(conv.phone)}
      aria-current={active ? 'true' : undefined}
      className={`ap-focus w-full text-left px-3 py-2.5 flex items-start gap-2.5 rounded-xl transition-colors ${
        active ? 'bg-slate-500/10 dark:bg-white/10' : 'hover:bg-[var(--ap-surface-2)]'}`}>
      <Avatar name={conv.contact_name || name.replace(/\D/g, '').slice(-2)} size={36} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`flex-1 truncate text-sm ${unread ? 'font-bold text-slate-900 dark:text-white' : 'font-semibold text-slate-800 dark:text-slate-100'}`}>{name}</p>
          <span className={`text-[11px] tabular-nums flex-shrink-0 ${unread ? 'text-[var(--ap-accent)] font-semibold' : 'text-slate-400 dark:text-slate-500'}`}>
            {shortTime(conv.last_message_at, now)}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="flex-1 truncate text-xs text-slate-500 dark:text-slate-400">
            {preview
              ? `${preview.direction === 'out' ? 'You: ' : ''}${preview.text}`
              : (conv.contact_name ? formatPhone(conv.phone) : '')}
          </p>
          {unread > 0 && (
            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--ap-accent)] text-white text-[11px] font-bold inline-flex items-center justify-center flex-shrink-0"
              aria-label={`${unread} unread`}>{unread > 99 ? '99+' : unread}</span>
          )}
        </div>
        {(conv.needs_staff || paused) && (
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {conv.needs_staff && <StatusPill tone="amber">Needs staff</StatusPill>}
            {paused && <StatusPill tone="gray">Bot paused</StatusPill>}
          </div>
        )}
      </div>
    </button>
  )
}

function Bubble({ item, now }) {
  const out = item.direction === 'out'
  const row = item.row
  const failed = out && String(row.status).toLowerCase() === 'failed'
  let who = ''
  if (out) {
    who = senderLabel(row.kind)
    if (who === 'Trip message' && row.template_name) who = `${who} · ${row.template_name}`
  }
  return (
    <div className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] sm:max-w-[70%] flex flex-col ${out ? 'items-end' : 'items-start'}`}>
        {out && who && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-0.5 px-1">{who}</span>
        )}
        <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
          out
            ? `${failed ? 'bg-red-600' : 'bg-[var(--ap-accent)]'} text-white rounded-br-md`
            : 'bg-[var(--ap-surface-2)] text-slate-800 dark:text-slate-100 rounded-bl-md border border-[var(--ap-border)]'}`}>
          {item.text || <span className="italic opacity-70">(no text)</span>}
          <span className={`flex items-center justify-end gap-1 mt-0.5 text-[10px] tabular-nums ${out ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>
            {shortTime(item.at, now)}
            {out && <StatusTick status={row.status} />}
          </span>
        </div>
        {failed && row.error && (
          <span className="text-[11px] text-red-600 dark:text-red-400 mt-0.5 px-1">{row.error}</span>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────
export default function WhatsApp() {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [previews, setPreviews] = useState({})

  const [inbound, setInbound] = useState([])
  const [outbound, setOutbound] = useState([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [threadError, setThreadError] = useState('')

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [resuming, setResuming] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const selectedRef = useRef(null)
  const threadEndRef = useRef(null)
  useEffect(() => { selectedRef.current = selected }, [selected])

  // Re-evaluate the 24 h window / bot pause as time passes.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  // ── Loaders ─────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    if (!supabase) {
      setLoadError('Supabase is not configured — the WhatsApp inbox needs the database.')
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(500)
    if (error) {
      setLoadError(error.message || 'Could not load WhatsApp chats')
    } else {
      setLoadError('')
      setConversations(data || [])
    }
    setLoading(false)

    // List previews: latest message per phone from the most recent rows.
    const [inRes, outRes] = await Promise.all([
      supabase.from('whatsapp_inbound_messages')
        .select('id,from_phone,text_body,message_type,received_at')
        .order('received_at', { ascending: false }).limit(500),
      supabase.from('whatsapp_outbound_messages')
        .select('id,to_phone,body,template_name,created_at')
        .order('created_at', { ascending: false }).limit(500),
    ])
    if (!inRes.error && !outRes.error) setPreviews(latestByPhone(inRes.data, outRes.data))
  }, [])

  const loadThread = useCallback(async (phone) => {
    if (!supabase || !phone) return
    setThreadLoading(true)
    setThreadError('')
    const [inRes, outRes] = await Promise.all([
      supabase.from('whatsapp_inbound_messages').select('*')
        .eq('from_phone', phone).order('received_at', { ascending: false }).limit(THREAD_LIMIT),
      supabase.from('whatsapp_outbound_messages').select('*')
        .eq('to_phone', phone).order('created_at', { ascending: false }).limit(THREAD_LIMIT),
    ])
    if (selectedRef.current !== phone) return // user moved on
    if (inRes.error || outRes.error) {
      setThreadError((inRes.error || outRes.error).message || 'Could not load messages')
    } else {
      setInbound(inRes.data || [])
      setOutbound(outRes.data || [])
    }
    setThreadLoading(false)
  }, [])

  const markRead = useCallback(async (phone) => {
    if (!supabase || !phone) return
    setConversations(prev => prev.map(c => c.phone === phone ? { ...c, unread: 0 } : c))
    const { error } = await supabase.from('whatsapp_conversations').update({ unread: 0 }).eq('phone', phone)
    if (error) console.warn('[WhatsApp] mark read failed:', error.message)
  }, [])

  useEffect(() => { loadConversations() }, [loadConversations])

  // ── Realtime ────────────────────────────────────────────────
  useEffect(() => {
    if (!supabase) return undefined
    const onConversation = (payload) => {
      const row = payload.new
      if (!row?.phone) return
      setConversations(prev => {
        const i = prev.findIndex(c => c.phone === row.phone)
        if (i === -1) return [...prev, row]
        const next = prev.slice()
        next[i] = { ...prev[i], ...row }
        return next
      })
      // A new customer message in the open thread: keep it read.
      if (row.phone === selectedRef.current && Number(row.unread) > 0 && document.visibilityState === 'visible') {
        markRead(row.phone)
      }
    }
    const onInbound = (payload) => {
      const row = payload.new
      if (!row?.from_phone) return
      setPreviews(prev => latestByPhone([row], [], prev))
      if (row.from_phone === selectedRef.current) setInbound(prev => upsertById(prev, row))
    }
    const onOutbound = (payload) => {
      const row = payload.new
      if (!row?.to_phone) return
      if (payload.eventType === 'INSERT') setPreviews(prev => latestByPhone([], [row], prev))
      if (row.to_phone === selectedRef.current) setOutbound(prev => upsertById(prev, row))
    }
    const channel = supabase
      .channel('web-whatsapp-inbox')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_conversations' }, onConversation)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'whatsapp_conversations' }, onConversation)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_inbound_messages' }, onInbound)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'whatsapp_inbound_messages' }, onInbound)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_outbound_messages' }, onOutbound)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'whatsapp_outbound_messages' }, onOutbound)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [markRead])

  // ── Open a thread ───────────────────────────────────────────
  const openThread = useCallback((phone) => {
    selectedRef.current = phone
    setSelected(phone)
    setInbound([])
    setOutbound([])
    setDraft('')
    setSendError('')
    loadThread(phone)
    markRead(phone)
  }, [loadThread, markRead])

  const closeThread = () => { selectedRef.current = null; setSelected(null) }

  // ── Derived ─────────────────────────────────────────────────
  const sorted = useMemo(() => sortConversations(conversations), [conversations])
  const visible = useMemo(() => filterConversations(sorted, { filter, query }), [sorted, filter, query])
  const counts = useMemo(() => ({
    needs: conversations.filter(c => c.needs_staff).length,
    unread: conversations.filter(c => Number(c.unread) > 0).length,
  }), [conversations])
  const conv = useMemo(() => conversations.find(c => c.phone === selected) || null, [conversations, selected])
  const thread = useMemo(() => mergeThread(inbound, outbound), [inbound, outbound])
  const canReply = conv ? isWithinReplyWindow(conv.last_inbound_at, now) : false
  const paused = conv ? isBotPaused(conv.bot_paused_until, now) : false

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: 'end' })
  }, [thread.length, selected])

  // ── Actions ─────────────────────────────────────────────────
  const send = async () => {
    const text = draft.trim()
    if (!text || !conv || sending) return
    setSending(true)
    setSendError('')
    const { ok, data } = await postSend({ action: 'reply', phone: conv.phone, text })
    if (data?.message?.id != null && data.message.to_phone === selectedRef.current) {
      setOutbound(prev => upsertById(prev, data.message))
      setPreviews(prev => latestByPhone([], [data.message], prev))
    }
    if (ok) {
      setDraft('')
    } else {
      setSendError(data?.error || 'Message was not sent')
    }
    setSending(false)
  }

  const resumeBot = async () => {
    if (!conv || resuming) return
    setResuming(true)
    setSendError('')
    const phone = conv.phone
    const { ok, data } = await postSend({ action: 'resume_bot', phone })
    if (ok) {
      setConversations(prev => prev.map(c => c.phone === phone
        ? { ...c, bot_paused_until: null, needs_staff: false } : c))
    } else {
      setSendError(data?.error || 'Could not resume the bot')
    }
    setResuming(false)
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  const filterOptions = [
    { key: 'all', label: 'All' },
    { key: 'needs_staff', label: counts.needs ? `Needs staff (${counts.needs})` : 'Needs staff' },
    { key: 'unread', label: counts.unread ? `Unread (${counts.unread})` : 'Unread' },
  ]

  // ── Render ──────────────────────────────────────────────────
  const listPane = (
    <section aria-label="WhatsApp chats"
      className={`ap-surface rounded-2xl flex-col min-h-0 overflow-hidden ${selected ? 'hidden lg:flex' : 'flex'}`}>
      <div className="p-3 space-y-2 border-b border-[var(--ap-border)]">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
          <input type="search" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search name or phone" aria-label="Search chats"
            className={`${fieldCls} h-10 pl-9`} />
        </div>
        <SegmentedControl options={filterOptions} value={filter} onChange={setFilter} ariaLabel="Filter chats" scroll />
      </div>
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {loading ? (
          <div role="status" aria-busy="true" aria-label="Loading chats" className="space-y-1.5 p-1.5">
            <span className="sr-only">Loading chats…</span>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-2.5 p-2" aria-hidden="true">
                <div className="skeleton w-9 h-9 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton h-3.5 w-1/2 rounded" />
                  <div className="skeleton h-3 w-3/4 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 && !loadError ? (
          <EmptyState icon={Inbox} title="No WhatsApp chats yet"
            description="Messages to the business number appear here." />
        ) : visible.length === 0 && !loadError ? (
          <EmptyState icon={Search} title="No chats match"
            description="Try a different search or filter." />
        ) : (
          visible.map(c => (
            <ConversationRow key={c.phone} conv={c} preview={previews[c.phone]} active={c.phone === selected} now={now} onOpen={openThread} />
          ))
        )}
      </div>
    </section>
  )

  const threadPane = (
    <section aria-label="Conversation"
      className={`ap-surface rounded-2xl flex-col min-h-0 overflow-hidden ${selected ? 'flex' : 'hidden lg:flex'}`}>
      {!conv ? (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState icon={MessageCircle} title="Select a chat"
            description="Pick a conversation on the left to read and reply." />
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-[var(--ap-border)]">
            <button type="button" onClick={closeThread} aria-label="Back to chats"
              className="ap-focus lg:hidden w-9 h-9 rounded-[5px] inline-flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-500/10">
              <ArrowLeft size={18} />
            </button>
            <Avatar name={conv.contact_name || displayName(conv).replace(/\D/g, '').slice(-2)} size={36} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{displayName(conv)}</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {conv.contact_name && <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{formatPhone(conv.phone)}</span>}
                {conv.needs_staff && <StatusPill tone="amber">Needs staff</StatusPill>}
                {paused && <StatusPill tone="gray">Bot paused</StatusPill>}
              </div>
            </div>
            <a href={`tel:+${conv.phone}`}
              className="ap-focus inline-flex items-center gap-1.5 text-[13px] font-semibold px-3 min-h-[34px] rounded-[5px] border border-[var(--ap-border)] text-slate-700 dark:text-slate-200 bg-[var(--ap-surface-2)] hover:border-[var(--ap-accent)] transition-colors">
              <Phone size={14} /> <span className="hidden sm:inline">Call</span>
            </a>
            {paused && (
              <Button size="sm" variant="secondary" icon={Bot} onClick={resumeBot} disabled={resuming}>
                {resuming ? 'Resuming…' : 'Resume bot'}
              </Button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2" aria-live="polite">
            {threadError ? (
              <Callout tone="red" icon={AlertTriangle} title={threadError}
                actionLabel="Retry" onAction={() => loadThread(conv.phone)} />
            ) : threadLoading && thread.length === 0 ? (
              <div role="status" aria-busy="true" className="space-y-2">
                <span className="sr-only">Loading messages…</span>
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className={`flex ${i % 2 ? 'justify-end' : 'justify-start'}`} aria-hidden="true">
                    <div className={`skeleton h-10 rounded-2xl ${i % 2 ? 'w-2/5' : 'w-1/2'}`} />
                  </div>
                ))}
              </div>
            ) : thread.length === 0 ? (
              <EmptyState icon={MessageCircle} title="No messages yet" />
            ) : (
              thread.map(item => <Bubble key={item.key} item={item} now={now} />)
            )}
            <div ref={threadEndRef} />
          </div>

          {/* Reply box */}
          <div className="border-t border-[var(--ap-border)] p-3 space-y-2">
            {!canReply && (
              <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                More than 24 hours since the customer wrote — WhatsApp allows only template messages now.
              </p>
            )}
            {sendError && (
              <p role="alert" className="text-xs text-red-700 dark:text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                {sendError}
              </p>
            )}
            <div className="flex items-end gap-2">
              <textarea value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={onKeyDown}
                rows={2} maxLength={4096} disabled={!canReply || sending}
                placeholder={canReply ? 'Type a reply… (Enter to send, Shift+Enter for a new line)' : 'Replies are closed for this chat'}
                aria-label="Reply message"
                className={`${fieldCls} h-auto min-h-[44px] max-h-40 py-2.5 leading-relaxed resize-none flex-1 disabled:opacity-60 disabled:cursor-not-allowed`} />
              <Button icon={sending ? RefreshCw : Send} onClick={send}
                disabled={!canReply || sending || !draft.trim()} aria-label="Send reply">
                <span className="hidden sm:inline">{sending ? 'Sending…' : 'Send'}</span>
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  )

  return (
    <div className="space-y-3 animate-fade-up">
      <PageHeader compact icon={MessageCircle}
        title="WhatsApp"
        subtitle={loading ? 'Loading chats…' : `${conversations.length} chat${conversations.length !== 1 ? 's' : ''}${counts.needs ? ` · ${counts.needs} need staff` : ''}`}
        action={<Button size="sm" variant="outline" icon={RefreshCw} onClick={() => { loadConversations(); if (selected) loadThread(selected) }}>Refresh</Button>}
      />

      {loadError && (
        <Callout tone="red" icon={AlertTriangle} title={loadError} actionLabel="Retry"
          onAction={() => { setLoading(true); loadConversations() }} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-3 h-[calc(100dvh-12rem)] min-h-[460px]">
        {listPane}
        {threadPane}
      </div>
    </div>
  )
}

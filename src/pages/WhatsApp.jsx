// ─── WhatsApp inbox ───────────────────────────────────────────
// Staff read and answer customers' WhatsApp chats. The bot answers
// automatically; "Talk to staff" pauses it and flags needs_staff.
// Reads go straight to Supabase (RLS: staff SELECT, UPDATE on
// conversations only); replies / resume go through the Netlify
// function POST /api/whatsapp/send with the staff session token.
//
// Visual language follows the official WhatsApp Web 2025 layout:
// white chat list, filter pills, beige doodle wallpaper, mint
// outgoing bubbles, blue read ticks, floating composer pill.
import { Fragment, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  MessageCircle, Search, Phone, ArrowLeft, Send, Bot, AlertTriangle,
  Check, CheckCheck, Clock, AlertCircle, RefreshCw, Inbox, Info, X, Smile,
  Image as ImageIcon, FileText, MapPin, Mic, Sticker, User, Lock, ExternalLink,
  Video, MousePointerClick, Plane, CarFront, Luggage, Compass, Navigation, Camera,
} from 'lucide-react'
import Avatar from '../components/ui/Avatar'
import supabase from '../lib/supabase'
import {
  formatPhone, displayName, isWithinReplyWindow, isBotPaused, senderLabel,
  statusLabel, mergeThread, upsertById, sortConversations, filterConversations,
  shortTime, latestByPhone, dateDividerLabel, groupThread, REPLY_WINDOW_MS,
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

const EMOJIS = [
  '👍', '🙏', '✅', '👌', '🤝', '🙂', '😊', '😅',
  '🚕', '🛺', '🚗', '🛣️', '⛽', '📍', '🕒', '📄',
  '🧾', '💰', '📞', '☎️', '🎉', '✨', '❤️', '➡️',
]

const MEDIA = {
  image: [ImageIcon, 'Photo'],
  video: [Video, 'Video'],
  audio: [Mic, 'Voice message'],
  document: [FileText, 'Document'],
  location: [MapPin, 'Location'],
  sticker: [Sticker, 'Sticker'],
  contacts: [User, 'Contact'],
  button: [MousePointerClick, 'Button reply'],
  interactive: [MousePointerClick, 'Reply'],
}

// Scattered line drawings: an original travel-themed take on the
// WhatsApp doodle wallpaper (no brand artwork is copied).
const DOODLES = [
  [Plane, '6%', '7%', 38, -14], [Compass, '19%', '74%', 30, 9],
  [Luggage, '33%', '11%', 27, -6], [MapPin, '45%', '63%', 25, 12],
  [CarFront, '58%', '18%', 34, 5], [Navigation, '71%', '81%', 29, -18],
  [Camera, '82%', '34%', 26, 8], [MessageCircle, '12%', '42%', 24, -9],
  [Phone, '88%', '66%', 22, 14], [FileText, '64%', '48%', 21, -4],
  [Plane, '93%', '9%', 31, 22], [Compass, '3%', '88%', 28, -12],
  [CarFront, '27%', '91%', 25, 7], [MapPin, '52%', '29%', 20, -15],
  [Luggage, '76%', '6%', 24, 3], [Navigation, '40%', '86%', 22, 16],
  [Send, '68%', '92%', 21, -8], [Clock, '22%', '23%', 19, 6],
]

function WallpaperDoodles() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {DOODLES.map(([Icon, top, left, size, rotate], i) => (
        <Icon
          key={i}
          size={size}
          strokeWidth={1.1}
          className="absolute text-[#0b141a] opacity-[0.035] dark:text-white dark:opacity-[0.04]"
          style={{ top, left, transform: `rotate(${rotate}deg)` }}
        />
      ))}
    </div>
  )
}

function StatusTick({ status, size = 14 }) {
  const s = String(status || 'queued').toLowerCase()
  const label = statusLabel(s)
  let Icon = Clock
  let cls = 'text-[#667781] dark:text-[#8696a0]'
  if (s === 'sent') Icon = Check
  else if (s === 'delivered') Icon = CheckCheck
  else if (s === 'read') { Icon = CheckCheck; cls = 'text-[#53bdeb]' }
  else if (s === 'failed') { Icon = AlertCircle; cls = 'text-[#f15c6d]' }
  return (
    <span className={`inline-flex flex-shrink-0 items-center ${cls}`} title={label}>
      <Icon size={size} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  )
}

function BubbleTail({ out, failed }) {
  const tone = out
    ? failed ? 'text-[#ffe2e2] dark:text-[#4a1f24]' : 'text-[#d9fdd3] dark:text-[#005c4b]'
    : 'text-white dark:text-[#202c33]'
  return (
    <svg
      viewBox="0 0 8 13" width="8" height="13" aria-hidden="true"
      className={`absolute bottom-0 ${out ? '-right-[7px]' : '-left-[7px] scale-x-[-1]'} ${tone}`}
    >
      <path fill="currentColor" d="M5.188 1H0v11.193l6.467-8.625C7.526 2.156 6.958 1 5.188 1z" />
    </svg>
  )
}

function Bubble({ item, now }) {
  const out = item.direction === 'out'
  const row = item.row || {}
  const failed = out && String(row.status).toLowerCase() === 'failed'
  const media = !out ? MEDIA[row.message_type] : null
  const mediaOnly = media && String(item.text) === `[${row.message_type}]`
  const [MediaIcon, mediaLabel] = media || []
  let who = ''
  if (out) {
    who = senderLabel(row.kind)
    if (who === 'Trip message' && row.template_name) who = `${who} · ${row.template_name}`
  }
  const bubble = out
    ? failed
      ? 'bg-[#ffe2e2] text-[#7a1c1c] dark:bg-[#4a1f24] dark:text-[#ffc9c9]'
      : 'bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef]'
    : 'bg-white text-[#111b21] dark:bg-[#202c33] dark:text-[#e9edef]'
  const corners = item.groupEnd
    ? out ? 'rounded-xl rounded-br-[3px]' : 'rounded-xl rounded-bl-[3px]'
    : 'rounded-xl'
  const metaCls = out ? 'text-[#667781] dark:text-[#9fb0ba]' : 'text-[#667781] dark:text-[#8696a0]'

  return (
    <div className={`flex w-full ${out ? 'justify-end' : 'justify-start'} ${item.groupStart ? 'mt-3' : 'mt-[3px]'}`}>
      <div className={`relative flex max-w-[86%] flex-col sm:max-w-[72%] ${out ? 'items-end' : 'items-start'}`}>
        {out && who && item.groupStart && (
          <span className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wider text-[#128c7e] dark:text-[#7bd8c8]">{who}</span>
        )}
        <div className={`relative px-2.5 py-[6px] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] ${bubble} ${corners}`}>
          <div className="flex items-end gap-2">
            <div className="min-w-0 whitespace-pre-wrap break-words text-[14px] leading-[1.45]">
              {mediaOnly ? (
                <span className="inline-flex items-center gap-1.5 py-0.5 italic opacity-80">
                  <MediaIcon size={15} aria-hidden="true" /> {mediaLabel}
                </span>
              ) : item.text || <span className="italic opacity-60">(no text)</span>}
            </div>
            <span className={`flex flex-shrink-0 select-none items-center gap-1 pb-[2px] text-[10.5px] leading-none tabular-nums ${metaCls}`}>
              {shortTime(item.at, now)}
              {out && <StatusTick status={row.status} />}
            </span>
          </div>
          {item.reaction && (
            <span
              title="Reaction"
              aria-label={`Reaction ${item.reaction.emoji}`}
              className="absolute -bottom-2 right-1 z-20 flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-2 text-[13px] shadow-[0_1px_3px_rgba(11,20,26,0.35)] dark:bg-[#233138]"
            >
              {item.reaction.emoji}
            </span>
          )}
        </div>
        {item.groupEnd && <BubbleTail out={out} failed={failed} />}
        {failed && row.error && (
          <span className="mt-1 px-1 text-[11px] text-red-600 dark:text-red-400">{row.error}</span>
        )}
      </div>
    </div>
  )
}

function ConversationRow({ conv, preview, active, now, onOpen }) {
  const name = displayName(conv)
  const unread = Number(conv.unread) || 0
  const paused = isBotPaused(conv.bot_paused_until, now)
  const previewText = preview?.text || (conv.contact_name ? formatPhone(conv.phone) : '')
  return (
    <button
      type="button"
      onClick={() => onOpen(conv.phone)}
      aria-current={active ? 'true' : undefined}
      className={`group relative flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors ${
        active
          ? 'bg-[#f0f2f5] dark:bg-[#2a3942]'
          : 'hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]'
      }`}
    >
      {active && <span aria-hidden="true" className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-[#25d366]" />}
      <Avatar name={conv.contact_name || name.replace(/\D/g, '').slice(-2)} size={49} />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[15px] ${unread ? 'font-semibold text-[#111b21] dark:text-white' : 'font-medium text-[#111b21] dark:text-[#e9edef]'}`}>
          {name}
        </p>
        <div className="mt-0.5 flex items-center gap-1.5">
          {preview?.direction === 'out' && preview.status && <StatusTick status={preview.status} size={14} />}
          <p className="truncate text-[13px] text-[#667781] dark:text-[#8696a0]">
            {preview?.direction === 'out' ? 'You: ' : ''}{previewText}
          </p>
        </div>
        {(conv.needs_staff || paused) && (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {conv.needs_staff && <Chip tone="amber">Needs staff</Chip>}
            {paused && <Chip tone="gray">Bot paused</Chip>}
          </div>
        )}
      </div>
      <div className="flex flex-col items-end justify-between self-stretch py-0.5">
        <span className={`text-[11px] tabular-nums ${unread ? 'font-semibold text-[#25d366]' : 'text-[#667781] dark:text-[#8696a0]'}`}>
          {shortTime(conv.last_message_at, now)}
        </span>
        {unread > 0 ? (
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#25d366] px-1.5 text-[11px] font-bold text-white"
            aria-label={`${unread} unread`}>
            {unread > 99 ? '99+' : unread}
          </span>
        ) : paused ? (
          <Bot size={14} className="text-amber-500" aria-label="Bot paused" />
        ) : conv.needs_staff ? (
          <span className="h-2 w-2 rounded-full bg-amber-500" aria-label="Needs staff" />
        ) : (
          <span className="h-5" />
        )}
      </div>
    </button>
  )
}

function Chip({ tone = 'gray', children }) {
  const tones = {
    amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    gray: 'bg-slate-500/10 text-[#54656f] dark:text-[#8696a0]',
    green: 'bg-[#25d366]/15 text-[#128c7e] dark:text-[#7bd8c8]',
  }
  return <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${tones[tone] || tones.gray}`}>{children}</span>
}

function DateDivider({ label }) {
  if (!label) return null
  return (
    <div className="my-3 flex justify-center">
      <span className="rounded-lg bg-white/95 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-[#54656f] shadow-sm dark:bg-[#182229] dark:text-[#8696a0]">
        {label}
      </span>
    </div>
  )
}

function IconButton({ label, onClick, href, active, children }) {
  const cls = `inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#25d366]/60 ${
    active
      ? 'bg-[#25d366]/15 text-[#128c7e] dark:text-[#7bd8c8]'
      : 'text-[#54656f] hover:bg-black/5 dark:text-[#aebac1] dark:hover:bg-white/10'
  }`
  if (href) {
    return <a href={href} aria-label={label} title={label} className={cls}>{children}</a>
  }
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} aria-pressed={active} className={cls}>
      {children}
    </button>
  )
}

function shortDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// ── Page ──────────────────────────────────────────────────────
export default function WhatsApp() {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [previews, setPreviews] = useState({})
  const [detailsOpen, setDetailsOpen] = useState(false)

  const [inbound, setInbound] = useState([])
  const [outbound, setOutbound] = useState([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [threadError, setThreadError] = useState('')

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [resuming, setResuming] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const selectedRef = useRef(null)
  const threadEndRef = useRef(null)
  const textareaRef = useRef(null)
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
        .select('id,to_phone,body,template_name,status,created_at')
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
    setEmojiOpen(false)
    loadThread(phone)
    markRead(phone)
  }, [loadThread, markRead])

  const closeThread = () => {
    selectedRef.current = null
    setSelected(null)
    setDetailsOpen(false)
    setEmojiOpen(false)
  }

  // ── Derived ─────────────────────────────────────────────────
  const sorted = useMemo(() => sortConversations(conversations), [conversations])
  const visible = useMemo(() => filterConversations(sorted, { filter, query }), [sorted, filter, query])
  const counts = useMemo(() => ({
    needs: conversations.filter(c => c.needs_staff).length,
    unread: conversations.filter(c => Number(c.unread) > 0).length,
  }), [conversations])
  const conv = useMemo(() => conversations.find(c => c.phone === selected) || null, [conversations, selected])
  const thread = useMemo(() => groupThread(mergeThread(inbound, outbound)), [inbound, outbound])
  const canReply = conv ? isWithinReplyWindow(conv.last_inbound_at, now) : false
  const paused = conv ? isBotPaused(conv.bot_paused_until, now) : false
  const replyHoursLeft = conv?.last_inbound_at
    ? Math.max(0, Math.ceil((Date.parse(conv.last_inbound_at) + REPLY_WINDOW_MS - now) / 3_600_000))
    : 0

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: 'end' })
  }, [thread.length, selected])

  // Escape closes the details drawer or emoji picker.
  useEffect(() => {
    if (!detailsOpen && !emojiOpen) return undefined
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      setDetailsOpen(false)
      setEmojiOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [detailsOpen, emojiOpen])

  // ── Actions ─────────────────────────────────────────────────
  const send = async () => {
    const text = draft.trim()
    if (!text || !conv || sending) return
    setSending(true)
    setSendError('')
    setEmojiOpen(false)
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

  const insertEmoji = (emoji) => {
    const el = textareaRef.current
    const start = el?.selectionStart ?? draft.length
    const end = el?.selectionEnd ?? draft.length
    const next = draft.slice(0, start) + emoji + draft.slice(end)
    setDraft(next)
    setEmojiOpen(false)
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      el.setSelectionRange(start + emoji.length, start + emoji.length)
    })
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  const refreshAll = async () => {
    if (refreshing) return
    setRefreshing(true)
    await loadConversations()
    if (selectedRef.current) await loadThread(selectedRef.current)
    setRefreshing(false)
  }

  const filters = [
    { key: 'all', label: 'All', count: conversations.length },
    { key: 'unread', label: 'Unread', count: counts.unread },
    { key: 'needs_staff', label: 'Needs staff', count: counts.needs },
  ]

  // ── List pane ───────────────────────────────────────────────
  const listPane = (
    <section
      aria-label="WhatsApp chats"
      className={`w-full flex-shrink-0 flex-col border-r border-[#e9edef] bg-white dark:border-[#222d34] dark:bg-[#111b21] lg:flex lg:w-[360px] xl:w-[392px] ${selected ? 'hidden lg:flex' : 'flex'}`}
    >
      <div className="flex h-[60px] flex-shrink-0 items-center gap-2.5 px-4">
        <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-[#25d366] text-white shadow-sm">
          <MessageCircle size={19} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-bold text-[#111b21] dark:text-[#e9edef]">WhatsApp</h1>
          <p className="truncate text-[11px] text-[#667781] dark:text-[#8696a0]">
            Business inbox · {conversations.length} chat{conversations.length === 1 ? '' : 's'}
            {counts.needs ? ` · ${counts.needs} need staff` : ''}
          </p>
        </div>
        <IconButton label="Refresh chats" onClick={refreshAll}>
          <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
        </IconButton>
      </div>

      <div className="flex-shrink-0 space-y-2.5 px-3 pb-2.5">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8696a0]" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search name or phone"
            aria-label="Search chats"
            className="h-9 w-full rounded-lg border border-transparent bg-[#f0f2f5] pl-9 pr-8 text-[13.5px] text-[#111b21] placeholder-[#8696a0] outline-none transition-colors focus:border-[#25d366]/50 focus:bg-white dark:bg-[#202c33] dark:text-[#e9edef] dark:focus:bg-[#2a3942]"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search"
              className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-[#8696a0] hover:bg-black/5 dark:hover:bg-white/10">
              <X size={13} />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {filters.map(f => {
            const active = filter === f.key
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={active}
                className={`inline-flex h-8 flex-shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#25d366]/60 ${
                  active
                    ? 'bg-[#d9fdd3] text-[#075e54] dark:bg-[#005c4b] dark:text-[#d9fdd3]'
                    : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef] dark:bg-[#202c33] dark:text-[#8696a0] dark:hover:bg-[#2a3942]'
                }`}
              >
                {f.label}
                {f.count > 0 && (
                  <span className={`tabular-nums ${active ? 'opacity-70' : 'opacity-60'}`}>{f.count}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {loadError && (
        <div role="alert" className="mx-3 mb-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          <span className="flex-1">{loadError}</span>
          <button type="button" onClick={refreshAll} className="font-semibold underline">Retry</button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div role="status" aria-busy="true" aria-label="Loading chats" className="space-y-1 p-2">
            <span className="sr-only">Loading chats…</span>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="flex items-center gap-3 px-2 py-2.5" aria-hidden="true">
                <div className="skeleton h-[49px] w-[49px] flex-shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3.5 w-1/2 rounded" />
                  <div className="skeleton h-3 w-3/4 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 && !loadError ? (
          <div className="px-6 py-12 text-center">
            <Inbox size={34} className="mx-auto text-[#8696a0]" />
            <p className="mt-3 text-sm font-semibold text-[#41525d] dark:text-[#e9edef]">No WhatsApp chats yet</p>
            <p className="mt-1 text-xs text-[#667781] dark:text-[#8696a0]">Messages to the business number appear here.</p>
          </div>
        ) : visible.length === 0 && !loadError ? (
          <div className="px-6 py-12 text-center">
            <Search size={32} className="mx-auto text-[#8696a0]" />
            <p className="mt-3 text-sm font-semibold text-[#41525d] dark:text-[#e9edef]">No chats match</p>
            <p className="mt-1 text-xs text-[#667781] dark:text-[#8696a0]">Try a different name, number or filter.</p>
          </div>
        ) : (
          visible.map(c => (
            <ConversationRow key={c.phone} conv={c} preview={previews[c.phone]} active={c.phone === selected} now={now} onOpen={openThread} />
          ))
        )}
      </div>
    </section>
  )

  // ── Details pane ────────────────────────────────────────────
  const detailsPane = conv && (
    <aside
      aria-label="Contact details"
      className="absolute inset-0 z-30 flex w-full flex-col border-l border-[#e9edef] bg-white dark:border-[#222d34] dark:bg-[#111b21] lg:static lg:z-auto lg:w-[320px] lg:flex-shrink-0"
    >
      <div className="flex h-[60px] flex-shrink-0 items-center justify-between border-b border-[#e9edef] px-4 dark:border-[#222d34]">
        <h2 className="text-[15px] font-semibold text-[#111b21] dark:text-[#e9edef]">Contact info</h2>
        <IconButton label="Close contact info" onClick={() => setDetailsOpen(false)}>
          <X size={18} />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col items-center px-5 pb-5 pt-7 text-center">
          <Avatar name={conv.contact_name || displayName(conv).replace(/\D/g, '').slice(-2)} size={104} />
          <h3 className="mt-4 max-w-full truncate text-[18px] font-semibold text-[#111b21] dark:text-[#e9edef]">{displayName(conv)}</h3>
          <p className="mt-0.5 text-[13px] tabular-nums text-[#667781] dark:text-[#8696a0]">{formatPhone(conv.phone)}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {conv.needs_staff && <Chip tone="amber">Needs staff</Chip>}
            {paused ? <Chip tone="amber">Bot paused</Chip> : <Chip tone="green">Bot active</Chip>}
            {Number(conv.unread) > 0 && <Chip tone="green">{conv.unread} unread</Chip>}
          </div>
        </div>

        <div className="border-t border-[#e9edef] px-5 py-4 dark:border-[#222d34]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#667781] dark:text-[#8696a0]">Conversation</p>
          <dl className="mt-2.5 space-y-3 text-[13px]">
            <div className="flex items-start justify-between gap-4">
              <dt className="text-[#667781] dark:text-[#8696a0]">Last customer message</dt>
              <dd className="text-right font-medium text-[#111b21] dark:text-[#e9edef]">{shortDateTime(conv.last_inbound_at)}</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-[#667781] dark:text-[#8696a0]">Reply window</dt>
              <dd className={`text-right font-medium ${canReply ? 'text-[#128c7e] dark:text-[#7bd8c8]' : 'text-amber-600 dark:text-amber-400'}`}>
                {canReply ? `Open · ${replyHoursLeft} h left` : 'Closed · template only'}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-[#667781] dark:text-[#8696a0]">Last message</dt>
              <dd className="text-right font-medium text-[#111b21] dark:text-[#e9edef]">{shortDateTime(conv.last_message_at)}</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-[#667781] dark:text-[#8696a0]">Bot</dt>
              <dd className="text-right font-medium text-[#111b21] dark:text-[#e9edef]">
                {paused ? `Paused until ${shortDateTime(conv.bot_paused_until)}` : 'Answering automatically'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="space-y-2 border-t border-[#e9edef] px-5 py-4 dark:border-[#222d34]">
          <a href={`tel:+${conv.phone}`}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-full border border-[#d1d7db] text-[13px] font-semibold text-[#128c7e] transition-colors hover:bg-[#f0f2f5] dark:border-[#2a3942] dark:text-[#7bd8c8] dark:hover:bg-[#202c33]">
            <Phone size={15} /> Call customer
          </a>
          <a href={`https://wa.me/${conv.phone}`} target="_blank" rel="noopener noreferrer"
            className="flex h-10 w-full items-center justify-center gap-2 rounded-full border border-[#d1d7db] text-[13px] font-semibold text-[#128c7e] transition-colors hover:bg-[#f0f2f5] dark:border-[#2a3942] dark:text-[#7bd8c8] dark:hover:bg-[#202c33]">
            <ExternalLink size={15} /> Open in WhatsApp
          </a>
          {paused && (
            <button type="button" onClick={resumeBot} disabled={resuming}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[#25d366] text-[13px] font-semibold text-white transition-colors hover:bg-[#1fbe5b] disabled:opacity-60">
              <Bot size={15} /> {resuming ? 'Resuming…' : 'Resume bot'}
            </button>
          )}
        </div>

        <p className="flex items-center justify-center gap-1.5 border-t border-[#e9edef] px-5 py-4 text-[11px] text-[#8696a0] dark:border-[#222d34]">
          <Lock size={12} /> Sent through the official WhatsApp Business number
        </p>
      </div>
    </aside>
  )

  // ── Thread pane ─────────────────────────────────────────────
  const threadPane = (
    <section
      aria-label="Conversation"
      className={`min-w-0 flex-1 flex-col ${selected ? 'flex' : 'hidden lg:flex'}`}
    >
      {!conv ? (
        <div className="relative flex h-full flex-1 items-center justify-center overflow-hidden bg-[#efeae2] px-6 py-10 dark:bg-[#0b141a]">
          <WallpaperDoodles />
          <div className="relative max-w-sm text-center">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-white/85 shadow-lg dark:bg-[#202c33]">
              <MessageCircle size={38} className="text-[#25d366]" aria-hidden="true" />
            </div>
            <h2 className="mt-5 text-[22px] font-semibold text-[#41525d] dark:text-[#e9edef]">
              Sri Jayam Travels <span className="text-[#25d366]">WhatsApp</span>
            </h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-[#667781] dark:text-[#8696a0]">
              Select a chat to read the conversation and reply. The bot keeps answering while no one is here.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <span className="rounded-full bg-white/80 px-3 py-1.5 text-[12px] font-medium text-[#41525d] shadow-sm dark:bg-[#202c33] dark:text-[#aebac1]">
                {conversations.length} conversation{conversations.length === 1 ? '' : 's'}
              </span>
              <span className="rounded-full bg-white/80 px-3 py-1.5 text-[12px] font-medium text-[#41525d] shadow-sm dark:bg-[#202c33] dark:text-[#aebac1]">
                {counts.unread} unread
              </span>
              <span className="rounded-full bg-white/80 px-3 py-1.5 text-[12px] font-medium text-[#41525d] shadow-sm dark:bg-[#202c33] dark:text-[#aebac1]">
                {counts.needs} need staff
              </span>
            </div>
            <p className="mt-7 inline-flex items-center gap-1.5 text-[11.5px] text-[#8696a0]">
              <Lock size={12} /> Official WhatsApp Business number
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex h-[60px] flex-shrink-0 items-center gap-1 border-b border-[#e9edef] bg-[#f0f2f5] px-2 dark:border-[#222d34] dark:bg-[#202c33] sm:px-3">
            <button type="button" onClick={closeThread} aria-label="Back to chats"
              className="grid h-10 w-10 place-items-center rounded-full text-[#54656f] hover:bg-black/5 dark:text-[#aebac1] dark:hover:bg-white/10 lg:hidden">
              <ArrowLeft size={20} />
            </button>
            <button type="button" onClick={() => setDetailsOpen(v => !v)} aria-expanded={detailsOpen}
              aria-label="Open contact info"
              className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#25d366]/60">
              <Avatar name={conv.contact_name || displayName(conv).replace(/\D/g, '').slice(-2)} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-[#111b21] dark:text-[#e9edef]">{displayName(conv)}</span>
                <span className="block truncate text-[12px] text-[#667781] dark:text-[#8696a0]">
                  {paused ? 'Bot paused · you are replying' : conv.needs_staff ? 'Waiting for staff' : 'Bot active'}
                  {conv.contact_name ? ` · ${formatPhone(conv.phone)}` : ''}
                </span>
              </span>
            </button>
            {paused && (
              <button type="button" onClick={resumeBot} disabled={resuming}
                className="hidden h-9 flex-shrink-0 items-center gap-1.5 rounded-full bg-[#25d366] px-3 text-[12px] font-semibold text-white transition-colors hover:bg-[#1fbe5b] disabled:opacity-60 sm:inline-flex">
                <Bot size={14} /> {resuming ? 'Resuming…' : 'Resume'}
              </button>
            )}
            <IconButton label="Call customer" href={`tel:+${conv.phone}`}>
              <Phone size={18} />
            </IconButton>
            <IconButton label="Contact info" onClick={() => setDetailsOpen(v => !v)} active={detailsOpen}>
              <Info size={18} />
            </IconButton>
          </div>

          {/* Messages */}
          <div className="relative min-h-0 flex-1 bg-[#efeae2] dark:bg-[#0b141a]">
            <WallpaperDoodles />
            <div className="absolute inset-0 z-10 overflow-y-auto px-1.5 py-3 sm:px-4" aria-live="polite">
              <div className="mx-auto flex min-h-full w-full max-w-[900px] flex-col justify-end">
                {threadError ? (
                  <div role="alert" className="mx-auto max-w-sm rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center text-[12.5px] text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                    {threadError}
                    <button type="button" onClick={() => loadThread(conv.phone)} className="ml-2 font-semibold underline">Retry</button>
                  </div>
                ) : threadLoading && thread.length === 0 ? (
                  <div role="status" aria-busy="true" className="space-y-2.5 py-2">
                    <span className="sr-only">Loading messages…</span>
                    {[0, 1, 2, 3, 4].map(i => (
                      <div key={i} className={`flex ${i % 2 ? 'justify-end' : 'justify-start'}`} aria-hidden="true">
                        <div className={`skeleton h-11 rounded-xl ${i % 2 ? 'w-1/3' : 'w-1/2'}`} />
                      </div>
                    ))}
                  </div>
                ) : thread.length === 0 ? (
                  <div className="py-10 text-center">
                    <MessageCircle size={34} className="mx-auto text-[#8696a0]" />
                    <p className="mt-3 text-sm font-semibold text-[#41525d] dark:text-[#e9edef]">No messages yet</p>
                    <p className="mt-1 text-xs text-[#667781] dark:text-[#8696a0]">This chat has no stored messages.</p>
                  </div>
                ) : (
                  thread.map(item => (
                    <Fragment key={item.key}>
                      {item.newDay && <DateDivider label={dateDividerLabel(item.at, now)} />}
                      <Bubble item={item} now={now} />
                    </Fragment>
                  ))
                )}
                <div ref={threadEndRef} />
              </div>
            </div>
          </div>

          {/* Composer */}
          <div className="flex-shrink-0 border-t border-[#e9edef] bg-[#f0f2f5] px-2 py-2 dark:border-[#222d34] dark:bg-[#202c33] sm:px-3">
            {!canReply && (
              <p className="mx-auto mb-2 flex max-w-[900px] items-start gap-1.5 rounded-lg border border-amber-300/70 bg-[#fff3cd] px-3 py-2 text-[12px] text-[#7a5c00] dark:border-amber-500/30 dark:bg-[#3b3320] dark:text-amber-200">
                <Clock size={14} className="mt-0.5 flex-shrink-0" />
                More than 24 hours since the customer wrote — WhatsApp allows only approved template messages now.
              </p>
            )}
            {sendError && (
              <p role="alert" className="mx-auto mb-2 max-w-[900px] rounded-lg border border-red-300/70 bg-red-50 px-3 py-2 text-[12px] text-red-700 dark:border-red-500/30 dark:bg-red-900/25 dark:text-red-300">
                {sendError}
              </p>
            )}
            <div className="relative mx-auto flex max-w-[900px] items-end gap-2">
              {emojiOpen && (
                <>
                  <button type="button" tabIndex={-1} aria-label="Close emoji picker"
                    onClick={() => setEmojiOpen(false)}
                    className="fixed inset-0 z-20 cursor-default" />
                  <div role="dialog" aria-label="Emoji picker"
                    className="absolute bottom-full left-0 z-30 mb-2 w-[268px] rounded-xl border border-black/5 bg-white p-2 shadow-2xl dark:border-white/10 dark:bg-[#233138]">
                    <div className="grid grid-cols-8 gap-0.5">
                      {EMOJIS.map(e => (
                        <button key={e} type="button" onClick={() => insertEmoji(e)}
                          className="grid h-8 w-8 place-items-center rounded-lg text-[17px] transition-colors hover:bg-[#f0f2f5] dark:hover:bg-white/10">
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <div className="flex min-w-0 flex-1 items-end gap-1 rounded-[24px] bg-white px-1.5 py-1 shadow-sm dark:bg-[#2a3942]">
                <button type="button" onClick={() => setEmojiOpen(v => !v)} disabled={!canReply || sending}
                  aria-label="Insert emoji" aria-expanded={emojiOpen}
                  className="mb-0.5 grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-[#54656f] transition-colors hover:bg-black/5 disabled:opacity-40 dark:text-[#aebac1] dark:hover:bg-white/10">
                  <Smile size={20} />
                </button>
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={1}
                  maxLength={4096}
                  disabled={!canReply || sending}
                  placeholder={canReply ? 'Type a reply…' : 'Replies are closed for this chat'}
                  aria-label="Reply message"
                  className="max-h-32 min-h-[38px] flex-1 resize-none bg-transparent py-2 text-[14px] leading-relaxed text-[#111b21] outline-none placeholder-[#8696a0] disabled:cursor-not-allowed disabled:opacity-60 dark:text-[#e9edef]"
                />
              </div>
              <button
                type="button"
                onClick={send}
                disabled={!canReply || sending || !draft.trim()}
                aria-label="Send reply"
                className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-[#25d366] text-white shadow-sm transition-all hover:bg-[#1fbe5b] active:scale-95 disabled:bg-[#8696a0]/50 disabled:text-white/90 disabled:active:scale-100"
              >
                {sending ? <RefreshCw size={19} className="animate-spin" /> : <Send size={19} />}
              </button>
            </div>
            <p className="mx-auto mt-1.5 flex max-w-[900px] items-center justify-between gap-3 text-[10.5px] text-[#8696a0]">
              <span>Enter to send · Shift+Enter for a new line</span>
              {draft.length > 3500 && <span className="tabular-nums">{draft.length}/4096</span>}
            </p>
          </div>
        </>
      )}
    </section>
  )

  return (
    <div className="animate-fade-up">
      <div className="relative flex h-[calc(100dvh-5.75rem)] min-h-[520px] overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_18px_50px_-20px_rgba(11,20,26,0.35)] dark:border-white/10 dark:bg-[#111b21] sm:h-[calc(100dvh-6.75rem)]">
        {listPane}
        <div className="relative flex min-w-0 flex-1">
          {threadPane}
          {detailsOpen && detailsPane}
        </div>
      </div>
    </div>
  )
}

// ─── Report presentation helpers ───────────────────────────────
// Pure formatting and period helpers shared by the Reports workspace.
// No data fetching or business calculations live here: reportData.js
// remains the single source of truth for financial definitions.

// Stable empty collections keep memoised report configs from changing identity
// on every render when a source request fails or has not resolved yet.
export const EMPTY_ARRAY = Object.freeze([])

export const REPORT_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'this-week', label: 'This Week' },
  { key: 'this-month', label: 'This Month' },
  { key: 'last-month', label: 'Last Month' },
  { key: 'last-3-months', label: 'Last 3 Months' },
  { key: 'this-year', label: 'This Year' },
  { key: 'custom', label: 'Custom Range' },
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const num = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export const rs = (value) => `Rs. ${num(value).toLocaleString('en-IN')}`

export const rsK = (value) => {
  const n = num(value)
  if (Math.abs(n) >= 1000) return `Rs. ${(n / 1000).toFixed(1)}k`
  return `Rs. ${n.toLocaleString('en-IN')}`
}

export const fullDt = (iso) => {
  if (!iso) return '—'
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const monthLabel = (month) => MONTHS[num(month) - 1] || '—'

export const toDateKey = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const fromDateKey = (key) => {
  const [y, m, d] = String(key || '').slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return new Date()
  return new Date(y, m - 1, d)
}

const addDays = (date, days) => {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

const addMonths = (date, months) => {
  const d = new Date(date)
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  return d
}

export function presetRange(preset, now = new Date()) {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const to = toDateKey(today)

  switch (preset) {
    case 'today':
      return { from: to, to }
    case 'this-week': {
      const day = today.getDay() || 7
      return { from: toDateKey(addDays(today, 1 - day)), to }
    }
    case 'last-month': {
      const start = addMonths(today, -1)
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0)
      return { from: toDateKey(start), to: toDateKey(end) }
    }
    case 'last-3-months':
      return { from: toDateKey(addMonths(today, -2)), to }
    case 'this-year':
      return { from: toDateKey(new Date(today.getFullYear(), 0, 1)), to }
    case 'custom':
      return { from: toDateKey(addMonths(today, 1 - today.getMonth())), to }
    case 'this-month':
    default:
      return { from: toDateKey(new Date(today.getFullYear(), today.getMonth(), 1)), to }
  }
}

export function previousRange(from, to) {
  const f = fromDateKey(from)
  const t = fromDateKey(to)
  const len = Math.max(1, Math.round((t - f) / 86400000) + 1)
  return {
    from: toDateKey(addDays(f, -len)),
    to: toDateKey(addDays(f, -1)),
  }
}

export const formatRangeLabel = (from, to) => {
  if (!from && !to) return 'All dates'
  if (from === to) return fullDt(from)
  return `${fullDt(from)} → ${fullDt(to)}`
}

export const formatLastUpdated = (value) => {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

export const bucketStatus = (status) => {
  if (status === 'completed' || status === 'closed') return 'completed'
  if (status === 'cancelled') return 'cancelled'
  if (status === 'started') return 'ongoing'
  return 'scheduled'
}

export const STATUS_META = {
  completed: { label: 'Completed', tone: 'green', color: 'var(--ap-success)' },
  ongoing: { label: 'Ongoing', tone: 'amber', color: 'var(--ap-warning)' },
  cancelled: { label: 'Cancelled', tone: 'red', color: 'var(--ap-danger)' },
  scheduled: { label: 'Scheduled', tone: 'blue', color: 'var(--ap-info)' },
}

export const delta = (current, previous) => (
  num(previous) > 0 ? Math.round((num(current) - num(previous)) / num(previous) * 100) : null
)

export const pct = (part, total) => (
  num(total) > 0 ? Math.round(num(part) / num(total) * 100) : 0
)

export const titleCase = (value) => String(value || '').replace(/_/g, ' ')

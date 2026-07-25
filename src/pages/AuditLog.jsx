// ─── Audit Log Page — Module 13 ───────────────────────────────
import { useState, useMemo, useCallback } from 'react'
import { Activity, Search, Download, RefreshCw } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { loadAuditEvents, fmtAuditTime } from '../data/auditLogData'
import { exportToCSV } from '../data/reportData'

const ACTION_ICONS = {
  TRIP_CREATED:'📋',TRIP_UPDATED:'✏️',TRIP_ASSIGNED:'🧑‍✈️',TRIP_STARTED:'🚗',
  TRIP_COMPLETED:'✅',TRIP_CANCELLED:'❌',EXPENSE_ADDED:'💸',EXPENSE_APPROVED:'✅',
  PAYROLL_SETTLED:'💰',DRIVER_ADDED:'👤',VEHICLE_ASSIGNED:'🚘',CUSTOMER_ADDED:'👥',
  BOOKING_PENDING:'⏳',BOOKING_APPROVED:'✅',BOOKING_CANCELLED:'❌',
  NOTE_ADDED:'📝',LOGIN:'🔐',LOGOUT:'🚪',
}

function getCategory(action = '') {
  if (action.startsWith('TRIP') || action.startsWith('BOOKING')) return 'booking'
  if (action.startsWith('EXPENSE'))  return 'expense'
  if (action.startsWith('PAYROLL'))  return 'payroll'
  if (action.startsWith('DRIVER'))   return 'driver'
  if (action.startsWith('VEHICLE'))  return 'vehicle'
  if (action.startsWith('CUSTOMER')) return 'customer'
  if (action === 'LOGIN' || action === 'LOGOUT') return 'system'
  return 'general'
}

const CAT_COLORS = {
  booking: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  expense: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  payroll: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  driver:  'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  vehicle: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  customer:'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  system:  'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  general: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
}

const CATS = ['all','booking','expense','payroll','driver','vehicle','customer','system']

export default function AuditLog() {
  const [events,    setEvents]    = useState(() => loadAuditEvents(200))
  const [search,    setSearch]    = useState('')
  const [catFilter, setCatFilter] = useState('all')

  const reload = useCallback(() => setEvents(loadAuditEvents(200)), [])

  const filtered = useMemo(() =>
    events.filter(ev => {
      const cat = getCategory(ev.action)
      if (catFilter !== 'all' && cat !== catFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return [ev.action,ev.description,ev.driver,ev.label].some(v => v?.toLowerCase().includes(q))
      }
      return true
    })
  , [events, search, catFilter])

  const handleExport = () => exportToCSV(filtered, [
    { label:'Timestamp',   key:'timestamp'   },
    { label:'Action',      key:'action'      },
    { label:'Description', key:'description' },
    { label:'Driver',      key:'driver'      },
  ], 'audit_log')

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Audit Log"
        subtitle={`${events.length} total events tracked`}
        action={
          <div className="flex items-center gap-2">
            <button onClick={reload}
              className="w-9 h-9 rounded-xl border border-slate-200 dark:border-navy-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors">
              <RefreshCw size={15} />
            </button>
            <button onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors">
              <Download size={15} /> Export CSV
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white/70 dark:bg-navy-800/60 flex-1 min-w-[160px] max-w-xs">
          <Search size={14} className="text-slate-400 flex-shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search events…"
            className="bg-transparent text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none w-full" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {CATS.map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold capitalize transition-all ${
                catFilter === c
                  ? 'bg-navy-900 dark:bg-blue-700 text-white shadow'
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400'
              }`}>
              {c}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400 ml-auto">{filtered.length} events</p>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <Activity size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">No audit events found</p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-navy-800/60 border-b border-slate-100 dark:border-navy-700">
                  {['Time','Category','Action','Description','Actor'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-navy-800">
                {filtered.map((ev, i) => {
                  const cat = getCategory(ev.action)
                  return (
                    <tr key={ev.id || i} className="hover:bg-slate-50/50 dark:hover:bg-navy-800/20 transition-colors">
                      <td className="px-4 py-2.5 whitespace-nowrap font-mono text-slate-500 dark:text-slate-400">
                        {fmtAuditTime(ev.timestamp)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${CAT_COLORS[cat]||CAT_COLORS.general}`}>
                          {cat}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span>{ACTION_ICONS[ev.action]||'📋'}</span>
                          <span className="font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                            {ev.label || (ev.action||'').replace(/_/g,' ')}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                        {ev.description || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                        {ev.driver || ev.actor || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

import React, { useState, useEffect } from 'react'
import { Database, CheckCircle, AlertCircle, Loader, AlertTriangle, RefreshCw } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import { getDatabaseProvider } from '../../config/database'
import supabase, { isSupabaseConfigured } from '../../lib/supabase'
import { withTimeout } from '../../utils/withTimeout'

// ── Inline health checkers with timeouts ──────────────────────
async function pingAuth() {
  try {
    const { error } = await withTimeout(
      supabase.auth.getSession(),
      5_000,
      { error: new Error('timeout') }
    )
    return { healthy: !error }
  } catch { return { healthy: false } }
}

async function pingTable(table) {
  try {
    const { error } = await withTimeout(
      supabase.from(table).select('id').limit(1),
      5_000,
      { error: new Error('timeout') }
    )
    return { healthy: !error, error: error?.message }
  } catch (e) { return { healthy: false, error: e.message } }
}

// ── Sub-components ────────────────────────────────────────────
const StatusBadge = ({ healthy, label, detail }) => (
  <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-navy-800/50 rounded-lg">
    {healthy
      ? <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
      : <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />}
    <div className="flex-1 min-w-0">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      {detail && <p className="text-[10px] text-slate-400 truncate">{detail}</p>}
    </div>
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
      healthy
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
        : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
    }`}>
      {healthy ? 'OK' : 'FAIL'}
    </span>
  </div>
)

const InfoRow = ({ label, value }) => (
  <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-navy-700 last:border-0">
    <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{value ?? '—'}</span>
  </div>
)

const SectionCard = ({ title, children }) => (
  <div className="bg-white dark:bg-navy-800/60 rounded-xl border border-slate-100 dark:border-navy-700 p-4 mb-4">
    <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-3 text-sm uppercase tracking-wide">{title}</h3>
    <div className="space-y-2">{children}</div>
  </div>
)

// ── Main page ─────────────────────────────────────────────────
const DatabaseStatus = () => {
  const [loading,  setLoading]  = useState(true)
  const [timedOut, setTimedOut] = useState(false)
  const [status,   setStatus]   = useState(null)

  const loadStatus = async () => {
    setLoading(true)
    setTimedOut(false)

    // Hard 12-second cap so the page never hangs forever
    const timer = setTimeout(() => {
      setTimedOut(true)
      setLoading(false)
    }, 12_000)

    try {
      const provider   = getDatabaseProvider()
      const configured = isSupabaseConfigured()

      const tables = [
        'customers','drivers','vehicles','bookings',
        'expenses','attendance','trip_payslips','settlements',
      ]

      const [authPing, ...tablePings] = await Promise.all([
        configured ? pingAuth() : Promise.resolve({ healthy: false }),
        ...tables.map(t => configured ? pingTable(t) : Promise.resolve({ healthy: false })),
      ])

      const counts = {}
      for (let i = 0; i < tables.length; i++) {
        counts[tables[i]] = tablePings[i].healthy ? '✓' : tablePings[i].error || 'error'
      }

      clearTimeout(timer)
      setStatus({ provider, configured, authPing, tablePings, tables, counts })
    } catch (error) {
      clearTimeout(timer)
      setStatus({ error: error.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadStatus() }, [])

  // ── Loading ───────────────────────────────────────────────
  if (loading) return (
    <div className="p-6">
      <PageHeader title="Database Status" subtitle="Checking Supabase connection…" />
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Loader className="w-10 h-10 animate-spin text-blue-500" />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Pinging Supabase tables… (max 12 s)
        </p>
      </div>
    </div>
  )

  // ── Timeout fallback ──────────────────────────────────────
  if (timedOut) return (
    <div className="p-6">
      <PageHeader title="Database Status" subtitle="Connection timed out" />
      <div className="bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-700/30 rounded-xl p-5 mb-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-700 dark:text-amber-400 text-sm">Supabase did not respond in 12 seconds</p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">Common causes:</p>
            <ul className="text-xs text-amber-600 dark:text-amber-500 mt-1 ml-3 space-y-0.5 list-disc">
              <li>Supabase project is <strong>paused</strong> (free tier pauses after 1 week idle) — go to <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="underline">supabase.com/dashboard</a> and click Restore</li>
              <li><code>VITE_SUPABASE_URL</code> or <code>VITE_SUPABASE_ANON_KEY</code> missing from <code>.env</code></li>
              <li>SQL schema not yet run in Supabase SQL Editor</li>
            </ul>
          </div>
        </div>
      </div>
      <button onClick={loadStatus}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-navy-900 dark:bg-blue-700 text-white text-sm font-bold hover:opacity-90 transition-all">
        <RefreshCw size={14} /> Retry
      </button>
    </div>
  )

  // ── Error ─────────────────────────────────────────────────
  if (status?.error) return (
    <div className="p-6">
      <PageHeader title="Database Status" subtitle="Error loading status" />
      <div className="bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800/30 rounded-xl p-4 text-red-700 dark:text-red-400 text-sm">
        {status.error}
      </div>
      <button onClick={loadStatus} className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl bg-navy-900 text-white text-sm font-bold">
        <RefreshCw size={14} /> Retry
      </button>
    </div>
  )

  // ── Results ───────────────────────────────────────────────
  const allTablesOk = status?.tablePings?.every(t => t.healthy)
  const tableLabels = {
    customers:'Customers', drivers:'Drivers', vehicles:'Vehicles',
    bookings:'Bookings (Trips)', expenses:'Expenses', attendance:'Attendance',
    trip_payslips:'Trip Payslips', settlements:'Settlements',
  }

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Database Status"
        subtitle="Supabase backend health"
        action={
          <button onClick={loadStatus}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-navy-700 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors">
            <RefreshCw size={13} /> Refresh
          </button>
        }
      />

      {/* Overall banner */}
      <div className={`rounded-xl p-4 flex items-center gap-3 ${
        allTablesOk
          ? 'bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800/30'
          : 'bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-700/30'
      }`}>
        {allTablesOk
          ? <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          : <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />}
        <p className={`text-sm font-bold ${allTablesOk ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
          {allTablesOk
            ? 'All tables reachable — Supabase is healthy'
            : 'Some tables are unreachable — run the SQL schema or check RLS'}
        </p>
      </div>

      <SectionCard title="Configuration">
        <InfoRow label="Provider"   value={status?.provider?.toUpperCase()} />
        <InfoRow label="Supabase"   value={status?.configured ? '✓ Configured (.env)' : '✗ Not configured'} />
        <InfoRow label="Auth Ping"  value={status?.authPing?.healthy ? '✓ Connected' : '✗ Failed'} />
      </SectionCard>

      <SectionCard title="Table Health">
        {status?.tables?.map((table, i) => (
          <StatusBadge
            key={table}
            label={tableLabels[table] || table}
            healthy={status.tablePings[i].healthy}
            detail={!status.tablePings[i].healthy ? (status.tablePings[i].error || 'unreachable') : undefined}
          />
        ))}
      </SectionCard>

      {!allTablesOk && (
        <SectionCard title="How to fix">
          <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2">
            <p className="font-bold text-slate-700 dark:text-slate-300">If tables show FAIL:</p>
            <ol className="ml-3 space-y-1 list-decimal">
              <li>Open <strong>Supabase Dashboard → SQL Editor</strong></li>
              <li>Run the file: <code className="bg-slate-100 dark:bg-navy-700 px-1 rounded">supabase/migrations/20240626_init_schema.sql</code></li>
              <li>Also run: <code className="bg-slate-100 dark:bg-navy-700 px-1 rounded">ALTER TABLE public.vehicles DISABLE ROW LEVEL SECURITY</code> (repeat for each table)</li>
              <li>Refresh this page</li>
            </ol>
            <p className="font-bold text-slate-700 dark:text-slate-300 pt-1">For <code>vehicle_assignments</code> (if used):</p>
            <code className="block bg-slate-100 dark:bg-navy-700 p-2 rounded text-[10px] leading-relaxed">
              {`CREATE TABLE IF NOT EXISTS public.vehicle_assignments (
  id            BIGSERIAL PRIMARY KEY,
  vehicle_reg   TEXT NOT NULL,
  vehicle_type  TEXT,
  vehicle_model TEXT,
  driver_id     TEXT,
  driver_name   TEXT NOT NULL,
  assigned_date DATE NOT NULL,
  assigned_time TEXT,
  assigned_at   TIMESTAMPTZ DEFAULT NOW(),
  released_date DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.vehicle_assignments DISABLE ROW LEVEL SECURITY;`}
            </code>
          </div>
        </SectionCard>
      )}
    </div>
  )
}

export default DatabaseStatus
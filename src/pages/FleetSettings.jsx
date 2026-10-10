import { gpsSyncService } from '../services/gpsSyncService'
import { useState, useEffect } from 'react'
import { Save, Navigation, RefreshCw, CheckCircle, AlertTriangle, ShieldCheck, Loader2, Plus, Trash2, X } from 'lucide-react'
import Button     from '../components/ui/Button'
import PageHeader from '../components/ui/PageHeader'
import { gpsSettingsRepository, GPS_DEFAULT_SETTINGS, SENSITIVE_KEYS } from '../repositories/gpsSettingsRepository'
import { createGpsProvider, GPS_PROVIDER_NAMES }                        from '../services/gpsProvider'
import { GPSTRACK_DEFAULT_URL }                                         from '../services/gpsProvider/gpsTrackInProvider'
import { addAuditEvent }                                                from '../data/auditLogData'
import { useAuth }                                                      from '../context/AuthContext'

// ── Local primitives (mirrors Settings.jsx) ───────────────────
function Toggle({ checked, onChange }) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${checked ? 'bg-blue-600' : 'bg-[var(--ap-border)]'}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )
}

function SectionCard({ icon: Icon, title, children }) {
  return (
    <div className="ap-surface rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 bg-[var(--ap-surface-2)] border-b border-[var(--ap-border)]">
        <Icon size={15} className="text-navy-700 dark:text-blue-400" />
        <p className="text-xs font-bold text-navy-800 dark:text-slate-200 uppercase tracking-wider">{title}</p>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, name, value, onChange, type = 'text', options, rows = 3, help, sensitive }) {
  const cls = `w-full px-3 py-2.5 text-sm rounded-xl border border-[var(--ap-border)]
               bg-[var(--ap-surface-2)] text-slate-700 dark:text-slate-200
               focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
               transition-colors font-body`
  const inputType = sensitive ? 'password' : type
  return (
    <div>
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
        {label}
        {sensitive && <span className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400">sensitive</span>}
      </label>
      {type === 'select' ? (
        <select className={cls} value={value} onChange={e => onChange(name, e.target.value)}>
          {options?.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea className={cls} rows={rows} value={value} onChange={e => onChange(name, e.target.value)} />
      ) : (
        <input type={inputType} className={cls} value={value} onChange={e => onChange(name, e.target.value)} />
      )}
      {help && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{help}</p>}
    </div>
  )
}

// ── Extra vendor accounts (CY under different creds than DF/VF) ─
// Each account is polled with the shared vendor slot and merged.
function VendorAccountsCard({ cfg, setCfg }) {
  const [testing, setTesting] = useState(null)
  const [results, setResults] = useState({})
  const accounts = Array.isArray(cfg.gps_accounts) ? cfg.gps_accounts : []
  const setAccounts = (list) => setCfg(c => ({ ...c, gps_accounts: list }))
  const upd = (i, k, v) => setAccounts(accounts.map((a, j) => j === i ? { ...a, [k]: v } : a))
  const add = () => setAccounts([...accounts, { label: `Account ${accounts.length + 2}`, company_id: '', user_id: '' }])
  const remove = (i) => {
    setAccounts(accounts.filter((_, j) => j !== i))
    setResults(prev => { const n = { ...prev }; delete n[i]; return n })
  }
  const test = async (i) => {
    const a = accounts[i]
    if (!a?.company_id && !a?.user_id) return
    setTesting(i); setResults(prev => ({ ...prev, [i]: null }))
    try {
      const provider = createGpsProvider(cfg.provider, { ...cfg, enabled: true, company_id: a.company_id, user_id: a.user_id })
      await gpsSyncService.waitForVendorSlot()
      const r = await provider.healthCheck()
      setResults(prev => ({ ...prev, [i]: r }))
    } catch (err) {
      setResults(prev => ({ ...prev, [i]: { ok: false, error: err?.message ?? 'Test failed' } }))
    } finally {
      setTesting(null)
    }
  }
  const inp = 'w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-700 dark:text-slate-200 focus:outline-none'
  return (
    <div className="ap-surface rounded-2xl p-5">
      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Vendor Accounts</p>
      <p className="text-[11px] text-slate-400 mt-0.5 mb-3">
        Primary account above, plus any extra KingsTrack logins (e.g. CY under different company/user IDs). All accounts poll each cycle with shared rate-limiting and merge into one fleet.
      </p>
      <div className="space-y-2">
        {accounts.map((a, i) => {
          const r = results[i]
          return (
            <div key={i} className="rounded-xl border border-[var(--ap-border)] p-3 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input value={a.label || ''} onChange={e => upd(i, 'label', e.target.value)} placeholder="Label" aria-label="Account label" className={inp} />
                <input value={a.company_id || ''} onChange={e => upd(i, 'company_id', e.target.value)} placeholder="Company ID" aria-label="Company ID" className={inp} />
                <input value={a.user_id || ''} onChange={e => upd(i, 'user_id', e.target.value)} placeholder="User ID" aria-label="User ID" className={inp} />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => test(i)} disabled={testing === i || (!a.company_id && !a.user_id)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--ap-border)] text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-[var(--ap-surface-2)] transition-colors disabled:opacity-50">
                  {testing === i ? 'Testing…' : 'Test'}
                </button>
                <button onClick={() => remove(i)} title="Remove account" aria-label="Remove account"
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  <Trash2 size={13} />
                </button>
                {r && (
                  <span className={`text-[11px] font-bold ${r.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                    {r.ok ? `Connected${r.latencyMs != null ? ` (${r.latencyMs} ms)` : ''}` : `Failed: ${r.error || 'connection failed'}`}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <button onClick={add}
        className="mt-3 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-[var(--ap-border)] text-xs font-bold text-slate-500 dark:text-slate-300 hover:bg-[var(--ap-surface-2)] transition-colors">
        <Plus size={13} /> Add Account
      </button>
    </div>
  )
}

// ── Bare field metadata (one row per gps_settings key) ────────
const FIELDS = [
  { key: 'provider',         label: 'GPS Provider',         type: 'select',  options: GPS_PROVIDER_NAMES, help: 'Swappable vendor adapter: kingstrack (APM KingsTrack) or gpstrack (app.gpstrack.in).' },
  { key: 'api_url',          label: 'API URL',              sensitive: true, help: 'Vendor endpoint. kingstrack: POST JSON · gpstrack: GET get_current_data.' },
  { key: 'company_id',       label: 'Company ID',           sensitive: true, providers: ['kingstrack'], help: 'Issued by KingsTrack.' },
  { key: 'user_id',          label: 'User ID',              sensitive: true, providers: ['kingstrack'], help: 'Issued by KingsTrack.' },
  { key: 'api_token',        label: 'API Token',            sensitive: true, providers: ['gpstrack'],   help: 'From app.gpstrack.in → API access.' },
  { key: 'api_email',        label: 'Account Email',        providers: ['gpstrack'],                    help: 'The gpstrack.in login email the token belongs to.' },
  { key: 'refresh_interval', label: 'Refresh Interval (s)', type: 'number',  help: 'Seconds between fleet polls (5–3600).' },
  { key: 'timeout',          label: 'Request Timeout (s)',  type: 'number',  help: 'Per-request timeout (5–300).' },
  { key: 'retry_count',      label: 'Retry Count',          type: 'number',  help: 'Retries on a failed poll (0–10).' },
]

export default function FleetSettings() {
  const { user } = useAuth()
  const [cfg,       setCfg]       = useState(GPS_DEFAULT_SETTINGS)
  const [enabled,   setEnabled]   = useState(GPS_DEFAULT_SETTINGS.enabled)
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [toast,     setToast]     = useState('')
  const [toastErr,  setToastErr]  = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [testing,   setTesting]   = useState(false)
  const [testResult,setTestResult]= useState(null)

  useEffect(() => {
    setLoading(true)
    gpsSettingsRepository.getAsObject()
      .then(s => {
        setCfg({ ...GPS_DEFAULT_SETTINGS, ...s })
        setEnabled(!!s.enabled)
        setLoadError(null)
      })
      .catch(err => {
        console.error('[FleetSettings] load failed:', err)
        setLoadError('Could not load GPS settings. Try refreshing.')
      })
      .finally(() => setLoading(false))
  }, [])

  const update = (k, v) => setCfg(c => {
    const next = { ...c, [k]: v }
    // Switching vendor: swap in that vendor's endpoint unless the URL was customised
    if (k === 'provider' && v !== c.provider) {
      const defaults = { kingstrack: GPS_DEFAULT_SETTINGS.api_url, gpstrack: GPSTRACK_DEFAULT_URL }
      if (!c.api_url || Object.values(defaults).includes(c.api_url)) next.api_url = defaults[v] ?? c.api_url
    }
    return next
  })

  async function handleSave() {
    const errs = gpsSettingsRepository.validate({ ...cfg, enabled })
    if (errs.length) {
      setToastErr(true)
      setToast(errs.join(' • '))
      setTimeout(() => setToast(''), 4000)
      return
    }
    setSaving(true)
    try {
      const result = await gpsSettingsRepository.setMany(
        { ...cfg, enabled },
        { updated_by: user?.name ?? user?.email ?? 'system' }
      )
      if (!result.ok) throw new Error(result.error || 'Save failed')
      addAuditEvent('SETTINGS_UPDATED', {
        description: `GPS settings updated (provider: ${cfg.provider}, enabled: ${enabled})`,
        module: 'security',
        severity: 'info',
      })
      setToastErr(false)
      setToast('GPS settings saved successfully!')
      setTimeout(() => setToast(''), 3000)
    } catch (err) {
      setToastErr(true)
      setToast('Could not save GPS settings: ' + (err?.message ?? 'unknown error'))
      setTimeout(() => setToast(''), 4000)
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const provider = createGpsProvider(cfg.provider, { ...cfg, enabled })
      await gpsSyncService.waitForVendorSlot()
      const result = await provider.healthCheck()
      setTestResult(result)
    } catch (err) {
      setTestResult({ ok: false, error: err?.message ?? 'Test failed' })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="ap-surface rounded-2xl p-8 flex items-center gap-3">
          <Loader2 className="animate-spin text-blue-500" size={20} />
          <span className="text-sm text-slate-500">Loading GPS settings…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-up max-w-3xl mx-auto">
      <PageHeader
        title="GPS Settings"
        subtitle="Configure the GPS provider that powers the live fleet dashboard."
        action={
          <Button variant="primary" icon={Save} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Settings'}
          </Button>
        }
      />

      {loadError && (
        <div className="flex items-start gap-2 p-4 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50">
          <AlertTriangle size={16} className="text-rose-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-rose-600 dark:text-rose-400">{loadError}</p>
        </div>
      )}

      {toast && (
        <div className={`flex items-center gap-2 p-3.5 rounded-xl border ${
          toastErr
            ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800/50 text-rose-600 dark:text-rose-400'
            : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400'
        }`}>
          {toastErr ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
          <p className="text-sm font-medium">{toast}</p>
        </div>
      )}

      <VendorAccountsCard cfg={cfg} setCfg={setCfg} />

      <SectionCard icon={Navigation} title="GPS Provider">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FIELDS.filter(f => !f.providers || f.providers.includes(cfg.provider)).map(f => (
            <Field
              key={f.key}
              label={f.label}
              name={f.key}
              type={f.type}
              value={cfg[f.key] ?? ''}
              onChange={update}
              options={f.options}
              sensitive={f.sensitive}
              help={f.help}
            />
          ))}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[var(--ap-border)]">
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">GPS Sync Enabled</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">When disabled, polling is suspended across the dashboard.</p>
          </div>
          <Toggle checked={enabled} onChange={setEnabled} />
        </div>
      </SectionCard>

      <SectionCard icon={ShieldCheck} title="Connection Test">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Verify the Provider can reach the configured endpoint. This issues a small health-check request and reports latency.
        </p>
        <div className="flex items-center gap-3">
          <Button variant="secondary" icon={RefreshCw} onClick={handleTest} disabled={testing}>
            {testing ? 'Testing…' : 'Test Connection'}
          </Button>
          {testResult && (
            <span className={`text-sm font-medium ${testResult.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
              {testResult.ok
                ? `Connected (${testResult.latencyMs} ms${testResult.mock ? ' • mock' : ''})`
                : `Failed: ${testResult.error || 'Connection test failed'}`}
            </span>
          )}
        </div>
      </SectionCard>

      <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
        Changes take effect on the next polling cycle. The dashboard will pick them up automatically.
      </p>
    </div>
  )
}

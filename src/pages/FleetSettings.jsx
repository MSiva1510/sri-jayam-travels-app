import { gpsSyncService } from '../services/gpsSyncService'
import { useState, useEffect } from 'react'
import { Save, Navigation, Radio, RefreshCw, CheckCircle, AlertTriangle, ShieldCheck, Loader2 } from 'lucide-react'
import Button     from '../components/ui/Button'
import PageHeader from '../components/ui/PageHeader'
import { gpsSettingsRepository, GPS_DEFAULT_SETTINGS } from '../repositories/gpsSettingsRepository'
import { createGpsProvider, parseProviderNames }       from '../services/gpsProvider'
import { GPSTRACK_DEFAULT_URL }                        from '../services/gpsProvider/gpsTrackInProvider'
import { addAuditEvent }                               from '../data/auditLogData'
import { useAuth }                                     from '../context/AuthContext'

// ── Local primitives (mirrors Settings.jsx) ───────────────────
function Toggle({ checked, onChange }) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${checked ? 'bg-[var(--ap-accent)]' : 'bg-[var(--ap-border)]'}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )
}

const inputCls = 'w-full px-3 py-2.5 text-sm rounded-xl border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors font-body'

function Field({ label, value, onChange, type = 'text', help, sensitive, placeholder }) {
  return (
    <div>
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
        {label}
        {sensitive && <span className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400">sensitive</span>}
      </label>
      <input type={type} className={inputCls} value={value} placeholder={placeholder} aria-label={label} onChange={e => onChange(e.target.value)} />
      {help && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{help}</p>}
    </div>
  )
}

// ── The two vendors, each with its 2 credential details ───────
// The sync layer polls every vendor listed in `provider`; each
// credential pair therefore belongs to exactly one tracker.
const VENDOR_CARDS = [
  {
    vendor:     'kingstrack',
    label:      'KingsTrack',
    sub:        'mvt.apmkingstrack.com',
    icon:       Navigation,
    accent:     'text-blue-600 dark:text-blue-400',
    apiDefault: GPS_DEFAULT_SETTINGS.api_url,
    urlHelp:    'POST JSON live endpoint.',
    labelHint:  'e.g. CY',
    details: [
      { key: 'company_id', label: 'Company ID', sensitive: true },
      { key: 'user_id',    label: 'User ID',    sensitive: true },
    ],
  },
  {
    vendor:     'gpstrack',
    label:      'GPSTrack.in',
    sub:        'app.gpstrack.in · 1 call / 30 s',
    icon:       Radio,
    accent:     'text-teal-600 dark:text-teal-400',
    apiDefault: GPSTRACK_DEFAULT_URL,
    urlHelp:    'GET get_current_data endpoint.',
    labelHint:  'e.g. VF, DF',
    details: [
      { key: 'api_token', label: 'API Token',     sensitive: true },
      { key: 'api_email', label: 'Account Email', sensitive: false },
    ],
  },
]

// ── One vendor card: endpoint + its two credentials ───────────
function VendorCard({ def, active, cfg, testing, result, onToggle, onField, onTest }) {
  const Icon = def.icon
  const val = (k) => cfg[k] ?? ''

  return (
    <div className="ap-surface rounded-2xl overflow-hidden flex flex-col">
      <div className="flex items-center gap-2.5 px-5 py-3.5 bg-[var(--ap-surface-2)] border-b border-[var(--ap-border)]">
        <Icon size={15} className={def.accent} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">{def.label}</p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{def.sub}</p>
        </div>
        <Toggle checked={active} onChange={onToggle} />
      </div>

      <div className={`p-5 space-y-4 flex-1 transition-opacity ${active ? '' : 'opacity-50'}`}>
        <Field
          label="Vehicle Group"
          value={val(`${def.vendor}_group_label`)}
          onChange={v => onField(`${def.vendor}_group_label`, v)}
          placeholder={def.labelHint}
          help="Name the vehicle group(s) this tracker covers."
        />
        <Field
          label="API URL"
          value={val(`${def.vendor}_api_url`)}
          onChange={v => onField(`${def.vendor}_api_url`, v)}
          placeholder={def.apiDefault}
          help={def.urlHelp}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {def.details.map(d => (
            <Field
              key={d.key}
              label={d.label}
              type={d.sensitive ? 'password' : 'text'}
              sensitive={d.sensitive}
              value={val(d.key)}
              onChange={v => onField(d.key, v)}
            />
          ))}
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onTest} disabled={!!testing || !active}>
            {testing === def.vendor ? 'Testing…' : 'Test Connection'}
          </Button>
          {result && (
            <span className={`text-[11px] font-bold ${result.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
              {result.ok
                ? `Connected${result.latencyMs != null ? ` (${result.latencyMs} ms)` : ''}${result.devices != null ? ` • ${result.devices} devices` : ''}`
                : `Failed: ${result.error || 'connection failed'}`}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function FleetSettings() {
  const { user } = useAuth()
  const [cfg,       setCfg]       = useState(GPS_DEFAULT_SETTINGS)
  const [enabled,   setEnabled]   = useState(GPS_DEFAULT_SETTINGS.enabled)
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [toast,     setToast]     = useState('')
  const [toastErr,  setToastErr]  = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [testing,   setTesting]   = useState(null)
  const [results,   setResults]   = useState({})

  useEffect(() => {
    setLoading(true)
    gpsSettingsRepository.getAsObject()
      .then(s => {
        const providers = parseProviderNames(s.provider)
        setCfg({
          ...GPS_DEFAULT_SETTINGS,
          ...s,
          provider: providers.length ? providers.join(',') : GPS_DEFAULT_SETTINGS.provider,
        })
        setEnabled(!!s.enabled)
        setLoadError(null)
      })
      .catch(err => {
        console.error('[FleetSettings] load failed:', err)
        setLoadError('Could not load GPS settings. Try refreshing.')
      })
      .finally(() => setLoading(false))
  }, [])

  const active = parseProviderNames(cfg.provider)

  const setField = (key, value) => setCfg(c => ({ ...c, [key]: value }))

  // The fleet can carry devices from several vendors, so this is a set, not a
  // choice: every ticked vendor is polled and the results merged. At least one
  // must stay on.
  const toggleVendor = (name) => setCfg(c => {
    const names = parseProviderNames(c.provider)
    const next  = names.includes(name) ? names.filter(n => n !== name) : [...names, name]
    if (!next.length) return c
    return { ...c, provider: next.join(',') }
  })

  async function testVendor(def) {
    setTesting(def.vendor)
    setResults(prev => ({ ...prev, [def.vendor]: null }))
    try {
      const provider = createGpsProvider(def.vendor, { ...cfg, enabled: true })
      await gpsSyncService.waitForVendorSlot()
      const res = await provider.healthCheck()
      setResults(prev => ({ ...prev, [def.vendor]: res }))
    } catch (err) {
      setResults(prev => ({ ...prev, [def.vendor]: { ok: false, error: err?.message ?? 'Test failed' } }))
    } finally {
      setTesting(null)
    }
  }

  async function handleSave() {
    const payload = {
      provider:         active.join(','),
      enabled,
      refresh_interval: cfg.refresh_interval,
      timeout:          cfg.timeout,
      retry_count:      cfg.retry_count,
    }
    for (const def of VENDOR_CARDS) {
      payload[`${def.vendor}_api_url`]     = cfg[`${def.vendor}_api_url`] ?? ''
      payload[`${def.vendor}_group_label`] = cfg[`${def.vendor}_group_label`] ?? ''
      for (const d of def.details) payload[d.key] = cfg[d.key] ?? ''
    }

    const errs = gpsSettingsRepository.validate(payload)
    if (errs.length) {
      setToastErr(true); setToast(errs.join(' • ')); setTimeout(() => setToast(''), 4000); return
    }
    setSaving(true)
    try {
      const result = await gpsSettingsRepository.setMany(
        payload,
        { updated_by: user?.name ?? user?.email ?? 'system' }
      )
      if (!result.ok) throw new Error(result.error || 'Save failed')
      addAuditEvent('SETTINGS_UPDATED', {
        description: `GPS settings updated (vendors: ${active.join(', ') || 'none'}, enabled: ${enabled})`,
        module: 'security', severity: 'info',
      })
      setToastErr(false); setToast('GPS settings saved successfully!'); setTimeout(() => setToast(''), 3000)
    } catch (err) {
      setToastErr(true)
      setToast('Could not save GPS settings: ' + (err?.message ?? 'unknown error'))
      setTimeout(() => setToast(''), 4000)
    } finally {
      setSaving(false)
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
    <div className="space-y-5 animate-fade-up max-w-5xl mx-auto">
      <PageHeader
        title="GPS Settings"
        subtitle="Configure both GPS vendors side by side. Every enabled vendor is polled and merged into one fleet."
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

      {/* Master switch + shared polling settings */}
      <div className="ap-surface rounded-2xl p-5">
        <div className="flex items-center justify-between pb-4 border-b border-[var(--ap-border)]">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={15} className="text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">GPS Sync Enabled</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">When disabled, polling is suspended across the dashboard.</p>
            </div>
          </div>
          <Toggle checked={enabled} onChange={setEnabled} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4">
          <Field label="Refresh Interval (s)" type="number" value={cfg.refresh_interval}
            onChange={v => setField('refresh_interval', v)} help="5–3600" />
          <Field label="Request Timeout (s)" type="number" value={cfg.timeout}
            onChange={v => setField('timeout', v)} help="5–300" />
          <Field label="Retry Count" type="number" value={cfg.retry_count}
            onChange={v => setField('retry_count', v)} help="0–10" />
        </div>
      </div>

      {/* Two vendors side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {VENDOR_CARDS.map(def => (
          <VendorCard
            key={def.vendor}
            def={def}
            active={active.includes(def.vendor)}
            cfg={cfg}
            testing={testing}
            result={results[def.vendor]}
            onToggle={() => toggleVendor(def.vendor)}
            onField={setField}
            onTest={() => testVendor(def)}
          />
        ))}
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 justify-center">
        <RefreshCw size={12} />
        Changes take effect on the next polling cycle. The dashboard will pick them up automatically.
      </div>
    </div>
  )
}

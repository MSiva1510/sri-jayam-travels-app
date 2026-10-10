import { gpsSyncService } from '../services/gpsSyncService'
import { useState, useEffect } from 'react'
import { Save, Navigation, Radio, RefreshCw, CheckCircle, AlertTriangle, ShieldCheck, Loader2, Plus, Trash2 } from 'lucide-react'
import Button     from '../components/ui/Button'
import PageHeader from '../components/ui/PageHeader'
import { gpsSettingsRepository, GPS_DEFAULT_SETTINGS, GPS_VENDOR_DEFS, defaultVendors } from '../repositories/gpsSettingsRepository'
import { createGpsProvider }                                             from '../services/gpsProvider'
import { addAuditEvent }                                                 from '../data/auditLogData'
import { useAuth }                                                       from '../context/AuthContext'

// ── Local primitives (mirrors Settings.jsx) ───────────────────
function Toggle({ checked, onChange }) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${checked ? 'bg-[var(--ap-accent)]' : 'bg-[var(--ap-border)]'}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )
}

const inputCls = 'w-full px-3 py-2.5 text-sm rounded-xl border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors font-body'

function Field({ label, value, onChange, type = 'text', help }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">{label}</label>
      <input type={type} className={inputCls} value={value} onChange={e => onChange(e.target.value)} />
      {help && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{help}</p>}
    </div>
  )
}

// Provider-settings payload for a single vendor group.
function credsFor(vendor, group = {}) {
  return vendor === 'gpstrack'
    ? { api_token: group.token ?? '', api_email: group.email ?? '' }
    : { company_id: group.company_id ?? '', user_id: group.user_id ?? '' }
}

// ── One vendor card: endpoint + labelled vehicle-group accounts ──
function VendorCard({ def, vendorCfg, onPatch, onGroup, onAddGroup, onRemoveGroup, globalCfg }) {
  const [testing, setTesting] = useState(null)
  const [results,  setResults]  = useState({})
  const groups = Array.isArray(vendorCfg.groups) ? vendorCfg.groups : []
  const style = {
    kingstrack: { icon: Navigation, accent: 'text-blue-600 dark:text-blue-400' },
    gpstrack:   { icon: Radio,      accent: 'text-teal-600 dark:text-teal-400' },
  }[def.vendor] ?? { icon: Navigation, accent: 'text-blue-600 dark:text-blue-400' }
  const Icon = style.icon

  const test = async (i) => {
    const g = groups[i] || {}
    setTesting(i); setResults(prev => ({ ...prev, [i]: null }))
    try {
      const provider = createGpsProvider(def.vendor, {
        ...globalCfg, ...vendorCfg, enabled: true, api_url: vendorCfg.api_url || def.api_url, ...credsFor(def.vendor, g),
      })
      await gpsSyncService.waitForVendorSlot()
      const res = await provider.healthCheck()
      setResults(prev => ({ ...prev, [i]: res }))
    } catch (err) {
      setResults(prev => ({ ...prev, [i]: { ok: false, error: err?.message ?? 'Test failed' } }))
    } finally {
      setTesting(null)
    }
  }

  const inp = 'w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-700 dark:text-slate-200 focus:outline-none'

  return (
    <div className="ap-surface rounded-2xl overflow-hidden flex flex-col">
      <div className="flex items-center gap-2.5 px-5 py-3.5 bg-[var(--ap-surface-2)] border-b border-[var(--ap-border)]">
        <Icon size={15} className={style.accent} />
        <p className="flex-1 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">{def.label}</p>
        <Toggle checked={!!vendorCfg.enabled} onChange={v => onPatch({ enabled: v })} />
      </div>

      <div className="p-5 space-y-4 flex-1">
        <Field
          label="API URL"
          value={vendorCfg.api_url ?? def.api_url}
          onChange={v => onPatch({ api_url: v })}
          help={def.vendor === 'kingstrack' ? 'POST JSON live endpoint.' : 'GET get_current_data endpoint.'}
        />

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Vehicle Groups</p>
            <span className="text-[10px] text-slate-400">{groups.length} configured</span>
          </div>

          <div className="space-y-2">
            {groups.map((g, i) => {
              const r = results[i]
              return (
                <div key={i} className="rounded-xl border border-[var(--ap-border)] p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input value={g.label || ''} onChange={e => onGroup(i, 'label', e.target.value)}
                      placeholder="Group (e.g. CY)" aria-label="Vehicle group label" className={`${inp} font-bold uppercase`} />
                    <button onClick={() => test(i)} disabled={testing === i}
                      className="px-3 py-2 rounded-lg border border-[var(--ap-border)] text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-[var(--ap-surface-2)] transition-colors disabled:opacity-50 flex-shrink-0">
                      {testing === i ? 'Testing…' : 'Test'}
                    </button>
                    <button onClick={() => onRemoveGroup(i)} title="Remove group" aria-label="Remove group"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {def.details.map(d => (
                      <input key={d.key} value={g[d.key] || ''} onChange={e => onGroup(i, d.key, e.target.value)}
                        placeholder={d.label} aria-label={d.label} type={d.sensitive ? 'password' : 'text'} className={inp} />
                    ))}
                  </div>
                  {r && (
                    <span className={`block text-[11px] font-bold ${r.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                      {r.ok ? `Connected${r.latencyMs != null ? ` (${r.latencyMs} ms)` : ''}${r.devices != null ? ` • ${r.devices} devices` : ''}` : `Failed: ${r.error || 'connection failed'}`}
                    </span>
                  )}
                </div>
              )
            })}
            {!groups.length && (
              <p className="text-[11px] text-slate-400 py-1">No vehicle groups yet. Add one per set of {def.label} credentials (e.g. CY, DY, VY).</p>
            )}
          </div>

          <button onClick={() => onAddGroup(def.details.reduce((a, d) => ({ ...a, [d.key]: '' }), { label: '' }))}
            className="mt-3 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-[var(--ap-border)] text-xs font-bold text-slate-500 dark:text-slate-300 hover:bg-[var(--ap-surface-2)] transition-colors">
            <Plus size={13} /> Add Vehicle Group
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FleetSettings() {
  const { user } = useAuth()
  const [cfg,        setCfg]       = useState(GPS_DEFAULT_SETTINGS)
  const [enabled,    setEnabled]   = useState(GPS_DEFAULT_SETTINGS.enabled)
  const [loading,    setLoading]   = useState(true)
  const [saving,     setSaving]    = useState(false)
  const [toast,      setToast]     = useState('')
  const [toastErr,   setToastErr]  = useState(false)
  const [loadError,  setLoadError] = useState(null)

  useEffect(() => {
    setLoading(true)
    gpsSettingsRepository.getAsObject()
      .then(s => {
        setCfg({ ...GPS_DEFAULT_SETTINGS, ...s, gps_vendors: normalizeVendors(s.gps_vendors, s) })
        setEnabled(!!s.enabled)
        setLoadError(null)
      })
      .catch(err => {
        console.error('[FleetSettings] load failed:', err)
        setLoadError('Could not load GPS settings. Try refreshing.')
      })
      .finally(() => setLoading(false))
  }, [])

  const updateVendor = (idx, patch) => setCfg(c => ({
    ...c,
    gps_vendors: c.gps_vendors.map((v, i) => i === idx ? { ...v, ...patch } : v),
  }))
  const updateGroup = (idx, gi, key, val) => setCfg(c => ({
    ...c,
    gps_vendors: c.gps_vendors.map((v, i) => i === idx
      ? { ...v, groups: (v.groups || []).map((g, j) => j === gi ? { ...g, [key]: val } : g) }
      : v),
  }))
  const addGroup = (idx, group) => setCfg(c => ({
    ...c,
    gps_vendors: c.gps_vendors.map((v, i) => i === idx ? { ...v, groups: [...(v.groups || []), group] } : v),
  }))
  const removeGroup = (idx, gi) => setCfg(c => ({
    ...c,
    gps_vendors: c.gps_vendors.map((v, i) => i === idx ? { ...v, groups: (v.groups || []).filter((_, j) => j !== gi) } : v),
  }))

  async function handleSave() {
    const errs = gpsSettingsRepository.validate({ ...cfg, enabled })
    if (errs.length) {
      setToastErr(true); setToast(errs.join(' • ')); setTimeout(() => setToast(''), 4000); return
    }
    setSaving(true)
    try {
      const result = await gpsSettingsRepository.setMany(
        { ...cfg, enabled },
        { updated_by: user?.name ?? user?.email ?? 'system' }
      )
      if (!result.ok) throw new Error(result.error || 'Save failed')
      const active = cfg.gps_vendors.filter(v => v.enabled).map(v => v.vendor).join(', ') || 'none'
      addAuditEvent('SETTINGS_UPDATED', {
        description: `GPS settings updated (vendors: ${active}, enabled: ${enabled})`,
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
        subtitle="Configure both GPS vendors side by side. Each enabled vehicle group is polled and merged into one fleet."
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
            onChange={v => setCfg(c => ({ ...c, refresh_interval: v }))} help="5–3600" />
          <Field label="Request Timeout (s)" type="number" value={cfg.timeout}
            onChange={v => setCfg(c => ({ ...c, timeout: v }))} help="5–300" />
          <Field label="Retry Count" type="number" value={cfg.retry_count}
            onChange={v => setCfg(c => ({ ...c, retry_count: v }))} help="0–10" />
        </div>
      </div>

      {/* Two vendors side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {cfg.gps_vendors.map((v, i) => {
          const def = GPS_VENDOR_DEFS.find(d => d.vendor === v.vendor) ?? GPS_VENDOR_DEFS[0]
          return (
            <VendorCard
              key={v.vendor}
              def={def}
              vendorCfg={v}
              globalCfg={cfg}
              onPatch={(patch) => updateVendor(i, patch)}
              onGroup={(gi, key, val) => updateGroup(i, gi, key, val)}
              onAddGroup={(group) => addGroup(i, group)}
              onRemoveGroup={(gi) => removeGroup(i, gi)}
            />
          )
        })}
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 justify-center">
        <RefreshCw size={12} />
        Changes take effect on the next polling cycle. The dashboard will pick them up automatically.
      </div>
    </div>
  )
}

// Coerce stored/legacy value into [{vendor, enabled, api_url, groups}] covering
// both known vendors, so the grid always shows two cards. When the multi-vendor
// model has never been saved, seed the active vendor's groups from the legacy
// single-provider credentials so nothing is lost on first save.
function normalizeVendors(stored, settings = {}) {
  const base = defaultVendors()
  const list = Array.isArray(stored) ? stored : []
  const provider = settings.provider || 'kingstrack'
  return base.map(def => {
    const found = list.find(v => v && v.vendor === def.vendor)
    const groups = Array.isArray(found?.groups) ? found.groups : (found ? [] : legacyGroups(settings, def.vendor))
    return {
      vendor:  def.vendor,
      enabled: found ? !!found.enabled : (def.vendor === provider && settings.enabled != null ? !!settings.enabled : def.enabled),
      api_url: found?.api_url || def.api_url,
      groups,
    }
  })
}

function legacyGroups(settings = {}, vendor = 'kingstrack') {
  if (settings.provider && settings.provider !== vendor) return []
  if (vendor === 'gpstrack') {
    return (settings.api_token || settings.api_email)
      ? [{ label: 'Primary', token: settings.api_token || '', email: settings.api_email || '' }]
      : []
  }
  const groups = []
  if (settings.company_id || settings.user_id) {
    groups.push({ label: 'Primary', company_id: settings.company_id || '', user_id: settings.user_id || '' })
  }
  ;(Array.isArray(settings.gps_accounts) ? settings.gps_accounts : []).forEach((a, i) => {
    if (a && (a.company_id || a.user_id)) {
      groups.push({ label: a.label || `Account ${i + 2}`, company_id: a.company_id || '', user_id: a.user_id || '' })
    }
  })
  return groups
}

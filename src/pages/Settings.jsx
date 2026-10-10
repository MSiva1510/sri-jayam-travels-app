import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Save, Building, FileText, Bell, Palette, CheckCircle, RotateCcw, AlertTriangle,
  Settings as SettingsIcon, Receipt, Plug, Database, MonitorCog, Download, Trash2,
  Sun, Moon, Monitor, Check, LayoutList, CaseSensitive,
} from 'lucide-react'
import Button     from '../components/ui/Button'
import PageHeader from '../components/ui/PageHeader'
import { useToast } from '../components/ui/Toast'
import { loadSettings, saveSettings, resetSettings, DEFAULT_SETTINGS } from '../data/settingsData'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { getNotificationPreferences, saveNotificationPreferences } from '../services/communicationService'
import { useCommunicationCtx } from '../hooks/useCommunication'
import { gpsSettingsRepository } from '../repositories/gpsSettingsRepository'
import { isSupabaseConfigured } from '../lib/supabase'
import { loadDrivers } from '../data/driverData'
import { loadVehicles } from '../data/vehicleData'
import { loadCustomers } from '../data/customerData'
import { loadBookings } from '../data/tripTypes'
import { exportToCSV } from '../data/reportData'
import { cacheClear } from '../utils/dataCache'

const NOTIF_CHANNELS = [
  { key: 'in_app_enabled',   label: 'In-App Notifications', sub: 'Show notifications inside the app' },
  { key: 'whatsapp_enabled', label: 'WhatsApp',              sub: 'Send WhatsApp messages (needs provider config)' },
  { key: 'sms_enabled',      label: 'SMS',                   sub: 'Send SMS messages (needs provider config)' },
  { key: 'push_enabled',     label: 'Push Notifications',    sub: 'Send push to mobile app (needs app + FCM)' },
  { key: 'email_enabled',    label: 'Email',                 sub: 'Send email notifications' },
]

const COLOR_PAIRS = [
  { key: 'ocean',   label: 'Ocean Blue',   brand: '#2563eb', sb: '#1e3a8f' },
  { key: 'royal',   label: 'Royal Purple', brand: '#7c3aed', sb: '#4c1d95' },
  { key: 'emerald', label: 'Emerald Green', brand: '#10b981', sb: '#14532d' },
  { key: 'sunset',  label: 'Sunset Orange', brand: '#f59e0b', sb: '#7c2d12' },
  { key: 'crimson', label: 'Crimson Red',   brand: '#ef4444', sb: '#7f1d1d' },
  { key: 'teal',    label: 'Ocean Teal',    brand: '#14b8a6', sb: '#134e4a' },
  { key: 'slate',   label: 'Graphite',      brand: '#64748b', sb: '#1f2937' },
]

const TABS = [
  ['general', 'General', Building],
  ['invoice', 'Invoice', Receipt],
  ['notifications', 'Notifications', Bell],
  ['appearance', 'App Appearance', Palette],
  ['integration', 'Integration', Plug],
  ['backup', 'Data & Backup', Database],
  ['system', 'System', MonitorCog],
]

function Toggle({ checked, onChange }) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${checked ? 'bg-blue-600' : 'bg-[var(--ap-border)]'}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )
}

function SectionCard({ icon: Icon, title, sub, children, right }) {
  return (
    <div className="ap-surface rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 bg-[var(--ap-surface-2)] border-b border-[var(--ap-border)]">
        <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white flex-shrink-0">
          <Icon size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 dark:text-white">{title}</p>
          {sub && <p className="text-[11px] text-slate-500 dark:text-slate-400">{sub}</p>}
        </div>
        {right}
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, name, value, onChange, type = 'text', options, rows = 3, required, icon: Icon }) {
  const cls = `w-full px-3 py-2.5 text-sm rounded-xl border border-[var(--ap-border)]
               bg-[var(--ap-surface-2)] text-slate-700 dark:text-slate-200
               focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
               transition-colors font-body ${Icon ? 'pl-9' : ''}`
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        {Icon && <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />}
        {type === 'select' ? (
          <select className={cls} value={value} onChange={e => onChange(name, e.target.value)}>
            {options?.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : type === 'textarea' ? (
          <textarea className={cls} rows={rows} value={value} onChange={e => onChange(name, e.target.value)} />
        ) : (
          <input type={type} className={cls} value={value} onChange={e => onChange(name, e.target.value)} />
        )}
      </div>
    </div>
  )
}

export default function Settings() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { themeMode, setThemeMode, sidebarStyle, setSidebarStyle, fontSize, setFontSize } = useApp()
  const { toast: pushToast } = useToast()
  const [tab, setTab] = useState('general')
  const [cfg,        setCfg]        = useState(DEFAULT_SETTINGS)
  const [loading,    setLoading]    = useState(true)
  const [saved,      setSaved]      = useState(false)
  const [loadError,  setLoadError]  = useState(null)
  const [pairKey, setPairKey] = useState(() => {
    try {
      const raw = localStorage.getItem('sjt-color-pair')
      if (raw) {
        const p = JSON.parse(raw)
        if (p && COLOR_PAIRS.some(c => c.key === p.key)) return p.key
      }
      const brand = localStorage.getItem('sjt_brand_color')
      const hit = COLOR_PAIRS.find(c => c.brand.toLowerCase() === String(brand || '').toLowerCase())
      return hit ? hit.key : 'ocean'
    } catch { return 'ocean' }
  })
  const [prefs,      setPrefs]      = useState(null)
  const [prefsSaving, setPrefsSaving] = useState(false)
  const [logoBusy,   setLogoBusy]   = useState(false)

  const fetchSettings = () => {
    setLoading(true)
    loadSettings()
      .then(s => { setCfg(s); setLoadError(null) })
      .catch(err => { console.error('[Settings] load failed:', err); setLoadError('Could not load settings. Try refreshing.') })
      .finally(() => setLoading(false))
  }
  useEffect(() => { fetchSettings() }, [])
  useEffect(() => {
    if (!user?.id) return
    getNotificationPreferences(user.id).then(setPrefs).catch(() => setPrefs(null))
  }, [user?.id])

  const updateBiz    = (k, v) => setCfg(c => ({ ...c, biz:           { ...c.biz,           [k]: v } }))
  const updateInv    = (k, v) => setCfg(c => ({ ...c, invoice:       { ...c.invoice,       [k]: v } }))

  const pickPair = (key) => {
    const p = COLOR_PAIRS.find(c => c.key === key)
    if (!p) return
    setPairKey(key)
    try {
      const root = document.documentElement
      root.style.setProperty('--sjt-brand', p.brand)
      root.style.setProperty('--sjt-sb', p.sb)
      localStorage.setItem('sjt-color-pair', JSON.stringify({ key, brand: p.brand, sb: p.sb }))
      localStorage.setItem('sjt_brand_color', p.brand)
      localStorage.setItem('sjt_sb_color', p.sb)
      window.dispatchEvent(new Event('sjt:appearance'))
    } catch {}
  }

  const toggleChannel = async (key, v) => {
    if (!user?.id || prefsSaving) return
    const prev = prefs
    setPrefs({ ...(prev || {}), [key]: v })
    setPrefsSaving(true)
    try {
      await saveNotificationPreferences(user.id, { [key]: v })
    } catch {
      setPrefs(prev) // revert on failure
    } finally {
      setPrefsSaving(false)
    }
  }

  const handleLogoFile = (file) => {
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { pushToast({ type: 'error', title: 'Logo too large — max 2MB.' }); return }
    setLogoBusy(true)
    const reader = new FileReader()
    reader.onload = () => { updateBiz('logo', String(reader.result)); setLogoBusy(false); pushToast({ type: 'success', title: 'Logo updated.' }) }
    reader.onerror = () => { setLogoBusy(false); pushToast({ type: 'error', title: 'Could not read logo file.' }) }
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    try {
      await saveSettings(cfg)
      window.dispatchEvent(new Event('sjt:appearance'))
      setSaved(true); pushToast({ type: 'success', title: 'Settings saved successfully!' })
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      pushToast({ type: 'error', title: 'Could not save settings. Please try again.' })
    }
  }

  async function handleReset() {
    if (!window.confirm('Reset all settings to defaults?')) return
    try {
      await resetSettings()
      fetchSettings()
      pickPair('ocean')
      setThemeMode('system')
      setSidebarStyle('default')
      setFontSize(16)
      try {
        localStorage.removeItem('sjt_brand_color'); localStorage.removeItem('sjt_sb_color')
        window.dispatchEvent(new Event('sjt:appearance'))
      } catch {}
      pushToast({ type: 'success', title: 'Settings reset to defaults.' })
    } catch (err) {
      pushToast({ type: 'error', title: 'Could not reset settings. Please try again.' })
    }
  }

  if (loading) {
    return (
      <div className="space-y-5 animate-fade-up">
        <PageHeader title="Settings" subtitle="Manage your business configuration and application preferences" />
        <div className="ap-surface rounded-2xl p-10 text-center text-slate-400 text-sm font-medium">Loading settings…</div>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Settings"
        subtitle="Manage your business configuration and application preferences"
        action={
          <div className="flex items-center gap-2">
            <span className="w-11 h-11 rounded-2xl bg-blue-600 hidden sm:flex items-center justify-center text-white flex-shrink-0">
              <SettingsIcon size={20} />
            </span>
            <Button icon={RotateCcw} variant="secondary" onClick={handleReset}>
              Reset to Defaults
            </Button>
            <Button icon={saved ? CheckCircle : Save} variant="primary" onClick={handleSave}>
              {saved ? 'Saved!' : 'Save Changes'}
            </Button>
          </div>
        }
      />

      {loadError && (
        <div className="bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800/30 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="text-sm font-bold text-red-700 dark:text-red-400">{loadError}</p>
          </div>
          <button onClick={fetchSettings}
            className="px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-400 text-white text-xs font-bold transition-all active:scale-95 shadow-md flex-shrink-0">
            Retry
          </button>
        </div>
      )}

      {/* Tab bar */}
      <div className="overflow-x-auto no-scrollbar">
        <div className="flex gap-1.5 bg-[var(--ap-surface-2)] rounded-2xl p-1.5" style={{ minWidth: 'max-content' }}>
          {TABS.map(([k, l, Icon]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${tab === k ? 'bg-blue-600 text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
              <Icon size={13} />{l}
            </button>
          ))}
        </div>
      </div>

      {tab === 'general' && (
        <SectionCard icon={Building} title="Business Information" sub="Update your company details and contact information">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Business Name" name="name" value={cfg.biz.name} onChange={updateBiz} required />
            <Field label="Phone Number" name="phone" value={cfg.biz.phone} onChange={updateBiz} type="tel" required />
            <Field label="Email Address" name="email" value={cfg.biz.email} onChange={updateBiz} type="email" required />
            <Field label="Website" name="website" value={cfg.biz.website} onChange={updateBiz} type="url" />
            <Field label="GSTIN (Optional)" name="gstin" value={cfg.biz.gstin} onChange={updateBiz} />
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Logo URL / Upload</label>
              <div className="flex items-center gap-2.5">
                <input value={cfg.biz.logo} onChange={e => updateBiz('logo', e.target.value)} placeholder="uploads/logo/sjt-logo.png"
                  className="flex-1 min-w-0 px-3 py-2.5 text-sm rounded-xl border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-body" />
                <label title="Upload logo (max 2MB)"
                  className="w-10 h-10 rounded-xl border border-[var(--ap-border)] flex items-center justify-center text-slate-500 hover:bg-[var(--ap-surface-2)] transition-colors cursor-pointer flex-shrink-0">
                  📤
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleLogoFile(e.target.files?.[0])} />
                </label>
                <div className="w-10 h-10 rounded-full bg-navy-900 dark:bg-[var(--ap-surface-2)] border-2 border-blue-500 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {cfg.biz.logo
                    ? <img src={cfg.biz.logo} alt="Logo" className="w-full h-full object-contain"
                        onError={e => { e.target.style.display = 'none' }} />
                    : <span className="text-white font-semibold text-[10px]">SJT</span>}
                </div>
              </div>
              {logoBusy && <p className="text-[11px] text-slate-400 mt-1">Reading file…</p>}
            </div>
          </div>
          <Field label="Address" name="address" value={cfg.biz.address} onChange={updateBiz} type="textarea" rows={2} required />
          <div className="flex gap-3 pt-1">
            <Button icon={Save} variant="primary" onClick={handleSave}>{saved ? '✓ Saved!' : 'Save All Changes'}</Button>
            <Button icon={RotateCcw} variant="secondary" onClick={handleReset}>Reset to Defaults</Button>
          </div>
        </SectionCard>
      )}

      {tab === 'invoice' && (
        <SectionCard icon={FileText} title="Invoice Settings" sub="Configure invoice number format, currency and defaults">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Invoice Prefix" name="prefix" value={cfg.invoice.prefix} onChange={updateInv} required />
            <Field label="Currency Symbol" name="currency" value={cfg.invoice.currency} onChange={updateInv} type="select" options={['Rs.', '₹', 'INR']} required />
            <Field label="Default Bill Type" name="billType" value={cfg.invoice.billType} onChange={updateInv} type="select" options={['Pay Slip only', 'Invoice only', 'Both']} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Financial Year Start" name="fyStart" value={cfg.invoice.fyStart} onChange={updateInv} type="select" options={['April', 'January']} />
            <Field label="Invoice Footer Text" name="footerText" value={cfg.invoice.footerText} onChange={updateInv} />
          </div>
          <Field label="Terms & Conditions" name="termsText" value={cfg.invoice.termsText} onChange={updateInv} type="textarea" rows={2} />
          <div className="flex items-center justify-between gap-4 py-1">
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Show GSTIN on invoice</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Display GSTIN on generated invoices</p>
            </div>
            <Toggle checked={cfg.invoice.showGSTIN} onChange={v => updateInv('showGSTIN', v)} />
          </div>
          <div className="flex gap-3 pt-1">
            <Button icon={Save} variant="primary" onClick={handleSave}>{saved ? '✓ Saved!' : 'Save All Changes'}</Button>
            <Button icon={RotateCcw} variant="secondary" onClick={handleReset}>Reset to Defaults</Button>
          </div>
        </SectionCard>
      )}

      {tab === 'notifications' && (
        <SectionCard icon={Bell} title="Notification Settings" sub="Choose how you want to receive notifications">
          <p className="text-xs text-slate-500 dark:text-slate-400 -mt-1">
            Your personal channels. Category preferences live under <button onClick={() => navigate('/communications-settings')} className="font-bold text-blue-600 dark:text-blue-400 hover:underline">Communication Settings</button>.
          </p>
          {prefs == null && <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-3">Loading preferences…</p>}
          {NOTIF_CHANNELS.map(t => (
            <div key={t.key} className="flex items-center justify-between gap-4 py-1">
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t.label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.sub}</p>
              </div>
              <Toggle checked={!!prefs?.[t.key]} onChange={v => toggleChannel(t.key, v)} />
            </div>
          ))}
        </SectionCard>
      )}

      {tab === 'appearance' && (
        <div className="space-y-3">
          <SectionCard icon={Sun} title="Theme Mode" sub="Choose how the application looks">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                ['light', 'Light', 'Clean and bright', Sun],
                ['dark', 'Dark', 'Easy on the eyes', Moon],
                ['system', 'System', 'Follow device settings', Monitor],
              ].map(([k, l, s, Icon]) => {
                const active = themeMode === k
                return (
                  <button key={k} onClick={() => setThemeMode(k)}
                    className={`ap-focus flex items-center gap-2.5 px-3.5 py-3 rounded-2xl border-2 text-left transition-all ${active ? 'border-blue-600 bg-blue-600/10 shadow' : 'border-[var(--ap-border)] hover:border-slate-300 hover:border-[var(--ap-accent-2)]'}`}>
                    <Icon size={22} className={active ? 'text-blue-500' : 'text-slate-400'} strokeWidth={1.5} />
                    <span className="flex-1">
                      <span className="block text-sm font-semibold text-slate-800 dark:text-white">{l}</span>
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400">{s}</span>
                    </span>
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${active ? 'border-blue-600 bg-blue-600' : 'border-[var(--ap-border)]'}`}>
                      {active && <Check size={12} className="text-white" />}
                    </span>
                  </button>
                )
              })}
            </div>
          </SectionCard>

          <SectionCard icon={Palette} title="Primary & Sidebar Color" sub="Choose a primary color and its matching sidebar shade (predefined pairs)">
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2.5">
              {COLOR_PAIRS.map(p => {
                const active = pairKey === p.key
                return (
                  <button key={p.key} onClick={() => pickPair(p.key)}
                    className={`ap-focus rounded-2xl border-2 px-2 py-3 text-center transition-all ${active ? 'border-blue-600 shadow' : 'border-[var(--ap-border)] hover:border-slate-300 hover:border-[var(--ap-accent-2)]'}`}>
                    <span className="relative inline-block w-11 h-11 mb-2">
                      <span className="absolute inset-0 rounded-full border border-white/20"
                        style={{ background: `linear-gradient(135deg, ${p.brand} 0 50%, ${p.sb} 50% 100%)` }} />
                      {active && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <Check size={16} className="text-white drop-shadow" />
                        </span>
                      )}
                    </span>
                    <span className="block text-[11px] font-semibold text-slate-800 dark:text-white leading-tight">{p.label}</span>
                  </button>
                )
              })}
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <SectionCard icon={LayoutList} title="Sidebar Style" sub="Choose the navigation sidebar appearance">
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  ['default', 'Default', 'Standard width with labels'],
                  ['compact', 'Compact', 'Icon only (narrow)'],
                  ['minimal', 'Minimal', 'Hidden (hover to show)'],
                ].map(([k, l, s]) => {
                  const active = sidebarStyle === k
                  return (
                    <button key={k} onClick={() => setSidebarStyle(k)}
                      className={`ap-focus rounded-2xl border-2 p-3 text-left transition-all ${active ? 'border-blue-600 shadow' : 'border-[var(--ap-border)] hover:border-slate-300 hover:border-[var(--ap-accent-2)]'}`}>
                      <span className="flex items-center gap-2 mb-1.5">
                        <span className="w-8 h-8 rounded-lg bg-navy-900 dark:bg-[var(--ap-surface-2)] flex items-end gap-[3px] p-1.5">
                          <span className={`rounded-sm bg-blue-400 ${k === 'default' ? 'w-2.5 h-5' : k === 'compact' ? 'w-1.5 h-5' : 'w-1 h-4 opacity-50'}`} />
                          <span className={`flex-1 space-y-[3px] ${k === 'minimal' ? 'opacity-0' : ''}`}>
                            <span className="block h-1 rounded bg-white/40" />
                            <span className="block h-1 rounded bg-white/40" />
                            <span className="block h-1 rounded bg-white/40" />
                          </span>
                        </span>
                        {active && <Check size={14} className="text-white bg-blue-600 rounded-full p-[1px] ml-auto" />}
                      </span>
                      <span className="block text-xs font-semibold text-slate-800 dark:text-white">{l}</span>
                      <span className="block text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">{s}</span>
                    </button>
                  )
                })}
              </div>
            </SectionCard>
            <SectionCard icon={CaseSensitive} title="Text Size" sub="Adjust the application font size">
              <div className="rounded-xl bg-[var(--ap-surface-2)]/70 border border-[var(--ap-border)] px-3.5 py-3">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-400 dark:text-slate-500" style={{ fontSize: 11 }}>A</span>
                  <input type="range" min={12} max={24} step={1} value={fontSize} aria-label="Text size in pixels"
                    onChange={e => setFontSize(Number(e.target.value))}
                    className="flex-1 h-1.5 cursor-pointer accent-blue-600" />
                  <span className="font-semibold text-slate-700 dark:text-slate-200" style={{ fontSize: 17 }}>A</span>
                  <span className="min-w-[60px] text-center px-2 py-1.5 rounded-lg ap-surface border border-[var(--ap-border)] text-sm font-semibold tabular-nums text-slate-800 dark:text-white">
                    {fontSize}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">px</span>
                </div>
                <div className="flex justify-between mt-2 px-[2px]">
                  {[12, 14, 16, 18, 20, 22, 24].map(t => (
                    <button key={t} onClick={() => setFontSize(t)}
                      className={`min-w-[26px] py-0.5 rounded-md text-[10px] font-bold tabular-nums transition-colors ap-focus ${fontSize === t ? 'bg-blue-600 text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-[var(--ap-surface-2)]'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {tab === 'integration' && <IntegrationTab navigate={navigate} />}
      {tab === 'backup' && <BackupTab />}
      {tab === 'system' && <SystemTab user={user} />}
    </div>
  )
}

// ─── Integration tab: live connection statuses ──────────────────
function IntegrationTab({ navigate }) {
  const { providers } = useCommunicationCtx()
  const [gps, setGps] = useState(null)
  useEffect(() => {
    gpsSettingsRepository.getAsObject().then(setGps).catch(() => setGps(null))
  }, [])
  const rows = [
    {
      name: 'Supabase Database', desc: 'App data store',
      ok: isSupabaseConfigured(), detail: (() => { try { return new URL(import.meta.env.VITE_SUPABASE_URL).hostname } catch { return '' } })(),
      to: null,
    },
    {
      name: 'GPS Provider', desc: `Vehicle tracking${gps ? ` · ${gps.provider || 'unset'}` : ''}`,
      ok: gps ? !!gps.enabled : null, detail: gps?.enabled ? 'Enabled' : 'Disabled',
      to: '/fleet/settings',
    },
    ...['whatsapp', 'sms', 'push', 'email', 'webhook'].map(ch => {
      const list = (providers || []).filter(p => p.channel === ch)
      const active = list.find(p => p.is_active)
      return {
        name: ch.charAt(0).toUpperCase() + ch.slice(1), desc: 'Messaging channel',
        ok: active ? true : (list.length ? false : null),
        detail: active ? `Connected via ${active.provider || active.provider_name || 'provider'}` : (list.length ? 'Configured, inactive' : 'Not connected'),
        to: '/communications-settings',
      }
    }),
  ]
  return (
    <div className="ap-surface rounded-2xl p-5 space-y-1">
      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Connected Services</p>
      {rows.map(r => (
        <div key={r.name} className="flex items-center gap-3 py-2.5 border-b border-[var(--ap-border)] last:border-0">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${r.ok == null ? 'bg-slate-300' : r.ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{r.name}</p>
            <p className="text-[11px] text-slate-400">{r.desc}{r.detail ? ` · ${r.detail}` : ''}</p>
          </div>
          <span className={`text-[10px] font-bold flex-shrink-0 ${r.ok == null ? 'text-slate-400' : r.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
            {r.ok == null ? 'Unknown' : r.ok ? 'Connected' : 'Not connected'}
          </span>
          {r.to && (
            <button onClick={() => navigate(r.to)}
              className="px-3 py-1.5 rounded-lg border border-[var(--ap-border)] text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-[var(--ap-surface-2)] transition-colors flex-shrink-0">
              Configure
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Data & Backup tab: real master-data exports ────────────────
function BackupTab() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(null)
  const jobs = [
    ['Drivers', loadDrivers, [['Name', 'name'], ['Mobile', 'mobile'], ['Vehicle', 'vehicle'], ['License', 'license'], ['Status', 'status']], 'drivers'],
    ['Vehicles', loadVehicles, [['Registration', 'reg'], ['Type', 'type'], ['Model', 'model'], ['Status', 'status']], 'vehicles'],
    ['Customers', loadCustomers, [['Name', 'name'], ['Type', 'type'], ['City', 'city'], ['Mobile', 'mobile']], 'customers'],
    ['Bookings', loadBookings, [['Booking No', 'bookingNo'], ['Customer', 'customer'], ['Date', 'startDate'], ['Driver', 'driver'], ['Fare', 'fare'], ['Status', 'status']], 'bookings'],
  ]
  const runExport = async ([label, loader, cols, file]) => {
    setBusy(label)
    try {
      const rows = (await loader()) || []
      exportToCSV(rows, cols.map(([label, key]) => ({ label, key })), file)
    } catch {} finally {
      setBusy(null)
    }
  }
  return (
    <div className="space-y-4">
      <div className="ap-surface rounded-2xl p-5">
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Master Data Export</p>
        <p className="text-[11px] text-slate-400 mb-3">Download full CSV snapshots of each register.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {jobs.map(j => (
            <button key={j[0]} onClick={() => runExport(j)} disabled={busy}
              className="flex items-center justify-between px-4 py-3 rounded-xl border border-[var(--ap-border)] text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-[var(--ap-surface-2)] transition-colors disabled:opacity-50">
              {j[0]}
              <Download size={14} className="text-slate-400" />
            </button>
          ))}
        </div>
        {busy && <p className="text-[11px] text-slate-400 mt-2">Exporting {busy}…</p>}
      </div>
      <div className="ap-surface rounded-2xl p-5 flex items-center gap-3">
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Scheduled Backups</p>
          <p className="text-[11px] text-slate-400">Configure automatic backups and restore points.</p>
        </div>
        <button onClick={() => navigate('/admin/backup')}
          className="px-4 py-2.5 rounded-xl bg-navy-900 dark:bg-blue-700 text-white text-xs font-bold hover:opacity-90 transition-all">
          Open Backup Manager
        </button>
      </div>
    </div>
  )
}

// ─── System tab: real environment facts + cache tools ──────────
function SystemTab({ user }) {
  const [cacheKB, setCacheKB] = useState(null)
  const measure = () => {
    try {
      let bytes = 0
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('sjt')) bytes += (localStorage.getItem(k) || '').length * 2
      }
      setCacheKB(Math.max(1, Math.round(bytes / 1024)))
    } catch { setCacheKB(null) }
  }
  useEffect(() => { measure() }, [])
  const clearCache = () => {
    if (!window.confirm('Clear cached app data? You stay signed in.')) return
    try {
      cacheClear()
      const drop = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('sjt') && !k.startsWith('sjt-theme') && k !== 'sjt_brand_color' && k !== 'sjt_sb_color' && k !== 'sjt_compact' && k !== 'sjt-sidebar-style' && k !== 'sjt-theme-mode' && k !== 'sjt-font-size') drop.push(k)
      }
      drop.forEach(k => localStorage.removeItem(k))
    } catch {}
    window.location.reload()
  }
  let host = ''
  try { host = new URL(import.meta.env.VITE_SUPABASE_URL).hostname } catch {}
  const rows = [
    ['App Version', '1.0.0'],
    ['Environment', import.meta.env.DEV ? 'Development' : 'Production'],
    ['Database', host ? `${isSupabaseConfigured() ? 'Connected · ' : ''}${host}` : 'Not configured'],
    ['Signed in as', `${user?.email || '—'} (${user?.role || '—'})`],
    ['Local cache', cacheKB == null ? '—' : `~${cacheKB} KB`],
  ]
  return (
    <div className="space-y-4">
      <div className="ap-surface rounded-2xl p-5">
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Environment</p>
        <div className="space-y-2">
          {rows.map(([l, v]) => (
            <div key={l} className="flex justify-between gap-3 text-xs">
              <span className="text-slate-400 flex-shrink-0">{l}</span>
              <span className="font-bold text-slate-700 dark:text-slate-200 text-right break-all">{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="ap-surface rounded-2xl p-5 flex items-center gap-3">
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Clear cached data</p>
          <p className="text-[11px] text-slate-400">Refreshes lists, trips and reports from the server. Theme and sign-in are kept.</p>
        </div>
        <button onClick={clearCache}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors flex-shrink-0">
          <Trash2 size={13} /> Clear Cache
        </button>
      </div>
    </div>
  )
}

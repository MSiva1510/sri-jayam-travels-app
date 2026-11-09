// ─── Communication Settings Page ─────────────────────────────
// User notification preferences + provider configuration overview.

import { useState, useEffect } from 'react'
import { Bell, MessageSquare, Smartphone, Globe, Mail, Save, CheckCircle, Info, Plug, Unplug, RefreshCw, Send } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { useCommunicationCtx } from '../hooks/useCommunication'
import { useAuth } from '../context/AuthContext'
import { createProvider, updateProvider } from '../services/communicationService'
import { providerRepository } from '../repositories/communicationRepository'
import {
  getMobilePushSettings, saveMobilePushSettings,
  broadcastMobilePush,
} from '../services/communicationService'
import { loadDrivers } from '../data/driverData'

const CHANNEL_SETTINGS = [
  { key:'in_app_enabled',    label:'In-App Notifications', icon:'🔔', description:'Show notifications inside the app', Icon:Bell,           alwaysOn:true },
  { key:'whatsapp_enabled',  label:'WhatsApp',             icon:'💬', description:'Send WhatsApp messages (requires provider config)', Icon:MessageSquare },
  { key:'sms_enabled',       label:'SMS',                  icon:'📱', description:'Send SMS messages (requires provider config)',       Icon:Smartphone   },
  { key:'push_enabled',      label:'Push Notifications',   icon:'📲', description:'Send push to mobile app (requires app)',             Icon:Bell         },
  { key:'email_enabled',     label:'Email',                icon:'📧', description:'Send email notifications',                           Icon:Mail         },
]

const CATEGORY_SETTINGS = [
  { key:'booking_notifications',     label:'Booking Alerts',    icon:'📋', description:'New, approved, cancelled bookings' },
  { key:'trip_notifications',        label:'Trip Alerts',       icon:'🚗', description:'Trip start, complete, delays'      },
  { key:'expense_notifications',     label:'Expense Alerts',    icon:'💸', description:'Expense approvals and rejections'  },
  { key:'payroll_notifications',     label:'Payroll Alerts',    icon:'💰', description:'Salary and settlement updates'     },
  { key:'vehicle_notifications',     label:'Vehicle Alerts',    icon:'🚘', description:'Service due, document expiry'      },
  { key:'attendance_notifications',  label:'Attendance Alerts', icon:'📅', description:'Missing attendance reminders'      },
  { key:'document_notifications',    label:'Document Alerts',   icon:'📄', description:'Document expiry reminders'         },
  { key:'system_notifications',      label:'System Alerts',     icon:'⚙️', description:'Security and system events'        },
]

// ── Channel connection catalogue ────────────────────────────
// Which providers can be connected per channel + which credential
// fields each connection needs. Saved through the existing
// communication_providers backend (createProvider / updateProvider).
const CHANNEL_CONNECT = [
  { channel:'whatsapp', label:'WhatsApp', icon:'💬',
    providers:['whatsapp_cloud_api','twilio','gupshup','interakt','aisensy','wati','360dialog'],
    fields:[
      { key:'phone_number_id', label:'Phone Number ID' },
      { key:'access_token', label:'Access Token / API Key', type:'password' },
      { key:'business_account_id', label:'Business Account ID' },
    ],
    hint:'Connect the WhatsApp Business API to send trip, invoice and payroll messages.' },
  { channel:'sms', label:'SMS', icon:'📱',
    providers:['twilio','msg91','fast2sms','textlocal'],
    fields:[
      { key:'auth_key', label:'Auth Key / API Key', type:'password' },
      { key:'sender_id', label:'Sender ID' },
      { key:'account_sid', label:'Account SID' },
    ],
    hint:'Connect an SMS gateway for trip updates and OTPs.' },
  { channel:'push', label:'Push', icon:'📲',
    providers:['fcm','apns'],
    fields:[
      { key:'server_key', label:'Server Key', type:'password' },
      { key:'project_id', label:'Project / Sender ID' },
    ],
    hint:'Connect Firebase Cloud Messaging or APNs for driver-app push.' },
  { channel:'email', label:'Email', icon:'📧',
    providers:['smtp','sendgrid'],
    fields:[
      { key:'host', label:'SMTP Host' },
      { key:'port', label:'Port' },
      { key:'username', label:'Username' },
      { key:'password', label:'Password / API Key', type:'password' },
      { key:'from_address', label:'From Address' },
    ],
    hint:'Connect an email sender for invoices and payslips.' },
  { channel:'webhook', label:'Webhook', icon:'🌐',
    providers:['custom'],
    fields:[
      { key:'endpoint_url', label:'Endpoint URL' },
      { key:'secret', label:'Signing Secret', type:'password' },
    ],
    hint:'Forward communication events to an external endpoint.' },
]

function ConnectionCard({ def, row, readOnly, busy, onSave, onDisconnect }) {
  const [provider, setProvider] = useState(row?.provider || def.providers[0])
  const [vals, setVals] = useState(row?.cfg || {})
  const [showKeys, setShowKeys] = useState(false)
  const connected = !!row?.is_active
  const storedOn = row ? (String(row.id).startsWith('prov-local-') ? 'This device' : 'Database') : null

  const setVal = (k, v) => setVals(p => ({ ...p, [k]: v }))
  const handleSave = () => {
    const config = Object.fromEntries(Object.entries(vals).filter(([, v]) => String(v ?? '').trim() !== ''))
    onSave(def.channel, { provider, config, rowId: row?.id })
  }

  return (
    <div className={`rounded-xl p-4 border ${connected ? 'border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-[var(--ap-border)] bg-[var(--ap-surface-2)]'}`}>
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-xl bg-[var(--ap-surface-2)] flex items-center justify-center flex-shrink-0 text-lg shadow-sm">{def.icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{def.label}</p>
          <p className="text-[10px] text-slate-400">{def.hint}</p>
        </div>
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: connected ? '#10b981' : '#94a3b8' }} />
        <span className={`text-[10px] font-bold flex-shrink-0 ${connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
          {connected ? 'Connected' : 'Not connected'}
        </span>
      </div>

      {connected && row?.provider && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
          Via <span className="font-bold">{row.provider}</span>
          {storedOn && <span className="text-slate-400"> · stored: {storedOn}</span>}
        </p>
      )}

      {!readOnly && (
        <div className="space-y-2 mt-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Provider</label>
              <select value={provider} onChange={e => setProvider(e.target.value)}
                className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-700 dark:text-slate-200 focus:outline-none">
                {def.providers.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            {def.fields.map(f => (
              <div key={f.key}>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{f.label}</label>
                <input type={showKeys ? 'text' : (f.type || 'text')} value={vals[f.key] || ''} onChange={e => setVal(f.key, e.target.value)}
                  placeholder={f.label} autoComplete="off"
                  className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-700 dark:text-slate-200 focus:outline-none" />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleSave} disabled={busy}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--ap-accent)] text-white text-xs font-bold hover:opacity-90 transition-all active:scale-95 disabled:opacity-50">
              <Plug size={13} /> {busy ? 'Saving…' : connected ? 'Update Connection' : 'Connect'}
            </button>
            {connected && (
              <button onClick={() => onDisconnect(row)} disabled={busy}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50">
                <Unplug size={13} /> Disconnect
              </button>
            )}
            <button onClick={() => setShowKeys(v => !v)}
              className="px-2.5 py-2 text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
              {showKeys ? 'Hide keys' : 'Show keys'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Toggle({ on, onToggle, disabled }) {
  return (
    <button type="button" onClick={onToggle} disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${on?'bg-[var(--ap-accent)]':'bg-[var(--ap-border)]'} ${disabled?'opacity-50 cursor-not-allowed':''}`}>
      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${on?'left-6':'left-1'}`}/>
    </button>
  )
}

export default function CommunicationSettings() {
  const { user, isAdmin } = useAuth()
  const { preferences, prefLoading, updatePreferences, providers, loadProviders } = useCommunicationCtx()
  const [local, setLocal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [busyChannel, setBusyChannel] = useState(null)
  const [connError, setConnError] = useState('')
  const [connOk, setConnOk] = useState('')
  // ── Mobile app push ─────────────────────────────────────
  const [mpSettings, setMpSettings] = useState(null)
  const [mpDrivers, setMpDrivers] = useState([])
  const [mpSaving, setMpSaving] = useState(false)
  const [bcTitle, setBcTitle] = useState('')
  const [bcBody, setBcBody] = useState('')
  const [bcBusy, setBcBusy] = useState(false)
  const [bcResult, setBcResult] = useState(null)

  useEffect(() => {
    getMobilePushSettings().then(setMpSettings).catch(() => setMpSettings({ enabled: false }))
    loadDrivers().then(d => setMpDrivers(Array.isArray(d) ? d : [])).catch(() => setMpDrivers([]))
  }, [])

  const mpTokens = mpDrivers.filter(d => String(d.push_token || d.pushToken || '').trim() !== '')
  const pushRow = (providers || []).find(p => p.channel === 'push' && p.is_active)
    || (providers || []).find(p => p.channel === 'push')

  const toggleMobilePush = async () => {
    if (!isAdmin || !mpSettings) return
    setMpSaving(true)
    try {
      const next = await saveMobilePushSettings({ enabled: !mpSettings.enabled })
      setMpSettings(next)
    } catch {}
    setMpSaving(false)
  }
  const handleBroadcast = async () => {
    if (!bcBody.trim() || bcBusy) return
    setBcBusy(true); setBcResult(null)
    try {
      const r = await broadcastMobilePush({ title: bcTitle.trim() || 'Sri Jayam Travels', body: bcBody.trim() })
      setBcResult(r)
      if (r.ok) { setBcTitle(''); setBcBody('') }
    } catch {
      setBcResult({ ok: false, reason: 'error', sent: 0, failed: 0, total: 0 })
    }
    setBcBusy(false)
  }

  useEffect(() => {
    if (preferences) setLocal({ ...preferences })
  }, [preferences])

  const toggle = (key) => setLocal(p => ({ ...p, [key]: !p[key] }))

  const handleSave = async () => {
    setSaving(true)
    await updatePreferences(local)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  // ── Channel connections ─────────────────────────────────
  // One active provider per channel. Rows come from the existing
  // communication_providers backend (Supabase or local fallback).
  const rowFor = (channel) => {
    const rows = (providers || []).filter(p => p.channel === channel)
    return rows.find(p => p.is_active) || rows[0] || null
  }
  const cfgFor = (row) => {
    if (!row) return {}
    if (row.config && typeof row.config === 'object' && Object.keys(row.config).length) return row.config
    return providerRepository.getLocalConfig(row.id)
  }
  const flash = (ok, msg) => {
    setConnError(ok ? '' : msg); setConnOk(ok ? msg : '')
    setTimeout(() => { setConnError(''); setConnOk('') }, 3000)
  }
  const handleConnect = async (channel, { provider, config, rowId }) => {
    setBusyChannel(channel)
    try {
      let id = rowId
      if (id) await updateProvider(id, { provider, config, is_active: true })
      else {
        const created = await createProvider({ channel, provider, config, is_active: true })
        id = created?.id
      }
      for (const o of (providers || []).filter(p => p.channel === channel && p.id !== id && p.is_active)) {
        try { await updateProvider(o.id, { is_active: false }) } catch {}
      }
      await loadProviders()
      flash(true, `${channel} connected via ${provider}`)
    } catch {
      flash(false, 'Could not save connection. Please try again.')
    }
    setBusyChannel(null)
  }
  const handleDisconnect = async (row) => {
    if (!row) return
    if (!window.confirm(`Disconnect ${row.channel} (${row.provider || 'provider'})? Messages will stop dispatching on this channel.`)) return
    setBusyChannel(row.channel)
    try {
      await updateProvider(row.id, { is_active: false })
      await loadProviders()
      flash(true, `${row.channel} disconnected`)
    } catch {
      flash(false, 'Could not disconnect. Please try again.')
    }
    setBusyChannel(null)
  }

  if (prefLoading || !local) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 bg-[var(--ap-border)] rounded-xl w-48"/>
      {[1,2,3].map(i=><div key={i} className="h-16 bg-[var(--ap-border)] rounded-xl"/>)}
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        title="Communication Settings"
        subtitle="Manage your notification channels and category preferences"
        action={
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--ap-accent)] text-white font-bold text-sm hover:opacity-90 transition-all shadow-lg active:scale-95 disabled:opacity-50">
            {saved ? <><CheckCircle size={15}/> Saved!</> : saving ? 'Saving…' : <><Save size={15}/> Save Changes</>}
          </button>
        }
      />

      {/* Mobile app push */}
      <div className="ap-surface rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mobile App Push</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Send notifications to the driver mobile app (FCM)</p>
          </div>
          <Toggle on={!!mpSettings?.enabled} onToggle={toggleMobilePush} disabled={!isAdmin || !mpSettings || mpSaving} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="bg-[var(--ap-surface-2)] rounded-xl px-3 py-2.5 border border-[var(--ap-border)]">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide font-bold">Status</p>
            <p className={`text-sm font-semibold ${mpSettings?.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
              {mpSettings ? (mpSettings.enabled ? 'Enabled' : 'Disabled') : '…'}
            </p>
          </div>
          <div className="bg-[var(--ap-surface-2)] rounded-xl px-3 py-2.5 border border-[var(--ap-border)]">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide font-bold">App Registrations</p>
            <p className="text-sm font-semibold tabular-nums">{mpTokens.length} <span className="text-slate-400 font-bold">/ {mpDrivers.length} drivers</span></p>
          </div>
          <div className="bg-[var(--ap-surface-2)] rounded-xl px-3 py-2.5 border border-[var(--ap-border)]">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide font-bold">Push Sender</p>
            <p className="text-sm font-semibold">{pushRow ? (pushRow.provider || pushRow.provider_name || 'Custom') : '—'}</p>
            <p className={`text-[10px] font-bold ${pushRow?.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
              {pushRow?.is_active ? 'Connected' : 'Not connected — connect FCM/APNs above'}
            </p>
          </div>
        </div>
        {isAdmin ? (
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Broadcast to Mobile App</p>
            <input value={bcTitle} onChange={e => setBcTitle(e.target.value)} placeholder="Title (e.g. Trip Update)"
              className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-700 dark:text-slate-200 focus:outline-none" />
            <textarea value={bcBody} onChange={e => setBcBody(e.target.value)} placeholder="Message to all registered driver apps…"
              rows={2}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-700 dark:text-slate-200 focus:outline-none resize-none" />
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={handleBroadcast} disabled={bcBusy || !bcBody.trim() || !mpSettings?.enabled || mpTokens.length === 0}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--ap-accent)] text-white text-xs font-bold hover:opacity-90 transition-all active:scale-95 disabled:opacity-50">
                <Send size={13} /> {bcBusy ? 'Sending…' : `Send to ${mpTokens.length} device${mpTokens.length !== 1 ? 's' : ''}`}
              </button>
              {!mpSettings?.enabled && <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">Enable mobile push first.</span>}
              {mpSettings?.enabled && mpTokens.length === 0 && <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">No driver apps registered yet.</span>}
            </div>
            {bcResult && (
              <p className={`text-xs font-bold ${bcResult.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {bcResult.ok
                  ? `Sent ${bcResult.sent} · Failed ${bcResult.failed} of ${bcResult.total} devices${bcResult.reason === 'sender_not_configured' ? ' — deploy the send-push function (see mobile/FCM_SETUP.md §7).' : ''}`
                  : bcResult.reason === 'disabled' ? 'Mobile push is disabled.'
                  : bcResult.reason === 'no_tokens' ? 'No driver apps registered yet.'
                  : 'Could not send. Please try again.'}
              </p>
            )}
            <p className="text-[10px] text-slate-400">Delivers through the push channel to registered FCM tokens; each delivery is logged in Comm Logs.</p>
          </div>
        ) : (
          <p className="text-[11px] text-slate-400">Broadcasting is managed by the Admin.</p>
        )}
      </div>

      {/* Channel toggles */}
      <div className="ap-surface rounded-2xl p-5 space-y-1">
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Notification Channels</p>
        {CHANNEL_SETTINGS.map(ch => (
          <div key={ch.key} className="flex items-center gap-4 py-3 border-b border-[var(--ap-border)] last:border-0">
            <div className="w-9 h-9 rounded-xl bg-[var(--ap-surface-2)] flex items-center justify-center flex-shrink-0 text-lg">
              {ch.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{ch.label}</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">{ch.description}</p>
            </div>
            <Toggle
              on={ch.alwaysOn || !!local[ch.key]}
              onToggle={() => !ch.alwaysOn && toggle(ch.key)}
              disabled={ch.alwaysOn}
            />
          </div>
        ))}
      </div>

      {/* Category toggles */}
      <div className="ap-surface rounded-2xl p-5 space-y-1">
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Notification Categories</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {CATEGORY_SETTINGS.map(cat => (
            <div key={cat.key} className="flex items-center gap-3 py-2.5 px-1">
              <span className="text-base flex-shrink-0">{cat.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{cat.label}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">{cat.description}</p>
              </div>
              <Toggle on={!!local[cat.key]} onToggle={() => toggle(cat.key)} />
            </div>
          ))}
        </div>
      </div>

      {/* Quiet hours */}
      <div className="ap-surface rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Quiet Hours</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Pause non-critical notifications during these hours</p>
          </div>
          <Toggle on={!!local.quiet_hours_enabled} onToggle={() => toggle('quiet_hours_enabled')} />
        </div>
        {local.quiet_hours_enabled && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Start</label>
              <input type="time" value={local.quiet_hours_start||'22:00'}
                onChange={e=>setLocal(p=>({...p,quiet_hours_start:e.target.value}))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-500/25"/>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">End</label>
              <input type="time" value={local.quiet_hours_end||'07:00'}
                onChange={e=>setLocal(p=>({...p,quiet_hours_end:e.target.value}))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-500/25"/>
            </div>
          </div>
        )}
      </div>

      {/* Channel connections */}
      <div className="ap-surface rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Channel Connections</p>
          <button onClick={loadProviders} title="Refresh connections" aria-label="Refresh connections"
            className="w-7 h-7 rounded-lg border border-[var(--ap-border)] flex items-center justify-center text-slate-400 hover:bg-[var(--ap-surface-2)] transition-colors">
            <RefreshCw size={12} />
          </button>
        </div>
        <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/10 rounded-xl p-3 border border-blue-100 dark:border-blue-800/30">
          <Info size={13} className="text-blue-500 flex-shrink-0 mt-0.5"/>
          <p className="text-[11px] text-blue-700 dark:text-blue-300">
            {isAdmin
              ? 'Connect each channel to its provider API (WhatsApp, SMS, push, email, webhook). Credentials are stored for the sending layer; channels dispatch only through their connected provider.'
              : 'Channel connections are managed by the Admin. Contact your administrator to enable WhatsApp, SMS, or Push channels.'}
          </p>
        </div>
        {connError && <p className="text-xs font-bold text-red-600 dark:text-red-400">{connError}</p>}
        {connOk && <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{connOk}</p>}
        <div className="space-y-2.5">
          {CHANNEL_CONNECT.map(def => {
            const raw = rowFor(def.channel)
            const row = raw ? { ...raw, provider: raw.provider ?? raw.provider_name ?? raw.name ?? '', cfg: cfgFor(raw), is_active: !!raw.is_active } : null
            return (
              <ConnectionCard key={`${def.channel}-${row?.id || 'new'}-${row?.is_active ? 'on' : 'off'}`}
                def={def} row={row} readOnly={!isAdmin}
                busy={busyChannel === def.channel}
                onSave={handleConnect} onDisconnect={handleDisconnect} />
            )
          })}
        </div>
      </div>
    </div>
  )
}

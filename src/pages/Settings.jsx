import { useState } from 'react'
import { Save, Building, FileText, Bell, Palette, Database, CheckCircle, RotateCcw } from 'lucide-react'
import Button     from '../components/ui/Button'
import PageHeader from '../components/ui/PageHeader'
import { loadSettings, saveSettings, resetSettings } from '../data/settingsData'

// ─── Sub-components ───────────────────────────────────────────
function Toggle({ checked, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${checked ? 'bg-blue-600' : 'bg-slate-200 dark:bg-navy-700'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )
}

function SectionCard({ icon: Icon, title, children }) {
  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 bg-slate-50/80 dark:bg-navy-800/60 border-b border-slate-100 dark:border-navy-700">
        <Icon size={15} className="text-navy-700 dark:text-blue-400" />
        <p className="text-xs font-bold text-navy-800 dark:text-slate-200 uppercase tracking-wider">{title}</p>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, name, value, onChange, type = 'text', options, rows = 3 }) {
  const cls = `w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-navy-700
               bg-white dark:bg-navy-800/60 text-slate-700 dark:text-slate-200
               focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
               transition-colors font-body`
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">{label}</label>
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
  )
}

// ─── Main Settings Page ───────────────────────────────────────
export default function Settings() {
  const [cfg,   setCfg]   = useState(() => loadSettings())
  const [saved, setSaved] = useState(false)
  const [toast, setToast] = useState('')

  const updateBiz    = (key, val) => setCfg(c => ({ ...c, biz:           { ...c.biz,           [key]: val } }))
  const updateInv    = (key, val) => setCfg(c => ({ ...c, invoice:       { ...c.invoice,       [key]: val } }))
  const updateNotif  = (key, val) => setCfg(c => ({ ...c, notifications: { ...c.notifications, [key]: val } }))
  const updateAppear = (key, val) => setCfg(c => ({ ...c, appearance:    { ...c.appearance,    [key]: val } }))

  function handleSave() {
    const ok = saveSettings(cfg)
    if (ok) {
      setSaved(true)
      setToast('Settings saved successfully!')
      setTimeout(() => { setSaved(false); setToast('') }, 3000)
    }
  }

  function handleReset() {
    if (!window.confirm('Reset all settings to defaults? This cannot be undone.')) return
    resetSettings()
    setCfg(loadSettings())
    setToast('Settings reset to defaults.')
    setTimeout(() => setToast(''), 3000)
  }

  return (
    <div className="space-y-5 animate-fade-up max-w-3xl">
      <PageHeader
        title="Settings"
        subtitle="Business configuration and app preferences"
        action={
          <Button icon={saved ? CheckCircle : Save} variant="primary" onClick={handleSave}>
            {saved ? 'Saved!' : 'Save Changes'}
          </Button>
        }
      />

      {toast && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl text-sm text-emerald-700 dark:text-emerald-400 font-medium">
          <CheckCircle size={15} className="flex-shrink-0" />
          {toast}
        </div>
      )}

      {/* ── Business Info ── */}
      <SectionCard icon={Building} title="Business Information">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Business Name"    name="name"    value={cfg.biz.name}    onChange={updateBiz} />
          <Field label="Phone Number"     name="phone"   value={cfg.biz.phone}   onChange={updateBiz} type="tel" />
          <Field label="Email Address"    name="email"   value={cfg.biz.email}   onChange={updateBiz} type="email" />
          <Field label="Website"          name="website" value={cfg.biz.website} onChange={updateBiz} type="url" />
          <Field label="GSTIN (optional)" name="gstin"   value={cfg.biz.gstin}   onChange={updateBiz} />
          <Field label="Logo URL"         name="logo"    value={cfg.biz.logo}    onChange={updateBiz} type="url" />
        </div>
        <Field label="Address" name="address" value={cfg.biz.address} onChange={updateBiz} type="textarea" rows={2} />
      </SectionCard>

      {/* ── Invoice Settings ── */}
      <SectionCard icon={FileText} title="Invoice Settings">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Invoice Prefix"    name="prefix"   value={cfg.invoice.prefix}   onChange={updateInv} />
          <Field label="Currency Symbol"   name="currency" value={cfg.invoice.currency} onChange={updateInv} type="select" options={['Rs.', '₹', 'INR']} />
          <Field label="Default Bill Type" name="billType" value={cfg.invoice.billType} onChange={updateInv} type="select" options={['Pay Slip only', 'Invoice only', 'Both']} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Financial Year Start" name="fyStart"    value={cfg.invoice.fyStart}    onChange={updateInv} type="select" options={['April', 'January']} />
          <Field label="Invoice Footer Text"  name="footerText" value={cfg.invoice.footerText} onChange={updateInv} />
        </div>
        <Field label="Terms & Conditions" name="termsText" value={cfg.invoice.termsText} onChange={updateInv} type="textarea" rows={2} />
        <div className="flex items-center justify-between gap-4 py-1">
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Show GSTIN on invoice</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Display GSTIN number on generated invoices</p>
          </div>
          <Toggle checked={cfg.invoice.showGSTIN} onChange={v => updateInv('showGSTIN', v)} />
        </div>
      </SectionCard>

      {/* ── Notifications ── */}
      <SectionCard icon={Bell} title="Notifications & Automation">
        {[
          { key: 'whatsapp',    label: 'WhatsApp invoice to customer', sub: 'Auto-send invoice via WA after bill generation' },
          { key: 'email',       label: 'Email notifications',          sub: 'Send invoice copy to business email'            },
          { key: 'autoInvoice', label: 'Auto-generate bill',           sub: 'Generate PDF automatically after trip entry'    },
        ].map(t => (
          <div key={t.key} className="flex items-center justify-between gap-4 py-1">
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t.label}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{t.sub}</p>
            </div>
            <Toggle checked={cfg.notifications[t.key]} onChange={v => updateNotif(t.key, v)} />
          </div>
        ))}
      </SectionCard>

      {/* ── Appearance ── */}
      <SectionCard icon={Palette} title="Appearance">
        <div className="flex items-center justify-between gap-4 py-1">
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Compact mode</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Reduce spacing for denser data view</p>
          </div>
          <Toggle checked={cfg.appearance.compactMode} onChange={v => updateAppear('compactMode', v)} />
        </div>
      </SectionCard>

      {/* ── Data & Storage ── */}
      <SectionCard icon={Database} title="Data & Storage">
        <div className="space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            All data is stored locally in your browser. Export CSV from the Reports page to back up data.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'sjt_bookings',       label: 'Bookings'   },
              { key: 'sjt_customers',      label: 'Customers'  },
              { key: 'sjt_expenses',       label: 'Expenses'   },
              { key: 'sjt_settlements',    label: 'Payroll'    },
              { key: 'sjt_audit_log',      label: 'Audit Log'  },
              { key: 'sjt_trip_timelines', label: 'Timelines'  },
            ].map(s => {
              let count = 0
              try { const r = localStorage.getItem(s.key); count = r ? JSON.parse(r).length : 0 } catch {}
              return (
                <div key={s.key} className="bg-slate-50 dark:bg-navy-800/60 rounded-xl px-3 py-2.5 flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{s.label}</span>
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{count} records</span>
                </div>
              )
            })}
          </div>
        </div>
      </SectionCard>

      <div className="flex gap-3">
        <Button icon={Save} variant="primary" onClick={handleSave}>
          {saved ? '✓ Saved!' : 'Save All Changes'}
        </Button>
        <Button icon={RotateCcw} variant="secondary" onClick={handleReset}>Reset to Defaults</Button>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Save, Building, FileText, Bell, Palette, Database } from 'lucide-react'
import Button     from '../components/ui/Button'
import PageHeader from '../components/ui/PageHeader'
import { BIZ } from '../data/mockData'

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

function Field({ label, type = 'text', defaultValue, options }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">{label}</label>
      {type === 'select' ? (
        <select
          defaultValue={defaultValue}
          className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-navy-700
                     bg-white dark:bg-navy-800/60 text-slate-700 dark:text-slate-200
                     focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
                     transition-colors font-body"
        >
          {options?.map(o => <option key={o}>{o}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          defaultValue={defaultValue}
          rows={3}
          className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-navy-700
                     bg-white dark:bg-navy-800/60 text-slate-700 dark:text-slate-200
                     focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
                     transition-colors resize-none font-body"
        />
      ) : (
        <input
          type={type}
          defaultValue={defaultValue}
          className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-navy-700
                     bg-white dark:bg-navy-800/60 text-slate-700 dark:text-slate-200
                     focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
                     transition-colors font-body"
        />
      )}
    </div>
  )
}

export default function Settings() {
  const [notifWa,     setNotifWa]     = useState(true)
  const [notifEmail,  setNotifEmail]  = useState(false)
  const [autoInvoice, setAutoInvoice] = useState(true)
  const [darkModeSet, setDarkModeSet] = useState(false)
  const [compactMode, setCompactMode] = useState(false)

  return (
    <div className="space-y-5 animate-fade-up max-w-3xl">
      <PageHeader
        title="Settings"
        subtitle="Business configuration and app preferences"
        action={<Button icon={Save} variant="primary">Save Changes</Button>}
      />

      {/* Business Info */}
      <SectionCard icon={Building} title="Business Information">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Business Name"   defaultValue={BIZ.name}    />
          <Field label="Phone Number"    defaultValue={BIZ.phone}   type="tel"   />
          <Field label="Email Address"   defaultValue={BIZ.email}   type="email" />
          <Field label="Website"         defaultValue={BIZ.website} type="url"   />
        </div>
        <Field label="Address" defaultValue={BIZ.address} type="textarea" />
      </SectionCard>

      {/* Invoice Settings */}
      <SectionCard icon={FileText} title="Invoice Settings">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Invoice Prefix"    defaultValue="SJT"   />
          <Field label="Currency Symbol"   defaultValue="Rs."   type="select" options={['Rs.', '₹', 'INR']} />
          <Field label="Default Bill Type" defaultValue="Both"  type="select" options={['Pay Slip only', 'Invoice only', 'Both']} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Financial Year Start" defaultValue="April" type="select" options={['April','January']} />
          <Field label="Invoice Footer Text"  defaultValue="Thank you for choosing Sri Jayam Travels!" />
        </div>
      </SectionCard>

      {/* Notifications */}
      <SectionCard icon={Bell} title="Notifications & Automation">
        {[
          { label:'WhatsApp invoice to customer', sub:'Auto-send invoice via WA after bill generation', val:notifWa,     set:setNotifWa     },
          { label:'Email notifications',           sub:'Send invoice copy to business email',            val:notifEmail,  set:setNotifEmail  },
          { label:'Auto-generate bill',            sub:'Generate PDF automatically after trip entry',   val:autoInvoice, set:setAutoInvoice },
        ].map(t => (
          <div key={t.label} className="flex items-center justify-between gap-4 py-1">
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t.label}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{t.sub}</p>
            </div>
            <Toggle checked={t.val} onChange={t.set} />
          </div>
        ))}
      </SectionCard>

      {/* Appearance */}
      <SectionCard icon={Palette} title="Appearance">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Theme" defaultValue="Light" type="select" options={['Light','Dark','System']} />
          <Field label="Accent Color" defaultValue="Navy Blue" type="select" options={['Navy Blue','Teal','Violet','Emerald']} />
        </div>
        {[
          { label:'Compact mode', sub:'Reduce spacing for denser data view', val:compactMode, set:setCompactMode },
        ].map(t => (
          <div key={t.label} className="flex items-center justify-between gap-4 py-1">
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t.label}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{t.sub}</p>
            </div>
            <Toggle checked={t.val} onChange={t.set} />
          </div>
        ))}
      </SectionCard>

      {/* Drivers & vehicles quick-add */}
      <SectionCard icon={Database} title="Default Driver Contacts">
        <div className="space-y-3">
          {[
            { name:'Ramanan',      mob:'8754914315' },
            { name:'Babu',         mob:'9894403206' },
            { name:'Rajasekharan', mob:'6383401383' },
          ].map(d => (
            <div key={d.name} className="flex items-center gap-3">
              <input
                defaultValue={d.name}
                className="flex-1 px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800/60 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-body"
              />
              <input
                defaultValue={d.mob}
                className="flex-1 px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800/60 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-body"
              />
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="flex gap-3">
        <Button icon={Save} variant="primary">Save All Changes</Button>
        <Button variant="secondary">Reset to Defaults</Button>
      </div>
    </div>
  )
}

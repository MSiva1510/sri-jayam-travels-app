import { useState } from 'react'
import { Plus, Download, Eye } from 'lucide-react'
import Badge      from '../components/ui/Badge'
import Avatar     from '../components/ui/Avatar'
import Button     from '../components/ui/Button'
import PageHeader from '../components/ui/PageHeader'
import { TRIPS } from '../data/mockData'

const FILTERS = ['All', 'Done', 'Pending']

export default function Invoices() {
  const [filter, setFilter] = useState('All')

  const filtered = filter === 'All' ? TRIPS : TRIPS.filter(t =>
    t.status === filter.toLowerCase()
  )

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Invoices"
        subtitle="Trip bills, pay slips & invoice management"
        action={<Button icon={Plus} variant="primary">New Invoice</Button>}
      />

      {/* Summary chips */}
      <div className="flex gap-3 flex-wrap">
        {[
          { label:'Total Fare', value:`Rs. ${TRIPS.reduce((s,t)=>s+t.fare,0).toLocaleString('en-IN')}`, color:'text-blue-600 dark:text-blue-400' },
          { label:'Invoices Done',    value: TRIPS.filter(t=>t.status==='done').length,    color:'text-emerald-600 dark:text-emerald-400' },
          { label:'Pending',  value: TRIPS.filter(t=>t.status==='pending').length, color:'text-amber-600 dark:text-amber-400' },
        ].map(c => (
          <div key={c.label} className="glass-card rounded-xl px-4 py-2.5 flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">{c.label}</span>
            <span className={`text-sm font-black ${c.color}`}>{c.value}</span>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-navy-800 rounded-xl p-1 w-fit">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filter === f
                ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {f}
            <span className={`ml-1.5 text-[10px] ${filter === f ? 'text-blue-500' : 'text-slate-400'}`}>
              {f === 'All' ? TRIPS.length : TRIPS.filter(t=>t.status===f.toLowerCase()).length}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-navy-700 bg-slate-50/80 dark:bg-navy-800/50">
                {['Invoice No.','Customer','Date','Route','Driver','Vehicle','KM','Fare','Toll','Net Income','Status','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="border-b border-slate-50 dark:border-navy-800 hover:bg-blue-50/40 dark:hover:bg-navy-800/40 transition-colors">
                  <td className="px-4 py-3 text-xs font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">{t.invNo}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={t.customer} size={26} />
                      <div>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">{t.customer}</p>
                        <p className="text-[10px] text-slate-400">{t.contact}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">{t.date}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">{t.source} → {t.destination}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{t.driver}</td>
                  <td className="px-4 py-3 text-xs font-mono text-slate-500 dark:text-slate-400">{t.car}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{t.km} km</td>
                  <td className="px-4 py-3 text-xs font-bold text-navy-800 dark:text-blue-300 whitespace-nowrap">Rs. {t.fare.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{t.toll > 0 ? `Rs. ${t.toll}` : '—'}</td>
                  <td className="px-4 py-3 text-xs font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">Rs. {t.net.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3"><Badge status={t.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors" title="View Invoice">
                        <Eye size={13} />
                      </button>
                      <button className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-navy-700 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-navy-600 transition-colors" title="Download">
                        <Download size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

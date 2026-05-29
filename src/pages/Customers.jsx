import { useState } from 'react'
import { Plus, Phone, MapPin, TrendingUp } from 'lucide-react'
import Avatar     from '../components/ui/Avatar'
import Button     from '../components/ui/Button'
import PageHeader from '../components/ui/PageHeader'
import { uniqueCustomers } from '../data/mockData'

export default function Customers() {
  const [view, setView] = useState('grid')

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Customers"
        subtitle={`${uniqueCustomers.length} unique customers this month`}
        action={
          <div className="flex gap-2">
            <div className="flex bg-slate-100 dark:bg-navy-800 rounded-xl p-1">
              {['grid','list'].map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${view === v ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow' : 'text-slate-500 dark:text-slate-400'}`}>
                  {v === 'grid' ? '⊞ Grid' : '≡ List'}
                </button>
              ))}
            </div>
            <Button icon={Plus} variant="primary">Add Customer</Button>
          </div>
        }
      />

      {view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {uniqueCustomers.map((c, i) => (
            <div key={i} className="glass-card rounded-2xl p-5 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 group">
              <div className="flex items-start gap-3 mb-4">
                <Avatar name={c.name} size={44} />
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-bold text-slate-800 dark:text-white truncate">{c.name}</h3>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500 dark:text-slate-400">
                    <Phone size={11} className="flex-shrink-0" />
                    <span>{c.contact}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                    <MapPin size={11} className="flex-shrink-0" />
                    <span>{c.leadSrc}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label:'Trips',      value: c.trips,                                  color:'text-blue-600 dark:text-blue-400'    },
                  { label:'Total Spent',value:`Rs.${(c.total/1000).toFixed(1)}k`,        color:'text-navy-800 dark:text-blue-300'    },
                  { label:'Last Trip',  value: c.last.slice(0,5),                        color:'text-slate-600 dark:text-slate-300'  },
                ].map(s => (
                  <div key={s.label} className="bg-slate-50/80 dark:bg-navy-800/50 rounded-xl p-2.5 text-center">
                    <p className={`text-sm font-black ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-navy-700 flex justify-between items-center">
                <span className="text-xs text-slate-400 dark:text-slate-500">via {c.leadSrc}</span>
                <div className="flex items-center gap-1 text-emerald-500 text-xs font-bold">
                  <TrendingUp size={11} />
                  <span>Repeat</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-navy-700 bg-slate-50/80 dark:bg-navy-800/50">
                  {['Customer','Mobile','Trips','Total Spent','Last Trip','Lead Source'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {uniqueCustomers.map((c,i) => (
                  <tr key={i} className="border-b border-slate-50 dark:border-navy-800 hover:bg-blue-50/40 dark:hover:bg-navy-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={c.name} size={30} />
                        <span className="font-semibold text-slate-700 dark:text-slate-200 text-xs">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{c.contact}</td>
                    <td className="px-4 py-3 text-xs font-bold text-blue-600 dark:text-blue-400">{c.trips}</td>
                    <td className="px-4 py-3 text-xs font-bold text-navy-800 dark:text-blue-300 whitespace-nowrap">Rs. {c.total.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{c.last}</td>
                    <td className="px-4 py-3"><span className="badge badge-active">{c.leadSrc}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

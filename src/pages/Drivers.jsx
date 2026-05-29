import { Plus, Phone, Star, FileText, Map } from 'lucide-react'
import Avatar     from '../components/ui/Avatar'
import Badge      from '../components/ui/Badge'
import Button     from '../components/ui/Button'
import PageHeader from '../components/ui/PageHeader'
import { driverStats, TRIPS, totalFare } from '../data/mockData'

const STATUS_COLORS = {
  active:    'badge-active',
  'on-leave':'badge-pending',
}

export default function Drivers() {
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Drivers"
        subtitle="Fleet driver management & pay tracking"
        action={<Button icon={Plus} variant="teal">Add Driver</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {driverStats.map(d => {
          const farePct = Math.round((d.fareCollected / totalFare) * 100)
          return (
            <div key={d.id} className="glass-card rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200">
              {/* Header */}
              <div className="bg-gradient-to-br from-navy-900 to-navy-800 p-5 relative overflow-hidden">
                <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/5" />
                <div className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full bg-white/5" />
                <div className="relative flex items-start gap-3">
                  <Avatar name={d.name} size={48} />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-black text-white text-base truncate">{d.name}</h3>
                    <div className="flex items-center gap-1.5 mt-1 text-white/60 text-xs">
                      <Phone size={11} />
                      <span>{d.mobile}</span>
                    </div>
                  </div>
                  {/* Rating badge */}
                  <div className="flex items-center gap-1 bg-amber-400/20 border border-amber-400/30 rounded-full px-2.5 py-1 flex-shrink-0">
                    <Star size={11} className="text-amber-400 fill-amber-400" />
                    <span className="text-xs font-bold text-amber-300">{d.rating}</span>
                  </div>
                </div>
                <div className="relative mt-3 flex gap-2">
                  <span className={`badge ${STATUS_COLORS[d.status] || 'badge-active'} text-[10px]`}>
                    {d.status === 'active' ? '● Active' : '○ On Leave'}
                  </span>
                  <span className="badge badge-active text-[10px]">Joined {d.joined}</span>
                </div>
              </div>

              {/* Body */}
              <div className="p-5">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { label:'Vehicle',    value: d.vehicle     },
                    { label:'Licence',    value: d.license.slice(-8) },
                    { label:'Trips (mo)', value: d.tripCount   },
                    { label:'Total Pay',  value:`Rs. ${d.totalPay.toLocaleString('en-IN')}` },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-50 dark:bg-navy-800/60 rounded-xl p-3">
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wide">{s.label}</p>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Fare share bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-[11px] mb-1.5">
                    <span className="text-slate-500 dark:text-slate-400">Fare share</span>
                    <span className="font-bold text-teal-600 dark:text-teal-400">{farePct}% — Rs. {d.fareCollected.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 rounded-full" style={{ width: `${farePct}%` }} />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button icon={FileText} variant="outline" size="sm" className="flex-1">Pay Slip</Button>
                  <Button icon={Map} variant="ghost" size="sm" className="flex-1">Trips</Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Bata summary table */}
      <div>
        <h3 className="font-display font-black text-slate-800 dark:text-white text-lg mb-3">Bata Ledger</h3>
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-navy-700 bg-slate-50/80 dark:bg-navy-800/50">
                  {['Driver','Trip Date','Route','Vehicle','Bata','Expenses','Total Pay'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TRIPS.slice(0,8).map(t => (
                  <tr key={t.id} className="border-b border-slate-50 dark:border-navy-800 hover:bg-teal-50/40 dark:hover:bg-navy-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={t.driver} size={24} />
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{t.driver}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{t.date}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">{t.source} → {t.destination}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-400">{t.car}</td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200">Rs. {t.bata}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{t.exp > 0 ? `Rs. ${t.exp}` : '—'}</td>
                    <td className="px-4 py-3 text-xs font-bold text-red-600 dark:text-red-400 whitespace-nowrap">Rs. {(t.bata + t.exp).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

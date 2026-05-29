import { Plus } from 'lucide-react'
import Button     from '../components/ui/Button'
import PageHeader from '../components/ui/PageHeader'
import { EXPENSES, expByCategory, totalExp } from '../data/mockData'

const CAT_COLORS = {
  'Car Parts':     'bg-red-500',
  'Car Service':   'bg-blue-500',
  'Other':         'bg-slate-400',
  'GPRS/Tracking': 'bg-violet-500',
  'Cleaning':      'bg-teal-500',
  'Insurance':     'bg-amber-500',
  'Driver Expense':'bg-rose-500',
}

export default function Expenses() {
  const cats = Object.entries(expByCategory).sort((a,b) => b[1]-a[1])

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Expenses"
        subtitle="Monthly operating cost tracker"
        action={<Button icon={Plus} variant="amber">Add Expense</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label:'Total Expenses', value:`Rs. ${totalExp.toLocaleString('en-IN')}`, sub:`${EXPENSES.length} entries`, color:'from-amber-500 to-orange-500' },
          { label:'Largest Item',   value: cats[0]?.[0] ?? '—',                       sub:`Rs. ${cats[0]?.[1]?.toLocaleString('en-IN') ?? 0}`, color:'from-red-500 to-rose-500'   },
          { label:'Avg per Entry',  value:`Rs. ${Math.round(totalExp/EXPENSES.length).toLocaleString('en-IN')}`, sub:'Per expense', color:'from-violet-500 to-purple-500' },
        ].map(c => (
          <div key={c.label} className="glass-card rounded-2xl p-5 relative overflow-hidden">
            <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-20 blur-2xl bg-gradient-to-br ${c.color}`} />
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{c.label}</p>
            <p className="text-2xl font-display font-black text-slate-800 dark:text-white">{c.value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">By Category</p>
          <h3 className="font-display font-black text-slate-800 dark:text-white text-lg mb-4">Breakdown</h3>
          <div className="space-y-3">
            {cats.map(([cat, amt]) => (
              <div key={cat}>
                <div className="flex justify-between text-xs mb-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${CAT_COLORS[cat] || 'bg-slate-400'}`} />
                    <span className="text-slate-600 dark:text-slate-300 font-medium">{cat}</span>
                  </div>
                  <span className="font-bold text-amber-600 dark:text-amber-400">Rs. {amt.toLocaleString('en-IN')}</span>
                </div>
                <div className="h-1.5 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${CAT_COLORS[cat] || 'bg-slate-400'} opacity-80`}
                    style={{ width: `${Math.round((amt/totalExp)*100)}%`, transition:'width .5s' }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5 text-right">{Math.round((amt/totalExp)*100)}%</p>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 glass-card rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-navy-700">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">All Entries</p>
            <h3 className="font-display font-black text-slate-800 dark:text-white text-base">Expense Ledger</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-navy-700 bg-slate-50/80 dark:bg-navy-800/50">
                  {['Date','Description','Category','Amount','Notes'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {EXPENSES.map(e => (
                  <tr key={e.id} className="border-b border-slate-50 dark:border-navy-800 hover:bg-amber-50/40 dark:hover:bg-navy-800/40 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{e.date}</td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-700 dark:text-slate-200 max-w-[200px] truncate">{e.desc}</td>
                    <td className="px-4 py-3">
                      <span className="badge badge-pending text-[10px]">{e.cat}</span>
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-red-600 dark:text-red-400 whitespace-nowrap">Rs. {e.amount.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500">{e.notes || '—'}</td>
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

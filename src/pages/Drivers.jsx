import { useState } from 'react'
import { Plus, Phone, Star, FileText, ChevronRight, TrendingUp } from 'lucide-react'
import Avatar     from '../components/ui/Avatar'
import Badge      from '../components/ui/Badge'
import Button     from '../components/ui/Button'
import PageHeader from '../components/ui/PageHeader'
import { DRIVERS }    from '../data/mockData'
import { loadBookings } from '../data/tripTypes'
import { loadTripPayslips } from '../data/settlementData'
import ModalOverlay from '../components/ui/ModalOverlay'

const STATUS_COLORS = {
  active:     'badge-active',
  'on-leave': 'badge-pending',
}

function DriverModal({ driver, bookings, payslips, onClose }) {
  const mine     = bookings.filter(b => b.driver === driver.name)
  const mySlips  = payslips.filter(p => p.driver === driver.name)
  const totalEarned = mySlips.reduce((s, p) => s + p.net, 0)
  const pendingPay  = mySlips.filter(p => p.status === 'pending').reduce((s, p) => s + p.net, 0)

  return (
    <ModalOverlay center onClose={onClose}>
      <div className="w-full max-w-lg glass-card rounded-3xl overflow-hidden shadow-2xl animate-fade-up" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-br from-navy-900 to-navy-800 p-6">
          <div className="flex items-center gap-4">
            <Avatar name={driver.name} size={52} />
            <div className="flex-1">
              <h2 className="font-display font-black text-white text-xl">{driver.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`badge ${STATUS_COLORS[driver.status] || 'badge-active'} text-[10px]`}>
                  {driver.status === 'active' ? '● Active' : '○ On Leave'}
                </span>
                <span className="flex items-center gap-1 text-amber-300 text-xs font-bold">
                  <Star size={11} className="fill-amber-400 text-amber-400" /> {driver.rating}
                </span>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/10 text-white/70 flex items-center justify-center hover:bg-white/20 transition-colors text-sm font-bold">✕</button>
          </div>
        </div>
        {/* Body */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label:'Mobile',    value: driver.mobile  },
              { label:'Vehicle',   value: driver.vehicle },
              { label:'Licence',   value: driver.license },
              { label:'Joined',    value: driver.joined  },
            ].map(r => (
              <div key={r.label} className="bg-slate-50 dark:bg-navy-800/60 rounded-xl p-3">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">{r.label}</p>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">{r.value}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label:'Total Trips',    value: mine.length,                                          color:'text-blue-600 dark:text-blue-400' },
              { label:'Total Earned',   value:`Rs.${(totalEarned/1000).toFixed(1)}k`,               color:'text-emerald-600 dark:text-emerald-400' },
              { label:'Pending Pay',    value:`Rs.${(pendingPay/1000).toFixed(1)}k`,                color:'text-amber-600 dark:text-amber-400' },
            ].map(s => (
              <div key={s.label} className="bg-slate-50 dark:bg-navy-800/60 rounded-xl p-3 text-center">
                <p className={`text-base font-black ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          {/* Recent trips */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Recent Trips</p>
            {mine.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No trips yet</p>
            ) : (
              <div className="space-y-1.5">
                {mine.slice(0, 5).map(b => (
                  <div key={b.id} className="flex items-center gap-3 px-3 py-2 bg-slate-50 dark:bg-navy-800/50 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{b.customer}</p>
                      <p className="text-[10px] text-slate-400 truncate">{b.pickup} → {b.drop}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{b.fare ? `Rs.${b.fare.toLocaleString('en-IN')}` : '—'}</p>
                      <p className="text-[10px] text-slate-400">{b.startDate}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalOverlay>
  )
}

export default function Drivers() {
  const [selected, setSelected] = useState(null)
  const bookings = loadBookings()
  const payslips = loadTripPayslips()

  // Compute live stats per driver from real bookings + payslips
  const driversWithStats = DRIVERS.map(d => {
    const mine      = bookings.filter(b => b.driver === d.name)
    const mySlips   = payslips.filter(p => p.driver === d.name)
    const completed = mine.filter(b => b.status === 'completed').length
    const totalFare = mine.reduce((s, b) => s + (b.fare || 0), 0)
    const totalPay  = mySlips.reduce((s, p) => s + p.net, 0)
    return { ...d, tripCount: completed, fareCollected: totalFare, totalPay }
  })

  const totalAllFare = driversWithStats.reduce((s, d) => s + d.fareCollected, 0) || 1

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Drivers"
        subtitle={`${DRIVERS.length} drivers · fleet management`}
        action={<Button icon={Plus} variant="teal">Add Driver</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {driversWithStats.map(d => {
          const farePct = Math.round((d.fareCollected / totalAllFare) * 100)
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
                  <div className="flex items-center gap-1 bg-amber-400/20 border border-amber-400/30 rounded-full px-2.5 py-1 flex-shrink-0">
                    <Star size={11} className="text-amber-400 fill-amber-400" />
                    <span className="text-xs font-bold text-amber-300">{d.rating}</span>
                  </div>
                </div>
                <div className="relative mt-3 flex gap-2 flex-wrap">
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
                    { label: 'Vehicle',     value: d.vehicle },
                    { label: 'Licence',     value: d.license?.slice(-8) || '—' },
                    { label: 'Trips Done',  value: d.tripCount },
                    { label: 'Total Pay',   value: `Rs. ${d.totalPay.toLocaleString('en-IN')}` },
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
                    <div className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 rounded-full transition-all" style={{ width: `${farePct}%` }} />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button icon={TrendingUp} variant="outline" size="sm" className="flex-1" onClick={() => setSelected(d)}>Details</Button>
                  <Button icon={FileText}   variant="ghost"   size="sm" className="flex-1" onClick={() => setSelected(d)}>Trips</Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Live Bata Ledger — from real bookings + payslips */}
      <div>
        <h3 className="font-display font-black text-slate-800 dark:text-white text-lg mb-3">Bata Ledger</h3>
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-navy-700 bg-slate-50/80 dark:bg-navy-800/50">
                  {['Driver','Date','Route','Vehicle','Fare','Bata','Net Pay','Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payslips.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                      No payslips yet — complete a trip to generate a payslip
                    </td>
                  </tr>
                ) : payslips.slice(0, 20).map(p => (
                  <tr key={p.id} className="border-b border-slate-50 dark:border-navy-800 hover:bg-teal-50/40 dark:hover:bg-navy-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={p.driver} size={24} />
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{p.driver}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{p.date}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap max-w-[180px] truncate">{p.pickup} → {p.drop}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-400">{p.vehicle || '—'}</td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200">Rs. {p.fare.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-xs text-emerald-600 dark:text-emerald-400">{p.bata > 0 ? `Rs. ${p.bata}` : '—'}</td>
                    <td className="px-4 py-3 text-xs font-bold text-navy-700 dark:text-blue-300 whitespace-nowrap">Rs. {p.net.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        p.status === 'paid'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>
                        {p.status === 'paid' ? '✓ Paid' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selected && (
        <DriverModal
          driver={selected}
          bookings={bookings}
          payslips={payslips}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

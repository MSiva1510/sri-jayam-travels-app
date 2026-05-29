import { Plus, Wrench, Shield, Fuel, Gauge } from 'lucide-react'
import Badge      from '../components/ui/Badge'
import Button     from '../components/ui/Button'
import PageHeader from '../components/ui/PageHeader'
import Avatar     from '../components/ui/Avatar'
import { VEHICLES, TRIPS } from '../data/mockData'

export default function Vehicles() {
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Vehicles"
        subtitle="Fleet management, servicing & insurance tracking"
        action={<Button icon={Plus} variant="primary">Add Vehicle</Button>}
      />

      {/* Fleet summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label:'Total Vehicles',    value: VEHICLES.length,                                    color:'text-blue-600 dark:text-blue-400'    },
          { label:'Active',            value: VEHICLES.filter(v=>v.status==='active').length,      color:'text-emerald-600 dark:text-emerald-400' },
          { label:'In Maintenance',    value: VEHICLES.filter(v=>v.status==='maintenance').length, color:'text-red-600 dark:text-red-400'       },
        ].map(s => (
          <div key={s.label} className="glass-card rounded-xl p-4 text-center">
            <p className={`text-3xl font-display font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Vehicle cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {VEHICLES.map(v => {
          const vTrips     = TRIPS.filter(t => t.car === v.reg)
          const vFare      = vTrips.reduce((s, t) => s + t.fare, 0)
          const isMaint    = v.status === 'maintenance'
          return (
            <div key={v.id} className={`glass-card rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 ${isMaint ? 'border-red-200 dark:border-red-900/50' : ''}`}>
              {/* Header */}
              <div className={`p-5 relative overflow-hidden ${isMaint ? 'bg-gradient-to-br from-red-900 to-rose-800' : 'bg-gradient-to-br from-navy-900 to-navy-800'}`}>
                <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/5" />
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest mb-0.5">Registration</p>
                    <h3 className="font-display font-black text-white text-xl tracking-widest">{v.reg}</h3>
                    <p className="text-white/60 text-sm mt-1">{v.model} · {v.year}</p>
                  </div>
                  <Badge status={v.status} />
                </div>
                <div className="relative mt-3 flex gap-2 flex-wrap">
                  <span className="badge badge-active text-[10px]">{v.type}</span>
                  <span className="badge badge-active text-[10px]">{v.fuelType}</span>
                  <span className="badge badge-active text-[10px]">{v.color}</span>
                </div>
              </div>

              {/* Stats */}
              <div className="p-5">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { icon: Gauge,  label:'Odometer',     value:`${v.km.toLocaleString()} km` },
                    { icon: Shield, label:'Insurance',     value: v.ins                        },
                    { icon: Wrench, label:'Last Service',  value: v.lastService                },
                    { icon: Wrench, label:'Next Service',  value: v.nextService                },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-50 dark:bg-navy-800/60 rounded-xl p-3 flex items-start gap-2">
                      <s.icon size={13} className="text-slate-400 dark:text-slate-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wide">{s.label}</p>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">{s.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Driver */}
                <div className="flex items-center gap-2.5 p-3 bg-slate-50 dark:bg-navy-800/60 rounded-xl mb-4">
                  <Avatar name={v.driver} size={30} />
                  <div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold">Assigned Driver</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{v.driver}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">{vTrips.length} trips</p>
                    <p className="text-xs font-bold text-navy-800 dark:text-blue-300">Rs. {vFare.toLocaleString('en-IN')}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button icon={Wrench} variant="outline" size="sm" className="flex-1">Service Log</Button>
                  <Button icon={Fuel}   variant="ghost"   size="sm" className="flex-1">Fuel Log</Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

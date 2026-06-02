import { useState } from 'react'
import { Plus, Wrench, Shield, Fuel, Gauge, X, CheckCircle } from 'lucide-react'
import Badge      from '../components/ui/Badge'
import Button     from '../components/ui/Button'
import PageHeader from '../components/ui/PageHeader'
import Avatar     from '../components/ui/Avatar'
import { VEHICLES, TRIPS, DRIVERS } from '../data/mockData'
import { saveVehicleAssignment, loadVehicleAssignments } from '../data/attendanceData'

// ── Vehicle Assignment Modal ───────────────────────────────────
// Fix 5: shown when driver transitions Offline → Available
function AssignmentModal({ vehicle, onClose, onConfirm }) {
  const [selectedDriver, setSelectedDriver] = useState(vehicle.driver || '')
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' })
  const timeStr = now.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })

  const handleConfirm = () => {
    const record = {
      vehicleReg:  vehicle.reg,
      vehicleType: vehicle.type,
      vehicleModel:vehicle.model,
      driverId:    DRIVERS.find(d => d.name === selectedDriver)?.id || null,
      driverName:  selectedDriver,
      assignedDate:now.toISOString().slice(0,10),
      assignedTime:timeStr,
      assignedAt:  now.toISOString(),
    }
    saveVehicleAssignment(record)
    onConfirm(record)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:w-96 bg-white dark:bg-navy-900 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl z-10">
        <div className="w-10 h-1 bg-slate-200 dark:bg-navy-700 rounded-full mx-auto mb-4 sm:hidden" />

        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vehicle Assignment</p>
            <h3 className="font-display font-black text-slate-800 dark:text-white text-base">{vehicle.reg}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{vehicle.model} · {vehicle.type}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-navy-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Assignment details */}
        <div className="bg-slate-50 dark:bg-navy-800/60 rounded-xl p-3 mb-4 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Date</span>
            <span className="font-bold text-slate-700 dark:text-slate-200">{dateStr}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Time</span>
            <span className="font-bold text-slate-700 dark:text-slate-200">{timeStr}</span>
          </div>
        </div>

        {/* Driver selector */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
            Assign Driver
          </label>
          <div className="space-y-2">
            {DRIVERS.map(d => (
              <button key={d.id} onClick={() => setSelectedDriver(d.name)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                  selectedDriver === d.name
                    ? 'border-navy-400 bg-navy-50 dark:bg-navy-800 ring-2 ring-navy-400/30'
                    : 'border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800/40 hover:bg-slate-50 dark:hover:bg-navy-800'
                }`}>
                <Avatar name={d.name} size={28} />
                <div className="flex-1 text-left">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{d.name}</p>
                  <p className="text-[10px] text-slate-400">{d.vehicle} · {d.vehicleType}</p>
                </div>
                {selectedDriver === d.name && <CheckCircle size={16} className="text-navy-600 dark:text-blue-400 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={!selectedDriver}
            className="flex-1 py-2.5 rounded-xl bg-navy-900 dark:bg-blue-700 text-white text-sm font-bold hover:bg-navy-800 dark:hover:bg-blue-600 transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed active:scale-95">
            Confirm Assignment
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Vehicles() {
  const [assignModal,  setAssignModal]  = useState(null)  // vehicle object or null
  const [assignments,  setAssignments]  = useState(() => loadVehicleAssignments())
  const [successMsg,   setSuccessMsg]   = useState('')

  const getAssignment = (reg) => assignments.find(a => a.vehicleReg === reg)

  const handleAssigned = (record) => {
    setAssignments(loadVehicleAssignments())
    setAssignModal(null)
    setSuccessMsg(`${record.vehicleReg} assigned to ${record.driverName}`)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Vehicles"
        subtitle="Fleet management, servicing & insurance tracking"
        action={<Button icon={Plus} variant="primary">Add Vehicle</Button>}
      />

      {/* Success toast */}
      {successMsg && (
        <div className="flex items-center gap-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl px-4 py-2.5">
          <CheckCircle size={15} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{successMsg}</p>
        </div>
      )}

      {/* Fleet summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label:'Total Vehicles',  value: VEHICLES.length,                                    color:'text-blue-600 dark:text-blue-400'       },
          { label:'Active',          value: VEHICLES.filter(v=>v.status==='active').length,      color:'text-emerald-600 dark:text-emerald-400' },
          { label:'In Maintenance',  value: VEHICLES.filter(v=>v.status==='maintenance').length, color:'text-red-600 dark:text-red-400'         },
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
          const assignment = getAssignment(v.reg)
          const assignedDriver = assignment?.driverName || v.driver

          return (
            <div key={v.id}
              className={`glass-card rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 ${isMaint ? 'border-red-200 dark:border-red-900/50' : ''}`}>

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
                    { icon: Gauge,  label:'Odometer',    value:`${v.km.toLocaleString()} km` },
                    { icon: Shield, label:'Insurance',    value: v.ins                        },
                    { icon: Wrench, label:'Last Service', value: v.lastService                },
                    { icon: Wrench, label:'Next Service', value: v.nextService                },
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

                {/* Current assignment */}
                <div className="flex items-center gap-2.5 p-3 bg-slate-50 dark:bg-navy-800/60 rounded-xl mb-3">
                  <Avatar name={assignedDriver} size={30} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold">Assigned Driver</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{assignedDriver}</p>
                    {assignment && (
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">
                        Since {assignment.assignedDate} {assignment.assignedTime}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">{vTrips.length} trips</p>
                    <p className="text-xs font-bold text-navy-800 dark:text-blue-300">Rs. {vFare.toLocaleString('en-IN')}</p>
                  </div>
                </div>

                {/* Fix 5: Assign Vehicle button */}
                <div className="flex gap-2">
                  <Button icon={Wrench} variant="outline" size="sm" className="flex-1">Service Log</Button>
                  <button
                    onClick={() => setAssignModal(v)}
                    className="flex-1 py-1.5 px-3 rounded-xl bg-navy-900 dark:bg-blue-700 text-white text-xs font-bold hover:bg-navy-800 dark:hover:bg-blue-600 transition-all active:scale-95 shadow-md">
                    Assign Driver
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Assignment modal */}
      {assignModal && (
        <AssignmentModal
          vehicle={assignModal}
          onClose={() => setAssignModal(null)}
          onConfirm={handleAssigned}
        />
      )}
    </div>
  )
}

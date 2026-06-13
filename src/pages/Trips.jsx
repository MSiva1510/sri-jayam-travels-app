import { useState, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Plus, Search, ChevronDown, ChevronUp,
  Calendar, Car, User, MapPin,
  CheckCircle, X, Edit2, Trash2, UserCheck,
  ChevronLeft, ChevronRight, AlertTriangle,
} from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import Avatar     from '../components/ui/Avatar'
import { useAuth } from '../context/AuthContext'
import {
  TRIP_TYPE_CONFIG, TRIP_TYPE_LIST, BOOKING_STATUSES,
  DRIVER_AVAIL_CFG, VEHICLE_AVAIL_CFG,
  getStatusCfg, getDriverAvailability, getVehicleAvailability,
  generateBookingNumber, loadBookings, saveBooking, deleteBooking,
} from '../data/tripTypes'
import { DRIVERS, VEHICLES } from '../data/mockData'

// ─────────────────────────────────────────────────────────────
//  Shared primitives
// ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = getStatusCfg(status)
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function TypeBadge({ type }) {
  const cfg = TRIP_TYPE_CONFIG[type]
  if (!cfg) return null
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full ${cfg.badge}`}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

function AvailDot({ avail, cfgMap }) {
  const cfg = cfgMap[avail] || cfgMap.available
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function FieldLabel({ children, required }) {
  return (
    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
      {children}{required && <span className="text-red-500 ml-1">*</span>}
    </label>
  )
}

function Input({ value, onChange, placeholder, type = 'text', required, field }) {
  const handleChange = (e) => {
    let v = e.target.value
    // Phone field: digits only, max 10
    if (field === 'contact') { v = v.replace(/\D/g, '').slice(0, 10) }
    // Name/customer: letters, spaces, basic punctuation only, max 60
    if (field === 'customer') { v = v.slice(0, 60); if (v.length > 0 && !/^[a-zA-Z0-9\s\-'.&()]*$/.test(v)) v = v.slice(0, -1) }
    // Locations: alphanumeric + common punctuation, max 100
    if (field === 'pickup' || field === 'drop') { v = v.slice(0, 100) }
    // Fare: positive numbers only
    if (type === 'number' && field === 'fare') { if (Number(v) < 0) v = '0' }
    onChange({ target: { value: v } })
  }
  return (
    <input type={type} value={value} onChange={handleChange} placeholder={placeholder} required={required}
      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800/60
                 text-slate-800 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 text-sm
                 focus:outline-none focus:ring-2 focus:ring-navy-500/25 focus:border-navy-400 transition-all font-body" />
  )
}

function Select({ value, onChange, children, required }) {
  return (
    <select value={value} onChange={onChange} required={required}
      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800/60
                 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/25
                 focus:border-navy-400 transition-all font-body appearance-none">
      {children}
    </select>
  )
}

function Grid2({ children }) { return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div> }

// ─────────────────────────────────────────────────────────────
//  Create / Edit Booking Modal
// ─────────────────────────────────────────────────────────────
function BookingModal({ booking, onClose, onSave, userName }) {
  const isEdit = !!booking?.bookingNo
  const [form, setForm] = useState(() => booking || {
    customer:'', contact:'', type:'one_way',
    pickup:'', drop:'', startDate:'', startTime:'',
    returnDate:'', returnTime:'', notes:'',
    fare:'', status:'draft',
  })
  const [errors, setErrors] = useState({})

  const upd = patch => setForm(f => ({ ...f, ...patch }))

  const validate = () => {
    const e = {}
    if (!form.customer.trim()) e.customer = 'Required'
    if (!form.type)            e.type     = 'Required'
    if (!form.pickup.trim())   e.pickup   = 'Required'
    if (!form.startDate)       e.startDate = 'Required'
    return e
  }

  const handleSave = () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    const now = new Date().toISOString()
    const saved = {
      ...form,
      id:        form.id        || generateBookingNumber(),
      bookingNo: form.bookingNo || generateBookingNumber(),
      fare:      Number(form.fare) || 0,
      createdAt: form.createdAt || now,
      updatedAt: now,
      createdBy: form.createdBy || userName || 'manager',
      driver:    form.driver    || null,
      vehicle:   form.vehicle   || null,
    }
    onSave(saved)
  }

  const typeCfg = TRIP_TYPE_CONFIG[form.type]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:w-[520px] max-h-[92vh] sm:max-h-[85vh] bg-white dark:bg-navy-900 rounded-t-3xl sm:rounded-2xl shadow-2xl z-10 flex flex-col">
        {/* Handle */}
        <div className="w-10 h-1 bg-slate-200 dark:bg-navy-700 rounded-full mx-auto mt-3 mb-1 sm:hidden flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-navy-700 flex-shrink-0">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{isEdit ? 'Edit Booking' : 'New Booking'}</p>
            <h3 className="font-display font-black text-slate-800 dark:text-white text-base">
              {isEdit ? form.bookingNo : 'Create Booking'}
            </h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-navy-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* Customer */}
          <Grid2>
            <div>
              <FieldLabel required>Customer Name</FieldLabel>
              <Input value={form.customer} onChange={e => upd({ customer: e.target.value })} placeholder="Full name or company" required field="customer" />
              {errors.customer && <p className="text-xs text-red-500 mt-1">{errors.customer}</p>}
            </div>
            <div>
              <FieldLabel>Contact</FieldLabel>
              <Input type="tel" value={form.contact} onChange={e => upd({ contact: e.target.value })} placeholder="10-digit mobile" field="contact" />
            </div>
          </Grid2>

          {/* Trip type */}
          <div>
            <FieldLabel required>Trip Type</FieldLabel>
            <Select value={form.type} onChange={e => upd({ type: e.target.value })} required>
              {TRIP_TYPE_LIST.map(t => (
                <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
              ))}
            </Select>
            {errors.type && <p className="text-xs text-red-500 mt-1">{errors.type}</p>}
          </div>

          {/* Pickup / Drop */}
          <div>
            <FieldLabel required>Pickup Location</FieldLabel>
            <Input value={form.pickup} onChange={e => upd({ pickup: e.target.value })} placeholder="e.g. Hotel Atithi, Puducherry" required field="pickup" />
            {errors.pickup && <p className="text-xs text-red-500 mt-1">{errors.pickup}</p>}
          </div>
          <div>
            <FieldLabel>Drop / Destination</FieldLabel>
            <Input value={form.drop} onChange={e => upd({ drop: e.target.value })} placeholder="e.g. Chennai Airport" field="drop" />
          </div>

          {/* Dates */}
          <Grid2>
            <div>
              <FieldLabel required>Pickup Date</FieldLabel>
              <Input type="date" value={form.startDate} onChange={e => upd({ startDate: e.target.value })} required />
              {errors.startDate && <p className="text-xs text-red-500 mt-1">{errors.startDate}</p>}
            </div>
            <div>
              <FieldLabel>Pickup Time</FieldLabel>
              <Input type="time" value={form.startTime} onChange={e => upd({ startTime: e.target.value })} />
            </div>
          </Grid2>

          {/* Return (round trip) */}
          {form.type === 'round_trip' && (
            <Grid2>
              <div>
                <FieldLabel>Return Date</FieldLabel>
                <Input type="date" value={form.returnDate || ''} onChange={e => upd({ returnDate: e.target.value })} />
              </div>
              <div>
                <FieldLabel>Return Time</FieldLabel>
                <Input type="time" value={form.returnTime || ''} onChange={e => upd({ returnTime: e.target.value })} />
              </div>
            </Grid2>
          )}

          {/* Fare + Status */}
          <Grid2>
            <div>
              <FieldLabel>Fare (Rs.)</FieldLabel>
              <Input type="number" value={form.fare} onChange={e => upd({ fare: e.target.value })} placeholder="0" field="fare" />
            </div>
            <div>
              <FieldLabel>Status</FieldLabel>
              <Select value={form.status} onChange={e => upd({ status: e.target.value })}>
                {BOOKING_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </Select>
            </div>
          </Grid2>

          {/* Notes */}
          <div>
            <FieldLabel>Notes</FieldLabel>
            <textarea value={form.notes} onChange={e => upd({ notes: e.target.value })}
              placeholder="Special instructions, passenger count…" rows={2}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800/60 text-slate-800 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/25 resize-none transition-all" />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 dark:border-navy-700 flex gap-2 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl bg-navy-900 dark:bg-blue-700 text-white text-sm font-bold hover:bg-navy-800 dark:hover:bg-blue-600 transition-all shadow-md active:scale-95">
            {isEdit ? 'Save Changes' : 'Create Booking'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Assignment Modal
// ─────────────────────────────────────────────────────────────
function AssignModal({ booking, bookings, onClose, onAssign }) {
  const [driver,  setDriver]  = useState(booking.driver  || '')
  const [vehicle, setVehicle] = useState(booking.vehicle || '')

  const driverAvail  = DRIVERS.map(d => ({
    ...d,
    avail: getDriverAvailability(d.name, booking.startDate, bookings,
      d.status === 'on-leave' ? 'on-leave' : 'available')
  }))
  const vehicleAvail = VEHICLES.map(v => ({
    ...v,
    avail: getVehicleAvailability(v.reg, booking.startDate, bookings, v.status)
  }))

  const canAssign = driver && vehicle

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:w-[440px] max-h-[90vh] sm:max-h-[85vh] bg-white dark:bg-navy-900 rounded-t-3xl sm:rounded-2xl shadow-2xl z-10 flex flex-col">
        <div className="w-10 h-1 bg-slate-200 dark:bg-navy-700 rounded-full mx-auto mt-3 sm:hidden flex-shrink-0" />

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-navy-700 flex-shrink-0">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assign Trip</p>
            <h3 className="font-display font-black text-slate-800 dark:text-white text-base">{booking.bookingNo}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{booking.customer} · {booking.startDate}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-navy-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-navy-700">
            <X size={15} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {/* Driver selection */}
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5">Select Driver</p>
            <div className="space-y-2">
              {driverAvail.map(d => {
                const availCfg   = DRIVER_AVAIL_CFG[d.avail] || DRIVER_AVAIL_CFG.available
                const canSelect  = d.avail === 'available'
                const isSelected = driver === d.name
                return (
                  <button key={d.id} disabled={!canSelect} onClick={() => canSelect && setDriver(d.name)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left
                      ${isSelected
                        ? 'border-navy-400 bg-navy-50 dark:bg-navy-800 ring-2 ring-navy-400/30'
                        : canSelect
                        ? 'border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800/40 hover:bg-slate-50 dark:hover:bg-navy-800'
                        : 'border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-900 opacity-50 cursor-not-allowed'
                      }`}>
                    <Avatar name={d.name} size={30} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{d.name}</p>
                      <p className="text-[10px] text-slate-400">{d.vehicle}</p>
                    </div>
                    <AvailDot avail={d.avail} cfgMap={DRIVER_AVAIL_CFG} />
                    {isSelected && <CheckCircle size={15} className="text-navy-600 dark:text-blue-400 flex-shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Vehicle selection */}
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5">Select Vehicle</p>
            <div className="space-y-2">
              {vehicleAvail.map(v => {
                const availCfg  = VEHICLE_AVAIL_CFG[v.avail] || VEHICLE_AVAIL_CFG.available
                const canSelect = v.avail === 'available'
                const isSelected = vehicle === v.reg
                return (
                  <button key={v.id} disabled={!canSelect} onClick={() => canSelect && setVehicle(v.reg)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left
                      ${isSelected
                        ? 'border-navy-400 bg-navy-50 dark:bg-navy-800 ring-2 ring-navy-400/30'
                        : canSelect
                        ? 'border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800/40 hover:bg-slate-50 dark:hover:bg-navy-800'
                        : 'border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-900 opacity-50 cursor-not-allowed'
                      }`}>
                    <div className="w-8 h-8 rounded-lg bg-navy-100 dark:bg-navy-800 flex items-center justify-center flex-shrink-0">
                      <Car size={15} className="text-navy-700 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200 font-mono">{v.reg}</p>
                      <p className="text-[10px] text-slate-400">{v.type} · {v.model}</p>
                    </div>
                    <AvailDot avail={v.avail} cfgMap={VEHICLE_AVAIL_CFG} />
                    {isSelected && <CheckCircle size={15} className="text-navy-600 dark:text-blue-400 flex-shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 dark:border-navy-700 flex gap-2 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors">
            Cancel
          </button>
          <button onClick={() => onAssign({ driver, vehicle })} disabled={!canAssign}
            className="flex-1 py-2.5 rounded-xl bg-navy-900 dark:bg-blue-700 text-white text-sm font-bold hover:bg-navy-800 dark:hover:bg-blue-600 transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
            Confirm Assignment
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Booking Detail Panel (expanded row)
// ─────────────────────────────────────────────────────────────
function BookingDetail({ booking, onEdit, onDelete, onAssign, canEdit, canDelete, canAssign }) {
  const typeCfg = TRIP_TYPE_CONFIG[booking.type]
  return (
    <div className="border-t border-slate-100 dark:border-navy-700 p-4 bg-slate-50/60 dark:bg-navy-800/30 space-y-3">
      {/* Route */}
      <div className="flex items-stretch gap-3 bg-white dark:bg-navy-800/60 rounded-xl p-3 border border-slate-100 dark:border-navy-700">
        <div className="flex flex-col items-center gap-1 pt-0.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
          <div className="flex-1 w-0.5 border-l border-dashed border-slate-300 dark:border-navy-600 min-h-[14px]" />
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase">Pickup</p>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-tight">{booking.pickup}</p>
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase">Drop</p>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-tight">{booking.drop || '—'}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          {booking.fare > 0 && <p className="text-base font-black text-navy-800 dark:text-blue-300">Rs. {booking.fare.toLocaleString('en-IN')}</p>}
          {booking.km   && <p className="text-[10px] text-slate-400">{booking.km} km</p>}
        </div>
      </div>

      {/* Detail grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {[
          { label:'Booking No.', value: booking.bookingNo, mono:true },
          { label:'Date',        value: booking.startDate  },
          { label:'Time',        value: booking.startTime || '—' },
          { label:'Contact',     value: booking.contact    },
          { label:'Driver',      value: booking.driver  || 'Not assigned' },
          { label:'Vehicle',     value: booking.vehicle || 'Not assigned' },
          ...(booking.type==='round_trip' && booking.returnDate ? [{ label:'Return', value:`${booking.returnDate} ${booking.returnTime||''}`.trim() }] : []),
          { label:'Created by',  value: booking.createdBy || '—' },
        ].map(d => (
          <div key={d.label} className="bg-white dark:bg-navy-800/60 rounded-xl p-2.5 border border-slate-100 dark:border-navy-700">
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-0.5">{d.label}</p>
            <p className={`text-xs font-bold leading-tight ${d.mono ? 'font-mono' : ''} text-slate-700 dark:text-slate-200`}>{d.value}</p>
          </div>
        ))}
      </div>

      {booking.notes && (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/15 rounded-lg px-3 py-2.5 border border-amber-100 dark:border-amber-800/30">
          <AlertTriangle size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-400 font-medium leading-tight">{booking.notes}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        {canAssign && !['completed','cancelled'].includes(booking.status) && (
          <button onClick={() => onAssign(booking)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-navy-900 dark:bg-blue-700 text-white text-xs font-bold hover:bg-navy-800 dark:hover:bg-blue-600 transition-all active:scale-95 shadow-md">
            <UserCheck size={13} /> Assign
          </button>
        )}
        {canEdit && !['completed','cancelled'].includes(booking.status) && (
          <button onClick={() => onEdit(booking)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors">
            <Edit2 size={13} /> Edit
          </button>
        )}
        {canDelete && (
          <button onClick={() => onDelete(booking.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/15 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/25 transition-colors">
            <Trash2 size={13} /> Delete
          </button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Calendar / Schedule View
// ─────────────────────────────────────────────────────────────
function CalendarView({ bookings }) {
  const today      = new Date()
  const [yr,  setYr]  = useState(today.getFullYear())
  const [mon, setMon] = useState(today.getMonth())  // 0-based

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const DOW         = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  const firstDow   = new Date(yr, mon, 1).getDay()
  const daysInMon  = new Date(yr, mon + 1, 0).getDate()

  const bookingMap = useMemo(() => {
    const map = {}
    bookings.forEach(b => {
      if (!b.startDate) return
      const d = new Date(b.startDate + 'T00:00:00')
      if (d.getFullYear() === yr && d.getMonth() === mon) {
        const day = d.getDate()
        if (!map[day]) map[day] = []
        map[day].push(b)
      }
    })
    return map
  }, [bookings, yr, mon])

  const prev = () => { if (mon === 0) { setMon(11); setYr(y => y-1) } else setMon(m => m-1) }
  const next = () => { if (mon === 11) { setMon(0); setYr(y => y+1) } else setMon(m => m+1) }

  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Month nav */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50/80 dark:bg-navy-800/60 border-b border-slate-100 dark:border-navy-700">
        <button onClick={prev} className="w-8 h-8 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors">
          <ChevronLeft size={15} />
        </button>
        <p className="font-display font-black text-slate-800 dark:text-white text-sm">
          {MONTH_NAMES[mon]} {yr}
        </p>
        <button onClick={next} className="w-8 h-8 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors">
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="p-3">
        {/* DOW header */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DOW.map(d => (
            <div key={d} className={`text-center text-[10px] font-bold py-1 ${d==='Sun'?'text-red-500':d==='Sat'?'text-blue-500':'text-slate-400 dark:text-slate-500'}`}>{d}</div>
          ))}
        </div>

        {/* Date cells */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells before month start */}
          {Array.from({ length: firstDow }).map((_, i) => (
            <div key={`e${i}`} className="aspect-square" />
          ))}

          {Array.from({ length: daysInMon }).map((_, idx) => {
            const day     = idx + 1
            const dateStr = `${yr}-${String(mon+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
            const trips   = bookingMap[day] || []
            const isToday = dateStr === todayStr
            const hasCal  = trips.length > 0

            return (
              <div key={day}
                className={`aspect-square rounded-xl flex flex-col items-center justify-start pt-1 px-0.5 border transition-all cursor-default relative
                  ${isToday
                    ? 'bg-navy-900 dark:bg-blue-700 border-navy-700 dark:border-blue-500 shadow-lg'
                    : hasCal
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/30'
                    : 'border-slate-100 dark:border-navy-800 bg-transparent hover:bg-slate-50 dark:hover:bg-navy-800/30'
                  }`}>
                <span className={`text-[11px] font-bold leading-none ${isToday ? 'text-white' : hasCal ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-500'}`}>
                  {day}
                </span>
                {hasCal && !isToday && (
                  <div className="flex flex-wrap gap-0.5 mt-0.5 justify-center">
                    {trips.slice(0, 3).map((t, ti) => {
                      const sc = getStatusCfg(t.status)
                      return <span key={ti} className={`w-1.5 h-1.5 rounded-full ${sc.dot.replace(' animate-pulse','')}`} />
                    })}
                  </div>
                )}
                {hasCal && isToday && (
                  <span className="text-[9px] text-blue-200 mt-0.5 font-bold">{trips.length}</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 px-4 pb-3 flex-wrap">
        {[
          { dot:'bg-navy-900 dark:bg-blue-700', label:'Today' },
          { dot:'bg-emerald-500',               label:'Has trips' },
          { dot:'bg-violet-500',                label:'Confirmed' },
          { dot:'bg-blue-500',                  label:'Assigned' },
          { dot:'bg-amber-500',                 label:'In Progress' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${l.dot}`} />
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{l.label}</span>
          </div>
        ))}
      </div>

      {/* Bookings this month list */}
      {Object.entries(bookingMap).length > 0 && (
        <div className="border-t border-slate-100 dark:border-navy-700 px-4 py-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">This month's trips</p>
          <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
            {Object.entries(bookingMap)
              .sort((a,b) => Number(a[0]) - Number(b[0]))
              .flatMap(([day, trips]) =>
                trips.map((t, i) => (
                  <div key={`${day}-${i}`} className="flex items-center gap-2.5 py-1.5 border-b border-slate-50 dark:border-navy-800 last:border-0">
                    <div className="w-7 h-7 rounded-lg bg-navy-900 dark:bg-navy-800 flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-black text-white">{day}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{t.customer}</p>
                      <p className="text-[10px] text-slate-400 truncate">{t.driver || 'Unassigned'} · {t.vehicle || '—'}</p>
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                ))
              )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Main Trips Page
// ─────────────────────────────────────────────────────────────
export default function Trips() {
  const navigate          = useNavigate()
  const location          = useLocation()
  const { user, can, isAdmin, isManager, isDriver } = useAuth()

  // Module 9: If navigated from Customer Profile with prefill state,
  // auto-open the create booking modal with customer name + contact pre-filled
  const prefill = location.state?.prefill || null

  // Permissions
  const canCreate  = can('trips') && (isAdmin || isManager)
  const canEdit    = can('trips') && (isAdmin || isManager)
  const canDelete  = isAdmin  // manager cannot delete
  const canAssign  = can('trips') && (isAdmin || isManager)

  // State
  const [bookings,     setBookings]    = useState(() => loadBookings())
  const [tab,          setTab]         = useState('list')   // 'list' | 'calendar'
  const [search,       setSearch]      = useState('')
  const [statusFilter, setStatusFilter]= useState('all')
  const [typeFilter,   setTypeFilter]  = useState('all')
  const [expanded,     setExpanded]    = useState(null)
  const [showCreate,   setShowCreate]  = useState(() => !!prefill)
  const [editBooking,  setEditBooking] = useState(null)
  const [assignBooking,setAssignBooking]= useState(null)

  // ── Derived ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    return bookings.filter(b => {
      // Driver sees only their own
      if (isDriver) return b.driver === user?.name
      const matchSearch = !search || [b.customer, b.bookingNo, b.pickup, b.drop, b.driver, b.vehicle]
        .some(v => v?.toLowerCase().includes(search.toLowerCase()))
      const matchStatus = statusFilter === 'all' || b.status === statusFilter
      const matchType   = typeFilter   === 'all' || b.type   === typeFilter
      return matchSearch && matchStatus && matchType
    })
  }, [bookings, search, statusFilter, typeFilter, isDriver, user])

  // ── Helpers ────────────────────────────────────────────────
  const reload = () => setBookings(loadBookings())

  const handleSave = (booking) => {
    saveBooking(booking)
    reload()
    setShowCreate(false)
    setEditBooking(null)
  }

  const handleAssign = ({ driver, vehicle }) => {
    if (!assignBooking) return
    const updated = { ...assignBooking, driver, vehicle, status: 'assigned', updatedAt: new Date().toISOString() }
    saveBooking(updated)
    reload()
    setAssignBooking(null)
  }

  const handleDelete = (id) => {
    if (!window.confirm('Delete this booking? This cannot be undone.')) return
    deleteBooking(id)
    reload()
    setExpanded(null)
  }

  const handleStatusChange = (booking, newStatus) => {
    saveBooking({ ...booking, status: newStatus, updatedAt: new Date().toISOString() })
    reload()
  }

  // ── Summary counts ────────────────────────────────────────
  const counts = useMemo(() => ({
    total:     bookings.length,
    draft:     bookings.filter(b => b.status === 'draft').length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    assigned:  bookings.filter(b => b.status === 'assigned').length,
    active:    bookings.filter(b => b.status === 'started').length,
    completed: bookings.filter(b => b.status === 'completed').length,
    cancelled: bookings.filter(b => b.status === 'cancelled').length,
  }), [bookings])

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title={isDriver ? 'My Assigned Trips' : 'Bookings & Trips'}
        subtitle={isDriver ? 'Trips assigned to you' : `${counts.total} total bookings · operational center`}
        action={
          canCreate
            ? (
              <button onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-navy-900 dark:bg-blue-700 text-white font-bold text-sm hover:bg-navy-800 dark:hover:bg-blue-600 transition-all shadow-lg active:scale-95">
                <Plus size={15} /> New Booking
              </button>
            ) : null
        }
      />

      {/* ── Summary strip (admin/manager only) ── */}
      {!isDriver && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { label:'Total',     value: counts.total,     color:'text-slate-700 dark:text-slate-200' },
            { label:'Draft',     value: counts.draft,     color:'text-slate-500 dark:text-slate-400' },
            { label:'Confirmed', value: counts.confirmed, color:'text-violet-600 dark:text-violet-400' },
            { label:'Assigned',  value: counts.assigned,  color:'text-blue-600 dark:text-blue-400' },
            { label:'Active',    value: counts.active,    color:'text-amber-600 dark:text-amber-400' },
            { label:'Completed', value: counts.completed, color:'text-emerald-600 dark:text-emerald-400' },
          ].map(s => (
            <div key={s.label} className="glass-card rounded-lg px-3 py-2.5 text-center cursor-pointer hover:shadow-md transition-all"
                 onClick={() => setStatusFilter(s.label.toLowerCase() === 'total' ? 'all' : s.label.toLowerCase())}>
              <p className={`text-xl font-display font-black ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs: List | Calendar ── */}
      {!isDriver && (
        <div className="flex gap-1 bg-slate-100 dark:bg-navy-800 rounded-xl p-1 w-fit">
          {[['list','≡ List'],['calendar','📅 Calendar']].map(([key,lbl]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                tab === key
                  ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}>
              {lbl}
            </button>
          ))}
        </div>
      )}

      {/* ── Calendar tab ── */}
      {tab === 'calendar' && !isDriver && <CalendarView bookings={bookings} />}

      {/* ── List tab ── */}
      {(tab === 'list' || isDriver) && (
        <>
          {/* Filters */}
          {!isDriver && (
            <div className="flex flex-wrap gap-2.5 items-center">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white/70 dark:bg-navy-800/60 flex-1 min-w-[160px] max-w-xs">
                <Search size={14} className="text-slate-400 flex-shrink-0" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search bookings…"
                  className="bg-transparent text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none w-full font-body" />
              </div>

              {/* Status filter pills */}
              <div className="flex gap-1 bg-slate-100 dark:bg-navy-800 rounded-xl p-1 overflow-x-auto no-scrollbar">
                {['all','draft','confirmed','assigned','started','completed','cancelled'].map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap capitalize ${
                      statusFilter === s
                        ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}>
                    {s === 'all' ? 'All' : s === 'started' ? 'Active' : s.charAt(0).toUpperCase()+s.slice(1)}
                  </button>
                ))}
              </div>

              {/* Type filter */}
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-200 focus:outline-none font-body">
                <option value="all">All Types</option>
                {TRIP_TYPE_LIST.map(t => (
                  <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Bookings list */}
          {filtered.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center">
              <Calendar size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">No bookings found</p>
              {canCreate && (
                <button onClick={() => setShowCreate(true)}
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-navy-900 dark:bg-blue-700 text-white text-xs font-bold hover:bg-navy-800 transition-all">
                  <Plus size={13} /> Create First Booking
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {filtered.map(booking => {
                const isOpen  = expanded === booking.id
                const typeCfg = TRIP_TYPE_CONFIG[booking.type]
                return (
                  <div key={booking.id} className="glass-card rounded-2xl overflow-hidden hover:shadow-md transition-all duration-200">
                    {/* Top accent */}
                    <div className={`h-0.5 bg-gradient-to-r ${typeCfg?.gradient || 'from-slate-400 to-slate-500'}`} />

                    {/* Row */}
                    <div className="flex items-center gap-3 p-4 cursor-pointer select-none"
                         onClick={() => setExpanded(isOpen ? null : booking.id)}>
                      {/* Type icon */}
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${typeCfg?.gradient || 'from-slate-400 to-slate-500'} flex items-center justify-center text-lg flex-shrink-0 shadow-sm`}>
                        {typeCfg?.icon}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className="font-bold text-slate-800 dark:text-white text-sm">{booking.customer}</p>
                          <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{booking.bookingNo}</p>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                          <MapPin size={9} className="flex-shrink-0" />
                          <span className="truncate max-w-[160px]">{booking.pickup}</span>
                          {booking.drop && <><span className="text-slate-300 dark:text-navy-600">→</span><span className="truncate max-w-[120px]">{booking.drop}</span></>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                          <Calendar size={9} />
                          <span>{booking.startDate}</span>
                          {booking.startTime && <span>{booking.startTime}</span>}
                          {booking.driver && (
                            <><User size={9} /><span>{booking.driver}</span></>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <StatusBadge status={booking.status} />
                        {booking.fare > 0 && (
                          <p className="text-sm font-black text-navy-800 dark:text-blue-300">Rs. {booking.fare.toLocaleString('en-IN')}</p>
                        )}
                        {isOpen ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isOpen && (
                      <BookingDetail
                        booking={booking}
                        onEdit={setEditBooking}
                        onDelete={handleDelete}
                        onAssign={setAssignBooking}
                        canEdit={canEdit}
                        canDelete={canDelete && booking.status !== 'completed'}
                        canAssign={canAssign}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── Modals ── */}
      {(showCreate || editBooking) && (
        <BookingModal
          booking={editBooking || (prefill ? { customer: prefill.customer, contact: prefill.contact } : null)}
          onClose={() => { setShowCreate(false); setEditBooking(null) }}
          onSave={handleSave}
          userName={user?.name}
        />
      )}
      {assignBooking && (
        <AssignModal
          booking={assignBooking}
          bookings={bookings}
          onClose={() => setAssignBooking(null)}
          onAssign={handleAssign}
        />
      )}
    </div>
  )
}

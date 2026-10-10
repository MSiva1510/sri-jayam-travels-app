import { useState, useMemo, useEffect, useCallback, Fragment } from 'react'
import {
  Plus, Wrench, Shield, Fuel, Gauge, X, CheckCircle,
  ChevronDown, ChevronUp, AlertTriangle, Car, User,
  Calendar, FileText, Edit2, History, MapPin, Clock,
  Search, Download, Eye,
} from 'lucide-react'
import PageHeader   from '../components/ui/PageHeader'
import Avatar       from '../components/ui/Avatar'
import Button       from '../components/ui/Button'
import MetricCard   from '../components/ui/MetricCard'
import StatusPill   from '../components/ui/StatusPill'
import IconButton   from '../components/ui/IconButton'
import Callout      from '../components/ui/Callout'
import SegmentedControl from '../components/ui/SegmentedControl'
import { fieldCls, Select as FieldSelect } from '../components/ui/Field'
import { useToast } from '../components/ui/Toast'
import ModalOverlay from '../components/ui/ModalOverlay'
import { useAuth }  from '../context/AuthContext'
import { vehicleRepository }                       from '../repositories/vehicleRepository'
import { driverRepository }                        from '../repositories/driverRepository'
import { loadDrivers }                            from '../data/driverData'
import { loadVehicles }                           from '../data/vehicleData'
import { loadVehicleAssignments, saveVehicleAssignment } from '../data/attendanceData'
import { docStatus, daysLabel }                    from '../utils/vehicleUtils'
import { getVehicleStatusEntry, getVehicleStatusCfg }   from '../data/vehicleStatusData'
import { fmtAuditTime }                            from '../data/auditLogData'
import { loadBookings }                            from '../data/tripTypes'
import { withTimeout } from '../utils/withTimeout'

// ─────────────────────────────────────────────────────────────
//  Status config
// ─────────────────────────────────────────────────────────────
const STATUS_TONE  = { active:'green', assigned:'blue', maintenance:'red', offline:'gray' }
const STATUS_LABEL = { active:'Available', assigned:'Assigned', maintenance:'Maintenance', offline:'Offline' }
function StatusBadge({ status }) {
  return <StatusPill tone={STATUS_TONE[status] || 'gray'}>{STATUS_LABEL[status] || 'Available'}</StatusPill>
}

// ─────────────────────────────────────────────────────────────
//  Document row
// ─────────────────────────────────────────────────────────────
function DocRow({ icon: Icon, label, number, expiry }) {
  const st = docStatus(expiry)
  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-[var(--ap-border)] last:border-0">
      <div className="w-7 h-7 rounded-lg bg-[var(--ap-surface-2)] flex items-center justify-center flex-shrink-0">
        <Icon size={12} className="text-slate-500 dark:text-slate-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${st.badge}`}>{st.label}</span>
        </div>
        {number && <p className="text-xs font-mono text-slate-600 dark:text-slate-300 truncate">{number}</p>}
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-[10px] font-bold text-slate-700 dark:text-slate-200">{expiry || '—'}</p>
        {st.days != null && (
          <p className={`text-[9px] font-bold ${st.key === 'expired' ? 'text-red-500' : st.key === 'soon' ? 'text-amber-500' : 'text-emerald-500'}`}>
            {daysLabel(st.days)}
          </p>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Add / Edit Vehicle Modal
//  Field helpers defined OUTSIDE modal — prevents remount on keystroke
// ─────────────────────────────────────────────────────────────
const EMPTY_VEHICLE = {
  id: null, reg:'', type:'4+1 Sedan', model:'', year: new Date().getFullYear(),
  km:0, status:'active', fuelType:'Petrol', color:'White', driver:'',
  lastServiceDate:'', lastServiceKm:'', nextServiceDate:'', nextServiceKm:'',
  insProvider:'', insNumber:'', insExpiry:'',
  permitNumber:'', permitExpiry:'',
  fcNumber:'', fcExpiry:'',
  pucNumber:'', pucExpiry:'',
}

function VField({ label, field, type='text', required, value, onChange }) {
  const handleChange = (e) => {
    let v = e.target.value
    if (field === 'reg')          { v = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) }
    if (field === 'model')        { v = v.slice(0, 40) }
    if (field === 'color')        { v = v.replace(/[^a-zA-Z\s]/g, '').slice(0, 20) }
    if (field === 'year')         { v = v.replace(/\D/g, '').slice(0, 4) }
    if (['lastServiceKm','nextServiceKm','km'].includes(field)) {
      v = v.replace(/\D/g, '').slice(0, 7)
    }
    if (['insNumber','permitNumber','fcNumber','pucNumber'].includes(field)) {
      v = v.toUpperCase().replace(/[^A-Z0-9\-/]/g, '').slice(0, 20)
    }
    onChange(field, v)
  }
  return (
    <div>
      <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input type={type} value={value || ''} onChange={handleChange} required={required}
        className={fieldCls} />
    </div>
  )
}

function VSelectField({ label, field, options, value, onChange }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">{label}</label>
      <FieldSelect value={value || ''} onChange={e => onChange(field, e.target.value)}>
        {options.map(o => <option key={o}>{o}</option>)}
      </FieldSelect>
    </div>
  )
}

// ── Vehicle Service Panel (Module 8) ─────────────────────────
const SVC_TYPES = [
  {key:'oil_change',label:'Oil Change'},{key:'tyre',label:'Tyre'},{key:'battery',label:'Battery'},
  {key:'brake',label:'Brake'},{key:'general',label:'General Service'},{key:'other',label:'Other'},
]
const SVC_ICONS = {oil_change:'🛢️',tyre:'🔄',battery:'🔋',brake:'⛔',general:'🔧',other:'🔧'}
const SVC_LS = id => `sjt_vsvc_${id}`
const readSvc  = id => { try { return JSON.parse(localStorage.getItem(SVC_LS(id))||'[]') } catch { return [] } }
const writeSvc = (id,d) => { try { localStorage.setItem(SVC_LS(id),JSON.stringify(d)) } catch {} }

function VehicleServicePanel({ vehicle: v }) {
  const [services, setServices] = useState(() => readSvc(v.id||v.reg))
  const [showAdd,  setShowAdd]  = useState(false)
  const [form, setForm] = useState({service_type:'general',service_date:'',next_service_date:'',service_km:'',cost:'',vendor:'',notes:''})
  const totalCost = services.reduce((s,i)=>s+Number(i.cost||0),0)
  const latest    = [...services].sort((a,b)=>(b.service_date||'').localeCompare(a.service_date||''))[0]
  const handleAdd = () => {
    if (!form.service_date) return
    const item = {...form,id:`svc-${Date.now()}`,created_at:new Date().toISOString()}
    const updated = [item,...services]; setServices(updated); writeSvc(v.id||v.reg,updated)
    setForm({service_type:'general',service_date:'',next_service_date:'',service_km:'',cost:'',vendor:'',notes:''}); setShowAdd(false)
  }
  const INP = fieldCls
  return (
    <div className="space-y-3">
      {v.nextServiceKm && v.km && (
        <div className="bg-[var(--ap-surface-2)] rounded-xl p-3 border border-[var(--ap-border)]">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-500 dark:text-slate-400 font-medium">KM to Next Service</span>
            <span className="font-bold text-slate-700 dark:text-slate-200">{Number(v.km).toLocaleString()} / {Number(v.nextServiceKm).toLocaleString()} km</span>
          </div>
          <div className="h-2 bg-[var(--ap-surface-2)] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" style={{width:`${Math.min(100,Math.round((v.km/v.nextServiceKm)*100))}%`}} />
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 text-right">{Math.max(0,v.nextServiceKm-v.km).toLocaleString()} km remaining</p>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[var(--ap-surface-2)] rounded-xl p-2.5 text-center border border-[var(--ap-border)]"><p className="text-base font-sf font-semibold text-slate-700 dark:text-white">{services.length}</p><p className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Records</p></div>
        <div className="bg-[var(--ap-surface-2)] rounded-xl p-2.5 text-center border border-[var(--ap-border)]"><p className="text-base font-sf font-semibold text-emerald-600 dark:text-emerald-400">Rs.{totalCost.toLocaleString('en-IN')}</p><p className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Total Cost</p></div>
        <div className="bg-[var(--ap-surface-2)] rounded-xl p-2.5 text-center border border-[var(--ap-border)]"><p className="text-xs font-sf font-semibold text-slate-700 dark:text-white">{latest?.service_date||'—'}</p><p className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Last Done</p></div>
      </div>
      <Button variant="primary" size="sm" icon={Plus} onClick={()=>setShowAdd(o=>!o)}>Log Service</Button>
      {showAdd && (
        <div className="bg-[var(--ap-surface-2)] rounded-xl p-3 border border-[var(--ap-border)] space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase block mb-1">Type</label>
              <select value={form.service_type} onChange={e=>setForm(f=>({...f,service_type:e.target.value}))} className={INP}>{SVC_TYPES.map(t=><option key={t.key} value={t.key}>{t.label}</option>)}</select></div>
            <div><label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase block mb-1">Date *</label>
              <input type="date" value={form.service_date} onChange={e=>setForm(f=>({...f,service_date:e.target.value}))} className={INP} /></div>
            <div><label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase block mb-1">Next Service</label>
              <input type="date" value={form.next_service_date} onChange={e=>setForm(f=>({...f,next_service_date:e.target.value}))} className={INP} /></div>
            <div><label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase block mb-1">Cost (Rs.)</label>
              <input type="number" value={form.cost} onChange={e=>setForm(f=>({...f,cost:e.target.value}))} placeholder="0" className={INP} /></div>
            <div><label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase block mb-1">KM</label>
              <input type="number" value={form.service_km} onChange={e=>setForm(f=>({...f,service_km:e.target.value}))} placeholder="0" className={INP} /></div>
            <div><label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase block mb-1">Vendor</label>
              <input value={form.vendor} onChange={e=>setForm(f=>({...f,vendor:e.target.value}))} placeholder="Garage name" className={INP} /></div>
          </div>
          <input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Notes (optional)" className={INP} />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={()=>setShowAdd(false)}>Cancel</Button>
            <Button variant="primary" size="sm" className="flex-1" onClick={handleAdd}>Save</Button>
          </div>
        </div>
      )}
      {services.length === 0 ? <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-3">No service records yet.</p> : (
        <div className="space-y-2">
          {[...services].sort((a,b)=>(b.service_date||'').localeCompare(a.service_date||'')).map(svc=>(
            <div key={svc.id} className="bg-[var(--ap-surface-2)] rounded-xl p-3 border border-[var(--ap-border)] flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--ap-surface-2)] flex items-center justify-center flex-shrink-0 text-sm">{SVC_ICONS[svc.service_type]||'🔧'}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{SVC_TYPES.find(t=>t.key===svc.service_type)?.label||svc.service_type}</p>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 flex-wrap">
                  <span>{svc.service_date}</span>{svc.vendor&&<span>· {svc.vendor}</span>}{svc.service_km&&<span>· {Number(svc.service_km).toLocaleString()} km</span>}
                </div>
              </div>
              {svc.cost>0&&<span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex-shrink-0">Rs.{Number(svc.cost).toLocaleString('en-IN')}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function VSectionHead({ title }) {
  return <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest pt-2 pb-1 border-t border-[var(--ap-border)] mt-2">{title}</p>
}

function VehicleModal({ vehicle, onClose, onSave }) {
  const [form,   setForm]   = useState(() => vehicle ? { ...vehicle } : { ...EMPTY_VEHICLE, id: `VEH-${Date.now()}` })
  const [saving, setSaving] = useState(false)
  const upd = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const handleSave = async () => {
    if (!form.reg) return
    setSaving(true)
    try {
      let result
      if (vehicle?.id) {
        result = await vehicleRepository.update(vehicle.id, form)
      } else {
        result = await vehicleRepository.create(form)
      }
      onSave(result || form)
    } catch (err) {
      console.error('VehicleModal save failed:', err)
      alert('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="relative w-full sm:w-[500px] max-h-[92vh] sm:max-h-[85vh] ap-surface rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col animate-fade-up">
        <div className="w-10 h-1 bg-slate-500/20 rounded-full mx-auto mt-3 sm:hidden flex-shrink-0" />
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--ap-border)] flex-shrink-0">
          <h3 className="font-sf font-semibold text-slate-900 dark:text-white text-base tracking-tight">
            {vehicle ? 'Edit Vehicle' : 'Add Vehicle'}
          </h3>
          <IconButton icon={X} label="Close vehicle form" size={16} onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-500/10" />
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <VField label="Reg. Number" field="reg" required value={form.reg} onChange={upd} />
            <VSelectField label="Type" field="type" options={['4+1 Sedan','7+1 SUV','Tempo Traveller','Mini Van']} value={form.type} onChange={upd} />
            <VField label="Model" field="model" required value={form.model} onChange={upd} />
            <VField label="Year" field="year" type="number" value={form.year} onChange={upd} />
            <VField label="Current KM" field="km" type="number" value={form.km} onChange={upd} />
            <VSelectField label="Fuel Type" field="fuelType" options={['Petrol','Diesel','CNG','Electric']} value={form.fuelType} onChange={upd} />
            <VField label="Color" field="color" value={form.color} onChange={upd} />
            <VSelectField label="Status" field="status" options={['active','maintenance','offline']} value={form.status} onChange={upd} />
          </div>
          <VSectionHead title="Service Tracking" />
          <div className="grid grid-cols-2 gap-3">
            <VField label="Last Service Date" field="lastServiceDate" type="date" value={form.lastServiceDate} onChange={upd} />
            <VField label="Last Service KM"   field="lastServiceKm"   type="number" value={form.lastServiceKm} onChange={upd} />
            <VField label="Next Service Date" field="nextServiceDate" type="date" value={form.nextServiceDate} onChange={upd} />
            <VField label="Next Service KM"   field="nextServiceKm"   type="number" value={form.nextServiceKm} onChange={upd} />
          </div>
          <VSectionHead title="Insurance" />
          <div className="grid grid-cols-2 gap-3">
            <VField label="Provider"   field="insProvider" value={form.insProvider} onChange={upd} />
            <VField label="Policy No." field="insNumber"   value={form.insNumber}   onChange={upd} />
            <div className="col-span-2"><VField label="Expiry Date" field="insExpiry" type="date" value={form.insExpiry} onChange={upd} /></div>
          </div>
          <VSectionHead title="Permit" />
          <div className="grid grid-cols-2 gap-3">
            <VField label="Permit No." field="permitNumber" value={form.permitNumber} onChange={upd} />
            <VField label="Expiry"     field="permitExpiry" type="date" value={form.permitExpiry} onChange={upd} />
          </div>
          <VSectionHead title="Fitness Certificate (FC)" />
          <div className="grid grid-cols-2 gap-3">
            <VField label="FC No." field="fcNumber" value={form.fcNumber} onChange={upd} />
            <VField label="Expiry" field="fcExpiry"  type="date" value={form.fcExpiry} onChange={upd} />
          </div>
          <VSectionHead title="Pollution Certificate (PUC)" />
          <div className="grid grid-cols-2 gap-3">
            <VField label="PUC No." field="pucNumber" value={form.pucNumber} onChange={upd} />
            <VField label="Expiry"  field="pucExpiry" type="date" value={form.pucExpiry} onChange={upd} />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[var(--ap-border)] flex gap-2 flex-shrink-0">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="primary" className="flex-1" onClick={handleSave} disabled={!form.reg || saving}>
            {saving ? 'Saving…' : (vehicle ? 'Save Changes' : 'Add Vehicle')}
          </Button>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ─────────────────────────────────────────────────────────────
//  Assignment Modal
// ─────────────────────────────────────────────────────────────
function AssignmentModal({ vehicle, drivers, onClose, onConfirm }) {
  const [selectedDriver, setSelectedDriver] = useState(vehicle.driver || '')
  const [saving, setSaving] = useState(false)
  const now     = new Date()
  const dateStr = now.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' })
  const timeStr = now.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })

  const handleConfirm = async () => {
    if (!selectedDriver) return
    setSaving(true)
    try {
      const matched = drivers.find(d => d.name === selectedDriver)
      const record  = {
        vehicleReg:   vehicle.reg,
        vehicleType:  vehicle.type,
        vehicleModel: vehicle.model,
        driverId:     matched?.id || null,
        driverName:   selectedDriver,
        assignedDate: now.toISOString().slice(0, 10),
        assignedTime: timeStr,
        assignedAt:   now.toISOString(),
        releasedDate: null,
      }
      await saveVehicleAssignment(record)
      // Also update the vehicle's driver field
      await vehicleRepository.update(vehicle.id, { driver: selectedDriver })
      onConfirm(record)
    } catch (err) {
      console.error('Assignment failed:', err)
      alert('Failed to assign driver. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="relative w-full sm:w-96 ap-surface rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl animate-fade-up">
        <div className="w-10 h-1 bg-slate-500/20 rounded-full mx-auto mb-4 sm:hidden" />
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Assign Driver</p>
            <h3 className="font-sf font-semibold text-slate-900 dark:text-white text-base tracking-tight">{vehicle.reg}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{vehicle.model} · {vehicle.type}</p>
          </div>
          <IconButton icon={X} label="Close assign dialog" size={16} onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-500/10" />
        </div>
        <div className="bg-[var(--ap-surface-2)] rounded-xl p-3 mb-4 space-y-1">
          {[['Date', dateStr], ['Time', timeStr]].map(([l,v]) => (
            <div key={l} className="flex justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">{l}</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">{v}</span>
            </div>
          ))}
        </div>
        <div className="space-y-2 mb-4 max-h-52 overflow-y-auto">
          {drivers.map(d => (
            <button key={d.id} onClick={() => setSelectedDriver(d.name)}
              className={`ap-focus w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                selectedDriver === d.name
                  ? 'border-[var(--ap-accent)] bg-[var(--ap-surface-2)] ring-2 ring-[var(--ap-accent)]/25'
                  : 'border-[var(--ap-border)] hover:bg-[var(--ap-surface-2)]'
              }`}>
              <Avatar name={d.name} size={28} />
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{d.name}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{d.vehicle || 'No vehicle assigned'}</p>
              </div>
              {selectedDriver === d.name && <CheckCircle size={16} className="text-[var(--ap-accent)] flex-shrink-0" />}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="primary" className="flex-1" onClick={handleConfirm} disabled={!selectedDriver || saving}>
            {saving ? 'Assigning…' : 'Confirm'}
          </Button>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ─────────────────────────────────────────────────────────────
//  Vehicle Detail Panel
// ─────────────────────────────────────────────────────────────
function VehicleDetail({ v, trips, assignments, drivers, onEdit, onAssign, onDelete, canEdit, canAssign, canDelete }) {
  const vTrips   = trips.filter(t => t.vehicle === v.reg || t.car === v.reg)
  const vHistory = assignments.filter(a => a.vehicleReg === v.reg)
  const [tab, setTab] = useState('docs')

  const statusEntry = getVehicleStatusEntry(v.reg)
  const statusCfg   = getVehicleStatusCfg(statusEntry.status)
  const isIdle      = statusEntry.status !== 'in_use'

  return (
    <div className="border-t border-[var(--ap-border)] bg-[var(--ap-surface-2)]">
      {/* Live status bar */}
      <div className="px-4 pt-4">
        <div className="ap-surface rounded-xl p-3.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full ${statusCfg.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusCfg.dot} ${statusEntry.status === 'in_use' ? 'animate-pulse' : ''}`} />
              {statusCfg.label}
            </span>
            {statusEntry.driver && (
              <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <User size={10} />{statusEntry.driver}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <Fuel size={11} className="text-orange-500" />
              <span className="ml-1">{statusEntry.fuelLevel !== null ? `${statusEntry.fuelLevel}%` : '—'}</span>
            </span>
            <span className="flex items-center gap-1">
              <MapPin size={11} className="text-slate-500 dark:text-slate-400" />
              {statusEntry.area || (isIdle ? 'Last location unknown' : '—')}
            </span>
            {statusEntry.updatedAt && (
              <span className="flex items-center gap-1">
                <Clock size={11} className="text-slate-500 dark:text-slate-400" />
                {fmtAuditTime(statusEntry.updatedAt)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="px-4 pt-3">
        <SegmentedControl
          ariaLabel="Vehicle detail sections"
          value={tab}
          onChange={setTab}
          options={[['docs','Documents'],['service','Service'],['history','History']].map(([k,l]) => ({ key:k, label:l }))}
        />
      </div>

      <div className="p-4 space-y-3">
        {/* Documents tab */}
        {tab === 'docs' && (
          <div className="ap-surface rounded-xl p-4">
            <DocRow icon={Shield}   label="Insurance"       number={v.insNumber}    expiry={v.insExpiry}    />
            <DocRow icon={FileText} label="Permit"          number={v.permitNumber} expiry={v.permitExpiry} />
            <DocRow icon={FileText} label="Fitness (FC)"    number={v.fcNumber}     expiry={v.fcExpiry}     />
            <DocRow icon={FileText} label="Pollution (PUC)" number={v.pucNumber}    expiry={v.pucExpiry}    />
          </div>
        )}

        {/* Service tab */}
        {tab === 'service' && <VehicleServicePanel vehicle={v} />}

        {/* History tab */}
        {tab === 'history' && (
          <div>
            {vHistory.length === 0 ? (
              <div className="text-center py-6">
                <History size={28} className="mx-auto text-slate-500 dark:text-slate-400 mb-2" />
                <p className="text-xs text-slate-500 dark:text-slate-400">No assignment history yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {vHistory.map((h, i) => (
                  <div key={i} className="ap-surface rounded-xl p-3 flex items-center gap-3">
                    <Avatar name={h.driverName} size={28} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{h.driverName}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Assigned {h.assignedDate} {h.assignedTime}
                        {h.releasedDate ? ` → Released ${h.releasedDate}` : ' · Active'}
                      </p>
                    </div>
                    <StatusPill tone={h.releasedDate ? 'gray' : 'green'}>
                      {h.releasedDate ? 'Released' : 'Current'}
                    </StatusPill>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-[var(--ap-border)]">
              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Trip Summary</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="ap-surface rounded-xl p-2.5 text-center">
                  <p className="text-lg font-sf font-semibold text-slate-900 dark:text-blue-300">{vTrips.length}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Total Trips</p>
                </div>
                <div className="ap-surface rounded-xl p-2.5 text-center">
                  <p className="text-lg font-sf font-semibold text-emerald-600 dark:text-emerald-400">
                    {vTrips.reduce((s,t) => s + (t.km || 0), 0).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Total KM</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap pt-1">
          {canAssign && v.status !== 'maintenance' && (
            <Button variant="primary" size="sm" icon={User} onClick={() => onAssign(v)}>Assign Driver</Button>
          )}
          {canEdit && (
            <Button variant="outline" size="sm" icon={Edit2} onClick={() => onEdit(v)}>Edit</Button>
          )}
          {canDelete && (
            <Button variant="danger" size="sm" icon={X} onClick={() => onDelete(v.id)}>Delete</Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Overview charts (pure SVG/divs, no chart lib)
// ─────────────────────────────────────────────────────────────
function VStatusDonut({ segments }) {
  const r = 24, circ = 2 * Math.PI * r
  const sum = segments.reduce((s, g) => s + g.value, 0) || 1
  let acc = 0
  const total = segments.reduce((s, g) => s + g.value, 0)
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-[148px] h-[148px] flex-shrink-0" role="img"
        aria-label={segments.map(g => `${g.label} ${g.value}`).join(', ')}>
        <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" className="stroke-[var(--ap-surface-2)]" />
          {segments.map(g => {
            const frac = g.value / sum
            const el = (
              <circle key={g.label} cx="32" cy="32" r={r} fill="none" stroke={g.color}
                strokeWidth="7" strokeLinecap="butt"
                strokeDasharray={`${Math.max(frac * circ - 1.5, 0)} ${circ}`}
                strokeDashoffset={-acc * circ}
                style={{ transition: 'stroke-dasharray 0.5s ease' }} />
            )
            acc += frac
            return el
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-3xl font-sf font-semibold text-slate-800 dark:text-white leading-none tabular-nums">{total}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Vehicles</p>
        </div>
      </div>
      <div className="space-y-2 text-sm min-w-0 flex-1">
        {segments.map(g => (
          <div key={g.label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: g.color }} />
            <span className="text-slate-500 dark:text-slate-400 font-medium">{g.label}</span>
            <span className="ml-auto font-bold text-slate-700 dark:text-slate-200 tabular-nums pl-3">
              {g.value} ({total ? Math.round((g.value / total) * 100) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 30-day usage bars (completed trips per 3-day bucket) ──────
// Falls back to the most recent active buckets when empty.
function UsageBars({ trips }) {
  const dayOf = (t) => (t.startDate || '').slice(0, 10)
  const countFor = (start, end, label) => {
    const done = trips.filter(t =>
      dayOf(t) >= start && dayOf(t) <= end &&
      ['completed', 'closed'].includes(t.status)
    ).length
    return { key: start, label, done }
  }
  const buckets = []
  for (let i = 9; i >= 0; i--) {
    const end = new Date(); end.setDate(end.getDate() - i * 3)
    const start = new Date(end); start.setDate(start.getDate() - 2)
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    buckets.push(countFor(fmt(start), fmt(end), end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })))
  }
  let view = buckets
  let fallback = false
  if (buckets.every(b => b.done === 0)) {
    const keys = [...new Set(trips.map(dayOf).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)))].sort().slice(-10)
    if (keys.length > 0) {
      view = keys.map(k => {
        const d = new Date(k + 'T00:00:00')
        return countFor(k, k, Number.isNaN(d.getTime()) ? k.slice(5) : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }))
      })
      fallback = true
    }
  }
  const max = Math.max(1, ...view.map(b => b.done))
  return (
    <div role="img" aria-label={fallback ? 'Completed trips, most recent active periods' : 'Completed trips, last 30 days'} className="flex-1 flex flex-col min-h-0">
      {fallback && (
        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 flex-shrink-0">Recent active periods</p>
      )}
      <div className="flex items-end gap-2 h-44 flex-shrink-0">
        {view.map(b => (
          <div key={b.key} className="flex-1 flex flex-col items-center gap-1.5 min-w-0 h-full" title={`${b.label}: ${b.done} completed`}>
            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 tabular-nums leading-none">{b.done > 0 ? b.done : ''}</span>
            <div className="flex items-end flex-1 min-h-0">
              <div className="w-4 rounded-t-md bg-blue-600 dark:bg-blue-500 transition-all" style={{ height: `${Math.max((b.done / max) * 100, b.done > 0 ? 10 : 4)}%` }} />
            </div>
            <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">{b.label}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-2 text-[10px] font-bold text-slate-500 dark:text-slate-400">
        <span className="w-2 h-2 rounded-full bg-blue-600" /> Trips Completed
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Main Vehicles Page
// ─────────────────────────────────────────────────────────────
export default function Vehicles() {
  const { isAdmin, isManager, isDriver, user } = useAuth()
  const { toast } = useToast()

  const canAdd    = isAdmin || isManager
  const canEdit   = isAdmin || isManager
  const canAssign = isAdmin || isManager
  const canDelete = isAdmin

  const [vehicles,    setVehicles]    = useState([])
  const [drivers,     setDrivers]     = useState([])
  const [assignments, setAssignments] = useState([])
  const [trips,       setTrips]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [loadError,   setLoadError]   = useState('')
  const [expanded,    setExpanded]    = useState(null)
  const [assignModal, setAssignModal] = useState(null)
  const [editModal,   setEditModal]   = useState(null)
  const [showAdd,     setShowAdd]     = useState(false)
  const [search,      setSearch]      = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter,  setTypeFilter]  = useState('all')

  const showToast = (title) => toast?.({ type: 'success', title })

  // ── Load all data from Supabase ───────────────────────────
  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const result = await withTimeout(
        Promise.all([
          loadVehicles(),
          loadVehicleAssignments(),
          loadBookings(),
        ]),
        10_000,
        null
      )
      if (result === null) {
        setVehicles([]); setAssignments([]); setTrips([])
        setLoadError('Request timed out — check your connection and try again.')
      } else {
        const [veh, asgn, bks] = result
        setVehicles(Array.isArray(veh) ? veh : [])
        setAssignments(Array.isArray(asgn) ? asgn : [])
        setTrips(Array.isArray(bks) ? bks : [])
        setLoadError('')
      }
      // Also load drivers for assignment modal (lazy — low priority)
      loadDrivers().then(d => setDrivers(d || []))
        .catch(err => console.error('[Vehicles] load drivers failed:', err))
    } catch (err) {
      console.error('Vehicles page load failed:', err)
      setLoadError('Could not load vehicle data. Try refreshing.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  // ── Handlers ──────────────────────────────────────────────
  const handleSave = (savedVehicle) => {
    setVehicles(prev => {
      const idx = prev.findIndex(v => v.id === savedVehicle.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = savedVehicle; return next }
      return [savedVehicle, ...prev]
    })
    setEditModal(null)
    setShowAdd(false)
    showToast('Vehicle saved')
  }

  const handleAssigned = (record) => {
    setAssignments(prev => [...prev.filter(a => a.driverName !== record.driverName), record])
    // Update the vehicle's displayed driver
    setVehicles(prev => prev.map(v =>
      v.reg === record.vehicleReg ? { ...v, driver: record.driverName } : v
    ))
    setAssignModal(null)
    showToast(`${record.vehicleReg} assigned to ${record.driverName}`)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this vehicle?')) return
    try {
      await vehicleRepository.delete(id)
      setVehicles(prev => prev.filter(v => v.id !== id))
      showToast('Vehicle deleted')
    } catch (err) {
      console.error('Delete failed:', err)
      alert('Failed to delete vehicle.')
    }
  }

  // ── Derived data ──────────────────────────────────────────
  const displayVehicles = isDriver
    ? vehicles.filter(v => v.driver === user?.name)
    : vehicles

  const counts = {
    total:       displayVehicles.length,
    available:   displayVehicles.filter(v => v.status === 'active').length,
    assigned:    displayVehicles.filter(v => v.driver).length,
    maintenance: displayVehicles.filter(v => v.status === 'maintenance').length,
  }
  const statPct = (n) => displayVehicles.length ? Math.round((n / displayVehicles.length) * 100) : 0

  // Live fleet partition (mutually exclusive for the donut).
  const onTripRegs = new Set(
    trips.filter(t => t.status === 'started').map(t => t.vehicle).filter(Boolean)
  )
  const vOnTrip = displayVehicles.filter(v => onTripRegs.has(v.reg))
  const vMaint = displayVehicles.filter(v => v.status === 'maintenance')
  const vInactive = displayVehicles.filter(v => v.status !== 'active' && v.status !== 'maintenance')
  const vAvail = displayVehicles.filter(v => v.status === 'active' && !onTripRegs.has(v.reg))

  // Fleet totals.
  const doneTrips = trips.filter(t => ['completed', 'closed'].includes(t.status))
  const fleetKm = doneTrips.reduce((s, t) => s + (Number(t.km) || 0), 0)
  const tripsOf = (reg) => trips.filter(t => t.vehicle === reg && t.status !== 'cancelled')
  const lastTripOf = (reg) => trips
    .filter(t => t.vehicle === reg && t.startDate)
    .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''))[0]?.startDate || null
  const monthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const monthTrips = doneTrips.filter(t => (t.startDate || '').startsWith(monthKey)).length

  const vehicleTypes = [...new Set(displayVehicles.map(v => v.type).filter(Boolean))].sort()

  const filteredVehicles = displayVehicles.filter(v => {
    const q = search.trim().toLowerCase()
    const matchSearch = !q || [v.reg, v.model, v.type, v.driver]
      .some(x => String(x || '').toLowerCase().includes(q))
    const matchStatus = statusFilter === 'all' || v.status === statusFilter
    const matchType = typeFilter === 'all' || v.type === typeFilter
    return matchSearch && matchStatus && matchType
  })

  const exportCsv = () => {
    const rows = [['Reg', 'Model', 'Type', 'Status', 'Driver', 'KM', 'Trips', 'Last Trip']]
    filteredVehicles.forEach(v => rows.push([
      v.reg, v.model || '', v.type || '', v.status || '',
      v.driver || '', v.km || 0, tripsOf(v.reg).length, lastTripOf(v.reg) || '',
    ]))
    const csv = rows.map(r => r.map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'vehicles.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const alerts = useMemo(() => {
    const list = []
    displayVehicles.forEach(v => {
      [
        { field:'insExpiry',    label:`${v.reg} Insurance` },
        { field:'permitExpiry', label:`${v.reg} Permit`    },
        { field:'fcExpiry',     label:`${v.reg} FC`        },
        { field:'pucExpiry',    label:`${v.reg} PUC`       },
      ].forEach(d => {
        const st = docStatus(v[d.field])
        if (st.key === 'expired' || st.key === 'soon') {
          list.push({ label: d.label, status: st, expiry: v[d.field] })
        }
      })
    })
    return list
  }, [displayVehicles])

  const getAssignment = (reg) => assignments.find(a => a.vehicleReg === reg)

  if (loading) {
    return (
      <div className="space-y-3 animate-fade-up" role="status" aria-busy="true" aria-label="Loading vehicles">
        <span className="sr-only">Loading vehicles…</span>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="skeleton h-7 w-44 rounded-lg" />
            <div className="skeleton h-4 w-32 rounded-md" />
          </div>
          <div className="skeleton h-10 w-32 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3" aria-hidden="true">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="ap-surface p-3.5 flex items-center gap-3">
              <div className="skeleton w-9 h-9 rounded-[13px] flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton h-5 w-12 rounded" />
                <div className="skeleton h-3 w-16 rounded" />
              </div>
            </div>
          ))}
        </div>
        <div className="ap-surface rounded-[20px] p-4 space-y-2.5" aria-hidden="true">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-2.5">
              <div className="skeleton w-8 h-8 rounded-[10px] flex-shrink-0" />
              <div className="skeleton h-3.5 flex-1 rounded" />
              <div className="skeleton h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-3 animate-fade-up">
      <PageHeader compact
        title={isDriver ? 'My Vehicle' : 'Vehicle Management'}
        subtitle={isDriver ? 'Your assigned vehicle details' : 'Manage your fleet, track status, assign drivers'}
        action={
          <div className="flex items-center gap-2 flex-wrap">
            {canAdd && (
              <Button variant="outline" icon={Download} onClick={exportCsv} aria-label="Export vehicles to CSV">Export</Button>
            )}
            {canAdd && (
              <Button variant="primary" icon={Plus} onClick={() => setShowAdd(true)}>Add Vehicle</Button>
            )}
          </div>
        }
      />

      {/* Load error */}
      {loadError && (
        <Callout tone="amber" icon={AlertTriangle} title={loadError} actionLabel="Retry" onAction={reload} />
      )}

      {/* Expiry alerts */}
      {alerts.length > 0 && !isDriver && (
        <div className="bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/30 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
              {alerts.length} document{alerts.length !== 1 ? 's' : ''} need{alerts.length === 1 ? 's' : ''} attention
            </p>
          </div>
          <div className="space-y-1.5">
            {alerts.map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">{a.label}</p>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${a.status.badge}`}>{a.status.label}</span>
                  <span className="text-[10px] text-amber-600 dark:text-amber-500">{a.expiry}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label:'Total Vehicles', value: counts.total,       tone:'blue',  Icon: Car },
          { label:'Available',      value: vAvail.length,      tone:'green', Icon: CheckCircle },
          { label:'On Trip',        value: vOnTrip.length,     tone:'amber', Icon: Gauge },
          { label:'Maintenance',    value: counts.maintenance, tone:'red',   Icon: Wrench },
        ].map(s => (
          <MetricCard key={s.label} icon={s.Icon} tone={s.tone} label={s.label} value={s.value} sub={`${statPct(s.value)}% of fleet`} />
        ))}
      </div>

      {/* Overview: status donut + usage + fleet totals */}
      {!isDriver && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch">
          <div className="ap-surface rounded-2xl p-5 h-full flex flex-col">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">Vehicle Status</p>
            <div className="flex-1 flex items-center">
              <VStatusDonut segments={[
                { label: 'Available', value: vAvail.length, color: '#10b981' },
                { label: 'On Trip', value: vOnTrip.length, color: '#f59e0b' },
                { label: 'Maintenance', value: vMaint.length, color: '#ef4444' },
                { label: 'Inactive', value: vInactive.length, color: '#64748b' },
              ]} />
            </div>
          </div>
          <div className="ap-surface rounded-2xl p-5 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Vehicle Usage</p>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 border border-[var(--ap-border)] rounded-lg px-2 py-1">Last 30 Days</span>
            </div>
            <UsageBars trips={trips} />
          </div>
          <div className="ap-surface rounded-2xl p-5 h-full flex flex-col">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">Fleet Overview</p>
            <div className="space-y-2.5 flex-1">
              {[
                { label: 'Total Distance', value: `${fleetKm.toLocaleString('en-IN')} km`, Icon: Gauge, cls: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                { label: 'Total Trips', value: doneTrips.length, Icon: Car, cls: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/20' },
                { label: 'Active Vehicles', value: `${vAvail.length} / ${displayVehicles.length}`, Icon: CheckCircle, cls: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                { label: 'Doc Alerts', value: alerts.length, Icon: AlertTriangle, cls: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
              ].map(r => (
                <div key={r.label} className="flex items-center gap-3 rounded-xl bg-[var(--ap-surface-2)] border border-[var(--ap-border)] px-3.5 py-2.5">
                  <div className={`w-9 h-9 rounded-[13px] ${r.bg} flex items-center justify-center flex-shrink-0`}>
                    <r.Icon size={16} className={r.cls} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">{r.label}</p>
                    <p className="text-base font-sf font-semibold text-slate-900 dark:text-white tabular-nums leading-tight">{r.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Table toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reg, model, driver…"
            aria-label="Search vehicles" className={`${fieldCls} pl-9`} />
        </div>
        <div className="w-[140px]">
          <FieldSelect value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filter by status">
            <option value="all">All Status</option>
            <option value="active">Available</option>
            <option value="maintenance">Maintenance</option>
            <option value="offline">Offline</option>
          </FieldSelect>
        </div>
        <div className="w-[140px]">
          <FieldSelect value={typeFilter} onChange={e => setTypeFilter(e.target.value)} aria-label="Filter by type">
            <option value="all">All Types</option>
            {vehicleTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </FieldSelect>
        </div>
      </div>

      {/* Desktop table */}
      <div className="ap-surface rounded-[20px] overflow-hidden hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--ap-border)] bg-[var(--ap-surface-2)]">
              {['Vehicle', 'Number', 'Type', 'Status', 'Driver', 'Last Trip', 'KM', 'Actions'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredVehicles.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                  No vehicles found
                </td>
              </tr>
            ) : filteredVehicles.map(v => {
              const isOpen = expanded === v.id
              const assignment = getAssignment(v.reg)
              const driverName = assignment?.driverName || v.driver || '—'
              const vTrips = tripsOf(v.reg)
              return (
                <Fragment key={v.id}>
                <tr onClick={() => setExpanded(isOpen ? null : v.id)}
                  className="border-b border-[var(--ap-border)] hover:bg-[var(--ap-surface-2)] transition-colors cursor-pointer">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-[10px] bg-navy-900 dark:bg-navy-800 flex items-center justify-center flex-shrink-0">
                        <Car size={14} className="text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[150px]">{v.model || v.type || 'Vehicle'}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{vTrips.length} trips</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">{v.reg}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{v.type || '—'}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={v.status} /></td>
                  <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300 truncate max-w-[130px]">{driverName}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap tabular-nums">{lastTripOf(v.reg) || '—'}</td>
                  <td className="px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap tabular-nums">{(Number(v?.km) || 0).toLocaleString()} km</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1.5">
                      <IconButton icon={Eye} label={`View ${v.reg}`} tone="brand" size={14}
                        onClick={(e) => { e.stopPropagation(); setExpanded(isOpen ? null : v.id) }} />
                      {canEdit && (
                        <IconButton icon={Edit2} label={`Edit ${v.reg}`} size={14}
                          onClick={(e) => { e.stopPropagation(); setEditModal(v) }} />
                      )}
                    </div>
                  </td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={8} className="!p-0 !border-0">
                      <VehicleDetail
                        v={v}
                        trips={trips}
                        assignments={assignments}
                        drivers={drivers}
                        onEdit={setEditModal}
                        onDelete={handleDelete}
                        onAssign={setAssignModal}
                        canEdit={canEdit}
                        canAssign={canAssign}
                        canDelete={canDelete}
                      />
                    </td>
                  </tr>
                )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards — stacked, no slider */}
      <div className="md:hidden space-y-2">
        {filteredVehicles.length === 0 ? (
          <div className="ap-surface rounded-[20px] px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No vehicles found
          </div>
        ) : filteredVehicles.map(v => {
          const isOpen = expanded === v.id
          const assignment = getAssignment(v.reg)
          const driverName = assignment?.driverName || v.driver || 'Unassigned'
          return (
            <div key={v.id} className="ap-surface rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2.5 p-3.5 cursor-pointer select-none" onClick={() => setExpanded(isOpen ? null : v.id)}>
                <div className="w-10 h-10 rounded-[13px] bg-navy-900 dark:bg-navy-800 flex items-center justify-center flex-shrink-0">
                  <Car size={16} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-sf font-semibold text-slate-900 dark:text-white truncate font-mono">{v.reg}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{v.model || v.type || ''} · {driverName}</p>
                </div>
                <StatusBadge status={v.status} />
                {isOpen ? <ChevronUp size={14} className="text-slate-500 dark:text-slate-400 flex-shrink-0" /> : <ChevronDown size={14} className="text-slate-500 dark:text-slate-400 flex-shrink-0" />}
              </div>
              {isOpen && (
                <VehicleDetail
                  v={v}
                  trips={trips}
                  assignments={assignments}
                  drivers={drivers}
                  onEdit={setEditModal}
                  onDelete={handleDelete}
                  onAssign={setAssignModal}
                  canEdit={canEdit}
                  canAssign={canAssign}
                  canDelete={canDelete}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Modals */}
      {(showAdd || editModal) && (
        <VehicleModal
          vehicle={editModal}
          onClose={() => { setShowAdd(false); setEditModal(null) }}
          onSave={handleSave}
        />
      )}
      {assignModal && (
        <AssignmentModal
          vehicle={assignModal}
          drivers={drivers}
          onClose={() => setAssignModal(null)}
          onConfirm={handleAssigned}
        />
      )}
    </div>
  )
}
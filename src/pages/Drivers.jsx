import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Plus, Star, TrendingUp, Upload, X,
  Search, Edit2, Download, Eye, UserCheck, UserX,
} from 'lucide-react'
import Avatar      from '../components/ui/Avatar'
import Button      from '../components/ui/Button'
import PageHeader  from '../components/ui/PageHeader'
import MetricCard  from '../components/ui/MetricCard'
import StatusPill  from '../components/ui/StatusPill'
import IconButton  from '../components/ui/IconButton'
import { fieldCls, Select as FieldSelect } from '../components/ui/Field'
import ModalOverlay from '../components/ui/ModalOverlay'
import { driverRepository }  from '../repositories/driverRepository'
import { authRepository }     from '../repositories/authRepository'
import { loadDrivers }        from '../data/driverData'
import { loadBookings }       from '../data/tripTypes'
import {
  loadTripPayslips, tripDriverAmount,
  buildTripPayslip, saveTripPayslip,
} from '../data/settlementData'

// ── Status badge colours ──────────────────────────────────────
const STATUS_COLORS = {
  active:     'badge-active',
  'on-leave': 'badge-pending',
}

// ── Add Driver Modal ──────────────────────────────────────────
// Defined OUTSIDE the page component so React never remounts
// inner elements between keystrokes.
function AddDriverModal({ driver, onClose, onSaved }) {
  const isEditMode = !!driver?.id
  const [form, setForm] = useState(() => driver ? {
    name: driver.name || '', mobile: driver.mobile || '', vehicle: driver.vehicle || '',
    license: driver.license ?? driver.license_number ?? '', vehicleType: driver.vehicleType || '',
    joined: driver.joined ?? driver.joined_date ?? new Date().toISOString().slice(0, 10),
    status: driver.status || 'active', rating: driver.rating ?? 4.5,
    licenseExpiry: driver.licenseExpiry ?? driver.license_expiry ?? '',
    badge: driver.badge || '', medicalExpiry: driver.medicalExpiry ?? driver.medical_expiry ?? '',
    bankName: driver.bankName ?? driver.bank_name ?? '', accountNo: driver.accountNo || '',
    ifscCode: driver.ifscCode || '',
    emergencyName: driver.emergencyName || '', emergencyContact: driver.emergencyContact ?? driver.emergency_contact ?? '',
    email:'', password:'', createLogin:false,
  } : {
    name:'', mobile:'', vehicle:'', license:'', vehicleType:'',
    joined: new Date().toISOString().slice(0,10), status:'active', rating: 4.5,
    licenseExpiry:'', badge:'', medicalExpiry:'',
    bankName:'', accountNo:'', ifscCode:'',
    emergencyName:'', emergencyContact:'',
    email:'', password:'', createLogin:true,
  })
  const [licenceImg, setLicenceImg] = useState(null)
  const [preview,    setPreview]    = useState(null)
  const [errors,     setErrors]     = useState({})
  const [saving,     setSaving]     = useState(false)
  const fileRef = useRef()

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { alert('File too large. Max 2MB.'); return }
    const reader = new FileReader()
    reader.onload = ev => { setLicenceImg(ev.target.result); setPreview(ev.target.result) }
    reader.readAsDataURL(file)
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim())                          e.name    = 'Required'
    if (!form.mobile.trim() || form.mobile.length < 10) e.mobile = '10 digits required'
    if (!form.license.trim())                       e.license = 'Required'
    if (form.createLogin) {
      if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Valid email required for login'
      if (!form.password || form.password.length < 6) e.password = 'Min 6 characters'
    }
    return e
  }

  const handleSave = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    try {
      const { email, password, createLogin, ...driverFields } = form
      if (isEditMode) {
        const payload = {
          ...driverFields,
          ...(licenceImg ? { license_photo_url: licenceImg } : {}),
        }
        const updated = await driverRepository.update(driver.id, payload)
        const savedDriver = updated || { ...driver, ...payload }
        onSaved(savedDriver)
        onClose()
        return
      }
      const payload = {
        ...driverFields,
        id:           `DRV-${Date.now()}`,
        license_photo_url: licenceImg || null,
        createdAt:    new Date().toISOString(),
      }
      const created = await driverRepository.create(payload)
      const savedDriver = created || payload

      // Driver login: auth user + driver profile (admin session is restored after).
      if (createLogin) {
        try {
          await authRepository.adminCreateUser({
            email: email.trim(),
            password,
            full_name: form.name.trim(),
            role: 'driver',
            phone: form.mobile.trim() || null,
          })
        } catch (userErr) {
          console.error('Driver login creation failed:', userErr)
          alert(`Driver saved, but login creation failed: ${userErr.message || userErr}`)
        }
      }

      onSaved(savedDriver)
      onClose()
    } catch (err) {
      console.error('AddDriver failed:', err)
      alert('Failed to save driver. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const inp = fieldCls

  return (
    <ModalOverlay onClose={onClose}>
      <div className="relative w-full sm:w-[480px] max-h-[92vh] sm:max-h-[85vh] ap-surface rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col animate-fade-up">
        <div className="w-10 h-1 bg-slate-500/20 rounded-full mx-auto mt-3 sm:hidden flex-shrink-0" />
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--ap-border)] flex-shrink-0">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{isEditMode ? 'Edit Driver' : 'Add Driver'}</p>
            <h3 className="font-sf font-semibold text-slate-900 dark:text-white text-base tracking-tight">{isEditMode ? form.name || 'Edit Driver' : 'New Driver'}</h3>
          </div>
          <IconButton icon={X} label="Close driver form" size={16} onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-500/10" />
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Name <span className="text-red-500">*</span></label>
              <input className={`${inp} ${errors.name ? 'border-red-400' : 'border-[var(--ap-border)]'}`}
                value={form.name} onChange={e => upd('name', e.target.value)} placeholder="Full name" />
              {errors.name && <p className="text-[10px] text-red-500 mt-0.5">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Mobile <span className="text-red-500">*</span></label>
              <input className={`${inp} ${errors.mobile ? 'border-red-400' : 'border-[var(--ap-border)]'}`}
                value={form.mobile} onChange={e => upd('mobile', e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="10 digits" />
              {errors.mobile && <p className="text-[10px] text-red-500 mt-0.5">{errors.mobile}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Vehicle Reg</label>
              <input className={`${inp} border-[var(--ap-border)]`}
                value={form.vehicle} onChange={e => upd('vehicle', e.target.value)} placeholder="PY01XX1234" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Vehicle Type</label>
              <input className={`${inp} border-[var(--ap-border)]`}
                value={form.vehicleType} onChange={e => upd('vehicleType', e.target.value)} placeholder="4+1 Sedan / 7+1 SUV" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Licence Number <span className="text-red-500">*</span></label>
              <input className={`${inp} ${errors.license ? 'border-red-400' : 'border-[var(--ap-border)]'}`}
                value={form.license} onChange={e => upd('license', e.target.value)} placeholder="TN1234567890" />
              {errors.license && <p className="text-[10px] text-red-500 mt-0.5">{errors.license}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Licence Expiry</label>
              <input type="date" className={`${inp} border-[var(--ap-border)]`}
                value={form.licenseExpiry||''} onChange={e => upd('licenseExpiry', e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Badge No.</label>
              <input className={`${inp} border-[var(--ap-border)]`}
                value={form.badge||''} onChange={e => upd('badge', e.target.value)} placeholder="Badge number" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Medical Cert Expiry</label>
              <input type="date" className={`${inp} border-[var(--ap-border)]`}
                value={form.medicalExpiry||''} onChange={e => upd('medicalExpiry', e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Join Date</label>
              <input type="date" className={`${inp} border-[var(--ap-border)]`}
                value={form.joined} onChange={e => upd('joined', e.target.value)} />
            </div>
          </div>

          {/* Login (driver app) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Driver Login</p>
              {!isEditMode && (
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" checked={form.createLogin}
                  onChange={e => upd('createLogin', e.target.checked)}
                  className="w-4 h-4 rounded accent-teal-600" />
                Create login
              </label>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {!isEditMode && (
              <>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Login Email {form.createLogin && <span className="text-red-500">*</span>}</label>
                <input className={`${inp} ${errors.email ? 'border-red-400' : 'border-[var(--ap-border)]'}`}
                  value={form.email} onChange={e => upd('email', e.target.value)} placeholder="driver@example.com" autoComplete="off" />
                {errors.email && <p className="text-[10px] text-red-500 mt-0.5">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Temp Password {form.createLogin && <span className="text-red-500">*</span>}</label>
                <input type="password" className={`${inp} ${errors.password ? 'border-red-400' : 'border-[var(--ap-border)]'}`}
                  value={form.password} onChange={e => upd('password', e.target.value)} placeholder="Min 6 characters" autoComplete="new-password" />
                {errors.password && <p className="text-[10px] text-red-500 mt-0.5">{errors.password}</p>}
              </div>
              </>
              )}
            </div>
          </div>

          {/* Bank Details */}
          <div>
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Bank Details</p>
            <div className="grid grid-cols-3 gap-2">
              <input className={`${inp} border-[var(--ap-border)]`}
                value={form.bankName||''} onChange={e=>upd('bankName',e.target.value)} placeholder="Bank name" />
              <input className={`${inp} border-[var(--ap-border)]`}
                value={form.accountNo||''} onChange={e=>upd('accountNo',e.target.value)} placeholder="Account no." />
              <input className={`${inp} border-[var(--ap-border)]`}
                value={form.ifscCode||''} onChange={e=>upd('ifscCode',e.target.value.toUpperCase())} placeholder="IFSC" />
            </div>
          </div>

          {/* Emergency Contact */}
          <div>
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Emergency Contact</p>
            <div className="grid grid-cols-2 gap-2">
              <input className={`${inp} border-[var(--ap-border)]`}
                value={form.emergencyName||''} onChange={e=>upd('emergencyName',e.target.value)} placeholder="Contact name" />
              <input className={`${inp} border-[var(--ap-border)]`}
                value={form.emergencyContact||''} onChange={e=>upd('emergencyContact',e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="Mobile number" />
            </div>
          </div>

          {/* Licence Upload */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Driving Licence Upload</label>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={handleFile} className="hidden" />
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 border-dashed border-teal-300 dark:border-teal-700/50 bg-teal-50 dark:bg-teal-900/10 text-teal-700 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/20 transition-colors">
              <Upload size={15} className="flex-shrink-0" />
              <span className="text-sm font-bold">{licenceImg ? 'Replace Licence Image' : 'Upload Licence (image / PDF)'}</span>
            </button>
            {preview && (
              <div className="mt-2 relative">
                <img src={preview} alt="Licence preview" className="w-full max-h-40 object-cover rounded-xl border border-teal-200 dark:border-teal-800/40" />
                <button type="button" onClick={() => { setLicenceImg(null); setPreview(null) }}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600">✕</button>
                <p className="text-[10px] text-teal-600 dark:text-teal-400 mt-1">✓ Licence image attached</p>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[var(--ap-border)] flex gap-2 flex-shrink-0">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="teal" className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEditMode ? 'Save Changes' : 'Add Driver'}
          </Button>
        </div>
      </div>
    </ModalOverlay>
  )
}

// Compact money: full figure below 1k, k-suffix above (never "Rs.0.0k").
function fmtK(v) {
  const n = Number(v) || 0
  return n >= 1000 ? `Rs. ${(n / 1000).toFixed(1)}k` : `Rs. ${n.toLocaleString('en-IN')}`
}

// ── Multi-segment status donut (pure SVG, no chart lib) ──────
function StatusDonut({ segments, total, centerTop, centerSub }) {
  const r = 24, circ = 2 * Math.PI * r
  const sum = segments.reduce((s, g) => s + g.value, 0) || 1
  let acc = 0
  return (
    <div className="relative w-[160px] h-[160px] flex-shrink-0" role="img"
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
        <p className="text-3xl font-sf font-semibold text-slate-800 dark:text-white leading-none tabular-nums">{centerTop}</p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{centerSub}</p>
      </div>
    </div>
  )
}

// ── 7-day trip performance bars (completed vs assigned) ───────
// Falls back to the 7 most recent active days when the last 7
// calendar days are empty, so the chart never renders flat.
function PerfBars({ bookings }) {
  const dayOf = (b) => (b.startDate || '').slice(0, 10)
  const countFor = (key) => {
    const day = bookings.filter(b => dayOf(b) === key && b.status !== 'cancelled')
    const d = new Date(key + 'T00:00:00')
    return {
      key,
      label: Number.isNaN(d.getTime()) ? key.slice(8) : d.toLocaleDateString('en-IN', { day: 'numeric' }),
      sub: Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { month: 'short' }),
      done: day.filter(b => ['completed', 'closed'].includes(b.status)).length,
      all: day.length,
    }
  }
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    days.push(countFor(key))
  }
  let view = days
  let fallback = false
  if (days.every(d => d.all === 0)) {
    const keys = [...new Set(bookings.map(dayOf).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)))]
      .sort()
      .slice(-7)
    if (keys.length > 0) {
      view = keys.map(countFor)
      fallback = true
    }
  }
  const max = Math.max(1, ...view.map(d => d.all))
  return (
    <div role="img" aria-label={fallback ? 'Trips per day, most recent active days' : 'Trips per day, last 7 days'} className="flex-1 flex flex-col min-h-0">
      {fallback && (
        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 flex-shrink-0">Recent active days</p>
      )}
      <div className="flex items-end gap-2.5 h-44 flex-shrink-0">
        {view.map(d => (
          <div key={d.key} className="flex-1 flex flex-col items-center gap-1.5 min-w-0 h-full" title={`${d.label} ${d.sub}: ${d.done} done / ${d.all} assigned`}>
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums leading-none">{d.all > 0 ? d.all : ''}</span>
            <div className="flex items-end gap-1 flex-1 min-h-0">
              <div className="w-4 rounded-t-md bg-blue-600 dark:bg-blue-500 transition-all" style={{ height: `${Math.max((d.done / max) * 100, d.done > 0 ? 10 : 4)}%` }} />
              <div className="w-4 rounded-t-md bg-[var(--ap-surface-2)] transition-all" style={{ height: `${Math.max((d.all / max) * 100, d.all > 0 ? 10 : 4)}%` }} />
            </div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tabular-nums">{d.label}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-2 text-[10px] font-bold text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-600" /> Trips Completed</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[var(--ap-surface-2)]" /> Trips Assigned</span>
      </div>
    </div>
  )
}

// ── Driver Detail Modal ───────────────────────────────────────
function DriverModal({ driver, bookings, payslips, onClose }) {
  const mine        = bookings.filter(b => b.driver === driver.name)
  const mySlips     = payslips.filter(p => p.driver === driver.name)
  // Ledger bata + bata sitting on completed trips that have no payslip yet.
  const slipBookingIds = new Set(mySlips.map(p => p.bookingId).filter(Boolean))
  const unsyncedBata   = mine
    .filter(b => ['completed', 'closed'].includes(b.status) && !slipBookingIds.has(b.id))
    .reduce((s, b) => s + (Number(b.bata) || 0), 0)
  const totalEarned = mySlips.reduce((s, p) => s + tripDriverAmount(p), 0) + unsyncedBata
  const pendingPay  = mySlips.filter(p => p.status === 'pending').reduce((s, p) => s + tripDriverAmount(p), 0) + unsyncedBata

  return (
    <ModalOverlay center onClose={onClose}>
      <div className="w-full sm:max-w-2xl ap-surface rounded-3xl overflow-hidden shadow-2xl animate-fade-up" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-br from-navy-900 to-navy-800 p-6">
          <div className="flex items-center gap-4">
            <Avatar name={driver.name} size={52} />
            <div className="flex-1">
              <h2 className="font-sf font-semibold text-white text-xl tracking-tight">{driver.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`badge ${STATUS_COLORS[driver.status] || 'badge-active'} text-[10px]`}>
                  {driver.status === 'active' ? '● Active' : '○ On Leave'}
                </span>
                <span className="flex items-center gap-1 text-amber-300 text-xs font-bold">
                  <Star size={11} className="fill-amber-400 text-amber-400" /> {driver.rating}
                </span>
              </div>
            </div>
            <button onClick={onClose} aria-label="Close driver details" className="min-w-[36px] min-h-[36px] w-9 h-9 rounded-xl bg-white/10 text-white/70 flex items-center justify-center hover:bg-white/20 active:scale-95 transition-all"><X size={16} /></button>
          </div>
        </div>
        <div className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label:'Mobile',          value: driver.mobile           },
              { label:'Vehicle',         value: driver.vehicle          },
              { label:'Licence No.',     value: driver.license          },
              { label:'Joined',          value: driver.joined           },
              { label:'Licence Expiry',  value: driver.licenseExpiry || '' },
              { label:'Badge No.',       value: driver.badge            || '' },
              { label:'Medical Expiry',  value: driver.medicalExpiry    || '' },
            ].filter(r => r.value && r.value !== '—').map(r => (
              <div key={r.label} className="bg-[var(--ap-surface-2)] rounded-xl p-3">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wide">{r.label}</p>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">{r.value}</p>
              </div>
            ))}
          </div>
          {(driver.bankName || driver.emergencyName) && (
            <div className="grid grid-cols-2 gap-3">
              {driver.bankName && (
                <div className="bg-[var(--ap-surface-2)] rounded-xl p-3 col-span-1">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wide">Bank</p>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{driver.bankName}</p>
                  {driver.accountNo && <p className="text-[10px] text-slate-500 dark:text-slate-400">{driver.accountNo}</p>}
                </div>
              )}
              {driver.emergencyName && (
                <div className="bg-[var(--ap-surface-2)] rounded-xl p-3 col-span-1">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wide">Emergency</p>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{driver.emergencyName}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">{driver.emergencyContact}</p>
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label:'Total Trips',  value: mine.length,             color:'text-blue-600 dark:text-blue-400'    },
              { label:'Bata Earned',  value: fmtK(totalEarned),       color:'text-emerald-600 dark:text-emerald-400' },
              { label:'Bata Pending', value: fmtK(pendingPay),        color:'text-amber-600 dark:text-amber-400'  },
            ].map(s => (
              <div key={s.label} className="bg-[var(--ap-surface-2)] rounded-xl p-3 text-center">
                <p className={`text-base font-semibold tabular-nums ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          {unsyncedBata > 0 && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Includes Rs. {unsyncedBata.toLocaleString('en-IN')} bata on trips with no payslip yet — press <span className="font-bold">Sync Trip Payslips</span> on the Drivers page to ledger it.
            </p>
          )}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Recent Trips</p>
            {mine.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">No trips yet</p>
            ) : (
              <div className="space-y-2">
                {mine.slice(0, 5).map(b => (
                  <div key={b.id} className="flex items-center gap-3 px-4 py-3 bg-[var(--ap-surface-2)] rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{b.customer}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{b.pickup} → {b.drop}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {b.bata ? `Bata Rs. ${Number(b.bata).toLocaleString('en-IN')}` : 'Bata —'}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">{b.startDate}{b.fare ? ` · Fare Rs. ${Number(b.fare).toLocaleString('en-IN')}` : ''}</p>
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

// ── Main Drivers Page ─────────────────────────────────────────
export default function Drivers() {
  const [drivers,  setDrivers]  = useState([])
  const [bookings, setBookings] = useState([])
  const [payslips, setPayslips] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState(null)
  const [showAdd,  setShowAdd]  = useState(false)

  // ── Load all data from Supabase on mount ──────────────────
  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [drs, bks, pys] = await Promise.all([
        loadDrivers(),
        loadBookings(),
        loadTripPayslips(),
      ])
      setDrivers(drs  || [])
      setBookings(bks || [])
      setPayslips(pys || [])
    } catch (err) {
      console.error('Drivers page load failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  // ── Per-driver computed stats ────────────────────────────
  const driversWithStats = drivers.map(d => {
    const mine      = bookings.filter(b => b.driver === d.name)
    const mySlips   = payslips.filter(p => p.driver === d.name)
    const completed = mine.filter(b => b.status === 'completed').length
    const totalFare = mine.reduce((s, b) => s + (b.fare || 0), 0)
    const totalPay  = mySlips.reduce((s, p) => s + tripDriverAmount(p), 0)
    return { ...d, tripCount: completed, fareCollected: totalFare, totalPay }
  })

  // ── Handlers ─────────────────────────────────────────────
  const handleDriverSaved = (newDriver) => {
    setDrivers(prev => [newDriver, ...prev.filter(d => d.id !== newDriver.id)])
  }

  // ── Filters / export ───────────────────────────────────────
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [vehicleFilter, setVehicleFilter] = useState('all')
  const [editDriver, setEditDriver] = useState(null)

  const monthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const onTripSet = new Set(
    bookings.filter(b => b.status === 'started').map(b => b.driver)
  )
  const monthFareOf = (name) => bookings
    .filter(b => b.driver === name && (b.startDate || '').startsWith(monthKey) && ['completed', 'closed'].includes(b.status))
    .reduce((s, b) => s + (Number(b.fare) || 0), 0)
  const monthBataOf = (name) => bookings
    .filter(b => b.driver === name && (b.startDate || '').startsWith(monthKey) && ['completed', 'closed'].includes(b.status))
    .reduce((s, b) => s + (Number(b.bata) || 0), 0)
  // Status partition for the donut (mutually exclusive).
  const onLeaveDrivers = drivers.filter(d => d.status === 'on-leave')
  const onTripDrivers = drivers.filter(d => d.status !== 'on-leave' && onTripSet.has(d.name))
  const activeIdleDrivers = drivers.filter(d => d.status === 'active' && !onTripSet.has(d.name))
  const inactiveDrivers = drivers.filter(d => d.status !== 'active' && d.status !== 'on-leave')
  // Month bata leaderboard.
  const bataByDriver = drivers
    .map(d => ({ name: d.name, bata: monthBataOf(d.name) }))
    .sort((a, b) => b.bata - a.bata)
  const monthBataTotal = bataByDriver.reduce((s, d) => s + d.bata, 0)
  const topEarner = bataByDriver[0]
  const vehicleRegs = [...new Set(drivers.map(d => d.vehicle).filter(Boolean))].sort()

  const filteredDrivers = driversWithStats.filter(d => {
    const q = search.trim().toLowerCase()
    const matchSearch = !q || [d.name, d.mobile, d.vehicle, d.license ?? d.license_number]
      .some(v => String(v || '').toLowerCase().includes(q))
    const matchStatus = statusFilter === 'all' ||
      (statusFilter === 'active' ? d.status === 'active' : d.status !== 'active')
    const matchVehicle = vehicleFilter === 'all' || d.vehicle === vehicleFilter
    return matchSearch && matchStatus && matchVehicle
  })

  const statPct = (n) => drivers.length ? Math.round((n / drivers.length) * 100) : 0

  const exportCsv = () => {
    const rows = [['Name', 'Mobile', 'Status', 'License', 'Vehicle', 'Trips Done', 'Month Fare (Rs)', 'Bata Pay (Rs)']]
    filteredDrivers.forEach(d => rows.push([
      d.name, d.mobile || '', d.status || '', d.license ?? d.license_number ?? '',
      d.vehicle || '', d.tripCount, monthFareOf(d.name), d.totalPay,
    ]))
    const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'drivers.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // ── Fill the Bata Ledger: generate trip payslips for completed
  // bookings (with a fare) that don't have one yet. Bata goes to
  // the driver, fare stays with the company.
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const handleSyncPayslips = async () => {
    setSyncing(true)
    setSyncMsg('')
    try {
      const haveIds = new Set(payslips.map(p => p.bookingId).filter(Boolean))
      const missing = bookings.filter(b =>
        ['completed', 'closed'].includes(b.status) &&
        Number(b.fare) > 0 &&
        !haveIds.has(b.id)
      )
      let done = 0
      for (const b of missing) {
        const saved = await saveTripPayslip(buildTripPayslip(b))
        if (saved) done++
      }
      await reload()
      setSyncMsg(done > 0 ? `Generated ${done} trip payslip${done !== 1 ? 's' : ''}.` : 'Ledger is already up to date.')
    } catch (err) {
      console.error('Payslip sync failed:', err)
      setSyncMsg('Sync failed. Check connection and retry.')
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 dark:text-slate-400">Loading drivers…</p>
        </div>
      </div>
    )
  }

  const activeCount = drivers.filter(d => d.status === 'active').length
  const onTripCount = drivers.filter(d => onTripSet.has(d.name)).length
  const inactiveCount = drivers.length - activeCount

  return (
    <div className="space-y-4 md:space-y-3 animate-fade-up">
      <PageHeader compact
        title="Drivers"
        subtitle="Manage drivers, assignments, performance and payments"
        action={<Button icon={Plus} variant="teal" onClick={() => setShowAdd(true)}>Add Driver</Button>}
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label:'Total Drivers', value: drivers.length, tone:'blue',  Icon: UserCheck },
          { label:'Active',        value: activeCount,    tone:'green', Icon: UserCheck },
          { label:'On Trip',       value: onTripCount,    tone:'amber', Icon: TrendingUp },
          { label:'Inactive',      value: inactiveCount,  tone:'red',   Icon: UserX },
        ].map(s => (
          <MetricCard key={s.label} icon={s.Icon} tone={s.tone} label={s.label} value={s.value} sub={`${statPct(s.value)}% of fleet`} />
        ))}
      </div>

      {/* Overview cards — matched heights */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch min-h-[280px] lg:min-h-[320px]">
          {/* Driver Status donut */}
          <div className="ap-surface rounded-2xl p-5 h-full flex flex-col">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">Driver Status</p>
            <div className="flex-1 flex items-center gap-4">
              <StatusDonut
                segments={[
                  { label: 'Active', value: activeIdleDrivers.length, color: '#10b981' },
                  { label: 'On Trip', value: onTripDrivers.length, color: '#f59e0b' },
                  { label: 'Inactive', value: inactiveDrivers.length, color: '#ef4444' },
                  { label: 'On Leave', value: onLeaveDrivers.length, color: '#f97316' },
                ]}
                centerTop={drivers.length}
                centerSub="Drivers"
              />
              <div className="space-y-2 text-sm min-w-0 flex-1">
                {[
                  { label: 'Active', value: activeIdleDrivers.length, dot: 'bg-emerald-500' },
                  { label: 'On Trip', value: onTripDrivers.length, dot: 'bg-amber-500' },
                  { label: 'Inactive', value: inactiveDrivers.length, dot: 'bg-red-500' },
                  { label: 'On Leave', value: onLeaveDrivers.length, dot: 'bg-orange-500' },
                ].map(g => (
                  <div key={g.label} className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${g.dot}`} />
                    <span className="text-slate-500 dark:text-slate-400 font-medium">{g.label}</span>
                    <span className="ml-auto font-bold text-slate-700 dark:text-slate-200 tabular-nums pl-3">
                      {g.value} ({statPct(g.value)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Trip Performance */}
          <div className="ap-surface rounded-2xl p-5 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Trip Performance</p>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 border border-[var(--ap-border)] rounded-lg px-2 py-1">Last 7 Days</span>
            </div>
            <PerfBars bookings={bookings} />
          </div>

          {/* Earnings / Driver */}
          <div className="ap-surface rounded-2xl p-5 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Earnings / Driver</p>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 border border-[var(--ap-border)] rounded-lg px-2 py-1">This Month</span>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3 rounded-xl bg-[var(--ap-surface-2)] border border-[var(--ap-border)] px-3.5 py-3">
                <div className="w-9 h-9 rounded-[13px] bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0">
                  <TrendingUp size={16} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Total Payout (bata)</p>
                  <p className="text-base font-sf font-semibold text-slate-800 dark:text-white tabular-nums leading-tight">Rs. {monthBataTotal.toLocaleString('en-IN')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-[var(--ap-surface-2)] border border-[var(--ap-border)] px-3.5 py-3">
                <div className="w-9 h-9 rounded-[13px] bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                  <UserCheck size={16} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Avg. per Driver</p>
                  <p className="text-base font-sf font-semibold text-slate-800 dark:text-white tabular-nums leading-tight">
                    Rs. {drivers.length ? Math.round(monthBataTotal / drivers.length).toLocaleString('en-IN') : 0}
                  </p>
                </div>
              </div>
              <button onClick={() => topEarner && setSelected(drivers.find(d => d.name === topEarner.name) || null)}
                disabled={!topEarner || topEarner.bata <= 0}
                className="w-full flex items-center gap-3 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-100 dark:border-amber-800/30 px-3.5 py-3 text-left hover:shadow-md active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-default">
                <div className="w-9 h-9 rounded-[13px] bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                  <Star size={16} className="text-amber-500 fill-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Highest Earner</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{topEarner?.name || '—'}</p>
                </div>
                <p className="text-sm font-sf font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums flex-shrink-0">
                  Rs. {(topEarner?.bata || 0).toLocaleString('en-IN')}
                </p>
              </button>
            </div>
          </div>
        </div>

      {/* Drivers table */}
      {/* Table toolbar: search + filters + export */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, mobile, vehicle…"
            aria-label="Search drivers" className={`${fieldCls} pl-9`} />
        </div>
        <div className="w-[130px]">
          <FieldSelect value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filter by status">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </FieldSelect>
        </div>
        <div className="w-[150px]">
          <FieldSelect value={vehicleFilter} onChange={e => setVehicleFilter(e.target.value)} aria-label="Filter by vehicle">
            <option value="all">All Vehicles</option>
            {vehicleRegs.map(v => <option key={v} value={v}>{v}</option>)}
          </FieldSelect>
        </div>
        <Button variant="outline" size="sm" icon={Download} onClick={exportCsv}>Export</Button>
      </div>

      {/* Desktop table */}
      <div className="ap-surface rounded-[20px] overflow-hidden hidden md:block">
        <table className="w-full text-sm">
          <thead className="md:sticky md:top-0">
            <tr className="border-b border-[var(--ap-border)] bg-[var(--ap-surface-2)]">
              {['Driver', 'Status', 'Mobile', 'License', 'Vehicle', 'Trips', 'This Month', 'Actions'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredDrivers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                  No drivers found
                </td>
              </tr>
            ) : filteredDrivers.map((d, i) => (
              <tr key={d.id} className="border-b border-[var(--ap-border)] last:border-0 hover:bg-[var(--ap-surface-2)] transition-colors">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] font-mono text-slate-400 w-5 flex-shrink-0 tabular-nums">{i + 1}</span>
                    <Avatar name={d.name} size={28} />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate max-w-[150px]">{d.name}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`badge ${STATUS_COLORS[d.status] || 'badge-active'} text-[10px]`}>
                    {d.status === 'active' ? '● Active' : onTripSet.has(d.name) ? '● On Trip' : '○ Inactive'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">{d.mobile || '—'}</td>
                <td className="px-4 py-2.5 text-xs font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">{d.license ?? d.license_number ?? '—'}</td>
                <td className="px-4 py-2.5 text-xs font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">{d.vehicle || '—'}</td>
                <td className="px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 tabular-nums">{d.tripCount}</td>
                <td className="px-4 py-2.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap">Rs. {monthFareOf(d.name).toLocaleString('en-IN')}</td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-1.5">
                    <IconButton icon={Eye} label={`View ${d.name}`} tone="brand" size={14} onClick={() => setSelected(d)} />
                    <IconButton icon={Edit2} label={`Edit ${d.name}`} size={14} onClick={() => setEditDriver(d)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards — stacked, no slider */}
      <div className="md:hidden space-y-2">
        {filteredDrivers.length === 0 ? (
          <div className="ap-surface rounded-[20px] px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No drivers found
          </div>
        ) : filteredDrivers.map(d => (
          <div key={d.id} className="ap-surface p-3.5">
            <div className="flex items-center gap-2.5">
              <Avatar name={d.name} size={36} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{d.name}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums truncate">{d.mobile || 'No mobile'}{d.vehicle ? ` · ${d.vehicle}` : ''}</p>
              </div>
              <span className={`badge ${STATUS_COLORS[d.status] || 'badge-active'} text-[10px] flex-shrink-0`}>
                {d.status === 'active' ? '● Active' : '○ Inactive'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-[var(--ap-border)]">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">{d.tripCount} trips · Rs. {monthFareOf(d.name).toLocaleString('en-IN')} this month</p>
              <div className="flex gap-1.5 flex-shrink-0">
                <IconButton icon={Eye} label={`View ${d.name}`} tone="brand" size={15} onClick={() => setSelected(d)} />
                <IconButton icon={Edit2} label={`Edit ${d.name}`} size={15} onClick={() => setEditDriver(d)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bata Ledger (data ledger) */}
      <div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-sf font-semibold text-slate-900 dark:text-white text-lg tracking-tight">Bata Ledger</h3>
          <Button variant="teal" size="sm" onClick={handleSyncPayslips} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync Trip Payslips'}
          </Button>
        </div>
        {syncMsg && (
          <p className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 mt-1.5">{syncMsg}</p>
        )}
        <div className="ap-surface rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--ap-border)] bg-[var(--ap-surface-2)]">
                  {['Driver','Date','Route','Vehicle','Fare (Co.)','Bata (Driver)','Driver Pay','Status'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payslips.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                      No payslips yet — complete a trip to generate a payslip
                    </td>
                  </tr>
                ) : payslips.slice(0, 20).map(p => (
                  <tr key={p.id} className="border-b border-[var(--ap-border)] hover:bg-[var(--ap-surface-2)] transition-colors">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Avatar name={p.driver} size={24} />
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[110px]">{p.driver}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{p.date}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap max-w-[140px] truncate">{p.pickup} → {p.drop}</td>
                    <td className="px-3 py-2.5 text-xs font-mono text-slate-500 dark:text-slate-400 max-w-[100px] truncate">{p.vehicle || '—'}</td>
                    <td className="px-3 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap tabular-nums">Rs. {p.fare.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2.5 text-xs text-emerald-600 dark:text-emerald-400 whitespace-nowrap tabular-nums">{p.bata > 0 ? `Rs. ${p.bata}` : '—'}</td>
                    <td className="px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-blue-300 whitespace-nowrap tabular-nums">Rs. {tripDriverAmount(p).toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2.5">
                      <StatusPill tone={p.status === 'paid' ? 'green' : 'amber'}>
                        {p.status === 'paid' ? '✓ Paid' : 'Pending'}
                      </StatusPill>
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
      {(showAdd || editDriver) && (
        <AddDriverModal
          driver={editDriver}
          onClose={() => { setShowAdd(false); setEditDriver(null) }}
          onSaved={handleDriverSaved}
        />
      )}
    </div>
  )
}
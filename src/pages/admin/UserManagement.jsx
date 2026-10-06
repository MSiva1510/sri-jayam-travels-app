// ─── User Management ──────────────────────────────────────────
// Admin  : create admin / manager / driver + edit / deactivate all
// Manager: create driver only + edit / deactivate drivers

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Edit2, UserX, UserCheck, Key, X,
  Shield, ShieldCheck, User, Users, Car, AlertCircle, CheckCircle,
  Search, RefreshCw, Mail, Phone, Lock, Eye, EyeOff,
  Download, ChevronLeft, ChevronRight, CalendarDays,
} from 'lucide-react'
import { useAuth, ROLE_LABELS, ROLE_COLORS } from '../../context/AuthContext'
import { authRepository }  from '../../repositories/authRepository'
import { permissionEngine } from '../../security/PermissionEngine'
import { loadAuditEvents } from '../../data/auditLogData'
import { loadBookings } from '../../data/tripTypes'
import { loadVehicleAssignments } from '../../data/attendanceData'
import { exportToCSV } from '../../data/reportData'
import PageHeader          from '../../components/ui/PageHeader'
import Avatar              from '../../components/ui/Avatar'

// ── Role badge ─────────────────────────────────────────────────
function RoleBadge({ role }) {
  const cfg  = ROLE_COLORS[role] || ROLE_COLORS.driver
  const Icon = role === 'admin' ? Shield : role === 'manager' ? User : Car
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
      <Icon size={11} /> {ROLE_LABELS[role] || role}
    </span>
  )
}

// ── Status pill ────────────────────────────────────────────────
function StatusPill({ status }) {
  return status === 'active'
    ? <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Active
      </span>
    : <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Inactive
      </span>
}

// ─── Add / Edit User Modal ────────────────────────────────────
// Defined OUTSIDE the page component to prevent remount on keypress
function UserModal({ editUser, currentUserRole, onClose, onSaved, showToast, defaultRole = 'driver' }) {
  const isEdit = !!editUser

  const [form, setForm] = useState({
    full_name: editUser?.full_name || editUser?.name || '',
    email:     editUser?.email     || '',
    phone:     editUser?.phone     || '',
    role:      editUser?.role      || defaultRole,
    password:  '',
    confirm:   '',
  })
  const [showPwd,  setShowPwd]  = useState(false)
  const [errors,   setErrors]   = useState({})
  const [saving,   setSaving]   = useState(false)
  const [step,     setStep]     = useState('form')  // 'form' | 'success'
  const [created,  setCreated]  = useState(null)

  const upd = (k, v) => {
    setForm(f => ({ ...f, [k]: v }))
    setErrors(e => ({ ...e, [k]: '', form: '' }))
  }

  // Managers can only create drivers
  const allowedRoles = currentUserRole === 'admin'
    ? [
        { value: 'driver',  label: 'Driver',        icon: Car },
        { value: 'manager', label: 'Manager',        icon: User },
        { value: 'admin',   label: 'Administrator',  icon: Shield },
      ]
    : [{ value: 'driver', label: 'Driver', icon: Car }]

  const validate = () => {
    const e = {}
    if (!form.full_name.trim())               e.full_name = 'Full name is required'
    if (!isEdit) {
      if (!form.email.trim())                 e.email    = 'Email is required'
      if (!/\S+@\S+\.\S+/.test(form.email))  e.email    = 'Enter a valid email'
      if (!form.password)                     e.password = 'Password is required'
      if (form.password.length < 8)           e.password = 'Minimum 8 characters'
      if (form.password !== form.confirm)     e.confirm  = 'Passwords do not match'
    }
    return e
  }

  const handleSave = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    setErrors({})
    try {
      if (isEdit) {
        await authRepository.updateProfile(editUser.id, {
          full_name: form.full_name.trim(),
          phone:     form.phone.trim() || null,
          role:      form.role,
        })
        showToast(`${form.full_name} updated`)
        onSaved()
        onClose()
      } else {
        const result = await authRepository.adminCreateUser({
          email:     form.email.trim().toLowerCase(),
          password:  form.password,
          full_name: form.full_name.trim(),
          role:      form.role,
          phone:     form.phone.trim() || null,
        })
        setCreated(result)
        setStep('success')
        onSaved()
      }
    } catch (err) {
      console.error('[UserModal] save error:', err)
      const msg = err.message?.includes('already registered')
        ? 'An account with this email already exists.'
        : err.message?.includes('Password should be at least')
        ? 'Password must be at least 8 characters.'
        : err.message || 'Failed to create user. Please try again.'
      setErrors({ form: msg })
    } finally {
      setSaving(false)
    }
  }

  const inp = `w-full px-3 py-2.5 text-sm rounded-xl border bg-white dark:bg-navy-800/60
    text-slate-800 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600
    focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all`

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div className="relative w-full sm:w-[460px] max-h-[92vh] bg-white dark:bg-navy-900 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col animate-fade-up" onClick={e => e.stopPropagation()}>

        {/* Drag handle (mobile) */}
        <div className="w-10 h-1 bg-slate-200 dark:bg-navy-700 rounded-full mx-auto mt-3 sm:hidden flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-navy-700 flex-shrink-0">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {isEdit ? 'Edit User' : 'Add New User'}
            </p>
            <h3 className="font-display font-black text-slate-800 dark:text-white text-base">
              {isEdit ? form.full_name || 'Edit User' : 'Create Account'}
            </h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-navy-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Success screen */}
        {step === 'success' ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle size={32} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="font-display font-black text-slate-800 dark:text-white text-lg">User Created!</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                <strong>{form.full_name}</strong> ({ROLE_LABELS[form.role]})
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                Account: <span className="font-mono font-bold">{form.email}</span>
              </p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-700/30 rounded-xl p-3 text-left w-full">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">⚠ Email confirmation</p>
              <p className="text-[11px] text-amber-600 dark:text-amber-500">
                If the user can't log in, go to <strong>Supabase → Authentication → Settings</strong> and disable <strong>"Confirm email"</strong>, then ask the user to try again.
              </p>
            </div>
            <button onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-navy-900 dark:bg-blue-700 text-white text-sm font-bold hover:bg-navy-800 dark:hover:bg-blue-600 transition-all">
              Done
            </button>
          </div>
        ) : (
          /* Form */
          <>
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3.5">

              {/* Error banner */}
              {errors.form && (
                <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl px-4 py-3">
                  <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 dark:text-red-400">{errors.form}</p>
                </div>
              )}

              {/* Role selector */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Role</label>
                <div className={`grid gap-2 ${allowedRoles.length === 1 ? 'grid-cols-1' : allowedRoles.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  {allowedRoles.map(({ value, label, icon: Icon }) => {
                    const cfg = ROLE_COLORS[value]
                    const selected = form.role === value
                    return (
                      <button key={value} type="button" onClick={() => upd('role', value)}
                        className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all ${
                          selected
                            ? `border-current ${cfg.bg} ${cfg.text}`
                            : 'border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800/40 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-navy-600'
                        }`}>
                        <Icon size={18} />
                        <span className="text-xs font-bold">{label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input className={`${inp} pl-9 ${errors.full_name ? 'border-red-400' : 'border-slate-200 dark:border-navy-700'}`}
                    value={form.full_name} onChange={e => upd('full_name', e.target.value)}
                    placeholder={form.role === 'driver' ? 'e.g. Ramanan Kumar' : form.role === 'manager' ? 'e.g. Kavitha Rajan' : 'e.g. Arjun Sharma'}
                    autoFocus />
                  {errors.full_name && <p className="text-[10px] text-red-500 mt-1">{errors.full_name}</p>}
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Phone Number</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input className={`${inp} pl-9 border-slate-200 dark:border-navy-700`}
                    value={form.phone} onChange={e => upd('phone', e.target.value.replace(/\D/g,'').slice(0,10))}
                    placeholder="10-digit mobile" />
                </div>
              </div>

              {/* Email — only for new user */}
              {!isEdit && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="email" className={`${inp} pl-9 ${errors.email ? 'border-red-400' : 'border-slate-200 dark:border-navy-700'}`}
                      value={form.email} onChange={e => upd('email', e.target.value)}
                      placeholder={`${form.role}@jayamtravels.in`} />
                    {errors.email && <p className="text-[10px] text-red-500 mt-1">{errors.email}</p>}
                  </div>
                </div>
              )}

              {/* Password — only for new user */}
              {!isEdit && (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type={showPwd ? 'text' : 'password'}
                        className={`${inp} pl-9 pr-10 ${errors.password ? 'border-red-400' : 'border-slate-200 dark:border-navy-700'}`}
                        value={form.password} onChange={e => upd('password', e.target.value)}
                        placeholder="Min. 8 characters" />
                      <button type="button" onClick={() => setShowPwd(v => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                        {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      {errors.password && <p className="text-[10px] text-red-500 mt-1">{errors.password}</p>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                      Confirm Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type={showPwd ? 'text' : 'password'}
                        className={`${inp} pl-9 ${errors.confirm ? 'border-red-400' : 'border-slate-200 dark:border-navy-700'}`}
                        value={form.confirm} onChange={e => upd('confirm', e.target.value)}
                        placeholder="Repeat password" />
                      {errors.confirm && <p className="text-[10px] text-red-500 mt-1">{errors.confirm}</p>}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer buttons */}
            <div className="px-5 py-4 border-t border-slate-100 dark:border-navy-700 flex gap-2 flex-shrink-0">
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-navy-900 dark:bg-blue-700 text-white text-sm font-bold hover:bg-navy-800 dark:hover:bg-blue-600 transition-all shadow-md active:scale-95 disabled:opacity-50">
                {saving
                  ? <span className="flex items-center justify-center gap-2"><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z"/></svg>Creating…</span>
                  : isEdit ? 'Save Changes' : `Create ${ROLE_LABELS[form.role]}`
                }
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Date-added presets ─────────────────────────────────────────
const DATE_PRESETS = [
  { key: 'all', label: 'Date Added' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'month', label: 'This month' },
]
function addedInPreset(createdAt, preset) {
  if (preset === 'all' || !createdAt) return preset === 'all'
  const t = new Date(createdAt).getTime()
  const now = Date.now()
  if (preset === '7d') return now - t < 7 * 86400000
  if (preset === '30d') return now - t < 30 * 86400000
  if (preset === 'month') {
    const d = new Date(createdAt), n = new Date()
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth()
  }
  return true
}
const fmtDT = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}`
}
const fmtD = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
const prettyPerm = (k) => String(k).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

// ─── User detail drawer ─────────────────────────────────────────
function UserDrawer({ profile, isSelf, canManage, lastLogin, onClose, onEdit, onResetPwd, resetting, onToggleStatus, showToast }) {
  const [dtab, setDtab] = useState('overview')
  const [activity, setActivity] = useState(null)
  const [trips, setTrips] = useState(null)
  const [vehicles, setVehicles] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    let live = true
    setDtab('overview'); setActivity(null); setTrips(null); setVehicles(null)
    if (!profile) return
    const name = (profile.full_name || '').toLowerCase()
    const email = (profile.email || '').toLowerCase();
    (async () => {
      try {
        const [evts, bks, assigns] = await Promise.all([
          Promise.resolve(loadAuditEvents(500)),
          profile.role === 'driver' ? loadBookings().catch(() => []) : Promise.resolve([]),
          profile.role === 'driver' ? loadVehicleAssignments().catch(() => []) : Promise.resolve([]),
        ])
        if (!live) return
        setActivity((Array.isArray(evts) ? evts : []).filter(e =>
          String(e.user_name || '').toLowerCase() === name ||
          String(e.user_name || '').toLowerCase() === email ||
          String(e.changed_by || '').toLowerCase() === name
        ).slice(0, 10))
        setTrips((Array.isArray(bks) ? bks : []).filter(b => (b.driver || '') === profile.full_name)
          .sort((a, b) => String(b.startDate || '').localeCompare(String(a.startDate || ''))).slice(0, 8))
        setVehicles((Array.isArray(assigns) ? assigns : []).filter(a =>
          (a.driverName || '') === profile.full_name && !a.releasedDate
        ))
      } catch { if (live) { setActivity([]); setTrips([]); setVehicles([]) } }
    })()
    return () => { live = false }
  }, [profile])

  if (!profile) return null
  const matrix = permissionEngine.getMatrix ? (permissionEngine.getMatrix()[profile.role] || {}) : {}
  const granted = Object.entries(matrix).filter(([, v]) => v).map(([k]) => k)
  const p = profile

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[100]" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-full w-full sm:w-[400px] bg-white dark:bg-navy-900 z-[101] shadow-2xl flex flex-col animate-fade-up">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-navy-700 flex-shrink-0">
          <h3 className="font-display font-black text-slate-800 dark:text-white">User Details</h3>
          <button onClick={onClose} aria-label="Close user details"
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-navy-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors">
            <X size={15} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          <div className="flex items-center gap-3">
            <Avatar name={p.full_name} size={48} />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-800 dark:text-white truncate">{p.full_name}{isSelf && ' (You)'}</p>
              <div className="mt-1"><RoleBadge role={p.role} /></div>
            </div>
            <StatusPill status={p.status} />
          </div>

          <div className="flex gap-1 bg-slate-100 dark:bg-navy-800 rounded-xl p-1">
            {[['overview', 'Overview'], ['permissions', 'Permissions'], ['activity', 'Activity'], ['trips', 'Trips']].map(([k, l]) => (
              <button key={k} onClick={() => setDtab(k)}
                className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${dtab === k ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow' : 'text-slate-500 dark:text-slate-400'}`}>
                {l}
              </button>
            ))}
          </div>

          {dtab === 'overview' && (
            <div className="glass-card rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Basic Information</p>
                {canManage && (
                  <button onClick={() => { onEdit(p); }} className="flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline">
                    <Edit2 size={11} /> Edit
                  </button>
                )}
              </div>
              {[
                ['Full Name', p.full_name || '—'], ['Email', p.email || '—'],
                ['Phone', p.phone || '—'], ['Role', ROLE_LABELS[p.role] || p.role || '—'],
                ['Status', p.status === 'active' ? 'Active' : 'Inactive'],
                ['Added On', fmtD(p.created_at)], ['Last Login', lastLogin(p)],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between gap-3 py-1.5 border-b border-slate-50 dark:border-navy-800 last:border-0">
                  <span className="text-[11px] text-slate-400 flex-shrink-0">{l}</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 text-right break-all">{v}</span>
                </div>
              ))}
            </div>
          )}

          {dtab === 'permissions' && (
            <div className="glass-card rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Role Permissions</p>
                <button onClick={() => navigate('/admin/roles')} className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline">View All</button>
              </div>
              {granted.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No permissions granted to this role.</p>
              ) : (
                <div className="space-y-1.5">
                  {granted.slice(0, 12).map(k => (
                    <p key={k} className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                      <CheckCircle size={12} className="text-emerald-500 flex-shrink-0" />{prettyPerm(k)}
                    </p>
                  ))}
                  {granted.length > 12 && <p className="text-[11px] text-slate-400">+{granted.length - 12} more — see Roles & Permissions</p>}
                </div>
              )}
            </div>
          )}

          {dtab === 'activity' && (
            <div className="glass-card rounded-2xl p-4">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Recent Activity</p>
              {activity == null ? <p className="text-xs text-slate-400 text-center py-4">Loading…</p>
                : activity.length === 0 ? <p className="text-xs text-slate-400 text-center py-4">No recorded activity.</p>
                : (
                  <div className="space-y-2">
                    {activity.map((e, i) => (
                      <div key={e.id || i} className="flex items-center gap-2 text-xs">
                        <span className="flex-1 min-w-0"><span className="font-bold text-slate-700 dark:text-slate-200">{e.action || e.label || 'Event'}</span>
                          <span className="text-slate-400"> · {e.table_name || e.module || ''}</span></span>
                        <span className="text-[10px] text-slate-400 flex-shrink-0 tabular-nums">{fmtD(e.timestamp || e.changed_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          )}

          {dtab === 'trips' && (
            <div className="glass-card rounded-2xl p-4">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Assigned Trips</p>
              {p.role !== 'driver' ? <p className="text-xs text-slate-400 text-center py-4">Trip history applies to drivers.</p>
                : trips == null ? <p className="text-xs text-slate-400 text-center py-4">Loading…</p>
                : trips.length === 0 ? <p className="text-xs text-slate-400 text-center py-4">No trips assigned.</p>
                : (
                  <div className="space-y-2">
                    {trips.map(t => (
                      <div key={t.id} className="flex items-center gap-2 text-xs">
                        <span className="font-mono text-[10px] text-slate-400 flex-shrink-0">{t.bookingNo}</span>
                        <span className="flex-1 font-bold text-slate-700 dark:text-slate-200 truncate">{t.pickup} → {t.drop}</span>
                        <span className="text-[10px] text-slate-400 flex-shrink-0 tabular-nums">{(t.startDate || '').slice(0, 10)}</span>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          )}

          {p.role === 'driver' && (
            <div className="glass-card rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Assigned Vehicles</p>
              </div>
              {vehicles == null ? <p className="text-xs text-slate-400 text-center py-3">Loading…</p>
                : vehicles.length === 0 ? <p className="text-xs text-slate-400 text-center py-3">No vehicle assigned.</p>
                : (
                  <div className="space-y-1.5">
                    <p className="text-xs font-black">{vehicles.length} Vehicle{vehicles.length !== 1 ? 's' : ''}</p>
                    {vehicles.map(v => (
                      <p key={v.id} className="text-xs font-bold text-slate-700 dark:text-slate-200">🚙 {v.vehicleReg}{v.vehicleModel ? ` · ${v.vehicleModel}` : ''}</p>
                    ))}
                  </div>
                )}
            </div>
          )}
        </div>
        {canManage && (
          <div className="px-5 py-3.5 border-t border-slate-100 dark:border-navy-700 flex gap-2 flex-shrink-0">
            <button onClick={() => onEdit(p)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-navy-900 dark:bg-blue-700 text-white text-xs font-bold hover:bg-navy-800 transition-all active:scale-95">
              <Edit2 size={13} /> Edit User
            </button>
            <button onClick={() => onResetPwd(p)} disabled={resetting}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-200 dark:border-navy-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors disabled:opacity-50">
              <Key size={13} /> Reset Password
            </button>
            {!isSelf && (
              <button onClick={() => onToggleStatus(p)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-white transition-all active:scale-95 ${p.status === 'active' ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
                {p.status === 'active' ? <><UserX size={13} /> Deactivate</> : <><UserCheck size={13} /> Activate</>}
              </button>
            )}
          </div>
        )}
      </aside>
    </>
  )
}

// ─── Main Page ─────────────────────────────────────────────────
const PAGE_SIZE = 10
export default function UserManagement() {
  const { user: currentUser, isAdmin, isManager } = useAuth()
  const navigate = useNavigate()

  const [profiles,   setProfiles]   = useState([])
  const [auditMap,   setAuditMap]   = useState({})
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [roleTab,    setRoleTab]    = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [page,       setPage]       = useState(1)
  const [goTo,       setGoTo]       = useState('')
  const [selected,   setSelected]   = useState(() => new Set())
  const [drawer,     setDrawer]     = useState(null)
  const [showModal,  setShowModal]  = useState(false)
  const [editUser,   setEditUser]   = useState(null)
  const [toast,      setToast]      = useState('')
  const [resetting,  setResetting]  = useState(null)
  const [bulking,    setBulking]    = useState(false)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500) }

  const load = useCallback(async () => {
    setLoading(true)
    const [list, evts] = await Promise.all([
      authRepository.listProfiles(),
      Promise.resolve(loadAuditEvents(500)).catch(() => []),
    ])
    const scoped = isAdmin ? list : list.filter(p => p.role === 'driver')
    setProfiles(scoped)
    // Latest login per user from real USER_LOGIN audit events
    const logins = {}
    ;(Array.isArray(evts) ? evts : []).forEach(e => {
      if (e.action !== 'USER_LOGIN') return
      const key = String(e.user_name || '').toLowerCase()
      if (!key) return
      const t = new Date(e.timestamp || e.changed_at).getTime()
      if (Number.isFinite(t) && (!logins[key] || t > logins[key])) logins[key] = t
    })
    setAuditMap(logins)
    setLoading(false)
  }, [isAdmin])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1); setGoTo(''); setSelected(new Set()) }, [search, roleTab, roleFilter, statusFilter, dateFilter])

  const lastLogin = useCallback((p) => {
    const t = auditMap[String(p.full_name || '').toLowerCase()] ?? auditMap[String(p.email || '').toLowerCase()]
    return t ? fmtDT(new Date(t).toISOString()) : '—'
  }, [auditMap])

  const handleOpen = (user = null) => {
    setEditUser(user)
    setShowModal(true)
  }

  const doToggleStatus = async (profile, next) => {
    await authRepository.updateProfile(profile.id, { status: next })
    return next
  }
  const handleToggleStatus = async (profile) => {
    if (profile.id === currentUser?.id) {
      showToast('You cannot deactivate your own account.')
      return
    }
    const next = profile.status === 'active' ? 'inactive' : 'active'
    await doToggleStatus(profile, next)
    showToast(`${profile.full_name} ${next === 'active' ? 'activated' : 'deactivated'}`)
    if (drawer?.id === profile.id) setDrawer({ ...drawer, status: next })
    load()
  }

  const handleResetPwd = async (profile) => {
    setResetting(profile.id)
    try {
      await authRepository.sendPasswordReset(profile.email)
      showToast(`Password reset sent to ${profile.email}`)
    } catch {
      showToast('Failed to send reset email.')
    } finally {
      setResetting(null)
    }
  }

  const handleBulk = async (next) => {
    const ids = [...selected].filter(id => id !== currentUser?.id)
    if (ids.length === 0) { showToast('Nothing selected.'); return }
    if (!window.confirm(`${next === 'active' ? 'Activate' : 'Deactivate'} ${ids.length} account${ids.length !== 1 ? 's' : ''}?`)) return
    setBulking(true)
    try {
      for (const id of ids) { try { await doToggleStatus({ id }, next) } catch {} }
      showToast(`${ids.length} account${ids.length !== 1 ? 's' : ''} ${next === 'active' ? 'activated' : 'deactivated'}`)
      setSelected(new Set())
      load()
    } finally {
      setBulking(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return profiles.filter(p => {
      if (roleTab === 'inactive') { if (p.status !== 'inactive') return false }
      else if (roleTab !== 'all' && p.role !== roleTab) return false
      if (roleFilter !== 'all' && p.role !== roleFilter) return false
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (!addedInPreset(p.created_at, dateFilter)) return false
      if (q && ![p.full_name, p.email, p.phone].some(v => String(v ?? '').toLowerCase().includes(q))) return false
      return true
    })
  }, [profiles, search, roleTab, roleFilter, statusFilter, dateFilter])

  const counts = useMemo(() => ({
    all: profiles.length,
    admin: profiles.filter(p => p.role === 'admin').length,
    manager: profiles.filter(p => p.role === 'manager').length,
    driver: profiles.filter(p => p.role === 'driver').length,
    inactive: profiles.filter(p => p.status !== 'active').length,
    active: profiles.filter(p => p.status === 'active').length,
    roles: new Set(profiles.map(p => p.role).filter(Boolean)).size,
  }), [profiles])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const submitGoTo = () => {
    const n = Number(goTo)
    if (Number.isInteger(n) && n >= 1 && n <= totalPages) setPage(n)
    setGoTo('')
  }
  const allPageChecked = pageRows.length > 0 && pageRows.every(p => selected.has(p.id))
  const toggleOne = (id) => setSelected(prev => {
    const n = new Set(prev)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })
  const togglePage = () => setSelected(prev => {
    const n = new Set(prev)
    if (allPageChecked) pageRows.forEach(p => n.delete(p.id))
    else pageRows.forEach(p => n.add(p.id))
    return n
  })

  const handleExport = () => exportToCSV(filtered.map(p => ({
    name: p.full_name, email: p.email, phone: p.phone || '', role: p.role,
    status: p.status, added: (p.created_at || '').slice(0, 10), lastLogin: lastLogin(p),
  })), [
    { label: 'Name', key: 'name' }, { label: 'Email', key: 'email' }, { label: 'Phone', key: 'phone' },
    { label: 'Role', key: 'role' }, { label: 'Status', key: 'status' },
    { label: 'Added On', key: 'added' }, { label: 'Last Login', key: 'lastLogin' },
  ], 'user_accounts')

  const selCls = 'px-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-200 focus:outline-none font-bold'
  const tabs = [
    ['all', 'All Users', counts.all, Users],
    ['admin', 'Administrators', counts.admin, Shield],
    ['manager', 'Managers', counts.manager, User],
    ['driver', 'Drivers', counts.driver, Car],
    ['inactive', 'Inactive', counts.inactive, UserX],
  ]

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="User Accounts"
        subtitle="Manage system users, roles and permissions"
        action={
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/admin/roles')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors">
              <ShieldCheck size={15} /> Roles & Permissions
            </button>
            <button onClick={() => handleOpen(null)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all shadow-lg active:scale-95">
              <Plus size={15} /> Add User
            </button>
          </div>
        }
      />

      {toast && (
        <div className="flex items-center gap-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl px-4 py-2.5">
          <CheckCircle size={15} className="text-emerald-600 flex-shrink-0" />
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{toast}</p>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: <Users size={16} />, value: counts.all, label: 'Total Users', tone: 'bg-blue-600' },
          { icon: <UserCheck size={16} />, value: counts.active, label: 'Active Users', tone: 'bg-emerald-600' },
          { icon: <UserX size={16} />, value: counts.inactive, label: 'Inactive Users', tone: 'bg-red-500' },
          { icon: <Shield size={16} />, value: counts.roles, label: 'Roles Assigned', tone: 'bg-violet-600' },
        ].map(k => (
          <div key={k.label} className="glass-card rounded-2xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${k.tone} flex items-center justify-center text-white flex-shrink-0`}>{k.icon}</div>
            <div>
              <p className="text-2xl font-display font-black tabular-nums leading-none text-slate-800 dark:text-white">{k.value}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Role tabs */}
      <div className="flex gap-1.5 bg-slate-100 dark:bg-navy-800 rounded-2xl p-1.5 overflow-x-auto no-scrollbar w-fit max-w-full">
        {tabs.map(([k, l, n, Icon]) => (
          <button key={k} onClick={() => setRoleTab(k)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${roleTab === k ? 'bg-navy-900 dark:bg-blue-700 text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
            <Icon size={13} />{l}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${roleTab === k ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-navy-700 text-slate-500 dark:text-slate-400'}`}>{n}</span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email or phone…"
            className="w-full pl-8 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none" />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className={selCls} title="All Roles">
          <option value="all">All Roles</option>
          <option value="admin">Administrator</option>
          <option value="manager">Manager</option>
          <option value="driver">Driver</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selCls} title="All Status">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className={selCls} title="Date Added">
          {DATE_PRESETS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
        </select>
        <button onClick={() => { setSearch(''); setRoleFilter('all'); setStatusFilter('all'); setDateFilter('all'); setRoleTab('all') }}
          className="flex items-center gap-1 px-3 py-2.5 text-xs font-bold rounded-xl text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors">
          <X size={13} /> Clear
        </button>
        <button onClick={handleExport}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 ml-auto">
          <Download size={13} /> Export
        </button>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 flex-wrap rounded-2xl border border-blue-200 dark:border-blue-800/40 bg-blue-50 dark:bg-blue-900/15 px-4 py-2.5">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{selected.size} selected</p>
          <button onClick={() => handleBulk('active')} disabled={bulking}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors disabled:opacity-50">Activate</button>
          <button onClick={() => handleBulk('inactive')} disabled={bulking}
            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors disabled:opacity-50">Deactivate</button>
          <button onClick={() => setSelected(new Set())} className="text-xs font-bold text-slate-500 dark:text-slate-300 hover:underline">Clear selection</button>
        </div>
      )}

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center space-y-2">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400">Loading accounts…</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14">
            <User size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">No accounts found</p>
            <p className="text-xs text-slate-400 mt-1">Try a different search or filter</p>
          </div>
        ) : (<>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-navy-700 bg-slate-50/80 dark:bg-navy-800/50">
                  <th className="px-3 py-3 w-8">
                    <input type="checkbox" checked={allPageChecked} onChange={togglePage} aria-label="Select page"
                      className="w-4 h-4 rounded accent-blue-600" />
                  </th>
                  {['#', 'Name', 'Email', 'Role', 'Phone', 'Status', 'Last Login', 'Added On', 'Actions'].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((p, i) => {
                  const isSelf = p.id === currentUser?.id
                  const canManage = isAdmin || (isManager && p.role === 'driver')
                  return (
                    <tr key={p.id} className={`border-b border-slate-50 dark:border-navy-800 hover:bg-slate-50/60 dark:hover:bg-navy-800/40 transition-colors ${isSelf ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}>
                      <td className="px-3 py-2.5">
                        <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} aria-label={`Select ${p.full_name}`}
                          className="w-4 h-4 rounded accent-blue-600" />
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-400 tabular-nums">{(safePage - 1) * PAGE_SIZE + i + 1}</td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => setDrawer(p)} className="flex items-center gap-2.5 text-left">
                          <Avatar name={p.full_name} size={30} />
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                            {p.full_name}
                            {isSelf && <span className="ml-1.5 text-[9px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full">You</span>}
                          </span>
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{p.email}</td>
                      <td className="px-3 py-2.5"><RoleBadge role={p.role} /></td>
                      <td className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{p.phone || '—'}</td>
                      <td className="px-3 py-2.5"><StatusPill status={p.status} /></td>
                      <td className="px-3 py-2.5 text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap tabular-nums">{lastLogin(p)}</td>
                      <td className="px-3 py-2.5 text-[11px] text-slate-400 whitespace-nowrap tabular-nums">{fmtD(p.created_at)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setDrawer(p)} title="View details"
                            className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-navy-700 hidden sm:flex items-center justify-center text-slate-500 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 transition-colors">
                            <Eye size={12} />
                          </button>
                          {canManage && (<>
                            <button onClick={() => handleOpen(p)} title="Edit"
                              className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-navy-700 flex items-center justify-center text-slate-500 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 transition-colors">
                              <Edit2 size={12} />
                            </button>
                            <button onClick={() => handleResetPwd(p)} disabled={resetting === p.id} title="Send password reset"
                              className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-navy-700 hidden sm:flex items-center justify-center text-slate-500 hover:bg-amber-100 hover:text-amber-600 dark:hover:bg-amber-900/30 dark:hover:text-amber-400 transition-colors disabled:opacity-40">
                              <Key size={12} />
                            </button>
                            {!isSelf && (
                              <button onClick={() => handleToggleStatus(p)}
                                title={p.status === 'active' ? 'Deactivate' : 'Activate'}
                                className={`w-7 h-7 rounded-lg bg-slate-100 dark:bg-navy-700 hidden sm:flex items-center justify-center transition-colors ${p.status === 'active'
                                  ? 'text-slate-500 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400'
                                  : 'text-slate-500 hover:bg-emerald-100 hover:text-emerald-600 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400'}`}>
                                {p.status === 'active' ? <UserX size={12} /> : <UserCheck size={12} />}
                              </button>
                            )}
                          </>)}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2 flex-wrap px-4 py-3 border-t border-slate-100 dark:border-navy-700">
            <p className="text-xs text-slate-400 tabular-nums mr-auto">
              Showing {filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1} to {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} users
            </p>
            <button disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} aria-label="Previous page"
              className="w-8 h-8 rounded-lg border border-slate-200 dark:border-navy-700 flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors">
              <ChevronLeft size={13} />
            </button>
            <span className="min-w-[32px] h-8 px-2 rounded-lg bg-navy-900 dark:bg-blue-700 text-white text-xs font-bold flex items-center justify-center tabular-nums">{safePage}</span>
            <span className="text-xs text-slate-400 tabular-nums">/ {totalPages}</span>
            <button disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} aria-label="Next page"
              className="w-8 h-8 rounded-lg border border-slate-200 dark:border-navy-700 flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors">
              <ChevronRight size={13} />
            </button>
            <span className="flex items-center gap-1.5 ml-1">
              <input value={goTo} onChange={e => setGoTo(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => { if (e.key === 'Enter') submitGoTo() }} placeholder={`1–${totalPages}`} title={`Go to page (1–${totalPages})`}
                className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-xs font-bold tabular-nums text-slate-600 dark:text-slate-300 focus:outline-none text-center" />
              <button onClick={submitGoTo}
                className="px-3 py-1.5 rounded-lg bg-navy-900 dark:bg-blue-700 text-white text-xs font-bold hover:opacity-90 transition-all">Go</button>
            </span>
          </div>
        </>)}
      </div>

      {/* Detail drawer */}
      {drawer && (
        <UserDrawer
          profile={drawer} isSelf={drawer.id === currentUser?.id}
          canManage={isAdmin || (isManager && drawer.role === 'driver')}
          lastLogin={lastLogin}
          onClose={() => setDrawer(null)}
          onEdit={(p) => { setDrawer(null); handleOpen(p) }}
          onResetPwd={handleResetPwd} resetting={resetting === drawer.id}
          onToggleStatus={async (p) => { await handleToggleStatus(p); }}
          showToast={showToast}
        />
      )}

      {/* Modal */}
      {showModal && (
        <UserModal
          editUser={editUser}
          currentUserRole={currentUser?.role}
          onClose={() => { setShowModal(false); setEditUser(null) }}
          onSaved={load}
          showToast={showToast}
          defaultRole={typeof showModal === 'object' ? showModal.defaultRole : undefined}
        />
      )}
    </div>
  )
}

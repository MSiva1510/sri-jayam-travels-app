// ─── User Management ──────────────────────────────────────────
// Admin: create / edit / deactivate any user
// Manager: create / edit / deactivate drivers only
// Driver: no access (route-guarded)

import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Edit2, UserX, UserCheck, Key, X, Shield, User, Car,
  AlertCircle, CheckCircle, Search, RefreshCw,
} from 'lucide-react'
import { useAuth, ROLE_LABELS, ROLE_COLORS } from '../../context/AuthContext.jsx'
import { authRepository }  from '../../repositories/authRepository.js'
import PageHeader          from '../../components/ui/PageHeader'
import Avatar              from '../../components/ui/Avatar'

// ── Helpers ────────────────────────────────────────────────────
function RoleBadge({ role }) {
  const cfg = ROLE_COLORS[role] || ROLE_COLORS.driver
  const Icon = role === 'admin' ? Shield : role === 'manager' ? User : Car
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
      <Icon size={11} /> {ROLE_LABELS[role] || role}
    </span>
  )
}

function StatusPill({ status }) {
  return status === 'active'
    ? <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Active</span>
    : <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Inactive</span>
}

// ── Create / Edit Modal ────────────────────────────────────────
function UserModal({ editUser, currentUserRole, onClose, onSaved }) {
  const isEdit = !!editUser
  const [form, setForm] = useState({
    full_name: editUser?.full_name || editUser?.name || '',
    email:     editUser?.email     || '',
    phone:     editUser?.phone     || '',
    role:      editUser?.role      || 'driver',
    password:  '',
    confirm:   '',
  })
  const [errors,  setErrors]  = useState({})
  const [saving,  setSaving]  = useState(false)
  const [toast,   setToast]   = useState('')

  const upd = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })) }

  // Manager can only set driver role
  const allowedRoles = currentUserRole === 'admin'
    ? ['admin', 'manager', 'driver']
    : ['driver']

  const validate = () => {
    const e = {}
    if (!form.full_name.trim())              e.full_name = 'Name is required'
    if (!isEdit && !form.email.trim())       e.email     = 'Email is required'
    if (!isEdit && !form.password)           e.password  = 'Password is required'
    if (!isEdit && form.password.length < 8) e.password  = 'Minimum 8 characters'
    if (!isEdit && form.password !== form.confirm) e.confirm = 'Passwords do not match'
    return e
  }

  const handleSave = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    try {
      if (isEdit) {
        // Update existing profile
        await authRepository.updateProfile(editUser.id, {
          full_name: form.full_name.trim(),
          phone:     form.phone.trim() || null,
          role:      form.role,
        })
        setToast('User updated')
      } else {
        // Create new auth user + profile
        await authRepository.adminCreateUser({
          email:     form.email.trim().toLowerCase(),
          password:  form.password,
          full_name: form.full_name.trim(),
          role:      form.role,
          phone:     form.phone.trim() || null,
        })
        setToast('User created')
      }
      setTimeout(() => { onSaved(); onClose() }, 800)
    } catch (err) {
      console.error('[UserManagement] save error:', err)
      const msg = err.message?.includes('already registered')
        ? 'An account with this email already exists.'
        : err.message || 'Save failed. Please try again.'
      setErrors({ form: msg })
    } finally {
      setSaving(false)
    }
  }

  const inp = `w-full px-3 py-2.5 text-sm rounded-xl border bg-white dark:bg-navy-800/60
    text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/25
    transition-all placeholder-slate-300 dark:placeholder-slate-600`

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="relative w-full sm:w-[460px] max-h-[90vh] bg-white dark:bg-navy-900 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col">
        <div className="w-10 h-1 bg-slate-200 dark:bg-navy-700 rounded-full mx-auto mt-3 sm:hidden flex-shrink-0" />
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-navy-700 flex-shrink-0">
          <h3 className="font-display font-black text-slate-800 dark:text-white text-base">
            {isEdit ? 'Edit User' : 'Create User'}
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-navy-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          {toast && (
            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl px-4 py-2.5">
              <CheckCircle size={14} className="text-emerald-600 flex-shrink-0" />
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{toast}</span>
            </div>
          )}
          {errors.form && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl px-4 py-2.5">
              <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-700 dark:text-red-400">{errors.form}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Full Name <span className="text-red-500">*</span></label>
              <input className={`${inp} ${errors.full_name ? 'border-red-400' : 'border-slate-200 dark:border-navy-700'}`}
                value={form.full_name} onChange={e => upd('full_name', e.target.value)} placeholder="e.g. Ramanan Kumar" />
              {errors.full_name && <p className="text-[10px] text-red-500 mt-0.5">{errors.full_name}</p>}
            </div>

            {!isEdit && (
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Email Address <span className="text-red-500">*</span></label>
                <input type="email" className={`${inp} ${errors.email ? 'border-red-400' : 'border-slate-200 dark:border-navy-700'}`}
                  value={form.email} onChange={e => upd('email', e.target.value)} placeholder="user@jayamtravels.in" />
                {errors.email && <p className="text-[10px] text-red-500 mt-0.5">{errors.email}</p>}
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Phone</label>
              <input className={`${inp} border-slate-200 dark:border-navy-700`}
                value={form.phone} onChange={e => upd('phone', e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="10-digit mobile" />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Role <span className="text-red-500">*</span></label>
              <select className={`${inp} border-slate-200 dark:border-navy-700 appearance-none`}
                value={form.role} onChange={e => upd('role', e.target.value)}
                disabled={allowedRoles.length === 1}>
                {allowedRoles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>

            {!isEdit && (
              <>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Password <span className="text-red-500">*</span></label>
                  <input type="password" className={`${inp} ${errors.password ? 'border-red-400' : 'border-slate-200 dark:border-navy-700'}`}
                    value={form.password} onChange={e => upd('password', e.target.value)} placeholder="Min. 8 characters" />
                  {errors.password && <p className="text-[10px] text-red-500 mt-0.5">{errors.password}</p>}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Confirm Password <span className="text-red-500">*</span></label>
                  <input type="password" className={`${inp} ${errors.confirm ? 'border-red-400' : 'border-slate-200 dark:border-navy-700'}`}
                    value={form.confirm} onChange={e => upd('confirm', e.target.value)} placeholder="Repeat password" />
                  {errors.confirm && <p className="text-[10px] text-red-500 mt-0.5">{errors.confirm}</p>}
                </div>
                <p className="col-span-2 text-[10px] text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-navy-800/40 rounded-lg px-3 py-2">
                  ℹ️ The user will receive a confirmation email. Disable "Confirm email" in Supabase Auth Settings for instant access.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 dark:border-navy-700 flex gap-2 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-navy-900 dark:bg-blue-700 text-white text-sm font-bold hover:bg-navy-800 dark:hover:bg-blue-600 transition-all shadow-md active:scale-95 disabled:opacity-50">
            {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Create User')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────
export default function UserManagement() {
  const { user: currentUser, isAdmin, isManager } = useAuth()

  const [profiles, setProfiles]   = useState([])
  const [loading,  setLoading]    = useState(true)
  const [search,   setSearch]     = useState('')
  const [showModal,setShowModal]  = useState(false)
  const [editUser, setEditUser]   = useState(null)
  const [toast,    setToast]      = useState('')
  const [resetting,setResetting]  = useState(null)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500) }

  const load = useCallback(async () => {
    setLoading(true)
    const list = await authRepository.listProfiles()
    // Managers only see drivers
    setProfiles(isAdmin ? list : list.filter(p => p.role === 'driver'))
    setLoading(false)
  }, [isAdmin])

  useEffect(() => { load() }, [load])

  const handleToggleStatus = async (profile) => {
    if (profile.id === currentUser?.id) {
      showToast('You cannot deactivate your own account.')
      return
    }
    const newStatus = profile.status === 'active' ? 'inactive' : 'active'
    await authRepository.updateProfile(profile.id, { status: newStatus })
    showToast(`${profile.full_name} ${newStatus === 'active' ? 'activated' : 'deactivated'}`)
    load()
  }

  const handleResetPassword = async (profile) => {
    setResetting(profile.id)
    try {
      await authRepository.sendPasswordReset(profile.email)
      showToast(`Password reset email sent to ${profile.email}`)
    } catch (err) {
      showToast('Failed to send reset email.')
    } finally {
      setResetting(null)
    }
  }

  const filtered = profiles.filter(p =>
    p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.email?.toLowerCase().includes(search.toLowerCase()) ||
    p.role?.includes(search.toLowerCase())
  )

  const canManage = (profile) => {
    if (isAdmin) return true
    if (isManager && profile.role === 'driver') return true
    return false
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="User Management"
        subtitle={`${profiles.length} accounts · ${profiles.filter(p => p.status === 'active').length} active`}
        action={
          <button onClick={() => { setEditUser(null); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-navy-900 dark:bg-blue-700 text-white font-bold text-sm hover:bg-navy-800 dark:hover:bg-blue-600 transition-all shadow-lg active:scale-95">
            <Plus size={15} /> Add User
          </button>
        }
      />

      {/* Toast */}
      {toast && (
        <div className="flex items-center gap-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl px-4 py-2.5">
          <CheckCircle size={15} className="text-emerald-600 flex-shrink-0" />
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{toast}</p>
        </div>
      )}

      {/* Search + refresh */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email or role…"
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800/60 text-slate-800 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-navy-500/20 transition-all"
          />
        </div>
        <button onClick={load}
          className="w-10 h-10 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* User table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center space-y-2">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400">Loading users…</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14">
            <User size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">No users found</p>
            {search && <p className="text-xs text-slate-400 mt-1">Try a different search term</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-navy-700 bg-slate-50/80 dark:bg-navy-800/50">
                  {['User', 'Role', 'Phone', 'Status', 'Created', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b border-slate-50 dark:border-navy-800 hover:bg-slate-50/60 dark:hover:bg-navy-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={p.full_name} size={32} />
                        <div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{p.full_name}</p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500">{p.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><RoleBadge role={p.role} /></td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{p.phone || '—'}</td>
                    <td className="px-4 py-3"><StatusPill status={p.status} /></td>
                    <td className="px-4 py-3 text-xs text-slate-400">{p.created_at?.slice(0,10) || '—'}</td>
                    <td className="px-4 py-3">
                      {canManage(p) && (
                        <div className="flex items-center gap-1">
                          {/* Edit */}
                          <button onClick={() => { setEditUser(p); setShowModal(true) }}
                            title="Edit" className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-navy-700 flex items-center justify-center text-slate-500 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 transition-colors">
                            <Edit2 size={12} />
                          </button>
                          {/* Reset password */}
                          <button onClick={() => handleResetPassword(p)} disabled={resetting === p.id}
                            title="Send password reset email" className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-navy-700 flex items-center justify-center text-slate-500 hover:bg-amber-100 hover:text-amber-600 dark:hover:bg-amber-900/30 dark:hover:text-amber-400 transition-colors disabled:opacity-40">
                            <Key size={12} />
                          </button>
                          {/* Activate / Deactivate */}
                          {p.id !== currentUser?.id && (
                            <button onClick={() => handleToggleStatus(p)}
                              title={p.status === 'active' ? 'Deactivate' : 'Activate'}
                              className={`w-7 h-7 rounded-lg bg-slate-100 dark:bg-navy-700 flex items-center justify-center transition-colors ${
                                p.status === 'active'
                                  ? 'text-slate-500 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400'
                                  : 'text-slate-500 hover:bg-emerald-100 hover:text-emerald-600 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400'
                              }`}>
                              {p.status === 'active' ? <UserX size={12} /> : <UserCheck size={12} />}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <UserModal
          editUser={editUser}
          currentUserRole={currentUser?.role}
          onClose={() => { setShowModal(false); setEditUser(null) }}
          onSaved={load}
        />
      )}
    </div>
  )
}
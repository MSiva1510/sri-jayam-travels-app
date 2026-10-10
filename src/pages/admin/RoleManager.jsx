// ─── Role Manager Page ────────────────────────────────────────
// Role cards + info + summary + module permission matrix, all backed by
// the real permissionEngine matrix (role_permissions table). Custom roles
// persist their definitions locally; their permissions persist as real
// role_permissions rows, enforced by can() (unknown roles deny by default).
// NOTE: module rows toggle only real permissions — cells without a real
// permission are omitted rather than faked.

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Shield, ShieldCheck, User, Users, Car, Check, X, RefreshCw,
  ChevronDown, Copy, Eye, Search, Crown,
  LayoutDashboard, FileText, Navigation, Receipt, FolderOpen,
  CalendarCheck, IndianRupee, MessageSquare, BarChart2,
  Lock, Bell,
} from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Avatar from '../../components/ui/Avatar'
import { useAdmin } from '../../context/AdminContext'
import { setRolePermission } from '../../services/adminService'
import { authRepository } from '../../repositories/authRepository'
import { permissionEngine } from '../../security/PermissionEngine'
import { loadAuditEvents } from '../../data/auditLogData'
import { useAuth } from '../../context/AuthContext'

const LS_ROLE_DEFS = 'sjt_role_defs'
const rDefs = () => { try { return JSON.parse(localStorage.getItem(LS_ROLE_DEFS) || '{}') } catch { return {} } }
const wDefs = (d) => { try { localStorage.setItem(LS_ROLE_DEFS, JSON.stringify(d)) } catch {} }

// ── Modules with their REAL permissions (no invented cells) ──
const MODULES = [
  { key: 'dashboard', label: 'Dashboard', desc: 'View dashboard and key metrics', icon: LayoutDashboard, perms: ['view_dashboard'] },
  { key: 'invoices', label: 'Invoices', desc: 'Manage invoices and payments', icon: FileText, perms: ['view_invoices', 'generate_invoice'] },
  { key: 'trips', label: 'Trips', desc: 'Create and manage trips', icon: Navigation, perms: ['create_booking', 'edit_booking', 'delete_booking', 'approve_booking', 'assign_driver', 'start_trip', 'complete_trip'] },
  { key: 'customers', label: 'Customers', desc: 'Manage customer information', icon: Users, perms: ['manage_customers'] },
  { key: 'expenses', label: 'Expenses', desc: 'Manage expenses and reimbursements', icon: Receipt, perms: ['create_expense', 'approve_expense', 'reject_expense'] },
  { key: 'drivers', label: 'Drivers', desc: 'Manage driver information', icon: User, perms: ['manage_drivers'] },
  { key: 'vehicles', label: 'Vehicles', desc: 'Manage vehicle information', icon: Car, perms: ['manage_vehicles'] },
  { key: 'attendance', label: 'Attendance', desc: 'Manage driver attendance', icon: CalendarCheck, perms: ['view_dashboard'] },
  { key: 'documents', label: 'Documents', desc: 'Manage documents and files', icon: FolderOpen, perms: ['manage_documents'] },
  { key: 'payroll', label: 'Payroll', desc: 'Manage payroll and salaries', icon: IndianRupee, perms: ['manage_payroll', 'view_finance'] },
  { key: 'communications', label: 'Communications', desc: 'Send notifications and messages', icon: MessageSquare, perms: ['manage_communications', 'notification_management'] },
  { key: 'reports', label: 'Reports', desc: 'View reports and analytics', icon: BarChart2, perms: ['view_reports', 'export_reports'] },
]
const ADMIN_MODULES = [
  { key: 'admin', label: 'Administration', desc: 'Users, roles, settings and system', icon: ShieldCheck, perms: ['manage_users', 'manage_roles', 'system_settings', 'view_audit_log', 'backup_restore', 'view_health'] },
]

const BUILTIN_META = {
  admin: { label: 'Administrator', desc: 'Full system access', icon: Crown, tile: 'bg-violet-600' },
  manager: { label: 'Manager', desc: 'Operational access', icon: Users, tile: 'bg-blue-600' },
  driver: { label: 'Driver', desc: 'Limited access', icon: Car, tile: 'bg-emerald-600' },
}


export default function RoleManager() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { roleMatrix, setRoleMatrix } = useAdmin()

  // Only admin / manager / driver exist — drop any other stored defs.
  const [defs, setDefs] = useState(() => {
    const d = rDefs()
    const keep = {}
    ;['admin', 'manager', 'driver'].forEach(k => { if (d[k]) keep[k] = d[k] })
    if (Object.keys(d).length !== Object.keys(keep).length) wDefs(keep)
    return keep
  })
  const [sel, setSel] = useState('admin')
  const [rtab, setRtab] = useState('perms')
  const [search, setSearch] = useState('')
  const [expandAll, setExpandAll] = useState(false)
  const [openMods, setOpenMods] = useState(() => new Set())
  const [saving, setSaving] = useState({})
  const [users, setUsers] = useState([])
  const [activity, setActivity] = useState([])
  const [showCopy, setShowCopy] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [toast, setToast] = useState('')
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    authRepository.listProfiles().then(u => setUsers(Array.isArray(u) ? u : [])).catch(() => setUsers([]))
    Promise.resolve(loadAuditEvents(300)).then(e => setActivity(Array.isArray(e) ? e : [])).catch(() => setActivity([]))
  }, [])

  const saveDefs = (d) => { setDefs(d); wDefs(d) }
  const roles = useMemo(() => {
    // Fixed set: admin, manager, driver. Anything else in the matrix
    // (future/custom roles) is intentionally hidden and unmanageable here.
    return ['admin', 'manager', 'driver']
      .filter(k => roleMatrix && Object.prototype.hasOwnProperty.call(roleMatrix, k))
      .map(k => {
        const builtin = BUILTIN_META[k]
        const def = defs[k] || {}
        return {
          key: k,
          label: builtin.label,
          desc: builtin.desc,
          icon: builtin.icon,
          tile: builtin.tile,
          builtin: true,
          status: def.status || 'active',
          createdAt: def.createdAt || null,
          updatedAt: def.updatedAt || null,
        }
      })
  }, [roleMatrix, defs])
  useEffect(() => {
    if (!roles.some(r => r.key === sel) && roles.length) setSel(roles[0].key)
  }, [roles, sel])
  const role = roles.find(r => r.key === sel) || roles[0]
  const perms = (roleMatrix && role) ? (roleMatrix[role.key] || {}) : {}

  const granted = Object.entries(perms).filter(([, v]) => v).map(([k]) => k)
  const roleUsers = useMemo(() => users.filter(u => u.role === role?.key), [users, role])
  const roleActivity = useMemo(() => activity.filter(e =>
    e.action === 'PERMISSION_CHANGED' && String(e.description || '').startsWith(`${role?.key}.`)
  ).slice(0, 15), [activity, role])

  const modulesAccess = [...MODULES, ...ADMIN_MODULES].filter(m => m.perms.some(p => perms[p])).length

  const toggleMod = (key) => setOpenMods(prev => {
    const n = new Set(prev)
    if (n.has(key)) n.delete(key); else n.add(key)
    return n
  })

  const handleToggle = async (permission, current) => {
    if (role?.key === 'admin') return // admin stays full-access
    const key = `${role.key}.${permission}`
    setSaving(s => ({ ...s, [key]: true }))
    try {
      await setRolePermission(role.key, permission, !current, user?.name)
      setRoleMatrix(prev => ({ ...prev, [role.key]: { ...(prev[role.key] || {}), [permission]: !current } }))
    } finally {
      setSaving(s => ({ ...s, [key]: false }))
    }
  }

  const isOpen = (k) => expandAll || openMods.has(k)

  const touchDef = (patch) => {
    if (!role || role.builtin) return
    const d = { ...defs, [role.key]: { ...(defs[role.key] || {}), ...patch, updatedAt: new Date().toISOString() } }
    saveDefs(d)
  }

  if (!role) return null

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Role Manager"
        subtitle="Configure permissions for each role across all modules"
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowCopy(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-[var(--ap-surface-2)] transition-colors">
              <Copy size={15} /> Copy from Role
            </button>
            <button onClick={() => setShowPreview(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-[var(--ap-surface-2)] transition-colors">
              <Eye size={15} /> Preview Access
            </button>

          </div>
        }
      />

      {toast && (
        <div className="flex items-center gap-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl px-4 py-2.5">
          <Check size={15} className="text-emerald-600 flex-shrink-0" />
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{toast}</p>
        </div>
      )}

      {/* Role selector (compact) */}
      <div className="flex gap-1.5 bg-[var(--ap-surface-2)] rounded-2xl p-1.5 w-fit max-w-full overflow-x-auto no-scrollbar">
        {roles.map(r => {
          const Icon = r.icon
          const active = r.key === sel
          return (
            <button key={r.key} onClick={() => setSel(r.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${active ? 'bg-[var(--ap-accent)] text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
              <Icon size={13} />{r.label}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: info + summary */}
        <div className="space-y-4">
          <div className="ap-surface rounded-2xl p-4 space-y-3">
            <p className="text-sm font-bold text-slate-800 dark:text-white">Role Information</p>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Role Name *</label>
              <input value={role.label} disabled={role.builtin} onChange={e => touchDef({ label: e.target.value })}
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-700 dark:text-slate-200 focus:outline-none font-bold disabled:opacity-70" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Description</label>
              <textarea value={role.desc} disabled={role.builtin} onChange={e => touchDef({ desc: e.target.value })} rows={2}
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-700 dark:text-slate-200 focus:outline-none resize-none disabled:opacity-70" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</label>
              <select value={role.status} disabled={role.builtin} onChange={e => touchDef({ status: e.target.value })}
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-700 dark:text-slate-200 focus:outline-none font-bold disabled:opacity-70">
                <option value="active">🟢 Active</option>
                <option value="inactive">⚪ Inactive</option>
              </select>
            </div>
            <p className="text-[11px] text-slate-400">System role — name is locked{role.key === 'admin' ? '; permissions stay full-access' : ''}.</p>
          </div>

          <div className="ap-surface rounded-2xl p-4">
            <p className="text-sm font-bold text-slate-800 dark:text-white mb-3">Role Summary</p>
            <div className="space-y-2.5">
              {[
                ['Modules Access', `${[...MODULES, ...ADMIN_MODULES].filter(m => m.perms.some(p => perms[p])).length} / ${MODULES.length + ADMIN_MODULES.length}`],
                ['Total Permissions', `${granted.length}`],
                ['Users Assigned', `${roleUsers.length}`],
                ['Created On', role.createdAt ? new Date(role.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase() : 'System'],
                ['Last Updated', role.updatedAt ? new Date(role.updatedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase() : '—'],
              ].map(([l, v]) => (
                <div key={l} className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">{l}</span>
                  <span className="text-xs font-semibold text-slate-800 dark:text-white tabular-nums">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: tabs + matrix */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 bg-[var(--ap-surface-2)] rounded-2xl p-1.5 overflow-x-auto no-scrollbar">
              {[['perms', 'Module Permissions'], ['users', `Users (${roleUsers.length})`], ['activity', 'Activity Log'], ['settings', 'Settings']].map(([k, l]) => (
                <button key={k} onClick={() => setRtab(k)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${rtab === k ? 'bg-[var(--ap-accent)] text-white shadow' : 'text-slate-500 dark:text-slate-400'}`}>
                  {l}
                </button>
              ))}
            </div>
            {rtab === 'perms' && (<>
              <div className="relative ml-auto">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search permissions…"
                  className="pl-8 pr-3 py-2 text-xs rounded-xl border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none w-44" />
              </div>
              <button onClick={() => setExpandAll(true)} className="px-3 py-2 text-xs font-bold rounded-xl border border-[var(--ap-border)] text-slate-600 dark:text-slate-300 hover:bg-[var(--ap-surface-2)] transition-colors whitespace-nowrap">Expand All</button>
              <button onClick={() => { setExpandAll(false); setOpenMods(new Set()) }} className="px-3 py-2 text-xs font-bold rounded-xl border border-[var(--ap-border)] text-slate-600 dark:text-slate-300 hover:bg-[var(--ap-surface-2)] transition-colors whitespace-nowrap">Collapse All</button>
            </>)}
          </div>

          {rtab === 'perms' && (
            <div className="space-y-2.5">
              {shownMods().map(m => {
                const MIcon = m.icon
                const got = m.perms.filter(p => perms[p]).length
                const open = expandAll || openMods.has(m.key)
                return (
                  <div key={m.key} className="ap-surface rounded-2xl overflow-hidden">
                    <button onClick={() => toggleMod(m.key)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                      <ChevronDown size={14} className={`text-slate-400 transition-transform flex-shrink-0 ${open ? '' : '-rotate-90'}`} />
                      <div className="w-8 h-8 rounded-xl bg-[var(--ap-surface-2)] flex items-center justify-center flex-shrink-0">
                        <MIcon size={14} className="text-slate-500 dark:text-slate-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-white">{m.label}</p>
                        <p className="text-[10px] text-slate-400 truncate">{m.desc}</p>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full tabular-nums flex-shrink-0 ${got === m.perms.length && m.perms.length ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : got > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-slate-100 text-slate-500 dark:bg-[var(--ap-surface-2)] dark:text-slate-400'}`}>
                        {got}/{m.perms.length}
                      </span>
                    </button>
                    {open && (
                      <div className="px-4 pb-3 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {m.perms.map(p => {
                          const allowed = !!perms[p]
                          const key = `${role.key}.${p}`
                          const busy = saving[key]
                          const locked = role.key === 'admin'
                          return (
                            <button key={p} disabled={locked || busy} onClick={() => handleToggle(p, allowed)} title={locked ? 'Admin stays full-access' : `${role.label}: ${p}`}
                              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all ${locked ? 'opacity-70 cursor-not-allowed' : ''} ${allowed ? 'border-emerald-300 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/15' : 'border-[var(--ap-border)] bg-[var(--ap-surface-2)]'}`}>
                              <span className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 text-white ${allowed ? 'bg-blue-600' : 'bg-[var(--ap-border)]'}`}>
                                {busy ? <RefreshCw size={11} className="animate-spin" /> : allowed ? <Check size={12} /> : null}
                              </span>
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 capitalize">{p.replace(/_/g, ' ')}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
              {shownMods().length === 0 && (
                <div className="ap-surface rounded-2xl p-10 text-center">
                  <p className="text-sm font-bold text-slate-500 dark:text-slate-400">No permissions match "{search}"</p>
                </div>
              )}
            </div>
          )}

          {rtab === 'users' && (
            <div className="ap-surface rounded-2xl p-4">
              {roleUsers.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">No users assigned to {role.label}.</p>
              ) : (
                <div className="space-y-2">
                  {roleUsers.map(u => (
                    <div key={u.id} className="flex items-center gap-3 rounded-xl border border-[var(--ap-border)] px-3 py-2.5">
                      <Avatar name={u.full_name} size={30} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{u.full_name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${u.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-[var(--ap-surface-2)] dark:text-slate-400'}`}>
                        {u.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {rtab === 'activity' && (
            <div className="ap-surface rounded-2xl p-4">
              {roleActivity.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">No permission changes recorded for {role.label}.</p>
              ) : (
                <div className="space-y-2">
                  {roleActivity.map((e, i) => (
                    <div key={e.id || i} className="flex items-center gap-2 text-xs">
                      <Lock size={11} className="text-slate-400 flex-shrink-0" />
                      <p className="flex-1 font-semibold text-slate-700 dark:text-slate-200 truncate">{e.description}</p>
                      <span className="text-[10px] text-slate-400 flex-shrink-0 tabular-nums">
                        {e.timestamp ? new Date(e.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {rtab === 'settings' && (
            <div className="ap-surface rounded-2xl p-4 space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Role key</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{role.key}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Type</span>
                <span className="font-bold text-slate-700 dark:text-slate-200">{role.builtin ? 'System role' : 'Custom role'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Status</span>
                <span className="font-bold text-slate-700 dark:text-slate-200 capitalize">{role.status}</span>
              </div>
              <p className="text-[11px] text-slate-400">
                System role — always available. The Administrator role stays full-access.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Copy modal */}
      {showCopy && (
        <RoleCopyModal
          roles={roles} current={role.key}
          onClose={() => setShowCopy(false)}
          onCopy={async (src) => {
            const from = roleMatrix[src] || {}
            for (const [p, v] of Object.entries(from)) {
              if (v) { try { await setRolePermission(role.key, p, true, user?.name) } catch {} }
            }
            setRoleMatrix(prev => ({ ...prev, [role.key]: { ...(prev[role.key] || {}), ...Object.fromEntries(Object.entries(from).filter(([, v]) => v)) } }))
            setShowCopy(false)
            flash(`Copied permissions from ${roles.find(r => r.key === src)?.label || src}.`)
          }}
        />
      )}
      {/* Preview modal */}
      {showPreview && (
        <RolePreviewModal role={role} granted={granted} onClose={() => setShowPreview(false)} />
      )}
    </div>
  )

  function shownMods() {
    if (!search) return [...MODULES, ...ADMIN_MODULES]
    const q = search.toLowerCase()
    return [...MODULES, ...ADMIN_MODULES]
      .map(m => ({ ...m, perms: m.perms.filter(p => p.replace(/_/g, ' ').includes(q) || m.label.toLowerCase().includes(q)) }))
      .filter(m => m.perms.length > 0)
  }
}

// ─── Copy-from modal ────────────────────────────────────────────
function RoleCopyModal({ roles, current, onClose, onCopy }) {
  const [src, setSrc] = useState(roles.find(r => r.key !== current)?.key || '')
  const [busy, setBusy] = useState(false)
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative ap-surface rounded-t-3xl sm:rounded-2xl p-5 w-full sm:w-[380px] shadow-2xl space-y-3">
        <p className="font-sf font-semibold text-slate-800 dark:text-white">Copy from Role</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Grants every permission the source role has. Existing grants are kept.</p>
        <select value={src} onChange={e => setSrc(e.target.value)}
          className="w-full px-3 py-2.5 text-xs rounded-xl border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-700 dark:text-slate-200 focus:outline-none font-bold">
          {roles.filter(r => r.key !== current).map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[var(--ap-border)] text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-[var(--ap-surface-2)] transition-colors">Cancel</button>
          <button onClick={async () => { if (!src || busy) return; setBusy(true); await onCopy(src); setBusy(false) }} disabled={!src || busy}
            className="flex-1 py-2.5 rounded-xl bg-[var(--ap-accent)] text-white text-xs font-bold transition-all active:scale-95 disabled:opacity-50">
            {busy ? 'Copying…' : 'Copy Permissions'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Preview modal ──────────────────────────────────────────────
function RolePreviewModal({ role, granted, onClose }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative ap-surface rounded-t-3xl sm:rounded-2xl p-5 w-full sm:w-[420px] shadow-2xl max-h-[85vh] flex flex-col">
        <p className="font-sf font-semibold text-slate-800 dark:text-white">{role.label} — Access Preview</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-3">{granted.length} of {allModulePermsCount()} permissions granted</p>
        <div className="overflow-y-auto space-y-1.5 pr-0.5">
          {granted.length === 0 && <p className="text-xs text-slate-400 text-center py-6">No permissions granted.</p>}
          {granted.map(k => (
            <p key={k} className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
              <Check size={12} className="text-emerald-500 flex-shrink-0" />{prettyPerm(k)}
            </p>
          ))}
        </div>
        <button onClick={onClose}
          className="mt-4 py-2.5 rounded-xl bg-[var(--ap-accent)] text-white text-xs font-bold hover:opacity-90 transition-all">Close</button>
      </div>
    </div>
  )
  function allModulePermsCount() {
    return [...MODULES, ...ADMIN_MODULES].flatMap(m => m.perms).length
  }
}

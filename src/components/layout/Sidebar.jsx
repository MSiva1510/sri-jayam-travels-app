import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FileText, Users, Receipt,
  User, Car, Settings, ChevronLeft, ChevronRight,
  MapPin, Phone, Globe, LogOut, Navigation,
} from 'lucide-react'
import { useApp }  from '../../context/AppContext'
import { useAuth, ROLE_LABELS, ROLE_COLORS } from '../../context/AuthContext'
import { BIZ }     from '../../data/mockData'
import Avatar      from '../ui/Avatar'

// ── All nav items with role restrictions ────────────────────
const NAV_ITEMS = [
  { to: '/',          label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'manager'] },
  { to: '/invoices',  label: 'Invoices',  icon: FileText,        roles: ['admin', 'manager'] },
  { to: '/customers', label: 'Customers', icon: Users,           roles: ['admin', 'manager'] },
  { to: '/expenses',  label: 'Expenses',  icon: Receipt,         roles: ['admin', 'manager'] },
  { to: '/drivers',   label: 'Drivers',   icon: User,            roles: ['admin', 'manager'] },
  { to: '/vehicles',  label: 'Vehicles',  icon: Car,             roles: ['admin', 'manager'] },
  // Driver-only
  { to: '/my-trips',  label: 'My Trips',  icon: Navigation,      roles: ['driver'] },
]

const BOTTOM_ITEMS = [
  { to: '/settings', label: 'Settings', icon: Settings, roles: ['admin'] },
]

// ── Single nav link ──────────────────────────────────────────
function NavItem({ to, label, icon: Icon, collapsed }) {
  const location = useLocation()
  const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)

  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      className={`nav-item ${isActive ? 'nav-item-active' : 'nav-item-inactive'}`}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-blue-400 rounded-r-full" />
      )}
      <Icon
        size={18}
        className={`flex-shrink-0 transition-colors ${isActive ? 'text-white' : 'text-white/50 group-hover:text-white'}`}
      />
      {!collapsed && <span className="truncate">{label}</span>}
      {!collapsed && isActive && (
        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
      )}
    </NavLink>
  )
}

// ── Inner sidebar content (shared by desktop + mobile) ──────
function SidebarInner({ collapsed }) {
  const { setCollapsed }       = useApp()
  const { user, logout, isAdmin, isManager, isDriver } = useAuth()
  const navigate               = useNavigate()
  const roleColors             = user ? ROLE_COLORS[user.role] : null

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  // Filter nav items by current user role
  const visibleNav    = NAV_ITEMS.filter(i => i.roles.includes(user?.role))
  const visibleBottom = BOTTOM_ITEMS.filter(i => i.roles.includes(user?.role))

  return (
    <div className="flex flex-col h-full relative">

      {/* ── Brand ── */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-white/10 flex-shrink-0 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden border border-white/20">
          <img
            src={BIZ.logo}
            alt="SJT"
            className="w-full h-full object-contain p-0.5"
            onError={e => {
              e.target.style.display = 'none'
              e.target.parentNode.innerHTML = '<span class="text-white font-black text-xs">SJT</span>'
            }}
          />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-white font-display font-black text-sm leading-tight tracking-wide truncate">SRI JAYAM</p>
            <p className="text-white/40 text-xs truncate tracking-widest">TRAVELS</p>
          </div>
        )}
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto no-scrollbar">
        {!collapsed && (
          <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest px-3 mb-2">
            {isDriver ? 'My Work' : 'Main Menu'}
          </p>
        )}

        {visibleNav.map(item => (
          <NavItem key={item.to} {...item} collapsed={collapsed} />
        ))}

        {visibleBottom.length > 0 && (
          <>
            {!collapsed && (
              <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest px-3 mt-5 mb-2">
                System
              </p>
            )}
            {collapsed && <div className="my-3 border-t border-white/10" />}
            {visibleBottom.map(item => (
              <NavItem key={item.to} {...item} collapsed={collapsed} />
            ))}
          </>
        )}
      </nav>

      {/* ── Business info (non-driver, non-collapsed) ── */}
      {!collapsed && !isDriver && (
        <div className="px-4 py-3 border-t border-white/10 flex-shrink-0">
          <div className="bg-white/6 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-white/50 text-[11px]">
              <Phone size={10} className="flex-shrink-0" />
              <span className="truncate">{BIZ.phone}</span>
            </div>
            <div className="flex items-center gap-2 text-white/50 text-[11px]">
              <MapPin size={10} className="flex-shrink-0" />
              <span className="truncate">Puducherry, India</span>
            </div>
            <div className="flex items-center gap-2 text-white/50 text-[11px]">
              <Globe size={10} className="flex-shrink-0" />
              <span className="truncate">{BIZ.website}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── User card + logout ── */}
      {user && (
        <div className={`px-3 py-3 border-t border-white/10 flex-shrink-0 ${collapsed ? 'flex flex-col items-center gap-2' : ''}`}>
          {!collapsed ? (
            <div className="bg-white/6 rounded-xl p-2.5">
              {/* User info row */}
              <div className="flex items-center gap-2.5 mb-2.5">
                <Avatar name={user.name} size={30} />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-bold truncate leading-tight">{user.name}</p>
                  <p className="text-white/40 text-[10px] truncate">{user.email}</p>
                </div>
              </div>
              {/* Role badge */}
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${roleColors?.bg} ${roleColors?.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${roleColors?.dot}`} />
                  {ROLE_LABELS[user.role]}
                </span>
                {/* Logout button */}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 text-white/40 hover:text-red-400 text-[11px] font-semibold transition-colors px-2 py-1 rounded-lg hover:bg-red-500/10"
                  title="Sign out"
                >
                  <LogOut size={12} />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              <div title={user.name}>
                <Avatar name={user.name} size={32} />
              </div>
              <button
                onClick={handleLogout}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
                title="Sign out"
              >
                <LogOut size={15} />
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Desktop collapse toggle ── */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 rounded-full bg-navy-800 border border-white/20 items-center justify-center text-white/70 hover:text-white hover:bg-navy-700 transition-all z-10 shadow-lg"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </div>
  )
}

// ── Default export ───────────────────────────────────────────
export default function Sidebar() {
  const { collapsed, sidebarOpen, setSidebarOpen } = useApp()

  return (
    <>
      {/* Desktop */}
      <aside className={`hidden lg:flex flex-col glass-sidebar flex-shrink-0 transition-all duration-300 ease-in-out relative ${collapsed ? 'w-[72px]' : 'w-[260px]'}`}>
        <SidebarInner collapsed={collapsed} />
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-[260px] glass-sidebar flex flex-col lg:hidden transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarInner collapsed={false} />
      </aside>
    </>
  )
}
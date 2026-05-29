import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, FileText, Users, Receipt,
  User, Car, Settings, ChevronLeft, ChevronRight,
  MapPin, Phone, Globe,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { BIZ } from '../../data/mockData'

const NAV_ITEMS = [
  { to: '/',          label: 'Dashboard', icon: LayoutDashboard },
  { to: '/invoices',  label: 'Invoices',  icon: FileText        },
  { to: '/customers', label: 'Customers', icon: Users           },
  { to: '/expenses',  label: 'Expenses',  icon: Receipt         },
  { to: '/drivers',   label: 'Drivers',   icon: User            },
  { to: '/vehicles',  label: 'Vehicles',  icon: Car             },
]

const BOTTOM_ITEMS = [
  { to: '/settings',  label: 'Settings',  icon: Settings },
]

function NavItem({ to, label, icon: Icon, collapsed }) {
  const location = useLocation()
  const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)

  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      className={`nav-item ${isActive ? 'nav-item-active' : 'nav-item-inactive'}`}
    >
      {/* Active indicator bar */}
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-blue-400 rounded-r-full" />
      )}

      <Icon
        size={18}
        className={`flex-shrink-0 transition-colors ${
          isActive ? 'text-white' : 'text-white/50 group-hover:text-white'
        }`}
      />

      {!collapsed && (
        <span className="truncate">{label}</span>
      )}

      {!collapsed && isActive && (
        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
      )}
    </NavLink>
  )
}

function SidebarInner({ collapsed }) {
  const { setCollapsed, setSidebarOpen } = useApp()

  return (
    <div className="flex flex-col h-full relative">

      {/* ── Brand header ── */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-white/10 ${collapsed ? 'justify-center' : ''}`}>
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
            <p className="text-white font-display font-black text-sm leading-tight tracking-wide truncate">
              SRI JAYAM
            </p>
            <p className="text-white/40 text-xs truncate tracking-widest">TRAVELS</p>
          </div>
        )}
      </div>

      {/* ── Main nav ── */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto no-scrollbar">
        {!collapsed && (
          <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest px-3 mb-2">
            Main Menu
          </p>
        )}
        {NAV_ITEMS.map(item => (
          <NavItem key={item.to} {...item} collapsed={collapsed} />
        ))}

        {!collapsed && (
          <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest px-3 mt-5 mb-2">
            System
          </p>
        )}
        {collapsed && <div className="my-3 border-t border-white/10" />}
        {BOTTOM_ITEMS.map(item => (
          <NavItem key={item.to} {...item} collapsed={collapsed} />
        ))}
      </nav>

      {/* ── Business info footer ── */}
      {!collapsed && (
        <div className="px-4 py-4 border-t border-white/10">
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

export default function Sidebar() {
  const { collapsed, sidebarOpen, setSidebarOpen } = useApp()

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside
        className={`
          hidden lg:flex flex-col glass-sidebar flex-shrink-0
          transition-all duration-300 ease-in-out relative
          ${collapsed ? 'w-[72px]' : 'w-[260px]'}
        `}
      >
        <SidebarInner collapsed={collapsed} />
      </aside>

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Mobile drawer ── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-[260px] glass-sidebar flex flex-col
          lg:hidden transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <SidebarInner collapsed={false} />
      </aside>
    </>
  )
}

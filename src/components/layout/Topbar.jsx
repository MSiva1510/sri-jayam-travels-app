import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Menu, Sun, Moon, ChevronRight, LogOut, User, Settings, ChevronDown } from 'lucide-react'
import { useApp }  from '../../context/AppContext'
import { useAuth, ROLE_LABELS, ROLE_COLORS } from '../../context/AuthContext'
import Avatar from '../ui/Avatar'
import NotificationCenter from '../ui/NotificationCenter'
import GlobalSearch       from '../ui/GlobalSearch'

const CURRENT_MONTH = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })

// Topbar shows the breadcrumb only; each page renders its own header/subtitle,
// so the sub text here is kept for the document title & mobile only.
const PAGE_TITLES = {
  '/':                { label: 'Dashboard',       sub: `Overview for ${CURRENT_MONTH}`  },
  '/invoices':        { label: 'Invoices',         sub: 'Trip bills & pay slips'         },
  '/trips':           { label: 'Trips',            sub: 'All trip types & management'    },
  '/create-trip':     { label: 'Create Trip',      sub: 'Add a new trip booking'         },
  '/customers':       { label: 'Customers',        sub: 'All booking clients'            },
  '/expenses':        { label: 'Expenses',         sub: 'Operating costs tracker'        },
  '/drivers':         { label: 'Drivers',          sub: 'Fleet driver management'        },
  '/vehicles':        { label: 'Vehicles',         sub: 'Fleet vehicle records'          },
  '/settings':        { label: 'Settings',         sub: 'App & business config'          },
  '/driver':          { label: 'Driver Home',      sub: 'Your dashboard & schedule'      },
  '/assigned-trips':  { label: 'Assigned Trips',   sub: "Today's scheduled rides"        },
  '/ride-history':    { label: 'Ride History',     sub: 'Your past trips & earnings'     },
  '/driver-profile':  { label: 'My Profile',       sub: 'Account & performance'          },
  '/live-location':   { label: 'Live Location',    sub: 'Real-time GPS tracking'          },
  '/fleet':           { label: 'Live Fleet',        sub: 'Real-time vehicle tracking'       },
  '/fleet/settings':  { label: 'GPS Settings',      sub: 'Configure GPS provider'           },
  '/gps-history':     { label: 'GPS History',       sub: 'Past vehicle tracks'              },
  '/gps-history/replay': { label: 'Route Replay',   sub: 'Playback a vehicle route'         },
  '/reports':         { label: 'Reports',           sub: 'Business reports & analytics'     },
  '/attendance':      { label: 'Attendance',        sub: 'Driver attendance today'          },
  '/profile':         { label: 'Profile',           sub: 'Your account'                     },
  '/documents':       { label: 'Documents',         sub: 'Vehicle & trip documents'         },
  '/communications':  { label: 'Communications',    sub: 'Customer messages'                },
  '/communications-settings': { label: 'Communication Settings', sub: 'Templates & providers' },
  '/payroll':         { label: 'Payroll',           sub: 'Driver settlements & salary'      },
  '/payslips':        { label: 'My Payslips',       sub: 'Your settlement history'          },
  '/audit-log':       { label: 'Audit Log',         sub: 'Recent system activity'           },
  '/admin/users':     { label: 'User Accounts',     sub: 'Manage staff access'              },
  '/admin/roles':     { label: 'Roles & Perms',     sub: 'Role permissions'                 },
  '/admin/backup':    { label: 'Backup Manager',    sub: 'Backups & restore'                },
}

export default function Topbar() {
  const { darkMode, setDarkMode, setSidebarOpen } = useApp()
  const { user, logout } = useAuth()
  const location   = useLocation()
  const navigate   = useNavigate()
  const info       = PAGE_TITLES[location.pathname] || { label: 'Sri Jayam Travels', sub: '' }
  const roleColors = user ? ROLE_COLORS[user.role] : null

  const [dropOpen, setDropOpen] = useState(false)
  const dropRef = useRef(null)

  useEffect(() => {
    const handler = e => { if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = () => { setDropOpen(false); logout(); navigate('/login', { replace: true }) }
  const homeRoute    = user?.role === 'driver' ? '/driver' : '/'

  return (
    <header className="glass-topbar h-[60px] flex items-center px-4 gap-3 flex-shrink-0 sticky top-0 z-30">

      {/* Hamburger — mobile (also desktop when sidebar is minimal/hidden) */}
      <button
        onClick={() => setSidebarOpen(true)}
        aria-label="Open navigation menu"
        className="app-menu-btn lg:hidden w-9 h-9 rounded-xl border border-slate-200 dark:border-navy-700 bg-white/60 dark:bg-navy-800/60 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors flex-shrink-0"
      >
        <Menu size={18} />
      </button>

      {/* Page title */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
          <span>SJT</span><ChevronRight size={12} />
        </div>
        <div className="min-w-0">
          <h2 className="font-display font-black text-slate-800 dark:text-white text-base leading-tight truncate">{info.label}</h2>
          {/* subtitle intentionally not repeated here — the page header carries it */}
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 flex-shrink-0">

        {/* Global Search */}
        <GlobalSearch />

        {/* Dark mode */}
        <button onClick={() => setDarkMode(!darkMode)}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-pressed={darkMode}
          className="w-9 h-9 rounded-xl border border-slate-200 dark:border-navy-700 bg-white/60 dark:bg-navy-800/60 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-700 transition-all"
          title={darkMode ? 'Light mode' : 'Dark mode'}>
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Notifications */}
        <NotificationCenter />

        {/* User dropdown */}
        {user && (
          <div className="relative" ref={dropRef}>
            <button onClick={() => setDropOpen(v => !v)}
              aria-label="Account menu"
              aria-expanded={dropOpen}
              aria-haspopup="menu"
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
              <Avatar name={user.name} size={30} />
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-tight">{user.name}</p>
                <p className={`text-[10px] font-semibold leading-none ${roleColors?.text}`}>{ROLE_LABELS[user.role]}</p>
              </div>
              <ChevronDown size={13} className={`text-slate-400 transition-transform ${dropOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl shadow-2xl border border-white/10 overflow-hidden z-50 animate-fade-up bg-navy-900" role="menu">
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={user.name} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-white truncate">{user.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="mt-2.5">
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full ${roleColors?.bg} ${roleColors?.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${roleColors?.dot}`} />
                      {ROLE_LABELS[user.role]}
                    </span>
                  </div>
                </div>
                <div className="px-2.5 pb-2 space-y-1">
                  {user.role === 'driver' && (
                    <button onClick={() => { setDropOpen(false); navigate('/driver-profile') }} role="menuitem"
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-200 hover:bg-white/10 transition-colors text-left">
                      <User size={15} className="text-slate-400" /> My Profile
                    </button>
                  )}
                  {user.role !== 'driver' && (
                    <button onClick={() => { setDropOpen(false); navigate('/settings') }} role="menuitem"
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors text-left ${location.pathname === '/settings' ? 'bg-blue-600 text-white shadow' : 'text-slate-200 hover:bg-white/10'}`}>
                      <Settings size={15} className={location.pathname === '/settings' ? 'text-white' : 'text-slate-400'} /> Settings
                    </button>
                  )}
                  <button onClick={() => { setDropOpen(false); navigate(homeRoute) }} role="menuitem"
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-200 hover:bg-white/10 transition-colors text-left">
                    <User size={15} className="text-slate-400" />
                    {user.role === 'driver' ? 'Driver Home' : 'Dashboard'}
                  </button>
                </div>
                <div className="px-2.5 pb-2.5">
                  <button onClick={handleLogout} role="menuitem"
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold text-red-400 hover:bg-red-600 hover:text-white transition-colors text-left">
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}

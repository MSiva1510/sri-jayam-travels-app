import { useLocation } from 'react-router-dom'
import { Menu, Bell, Sun, Moon, Search, ChevronRight } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import Avatar from '../ui/Avatar'

const PAGE_TITLES = {
  '/':          { label: 'Dashboard',  sub: 'Overview for May 2026'   },
  '/invoices':  { label: 'Invoices',   sub: 'Trip bills & pay slips'  },
  '/customers': { label: 'Customers',  sub: 'All booking clients'     },
  '/expenses':  { label: 'Expenses',   sub: 'Operating costs tracker' },
  '/drivers':   { label: 'Drivers',    sub: 'Fleet driver management' },
  '/vehicles':  { label: 'Vehicles',   sub: 'Fleet vehicle records'   },
  '/settings':  { label: 'Settings',   sub: 'App & business config'   },
}

export default function Topbar() {
  const { darkMode, setDarkMode, setSidebarOpen } = useApp()
  const location = useLocation()
  const info = PAGE_TITLES[location.pathname] || PAGE_TITLES['/']

  return (
    <header className="glass-topbar h-[60px] flex items-center px-4 gap-3 flex-shrink-0 sticky top-0 z-30">

      {/* Hamburger — mobile only */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden w-9 h-9 rounded-xl border border-slate-200 dark:border-navy-700
                   bg-white/60 dark:bg-navy-800/60 flex items-center justify-center
                   text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700
                   transition-colors flex-shrink-0"
      >
        <Menu size={18} />
      </button>

      {/* Page title */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
          <span>SJT</span>
          <ChevronRight size={12} />
        </div>
        <div className="min-w-0">
          <h2 className="font-display font-black text-slate-800 dark:text-white text-base leading-tight truncate">
            {info.label}
          </h2>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:block leading-none mt-0.5">
            {info.sub}
          </p>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 flex-shrink-0">

        {/* Search bar */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl
                        border border-slate-200 dark:border-navy-700
                        bg-slate-50/80 dark:bg-navy-800/60 w-48">
          <Search size={14} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search…"
            className="bg-transparent text-sm text-slate-700 dark:text-slate-200
                       placeholder-slate-400 dark:placeholder-slate-500
                       outline-none w-full font-body"
          />
        </div>

        {/* Dark mode toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="w-9 h-9 rounded-xl border border-slate-200 dark:border-navy-700
                     bg-white/60 dark:bg-navy-800/60 flex items-center justify-center
                     text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white
                     hover:bg-slate-100 dark:hover:bg-navy-700 transition-all"
          title={darkMode ? 'Light mode' : 'Dark mode'}
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Notifications */}
        <button
          className="relative w-9 h-9 rounded-xl border border-slate-200 dark:border-navy-700
                     bg-white/60 dark:bg-navy-800/60 flex items-center justify-center
                     text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white
                     hover:bg-slate-100 dark:hover:bg-navy-700 transition-all"
        >
          <Bell size={16} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 border-2 border-white dark:border-navy-800" />
        </button>

        {/* Avatar */}
        <div className="flex items-center gap-2.5 pl-1">
          <Avatar name="Admin User" size={34} />
          <div className="hidden sm:block">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-tight">Admin</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-none">Owner</p>
          </div>
        </div>
      </div>
    </header>
  )
}

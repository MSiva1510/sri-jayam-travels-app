import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Eye, EyeOff, LogIn, Car, Shield, User, ChevronRight, AlertCircle, Lock } from 'lucide-react'
import { useAuth, MOCK_USERS, ROLE_LABELS, ROLE_COLORS } from '../context/AuthContext'
import { BIZ } from '../data/mockData'
import { useApp } from '../context/AppContext'

// ── Quick-login credential cards shown below the form ──────────
const DEMO_ACCOUNTS = [
  {
    role:     'admin',
    username: 'admin',
    password: 'admin123',
    name:     'Arjun Sharma',
    hint:     'Full access to all pages',
    icon:     Shield,
  },
  {
    role:     'manager',
    username: 'manager',
    password: 'manager123',
    name:     'Kavitha Rajan',
    hint:     'Dashboard, Reports & more',
    icon:     User,
  },
  {
    role:     'driver',
    username: 'ramanan',
    password: 'driver123',
    name:     'Ramanan',
    hint:     'Assigned trips only',
    icon:     Car,
  },
]

export default function Login() {
  const { login, loading, loginError, setLoginError, user } = useAuth()
  const { darkMode, setDarkMode } = useApp()
  const navigate   = useNavigate()
  const location   = useLocation()
  const from       = location.state?.from?.pathname || '/'

  const [username,  setUsername]  = useState('')
  const [password,  setPassword]  = useState('')
  const [showPass,  setShowPass]  = useState(false)
  const [remember,  setRemember]  = useState(false)
  const [filling,   setFilling]   = useState(null)   // which demo card is being filled

  // If already logged in, redirect away
  useEffect(() => {
    if (user) {
      const dest = user.role === 'driver' ? '/driver' : from
      navigate(dest, { replace: true })
    }
  }, [user])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const ok = await login({ username, password, remember })
    if (ok) {
      const u = MOCK_USERS.find(u => u.username === username.toLowerCase())
      const dest = u?.role === 'driver' ? '/driver' : from === '/login' ? '/' : from
      navigate(dest, { replace: true })
    }
  }

  const fillDemo = (acc) => {
    setFilling(acc.role)
    setLoginError('')
    setUsername(acc.username)
    setPassword(acc.password)
    setTimeout(() => setFilling(null), 600)
  }

  return (
    <div className="min-h-screen flex bg-slate-100 dark:bg-navy-950 bg-mesh overflow-hidden">

      {/* ── Left panel — branding (hidden on mobile) ── */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-[52%] relative flex-col justify-between p-10 overflow-hidden"
           style={{ background: 'linear-gradient(135deg, #080f2a 0%, #0d1b4b 50%, #152a7a 100%)' }}>

        {/* Decorative orbs */}
        <div className="absolute top-[-80px] left-[-80px] w-80 h-80 rounded-full opacity-20"
             style={{ background: 'radial-gradient(circle, #3b82f6, transparent)' }} />
        <div className="absolute bottom-[-60px] right-[-60px] w-64 h-64 rounded-full opacity-15"
             style={{ background: 'radial-gradient(circle, #0d9488, transparent)' }} />
        <div className="absolute top-1/2 right-[-40px] w-48 h-48 rounded-full opacity-10"
             style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)' }} />

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]"
             style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        {/* Logo + name */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden p-1.5">
            <img src={BIZ.logo} alt="SJT" className="w-full h-full object-contain"
              onError={e => { e.target.style.display='none'; e.target.parentNode.innerHTML='<span class="text-white font-black text-sm">SJT</span>' }}
            />
          </div>
          <div>
            <p className="text-white font-display font-black text-base tracking-wide leading-tight">SRI JAYAM TRAVELS</p>
            <p className="text-white/40 text-xs tracking-widest">PUDUCHERRY</p>
          </div>
        </div>

        {/* Hero copy */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-3.5 py-1.5 text-xs text-white/70 font-semibold mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
            Fleet Management System v2
          </div>
          <h1 className="text-4xl xl:text-5xl font-display font-black text-white leading-[1.1] mb-4">
            Your Fleet,<br />
            <span className="text-gradient">Managed Smart.</span>
          </h1>
          <p className="text-white/50 text-base leading-relaxed max-w-sm">
            Invoices, trip tracking, driver pay slips and expense reports — all in one place for Sri Jayam Travels.
          </p>
        </div>

        {/* Stats row */}
        <div className="relative z-10 grid grid-cols-3 gap-4">
          {[
            { label: 'Trips this month', value: '12' },
            { label: 'Active drivers',   value: '3'  },
            { label: 'Fleet vehicles',   value: '3'  },
          ].map(s => (
            <div key={s.label} className="bg-white/6 border border-white/10 rounded-2xl p-4">
              <p className="text-2xl font-display font-black text-white">{s.value}</p>
              <p className="text-white/40 text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel — login form ── */}
      <div className="flex-1 flex flex-col justify-center items-center px-5 sm:px-10 py-10 relative">

        {/* Dark mode toggle — top right */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="absolute top-5 right-5 w-9 h-9 rounded-xl border border-slate-200 dark:border-navy-700 bg-white/70 dark:bg-navy-800/70 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 transition-all"
          title={darkMode ? 'Light mode' : 'Dark mode'}
        >
          {darkMode
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          }
        </button>

        <div className="w-full max-w-[400px]">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-xl bg-navy-900 flex items-center justify-center overflow-hidden p-1">
              <img src={BIZ.logo} alt="SJT" className="w-full h-full object-contain"
                onError={e => { e.target.style.display='none'; e.target.parentNode.innerHTML='<span class="text-white font-black text-xs">SJT</span>' }}
              />
            </div>
            <div>
              <p className="font-display font-black text-slate-800 dark:text-white text-sm leading-tight">SRI JAYAM TRAVELS</p>
              <p className="text-slate-400 dark:text-slate-500 text-[10px] tracking-widest">PUDUCHERRY</p>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-7">
            <h2 className="text-2xl sm:text-3xl font-display font-black text-slate-800 dark:text-white">
              Welcome back
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5">
              Sign in to your account to continue
            </p>
          </div>

          {/* Error banner */}
          {loginError && (
            <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-900/25 border border-red-200 dark:border-red-800/60 rounded-xl px-4 py-3 mb-5">
              <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 dark:text-red-400 text-sm font-medium">{loginError}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Username */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                Username or Email
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                  <User size={16} />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setLoginError('') }}
                  placeholder="admin / manager / ramanan"
                  autoComplete="username"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-navy-700
                             bg-white dark:bg-navy-800/60 text-slate-800 dark:text-slate-100
                             placeholder-slate-300 dark:placeholder-slate-600
                             text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400
                             dark:focus:border-blue-500 transition-all font-body"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                Password
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                  <Lock size={16} />
                </div>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setLoginError('') }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className="w-full pl-10 pr-11 py-3 rounded-xl border border-slate-200 dark:border-navy-700
                             bg-white dark:bg-navy-800/60 text-slate-800 dark:text-slate-100
                             placeholder-slate-300 dark:placeholder-slate-600
                             text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400
                             dark:focus:border-blue-500 transition-all font-body"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div
                  onClick={() => setRemember(v => !v)}
                  className={`w-4.5 h-4.5 w-[18px] h-[18px] rounded-[5px] border-2 flex items-center justify-center transition-all cursor-pointer
                    ${remember
                      ? 'bg-navy-900 border-navy-900 dark:bg-blue-600 dark:border-blue-600'
                      : 'border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 group-hover:border-navy-400'
                    }`}
                >
                  {remember && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span className="text-sm text-slate-600 dark:text-slate-400 select-none">Remember me</span>
              </label>
              <span className="text-xs text-slate-400 dark:text-slate-500 italic">Session resets on tab close</span>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl
                         bg-navy-900 hover:bg-navy-800 dark:bg-blue-700 dark:hover:bg-blue-600
                         text-white font-bold text-sm
                         transition-all duration-200 shadow-lg hover:shadow-xl active:scale-[0.98]
                         disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none
                         focus:outline-none focus:ring-2 focus:ring-navy-500/40"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z"/>
                  </svg>
                  Signing in…
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  Sign In
                  <ChevronRight size={14} className="opacity-60" />
                </>
              )}
            </button>
          </form>

          {/* ── Demo accounts ── */}
          <div className="mt-7">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px bg-slate-200 dark:bg-navy-700" />
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider whitespace-nowrap">
                Demo Accounts
              </span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-navy-700" />
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {DEMO_ACCOUNTS.map(acc => {
                const colors = ROLE_COLORS[acc.role]
                const isFilling = filling === acc.role
                return (
                  <button
                    key={acc.role}
                    type="button"
                    onClick={() => fillDemo(acc)}
                    className={`
                      relative flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border
                      transition-all duration-200 text-center group overflow-hidden
                      ${isFilling
                        ? 'border-navy-400 dark:border-blue-500 bg-navy-50 dark:bg-navy-800/80 scale-95'
                        : 'border-slate-200 dark:border-navy-700 bg-white/70 dark:bg-navy-800/40 hover:border-navy-300 dark:hover:border-navy-600 hover:bg-white dark:hover:bg-navy-800/60 hover:-translate-y-0.5 hover:shadow-md'
                      }
                    `}
                  >
                    {/* Role color bar */}
                    <div className={`absolute top-0 left-0 right-0 h-0.5 rounded-t-xl ${colors.dot}`} />

                    <div className={`w-8 h-8 rounded-xl ${colors.bg} flex items-center justify-center`}>
                      <acc.icon size={15} className={colors.text} />
                    </div>

                    <div>
                      <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 leading-tight">
                        {ROLE_LABELS[acc.role]}
                      </p>
                      <p className="text-[9.5px] text-slate-400 dark:text-slate-500 mt-0.5 leading-snug">
                        {acc.hint}
                      </p>
                    </div>

                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md ${colors.bg} ${colors.text}`}>
                      {acc.username}
                    </span>
                  </button>
                )
              })}
            </div>

            <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 mt-3">
              All demo passwords: <span className="font-mono font-bold text-slate-500 dark:text-slate-400">admin123</span> / <span className="font-mono font-bold text-slate-500 dark:text-slate-400">manager123</span> / <span className="font-mono font-bold text-slate-500 dark:text-slate-400">driver123</span>
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}

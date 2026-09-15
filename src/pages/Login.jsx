import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, AlertCircle, ArrowLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useApp }  from '../context/AppContext'
import { BIZ }     from '../config/business'
import LoginMascots from '../components/auth/LoginMascots'
import supabase from '../lib/supabase'
import './login.css'

export default function Login() {
  const { login, authLoading, loginError, setLoginError, user, sendPasswordReset } = useAuth()
  const { darkMode, setDarkMode } = useApp()
  const navigate  = useNavigate()
  const location  = useLocation()
  const from      = location.state?.from?.pathname || '/'

  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [showPass,     setShowPass]     = useState(false)
  const [forgotMode,   setForgotMode]   = useState(false)
  const [resetSent,    setResetSent]    = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  // ── Mascot state ───────────────────────────────────────────
  const [focused,   setFocused]   = useState(null)   // 'email' | 'password' | null
  const [target,    setTarget]    = useState(null)   // viewport point the eyes look at
  const [mood,      setMood]      = useState(null)   // 'success' | null
  const passRef  = useRef(null)

  // Error wins while the message is on screen (typing clears loginError).
  const mascotState =
    mood === 'success'       ? 'success'
    : loginError             ? 'error'
    : focused === 'password' ? (showPass ? 'away' : 'looking')   // eyes stay open on the password field
    : focused === 'email'    ? 'looking'
    : 'idle'

  const lookAt = useCallback((el) => {
    if (!el) return
    const r = el.getBoundingClientRect()
    setTarget({ x: r.left + r.width * 0.35, y: r.top + r.height / 2 })
  }, [])

  // Redirect already-logged-in users
  useEffect(() => {
    if (user) {
      const dest = user.role === 'driver' ? '/driver' : (from === '/login' ? '/' : from)
      navigate(dest, { replace: true })
    }
  }, [user, navigate, from])

  // ── Login submit ──────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password) return
    const loggedInUser = await login({ email: email.trim().toLowerCase(), password })
    if (loggedInUser) {
      setFocused(null)
      setMood('success')
      const dest = loggedInUser.role === 'driver' ? '/driver' : (from === '/login' ? '/' : from)
      setTimeout(() => navigate(dest, { replace: true }), 650)
    }
  }

  // ── Forgot password submit ─────────────────────────────────
  const handleForgot = async (e) => {
    e.preventDefault()
    if (!email.trim()) { setLoginError('Enter your email address first.'); return }
    setResetLoading(true)
    setLoginError('')
    try {
      await sendPasswordReset(email.trim().toLowerCase())
      setResetSent(true)
    } catch {
      setLoginError('Could not send reset email. Check the address and try again.')
    } finally {
      setResetLoading(false)
    }
  }

  // ── Headline stats (public RPC: aggregate counts only) ────
  const [stats, setStats] = useState(null)
  useEffect(() => {
    if (!supabase) return
    let alive = true
    supabase.rpc('public_login_stats').then(({ data, error }) => {
      if (alive && !error && data) setStats(data)
    })
    return () => { alive = false }
  }, [])
  const fmt = (n) => (n == null ? '—' : n >= 100 ? `${Math.floor(n / 10) * 10}+` : String(n))

  const leaveForgot = () => { setForgotMode(false); setResetSent(false); setLoginError('') }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-8 bg-[#e9e7e4] dark:bg-navy-950 overflow-hidden">

      {/* Dark mode toggle */}
      <button
        onClick={() => setDarkMode(!darkMode)}
        className="fixed top-5 right-5 z-20 w-9 h-9 rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-navy-800/70 backdrop-blur flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-navy-700 transition-all"
        title={darkMode ? 'Light mode' : 'Dark mode'}
      >
        {darkMode
          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        }
      </button>

      {/* ── 3D scene ─────────────────────────────────────────── */}
      <div className="login-scene w-full max-w-[1040px]">
        <div
          className="login-card grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] rounded-[28px] overflow-hidden
                     bg-[#f6f2ec] dark:bg-navy-900 shadow-[0_40px_80px_-30px_rgba(15,23,42,0.45)] dark:shadow-[0_40px_80px_-30px_rgba(0,0,0,0.8)]
                     border border-white/60 dark:border-white/5"
        >
          {/* ── Left: mascots ─────────────────────────────────── */}
          <div className="relative flex flex-col justify-between p-6 sm:p-8 lg:p-10 min-h-[240px] lg:min-h-[600px]">
            <div className="rise flex items-center gap-3" style={{ '--d': 0 }}>
              <div className="w-10 h-10 rounded-2xl bg-navy-900 dark:bg-white/10 flex items-center justify-center overflow-hidden p-1.5 shadow-md">
                <img src={BIZ.logo} alt="SJT" className="w-full h-full object-contain"
                  onError={e => { e.target.style.display='none'; e.target.parentNode.innerHTML='<span class="text-white font-black text-xs">SJT</span>' }} />
              </div>
              <div>
                <p className="font-display font-black text-slate-800 dark:text-white text-sm tracking-wide leading-tight">SRI JAYAM TRAVELS</p>
                <p className="text-slate-400 dark:text-slate-500 text-[10px] tracking-[0.2em]">PUDUCHERRY</p>
              </div>
            </div>

            <div className="flex-1 flex items-end justify-center px-2 sm:px-6 lg:px-4 pt-4 lg:pt-8">
              <LoginMascots state={mascotState} target={target} className="max-w-[300px] sm:max-w-[380px] lg:max-w-full" />
            </div>

            {/* Live stats from the backend, under the mascots */}
            <div className="rise grid grid-cols-3 gap-3 mt-6" style={{ '--d': 6 }}>
              {[
                { label: 'Active vehicles', value: stats?.active_vehicles },
                { label: 'Active drivers',  value: stats?.active_drivers },
                { label: 'Trips this FY',   value: stats?.trips_fy },
              ].map(st => (
                <div key={st.label}
                  className="rounded-2xl border border-slate-900/[0.06] dark:border-white/10 bg-white/50 dark:bg-white/5 px-4 py-3">
                  <p className="text-2xl font-display font-black text-slate-800 dark:text-white leading-tight tabular-nums">{fmt(st.value)}</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{st.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: form ───────────────────────────────────── */}
          <div className="relative bg-white dark:bg-navy-800/60 lg:rounded-l-[28px] lg:shadow-[-20px_0_40px_-30px_rgba(15,23,42,0.35)] px-6 sm:px-10 lg:px-14 py-10 lg:py-14 flex flex-col justify-center text-slate-800 dark:text-slate-100">

            {forgotMode ? (
              /* ── Forgot password ─────────────────────────── */
              <div className="max-w-[320px] w-full mx-auto">
                <button type="button" onClick={leaveForgot}
                  className="rise inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white mb-6 transition-colors" style={{ '--d': 0 }}>
                  <ArrowLeft size={14} /> Back to login
                </button>
                <h2 className="rise text-3xl font-display font-black" style={{ '--d': 1 }}>Reset password</h2>
                <p className="rise text-sm text-slate-500 dark:text-slate-400 mt-2 mb-8" style={{ '--d': 2 }}>
                  Enter your account email and we'll send a reset link.
                </p>

                {resetSent ? (
                  <div className="rise flex flex-col items-center gap-3 py-4 text-center" style={{ '--d': 3 }}>
                    <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-emerald-600 dark:text-emerald-400" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <p className="font-bold">Reset link sent</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Check your inbox at <strong>{email}</strong></p>
                  </div>
                ) : (
                  <form onSubmit={handleForgot} className="space-y-6">
                    {loginError && <ErrorBanner text={loginError} />}
                    <div className={`fl-field rise ${loginError ? 'has-error' : ''}`} style={{ '--d': 3 }}>
                      <input id="reset-email" type="email" value={email} placeholder=" " required autoFocus autoComplete="email"
                        onChange={e => { setEmail(e.target.value); setLoginError('') }}
                        onFocus={e => { setFocused('email'); lookAt(e.target) }} onBlur={() => setFocused(null)} />
                      <label htmlFor="reset-email">Email</label>
                    </div>
                    <button type="submit" disabled={resetLoading}
                      className="press rise w-full py-3.5 rounded-full bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-bold text-sm shadow-lg disabled:opacity-60" style={{ '--d': 4 }}>
                      {resetLoading ? 'Sending…' : 'Send reset link'}
                    </button>
                  </form>
                )}
              </div>
            ) : (
              /* ── Login ───────────────────────────────────── */
              <div className="max-w-[320px] w-full mx-auto">
                <div className="rise w-11 h-11 mx-auto mb-6 rounded-2xl bg-slate-900 dark:bg-white/10 flex items-center justify-center overflow-hidden p-2" style={{ '--d': 0 }}>
                  <img src={BIZ.logo} alt="" className="w-full h-full object-contain"
                    onError={e => { e.target.style.display='none'; e.target.parentNode.innerHTML='<span class="text-white font-black text-xs">SJT</span>' }} />
                </div>
                <h2 className="rise text-3xl font-display font-black text-center" style={{ '--d': 1 }}>Welcome back!</h2>
                <p className="rise text-xs text-slate-400 dark:text-slate-500 text-center mt-1.5 mb-8" style={{ '--d': 2 }}>Please enter your details</p>

                {loginError && <ErrorBanner text={loginError} />}

                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                  <div className={`fl-field rise ${loginError ? 'has-error' : ''}`} style={{ '--d': 3 }}>
                    <input
                      id="login-email" type="email" value={email} placeholder=" " autoComplete="email" required
                      onChange={e => { setEmail(e.target.value); setLoginError('') }}
                      onFocus={e => { setFocused('email'); lookAt(e.target) }}
                      onBlur={() => setFocused(null)}
                    />
                    <label htmlFor="login-email">Email</label>
                  </div>

                  <div className={`fl-field rise ${loginError ? 'has-error' : ''}`} style={{ '--d': 4 }}>
                    <input
                      ref={passRef}
                      id="login-password" type={showPass ? 'text' : 'password'} value={password} placeholder=" " autoComplete="current-password" required
                      onChange={e => { setPassword(e.target.value); setLoginError('') }}
                      onFocus={e => { setFocused('password'); lookAt(e.target) }}
                      onBlur={() => setFocused(null)}
                    />
                    <label htmlFor="login-password">Password</label>
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()} /* keep the input focused → mascots stay in hide/peek */
                      onClick={() => {
                        setShowPass(v => !v)
                        // keep the mascots looking / turned away while toggling
                        const el = passRef.current
                        if (el) { el.focus(); setFocused('password'); lookAt(el) }
                      }}
                      className="absolute right-0 bottom-2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                      aria-label={showPass ? 'Hide password' : 'Show password'}
                    >
                      {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>

                  <div className="rise flex justify-end -mt-1" style={{ '--d': 5 }}>
                    <button type="button" onClick={() => { setForgotMode(true); setLoginError('') }}
                      className="text-[11px] text-slate-400 hover:text-slate-800 dark:hover:text-white font-medium transition-colors">
                      Forgot password?
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading || mood === 'success'}
                    className="press rise w-full py-3.5 rounded-full bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500
                               text-white font-bold text-sm shadow-[0_12px_24px_-10px_rgba(15,23,42,0.6)]
                               disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-slate-900/30"
                    style={{ '--d': 6 }}
                  >
                    {authLoading ? (
                      <span className="inline-flex items-center gap-2">
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z"/>
                        </svg>
                        Signing in…
                      </span>
                    ) : mood === 'success' ? 'Welcome!' : 'Log in'}
                  </button>
                </form>

                <p className="rise text-center text-[11px] text-slate-400 dark:text-slate-500 mt-10" style={{ '--d': 7 }}>
                  Don't have an account? Contact your Administrator.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ErrorBanner({ text }) {
  return (
    <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-900/25 border border-red-200 dark:border-red-800/60 rounded-xl px-3.5 py-2.5 mb-5" role="alert">
      <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
      <p className="text-red-700 dark:text-red-400 text-xs font-medium">{text}</p>
    </div>
  )
}

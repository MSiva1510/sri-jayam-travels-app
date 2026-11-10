import { useNavigate } from 'react-router-dom'
import { ShieldOff, ArrowLeft, Home, LogOut, Smartphone } from 'lucide-react'
import { useAuth, ROLE_LABELS, ROLE_COLORS } from '../context/AuthContext'

export default function Unauthorized() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const colors = user ? ROLE_COLORS[user.role] : null
  // The web dashboard is admin/manager only — driver accounts live in the
  // mobile app, and there is no /my-trips route here to send them to.
  const isDriver = user?.role === 'driver'

  const handleSignOut = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-[var(--ap-bg)] bg-mesh px-5">
      <div className="max-w-md w-full text-center">

        {/* Icon */}
        <div className="w-20 h-20 rounded-3xl bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 flex items-center justify-center mx-auto mb-6">
          <ShieldOff size={36} className="text-red-500" />
        </div>

        <h1 className="text-3xl font-sf font-semibold text-slate-800 dark:text-white mb-2">
          Access Denied
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm leading-relaxed">
          {isDriver
            ? 'The web dashboard is for office staff. Driver accounts use the Sri Jayam Driver mobile app.'
            : <>You don't have permission to view this page.
                {user && (
                  <> Your current role (<strong className={`${colors?.text}`}>{ROLE_LABELS[user.role]}</strong>) does not include access to this section.</>
                )}
              </>
          }
        </p>

        {/* Role badge */}
        {user && (
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${colors?.bg} ${colors?.text} text-sm font-bold mb-7`}>
            <span className={`w-2 h-2 rounded-full ${colors?.dot}`} />
            Logged in as {user.name} · {ROLE_LABELS[user.role]}
          </div>
        )}

        {isDriver && (
          <div className="flex items-start gap-2.5 bg-white dark:bg-[var(--ap-surface)] border border-[var(--ap-border)] rounded-xl px-4 py-3 text-left mb-6">
            <Smartphone size={16} className="text-slate-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Open the <strong className="text-slate-700 dark:text-slate-200">Sri Jayam Driver</strong> app on your phone to see trips and updates.
              If you need web access, ask an administrator to change your role.
            </p>
          </div>
        )}

        <div className="flex gap-3 justify-center">
          {!isDriver && (
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-700 dark:text-slate-200 font-semibold text-sm hover:bg-[var(--ap-surface-2)] transition-all"
            >
              <ArrowLeft size={15} />
              Go Back
            </button>
          )}
          {isDriver ? (
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--ap-accent)] text-white font-semibold text-sm hover:opacity-90 transition-all shadow-lg"
            >
              <LogOut size={15} />
              Sign Out
            </button>
          ) : (
            <button
              onClick={() => navigate('/', { replace: true })}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--ap-accent)] text-white font-semibold text-sm hover:opacity-90 transition-all shadow-lg"
            >
              <Home size={15} />
              Go to Dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Notification Center ─────────────────────────────────────
// Bell icon with live dropdown.
// Alerts tab: vehicle document expiry (from reportData.getBusinessAlerts)
// Activity tab: operations audit log (from auditLogData)

import { useState, useRef, useEffect } from 'react'
import { Bell, X, CheckCircle, AlertTriangle, Clock } from 'lucide-react'
import { loadRecentActivity, fmtAuditTime } from '../../data/auditLogData'
import { getBusinessAlerts } from '../../data/reportData'

function useClickOutside(ref, handler) {
  useEffect(() => {
    function onDown(e) {
      if (!ref.current || ref.current.contains(e.target)) return
      handler()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [ref, handler])
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [tab,  setTab]  = useState('alerts')
  const [alerts, setAlerts] = useState([])
  const wrapRef = useRef()
  useClickOutside(wrapRef, () => setOpen(false))

  useEffect(() => {
    let alive = true
    getBusinessAlerts()
      .then(data => {
        if (alive) setAlerts(Array.isArray(data) ? data : [])
      })
      .catch(err => {
        console.error('[NotificationCenter] alerts load failed:', err)
        if (alive) setAlerts([])
      })
    return () => { alive = false }
  }, [])

  const activity = loadRecentActivity(8)
  const highCount = alerts.filter(a => a.priority === 'high').length

  return (
    <div ref={wrapRef} className="relative">

      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="relative w-9 h-9 rounded-xl border border-slate-200 dark:border-navy-600 bg-white/60 dark:bg-navy-800/60 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-700 transition-all"
        title="Notifications"
      >
        <Bell size={16} />
        {highCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center border-2 border-white dark:border-navy-900 leading-none">
            {highCount > 9 ? '9+' : highCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white dark:bg-navy-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-navy-700 overflow-hidden z-50 animate-fade-up">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-navy-700">
            <h3 className="font-display font-black text-slate-800 dark:text-white text-sm">Notifications</h3>
            <button onClick={() => setOpen(false)}
              className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors">
              <X size={13} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-100 dark:border-navy-700">
            {[
              { key: 'alerts',   label: 'Alerts',   count: alerts.length   },
              { key: 'activity', label: 'Activity',  count: activity.length },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex-1 py-2.5 text-xs font-bold transition-colors relative ${
                  tab === t.key
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                }`}>
                {t.label}
                <span className={`ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full ${
                  tab === t.key
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                    : 'bg-slate-100 dark:bg-navy-700 text-slate-400'
                }`}>{t.count}</span>
                {tab === t.key && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t" />
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="max-h-72 overflow-y-auto">
            {tab === 'alerts' && (
              alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <CheckCircle size={24} className="text-emerald-400" />
                  <p className="text-xs text-slate-400 dark:text-slate-500">All documents up to date</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50 dark:divide-navy-800">
                  {alerts.map((a, i) => (
                    <div key={i} className={`flex items-start gap-3 px-4 py-3 ${a.priority === 'high' ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        a.status?.key === 'expired'
                          ? 'bg-red-100 dark:bg-red-900/40'
                          : 'bg-amber-100 dark:bg-amber-900/40'
                      }`}>
                        <AlertTriangle size={13} className={a.status?.key === 'expired' ? 'text-red-500' : 'text-amber-500'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{a.label}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${a.status?.badge || ''}`}>
                            {a.status?.label || ''}
                          </span>
                          {a.days != null && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                              {a.days < 0 ? `${Math.abs(a.days)}d overdue` : a.days === 0 ? 'Today' : `${a.days}d left`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {tab === 'activity' && (
              activity.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <Clock size={24} className="text-slate-300 dark:text-slate-600" />
                  <p className="text-xs text-slate-400 dark:text-slate-500">No recent activity</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50 dark:divide-navy-800">
                  {activity.map(ev => (
                    <div key={ev.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="text-base flex-shrink-0">{ev.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{ev.label}</p>
                        {ev.description && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{ev.description}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0 whitespace-nowrap">
                        {fmtAuditTime(ev.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          {/* Footer hint */}
          {tab === 'alerts' && alerts.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-100 dark:border-navy-700 bg-slate-50/50 dark:bg-navy-800/30">
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                Go to Vehicles page to renew documents
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

import { CalendarCheck, ArrowUpRight } from 'lucide-react'
import Surface from '../ui/Surface'

export default function AttendanceWidget({
  attendance, dateLabel, available, onViewAttendance,
}) {
  return (
    <Surface>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarCheck size={16} className="text-blue-600 dark:text-blue-400" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Today's attendance</p>
        </div>
        <button
          type="button"
          onClick={onViewAttendance}
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors"
        >
          View <ArrowUpRight size={13} aria-hidden="true" />
        </button>
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{dateLabel}</p>

      {!available ? (
        <div className="mt-3 rounded-xl bg-slate-500/5 dark:bg-white/5 border border-[var(--ap-border)] px-3 py-3">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Attendance data unavailable</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Counts are hidden rather than shown as zero.</p>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            { label: 'Present', value: attendance.present, dot: 'bg-emerald-500' },
            { label: 'On leave', value: attendance.leave, dot: 'bg-amber-500' },
          ].map(status => (
            <div key={status.label} className="rounded-xl bg-slate-500/5 dark:bg-white/5 px-3 py-2.5 text-center">
              <span className={`inline-block w-2 h-2 rounded-full ${status.dot}`} aria-hidden="true" />
              <p className="font-sf text-xl font-semibold text-slate-900 dark:text-white tabular-nums mt-1">{status.value}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">{status.label}</p>
            </div>
          ))}
        </div>
      )}
    </Surface>
  )
}

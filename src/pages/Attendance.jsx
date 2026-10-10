import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarCheck, Clock, UserCheck, UserX,
  Calendar, Car, AlertTriangle,
  Users, Zap, RefreshCw, Phone, Check, Search, Eye,
} from 'lucide-react'
import Avatar     from '../components/ui/Avatar'
import PageHeader from '../components/ui/PageHeader'
import Button     from '../components/ui/Button'
import MetricCard from '../components/ui/MetricCard'
import IconButton from '../components/ui/IconButton'
import StatusPill from '../components/ui/StatusPill'
import Callout    from '../components/ui/Callout'
import EmptyState from '../components/ui/EmptyState'
import SegmentedControl from '../components/ui/SegmentedControl'
import { fieldCls } from '../components/ui/Field'
import { useAuth } from '../context/AuthContext'
import { loadDrivers } from '../data/driverData'
import { loadBookings } from '../data/tripTypes'
import { loadVehicles } from '../data/vehicleData'
import {
  loadAttendance, saveAttendanceRecord,
  ATTENDANCE_TYPES, getAttendanceCfg,
} from '../data/attendanceData'
import { loadRecentActivity, fmtAuditTime } from '../data/auditLogData'

// ── Attendance status badge ────────────────────────────────────
const ATTENDANCE_TONE = { present: 'green', absent: 'red', leave: 'amber', 'half-day': 'blue' }
function AttBadge({ status }) {
  const cfg = getAttendanceCfg(status)
  return <StatusPill tone={ATTENDANCE_TONE[status] || 'gray'}>{cfg.label}</StatusPill>
}

// ── Working hours bar ─────────────────────────────────────────
function HoursBar({ hours }) {
  if (!hours) return <span className="text-[10px] text-slate-400">—</span>
  const match = hours.match(/(\d+)h\s*(\d+)m/)
  if (!match) return <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{hours}</span>
  const h = parseInt(match[1]), m = parseInt(match[2])
  const pct = Math.min(100, Math.round(((h * 60 + m) / (12 * 60)) * 100))
  return (
    <div className="min-w-[80px]">
      <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">{hours}</p>
      <div className="h-1.5 bg-[var(--ap-border)] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-500'}`}
             style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── Status buckets (driver-page scoped) ──────────────────────────
// present bucket includes half-day (matches the summary chips).
const DRIVER_STATUS_PILL = {
  present: { label: 'Present', tone: 'green' },
  leave:   { label: 'On Leave', tone: 'amber' },
  absent:  { label: 'Absent',  tone: 'red' },
  unknown: { label: 'Not Marked', tone: 'gray' },
}
const MARK_VARIANT = { present: 'teal', absent: 'danger', leave: 'amber', 'half-day': 'primary' }
function bucketOf(record) {
  if (!record) return 'unknown'
  if (record.status === 'leave') return 'leave'
  if (record.status === 'absent') return 'absent'
  return 'present'
}
// ── Expanded driver detail (shared by desktop row + mobile card) ─
// Same existing mark-attendance actions, only presentation lives here.
function DriverAttDetail({ record, onMark }) {
  return (
    <div className="space-y-3">
      {record && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label:'Check In',       value: record.checkIn       || '—' },
            { label:'Check Out',      value: record.checkOut      || '—' },
            { label:'Vehicle',        value: record.vehicle       || '—' },
            { label:'Working Hours',  value: record.workingHours  || '—' },
            ...(record.tripWorkingMinutes != null ? [{
              label: 'Trip Driving Time',
              value: record.tripWorkingMinutes > 0
                ? `${Math.floor(record.tripWorkingMinutes/60)}h ${record.tripWorkingMinutes%60}m`
                : '—',
            }] : []),
            ...(record.tripSessions?.length ? [{
              label: 'Trips Today',
              value: `${record.tripSessions.length}`,
            }] : []),
          ].map(d => (
            <div key={d.label} className="bg-[var(--ap-surface-2)] rounded-xl p-2.5 border border-[var(--ap-border)]">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">{d.label}</p>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{d.value}</p>
            </div>
          ))}
        </div>
      )}
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Mark Attendance</p>
        <div className="flex gap-2 flex-wrap">
          {ATTENDANCE_TYPES.map(t => (
            <Button key={t.key} size="sm"
              variant={record?.status === t.key ? (MARK_VARIANT[t.key] || 'primary') : 'secondary'}
              onClick={() => onMark(t.key)}>{t.label}</Button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Driver View — own attendance
// ─────────────────────────────────────────────────────────────
function DriverAttendanceView({ user }) {
  const [all, setAll] = useState([])
  const [loadError, setLoadError] = useState(null)
  useEffect(() => {
    loadAttendance()
      .then(d => { setAll(Array.isArray(d) ? d : []); setLoadError(null) })
      .catch(err => { console.error('[Attendance] load failed:', err); setLoadError('Could not load your attendance history.') })
  }, [])
  const myRecords  = all.filter(a => a.driverId === user.id || a.driver === user.name)
                       .sort((a,b) => (b.date || '').localeCompare(a.date || ''))
  const today      = new Date().toISOString().slice(0,10)
  const todayRec   = myRecords.find(r => r.date === today)

  // Monthly summary
  const thisMonth  = myRecords.filter(r => r.date?.startsWith(today.slice(0,7)))
  const presentDays = thisMonth.filter(r => r.status === 'present' || r.status === 'half-day').length
  const absentDays  = thisMonth.filter(r => r.status === 'absent').length
  const leaveDays   = thisMonth.filter(r => r.status === 'leave').length

  const totalHoursMin = thisMonth.reduce((s, r) => {
    if (!r.workingHours) return s
    const m = r.workingHours.match(/(\d+)h\s*(\d+)m/)
    return m ? s + parseInt(m[1]) * 60 + parseInt(m[2]) : s
  }, 0)
  const totalHoursStr = totalHoursMin > 0
    ? `${Math.floor(totalHoursMin/60)}h ${totalHoursMin%60}m`
    : '—'

  return (
    <div className="space-y-5">
      {loadError && <Callout tone="red" icon={AlertTriangle} title={loadError} />}
      {/* Today card */}
      <div className="ap-surface rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">Today</p>
            <h2 className="text-lg font-sf font-semibold text-slate-800 dark:text-white">
              {new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' })}
            </h2>
          </div>
          {todayRec ? <AttBadge status={todayRec.status} /> : <span className="text-xs text-slate-400">Not recorded</span>}
        </div>
        {todayRec ? (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label:'Check In',  value: todayRec.checkIn  || '—', icon: UserCheck },
              { label:'Check Out', value: todayRec.checkOut || 'Active',  icon: UserX   },
              { label:'Vehicle',   value: todayRec.vehicle  || '—', icon: Car      },
              { label:'Working',   value: todayRec.workingHours || (todayRec.checkIn ? 'In progress' : '—'), icon: Clock },
            ].map(d => (
              <div key={d.label} className="bg-[var(--ap-surface-2)] rounded-xl p-3 flex items-start gap-2">
                <d.icon size={13} className="text-slate-500 dark:text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{d.label}</p>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">{d.value}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-sm text-slate-500 dark:text-slate-400">
            No attendance record for today yet.<br />
            <span className="text-xs">Auto check-in happens when you start your first ride.</span>
          </div>
        )}
      </div>

      {/* Monthly summary */}
      <div className="ap-surface rounded-2xl p-5">
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
          {new Date().toLocaleString('en-IN', { month:'long' })} Summary
        </p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <MetricCard label="Present Days" value={presentDays} icon={UserCheck} tone="green" />
          <MetricCard label="Absent Days"  value={absentDays}  icon={UserX} tone="red" />
          <MetricCard label="Leave Days"   value={leaveDays}   icon={Zap} tone="amber" />
          <MetricCard label="Total Hours"  value={totalHoursStr} icon={Clock} tone="blue" />
        </div>
      </div>

      {/* History list */}
      <div>
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 px-0.5">
          Attendance History
        </p>
        <div className="space-y-2">
          {myRecords.slice(0, 14).map((r, i) => (
            <div key={i} className="ap-surface rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--ap-text-1)] flex flex-col items-center justify-center flex-shrink-0">
                <span className="text-[8px] font-bold text-blue-400 uppercase leading-none">{r.date ? `${r.date.slice(5,7)}/${r.date.slice(8,10)}` : '—'}</span>
                <span className="text-xs font-semibold text-white leading-tight">
                  {r.date ? new Date(r.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday:'short' }) : '—'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <AttBadge status={r.status} />
                {r.checkIn && (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {r.checkIn}{r.checkOut ? ` – ${r.checkOut}` : ' (no checkout)'}
                  </p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                {r.workingHours && <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{r.workingHours}</p>}
                {r.vehicle && <p className="text-[10px] font-mono text-slate-400">{r.vehicle}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Manager / Admin View
// ─────────────────────────────────────────────────────────────
function AdminAttendanceView({ isAdmin }) {
  const navigate = useNavigate()
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0,10))
  const [expandedDriver, setExpandedDriver] = useState(null)
  const [search, setSearch] = useState('')
  const [driverTab, setDriverTab] = useState('all') // all | present | leave | absent | unknown

  const [allRecords, setAllRecords] = useState([])
  const [drivers, setDrivers] = useState([])
  const [bookings, setBookings] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [loadError, setLoadError] = useState(null)

  const reload = useCallback(async () => {
    const [rec, drv, bks, veh] = await Promise.allSettled([loadAttendance(), loadDrivers(), loadBookings(), loadVehicles()])
    setAllRecords(rec.status === 'fulfilled' && Array.isArray(rec.value) ? rec.value : [])
    setDrivers(   drv.status === 'fulfilled' && Array.isArray(drv.value) ? drv.value : [])
    setBookings(  bks.status === 'fulfilled' && Array.isArray(bks.value) ? bks.value : [])
    setVehicles(  veh.status === 'fulfilled' && Array.isArray(veh.value) ? veh.value : [])
    const failed = [rec, drv, bks, veh].some(r => r.status === 'rejected')
    if (failed) {
      if (rec.status === 'rejected') console.error('[Attendance] load records failed:', rec.reason)
      if (drv.status === 'rejected') console.error('[Attendance] load drivers failed:', drv.reason)
      setLoadError('Could not load attendance data. Try refreshing.')
    } else {
      setLoadError(null)
    }
  }, [])
  useEffect(() => { reload() }, [reload])

  const dateRecords = allRecords.filter(r => r.date === selectedDate)

  // Vehicle per driver from the existing vehicles table (driver column).
  const vehicleOf = (name) => vehicles.find(v => v.driver === name)?.reg || null
  // Today's assignment on the selected date from existing bookings.
  const assignOf = (name) => bookings.find(b =>
    b.driver === name &&
    (b.startDate || '').slice(0, 10) === selectedDate &&
    !['cancelled', 'closed'].includes(b.status)
  ) || null
  const tripsOf = (name) => bookings.filter(b =>
    b.driver === name && !['cancelled'].includes(b.status)
  ).length

  const driverRows = drivers.map(d => {
    const record = dateRecords.find(r => r.driver === d.name) || null
    return {
      name: d.name,
      id: d.id,
      mobile: d.mobile || d.phone || '',
      record,
      bucket: bucketOf(record),
      vehicle: vehicleOf(d.name) || d.vehicle || '',
      assign: assignOf(d.name),
      trips: tripsOf(d.name),
    }
  })

  const counts = {
    total:    drivers.length,
    present:  driverRows.filter(d => d.bucket === 'present').length,
    leave:    driverRows.filter(d => d.bucket === 'leave').length,
    absent:   driverRows.filter(d => d.bucket === 'absent').length,
    unknown:  driverRows.filter(d => d.bucket === 'unknown').length,
  }

  const filteredRows = driverRows.filter(d => {
    const q = search.trim().toLowerCase()
    const matchSearch = !q || [d.name, d.mobile, d.vehicle]
      .some(v => String(v || '').toLowerCase().includes(q))
    const matchTab = driverTab === 'all' || d.bucket === driverTab
    return matchSearch && matchTab
  })

  // Real driver-related activity (audit trail) — section omitted when empty.
  const driverActivity = useMemo(() => loadRecentActivity(40).filter(ev =>
    ev.module === 'drivers' ||
    ['TRIP_ASSIGNED', 'VEHICLE_ASSIGNED', 'TRIP_STARTED', 'TRIP_COMPLETED'].includes(ev.action)
  ).slice(0, 6), [drivers.length, allRecords.length])

  const handleMarkAttendance = async (driverName, status) => {
    const existing = dateRecords.find(r => r.driver === driverName)
    const driverMeta = drivers.find(d => d.name === driverName)
    const record = {
      id:           existing?.id || Date.now(),
      driver:       driverName,
      driverId:     driverMeta?.id,
      date:         selectedDate,
      status,
      checkIn:      existing?.checkIn  || null,
      checkOut:     existing?.checkOut || null,
      vehicle:      existing?.vehicle  || null,
      workingHours: existing?.workingHours || null,
    }
    try {
      await saveAttendanceRecord(record)
      await reload()
    } catch (err) {
      console.error('[Attendance] mark attendance failed:', err)
      window.alert('Could not save attendance. Please try again.')
    }
  }

  return (
    <div className="space-y-5">
      {loadError && (
        <Callout tone="red" icon={AlertTriangle} title={loadError} actionLabel="Retry" onAction={reload} />
      )}

      {/* Date strip */}
      <div className="ap-surface rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="w-9 h-9 rounded-[13px] bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
          <Calendar size={16} className="text-blue-600 dark:text-blue-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' })}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {dateRecords.length} of {drivers.length} marked
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date().toISOString().slice(0,10))}>Today</Button>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            max={new Date().toISOString().slice(0,10)} aria-label="Select date"
            className={`${fieldCls} w-auto h-10`} />
        </div>
      </div>

      {/* Summary cards (real data) */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <MetricCard label="Total Drivers" value={counts.total}   icon={Users}     tone="blue" />
        <MetricCard label="Present"       value={counts.present} icon={UserCheck} tone="green" />
        <MetricCard label="On Leave"      value={counts.leave}   icon={Zap}       tone="amber" />
        <MetricCard label="Absent"        value={counts.absent}  icon={UserX}     tone="red" />
      </div>

      {/* Main grid: management panel + side panel */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-3 items-start">
        <section aria-label="Driver attendance" className="ap-surface rounded-[20px] p-4 md:p-5 min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div>
              <h2 className="text-[16px] font-sf font-semibold text-slate-800 dark:text-white leading-tight">All Drivers</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{filteredRows.length} shown</p>
            </div>
          </div>

          {/* Filter tabs — buckets supported by attendance data */}
          <SegmentedControl
            ariaLabel="Filter by attendance status"
            value={driverTab}
            onChange={setDriverTab}
            scroll
            className="mb-3"
            options={[
              { key: 'all', label: 'All' },
              { key: 'present', label: 'Present' },
              { key: 'leave', label: 'On Leave' },
              { key: 'absent', label: 'Absent' },
              { key: 'unknown', label: 'Not Marked' },
            ]}
          />

          {/* Panel toolbar: search */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <div className="relative flex-1 min-w-[140px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Drivers"
                aria-label="Search drivers" className={`${fieldCls} pl-9`} />
            </div>
          </div>

          {/* Desktop table */}
          <div className="overflow-hidden hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--ap-border)]">
                  {['Driver', 'Phone', 'Status', 'Vehicle', "Today's Assignment", 'Trips', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="!border-0">
                      <EmptyState icon={Search} title="No drivers found" description="Try a different search or filter." />
                    </td>
                  </tr>
                ) : filteredRows.map((d) => {
                  const st = DRIVER_STATUS_PILL[d.bucket] || DRIVER_STATUS_PILL.unknown
                  const isOpen = expandedDriver === d.name
                  return (
                  <Fragment key={d.id || d.name}>
                  <tr className="border-b border-[var(--ap-border)] last:border-0 hover:bg-[var(--ap-surface-2)] transition-colors">
                    <td className="px-4 py-3 min-h-[68px]">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={d.name} size={32} />
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-slate-700 dark:text-slate-200 truncate max-w-[170px]">{d.name}</p>
                          {d.id && (
                            <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">{d.id}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {d.mobile ? (
                        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">
                          <Phone size={12} className="text-slate-400 flex-shrink-0" />{d.mobile}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone={st.tone} className="whitespace-nowrap">{st.label}</StatusPill>
                    </td>
                    <td className="px-4 py-3 text-[13px] font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">{d.vehicle || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300 max-w-[190px] truncate">
                      {d.assign ? `${d.assign.pickup || '—'} → ${d.assign.drop || '—'}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-[13px] font-bold text-slate-700 dark:text-slate-200 tabular-nums">{d.trips}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <IconButton icon={Eye} size={15} tone="brand"
                          label={isOpen ? `Collapse ${d.name}` : `View ${d.name}`}
                          aria-expanded={isOpen}
                          onClick={() => setExpandedDriver(isOpen ? null : d.name)} />
                        {!d.record && (
                          <IconButton icon={Check} size={15}
                            label={`Mark ${d.name} present`}
                            onClick={() => handleMarkAttendance(d.name, 'present')} />
                        )}
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={7} className="!p-0 !border-0">
                        <div className="border-t border-[var(--ap-border)] bg-[var(--ap-surface-2)]/30 px-4 py-4">
                          <DriverAttDetail record={d.record} onMark={(status) => handleMarkAttendance(d.name, status)} />
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards — stacked, no slider */}
          <div className="md:hidden space-y-2">
            {filteredRows.length === 0 ? (
              <EmptyState icon={Search} title="No drivers found" description="Try a different search or filter." className="border border-[var(--ap-border)] rounded-[20px]" />
            ) : filteredRows.map((d) => {
              const st = DRIVER_STATUS_PILL[d.bucket] || DRIVER_STATUS_PILL.unknown
              const isOpen = expandedDriver === d.name
              return (
              <div key={d.id || d.name} className="rounded-2xl border border-[var(--ap-border)] bg-[var(--ap-surface-2)] p-3.5">
                <div className="flex items-center gap-2.5" onClick={() => setExpandedDriver(isOpen ? null : d.name)}>
                  <Avatar name={d.name} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{d.name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums truncate">{d.mobile || 'No mobile'}</p>
                  </div>
                  <StatusPill tone={st.tone} className="whitespace-nowrap flex-shrink-0">{st.label}</StatusPill>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 truncate mt-2">
                  {d.vehicle || 'No vehicle'}{d.assign ? ` · ${d.assign.pickup || '—'} → ${d.assign.drop || '—'}` : ''}
                </p>
                <div className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-[var(--ap-border)]">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">{d.trips} trips</p>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <IconButton icon={Eye} size={15} tone="brand"
                      label={isOpen ? `Collapse ${d.name}` : `View ${d.name}`}
                      aria-expanded={isOpen}
                      onClick={() => setExpandedDriver(isOpen ? null : d.name)} />
                    {!d.record && (
                      <IconButton icon={Check} size={15}
                        label={`Mark ${d.name} present`}
                        onClick={() => handleMarkAttendance(d.name, 'present')} />
                    )}
                  </div>
                </div>
                {isOpen && (
                  <div className="mt-2.5 pt-2.5 border-t border-[var(--ap-border)]">
                    <DriverAttDetail record={d.record} onMark={(status) => handleMarkAttendance(d.name, status)} />
                  </div>
                )}
              </div>
              )
            })}
          </div>
        </section>

        {/* 6. Right-side panel: availability + quick actions */}
        <aside aria-label="Attendance overview" className="ap-surface rounded-[20px] p-4 md:p-5 min-w-0 space-y-5">
          <div>
            <h2 className="text-[16px] font-sf font-semibold text-slate-800 dark:text-white leading-tight mb-3">Availability</h2>
            <div className="space-y-1.5">
              {[
                { label: 'Present', value: counts.present, dot: 'bg-emerald-500' },
                { label: 'On Leave', value: counts.leave, dot: 'bg-amber-500' },
                { label: 'Absent', value: counts.absent, dot: 'bg-red-500' },
                { label: 'Not Marked', value: counts.unknown, dot: 'bg-slate-400' },
              ].map(r => (
                <div key={r.label} className="flex items-center gap-2 text-[13px]">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${r.dot}`} />
                  <span className="text-slate-500 dark:text-slate-400">{r.label}</span>
                  <span className="ml-auto font-bold text-slate-700 dark:text-slate-200 tabular-nums">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-[16px] font-sf font-semibold text-slate-800 dark:text-white leading-tight mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setSelectedDate(new Date().toISOString().slice(0,10))}
                className="flex flex-col items-start gap-2 p-3 rounded-2xl border border-[var(--ap-border)] bg-[var(--ap-surface-2)] hover:shadow-md active:scale-[0.98] transition-all text-left min-h-[76px]">
                <span className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0"><Calendar size={15} className="text-white" /></span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-tight">Today</span>
              </button>
              <button onClick={() => reload()}
                className="flex flex-col items-start gap-2 p-3 rounded-2xl border border-[var(--ap-border)] bg-[var(--ap-surface-2)] hover:shadow-md active:scale-[0.98] transition-all text-left min-h-[76px]">
                <span className="w-8 h-8 rounded-xl bg-teal-600 flex items-center justify-center flex-shrink-0"><RefreshCw size={15} className="text-white" /></span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-tight">Refresh</span>
              </button>
              <button onClick={() => navigate('/drivers')}
                className="flex flex-col items-start gap-2 p-3 rounded-2xl border border-[var(--ap-border)] bg-[var(--ap-surface-2)] hover:shadow-md active:scale-[0.98] transition-all text-left min-h-[76px] col-span-2">
                <span className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center flex-shrink-0"><Users size={15} className="text-white" /></span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-tight">View Drivers</span>
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* 7. Recent activity (real audit trail — omitted when empty) */}
      {driverActivity.length > 0 && (
        <section aria-label="Recent driver activity" className="ap-surface rounded-[20px] p-4 md:p-5">
          <h2 className="text-[16px] font-sf font-semibold text-slate-800 dark:text-white leading-tight mb-3">Recent Activity</h2>
          <div className="divide-y divide-[var(--ap-border)]">
            {driverActivity.map(ev => (
              <div key={ev.id} className="flex items-center gap-3 py-2.5">
                <span className="text-base flex-shrink-0" aria-hidden="true">{ev.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{ev.label}</p>
                  {ev.description && <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{ev.description}</p>}
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 flex-shrink-0">{fmtAuditTime(ev.timestamp)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Admin: full analytics */}
      {isAdmin && (
        <div className="ap-surface rounded-2xl p-5">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Monthly Overview — All Drivers</p>
          {driverRows.length === 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-2">No drivers found.</p>
          )}
          {driverRows.map(d => d.name).map(name => {
            const dRecords = allRecords.filter(r => r.driver === name)
            const thisMonth = dRecords.filter(r => r.date?.startsWith(new Date().toISOString().slice(0,7)))
            const p = thisMonth.filter(r => ['present','half-day'].includes(r.status)).length
            const a = thisMonth.filter(r => r.status === 'absent').length
            const l = thisMonth.filter(r => r.status === 'leave').length
            const totalMin = thisMonth.reduce((s, r) => {
              if (!r.workingHours) return s
              const m = r.workingHours.match(/(\d+)h\s*(\d+)m/)
              return m ? s + parseInt(m[1]) * 60 + parseInt(m[2]) : s
            }, 0)
            return (
              <div key={name} className="mb-4 last:mb-0">
                <div className="flex items-center gap-2.5 mb-2">
                  <Avatar name={name} size={26} />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex-1">{name}</span>
                  <span className="text-[10px] text-slate-400">{Math.floor(totalMin/60)}h total</span>
                </div>
                <div className="h-2 bg-[var(--ap-border)] rounded-full overflow-hidden flex">
                  <div className="h-full bg-emerald-500" style={{ width:`${(p/7)*100}%` }} />
                  <div className="h-full bg-amber-400"   style={{ width:`${(l/7)*100}%` }} />
                  <div className="h-full bg-red-400"     style={{ width:`${(a/7)*100}%` }} />
                </div>
                <div className="flex gap-3 mt-1">
                  {[['Present',p,'text-emerald-600 dark:text-emerald-400'],['Leave',l,'text-amber-600 dark:text-amber-400'],['Absent',a,'text-red-600 dark:text-red-400']].map(([lbl,val,cls]) => (
                    <span key={lbl} className={`text-[10px] font-bold ${cls}`}>{val} {lbl}</span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Main Attendance Page
// ─────────────────────────────────────────────────────────────
export default function Attendance() {
  const { user, isDriver, isAdmin } = useAuth()

  return (
    <div className="space-y-4 md:space-y-3 animate-fade-up">
      <PageHeader
        title="Attendance"
        subtitle={isDriver ? 'Your work schedule & hours' : 'Driver attendance management'}
        action={
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 min-h-[40px]">
            <CalendarCheck size={14} className="text-navy-700 dark:text-blue-400" />
            {new Date().toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
          </div>
        }
      />
      {isDriver
        ? <div className="max-w-2xl mx-auto w-full"><DriverAttendanceView user={user} /></div>
        : <AdminAttendanceView isAdmin={isAdmin} />
      }
    </div>
  )
}
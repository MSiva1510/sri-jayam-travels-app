// ─── GPS History (trip-centric) ─────────────────────────────────
// Pick a trip (from bookings) → load its vehicle GPS track for the trip
// window → route polyline + car playback + timeline + events/stops/
// summary/charts. Replays full-screen on /gps-history/replay.
// Backend: gpsHistoryRepository.getReplay + gpsReplayService.processReplayData.

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Play, Download, Search, X, MapPin, ChevronLeft, ChevronRight,
} from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import ReplayMap from '../components/gps/ReplayMap'
import ReplayControls from '../components/gps/ReplayControls'
import TripStats from '../components/gps/TripStats'
import { gpsHistoryRepository } from '../repositories/gpsHistoryRepository'
import { processReplayData, REPLAY_INTERVAL_MS, formatDuration } from '../services/gpsReplayService'
import { loadBookings } from '../data/tripTypes'
import { loadVehicles } from '../data/vehicleData'
import { exportToCSV } from '../data/reportData'
import { forwardGeocode, fetchDrivingRoute, distanceBetween } from '../utils/locationUtils'
import { useApp } from '../context/AppContext'

const normReg = (r) => String(r ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
const fmtT = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d) ? '—' : d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()
}
const fmtD = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
const fmtDT = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}`
}
const rs = (v) => `Rs. ${Number(v || 0).toLocaleString('en-IN')}`

// Derive one event row per GPS point (real samples only)
function deriveEvents(points) {
  if (!points.length) return []
  // Find zero-speed runs (stops)
  const stopRun = new Array(points.length).fill(null)
  let i = 0
  while (i < points.length) {
    if (Number(points[i].speed_kmh ?? 0) === 0) {
      let j = i
      while (j + 1 < points.length && Number(points[j + 1].speed_kmh ?? 0) === 0) j++
      if (j > i) {
        const t0 = new Date(points[i].timestamp).getTime()
        const t1 = new Date(points[j].timestamp).getTime()
        const mins = Math.max(1, Math.round(((t1 - t0) || 0) / 60000))
        for (let k = i; k <= j; k++) stopRun[k] = mins
        i = j + 1
      } else i++
    } else i++
  }
  return points.map((p, idx) => {
    let type = 'enroute', label = 'En Route'
    if (idx === 0) { type = 'started'; label = 'Trip Started' }
    else if (idx === points.length - 1) { type = 'completed'; label = 'Trip Completed' }
    else if (stopRun[idx] != null) { type = 'stop'; label = `Stop (${stopRun[idx]}m)` }
    return { idx, point: p, type, label }
  })
}

const EV_STYLE = {
  started: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  enroute: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  stop: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  completed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const TABS = [
  { key: 'events', label: 'GPS Events' },
  { key: 'playback', label: 'Route Playback' },
  { key: 'stops', label: 'Stops' },
  { key: 'summary', label: 'Summary' },
  { key: 'charts', label: 'Charts' },
]
const EVT_PAGE = 10

export default function GpsHistory() {
  const navigate = useNavigate()
  const { darkMode } = useApp()

  // Source data
  const [bookings, setBookings] = useState([])
  const [vehicles, setVehicles] = useState([])

  // Filters (narrow the trip list)
  const [tripId, setTripId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [vehicleF, setVehicleF] = useState('all')
  const [driverF, setDriverF] = useState('all')
  const [customerF, setCustomerF] = useState('all')
  const [statusF, setStatusF] = useState('all')
  const [search, setSearch] = useState('')

  // Track
  const [points, setPoints] = useState([])
  const [replay, setReplay] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [appliedTrip, setAppliedTrip] = useState(null)
  // Estimated route fallback (old trips without GPS): pickup→drop line
  const [fallback, setFallback] = useState(null)
  const [fbLoading, setFbLoading] = useState(false)

  // Playback + tabs
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [tab, setTab] = useState('events')
  const [evFilter, setEvFilter] = useState('all')
  const [evPage, setEvPage] = useState(1)
  const intervalRef = useRef(null)

  useEffect(() => {
    Promise.all([loadBookings(), loadVehicles()]).then(([b, v]) => {
      setBookings(Array.isArray(b) ? b : [])
      setVehicles(Array.isArray(v) ? v : [])
    }).catch(() => {})
  }, [])

  const setTripAndDates = useCallback((booking) => {
    if (!booking) { setTripId(''); return }
    setTripId(booking.bookingNo || booking.id)
    setDateFrom((booking.startDate || '').slice(0, 10))
    setDateTo(((booking.returnDate || booking.startDate) || '').slice(0, 10))
  }, [])

  const tripList = useMemo(() => bookings.filter(b => {
    if (vehicleF !== 'all' && b.vehicle !== vehicleF) return false
    if (driverF !== 'all' && b.driver !== driverF) return false
    if (customerF !== 'all' && b.customer !== customerF) return false
    if (statusF !== 'all' && b.status !== statusF) return false
    if (search) {
      const q = search.toLowerCase()
      if (![b.bookingNo, b.customer, b.driver, b.vehicle, b.pickup, b.drop].some(v => String(v ?? '').toLowerCase().includes(q))) return false
    }
    return true
  }).sort((a, b) => String(b.startDate || '').localeCompare(String(a.startDate || ''))), [bookings, vehicleF, driverF, customerF, statusF, search])

  const trip = useMemo(
    () => bookings.find(b => (b.bookingNo || b.id) === tripId) || null,
    [bookings, tripId]
  )
  const vehicleOpts = useMemo(() => [...new Set(bookings.map(b => b.vehicle).filter(Boolean))].sort(), [bookings])
  const driverOpts = useMemo(() => [...new Set(bookings.map(b => b.driver).filter(Boolean))].sort(), [bookings])
  const customerOpts = useMemo(() => [...new Set(bookings.map(b => b.customer).filter(Boolean))].sort(), [bookings])
  const statusOpts = useMemo(() => [...new Set(bookings.map(b => b.status).filter(Boolean))].sort(), [bookings])

  const resolveVehicleId = useCallback((booking) => {
    if (!booking) return null
    const hit = vehicles.find(v => normReg(v.registration || v.reg) === normReg(booking.vehicle) && normReg(booking.vehicle) !== '')
    return hit?.id || hit?.vehicle_id || null
  }, [vehicles])

  const runReport = useCallback(async (booking, from, to) => {
    if (!booking) { setError('Select a trip first.'); return }
    setLoading(true); setError(null); setPlaying(false); setCurrentIndex(0); setEvPage(1)
    setFallback(null); setFbLoading(false)
    // Old trips often have no vehicle link and no GPS — the estimated
    // route below needs neither, so always attempt it as the fallback.
    const loadFallback = async () => {
      setFbLoading(true)
      try {
        const [f, t] = await Promise.all([forwardGeocode(booking.pickup), forwardGeocode(booking.drop)])
          if (!f || !t) {
            const missing = [!f && `"${booking.pickup || 'pickup'}"`, !t && `"${booking.drop || 'drop'}`].filter(Boolean).join(' / ')
            setError(`No GPS points for this trip, and ${missing} could not be placed on the map. Check the spelling in the trip booking.`)
          }
          if (f && t) {
          let route = null
          try { route = await fetchDrivingRoute(f, t) } catch {}
          if (route) {
            setFallback({ ...route, from: f, to: t, straight: false })
          } else {
            setFallback({
              positions: [[f.lat, f.lng], [t.lat, t.lng]],
              distanceKm: Math.round(distanceBetween(f.lat, f.lng, t.lat, t.lng) * 10) / 10,
              durationSec: null, from: f, to: t, straight: true,
            })
          }
          }
      } catch {
        setError('No GPS points for this trip and range — run a GPS sync and try again.')
      } finally {
        setFbLoading(false)
      }
    }
    try {
      const vid = resolveVehicleId(booking)
      const pts = vid
        ? await gpsHistoryRepository.getReplay(vid,
            from ? `${from}T00:00:00.000Z` : undefined,
            to ? `${to}T23:59:59.999Z` : undefined)
        : []
      if ((pts?.length ?? 0) < 2) {
        setPoints([]); setReplay(null); setAppliedTrip(booking)
        // Old trip without a usable GPS track: estimate from booking details.
        await loadFallback()
        return
      }
      setPoints(pts)
      setReplay(processReplayData(pts))
      setAppliedTrip(booking)
    } catch (err) {
      setPoints([]); setReplay(null)
      setError(err?.message ?? 'Failed to load GPS track')
    } finally {
      setLoading(false)
    }
  }, [resolveVehicleId])

  // Filters drive the trip: whenever the current selection falls outside
  // the filtered list (e.g. customer changed), auto-pick the first match
  // (latest completed first) so the route always follows the filters.
  const sortedList = useMemo(() => {
    const done = tripList.filter(b => ['completed', 'closed'].includes(b.status))
    return [...done, ...tripList.filter(b => !['completed', 'closed'].includes(b.status))]
  }, [tripList])
  useEffect(() => {
    if (!bookings.length) return
    if (!sortedList.some(b => (b.bookingNo || b.id) === tripId)) {
      setTripAndDates(sortedList[0] || null)
    }
  }, [sortedList, tripId, bookings.length, setTripAndDates])

  // Any trip change (picked, auto-picked, or default) loads its route.
  const lastRun = useRef('')
  useEffect(() => {
    if (!trip || !dateFrom || !bookings.length) return
    const key = `${tripId}|${dateFrom}|${dateTo || dateFrom}`
    if (lastRun.current === key) return
    lastRun.current = key
    runReport(trip, dateFrom, dateTo || dateFrom)
  }, [trip, tripId, dateFrom, dateTo, bookings.length, runReport])

  // Playback ticker (same engine as Route Replay page)
  const stopTick = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
  }, [])
  const startTick = useCallback(() => {
    stopTick()
    if (!points.length) return
    intervalRef.current = setInterval(() => {
      setCurrentIndex(prev => {
        const next = prev + 1
        if (next >= points.length) { stopTick(); setPlaying(false); return points.length - 1 }
        return next
      })
    }, Math.round(REPLAY_INTERVAL_MS / speed))
  }, [points.length, speed, stopTick])
  useEffect(() => { if (playing) startTick() }, [speed]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stopTick(), [stopTick])
  const doPlay = useCallback(() => {
    if (!points.length) return
    if (currentIndex >= points.length - 1) setCurrentIndex(0)
    setPlaying(true); startTick()
  }, [points.length, currentIndex, startTick])
  const doPause = useCallback(() => { setPlaying(false); stopTick() }, [stopTick])
  const doStop = useCallback(() => { setPlaying(false); stopTick(); setCurrentIndex(0) }, [stopTick])
  const doSeek = useCallback((idx) => {
    setCurrentIndex(Math.max(0, Math.min(idx, points.length - 1)))
    if (playing) startTick()
  }, [points.length, playing, startTick])

  const events = useMemo(() => deriveEvents(points), [points])
  const evRows = useMemo(() => events.filter(e => evFilter === 'all' ||
    (evFilter === 'stops' ? e.type === 'stop' : e.type === evFilter)
  ), [events, evFilter])
  const evPages = Math.max(1, Math.ceil(evRows.length / EVT_PAGE))
  const evSafe = Math.min(Math.max(1, evPage), evPages)
  const evSlice = evRows.slice((evSafe - 1) * EVT_PAGE, evSafe * EVT_PAGE)
  useEffect(() => { setEvPage(1) }, [evFilter, points.length])

  const stats = replay?.stats || null
  const stops = replay?.stops || []
  const currentPoint = points[currentIndex] ?? null

  const seekToTs = (ts) => {
    const t = new Date(ts).getTime()
    let best = 0, bestD = Infinity
    points.forEach((p, i) => {
      const d = Math.abs(new Date(p.timestamp).getTime() - t)
      if (d < bestD) { bestD = d; best = i }
    })
    doSeek(best)
  }

  const handleExport = () => exportToCSV(events.map(e => ({
    time: e.point.timestamp, location: e.point.address || '',
    lat: e.point.latitude, lng: e.point.longitude,
    speed: Number(e.point.speed_kmh ?? 0),
    gps: e.point.gps_online === true ? 'Valid' : 'Void',
    ignition: e.point.ignition === true ? 'ON' : 'OFF',
    event: e.label,
  })), [
    { label: 'Time', key: 'time' }, { label: 'Location', key: 'location' },
    { label: 'Lat', key: 'lat' }, { label: 'Lng', key: 'lng' },
    { label: 'Speed (km/h)', key: 'speed' }, { label: 'GPS', key: 'gps' },
    { label: 'Ignition', key: 'ignition' }, { label: 'Event', key: 'event' },
  ], `gps_events_${tripId || 'trip'}`)

  const goReplay = () => {
    const vid = resolveVehicleId(appliedTrip || trip)
    if (!vid) return
    const since = dateFrom ? `${dateFrom}T00:00:00.000Z` : ''
    const until = dateTo ? `${dateTo}T23:59:59.999Z` : ''
    navigate(`/gps-history/replay?vehicleId=${vid}&since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}`)
  }

  const selCls = 'px-3 py-2.5 text-xs rounded-xl border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-700 dark:text-slate-200 focus:outline-none font-bold w-full'

  return (
    <div className="space-y-4 animate-fade-up">
      <PageHeader
        title="GPS History"
        subtitle="View detailed GPS tracking history for your trips"
        action={
          <div className="flex items-center gap-2">
            <button onClick={goReplay} disabled={!trip}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-600 dark:text-slate-200 font-bold text-sm hover:bg-[var(--ap-surface-2)] transition-colors disabled:opacity-40">
              <Play size={14} /> Replay Trip
            </button>
            <button onClick={handleExport} disabled={events.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all shadow-md active:scale-95 disabled:opacity-40">
              <Download size={14} /> Export
            </button>
          </div>
        }
      />

      {/* Filter bar */}
      <div className="ap-surface rounded-2xl p-3.5">
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2 items-end">
          <div className="col-span-2 sm:col-span-2 xl:col-span-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Trip</label>
            <div className="relative">
              <select value={tripId} onChange={e => {
                const b = bookings.find(x => (x.bookingNo || x.id) === e.target.value)
                if (b) setTripAndDates(b)
                else { setTripId(''); }
              }} className={`${selCls} ${tripId ? 'pr-8' : ''}`}>
                <option value="">Select trip… ({tripList.length})</option>
                {tripList.map(b => <option key={b.id} value={b.bookingNo || b.id}>{b.bookingNo} · {b.customer} · {(b.startDate || '').slice(0, 10)}</option>)}
              </select>
              {tripId && (
                <button onClick={() => setTripId('')} title="Clear trip" aria-label="Clear trip"
                  className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={13} /></button>
              )}
            </div>
          </div>
          <div className="col-span-2 sm:col-span-2 xl:col-span-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Date Range</label>
            <div className="flex items-center gap-1.5">
              <input type="date" value={dateFrom} max={dateTo || undefined} onChange={e => setDateFrom(e.target.value)} className={selCls} />
              <input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)} className={selCls} />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Vehicle</label>
            <select value={vehicleF} onChange={e => setVehicleF(e.target.value)} className={selCls}>
              <option value="all">All Vehicles</option>
              {vehicleOpts.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Driver</label>
            <select value={driverF} onChange={e => setDriverF(e.target.value)} className={selCls}>
              <option value="all">All Drivers</option>
              {driverOpts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Customer</label>
            <select value={customerF} onChange={e => setCustomerF(e.target.value)} className={selCls}>
              <option value="all">All Customers</option>
              {customerOpts.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</label>
            <select value={statusF} onChange={e => setStatusF(e.target.value)} className={selCls}>
              <option value="all">All Status</option>
              {statusOpts.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-2 xl:col-span-1">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by trip, vehicle, driver…"
                className="w-full pl-8 pr-3 py-2.5 text-xs rounded-xl border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none" />
            </div>
          </div>
          <div className="col-span-2 sm:col-span-2 xl:col-span-1">
            <button onClick={() => trip && runReport(trip, dateFrom, dateTo || dateFrom)} disabled={!trip || loading}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-40">
              {loading ? 'Loading…' : 'Apply'}
            </button>
          </div>
        </div>
      </div>

      {/* Trip summary */}
      {trip && (
        <div className="ap-surface rounded-2xl p-4">
          <div className="flex flex-wrap items-start gap-x-7 gap-y-3">
            <div className="flex items-start gap-2.5 min-w-[210px]">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white flex-shrink-0 text-sm font-semibold">🧾</div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-sf font-semibold text-slate-800 dark:text-white">{trip.bookingNo}</p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 capitalize">{trip.status}</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Booked on {fmtD(trip.createdAt || trip.startDate)}</p>
                <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 mt-1">📍 {trip.pickup || '—'} → {trip.drop || '—'}</p>
              </div>
            </div>
            {[
              ['Customer', trip.customer || '—', trip.company || trip.contact || ''],
              ['Driver', trip.driver || '—', trip.driverMobile || trip.contact || ''],
              ['Vehicle', trip.vehicle || '—', trip.vehicleModel || ''],
              ['Trip Start', stats ? fmtDT(stats.startTs).split(',')[1]?.trim() || fmtDT(stats.startTs) : fmtDT(dateFrom), stats ? fmtD(stats.startTs) : fmtD(dateFrom), stats ? (points[0]?.address?.split(',')[0] || trip.pickup) : trip.pickup, 'green'],
              ['Trip End', stats ? fmtDT(stats.endTs).split(',')[1]?.trim() || fmtDT(stats.endTs) : fmtDT(dateTo), stats ? fmtD(stats.endTs) : fmtD(dateTo), stats ? (points[points.length - 1]?.address?.split(',')[0] || trip.drop) : trip.drop, 'red'],
              ['Duration', stats ? formatDuration(stats.durationSec) : (fallback?.durationSec ? `~${formatDuration(fallback.durationSec)}` : '—'), fallback && !stats ? 'Estimated' : '', ''],
              ['Distance', stats ? `${stats.totalDistanceKm} km` : (fallback ? `~${fallback.distanceKm} km` : '—'), fallback && !stats ? 'Estimated route' : '', ''],
              ['Trip Fare', rs(trip.fare), '', ''],
            ].map(([l, v, s, extra, dot]) => (
              <div key={l} className="min-w-[105px]">
                <p className="text-[10px] text-slate-400">{l}</p>
                <p className="text-xs font-semibold text-slate-800 dark:text-white tabular-nums whitespace-nowrap">
                  {dot === 'green' ? '🟢 ' : dot === 'red' ? '🔴 ' : ''}{v}
                </p>
                {s ? <p className="text-[10px] text-slate-400 truncate max-w-[130px]">{s}</p> : null}
                {extra ? <p className="text-[10px] text-slate-400 truncate max-w-[130px]">{extra}</p> : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Map */}
      <div className="relative">
        {loading || fbLoading ? (
          <div className="ap-surface rounded-2xl p-14 text-center">
            <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-400">{fbLoading ? 'Placing route from booking details…' : 'Loading GPS track…'}</p>
          </div>
        ) : points.length > 1 ? (
          <div className="relative">
            <ReplayMap points={points} currentIndex={currentIndex} coloredPath={replay?.coloredPath ?? []} darkMode={darkMode} height={470} stops={replay?.stops ?? []} />
            <button onClick={goReplay} title="Open full replay"
              className="absolute right-3 top-3 z-[400] px-3 py-2 text-xs font-bold rounded-xl bg-[var(--ap-surface)]/95 border border-[var(--ap-border)] shadow flex items-center gap-1.5 hover:bg-[var(--ap-surface-2)] transition-colors">
              ⤢ Full Map
            </button>
            <div className="absolute right-3 top-14 z-[400] flex flex-col gap-1.5">
              <div className="px-3 py-2 rounded-xl bg-[var(--ap-surface)]/95 border border-[var(--ap-border)] shadow text-xs font-semibold tabular-nums whitespace-nowrap">
                🛣 {stats ? `${stats.totalDistanceKm} km` : '—'}
              </div>
              <div className="px-3 py-2 rounded-xl bg-[var(--ap-surface)]/95 border border-[var(--ap-border)] shadow text-xs font-semibold tabular-nums whitespace-nowrap">
                🕐 {stats ? formatDuration(stats.durationSec) : '—'}
              </div>
            </div>
          </div>
        ) : fallback ? (
          <div className="relative">
            <ReplayMap points={[]} currentIndex={0} coloredPath={[]} darkMode={darkMode} height={470}
              fallbackLine={{
                positions: fallback.positions,
                fromLabel: fallback.from?.label || trip?.pickup || 'Pickup',
                toLabel: fallback.to?.label || trip?.drop || 'Drop',
              }} />
            <div className="absolute left-3 top-3 z-[400] px-3 py-1.5 rounded-xl bg-blue-600/95 text-white text-[11px] font-bold shadow flex items-center gap-1.5">
              ⚠ Estimated route — no GPS points for this trip
            </div>
          </div>
        ) : (
          <div className="ap-surface rounded-2xl p-12 text-center">
            <MapPin size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{error || 'Select a trip and press Apply to draw its route.'}</p>
            {!error && <p className="text-xs text-slate-400 mt-1">Route, playback and events appear here from live GPS points.</p>}
          </div>
        )}
      </div>

      {/* Estimated timeline strip (separate card below the map) */}
      {fallback && points.length <= 1 && (
        <div className="ap-surface rounded-2xl px-5 py-4 overflow-x-auto">
          <div className="flex items-start min-w-[420px]">
            {[
              { label: 'From', sub: fallback.from?.label || trip?.pickup || '—', time: fmtD(dateFrom), color: '#10b981' },
              { label: 'To', sub: fallback.to?.label || trip?.drop || '—', time: fallback.durationSec ? `~${formatDuration(fallback.durationSec)}` : fmtD(dateTo), color: '#ef4444' },
            ].map((n, i) => (
              <div key={i} className="flex-1 flex flex-col items-center relative">
                {i > 0 && <div className="absolute top-[7px] h-[3px] rounded-full bg-gradient-to-r from-blue-500 to-blue-400/70" style={{ width: '100%', left: '-50%' }} />}
                <span className="w-3.5 h-3.5 rounded-full border-[3px] border-white border-[var(--ap-border)] relative z-10 flex-shrink-0"
                  style={{ background: n.color, boxShadow: `0 0 10px ${n.color}` }} />
                <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 mt-1.5 whitespace-nowrap">{n.label}</p>
                <p className="text-[10px] text-slate-400 tabular-nums whitespace-nowrap">{n.time}</p>
                <p className="text-[10px] text-slate-400 truncate max-w-[160px]">{n.sub}</p>
              </div>
            ))}
          </div>
          {fallback.durationSec ? (
            <p className="text-center text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-2 tabular-nums">
              Estimated drive time ~{formatDuration(fallback.durationSec)} · {fallback.straight ? 'straight line' : 'via road route'}
            </p>
          ) : null}
        </div>
      )}

      {/* Estimated-route facts (old trips without GPS) */}
      {fallback && points.length <= 1 && (
        <div className="ap-surface rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ['From', fallback.from?.label || trip?.pickup || '—'],
            ['To', fallback.to?.label || trip?.drop || '—'],
            ['Distance', `~${fallback.distanceKm} km`],
            ['Drive time', fallback.durationSec ? `~${formatDuration(fallback.durationSec)}` : (fallback.straight ? 'Straight-line — routing unavailable' : '—')],
          ].map(([l, v]) => (
            <div key={l} className="bg-[var(--ap-surface-2)] rounded-xl px-3 py-2.5">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide font-bold">{l}</p>
              <p className="text-xs font-semibold text-slate-800 dark:text-white truncate mt-0.5">{v}</p>
            </div>
          ))}
        </div>
      )}

      {/* Timeline strip */}
      {points.length > 1 && stats && (
        <TimelineStrip stats={stats} stops={stops} segments={replay?.segments ?? []} onSeekTs={seekToTs}
          startSub={(points[0]?.address || '').split(',')[0]} endSub={(points[points.length - 1]?.address || '').split(',')[0]} />
      )}

      {/* Tabs */}
      {points.length > 0 && (
        <div className="flex gap-1 bg-[var(--ap-surface-2)] rounded-2xl p-1.5 overflow-x-auto no-scrollbar w-fit max-w-full">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${tab === t.key ? 'bg-[var(--ap-accent)] text-white shadow' : 'text-slate-500 dark:text-slate-400'}`}>
              {t.label}{t.key === 'stops' && stops.length > 0 ? ` (${stops.length})` : ''}
            </button>
          ))}
        </div>
      )}

      {points.length > 0 && tab === 'events' && (
        <div className="ap-surface rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--ap-border)]">
            <p className="text-sm font-bold text-slate-800 dark:text-white">GPS Events ({evRows.length})</p>
            <select value={evFilter} onChange={e => setEvFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-slate-700 dark:text-slate-200 focus:outline-none font-bold">
              <option value="all">All Events</option>
              <option value="started">Trip Started</option>
              <option value="enroute">En Route</option>
              <option value="stops">Stops</option>
              <option value="completed">Trip Completed</option>
            </select>
          </div>
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--ap-surface-2)] border-b border-[var(--ap-border)]">
                  {['#', 'Time', 'Location', 'Speed', 'GPS Status', 'Ignition', 'Event Type', ''].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {evSlice.map(e => (
                  <tr key={e.idx} className="border-b border-[var(--ap-border)] hover:bg-[var(--ap-surface-2)] transition-colors">
                    <td className="px-3 py-2.5 text-xs text-slate-400 tabular-nums">{e.idx + 1}</td>
                    <td className="px-3 py-2.5 text-[11px] tabular-nums whitespace-nowrap">{fmtDT(e.point.timestamp)}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300 max-w-[220px] truncate">{e.point.address || '—'}</td>
                    <td className="px-3 py-2.5 text-xs font-bold tabular-nums whitespace-nowrap">{Number(e.point.speed_kmh ?? 0).toFixed(0)} km/h</td>
                    <td className="px-3 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${e.point.gps_online === true ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>● {e.point.gps_online === true ? 'Valid' : 'Void'}</span></td>
                    <td className="px-3 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${e.point.ignition === true ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{e.point.ignition === true ? '◉ ON' : '◉ OFF'}</span></td>
                    <td className="px-3 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${EV_STYLE[e.type]}`}>▶ {e.label}</span></td>
                    <td className="px-3 py-2.5 text-right">
                      <button onClick={() => doSeek(e.idx)} title="Locate on map" aria-label="Locate on map"
                        className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                        <MapPin size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 p-3 md:hidden">
            {evSlice.map(e => (
              <div key={e.idx} onClick={() => doSeek(e.idx)} className="rounded-xl border border-[var(--ap-border)] p-3 cursor-pointer active:scale-[0.99] transition-transform">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] text-slate-400 tabular-nums flex-1">{fmtDT(e.point.timestamp)}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${EV_STYLE[e.type]}`}>{e.label}</span>
                </div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate mt-1">{e.point.address || '—'}</p>
                <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">{Number(e.point.speed_kmh ?? 0).toFixed(0)} km/h · GPS {e.point.gps_online === true ? 'Valid' : 'Void'} · Ign {e.point.ignition === true ? 'ON' : 'OFF'}</p>
              </div>
            ))}
          </div>
          {evPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--ap-border)]">
              <p className="text-xs text-slate-400 tabular-nums">Page {evSafe} of {evPages}</p>
              <div className="flex items-center gap-1.5">
                <button disabled={evSafe <= 1} onClick={() => setEvPage(evSafe - 1)} aria-label="Previous"
                  className="w-7 h-7 rounded-lg border border-[var(--ap-border)] flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-[var(--ap-surface-2)] transition-colors"><ChevronLeft size={13} /></button>
                <button disabled={evSafe >= evPages} onClick={() => setEvPage(evSafe + 1)} aria-label="Next"
                  className="w-7 h-7 rounded-lg border border-[var(--ap-border)] flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-[var(--ap-surface-2)] transition-colors"><ChevronRight size={13} /></button>
              </div>
            </div>
          )}
        </div>
      )}

      {points.length > 0 && tab === 'playback' && (
        <ReplayControls
          playing={playing} speed={speed} currentIndex={currentIndex} total={points.length}
          currentPoint={currentPoint} onPlay={doPlay} onPause={doPause} onStop={doStop}
          onSeek={doSeek} onSpeedChange={setSpeed}
        />
      )}

      {points.length > 0 && tab === 'stops' && (
        <div className="ap-surface rounded-2xl p-4">
          <p className="text-sm font-bold text-slate-800 dark:text-white mb-2">Stops ({stops.length})</p>
          {stops.length === 0 ? <p className="text-xs text-slate-400 text-center py-6">No stops detected on this route.</p> : (
            <div className="space-y-2">
              {stops.map((s, i) => (
                <div key={i} onClick={() => seekToTs(s.startTs)} className="flex items-center gap-3 rounded-xl border border-[var(--ap-border)] p-3 cursor-pointer hover:bg-[var(--ap-surface-2)]/40 transition-colors">
                  <span className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs font-semibold flex items-center justify-center flex-shrink-0">P</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{s.address || 'Unnamed stop'}</p>
                    <p className="text-[10px] text-slate-400 tabular-nums">{fmtT(s.startTs)} → {fmtT(s.endTs)}</p>
                  </div>
                  <span className="text-xs font-semibold text-amber-500 tabular-nums flex-shrink-0">{formatDuration(s.durationSec)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {points.length > 0 && tab === 'summary' && (
        <div className="space-y-4">
          <TripStats stats={stats} />
          {trip && (
            <div className="ap-surface rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ['Booking', trip.bookingNo || '—'], ['Customer', trip.customer || '—'],
                ['Driver', trip.driver || '—'], ['Vehicle', trip.vehicle || '—'],
                ['Route', `${trip.pickup || '—'} → ${trip.drop || '—'}`], ['Fare', rs(trip.fare)],
                ['GPS Points', points.length], ['Status', trip.status || '—'],
              ].map(([l, v]) => (
                <div key={l} className="bg-[var(--ap-surface-2)] rounded-xl px-3 py-2.5">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide font-bold">{l}</p>
                  <p className="text-xs font-semibold text-slate-800 dark:text-white truncate mt-0.5">{v}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {points.length > 0 && tab === 'charts' && <SpeedCharts points={points} />}
    </div>
  )
}

// ── Timeline strip (start → en-route/stop segments → end) ──────
function TimelineStrip({ stats, stops, segments, onSeekTs, startSub, endSub }) {
  const sorted = [...(segments || [])].sort((a, b) => new Date(a.startTs) - new Date(b.startTs))
  const stopList = [...(stops || [])].sort((a, b) => new Date(a.startTs) - new Date(b.startTs))
  // Interleave: start, then per moving-segment an En Route node + its
  // following stop, then end. Durations all come from replay data.
  const nodes = [{ t: stats.startTs, label: 'Trip Started', color: '#10b981', ts: stats.startTs, sub: startSub }]
  sorted.forEach((seg, i) => {
    if ((seg.durationSec || 0) > 0 || (seg.distance || 0) > 0) {
      nodes.push({ t: seg.startTs, label: 'En Route', sub: formatDuration(seg.durationSec), color: '#3b82f6', ts: seg.startTs })
    }
    const st = stopList[i]
    if (st) {
      nodes.push({
        t: st.startTs, label: `Stop${st.durationSec ? ` · ${formatDuration(st.durationSec)}` : ''}`,
        sub: (st.address || '').split(',')[0], color: '#f59e0b', ts: st.startTs,
      })
    }
  })
  nodes.push({ t: stats.endTs, label: 'Trip Completed', color: '#ef4444', ts: stats.endTs, sub: endSub })
  return (
    <div className="ap-surface rounded-2xl px-5 py-4 overflow-x-auto">
      <div className="flex items-start min-w-[560px]">
        {nodes.map((n, i) => (
          <div key={i} className="flex-1 flex flex-col items-center relative">
            {i > 0 && <div className="absolute top-[7px] h-[3px] rounded-full bg-gradient-to-r from-blue-500 to-blue-400/70" style={{ width: '100%', left: '-50%' }} />}
            <button onClick={() => n.ts && onSeekTs(n.ts)} title={n.sub || n.label}
              className="w-3.5 h-3.5 rounded-full border-[3px] border-white border-[var(--ap-border)] relative z-10 flex-shrink-0"
              style={{ background: n.color, boxShadow: `0 0 10px ${n.color}` }} />
            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 mt-1.5 whitespace-nowrap">{n.label}</p>
            {n.sub ? <p className="text-[10px] text-slate-400 tabular-nums whitespace-nowrap">{n.sub}</p> : null}
            <p className="text-[10px] text-slate-400 tabular-nums whitespace-nowrap">{fmtT(n.t)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Speed + distance charts from real points ──
function SpeedCharts({ points }) {
  const W = 600, H = 150, PAD = 26
  const maxS = Math.max(...points.map(p => Number(p.speed_kmh ?? 0)), 1)
  const step = Math.max(1, Math.floor(points.length / 120))
  const series = points.filter((_, i) => i % step === 0)
  const X = (i) => series.length < 2 ? W / 2 : PAD + (i * (W - PAD * 2)) / (series.length - 1)
  const line = series.map((p, i) => `${i === 0 ? 'M' : 'L'}${X(i).toFixed(1)},${(H - PAD - (Number(p.speed_kmh ?? 0) / maxS) * (H - PAD * 2)).toFixed(1)}`).join(' ')
  // Hourly distance via speed integration
  const hours = Array.from({ length: 12 }, (_, i) => ({ x: `${String(i * 2).padStart(2, '0')}:00`, km: 0 }))
  const asc = [...points].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  for (let i = 1; i < asc.length; i++) {
    const ta = new Date(asc[i - 1].timestamp).getTime(), tb = new Date(asc[i].timestamp).getTime()
    const sa = Number(asc[i - 1].speed_kmh), sb = Number(asc[i].speed_kmh)
    if (!Number.isFinite(ta) || !Number.isFinite(tb) || tb <= ta || !Number.isFinite(sa) || !Number.isFinite(sb)) continue
    const h = new Date(tb).getHours()
    hours[Math.min(11, Math.floor(h / 2))].km += ((sa + sb) / 2) * ((tb - ta) / 3_600_000)
  }
  const maxH = Math.max(...hours.map(b => b.km), 0.01)
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="ap-surface rounded-2xl p-4">
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Speed Profile</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 150 }}>
          {[0.25, 0.5, 0.75].map(f => (
            <line key={f} x1={PAD} x2={W - 8} y1={H * f} y2={H * f} stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3 3" />
          ))}
          <path d={`${line} L${X(series.length - 1).toFixed(1)},${H - PAD} L${X(0).toFixed(1)},${H - PAD} Z`} fill="#3b82f6" fillOpacity="0.15" />
          <path d={line} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" />
        </svg>
        <p className="text-[10px] text-slate-400 mt-1">Speed (km/h) across {points.length} GPS points · peak {Math.round(maxS)} km/h</p>
      </div>
      <div className="ap-surface rounded-2xl p-4">
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Distance by Hour</p>
        <div className="flex items-end gap-1 h-32">
          {hours.map(b => (
            <div key={b.x} title={`${b.x}: ${b.km.toFixed(1)} km`} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
              <div className="w-full max-w-[26px] rounded-t bg-emerald-500" style={{ height: `${Math.max(3, b.km / maxH * 100)}%` }} />
              <span className="text-[8px] text-slate-400 tabular-nums">{b.x}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

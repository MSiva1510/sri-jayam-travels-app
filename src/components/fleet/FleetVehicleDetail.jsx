import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { History, LocateFixed, MapPin, Navigation, Truck, X } from 'lucide-react'
import Button from '../ui/Button'
import StatusPill from '../ui/StatusPill'
import { useAuth } from '../../context/AuthContext'
import { loadDrivers } from '../../data/driverData'
import { buildMapsUrl } from '../../utils/locationUtils'
import { FLEET_STATUSES, fmtDT, freshnessLabel, ignitionOn, vehStatus } from './fleetStatus'

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-[var(--ap-border)] last:border-0">
      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 text-right min-w-0 break-words">{value ?? '—'}</span>
    </div>
  )
}

function Group({ title, children }) {
  return (
    <section className="rounded-2xl ap-surface ap-hairline px-3.5 py-2">
      <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500 mb-1">
        {title}
      </h3>
      {children}
    </section>
  )
}

const hasNumber = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v))

function VehicleDetailPanel({ snapshot, onClose, onLocate, onHistory }) {
  const closeRef = useRef(null)
  const [driverPhone, setDriverPhone] = useState(null)
  const { user } = useAuth() || {}
  const canViewContact = user?.role === 'admin' || user?.role === 'manager'

  const status = FLEET_STATUSES[vehStatus(snapshot)] || FLEET_STATUSES.offline
  const hasCoords = hasNumber(snapshot.latitude) && hasNumber(snapshot.longitude)
  const mapsUrl = hasCoords
    ? buildMapsUrl('', `${snapshot.latitude},${snapshot.longitude}`)
    : null
  const gpsText = snapshot.gps_online === true
    ? 'Active'
    : snapshot.gps_online === false ? 'Unavailable' : 'Not reported'
  const ignitionText = snapshot.ignition == null
    ? '—'
    : ignitionOn(snapshot.ignition) ? 'ON' : 'OFF'

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  useEffect(() => {
    if (!canViewContact) return undefined
    let live = true
    const id = snapshot.driver_id
    const name = String(snapshot.driver_name || '').trim().toLowerCase()
    loadDrivers().then(drivers => {
      if (!live || !Array.isArray(drivers)) return
      const match = drivers.find(d =>
        (id != null && (String(d.id) === String(id) || String(d.driver_id) === String(id))) ||
        (name && String(d.name || '').trim().toLowerCase() === name)
      )
      setDriverPhone(match?.phone || null)
    }).catch(() => setDriverPhone(null))
    return () => { live = false }
  }, [canViewContact, snapshot.driver_id, snapshot.driver_name])

  const locate = () => {
    onLocate?.({ ...snapshot })
    onClose?.()
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-[100] bg-slate-950/45 backdrop-blur-[2px] animate-fade-up" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="fleet-vehicle-title"
        className="fixed inset-x-0 bottom-0 z-[101] flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl ap-surface ap-hairline shadow-2xl animate-fade-up sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[420px] sm:rounded-l-3xl sm:rounded-tr-none"
      >
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--ap-border)] flex-shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-300 flex items-center justify-center flex-shrink-0">
              <Truck size={19} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h2 id="fleet-vehicle-title" className="text-base font-sf font-semibold text-slate-900 dark:text-white truncate">
                {snapshot.registration || snapshot.vehicle_id?.slice(0, 8) || 'Vehicle'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {snapshot.vehicle_model || snapshot.model || 'Vehicle details'}
              </p>
              <div className="mt-2">
                <StatusPill tone={status.tone}>{status.label}</StatusPill>
              </div>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close vehicle details"
            className="ap-focus w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-500/10 dark:hover:bg-white/10 flex-shrink-0"
          >
            <X size={17} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <Group title="Current status">
            <Row label="Speed" value={`${Number(snapshot.speed_kmh ?? 0).toFixed(1)} km/h`} />
            <Row label="GPS connection" value={gpsText} />
            <Row label="Last update" value={freshnessLabel(snapshot)} />
            <Row label="Updated at" value={fmtDT(snapshot.timestamp)} />
          </Group>

          <Group title="Location">
            <Row label="Current address" value={snapshot.address || '—'} />
            <Row
              label="Coordinates"
              value={hasCoords ? `${Number(snapshot.latitude).toFixed(5)}, ${Number(snapshot.longitude).toFixed(5)}` : 'Not available'}
            />
          </Group>

          <Group title="Driver">
            <Row label="Name" value={snapshot.driver_name || 'Unassigned'} />
            {canViewContact && driverPhone && <Row label="Contact" value={driverPhone} />}
          </Group>

          <Group title="Vehicle">
            <Row label="Type" value={snapshot.vehicle_type || snapshot.type || '—'} />
            {snapshot.imei && <Row label="IMEI" value={<span className="font-mono text-[11px]">{snapshot.imei}</span>} />}
          </Group>

          <Group title="Telemetry">
            <Row label="Odometer" value={hasNumber(snapshot.odometer) ? `${Number(snapshot.odometer).toFixed(1)} km` : null} />
            <Row label="Ignition" value={ignitionText} />
            <Row label="Bearing" value={hasNumber(snapshot.bearing) ? `${Number(snapshot.bearing).toFixed(0)}°` : null} />
            <Row label="GPS accuracy" value={hasNumber(snapshot.accuracy) ? `±${Number(snapshot.accuracy).toFixed(0)} m` : null} />
          </Group>
        </div>

        <footer className="flex-shrink-0 border-t border-[var(--ap-border)] p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button type="button" variant="primary" size="sm" icon={LocateFixed} onClick={locate} disabled={!hasCoords}>
              Locate on Map
            </Button>
            <Button type="button" variant="outline" size="sm" icon={History} onClick={onHistory} disabled={!onHistory}>
              GPS History
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={MapPin}
              disabled={!mapsUrl}
              onClick={() => mapsUrl && window.open(mapsUrl, '_blank', 'noopener,noreferrer')}
            >
              Open in Maps
            </Button>
          </div>
          <p className="mt-2 flex items-center justify-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
            <Navigation size={10} aria-hidden="true" /> Map actions use the latest GPS fix only.
          </p>
        </footer>
      </aside>
    </>,
    document.body
  )
}

export default function FleetVehicleDetail({ snapshot, onClose, onLocate, onHistory }) {
  if (!snapshot) return null
  return <VehicleDetailPanel snapshot={snapshot} onClose={onClose} onLocate={onLocate} onHistory={onHistory} />
}

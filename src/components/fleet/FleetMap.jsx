// ─── Fleet Map ────────────────────────────────────────────────
// Leaflet map (OSM tiles, CartoDB Dark in dark mode) with one
// car marker per vehicle, coloured by status (green moving, blue idle,
// red stopped, grey offline) and rotated to its bearing. Click a marker
// → opens the detail panel.

import { useMemo, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Maximize2 } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { makeCarIcon, carStatusOf, CAR_STATUS_COLORS } from './carIcon'

const LIGHT_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const DARK_TILES  = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'

const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'

const statusOf = carStatusOf

// Helper child to expose a fitBounds control
function FitBoundsControl({ snapshots }) {
  const map = useMap()
  const fit = () => {
    const pts = snapshots
      .filter(s => Number.isFinite(s.latitude) && Number.isFinite(s.longitude))
      .map(s => [s.latitude, s.longitude])
    if (pts.length === 0) return
    if (pts.length === 1) {
      map.setView(pts[0], 13)
    } else {
      map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 })
    }
  }
  return (
    <button
      onClick={fit}
      className="absolute right-3 bottom-3 z-[400] px-3 py-2 text-xs font-semibold rounded-xl
                 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-200
                 border border-slate-200 dark:border-navy-700 shadow
                 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors
                 flex items-center gap-1.5"
    >
      <Maximize2 size={12} /> Fit all
    </button>
  )
}

export default function FleetMap({ snapshots = [], onSelect }) {
  const { darkMode } = useApp()
  const centre = useMemo(() => {
    const pts = snapshots
      .filter(s => Number.isFinite(s.latitude) && Number.isFinite(s.longitude))
      .map(s => [s.latitude, s.longitude])
    if (!pts.length) return [11.9416, 79.8083] // Puducherry
    const lat = pts.reduce((a, [x]) => a + x, 0) / pts.length
    const lng = pts.reduce((a, [, y]) => a + y, 0) / pts.length
    return [lat, lng]
  }, [snapshots])

  // react-leaflet v4 + StrictMode mount guard
  const containerRef = useRef(null)

  return (
    <div ref={containerRef} className="glass-card rounded-2xl overflow-hidden h-[500px] relative">
      <MapContainer
        center={centre}
        zoom={11}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          key={darkMode ? 'dark' : 'light'}
          url={darkMode ? DARK_TILES : LIGHT_TILES}
          attribution={ATTRIBUTION}
          maxZoom={19}
        />
        {snapshots.map(s => {
          if (!Number.isFinite(s.latitude) || !Number.isFinite(s.longitude)) return null
          const status = statusOf(s)
          return (
            <Marker
              key={s.id}
              position={[s.latitude, s.longitude]}
              icon={makeCarIcon(status, s.bearing ?? 0)}
              eventHandlers={{ click: () => onSelect?.(s) }}
            >
              <Popup>
                <div className="text-xs space-y-1">
                  <p className="font-bold text-sm">
                    {s.registration || s.vehicle_id?.slice(0, 8)}
                  </p>
                  <p>
                    <span className="font-semibold" style={{ color: CAR_STATUS_COLORS[status].body }}>
                      {CAR_STATUS_COLORS[status].label}
                    </span>
                    {' · '}{Number(s.speed_kmh ?? 0).toFixed(0)} km/h
                    {s.ignition != null && <> · ignition {s.ignition ? 'ON' : 'OFF'}</>}
                  </p>
                  <p>{s.address || '—'}</p>
                  <p className="text-slate-500">
                    {s.timestamp ? new Date(s.timestamp).toLocaleTimeString() : '—'}
                  </p>
                </div>
              </Popup>
            </Marker>
          )
        })}
        <FitBoundsControl snapshots={snapshots} />
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-[400] flex gap-3 rounded-xl bg-white/90 dark:bg-navy-900/90 backdrop-blur px-3 py-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300 shadow">
        {Object.entries(CAR_STATUS_COLORS).map(([k, c]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: c.body }} />
            {c.label}
          </span>
        ))}
      </div>
    </div>
  )
}
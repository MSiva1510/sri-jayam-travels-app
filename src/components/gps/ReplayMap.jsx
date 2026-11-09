// ─── Replay Map ───────────────────────────────────────────────
// Day 33: Leaflet map for Route Replay.
// Reuses tile layers from FleetMap; adds Polyline + animated marker.
// Props:
//   points       – full GPS track array
//   currentIndex – which point to show the animated marker on
//   coloredPath  – [{ positions, color, type }] for polyline segments
//   darkMode     – bool from AppContext

import { useEffect, useRef, useMemo, memo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Maximize2 } from 'lucide-react'

// Keyless OSM tiles in both themes (CARTO dark_all now needs an API
// key); dark mode restyles tiles via the shared fleet-map-dark CSS.
const TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

// ── Icon factories ────────────────────────────────────────────
function makeCurrentIcon(speed) {
  const color  = speed > 5 ? '#10b981' : '#f59e0b'
  const pulsed = speed > 5
  return L.divIcon({
    className: 'replay-current',
    html: `<div style="position:relative;width:20px;height:20px;">
      <div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:0.2;${pulsed ? 'animation:pulse 1.5s infinite;' : ''}"></div>
      <div style="position:absolute;top:4px;left:4px;width:12px;height:12px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.5);"></div>
    </div>`,
    iconSize: [20, 20], iconAnchor: [10, 10], popupAnchor: [0, -12],
  })
}

function makeEndpointIcon(type) {
  const cfg = type === 'start'
    ? { bg: '#22c55e' }
    : type === 'stop'
      ? { bg: '#f59e0b' }
      : { bg: '#ef4444' }
  if (type === 'stop') {
    return L.divIcon({
      className: 'replay-endpoint',
      html: `<div style="width:22px;height:22px;border-radius:50%;background:${cfg.bg};border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;color:white;">P</div>`,
      iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -13],
    })
  }
  // Teardrop pin
  return L.divIcon({
    className: 'replay-endpoint',
    html: `<div style="width:26px;height:36px;position:relative;">
      <div style="width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${cfg.bg};border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.45);"></div>
    </div>`,
    iconSize: [26, 36], iconAnchor: [13, 34], popupAnchor: [0, -30],
  })
}

function makePlaceLabel(text) {
  return L.divIcon({
    className: 'replay-place-label',
    html: `<div style="background:rgba(2,6,23,0.85);color:#fff;font-size:11px;font-weight:800;padding:2px 8px;border-radius:8px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.4);">${text}</div>`,
    iconSize: [0, 0], iconAnchor: [-14, 10],
  })
}

// ── Auto-fit bounds helper ────────────────────────────────────
// Re-runs whenever the track identity changes (trip switch) so the map
// always moves to the current customer route — not just on mount.
function FitBounds({ points, trackKey }) {
  const map = useMap()
  useEffect(() => {
    const valid = points.filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
    if (!valid.length) return
    if (valid.length === 1) { map.setView([valid[0].latitude, valid[0].longitude], 14); return }
    const lats = valid.map(p => p.latitude), lngs = valid.map(p => p.longitude)
    map.fitBounds([[Math.min(...lats), Math.min(...lngs)],[Math.max(...lats), Math.max(...lngs)]], { padding: [12, 12], maxZoom: 16 })
  }, [trackKey]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

// ── Fit-all button ────────────────────────────────────────────
function FitAllButton({ points }) {
  const map = useMap()
  const fit = () => {
    const valid = points.filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
    if (!valid.length) return
    if (valid.length === 1) { map.setView([valid[0].latitude, valid[0].longitude], 14); return }
    const lats = valid.map(p => p.latitude), lngs = valid.map(p => p.longitude)
    map.fitBounds([[Math.min(...lats), Math.min(...lngs)],[Math.max(...lats), Math.max(...lngs)]], { padding: [12, 12] })
  }
  return (
    <button onClick={fit}
      className="absolute right-3 bottom-3 z-[400] px-3 py-2 text-xs font-semibold rounded-xl bg-[var(--ap-surface-2)] text-slate-700 dark:text-slate-200 border border-[var(--ap-border)] shadow hover:bg-[var(--ap-surface-2)] transition-colors flex items-center gap-1.5">
      <Maximize2 size={12} /> Fit route
    </button>
  )
}

// ── Moving marker synced to currentIndex ──────────────────────
function AnimatedMarker({ points, currentIndex }) {
  const markerRef = useRef(null)
  const map = useMap()

  const current = points[currentIndex]
  useEffect(() => {
    if (!current || !markerRef.current) return
    const ll = [current.latitude, current.longitude]
    markerRef.current.setLatLng(ll)
    markerRef.current.setIcon(makeCurrentIcon(Number(current.speed_kmh ?? 0)))
    // Pan map to keep marker visible (soft pan, not re-centre)
    const bounds = map.getBounds()
    if (!bounds.contains(ll)) map.panTo(ll, { animate: true, duration: 0.5 })
  }, [currentIndex, current, map])

  if (!current || !Number.isFinite(current.latitude)) return null

  return (
    <Marker
      position={[current.latitude, current.longitude]}
      icon={makeCurrentIcon(Number(current.speed_kmh ?? 0))}
      ref={markerRef}
    >
      <Popup>
        <div className="text-xs space-y-1 min-w-[140px]">
          <p className="font-bold">{new Date(current.timestamp).toLocaleTimeString()}</p>
          <p>{Number(current.speed_kmh ?? 0).toFixed(0)} km/h</p>
          {current.address && <p className="text-slate-500 truncate max-w-[180px]">{current.address}</p>}
        </div>
      </Popup>
    </Marker>
  )
}

// ── Main export ───────────────────────────────────────────────
// fallbackLine {positions:[[lat,lng]…], fromLabel, toLabel}: dashed
// estimated route for trips without GPS. stops [{lat,lng,…}]: amber pins.
const ReplayMap = memo(function ReplayMap({ points = [], currentIndex = 0, coloredPath = [], darkMode = false, fallbackLine = null, stops = [], height = 500 }) {
  const first = points[0]
  const last  = points[points.length - 1]
  const fbPts = (fallbackLine?.positions || []).filter(p => Number.isFinite(p?.[0]) && Number.isFinite(p?.[1]))
  const fbFit = fbPts.map(([lat, lng]) => ({ latitude: lat, longitude: lng }))

  const centre = useMemo(() => {
    if (first) return [first.latitude, first.longitude]
    if (fbPts.length) return fbPts[0]
    return [11.9416, 79.8083]  // Puducherry default
  }, [first]) // eslint-disable-line react-hooks/exhaustive-deps

  const hasTrack = points.length > 1

  return (
    <div className={`ap-surface rounded-2xl overflow-hidden relative ${darkMode ? 'fleet-map-dark' : ''}`} style={{ height }}>
      <MapContainer center={centre} zoom={12} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url={TILES}
          attribution={ATTRIBUTION}
          maxZoom={19}
        />

        {/* Auto-fit on load + every track change */}
        {hasTrack && <FitBounds points={points} trackKey={points.length ? `${points[0].timestamp}-${points.length}` : 'empty'} />}
        {!hasTrack && fbFit.length > 0 && <FitBounds points={fbFit} trackKey={`fb-${fbFit.length}-${(fallbackLine?.fromLabel || '')}-${(fallbackLine?.toLabel || '')}`} />}

        {/* Route polyline — one Polyline per segment for colour variation */}
        {coloredPath.map((seg, i) => (
          <Polyline
            key={i}
            positions={seg.positions}
            pathOptions={{ color: seg.color, weight: 4, opacity: 0.85 }}
          />
        ))}

        {/* Estimated route (no GPS): solid green line + teardrop pins + labels */}
        {!hasTrack && fbPts.length > 1 && (
          <Polyline positions={fbPts} pathOptions={{ color: '#10b981', weight: 4, opacity: 0.95 }} />
        )}
        {!hasTrack && fbPts.length > 0 && (<>
          <Marker position={fbPts[0]} icon={makeEndpointIcon('start')} zIndexOffset={500}>
            <Popup><div className="text-xs"><p className="font-bold text-emerald-600">From (estimated)</p><p>{fallbackLine.fromLabel}</p></div></Popup>
          </Marker>
          <Marker position={fbPts[0]} icon={makePlaceLabel(fallbackLine.fromLabel?.split(',')[0] || 'Start')} interactive={false} keyboard={false} />
        </>)}
        {!hasTrack && fbPts.length > 1 && (<>
          <Marker position={fbPts[fbPts.length - 1]} icon={makeEndpointIcon('end')} zIndexOffset={500}>
            <Popup><div className="text-xs"><p className="font-bold text-red-600">To (estimated)</p><p>{fallbackLine.toLabel}</p></div></Popup>
          </Marker>
          <Marker position={fbPts[fbPts.length - 1]} icon={makePlaceLabel(fallbackLine.toLabel?.split(',')[0] || 'End')} interactive={false} keyboard={false} />
        </>)}
        {/* Waypoint dots along the estimated route */}
        {!hasTrack && fbPts.length > 30 && fbPts.filter((_, i) => i % Math.ceil(fbPts.length / 30) === 0).map((p, i) => (
          <CircleMarker key={i} center={p} radius={3.5} pathOptions={{ color: '#10b981', weight: 2, fillColor: '#10b981', fillOpacity: 1 }} />
        ))}

        {/* Waypoint dots along the GPS track */}
        {hasTrack && points.length > 30 && points.filter((_, i) => i % Math.ceil(points.length / 30) === 0).map((p, i) => (
          Number.isFinite(p.latitude) && (
            <CircleMarker key={i} center={[p.latitude, p.longitude]} radius={3.5}
              pathOptions={{ color: '#10b981', weight: 2, fillColor: '#10b981', fillOpacity: 1 }} />
          )
        ))}

        {/* Start marker */}
        {first && Number.isFinite(first.latitude) && (<>
          <Marker position={[first.latitude, first.longitude]} icon={makeEndpointIcon('start')} zIndexOffset={500}>
            <Popup><div className="text-xs"><p className="font-bold text-emerald-600">Trip Start</p><p>{new Date(first.timestamp).toLocaleString()}</p></div></Popup>
          </Marker>
          <Marker position={[first.latitude, first.longitude]} icon={makePlaceLabel((first.address || 'Start').split(',')[0])} interactive={false} keyboard={false} />
        </>)}

        {/* End marker (only if we have > 1 point) */}
        {last && last !== first && Number.isFinite(last.latitude) && (<>
          <Marker position={[last.latitude, last.longitude]} icon={makeEndpointIcon('end')} zIndexOffset={500}>
            <Popup><div className="text-xs"><p className="font-bold text-red-600">Trip End</p><p>{new Date(last.timestamp).toLocaleString()}</p></div></Popup>
          </Marker>
          <Marker position={[last.latitude, last.longitude]} icon={makePlaceLabel((last.address || 'End').split(',')[0])} interactive={false} keyboard={false} />
        </>)}

        {/* Stop pins */}
        {stops.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng)).map((s, i) => (
          <Marker key={i} position={[s.lat, s.lng]} icon={makeEndpointIcon('stop')}>
            <Popup><div className="text-xs">
              <p className="font-bold text-amber-600">Stop {s.durationSec ? `· ${Math.round(s.durationSec / 60)}m` : ''}</p>
              <p>{s.address || '—'}</p>
              <p className="text-slate-500">{s.startTs ? new Date(s.startTs).toLocaleTimeString() : ''}</p>
            </div></Popup>
          </Marker>
        ))}

        {/* Animated current-position marker */}
        {hasTrack && <AnimatedMarker points={points} currentIndex={currentIndex} />}

        <FitAllButton points={hasTrack ? points : fbFit} />
      </MapContainer>

      {/* Legend */}
      <div className="absolute top-3 left-3 z-[400] flex flex-col gap-1 bg-white/90 dark:bg-[var(--ap-surface)]/90 rounded-xl px-3 py-2 shadow text-[10px] font-bold border border-[var(--ap-border)]">
        {[['#10b981','Moving'],['#f59e0b','Idle'],['#94a3b8','Stopped']].map(([c, l]) => (
          <span key={l} className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
            <span style={{ background: c }} className="w-3 h-2 rounded-sm inline-block" />{l}
          </span>
        ))}
      </div>
    </div>
  )
})

export default ReplayMap

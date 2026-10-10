// ─── Fleet Map (MapLibre) ───────────────────────────────────────
// Open-source tiles with real light + dark themes (no API key):
//   light → OpenFreeMap "liberty"  ·  dark → OpenFreeMap "dark"
//   satellite → keyless Esri World Imagery.
// One small car marker per vehicle (rotated to bearing, white reg
// label), click → detail panel. Markers ease toward live fixes via
// rAF so motion looks continuous instead of jumpy.

import { useEffect, useMemo, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Maximize2 } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { carSvg, carStatusOf, CAR_STATUS_COLORS } from './carIcon'

const STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/liberty'
const STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark'
const OSM_FALLBACK = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
}
const SAT_STYLE = {
  version: 8,
  sources: {
    esri: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'Imagery © Esri',
    },
  },
  layers: [{ id: 'esri', type: 'raster', source: 'esri' }],
}

const statusOf = carStatusOf
const MARKER_SIZE = 18

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function popupHtml(s, status) {
  const speed = Number(s.speed_kmh ?? 0)
  return `<div style="font-size:12px;line-height:1.5;min-width:150px">
    <div style="font-weight:800;font-size:13px">${esc(s.registration || '—')}</div>
    <div><b style="color:${CAR_STATUS_COLORS[status].body}">${CAR_STATUS_COLORS[status].label}</b> · ${speed.toFixed(0)} km/h${s.ignition != null ? ` · ignition ${s.ignition ? 'ON' : 'OFF'}` : ''}</div>
    <div style="color:#64748b">${esc(s.address || '—')}</div>
    <div style="color:#94a3b8">${s.timestamp ? esc(new Date(s.timestamp).toLocaleTimeString()) : '—'}</div>
  </div>`
}

export default function FleetMap({ snapshots = [], onSelect, layer = 'map', locateTarget, height = 500 }) {
  const { darkMode } = useApp()
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef(new Map()) // id -> { marker, el, carEl, spdEl, status, cur, target }
  const latestRef = useRef(new Map())
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const [styleFailed, setStyleFailed] = useState(false)

  const styleUrl = layer === 'satellite' ? SAT_STYLE : darkMode ? STYLE_DARK : STYLE_LIGHT

  const centre = useMemo(() => {
    const pts = snapshots
      .filter(s => Number.isFinite(s.latitude) && Number.isFinite(s.longitude))
      .map(s => [s.longitude, s.latitude])
    if (!pts.length) return [79.8083, 11.9416] // Puducherry [lng, lat]
    return [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length]
  }, [snapshots])

  latestRef.current = useMemo(() => new Map(snapshots.map(s => [s.id, s])), [snapshots])

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: centre,
      zoom: 11,
      attributionControl: { compact: true },
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left')
    map.on('error', () => setStyleFailed(true))
    mapRef.current = map
    return () => {
      markersRef.current.forEach(m => m.marker.remove())
      markersRef.current.clear()
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fallback to OSM raster if the vector style fails to load
  const fellBack = useRef(false)
  useEffect(() => {
    if (styleFailed && !fellBack.current && mapRef.current) {
      fellBack.current = true
      try { mapRef.current.setStyle(OSM_FALLBACK) } catch {}
    }
  }, [styleFailed])

  // Switch light / dark / satellite styles (markers persist)
  useEffect(() => {
    if (mapRef.current && !fellBack.current) {
      try { mapRef.current.setStyle(styleUrl) } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer, darkMode])

  // Sync markers with snapshots (create / update targets, never jump)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const seen = new Set()
    const popup = new maplibregl.Popup({ offset: 18, closeButton: false })
    snapshots.forEach(s => {
      if (!Number.isFinite(s.latitude) || !Number.isFinite(s.longitude)) return
      seen.add(s.id)
      const status = statusOf(s)
      const speed = Number(s.speed_kmh ?? 0)
      const bearing = Number.isFinite(Number(s.bearing)) ? Number(s.bearing) : 0
      let rec = markersRef.current.get(s.id)
      if (!rec) {
        const el = document.createElement('div')
        el.className = 'fleet-ml-marker'
        el.innerHTML =
          `<div class="fleet-ml-label"><span class="fleet-ml-reg">${esc(s.registration || '—')}</span>` +
          `<span class="fleet-ml-spd">${speed > 0 ? `${speed.toFixed(0)} km/h` : 'Stopped'}</span></div>` +
          `<div class="fleet-ml-car" style="width:${MARKER_SIZE}px;height:${MARKER_SIZE * 2}px">${carSvg(status, MARKER_SIZE)}</div>`
        const carEl = el.querySelector('.fleet-ml-car')
        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([s.longitude, s.latitude])
          .addTo(map)
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          popup.setLngLat([s.longitude, s.latitude]).setHTML(popupHtml(latestRef.current.get(s.id) || s, statusOf(latestRef.current.get(s.id) || s))).addTo(map)
          onSelectRef.current?.(s)
        })
        rec = { marker, el, carEl, spdEl: el.querySelector('.fleet-ml-spd'), status, cur: { lng: s.longitude, lat: s.latitude }, target: { lng: s.longitude, lat: s.latitude } }
        markersRef.current.set(s.id, rec)
      } else {
        rec.target = { lng: s.longitude, lat: s.latitude }
        if (rec.status !== status) {
          rec.status = status
          rec.carEl.innerHTML = carSvg(status, MARKER_SIZE)
        }
        if (rec.spdEl) {
          const txt = speed > 0 ? `${speed.toFixed(0)} km/h` : 'Stopped'
          if (rec.spdEl.textContent !== txt) rec.spdEl.textContent = txt
          rec.spdEl.style.color = speed > 0 ? '#34d399' : '#fbbf24'
        }
        if (rec.carEl) rec.carEl.style.transform = `rotate(${bearing}deg)`
      }
    })
    // Remove markers for vehicles no longer present
    markersRef.current.forEach((rec, id) => {
      if (!seen.has(id)) { rec.marker.remove(); markersRef.current.delete(id) }
    })
  }, [snapshots])

  // Ease markers toward live fixes (continuous motion, no overshoot)
  useEffect(() => {
    let raf = 0
    const step = () => {
      markersRef.current.forEach(rec => {
        const dx = rec.target.lng - rec.cur.lng
        const dy = rec.target.lat - rec.cur.lat
        if (Math.abs(dx) < 1e-7 && Math.abs(dy) < 1e-7) return
        rec.cur.lng += dx * 0.12
        rec.cur.lat += dy * 0.12
        rec.marker.setLngLat([rec.cur.lng, rec.cur.lat])
      })
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Locate a vehicle from the side panel
  const locateRef = useRef(null)
  useEffect(() => {
    const t = locateTarget
    const map = mapRef.current
    if (t && map && Number.isFinite(t.latitude) && Number.isFinite(t.longitude) && t !== locateRef.current) {
      locateRef.current = t
      map.flyTo({ center: [t.longitude, t.latitude], zoom: Math.max(map.getZoom(), 14), duration: 1200 })
    }
  }, [locateTarget])

  const fitAll = () => {
    const map = mapRef.current
    if (!map) return
    const pts = snapshots
      .filter(s => Number.isFinite(s.latitude) && Number.isFinite(s.longitude))
      .map(s => [s.longitude, s.latitude])
    if (!pts.length) return
    if (pts.length === 1) map.flyTo({ center: pts[0], zoom: 13 })
    else {
      const b = pts.reduce((bb, p) => bb.extend(p), new maplibregl.LngLatBounds(pts[0], pts[0]))
      map.fitBounds(b, { padding: 50, maxZoom: 15, duration: 1200 })
    }
  }

  return (
    <div className="ap-surface rounded-2xl overflow-hidden relative" style={{ height }}>
      <div ref={containerRef} className="w-full h-full" />
      <button
        onClick={fitAll}
        title="Zoom out to show all vehicles"
        className="absolute right-3 top-3 z-10 px-3 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition-colors active:scale-95 flex items-center gap-1.5 tabular-nums"
      >
        <Maximize2 size={12} /> Show all ({snapshots.filter(s => Number.isFinite(s.latitude) && Number.isFinite(s.longitude)).length})
      </button>
      <div className="absolute bottom-3 left-3 z-10 flex gap-3 rounded-xl bg-white/90 dark:bg-[var(--ap-surface)]/90 backdrop-blur px-3 py-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300 shadow">
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

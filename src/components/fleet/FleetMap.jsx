// ─── Fleet Map (MapLibre) ───────────────────────────────────────
// Keyless Esri raster tiles. The basemap follows the app theme:
// light → street map, dark → dark grey canvas. One small car marker
// per vehicle (rotated to bearing, white reg label), click → detail
// panel. Markers ease toward live fixes via rAF so motion looks
// continuous instead of jumpy.

import { useEffect, useMemo, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Maximize2 } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { snapPoint } from '../../utils/snapToRoad'
import { carSvg, carStatusOf, CAR_STATUS_COLORS } from './carIcon'
import { isRecent, MAP_STATUSES, speedText } from './fleetStatus'

const LIGHT_STYLE = {
  version: 8,
  sources: {
    esriStreet: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© Esri',
    },
  },
  layers: [{ id: 'esri-street', type: 'raster', source: 'esriStreet' }],
}
const DARK_STYLE = {
  version: 8,
  sources: {
    esriDark: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 16,
      attribution: '© Esri',
    },
    esriDarkLabels: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 16,
    },
  },
  layers: [
    { id: 'esri-dark', type: 'raster', source: 'esriDark' },
    { id: 'esri-dark-labels', type: 'raster', source: 'esriDarkLabels' },
  ],
}

const statusOf = carStatusOf
const MARKER_SIZE = 18
// Below this zoom, nearby vehicles collapse into numbered clusters. At
// street level every vehicle stays individual and labels are de-collided.
const CLUSTER_MAX_ZOOM = 12
const CLUSTER_DISTANCE_PX = 72

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function markerSpeedText(s) {
  if (!isRecent(s)) return 'No GPS'
  const speed = Number(s.speed_kmh ?? 0)
  return speed > 0 ? `${speed.toFixed(0)} km/h` : 'Stopped'
}

function popupHtml(s, status) {
  const model = s.vehicle_model || s.model || 'Vehicle'
  const driver = s.driver_name || 'Unassigned'
  return `<div style="font-size:12px;line-height:1.5;min-width:170px">
    <div style="font-weight:800;font-size:13px">${esc(s.registration || '—')}</div>
    <div style="color:#475569">${esc(model)} · ${esc(driver)}</div>
    <div><b style="color:${CAR_STATUS_COLORS[status].body}">${CAR_STATUS_COLORS[status].label}</b> · ${speedText(s)}${s.ignition != null ? ` · ignition ${s.ignition ? 'ON' : 'OFF'}` : ''}</div>
    <div style="color:#64748b">${esc(s.address || '—')}</div>
    <div style="color:#94a3b8">${s.timestamp ? esc(new Date(s.timestamp).toLocaleTimeString()) : '—'}</div>
  </div>`
}

export default function FleetMap({
  snapshots = [], onSelect, locateTarget, height = 500, snapToRoad = false,
  selectedId = null, focusIds = null,
}) {
  const { darkMode } = useApp() || {}
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef(new Map()) // id -> { marker, el, carEl, spdEl, status, cur, target }
  const snapCacheRef = useRef(new Map()) // "lat,lng" @5dp -> { lat, lng } snapped road point
  const latestRef = useRef(new Map())
  const popupRef = useRef(null)
  const relayoutLabelsRef = useRef(null)
  const labelRafRef = useRef(0)
  const syncClustersRef = useRef(null)
  const clusterRafRef = useRef(0)
  const clustersRef = useRef(new Map())
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const styleSpec = darkMode ? DARK_STYLE : LIGHT_STYLE
  const activeStyleRef = useRef(styleSpec)

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
      style: styleSpec,
      center: centre,
      zoom: 11,
      attributionControl: false,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left')
    mapRef.current = map
    const onMove = () => {
      if (labelRafRef.current) cancelAnimationFrame(labelRafRef.current)
      if (clusterRafRef.current) cancelAnimationFrame(clusterRafRef.current)
      labelRafRef.current = requestAnimationFrame(() => relayoutLabelsRef.current?.())
      clusterRafRef.current = requestAnimationFrame(() => syncClustersRef.current?.())
    }
    map.on('move', onMove)
    return () => {
      map.off('move', onMove)
      if (labelRafRef.current) cancelAnimationFrame(labelRafRef.current)
      if (clusterRafRef.current) cancelAnimationFrame(clusterRafRef.current)
      clustersRef.current.forEach(c => c.marker.remove())
      clustersRef.current.clear()
      markersRef.current.forEach(m => m.marker.remove())
      markersRef.current.clear()
      popupRef.current?.remove()
      popupRef.current = null
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Follow the app theme. Markers are DOM overlays, so setStyle keeps them.
  useEffect(() => {
    const map = mapRef.current
    if (!map || activeStyleRef.current === styleSpec) return
    activeStyleRef.current = styleSpec
    try { map.setStyle(styleSpec) } catch {}
  }, [styleSpec])

  // Cluster close neighbours while zoomed out. Individual markers are only
  // hidden; the MapLibre instance and their DOM nodes are kept intact so
  // live updates, selection and filtering remain instantaneous.
  const syncClusters = () => {
    const map = mapRef.current
    if (!map) return
    const shouldCluster = !focusIds && snapshots.length > 1 && map.getZoom() < CLUSTER_MAX_ZOOM
    if (!shouldCluster) {
      clustersRef.current.forEach(c => c.marker.remove())
      clustersRef.current.clear()
      markersRef.current.forEach(rec => { rec.el.style.display = '' })
      relayoutLabelsRef.current?.()
      return
    }

    const projected = snapshots
      .filter(s => Number.isFinite(s.latitude) && Number.isFinite(s.longitude))
      .map(s => ({ s, p: map.project([s.longitude, s.latitude]) }))
    const selectedPoint = projected.find(({ s }) => selectedId != null && String(s.id) === String(selectedId))?.p

    const groups = []
    projected.forEach(({ s, p }) => {
      // The selected vehicle always stays individually visible.
      if (selectedPoint && Math.hypot(selectedPoint.x - p.x, selectedPoint.y - p.y) <= CLUSTER_DISTANCE_PX) {
        groups.push({ items: [{ s, p }], centroid: p })
        return
      }
      const hit = groups.find(g => Math.hypot(g.centroid.x - p.x, g.centroid.y - p.y) <= CLUSTER_DISTANCE_PX)
      if (!hit) {
        groups.push({ items: [{ s, p }], centroid: p })
        return
      }
      hit.items.push({ s, p })
      hit.centroid = {
        x: hit.items.reduce((sum, i) => sum + i.p.x, 0) / hit.items.length,
        y: hit.items.reduce((sum, i) => sum + i.p.y, 0) / hit.items.length,
      }
    })

    const nextClustered = new Set()
    const nextKeys = new Set()
    groups.filter(g => g.items.length > 1).forEach((g) => {
      const key = g.items.map(i => String(i.s.id)).sort().join('|')
      nextKeys.add(key)
      const counts = {}
      g.items.forEach(({ s }) => { const k = statusOf(s); counts[k] = (counts[k] || 0) + 1 })
      const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
      const lngLat = map.unproject([g.centroid.x, g.centroid.y])

      let rec = clustersRef.current.get(key)
      if (!rec) {
        const el = document.createElement('div')
        el.className = 'fleet-ml-cluster'
        el.setAttribute('role', 'button')
        el.setAttribute('tabindex', '0')
        const zoomIn = (e) => {
          e?.stopPropagation?.()
          const pts = (rec.items || []).map(i => [i.s.longitude, i.s.latitude])
          if (!pts.length) return
          if (pts.length === 1) map.flyTo({ center: pts[0], zoom: Math.max(map.getZoom() + 2, 14), duration: 900 })
          else {
            const bounds = pts.reduce((b, pt) => b.extend(pt), new maplibregl.LngLatBounds(pts[0], pts[0]))
            map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 900 })
          }
        }
        el.addEventListener('click', zoomIn)
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); zoomIn(e) }
        })
        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat(lngLat)
          .addTo(map)
        rec = { marker, el, count: 0, items: [] }
        clustersRef.current.set(key, rec)
      }
      rec.items = g.items
      rec.marker.setLngLat(lngLat)
      rec.el.setAttribute('aria-label', `Zoom in to view ${g.items.length} nearby vehicles`)
      rec.el.style.setProperty('--cluster-color', CAR_STATUS_COLORS[dominant].body)
      if (rec.count !== g.items.length) {
        rec.el.innerHTML = `<span>${g.items.length}</span>`
        rec.count = g.items.length
      }
      g.items.forEach(({ s }) => nextClustered.add(s.id))
    })

    clustersRef.current.forEach((rec, key) => {
      if (!nextKeys.has(key)) { rec.marker.remove(); clustersRef.current.delete(key) }
    })
    markersRef.current.forEach((rec, id) => {
      rec.el.style.display = nextClustered.has(id) ? 'none' : ''
    })
    relayoutLabelsRef.current?.()
  }
  syncClustersRef.current = syncClusters

  // Sync markers with snapshots (create / update targets, never jump)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const seen = new Set()
    const popup = popupRef.current || (popupRef.current = new maplibregl.Popup({ offset: 18, closeButton: false }))
    snapshots.forEach(s => {
      if (!Number.isFinite(s.latitude) || !Number.isFinite(s.longitude)) return
      seen.add(s.id)
      const status = statusOf(s)
      const speed = Number(s.speed_kmh ?? 0)
      const bearing = Number.isFinite(Number(s.bearing)) ? Number(s.bearing) : 0
      // Snap-to-road (optional, display-side only): ease toward the nearest
      // road point instead of the raw GPS fix. Failures keep the raw fix.
      let target = { lng: s.longitude, lat: s.latitude }
      if (snapToRoad) {
        const key = `${s.latitude.toFixed(5)},${s.longitude.toFixed(5)}`
        const hit = snapCacheRef.current.get(key)
        if (hit) {
          target = { lng: hit.lng, lat: hit.lat }
        } else {
          snapPoint(s.latitude, s.longitude).then(snapped => {
            if (!snapped) return
            snapCacheRef.current.set(key, snapped)
            if (snapCacheRef.current.size > 500) {
              snapCacheRef.current.delete(snapCacheRef.current.keys().next().value)
            }
            const rec = markersRef.current.get(s.id)
            const cur = latestRef.current.get(s.id)
            if (rec && cur && `${cur.latitude.toFixed(5)},${cur.longitude.toFixed(5)}` === key) {
              rec.target = { lng: snapped.lng, lat: snapped.lat }
            }
          }).catch(() => {})
        }
      }
      let rec = markersRef.current.get(s.id)
      if (!rec) {
        const el = document.createElement('div')
        el.className = 'fleet-ml-marker'
        el.setAttribute('role', 'button')
        el.setAttribute('tabindex', '0')
        el.setAttribute('aria-label', `Select ${s.registration || 'vehicle'} on the map`)
        el.innerHTML =
          `<div class="fleet-ml-label"><span class="fleet-ml-reg">${esc(s.registration || '—')}</span>` +
          `<span class="fleet-ml-spd">${markerSpeedText(s)}</span></div>` +
          `<div class="fleet-ml-car" style="width:${MARKER_SIZE}px;height:${MARKER_SIZE * 2}px;transform:rotate(${bearing}deg)">${carSvg(status, MARKER_SIZE)}</div>`
        const carEl = el.querySelector('.fleet-ml-car')
        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([target.lng, target.lat])
          .addTo(map)
        const selectVehicle = (e) => {
          e?.stopPropagation?.()
          const fresh = latestRef.current.get(s.id) || s
          const position = [fresh.longitude ?? fresh.lng, fresh.latitude ?? fresh.lat]
          if (position.every(Number.isFinite)) popup.setLngLat(position)
          popup.setHTML(popupHtml(fresh, statusOf(fresh))).addTo(map)
          onSelectRef.current?.(fresh)
        }
        el.addEventListener('click', selectVehicle)
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectVehicle(e) }
        })
        rec = { marker, el, carEl, spdEl: el.querySelector('.fleet-ml-spd'), status, cur: { lng: target.lng, lat: target.lat }, target }
        markersRef.current.set(s.id, rec)
      } else {
        rec.target = target
        if (rec.status !== status) {
          rec.status = status
          rec.carEl.innerHTML = carSvg(status, MARKER_SIZE)
        }
        if (rec.spdEl) {
          const txt = markerSpeedText(s)
          if (rec.spdEl.textContent !== txt) rec.spdEl.textContent = txt
          rec.spdEl.style.color = CAR_STATUS_COLORS[status].light
        }
        if (rec.carEl) rec.carEl.style.transform = `rotate(${bearing}deg)`
      }
    })
    // Remove markers for vehicles no longer present
    markersRef.current.forEach((rec, id) => {
      if (!seen.has(id)) { rec.marker.remove(); markersRef.current.delete(id) }
    })
    // Emphasis only toggles DOM classes — the map instance and marker nodes
    // are never recreated when selection or filters change.
    const focus = focusIds ? new Set(focusIds) : null
    markersRef.current.forEach((rec, id) => {
      rec.el.classList.toggle('fleet-ml-marker-selected', selectedId != null && String(id) === String(selectedId))
      rec.el.classList.toggle('fleet-ml-muted', Boolean(focus && !focus.has(id)))
    })

    // Nearby vehicles can project onto the same few pixels. Shift only the
    // registration pills (never the marker/anchor) so labels stay readable.
    const relayoutLabels = () => {
      const items = []
      markersRef.current.forEach((rec) => {
        const label = rec.el.querySelector('.fleet-ml-label')
        if (!label) return
        label.style.setProperty('--label-shift', '0px')
        const rect = label.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) items.push({ label, rect })
      })
      items.sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left)
      const placed = []
      for (const item of items) {
        let shift = 0
        for (const candidate of [0, -72, 72, -144, 144, -216, 216]) {
          const left = item.rect.left + candidate
          const right = item.rect.right + candidate
          const collides = placed.some(p =>
            left < p.right + 2 && right > p.left - 2 &&
            item.rect.top < p.bottom + 2 && item.rect.bottom > p.top - 2
          )
          if (!collides) { shift = candidate; break }
        }
        item.label.style.setProperty('--label-shift', `${shift}px`)
        placed.push({
          left: item.rect.left + shift, right: item.rect.right + shift,
          top: item.rect.top, bottom: item.rect.bottom,
        })
      }
    }
    relayoutLabelsRef.current = relayoutLabels
    syncClusters()
  }, [snapshots, snapToRoad, selectedId, focusIds])

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
        className="absolute right-3 top-3 z-10 px-3.5 py-2.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition-colors active:scale-95 flex items-center gap-1.5 tabular-nums"
      >
        <Maximize2 size={12} /> Show all ({snapshots.filter(s => Number.isFinite(s.latitude) && Number.isFinite(s.longitude)).length})
      </button>
      <div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-x-3 gap-y-1 rounded-xl bg-[var(--ap-surface)]/95 backdrop-blur-md px-3.5 py-2.5 text-[11px] font-semibold text-slate-600 dark:text-slate-200 shadow-lg border border-[var(--ap-border)]">
        {MAP_STATUSES.map(k => {
          const c = CAR_STATUS_COLORS[k]
          return (
          <span key={k} className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: c.body }} />
            <span className="font-medium">{c.label}</span>
          </span>
          )
        })}
      </div>
    </div>
  )
}

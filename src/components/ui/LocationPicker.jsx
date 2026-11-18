// ─── Location Picker Component ────────────────────────────────────
// Accepts a location from:
//   1. WhatsApp-style live location share (browser geolocation)
//   2. Google/Apple/Bing maps link
//   3. Typed coordinates "12.9716,79.1587" or "geo:12.9716,79.1587"
//   4. Typed place name ("Puducherry Bus Stand")
// Returns { lat, lng, label, raw } resolved via forwardGeocode/parseLocation.

import { useState, useCallback, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { MapPin, Link, Search } from 'lucide-react'
import { forwardGeocode, parseLocation, reverseGeocode } from '../../utils/locationUtils'

function Label({ children, required }) {
  return (
    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  )
}

const MAP_DEFAULT_CENTER = [11.9416, 79.8083] // Puducherry

const PIN_ICON = new L.divIcon({
  className: 'sjt-location-pin',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42"><path d="M15 0C6.7 0 0 6.7 0 15c0 11.5 15 27 15 27s15-15.5 15-15.5C30 6.7 23.3 0 15 0z" fill="#2563eb" stroke="#ffffff" stroke-width="1.6"/><circle cx="15" cy="15" r="6.5" fill="#ffffff"/></svg>`,
  iconSize: [30, 42],
  iconAnchor: [15, 42],
  popupAnchor: [0, -42],
})

function MapClickHandler({ onPickRef }) {
  const map = useMap()
  useEffect(() => {
    if (!map) return
    const handler = (e) => {
      const lat = e?.latlng?.lat ?? e?.latlng?.Lat
      const lng = e?.latlng?.lng ?? e?.latlng?.Lng
      if (typeof lat !== 'number' || typeof lng !== 'number') return
      onPickRef.current({ lat, lng })
    }
    map.on('click', handler)
    return () => map.off('click', handler)
  }, [map, onPickRef])
  return null
}

export function LocationPicker({ label, value, onChange, error, required = true, showLabel = true }) {
  const [locating, setLocating] = useState(false)
  const [parsed, setParsed] = useState(null) // { lat, lng, label, raw }
  const [mode, setMode] = useState('search') // 'search' | 'map' — pick-up / drop via map marker + popup
  const [text, setText] = useState(value || '') // what the user typed — kept separate from the resolved value

  useEffect(() => { setText(value || '') }, [value])

  const handleMapPick = useCallback(async ({ lat, lng }) => {
    const la = Number(lat)
    const ln = Number(lng)
    const resolvedLabel = await reverseGeocode(la, ln)
    const raw = `${la.toFixed(6)},${ln.toFixed(6)}`
    setParsed({ lat: la, lng: ln, label: resolvedLabel || `${la.toFixed(4)}, ${ln.toFixed(4)}`, raw })
    onChange(resolvedLabel || raw)
  }, [onChange])

  // Keep the latest picker callback in a ref so the Leaflet click handler
  // never needs re-registering (stable handler → reliable repeat picking).
  const onPickRef = useRef(handleMapPick)
  useEffect(() => { onPickRef.current = handleMapPick }, [handleMapPick])

  const handleLiveLocation = async () => {
    if (!navigator.geolocation) {
      alert('Your browser does not support location sharing.')
      return
    }
    setLocating(true)
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        })
      })
      const { latitude, longitude } = pos.coords
      const raw = `${latitude.toFixed(6)},${longitude.toFixed(6)}`
      setText(raw)
      setParsed({ lat: Number(latitude.toFixed(6)), lng: Number(longitude.toFixed(6)), label: raw, raw })
      onChange(raw)
    } catch {
      alert('Could not get your location. Please type the address instead.')
    } finally {
      setLocating(false)
    }
  }

  const handleTextChange = (e) => {
    const raw = e.target.value
    setText(raw)
    onChange(raw)
    const loc = parseLocation(raw)
    if (loc) setParsed(loc)
    else setParsed(null)
  }

  const asyncGeocode = async (raw) => {
    try {
      const hit = await forwardGeocode(raw)
      if (hit) {
        setText(hit.label || raw)
        setParsed({ lat: hit.lat, lng: hit.lng, label: hit.label, raw: hit.label || raw })
        onChange(hit.label || raw)
      }
    } catch {}
  }

  const handleBlur = async (e) => {
    const raw = e.target.value
    if (!raw) return
    // If not already parsed as coordinates/maps link, try forward geocoding
    if (!parsed || parsed.raw !== raw) {
      await asyncGeocode(raw)
    }
  }

  return (
    <div className="space-y-2">
      {showLabel && <Label required={required}>{label}</Label>}

      {/* Live location share button */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--ap-border)] bg-[var(--ap-surface-2)] text-sm text-slate-600 dark:text-slate-300 hover:bg-[var(--ap-surface-2)] transition-all">
        <button
          type="button"
          onClick={handleLiveLocation}
          disabled={locating}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-[var(--ap-surface-2)] transition-colors disabled:opacity-50"
        >
          <MapPin size={14} />
          {locating ? 'Locating…' : 'Share Live Location'}
        </button>
        {parsed && (
          <span className="ml-auto text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
            ✓ {parsed.label}
          </span>
        )}
      </div>

      {/* Mode toggle: typed / searched location vs. picking on the map */}
      <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/60" role="group" aria-label={`${label} input mode`}>
        <button type="button" onClick={() => setMode('search')}
          className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all ${mode === 'search' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>
          Search / Type
        </button>
        <button type="button" onClick={() => setMode('map')}
          className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all ${mode === 'map' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>
          Pick on Map
        </button>
      </div>

      {mode === 'map' ? (
        <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700" style={{ height: '260px', width: '100%' }}>
          <MapContainer center={parsed ? [parsed.lat, parsed.lng] : MAP_DEFAULT_CENTER} zoom={12} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <MapClickHandler onPickRef={onPickRef} />
            {parsed && (
              <Marker position={[parsed.lat, parsed.lng]} icon={PIN_ICON}>
                <Popup>
                  <div className="text-xs">
                    <p className="font-bold text-slate-700 dark:text-slate-200">{parsed.label}</p>
                    <p className="text-slate-500 dark:text-slate-400">{Number(parsed.lat).toFixed(4)}°N, {Number(parsed.lng).toFixed(4)}°E</p>
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>
          <p className="absolute bottom-2 left-0 right-0 px-2 text-[10px] text-slate-500 dark:text-slate-400 pointer-events-none">
            Click anywhere on the map to drop a pin · the popup shows the resolved area
          </p>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={text}
            placeholder="Share location, paste maps link, or type place name (e.g. Puducherry Bus Stand)"
            onChange={handleTextChange}
            onBlur={handleBlur}
            className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-teal-400/40 dark:focus:border-teal-500"
          />
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
        </div>
      )}

      {parsed && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30">
          <MapPin size={13} className="text-amber-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-0.5">Resolved Location</p>
            <p className="text-[11px] text-slate-700 dark:text-slate-300 truncate">{parsed.label}</p>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

export default LocationPicker
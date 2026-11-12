// ─── Location Picker Component ────────────────────────────────────
// Accepts a location from:
//   1. WhatsApp-style live location share (browser geolocation)
//   2. Google/Apple/Bing maps link
//   3. Typed coordinates "12.9716,79.1587" or "geo:12.9716,79.1587"
//   4. Typed place name ("Puducherry Bus Stand")
// Returns { lat, lng, label, raw } resolved via forwardGeocode/parseLocation.

import { useState, useCallback } from 'react'
import { MapPin, Link, Search } from 'lucide-react'
import { forwardGeocode, parseLocation } from '../../utils/locationUtils'

export function LocationPicker({ label, value, onChange, error, required = true }) {
  const [locating, setLocating] = useState(false)
  const [parsed, setParsed] = useState(null) // { lat, lng, label, raw }

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
    onChange(raw)
    const loc = parseLocation(raw)
    if (loc) setParsed(loc)
    else setParsed(null)
  }

  const asyncGeocode = async (raw) => {
    try {
      const hit = await forwardGeocode(raw)
      if (hit) {
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
      <Label required>{label}{required && <span className="text-red-500 ml-0.5">*</span>}</Label>

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

      {/* Text input for maps link / coordinates / place name */}
      <div className="relative">
        <input
          type="text"
          value={value || ''}
          placeholder="Share location, paste maps link, or type place name (e.g. Puducherry Bus Stand)"
          onChange={handleTextChange}
          onBlur={handleBlur}
          className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all"
        />
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      </div>

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
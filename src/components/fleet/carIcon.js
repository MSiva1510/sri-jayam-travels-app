// ─── Car map marker ───────────────────────────────────────────
// Top-down 3D-styled MapLibre marker, coloured by movement state and
// rotated to the vehicle's bearing (0° = north, clockwise).
// Ignition is telemetry, not a movement state.

import { FLEET_STALE_MS } from './fleetStatus'

export const CAR_STATUS_COLORS = {
  moving:  { body: '#10b981', shade: '#047857', light: '#6ee7b7', label: 'Moving'  },
  stopped: { body: '#3b82f6', shade: '#1d4ed8', light: '#93c5fd', label: 'Stopped' },
  offline: { body: '#ef4444', shade: '#b91c1c', light: '#fca5a5', label: 'Offline' },
}

/** Derive the marker movement state from a GPS snapshot. */
export function carStatusOf(s, staleMs = FLEET_STALE_MS) {
  const ts = s?.timestamp ? new Date(s.timestamp).getTime() : 0
  if (!ts || Date.now() - ts > staleMs) return 'offline'
  if (Number(s?.speed_kmh ?? 0) > 0) return 'moving'
  return 'stopped'
}

/** Inline SVG of the car, nose pointing up. 36×72 viewBox. */
export function carSvg(status = 'stopped', size = 30) {
  const c = CAR_STATUS_COLORS[status] || CAR_STATUS_COLORS.offline
  const h = Math.round(size * 2)
  const id = `${status}-${size}`
  return `
<svg width="${size}" height="${h}" viewBox="0 0 36 72" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="body-${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0"    stop-color="${c.shade}"/>
      <stop offset="0.22" stop-color="${c.body}"/>
      <stop offset="0.5"  stop-color="${c.light}"/>
      <stop offset="0.78" stop-color="${c.body}"/>
      <stop offset="1"    stop-color="${c.shade}"/>
    </linearGradient>
    <linearGradient id="glass-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#dbeafe"/>
      <stop offset="1" stop-color="#3b5f85"/>
    </linearGradient>
    <linearGradient id="roof-${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0"   stop-color="${c.body}"/>
      <stop offset="0.5" stop-color="${c.light}"/>
      <stop offset="1"   stop-color="${c.body}"/>
    </linearGradient>
  </defs>

  <!-- wheels (tucked under the body) -->
  <g fill="#111827">
    <rect x="2"  y="13" width="5" height="11" rx="2.2"/>
    <rect x="29" y="13" width="5" height="11" rx="2.2"/>
    <rect x="2"  y="49" width="5" height="11" rx="2.2"/>
    <rect x="29" y="49" width="5" height="11" rx="2.2"/>
  </g>

  <!-- body: sedan silhouette -->
  <path d="M12 3 Q18 1 24 3 Q30 5 31 12 L32 24 L32 58 Q31 66 24 68.5 Q18 70 12 68.5 Q5 66 4 58 L4 24 L5 12 Q6 5 12 3 Z"
        fill="url(#body-${id})" stroke="${c.shade}" stroke-width="1.2" stroke-linejoin="round"/>

  <!-- bonnet crease -->
  <path d="M9 9 Q18 6.5 27 9" fill="none" stroke="${c.shade}" stroke-width="0.9" opacity="0.7"/>
  <path d="M8 21 H28" stroke="${c.shade}" stroke-width="0.9" opacity="0.5"/>

  <!-- windscreen -->
  <path d="M8.5 22 Q18 19.5 27.5 22 L29 32 Q18 31 7 32 Z"
        fill="url(#glass-${id})" stroke="#0f172a" stroke-width="0.9" stroke-linejoin="round"/>
  <!-- roof -->
  <path d="M7 32 Q18 31 29 32 L29 46 Q18 47 7 46 Z" fill="url(#roof-${id})" stroke="${c.shade}" stroke-width="0.9"/>
  <!-- rear window -->
  <path d="M7 46 Q18 47 29 46 L27.5 54 Q18 56 8.5 54 Z"
        fill="url(#glass-${id})" stroke="#0f172a" stroke-width="0.9" stroke-linejoin="round"/>
  <!-- boot crease -->
  <path d="M8 60 H28" stroke="${c.shade}" stroke-width="0.9" opacity="0.5"/>

  <!-- wing mirrors -->
  <rect x="2.5"  y="30" width="3" height="5" rx="1.2" fill="${c.shade}"/>
  <rect x="30.5" y="30" width="3" height="5" rx="1.2" fill="${c.shade}"/>

  <!-- lights -->
  <rect x="8"  y="3.2" width="6.5" height="2.6" rx="1.3" fill="#fef9c3" stroke="#facc15" stroke-width="0.5"/>
  <rect x="21.5" y="3.2" width="6.5" height="2.6" rx="1.3" fill="#fef9c3" stroke="#facc15" stroke-width="0.5"/>
  <rect x="8"  y="65.6" width="6.5" height="2.4" rx="1.2" fill="#fb7185" stroke="#be123c" stroke-width="0.5"/>
  <rect x="21.5" y="65.6" width="6.5" height="2.4" rx="1.2" fill="#fb7185" stroke="#be123c" stroke-width="0.5"/>

  <!-- glossy highlight -->
  <path d="M10 5 Q18 3 26 5 Q22 7 18 7 Q14 7 10 5 Z" fill="#fff" opacity="0.35"/>
</svg>`
}

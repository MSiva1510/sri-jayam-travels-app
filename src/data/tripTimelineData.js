// ─── Trip Timeline ────────────────────────────────────────────
// Records lifecycle events for each trip.

export const TIMELINE_KEY = 'sjt_trip_timelines'

export const TIMELINE_EVENTS = {
  assigned:          { key: 'assigned',          label: 'Trip Assigned',      dot: 'bg-slate-400'    },
  accepted:          { key: 'accepted',          label: 'Accepted by Driver', dot: 'bg-blue-400'     },
  started:           { key: 'started',           label: 'Trip Started',       dot: 'bg-blue-600'     },
  reached_pickup:    { key: 'reached_pickup',    label: 'Reached Pickup',     dot: 'bg-teal-500'     },
  passenger_boarded: { key: 'passenger_boarded', label: 'Passenger Boarded',  dot: 'bg-indigo-500'   },
  paused:            { key: 'paused',            label: 'Ride Paused',        dot: 'bg-amber-500'    },
  resumed:           { key: 'resumed',           label: 'Ride Resumed',       dot: 'bg-emerald-400'  },
  completed:         { key: 'completed',         label: 'Trip Completed',     dot: 'bg-emerald-600'  },
  cancelled:         { key: 'cancelled',         label: 'Trip Cancelled',     dot: 'bg-red-500'      },
}

// ── Add event to a trip's timeline ───────────────────────────
export function addTimelineEvent(tripId, eventKey, note = '') {
  if (!tripId || !eventKey) return false
  const all      = loadAllTimelines()
  const timeline = all[tripId] || []
  timeline.push({
    event:     eventKey,
    label:     TIMELINE_EVENTS[eventKey]?.label || eventKey,
    timestamp: new Date().toISOString(),
    note,
  })
  all[tripId] = timeline
  try {
    localStorage.setItem(TIMELINE_KEY, JSON.stringify(all))
    return true
  } catch { return false }
}

// ── Load timeline for one trip ────────────────────────────────
export function loadTimeline(tripId) {
  if (!tripId) return []
  return loadAllTimelines()[tripId] || []
}

// ── Load all timelines ────────────────────────────────────────
export function loadAllTimelines() {
  try {
    const raw = localStorage.getItem(TIMELINE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

// ── Clear timeline for a trip ────────────────────────────────
export function clearTimeline(tripId) {
  if (!tripId) return
  const all = loadAllTimelines()
  delete all[tripId]
  try { localStorage.setItem(TIMELINE_KEY, JSON.stringify(all)) } catch {}
}

// ── Format timestamp for display ────────────────────────────
export function fmtTimelineTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

// ── Get event config ─────────────────────────────────────────
export function getEventCfg(eventKey) {
  return TIMELINE_EVENTS[eventKey] || { key: eventKey, label: eventKey, dot: 'bg-slate-400' }
}

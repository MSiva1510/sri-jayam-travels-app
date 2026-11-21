// ─── GPS History Data — Supabase gps_tracking + trip_routes ───
// gps_tracking: id, trip_id, driver_id, latitude, longitude,
//               accuracy, speed_kmh, bearing, altitude, timestamp
// trip_routes:  id, booking_id, route_data (jsonb), created_at, updated_at
// All GPS data persisted to Supabase (no localStorage).

import supabase from '../lib/supabase'

const TRIP_ROUTES_TABLE = 'trip_routes'

// Load GPS track for a trip from Supabase trip_routes.
export async function loadTripRoute(tripId) {
  if (!tripId || !supabase) return []
  try {
    const { data } = await supabase
      .from(TRIP_ROUTES_TABLE)
      .select('route_data')
      .eq('booking_id', tripId)
      .order('created_at', { ascending: false })
      .limit(1)
    if (data && data.length > 0 && data[0].route_data) {
      return Array.isArray(data[0].route_data) ? data[0].route_data : []
    }
  } catch {}
  return []
}

// Calculate route distance in km from array of {lat, lng} points
export function calcRouteDistanceKm(points = []) {
  if (!Array.isArray(points) || points.length < 2) return 0
  let dist = 0
  for (let i = 1; i < points.length; i++) {
    const { lat: lat1, lng: lon1 } = points[i - 1]
    const { lat: lat2, lng: lon2 } = points[i]
    if (!lat1 || !lon1 || !lat2 || !lon2) continue
    const R    = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a    = Math.sin(dLat / 2) ** 2 +
                 Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                 Math.sin(dLon / 2) ** 2
    dist += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }
  return Math.round(dist * 10) / 10
}

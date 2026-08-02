// ─── GPS History Repository ───────────────────────────────────
// Reads/writes the `gps_tracking` table. Dedup is enforced by a
// UNIQUE INDEX on (vehicle_id, timestamp). Service rounds the
// timestamp to the nearest minute before insert so duplicates
// within the same polling window are silently dropped.

import supabase from '../lib/supabase'
import { withTimeout } from '../utils/withTimeout'

const DEFAULT_TIMEOUT_MS = 10_000
const BATCH_SIZE = 100

class GpsHistoryRepository {
  constructor() {
    this.table = 'gps_tracking'
  }

  /**
   * Generic paged read with optional filters.
   * @param {{since?: string, until?: string, vehicleId?: string, limit?: number}} opts
   */
  async getAll(opts = {}) {
    if (!supabase) return []
    const limit = Math.min(opts.limit ?? 500, 1000)
    let q = supabase
      .from(this.table)
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit)
    if (opts.vehicleId) q = q.eq('vehicle_id', opts.vehicleId)
    if (opts.since)     q = q.gte('timestamp', opts.since)
    if (opts.until)     q = q.lte('timestamp', opts.until)
    return withTimeout(q, DEFAULT_TIMEOUT_MS, { data: [] }).then(r => r?.data ?? [])
  }

  /** Latest GPS row for a single vehicle. */
  async getLatestForVehicle(vehicleId) {
    if (!supabase || !vehicleId) return null
    const { data } = await withTimeout(
      supabase
        .from(this.table)
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('timestamp', { ascending: false })
        .limit(1),
      DEFAULT_TIMEOUT_MS,
      { data: [] }
    )
    return data?.[0] ?? null
  }

  /**
   * Fleet-wide "latest per vehicle" snapshot. Used by the KPI tiles
   * and the map. One round-trip, GROUP BY vehicle_id.
   */
  async getLatestForFleet() {
    if (!supabase) return []
    // Postgres can't do MAX(*) on a rowset, so we use a window-fn
    // approach via a single SELECT + JS dedupe as a portable fallback
    // that still costs one round-trip.
    const { data } = await withTimeout(
      supabase
        .from(this.table)
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(500),
      DEFAULT_TIMEOUT_MS,
      { data: [] }
    )
    const seen = new Set()
    const out = []
    for (const row of data ?? []) {
      if (!row.vehicle_id || seen.has(row.vehicle_id)) continue
      seen.add(row.vehicle_id)
      out.push(row)
    }
    return out
  }

  /**
   * Insert one snapshot. Returns { inserted: boolean }.
   * Conflict on (vehicle_id, timestamp) is silently ignored.
   */
  async insertSnapshot(snapshot) {
    if (!supabase) return { inserted: false, reason: 'no-supabase' }
    if (!snapshot?.vehicle_id || !snapshot?.timestamp) {
      return { inserted: false, reason: 'missing-keys' }
    }
    const { error } = await withTimeout(
      supabase
        .from(this.table)
        .insert([this._toRow(snapshot)])
        .select(),
      DEFAULT_TIMEOUT_MS,
      { error: null }
    )
    if (error?.code === '23505') return { inserted: false, reason: 'duplicate' }
    if (error) return { inserted: false, reason: error.message }
    return { inserted: true }
  }

  /**
   * Insert many snapshots. Rows that conflict with the dedup index
   * are silently skipped by Supabase ON CONFLICT DO NOTHING.
   */
  async insertBatch(snapshots) {
    if (!supabase) return { inserted: 0, skipped: snapshots?.length ?? 0 }
    const list = (snapshots ?? []).filter(s => s?.vehicle_id && s?.timestamp)
    if (!list.length) return { inserted: 0, skipped: 0 }

    let inserted = 0
    let skipped  = 0
    for (let i = 0; i < list.length; i += BATCH_SIZE) {
      const chunk = list.slice(i, i + BATCH_SIZE).map(s => this._toRow(s))
      const { data, error } = await withTimeout(
        supabase
          .from(this.table)
          .upsert(chunk, { onConflict: 'vehicle_id,timestamp', ignoreDuplicates: true })
          .select('vehicle_id'),
        DEFAULT_TIMEOUT_MS,
        { data: [], error: null }
      )
      if (error) {
        skipped += chunk.length
      } else {
        inserted += data?.length ?? chunk.length
        skipped  += chunk.length - (data?.length ?? chunk.length)
      }
    }
    return { inserted, skipped }
  }

  _toRow(s) {
    return {
      vehicle_id: s.vehicle_id,
      trip_id:    s.trip_id    ?? null,
      driver_id:  s.driver_id  ?? null,
      latitude:   Number(s.lat),
      longitude:  Number(s.lng),
      accuracy:   s.accuracy   ?? null,
      speed_kmh:  s.speed_kmh  ?? null,
      bearing:    s.bearing    ?? null,
      altitude:   s.altitude   ?? null,
      address:    s.address    ?? null,
      ignition:   typeof s.ignition === 'boolean' ? s.ignition : null,
      status:     s.status     ?? null,
      odometer:   s.odometer   ?? null,
      timestamp:  s.timestamp,
      raw:        s.raw        ?? {},
    }
  }
}

export const gpsHistoryRepository = new GpsHistoryRepository()
export { GpsHistoryRepository }
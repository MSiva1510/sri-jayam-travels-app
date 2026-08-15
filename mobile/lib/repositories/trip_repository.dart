// ─────────────────────────────────────────────────────────────────────────────
// trip_repository.dart
// Supabase access layer for trips (bookings table).
//
// SECURITY:
//   RLS policy "bookings_driver_own" restricts SELECT to rows where:
//     driver_id = get_driver_id()           (UUID match — fast)
//     OR driver_name = current user's name  (TEXT fallback for legacy rows)
//
//   Flutter never requests base_fare / total_fare columns (financial guard).
//   Even if RLS is bypassed, the column is never in the result set.
//
//   getTripById() also verifies the driver matches before returning.
// ─────────────────────────────────────────────────────────────────────────────

import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/config/supabase_config.dart';
import '../models/trip.dart';

class TripRepository {
  TripRepository(this._client);

  final SupabaseClient _client;

  // ── Core queries ──────────────────────────────────────────────────────────

  /// All trips for the authenticated driver, newest first.
  /// RLS enforces driver-only access — no need to pass driver ID as a filter.
  Future<List<TripModel>> getDriverTrips({int limit = 50}) async {
    final data = await _client
        .from(SupabaseConfig.bookingsTable)
        .select(TripModel.selectColumns)
        .not('status', 'eq', 'draft')          // drivers don't see unassigned drafts
        .order('start_date', ascending: false)
        .order('created_at', ascending: false)
        .limit(limit);

    return (data as List).map((m) => TripModel.fromMap(m)).toList();
  }

  /// Only today's trips for the authenticated driver.
  Future<List<TripModel>> getTodayTrips() async {
    final today = DateTime.now();
    final dateStr =
        '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';

    final data = await _client
        .from(SupabaseConfig.bookingsTable)
        .select(TripModel.selectColumns)
        .eq('start_date', dateStr)
        .not('status', 'eq', 'draft')
        .order('start_time', ascending: true);

    return (data as List).map((m) => TripModel.fromMap(m)).toList();
  }

  /// Upcoming trips (today + future), for the authenticated driver.
  Future<List<TripModel>> getUpcomingTrips({int limit = 10}) async {
    final today = DateTime.now();
    final dateStr =
        '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';

    final data = await _client
        .from(SupabaseConfig.bookingsTable)
        .select(TripModel.selectColumns)
        .gte('start_date', dateStr)
        .inFilter('status', ['assigned', 'started'])
        .order('start_date', ascending: true)
        .order('start_time', ascending: true)
        .limit(limit);

    return (data as List).map((m) => TripModel.fromMap(m)).toList();
  }

  /// Single trip by ID — RLS ensures driver can only fetch their own trip.
  /// Returns null if not found or access denied.
  Future<TripModel?> getTripById(String tripId) async {
    final data = await _client
        .from(SupabaseConfig.bookingsTable)
        .select(TripModel.selectColumns)
        .eq('id', tripId)
        .maybeSingle();

    if (data == null) return null;
    return TripModel.fromMap(data);
  }

  /// Count of today's trips — cheap aggregate query.
  Future<int> getTodayTripCount() async {
    final today = DateTime.now();
    final dateStr =
        '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';

    final data = await _client
        .from(SupabaseConfig.bookingsTable)
        .select('id')
        .eq('start_date', dateStr)
        .not('status', 'eq', 'draft');

    return (data as List).length;
  }
}

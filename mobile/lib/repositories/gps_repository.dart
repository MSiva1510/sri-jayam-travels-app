// ─────────────────────────────────────────────────────────────────────────────
// gps_repository.dart
// Foundation for GPS data persistence (Day 46 — stub only).
// Day 47+ will connect to the existing Web ERP GPS backend tables.
//
// DO NOT create new GPS tables. The Web ERP uses:
//   gps_tracking, vehicle_assignments, vehicle_status
// Flutter must write to those same tables — not duplicate them.
// ─────────────────────────────────────────────────────────────────────────────

import 'package:supabase_flutter/supabase_flutter.dart' hide AuthState;
import '../models/gps_position.dart';

class GpsRepository {
  GpsRepository(this._client);

  final SupabaseClient _client;

  // ── Day 47+ — connect to existing Web ERP GPS tables ─────────────────────
  //
  // Before implementing these, the Day 47 spec must:
  //   1. Inspect the actual Web ERP GPS table schema
  //   2. Verify column names (lat/lng/vehicle_id/driver_id/timestamp etc.)
  //   3. Verify RLS policies on those tables
  //   4. Confirm which table receives mobile driver pings
  //
  // Do NOT write to these tables yet without schema verification.

  /// Placeholder — will upload a GPS ping to the Web ERP backend.
  /// Schema inspection required before implementation (Day 47).
  Future<void> uploadPosition({
    required String      driverId,
    required GpsPosition position,
  }) async {
    // TODO Day 47: inspect gps_tracking table schema, then implement.
    throw UnimplementedError(
      'GPS upload not yet implemented. '
      'Requires schema inspection of gps_tracking table. See Day 47 spec.',
    );
  }

  /// Placeholder — will fetch recent GPS history for a driver.
  Future<List<GpsPosition>> getRecentPositions({
    required String driverId,
    int limit = 100,
  }) async {
    // TODO Day 47
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// alert_repository.dart — Alert Data Access
// ─────────────────────────────────────────────────────────────────────────────

import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/alert.dart';
import '../core/config/supabase_config.dart';

class AlertRepository {
  AlertRepository(this._supabase);

  final SupabaseClient _supabase;

  Future<List<Alert>> getActiveAlerts({int limit = 50}) async {
    final response = await _supabase
        .from(SupabaseConfig.fleetAlertsTable)
        .select('''
          id, title, description, priority, category, status,
          vehicle_id, vehicle_reg, driver_id, driver_name, trip_id,
          created_at, acknowledged_at, resolved_at, acknowledged_by, resolved_by, metadata
        ''')
        .inFilter('status', ['active', 'acknowledged'])
        .order('created_at', ascending: false)
        .limit(limit);

    return (response as List).map((json) => Alert.fromMap(json)).toList();
  }

  Future<List<Alert>> getAllAlerts({int limit = 100}) async {
    final response = await _supabase
        .from(SupabaseConfig.fleetAlertsTable)
        .select('''
          id, title, description, priority, category, status,
          vehicle_id, vehicle_reg, driver_id, driver_name, trip_id,
          created_at, acknowledged_at, resolved_at, acknowledged_by, resolved_by, metadata
        ''')
        .order('created_at', ascending: false)
        .limit(limit);

    return (response as List).map((json) => Alert.fromMap(json)).toList();
  }

  Future<Alert?> getAlertById(String id) async {
    final response = await _supabase
        .from(SupabaseConfig.fleetAlertsTable)
        .select()
        .eq('id', id)
        .maybeSingle();

    if (response == null) return null;
    return Alert.fromMap(response);
  }

  Future<void> acknowledgeAlert(String id, String userId) async {
    await _supabase
        .from(SupabaseConfig.fleetAlertsTable)
        .update({
          'status': 'acknowledged',
          'acknowledged_at': DateTime.now().toIso8601String(),
          'acknowledged_by': userId,
        })
        .eq('id', id);
  }

  Future<void> resolveAlert(String id, String userId) async {
    await _supabase
        .from(SupabaseConfig.fleetAlertsTable)
        .update({
          'status': 'resolved',
          'resolved_at': DateTime.now().toIso8601String(),
          'resolved_by': userId,
        })
        .eq('id', id);
  }

  Stream<List<Alert>> watchActiveAlerts() {
    return _supabase
        .from(SupabaseConfig.fleetAlertsTable)
        .stream(primaryKey: ['id'])
        .map((data) => data
            .where((json) => ['active', 'acknowledged'].contains(json['status']))
            .map((json) => Alert.fromMap(json))
            .toList());
  }
}
// ─────────────────────────────────────────────────────────────────────────────
// earnings_repository.dart — read-only driver earnings (trip_payslips).
// Mirrors the web payrollRepository.getPayslipsByDriver (driver_id filter).
// ─────────────────────────────────────────────────────────────────────────────

import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/demo/demo_session.dart';
import '../models/driver_payslip.dart';

class EarningsRepository {
  EarningsRepository(this._client);

  final SupabaseClient _client;

  /// Payslips for one driver, newest first. RLS scopes to the driver.
  Future<List<DriverPayslip>> getPayslips(String driverId,
      {int limit = 100}) async {
    if (DemoSession.active) {
      return DemoSession.payslips.take(limit).toList();
    }
    final data = await _client
        .from('trip_payslips')
        .select('*')
        .eq('driver_id', driverId)
        .order('created_at', ascending: false)
        .limit(limit);
    return (data as List)
        .whereType<Map<String, dynamic>>()
        .map(DriverPayslip.fromMap)
        .toList();
  }
}

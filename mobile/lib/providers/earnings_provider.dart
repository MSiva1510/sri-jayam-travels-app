// ─────────────────────────────────────────────────────────────────────────────
// earnings_provider.dart — driver payslips + today/week/month summaries.
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/driver_payslip.dart';
import '../repositories/earnings_repository.dart';
import 'auth_provider.dart';

final earningsRepositoryProvider = Provider<EarningsRepository>((ref) {
  return EarningsRepository(ref.watch(supabaseClientProvider));
});

/// All recent payslips for the signed-in driver.
final driverPayslipsProvider =
    FutureProvider<List<DriverPayslip>>((ref) async {
  final driver = ref.watch(currentDriverProvider);
  if (driver == null) return [];
  try {
    return await ref
        .watch(earningsRepositoryProvider)
        .getPayslips(driver.id);
  } catch (_) {
    return [];
  }
});

bool _sameDay(DateTime a, DateTime b) =>
    a.year == b.year && a.month == b.month && a.day == b.day;

/// Earnings earned *today* (by payslip date).
final todayEarningsProvider = Provider<double>((ref) {
  final payslips = ref.watch(driverPayslipsProvider).value ?? [];
  final now = DateTime.now();
  return payslips
      .where((p) => p.createdAt != null && _sameDay(p.createdAt!, now))
      .fold<double>(0, (s, p) => s + p.amount);
});

/// Earnings in the last 7 days.
final weekEarningsProvider = Provider<double>((ref) {
  final payslips = ref.watch(driverPayslipsProvider).value ?? [];
  final cutoff = DateTime.now().subtract(const Duration(days: 7));
  return payslips
      .where((p) => p.createdAt != null && p.createdAt!.isAfter(cutoff))
      .fold<double>(0, (s, p) => s + p.amount);
});

/// Earnings in the last 30 days.
final monthEarningsProvider = Provider<double>((ref) {
  final payslips = ref.watch(driverPayslipsProvider).value ?? [];
  final cutoff = DateTime.now().subtract(const Duration(days: 30));
  return payslips
      .where((p) => p.createdAt != null && p.createdAt!.isAfter(cutoff))
      .fold<double>(0, (s, p) => s + p.amount);
});

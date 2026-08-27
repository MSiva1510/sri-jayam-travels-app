// ─────────────────────────────────────────────────────────────────────────────
// alert_provider.dart — Fleet Alerts Provider
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/alert.dart';
import '../repositories/alert_repository.dart';
import '../services/alert_service.dart';
import '../providers.dart';

// ── Repository & Service ───────────────────────────────────────────────────

final alertRepositoryProvider = Provider<AlertRepository>((ref) {
  return AlertRepository(ref.watch(supabaseClientProvider));
});

final alertServiceProvider = Provider<AlertService>((ref) {
  return AlertService(ref.watch(alertRepositoryProvider));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════
// State classes
// ═════════════════════════════════════════════════════════════════════════════════════════════════════

sealed class AlertState {
  const AlertState();

  T when<T>({
    T Function()? loading,
    required T Function(List<Alert> alerts) loaded,
    T Function(String error)? error,
  }) {
    return switch (this) {
      AlertLoading() => loading?.call() ?? (throw StateError('Loading state but no loading handler provided')),
      AlertLoaded(alerts: var a) => loaded(a),
      AlertError(message: var m) => error?.call(m) ?? (throw StateError('Error state but no error handler provided')),
    };
  }
}

class AlertLoading extends AlertState {
  const AlertLoading();
}

class AlertLoaded extends AlertState {
  const AlertLoaded({required this.alerts});
  final List<Alert> alerts;
}

class AlertError extends AlertState {
  const AlertError(this.message);
  final String message;
}

// ── Repository & Service ───────────────────────────────────────────────────

final alertRepositoryProvider = Provider<AlertRepository>((ref) {
  return AlertRepository(ref.watch(supabaseClientProvider));
});

final alertServiceProvider = Provider<AlertService>((ref) {
  return AlertService(ref.watch(alertRepositoryProvider));
});

// ── Notifier ──────────────────────────────────────────────────────────────────

class AlertNotifier extends StateNotifier<AlertState> {
  AlertNotifier(this._service) : super(const AlertLoading());

  final AlertService _service;

  Future<void> load() async {
    state = const AlertLoading();
    try {
      final alerts = await _service.getActiveAlerts();
      state = AlertLoaded(alerts: alerts);
    } catch (e) {
      state = AlertError(message: e.toString());
    }
  }

  Future<void> loadAll() async {
    state = const AlertLoading();
    try {
      final alerts = await _service.getAllAlerts();
      state = AlertLoaded(alerts: alerts);
    } catch (e) {
      state = AlertError(message: e.toString());
    }
  }

  Future<void> refresh() => load();
}

// ── Providers ────────────────────────────────────────────────────────────────

final alertsProvider = StateNotifierProvider<AlertNotifier, AlertState>((ref) {
  return AlertNotifier(ref.watch(alertServiceProvider));
});

final activeAlertsProvider = StateNotifierProvider<AlertNotifier, AlertState>((ref) {
  return AlertNotifier(ref.watch(alertServiceProvider))..load();
});

final alertDetailProvider = Provider.family<Alert?, String>((ref, id) {
  final state = ref.watch(alertsProvider);
  return state.when(
    loading: () => null,
    loaded: (state) => state.alerts.firstWhereOrNull((a) => a.id == id),
    error: (message) => null,
  );
});

// ── Derived Providers ────────────────────────────────────────────────────────

final criticalAlertsProvider = Provider<List<Alert>>((ref) {
  final state = ref.watch(alertsProvider);
  return state.when(
    loaded: (state) => state.alerts.where((a) => a.priority == 'critical' && !a.isResolved).toList(),
    loading: () => [],
    error: (message) => [],
  );
});

final unresolvedAlertsProvider = Provider<List<Alert>>((ref) {
  final state = ref.watch(alertsProvider);
  return state.when(
    loaded: (state) => state.alerts.where((a) => !a.isResolved).toList(),
    loading: () => [],
    error: (message) => [],
  );
});

final alertCountProvider = Provider<int>((ref) {
  final state = ref.watch(alertsProvider);
  return state.when(
    loaded: (state) => state.alerts.where((a) => !a.isResolved).length,
    loading: () => 0,
    error: (message) => 0,
  );
});
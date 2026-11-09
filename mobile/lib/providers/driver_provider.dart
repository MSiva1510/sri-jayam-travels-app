// ─────────────────────────────────────────────────────────────────────────────
// driver_provider.dart — Driver Data Provider (Manager View)
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/driver_profile.dart';
import '../repositories/driver_repository.dart';
import '../services/driver_service.dart';
import '../providers.dart';

// ── Repository & Service ───────────────────────────────────────────────────

final driverRepositoryProvider = Provider<DriverRepository>((ref) {
  return DriverRepository(ref.watch(supabaseClientProvider));
});

final driverServiceProvider = Provider<DriverService>((ref) {
  return DriverService(ref.watch(driverRepositoryProvider));
});

// ── State ──────────────────────────────────────────────────────────────────

class DriverState {
  const DriverState({
    this.drivers = const [],
    this.isLoading = false,
    this.error,
  });

  final List<DriverProfile> drivers;
  final bool isLoading;
  final String? error;

  DriverState copyWith({
    List<DriverProfile>? drivers,
    bool? isLoading,
    String? error,
  }) => DriverState(
        drivers: drivers ?? this.drivers,
        isLoading: isLoading ?? this.isLoading,
        error: error ?? this.error,
      );

  T when<T>({
    T Function()? loading,
    required T Function(List<DriverProfile> drivers) loaded,
    T Function(String error)? error,
  }) {
    if (isLoading) return loading?.call() ?? (throw StateError('Loading state but no loading handler provided'));
    if (error != null) return error.call(this.error!) ?? (throw StateError('Error state but no error handler provided'));
    return loaded(drivers);
  }
}

class DriverNotifier extends StateNotifier<DriverState> {
  DriverNotifier(this._service) : super(const DriverState());

  final DriverService _service;

  Future<void> load() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final drivers = await _service.getAllDrivers();
      state = state.copyWith(drivers: drivers, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> refresh() => load();
}

// ── Providers ──────────────────────────────────────────────────────────────

final driversProvider = StateNotifierProvider<DriverNotifier, DriverState>((ref) {
  return DriverNotifier(ref.watch(driverServiceProvider));
});

final driverDetailProvider = Provider.family<DriverProfile?, String>((ref, id) {
  final state = ref.watch(driversProvider);
  try {
    return state.drivers.firstWhere((d) => d.id == id);
  } catch (_) {
    return null;
  }
});

// ── Derived Providers ──────────────────────────────────────────────────────

final activeDriversProvider = Provider<List<DriverProfile>>((ref) {
  return ref.watch(driversProvider).drivers.where((d) => d.isActive).toList();
});

final availableDriversProvider = Provider<List<DriverProfile>>((ref) {
  return ref.watch(driversProvider).drivers.where((d) => d.isAvailable).toList();
});

final onLeaveDriversProvider = Provider<List<DriverProfile>>((ref) {
  return ref.watch(driversProvider).drivers.where((d) => d.isOnLeave).toList();
});
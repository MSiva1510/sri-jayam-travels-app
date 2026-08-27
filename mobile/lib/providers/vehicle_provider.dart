// ─────────────────────────────────────────────────────────────────────────────
// vehicle_provider.dart — Vehicle Data Provider
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/vehicle.dart';
import '../repositories/vehicle_repository.dart';
import '../services/vehicle_service.dart';
import '../providers.dart';

// ── Repository & Service ───────────────────────────────────────────────────

final vehicleRepositoryProvider = Provider<VehicleRepository>((ref) {
  return VehicleRepository(ref.watch(supabaseClientProvider));
});

final vehicleServiceProvider = Provider<VehicleService>((ref) {
  return VehicleService(ref.watch(vehicleRepositoryProvider));
});

// ── State ──────────────────────────────────────────────────────────────────

class VehicleState {
  const VehicleState({
    this.vehicles = const [],
    this.isLoading = false,
    this.error,
  });

  final List<Vehicle> vehicles;
  final bool isLoading;
  final String? error;

  VehicleState copyWith({
    List<Vehicle>? vehicles,
    bool? isLoading,
    String? error,
  }) => VehicleState(
        vehicles: vehicles ?? this.vehicles,
        isLoading: isLoading ?? this.isLoading,
        error: error ?? this.error,
      );

  T when<T>({
    T Function()? loading,
    required T Function(List<Vehicle> vehicles) loaded,
    T Function(String error)? error,
  }) {
    if (isLoading) return loading?.call() ?? (throw StateError('Loading state but no loading handler provided'));
    if (error != null) return error.call(this.error!) ?? (throw StateError('Error state but no error handler provided'));
    return loaded(vehicles);
  }
}

class VehicleNotifier extends StateNotifier<VehicleState> {
  VehicleNotifier(this._service) : super(const VehicleState());

  final VehicleService _service;

  Future<void> load() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final vehicles = await _service.getAllVehicles();
      state = state.copyWith(vehicles: vehicles, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> refresh() => load();
}

// ── Providers ──────────────────────────────────────────────────────────────

final vehiclesProvider = StateNotifierProvider<VehicleNotifier, VehicleState>((ref) {
  return VehicleNotifier(ref.watch(vehicleServiceProvider));
});

final vehicleDetailProvider = Provider.family<Vehicle?, String>((ref, id) {
  final state = ref.watch(vehiclesProvider);
  try {
    return state.vehicles.firstWhere((v) => v.id == id);
  } catch (_) {
    return null;
  }
});

// ── Derived Providers ──────────────────────────────────────────────────────

final availableVehiclesProvider = Provider<List<Vehicle>>((ref) {
  return ref.watch(vehiclesProvider).vehicles.where((v) => v.isAvailable).toList();
});

final vehiclesOnTripProvider = Provider<List<Vehicle>>((ref) {
  return ref.watch(vehiclesProvider).vehicles.where((v) => v.currentTripId != null).toList();
});

final vehiclesWithAlertsProvider = Provider<List<Vehicle>>((ref) {
  return ref.watch(vehiclesProvider).vehicles.where((v) => v.hasAlert).toList();
});
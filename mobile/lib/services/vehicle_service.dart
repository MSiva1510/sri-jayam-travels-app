// ─────────────────────────────────────────────────────────────────────────────
// vehicle_service.dart — Vehicle Business Logic
// ─────────────────────────────────────────────────────────────────────────────

import '../repositories/vehicle_repository.dart';
import '../models/vehicle.dart';

class VehicleService {
  VehicleService(this._repository);

  final VehicleRepository _repository;

  Future<List<Vehicle>> getAllVehicles() => _repository.getAllVehicles();

  Future<Vehicle?> getVehicleById(String id) => _repository.getVehicleById(id);

  Future<Vehicle?> getVehicleByRegistration(String registration) => _repository.getVehicleByRegistration(registration);

  Stream<List<Vehicle>> watchVehicles() => _repository.watchVehicles();

  // Derived getters
  List<Vehicle> getAvailableVehicles(List<Vehicle> vehicles) =>
      vehicles.where((v) => v.isAvailable).toList();

  List<Vehicle> getVehiclesOnTrip(List<Vehicle> vehicles) =>
      vehicles.where((v) => v.currentTripId != null).toList();

  List<Vehicle> getVehiclesWithAlerts(List<Vehicle> vehicles) =>
      vehicles.where((v) => v.hasAlert).toList();
}
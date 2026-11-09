// ─────────────────────────────────────────────────────────────────────────────
// driver_service.dart — Driver Business Logic (Manager View)
// ─────────────────────────────────────────────────────────────────────────────

import '../repositories/driver_repository.dart';
import '../models/driver_profile.dart';

class DriverService {
  DriverService(this._repository);

  final DriverRepository _repository;

  Future<List<DriverProfile>> getAllDrivers() => _repository.getAllDrivers();

  Future<DriverProfile?> getDriverById(String id) => _repository.getDriverById(id);

  Future<DriverProfile?> getDriverByProfileId(String profileId) => _repository.getDriverByProfileId(profileId);

  Stream<List<DriverProfile>> watchDrivers() => _repository.watchDrivers();

  // Derived getters
  List<DriverProfile> getActiveDrivers(List<DriverProfile> drivers) =>
      drivers.where((d) => d.isActive).toList();

  List<DriverProfile> getAvailableDrivers(List<DriverProfile> drivers) =>
      drivers.where((d) => d.isAvailable).toList();

  List<DriverProfile> getOnLeaveDrivers(List<DriverProfile> drivers) =>
      drivers.where((d) => d.isOnLeave).toList();
}
// ─────────────────────────────────────────────────────────────────────────────
// trip_service.dart
// Business logic between TripProvider and TripRepository.
// Validates driver context before any query. Maps errors to user-friendly text.
// No UI code, no Supabase imports.
// ─────────────────────────────────────────────────────────────────────────────

import '../repositories/trip_repository.dart';
import '../models/trip.dart';
import '../models/driver_profile.dart';

class TripService {
  TripService(this._repo);

  final TripRepository _repo;

  // ── Guard ─────────────────────────────────────────────────────────────────

  /// Throws a [TripServiceException] if driver context is missing.
  void _requireDriver(DriverProfile? driver) {
    if (driver == null) {
      throw const TripServiceException(
        message: 'Driver profile not loaded. Please log in again.',
        code: TripErrorCode.driverNotFound,
      );
    }
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  Future<List<TripModel>> getDriverTrips(DriverProfile? driver) async {
    _requireDriver(driver);
    try {
      return await _repo.getDriverTrips();
    } catch (e) {
      throw _mapError(e);
    }
  }

  Future<List<TripModel>> getTodayTrips(DriverProfile? driver) async {
    _requireDriver(driver);
    try {
      return await _repo.getTodayTrips();
    } catch (e) {
      throw _mapError(e);
    }
  }

  Future<List<TripModel>> getUpcomingTrips(DriverProfile? driver) async {
    _requireDriver(driver);
    try {
      return await _repo.getUpcomingTrips();
    } catch (e) {
      throw _mapError(e);
    }
  }

  Future<TripModel?> getTripById(
    String tripId,
    DriverProfile? driver,
  ) async {
    _requireDriver(driver);
    try {
      final trip = await _repo.getTripById(tripId);
      if (trip == null) {
        throw const TripServiceException(
          message: 'Trip not found.',
          code: TripErrorCode.notFound,
        );
      }
      // Defence-in-depth: verify driver matches even if RLS passed
      final driverIdMatch   = trip.driverId != null && trip.driverId == driver!.id;
      final driverNameMatch = trip.driverName != null &&
          trip.driverName!.toLowerCase() == driver!.name.toLowerCase();

      if (!driverIdMatch && !driverNameMatch) {
        throw const TripServiceException(
          message: 'You do not have access to this trip.',
          code: TripErrorCode.unauthorized,
        );
      }
      return trip;
    } catch (e) {
      if (e is TripServiceException) rethrow;
      throw _mapError(e);
    }
  }

  Future<int> getTodayTripCount(DriverProfile? driver) async {
    if (driver == null) return 0;
    try {
      return await _repo.getTodayTripCount();
    } catch (_) {
      return 0;
    }
  }

  // ── Error mapping ─────────────────────────────────────────────────────────

  TripServiceException _mapError(Object e) {
    final msg = e.toString().toLowerCase();

    if (msg.contains('network') ||
        msg.contains('socket') ||
        msg.contains('connection')) {
      return const TripServiceException(
        message: 'No internet connection. Pull down to retry.',
        code: TripErrorCode.network,
      );
    }
    if (msg.contains('permission') || msg.contains('rls') || msg.contains('policy')) {
      return const TripServiceException(
        message: 'Access denied. Contact your administrator.',
        code: TripErrorCode.unauthorized,
      );
    }
    if (msg.contains('jwt') || msg.contains('session') || msg.contains('expired')) {
      return const TripServiceException(
        message: 'Your session has expired. Please log in again.',
        code: TripErrorCode.sessionExpired,
      );
    }
    return TripServiceException(
      message: 'Failed to load trips. Please try again.',
      code: TripErrorCode.unknown,
      detail: e.toString(),
    );
  }
}

// ── Exception ─────────────────────────────────────────────────────────────────

class TripServiceException implements Exception {
  final String message;
  final TripErrorCode code;
  final String? detail;

  const TripServiceException({
    required this.message,
    this.code = TripErrorCode.unknown,
    this.detail,
  });

  @override
  String toString() => 'TripServiceException($code): $message';
}

enum TripErrorCode {
  driverNotFound,
  notFound,
  unauthorized,
  network,
  sessionExpired,
  unknown,
}

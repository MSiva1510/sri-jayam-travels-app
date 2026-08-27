// ─────────────────────────────────────────────────────────────────────────────
// vehicle.dart — Vehicle Model
// Mirrors the `vehicles` table used by the Web ERP.
// ─────────────────────────────────────────────────────────────────────────────

class Vehicle {
  final String id;
  final String registration;
  final String make;
  final String model;
  final String type;
  final int? year;
  final String? fuelType;
  final String status;
  final DateTime? insuranceExpiry;
  final DateTime? permitExpiry;
  final DateTime? fcExpiry;
  final DateTime? pucExpiry;
  final int? currentKm;
  final int? lastServiceKm;
  final int? nextServiceKm;
  final String? assignedDriverId;
  final String? currentTripId;
  final double? gpsLatitude;
  final double? gpsLongitude;
  final double? gpsSpeed;
  final double? gpsHeading;
  final DateTime? gpsUpdatedAt;
  final bool hasActiveAlert;

  const Vehicle({
    required this.id,
    required this.registration,
    required this.make,
    required this.model,
    required this.type,
    this.year,
    this.fuelType,
    required this.status,
    this.insuranceExpiry,
    this.permitExpiry,
    this.fcExpiry,
    this.pucExpiry,
    this.currentKm,
    this.lastServiceKm,
    this.nextServiceKm,
    this.assignedDriverId,
    this.currentTripId,
    this.gpsLatitude,
    this.gpsLongitude,
    this.gpsSpeed,
    this.gpsHeading,
    this.gpsUpdatedAt,
    this.hasActiveAlert = false,
  });

  factory Vehicle.fromMap(Map<String, dynamic> m) {
    return Vehicle(
      id: m['id'] as String? ?? '',
      registration: m['registration'] as String? ?? '',
      make: m['make'] as String? ?? '',
      model: m['model'] as String? ?? '',
      type: m['type'] as String? ?? '',
      year: m['year'] as int?,
      fuelType: m['fuel_type'] as String?,
      status: m['status'] as String? ?? 'available',
      insuranceExpiry: _parseDate(m['insurance_expiry']),
      permitExpiry: _parseDate(m['permit_expiry']),
      fcExpiry: _parseDate(m['fc_expiry']),
      pucExpiry: _parseDate(m['puc_expiry']),
      currentKm: m['current_km'] as int?,
      lastServiceKm: m['last_service_km'] as int?,
      nextServiceKm: m['next_service_km'] as int?,
      assignedDriverId: m['assigned_driver_id'] as String?,
      currentTripId: m['current_trip_id'] as String?,
      gpsLatitude: _parseDouble(m['gps_latitude']),
      gpsLongitude: _parseDouble(m['gps_longitude']),
      gpsSpeed: _parseDouble(m['gps_speed']),
      gpsHeading: _parseDouble(m['gps_heading']),
      gpsUpdatedAt: _parseDateTime(m['gps_updated_at']),
      hasActiveAlert: m['has_active_alert'] as bool? ?? false,
    );
  }

  // ── Computed helpers ──────────────────────────────────────────────────────

  bool get isAvailable => status == 'available';
  bool get isActive => status == 'active' || status == 'on_trip';
  bool get isOnTrip => status == 'on_trip';
  bool get isMaintenance => status == 'maintenance';
  bool get isOffline => status == 'offline';
  bool get isMoving => gpsSpeed != null && gpsSpeed! > 5;
  bool get hasAlert => hasActiveAlert;

  // Manager-facing computed getters (alias existing fields for compatibility)
  String? get currentDriver => assignedDriverId;
  DateTime? get lastGpsUpdate => gpsUpdatedAt;
  double? get speed => gpsSpeed;

  String get statusDisplay => switch (status) {
    'available' => 'Available',
    'on_trip' => 'On Trip',
    'maintenance' => 'Maintenance',
    'offline' => 'Offline',
    _ => status,
  };

  static DateTime? _parseDate(dynamic v) {
    if (v == null) return null;
    return DateTime.tryParse(v.toString());
  }

  static DateTime? _parseDateTime(dynamic v) {
    if (v == null) return null;
    return DateTime.tryParse(v.toString())?.toLocal();
  }

  static double? _parseDouble(dynamic v) {
    if (v == null) return null;
    return (v as num).toDouble();
  }

  @override
  bool operator ==(Object other) => other is Vehicle && other.id == id;

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() => 'Vehicle(id: $id, registration: $registration, status: $status)';
}
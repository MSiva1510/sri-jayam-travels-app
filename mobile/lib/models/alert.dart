// ─────────────────────────────────────────────────────────────────────────────
// alert.dart — Fleet Alert Model
// ─────────────────────────────────────────────────────────────────────────────

class Alert {
  final String id;
  final String title;
  final String? description;
  final String priority; // critical, high, medium, low
  final String category; // trip, gps, vehicle, driver, document, system
  final String status; // active, acknowledged, resolved, closed
  final String? vehicleId;
  final String? vehicleReg;
  final String? driverId;
  final String? driverName;
  final String? tripId;
  final DateTime createdAt;
  final DateTime? acknowledgedAt;
  final DateTime? resolvedAt;
  final String? acknowledgedBy;
  final String? resolvedBy;
  final Map<String, dynamic>? metadata;

  const Alert({
    required this.id,
    required this.title,
    this.description,
    required this.priority,
    required this.category,
    required this.status,
    this.vehicleId,
    this.vehicleReg,
    this.driverId,
    this.driverName,
    this.tripId,
    required this.createdAt,
    this.acknowledgedAt,
    this.resolvedAt,
    this.acknowledgedBy,
    this.resolvedBy,
    this.metadata,
  });

  factory Alert.fromMap(Map<String, dynamic> map) {
    return Alert(
      id: map['id'] as String? ?? '',
      title: map['title'] as String? ?? '',
      description: map['description'] as String?,
      priority: map['priority'] as String? ?? 'medium',
      category: map['category'] as String? ?? 'system',
      status: map['status'] as String? ?? 'active',
      vehicleId: map['vehicle_id'] as String?,
      vehicleReg: map['vehicle_reg'] as String?,
      driverId: map['driver_id'] as String?,
      driverName: map['driver_name'] as String?,
      tripId: map['trip_id'] as String?,
      createdAt: _parseDateTime(map['created_at']),
      acknowledgedAt: _parseDateTime(map['acknowledged_at']),
      resolvedAt: _parseDateTime(map['resolved_at']),
      acknowledgedBy: map['acknowledged_by'] as String?,
      resolvedBy: map['resolved_by'] as String?,
      metadata: map['metadata'] as Map<String, dynamic>?,
    );
  }

  static DateTime _parseDateTime(dynamic value) {
    if (value == null) return DateTime.now();
    if (value is DateTime) return value;
    if (value is String) return DateTime.tryParse(value) ?? DateTime.now();
    return DateTime.now();
  }

  bool get isResolved => status == 'resolved' || status == 'closed';
  bool get isAcknowledged => status == 'acknowledged' || isResolved;
  bool get isActive => status == 'active';

  String get priorityDisplay => priority.toUpperCase();
  String get categoryDisplay => category.toUpperCase();
  String get statusDisplay => status.toUpperCase();

  @override
  String toString() => 'Alert(id: $id, title: $title, priority: $priority)';

  @override
  bool operator ==(Object other) => other is Alert && other.id == id;

  @override
  int get hashCode => id.hashCode;
}
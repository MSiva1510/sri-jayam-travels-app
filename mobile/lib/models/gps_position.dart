// ─────────────────────────────────────────────────────────────────────────────
// gps_position.dart
// Lightweight GPS position model for Day 46 foundation.
// Wraps the geolocator Position with only the fields we actually use.
// ─────────────────────────────────────────────────────────────────────────────

class GpsPosition {
  final double   latitude;
  final double   longitude;
  final double   accuracy;   // metres
  final double?  speed;      // m/s
  final double?  heading;    // degrees
  final DateTime timestamp;

  const GpsPosition({
    required this.latitude,
    required this.longitude,
    required this.accuracy,
    required this.timestamp,
    this.speed,
    this.heading,
  });

  /// Round-trip through map for Supabase storage (Day 47+)
  Map<String, dynamic> toMap() => {
        'latitude':  latitude,
        'longitude': longitude,
        'accuracy':  accuracy,
        'speed':     speed,
        'heading':   heading,
        'timestamp': timestamp.toUtc().toIso8601String(),
      };

  @override
  String toString() =>
      'GpsPosition($latitude, $longitude ±${accuracy.toStringAsFixed(0)}m)';
}

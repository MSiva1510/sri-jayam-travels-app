// ─────────────────────────────────────────────────────────────────────────────
// vehicle_repository.dart — Vehicle Data Access
// ─────────────────────────────────────────────────────────────────────────────

import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/vehicle.dart';
import '../core/config/supabase_config.dart';

class VehicleRepository {
  VehicleRepository(this._supabase);

  final SupabaseClient _supabase;

  Future<List<Vehicle>> getAllVehicles() async {
    final response = await _supabase
        .from(SupabaseConfig.vehiclesTable)
        .select('''
          id, registration, make, model, type, year, fuel_type,
          status, insurance_expiry, permit_expiry, fc_expiry, puc_expiry,
          current_km, last_service_km, next_service_km,
          assigned_driver_id, current_trip_id,
          gps_latitude, gps_longitude, gps_speed, gps_heading, gps_updated_at,
          has_active_alert
        ''')
        .order('registration');

    return (response as List).map((json) => Vehicle.fromMap(json)).toList();
  }

  Future<Vehicle?> getVehicleById(String id) async {
    final response = await _supabase
        .from(SupabaseConfig.vehiclesTable)
        .select('''
          id, registration, make, model, type, year, fuel_type,
          status, insurance_expiry, permit_expiry, fc_expiry, puc_expiry,
          current_km, last_service_km, next_service_km,
          assigned_driver_id, current_trip_id,
          gps_latitude, gps_longitude, gps_speed, gps_heading, gps_updated_at,
          has_active_alert
        ''')
        .eq('id', id)
        .maybeSingle();

    if (response == null) return null;
    return Vehicle.fromMap(response);
  }

  Future<Vehicle?> getVehicleByRegistration(String registration) async {
    final response = await _supabase
        .from(SupabaseConfig.vehiclesTable)
        .select()
        .eq('registration', registration)
        .maybeSingle();

    if (response == null) return null;
    return Vehicle.fromMap(response);
  }

  Stream<List<Vehicle>> watchVehicles() {
    return _supabase
        .from(SupabaseConfig.vehiclesTable)
        .stream(primaryKey: ['id'])
        .map((data) => data.map((json) => Vehicle.fromMap(json)).toList());
  }
}
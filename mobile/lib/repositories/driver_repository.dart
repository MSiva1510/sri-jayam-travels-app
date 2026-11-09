// ─────────────────────────────────────────────────────────────────────────────
// driver_repository.dart — Driver Data Access (Manager View)
// ─────────────────────────────────────────────────────────────────────────────

import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/driver_profile.dart';
import '../core/config/supabase_config.dart';

class DriverRepository {
  DriverRepository(this._supabase);

  final SupabaseClient _supabase;

  Future<List<DriverProfile>> getAllDrivers() async {
    final response = await _supabase
        .from(SupabaseConfig.driversTable)
        .select('''
          id, driver_id, profile_id, name, email, phone, address, city,
          status, salary_type, base_salary, daily_bata, per_trip_incentive,
          joined_date, license_number, license_expiry, license_photo_url,
          aadhar_number, date_of_birth, bank_account, bank_ifsc, bank_name,
          emergency_contact, emergency_phone, photo_url, avatar_url, notes,
          created_at, updated_at
        ''')
        .order('name');

    return (response as List).map((json) => DriverProfile.fromMap(json)).toList();
  }

  Future<DriverProfile?> getDriverById(String id) async {
    final response = await _supabase
        .from(SupabaseConfig.driversTable)
        .select()
        .eq('id', id)
        .maybeSingle();

    if (response == null) return null;
    return DriverProfile.fromMap(response);
  }

  Future<DriverProfile?> getDriverByProfileId(String profileId) async {
    final response = await _supabase
        .from(SupabaseConfig.driversTable)
        .select()
        .eq('profile_id', profileId)
        .maybeSingle();

    if (response == null) return null;
    return DriverProfile.fromMap(response);
  }

  Stream<List<DriverProfile>> watchDrivers() {
    return _supabase
        .from(SupabaseConfig.driversTable)
        .stream(primaryKey: ['id'])
        .map((data) => data.map((json) => DriverProfile.fromMap(json)).toList());
  }
}
// ─────────────────────────────────────────────────────────────────────────────
// supabase_config.dart
// Supabase connection constants for the Sri Jayam Travels Flutter app.
//
// anonKey / publishableKey is a CLIENT-SIDE key — safe to embed in mobile apps.
// It is restricted by Row Level Security policies on the server.
// NEVER put the service-role key here.
// ─────────────────────────────────────────────────────────────────────────────

import 'package:supabase_flutter/supabase_flutter.dart';

class SupabaseConfig {
  SupabaseConfig._();

  static const String url = 'https://qxirmjvbufxxlkogelfj.supabase.co';

  /// Publishable / anon key — safe for mobile clients.
  /// RLS policies on the server restrict what each role can access.
  static const String anonKey =
      'sb_publishable_GwZ25Lwj--A-MtKRaxEbrg_De5mz6eE';

  /// The already-initialized Supabase client (see `Supabase.initialize` in
  /// main.dart). Screens and providers should read the client through this
  /// getter rather than constructing their own.
  static SupabaseClient get supabase => Supabase.instance.client;

  // ── Table names ─────────────────────────────────────────────────────────
  static const String profilesTable     = 'profiles';
  static const String driversTable      = 'drivers';
  static const String bookingsTable     = 'bookings';
  static const String tripsTable        = 'trips';
  static const String attendanceTable   = 'attendance';
  static const String tripPayslipsTable = 'trip_payslips';

  // ── Storage buckets ──────────────────────────────────────────────────────
  static const String avatarsBucket   = 'avatars';
  static const String documentsBucket = 'documents';
}
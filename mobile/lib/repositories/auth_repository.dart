// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// auth_repository.dart
// ONLY layer that touches Supabase directly for auth + profiles.
// No UI code. No business logic. Returns raw data or throws.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:sri_jayam_travels_mobile/core/config/supabase_config.dart';
import 'package:sri_jayam_travels_mobile/models/user_profile.dart';
import 'package:sri_jayam_travels_mobile/models/driver_profile.dart';

class AuthRepository {
  AuthRepository(this._supabase);

  final SupabaseClient _supabase;

  // â”€â”€ Auth â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /// Sign in with email + password.
  /// Throws [AuthException] on failure.
  Future<AuthResponse> signIn({
    required String email,
    required String password,
  }) => _supabase.auth.signInWithPassword(
    email: email.trim().toLowerCase(),
    password: password,
  );

  /// Sign out from Supabase.
  Future<void> signOut() => _supabase.auth.signOut();

  /// Current Supabase session (null if not logged in).
  Session? get currentSession => _supabase.auth.currentSession;

  /// Current Supabase user (null if not logged in).
  User? get currentUser => _supabase.auth.currentUser;

  /// Stream of auth state changes.
  Stream<AuthState> get authStateChanges =>
      _supabase.auth.onAuthStateChange.map(
        (e) => e.session != null
            ? const AuthState.signedIn()
            : const AuthState.signedOut(),
      );

  /// Low-level stream for full event data.
  Stream<AuthChangeEvent> get rawAuthEvents =>
      _supabase.auth.onAuthStateChange.map((e) => e.event);

  /// Send a password-reset email.
  Future<void> resetPassword(String email) =>
      _supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());

  // â”€â”€ Profiles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /// Fetch the `profiles` row for [userId] (= auth.uid()).
  /// Returns null if no row found.
  Future<UserProfile?> getUserProfile(String userId) async {
    final data = await _supabase
        .from(SupabaseConfig.profilesTable)
        .select('id, email, full_name, role')
        .eq('id', userId)
        .maybeSingle();

    if (data == null) return null;
    return UserProfile.fromMap(data);
  }

  // â”€â”€ Drivers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /// Fetch the `drivers` row for the logged-in user.
  ///
  /// Strategy:
  ///   1. Fast path  â€” profile_id FK (added in Day 42 migration)
  ///   2. Fallback   â€” email match (for legacy rows not yet back-filled)
  ///
  /// Returns null if no driver record exists.
  Future<DriverProfile?> getDriverProfile({
    required String userId,
    required String email,
  }) async {
    // 1. Fast path via profile_id
    final byProfileId = await _supabase
        .from(SupabaseConfig.driversTable)
        .select()
        .eq('profile_id', userId)
        .maybeSingle();

    if (byProfileId != null) {
      return DriverProfile.fromMap(byProfileId);
    }

    // 2. Fallback via email
    final byEmail = await _supabase
        .from(SupabaseConfig.driversTable)
        .select()
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

    if (byEmail != null) {
      // Back-fill profile_id so fast path works next time
      await _backFillProfileId(
        driverId: byEmail['id'] as String,
        userId: userId,
      );
      return DriverProfile.fromMap(byEmail);
    }

    return null;
  }

  /// Silently write profile_id â€” fire-and-forget, no throw on failure.
  Future<void> _backFillProfileId({
    required String driverId,
    required String userId,
  }) async {
    try {
      await _supabase
          .from(SupabaseConfig.driversTable)
          .update({'profile_id': userId})
          .eq('id', driverId);
    } catch (_) {
      // Non-critical â€” the fallback email path will still work next login
    }
  }
}

// â”€â”€ Thin extension to help with sealed-class-style auth events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
extension _AuthStateEx on AuthState {
  static AuthState get signedIn => throw UnimplementedError();
  static AuthState get signedOut => throw UnimplementedError();
}


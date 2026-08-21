import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/config/supabase_config.dart';

/// The signed-in driver's basic profile data, loaded from the active
/// Supabase session. `null` means signed out; loading/error states are
/// surfaced through [AsyncValue] (see usage via `.when(...)` in
/// DriverHomeScreen).
final authProvider = StateNotifierProvider<AuthStateNotifier,
    AsyncValue<Map<String, dynamic>?>>((ref) {
  return AuthStateNotifier();
});

class AuthStateNotifier extends StateNotifier<AsyncValue<Map<String, dynamic>?>> {
  AuthStateNotifier() : super(const AsyncLoading()) {
    _checkAuthStatus();
  }

  Future<void> _checkAuthStatus() async {
    try {
      final session = SupabaseConfig.supabase.auth.currentSession;
      if (session == null) {
        state = const AsyncData(null);
      } else {
        // In a real implementation, we would fetch user profile here
        // For now, returning mock data for demonstration
        final userData = {
          'id': session.user.id,
          'email': session.user.email,
          'full_name': 'Driver Name',
          'avatar_url': null,
          // Add other fields as needed from the actual Supabase schema
        };
        state = AsyncData(userData);
      }
    } catch (e, stackTrace) {
      state = AsyncError(e, stackTrace);
    }
  }

  Future<void> signOut() async {
    state = const AsyncLoading();
    try {
      await SupabaseConfig.supabase.auth.signOut();
      state = const AsyncData(null);
    } catch (e, stackTrace) {
      state = AsyncError(e, stackTrace);
    }
  }
}

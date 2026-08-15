// ─────────────────────────────────────────────────────────────────────────────
// auth_provider.dart
// Riverpod StateNotifier for auth.
// This is the ONLY place the UI reads auth state.
// ─────────────────────────────────────────────────────────────────────────────

import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' hide AuthState;

import '../core/auth/auth_state.dart';
import '../repositories/auth_repository.dart';
import '../services/auth_service.dart';

// ── Singleton providers ───────────────────────────────────────────────────────

final supabaseClientProvider = Provider<SupabaseClient>(
  (ref) => Supabase.instance.client,
);

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(ref.watch(supabaseClientProvider)),
);

final authServiceProvider = Provider<AuthService>(
  (ref) => AuthService(ref.watch(authRepositoryProvider)),
);

// ── Auth state notifier ───────────────────────────────────────────────────────

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier(this._service, this._repo) : super(const AuthInitializing()) {
    _init();
  }

  final AuthService    _service;
  final AuthRepository _repo;
  StreamSubscription<AuthChangeEvent>? _authSub;

  // ── Startup ─────────────────────────────────────────────────────────────

  Future<void> _init() async {
    // Listen for token refreshes and external sign-outs
    _authSub = _repo.rawAuthEvents.listen(_onAuthEvent);

    // Restore any existing session
    state = const AuthLoadingProfile();
    state = await _service.restoreSession();
  }

  void _onAuthEvent(AuthChangeEvent event) {
    switch (event) {
      case AuthChangeEvent.tokenRefreshed:
        // Session refreshed by Supabase SDK automatically — no action needed
        break;
      case AuthChangeEvent.signedOut:
        // Externally signed out (another device / token revoked)
        if (state is! AuthUnauthenticated) {
          state = const AuthUnauthenticated();
        }
        break;
      // userDeleted removed in newer SDK versions — handled by signedOut

      default:
        break;
    }
  }

  // ── Public actions ───────────────────────────────────────────────────────

  Future<void> login({required String email, required String password}) async {
    state = const AuthAuthenticating();
    final next = await _service.login(email: email, password: password);
    state = next;
  }

  Future<void> logout() async {
    // Stop GPS / realtime / local caches here before sign-out.
    // Day 43+ will hook GPS services; add calls here as each day is built.

    try {
      await _service.logout();
    } catch (_) {
      // Always navigate to login even if sign-out call fails
    }
    state = const AuthUnauthenticated();
  }

  Future<void> refreshProfile() async {
    final current = state;
    if (current is! AuthAuthenticated) return;

    state = const AuthLoadingProfile();
    state = await _service.refreshProfile(
      userId: current.profile.id,
      email:  current.profile.email,
    );
  }

  // ── Dispose ──────────────────────────────────────────────────────────────

  @override
  void dispose() {
    _authSub?.cancel();
    super.dispose();
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

final authProvider =
    StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(
    ref.watch(authServiceProvider),
    ref.watch(authRepositoryProvider),
  );
});

// ── Convenience selectors (avoid rebuilds from unrelated state changes) ───────

final isAuthenticatedProvider = Provider<bool>((ref) {
  return ref.watch(authProvider) is AuthAuthenticated;
});

final currentProfileProvider = Provider((ref) {
  final s = ref.watch(authProvider);
  return s is AuthAuthenticated ? s.profile : null;
});

final currentDriverProvider = Provider((ref) {
  final s = ref.watch(authProvider);
  return s is AuthAuthenticated ? s.driverProfile : null;
});
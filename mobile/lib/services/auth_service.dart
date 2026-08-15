// ─────────────────────────────────────────────────────────────────────────────
// auth_service.dart
// Business-logic layer. Orchestrates auth flow, validates roles,
// translates errors into user-friendly messages.
// No UI code. No Supabase imports.
// ─────────────────────────────────────────────────────────────────────────────

import '../repositories/auth_repository.dart';
import '../core/auth/auth_state.dart';
import '../core/errors/auth_errors.dart';
import '../models/user_profile.dart';
import '../models/driver_profile.dart';

/// Roles that are allowed to use the mobile driver app.
const _allowedRoles = {'driver','admin','manager'};

class AuthService {
  AuthService(this._repo);

  final AuthRepository _repo;

  // ── Login ─────────────────────────────────────────────────────────────────

  /// Full login flow:
  /// signIn → load profile → validate role → load driver record
  ///
  /// Returns [AuthAuthenticated] on success or an [AuthError] on any failure.
  Future<AuthState> login({
    required String email,
    required String password,
  }) async {
    try {
      // 1. Authenticate
      final response = await _repo.signIn(email: email, password: password);
      final user = response.user;
      if (user == null) {
        return const AuthError(
          message: 'Login failed. Please try again.',
          code: AuthErrorCode.unknown,
        );
      }

      // 2. Load profile
      return await _loadProfileAndDriver(userId: user.id, email: email);
    } catch (e) {
      final mapped = AuthErrorMapper.fromException(e);
      return AuthError(message: mapped.message, code: mapped.code);
    }
  }

  // ── Session restore ────────────────────────────────────────────────────────

  /// Called on app startup. Returns the correct AuthState based on the
  /// existing Supabase session.
  Future<AuthState> restoreSession() async {
    try {
      final session = _repo.currentSession;
      if (session == null || session.isExpired) {
        return const AuthUnauthenticated();
      }

      final user = _repo.currentUser;
      if (user == null) return const AuthUnauthenticated();

      return await _loadProfileAndDriver(
        userId: user.id,
        email:  user.email ?? '',
      );
    } catch (e) {
      // Session exists but something failed — treat as unauthenticated
      // rather than crashing the app.
      return const AuthUnauthenticated();
    }
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  /// Wraps sign-out. Callers must:
  ///   • stop GPS services
  ///   • cancel realtime subscriptions
  ///   • clear local caches
  /// (Done by AuthNotifier before calling this.)
  Future<void> logout() => _repo.signOut();

  // ── Password reset ────────────────────────────────────────────────────────

  /// Returns null on success, error message on failure.
  Future<String?> sendPasswordReset(String email) async {
    try {
      await _repo.resetPassword(email);
      return null;
    } catch (e) {
      return AuthErrorMapper.fromException(e).message;
    }
  }

  // ── Profile refresh ───────────────────────────────────────────────────────

  /// Re-fetches profile + driver record for an already-authenticated user.
  Future<AuthState> refreshProfile({
    required String userId,
    required String email,
  }) =>
      _loadProfileAndDriver(userId: userId, email: email);

  // ── Shared internal flow ──────────────────────────────────────────────────

  Future<AuthState> _loadProfileAndDriver({
    required String userId,
    required String email,
  }) async {
    // 1. Profile
    final UserProfile? profile = await _repo.getUserProfile(userId);
    if (profile == null) {
      final err = AuthErrorMapper.profileNotFound();
      return AuthError(message: err.message, code: err.code);
    }

    // 2. Role validation
    if (!_allowedRoles.contains(profile.role)) {
      final err = AuthErrorMapper.unauthorizedRole(profile.role);
      return AuthError(message: err.message, code: err.code);
    }

    // 3. Driver record
    final DriverProfile? driver = await _repo.getDriverProfile(
      userId: userId,
      email:  profile.email,
    );
    if (driver == null) {
      final err = AuthErrorMapper.driverNotFound();
      return AuthError(message: err.message, code: err.code);
    }

    return AuthAuthenticated(profile: profile, driverProfile: driver);
  }

  // ── Convenience getters ──────────────────────────────────────────────────
  bool get hasSession => _repo.currentSession != null;
}
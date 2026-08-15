// ─────────────────────────────────────────────────────────────────────────────
// auth_errors.dart
// Translates raw Supabase / network exceptions into user-friendly messages.
// Nothing from this file should appear directly in UI widgets.
// ─────────────────────────────────────────────────────────────────────────────

import 'package:supabase_flutter/supabase_flutter.dart' hide AuthState;
import '../auth/auth_state.dart';

class AuthErrorMapper {
  AuthErrorMapper._();

  static ({String message, AuthErrorCode code}) fromException(Object e) {
    if (e is AuthException) {
      return _fromAuthException(e);
    }

    final msg = e.toString().toLowerCase();

    if (msg.contains('network') ||
        msg.contains('socket') ||
        msg.contains('connection') ||
        msg.contains('timeout')) {
      return (
        message: 'No internet connection. Please check your network and try again.',
        code: AuthErrorCode.networkUnavailable,
      );
    }

    return (
      message: 'Something went wrong. Please try again.',
      code: AuthErrorCode.unknown,
    );
  }

  static ({String message, AuthErrorCode code}) _fromAuthException(
    AuthException e,
  ) {
    final msg = e.message.toLowerCase();

    if (msg.contains('invalid login') ||
        msg.contains('invalid credentials') ||
        msg.contains('wrong password') ||
        msg.contains('user not found')) {
      return (
        message: 'Incorrect email or password. Please try again.',
        code: AuthErrorCode.invalidCredentials,
      );
    }

    if (msg.contains('email not confirmed')) {
      return (
        message: 'Your email address has not been verified. '
            'Please check your inbox for a confirmation link.',
        code: AuthErrorCode.emailNotConfirmed,
      );
    }

    if (msg.contains('session') || msg.contains('token') || msg.contains('expired')) {
      return (
        message: 'Your session has expired. Please log in again.',
        code: AuthErrorCode.sessionExpired,
      );
    }

    if (msg.contains('network') || msg.contains('connection')) {
      return (
        message: 'Network error. Please check your connection.',
        code: AuthErrorCode.networkUnavailable,
      );
    }

    return (
      message: 'Authentication failed. Please try again.',
      code: AuthErrorCode.unknown,
    );
  }

  // Business-level errors (not Supabase auth errors)
  static ({String message, AuthErrorCode code}) profileNotFound() => (
        message: 'Your account profile could not be found. '
            'Please contact your administrator.',
        code: AuthErrorCode.profileNotFound,
      );

  static ({String message, AuthErrorCode code}) driverNotFound() => (
        message: 'No driver record is linked to your account. '
            'Please contact your administrator.',
        code: AuthErrorCode.driverNotFound,
      );

  static ({String message, AuthErrorCode code}) unauthorizedRole(String role) => (
        message: 'Access denied. This app is for drivers only. '
            'Your role is "$role".',
        code: AuthErrorCode.unauthorizedRole,
      );
}
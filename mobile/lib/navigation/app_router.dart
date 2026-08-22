// ─────────────────────────────────────────────────────────────────────────────
// app_router.dart — Day 46
// Added: no-connection route (session valid but offline on startup)
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/auth/auth_state.dart';
import '../providers/auth_provider.dart';
import '../screens/auth/login_screen.dart';
import '../screens/auth/forgot_password_screen.dart';
import '../screens/auth/unauthorized_screen.dart';
import '../screens/auth/no_connection_screen.dart';
import '../screens/driver/driver_home_screen.dart';
import '../screens/driver/driver_profile_screen.dart';
import '../screens/driver/driver_trips_screen.dart';
import '../screens/driver/trip_details_screen.dart';
import '../screens/driver/trip_map_screen.dart';
import '../screens/driver/driver_bookings_screen.dart';
import '../screens/driver/booking_details_screen.dart';
import '../screens/driver/attendance_screen.dart';
import '../screens/driver/attendance_history_screen.dart';

class AppRoutes {
  AppRoutes._();

  static const login             = '/login';
  static const forgotPassword    = '/forgot-password';
  static const unauthorized      = '/unauthorized';
  static const noConnection      = '/no-connection';
  static const driverHome        = '/driver';
  static const driverProfile     = '/driver/profile';
  static const driverTrips       = '/driver/trips';
  static const driverBookings    = '/driver/bookings';
  static const attendance        = '/driver/attendance';
  static const attendanceHistory = '/driver/attendance/history';

  static String tripDetail(String id)    => '/driver/trips/$id';
  static String tripMap(String id)       => '/driver/trips/$id/map';
  static String bookingDetail(String id) => '/driver/bookings/$id';
}

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: AppRoutes.driverHome,
    refreshListenable: _AuthListenable(ref),
    redirect: (context, state) {
      final auth    = ref.read(authProvider);
      final goingTo = state.matchedLocation;
      final isPublic = goingTo == AppRoutes.login ||
                       goingTo == AppRoutes.forgotPassword;

      return switch (auth) {
        // Still loading — stay put
        AuthInitializing() || AuthLoadingProfile() => null,

        // Authenticated successfully
        AuthAuthenticated(:final profile) =>
            isPublic
                ? AppRoutes.driverHome
                : (!profile.isDriver ? AppRoutes.unauthorized : null),

        // No session
        AuthUnauthenticated() || AuthAuthenticating() =>
            isPublic ? null : AppRoutes.login,

        // Error states
        AuthError(:final code) => switch (code) {
            // Session valid but no network — show retry screen, NOT login
            AuthErrorCode.networkUnavailable =>
                goingTo == AppRoutes.noConnection ? null : AppRoutes.noConnection,
            // Wrong role
            AuthErrorCode.unauthorizedRole => AppRoutes.unauthorized,
            // Everything else → login
            _ => isPublic ? null : AppRoutes.login,
          },
      };
    },
    routes: [
      // ── Public ──────────────────────────────────────────────────────────
      GoRoute(
        path: AppRoutes.login,
        name: 'login',
        pageBuilder: (_, __) =>
            const NoTransitionPage(child: LoginScreen()),
      ),
      GoRoute(
        path: AppRoutes.forgotPassword,
        name: 'forgotPassword',
        pageBuilder: (_, __) =>
            const NoTransitionPage(child: ForgotPasswordScreen()),
      ),
      GoRoute(
        path: AppRoutes.unauthorized,
        name: 'unauthorized',
        pageBuilder: (_, __) =>
            const NoTransitionPage(child: UnauthorizedScreen()),
      ),
      GoRoute(
        path: AppRoutes.noConnection,
        name: 'noConnection',
        pageBuilder: (_, __) =>
            const NoTransitionPage(child: NoConnectionScreen()),
      ),

      // ── Driver — Home & Profile ──────────────────────────────────────
      GoRoute(
        path: AppRoutes.driverHome,
        name: 'driverHome',
        pageBuilder: (_, __) =>
            const NoTransitionPage(child: DriverHomeScreen()),
      ),
      GoRoute(
        path: AppRoutes.driverProfile,
        name: 'driverProfile',
        pageBuilder: (_, __) =>
            const MaterialPage(child: DriverProfileScreen()),
      ),

      // ── Driver — Trips ─────────────────────────────────────────────
      GoRoute(
        path: AppRoutes.driverTrips,
        name: 'driverTrips',
        pageBuilder: (_, __) =>
            const MaterialPage(child: DriverTripsScreen()),
      ),
      GoRoute(
        path: '/driver/trips/:id',
        name: 'tripDetail',
        pageBuilder: (_, state) {
          final id = state.pathParameters['id']!;
          return MaterialPage(child: TripDetailsScreen(tripId: id));
        },
        routes: [
          GoRoute(
            path: 'map',
            name: 'tripMap',
            pageBuilder: (_, state) {
              final id = state.pathParameters['id']!;
              return MaterialPage(child: TripMapScreen(tripId: id));
            },
          ),
        ],
      ),

      // ── Driver — Bookings ──────────────────────────────────────────
      GoRoute(
        path: AppRoutes.driverBookings,
        name: 'driverBookings',
        pageBuilder: (_, __) =>
            const MaterialPage(child: DriverBookingsScreen()),
      ),
      GoRoute(
        path: '/driver/bookings/:id',
        name: 'bookingDetail',
        pageBuilder: (_, state) {
          final id = state.pathParameters['id']!;
          return MaterialPage(child: BookingDetailsScreen(bookingId: id));
        },
      ),

      // ── Driver — Attendance ────────────────────────────────────────
      GoRoute(
        path: AppRoutes.attendance,
        name: 'attendance',
        pageBuilder: (_, __) =>
            const MaterialPage(child: AttendanceScreen()),
      ),
      GoRoute(
        path: AppRoutes.attendanceHistory,
        name: 'attendanceHistory',
        pageBuilder: (_, __) =>
            const MaterialPage(child: AttendanceHistoryScreen()),
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      body: Center(child: Text('Page not found: ${state.error}')),
    ),
  );
});

class _AuthListenable extends ChangeNotifier {
  _AuthListenable(Ref ref) {
    ref.listen(authProvider, (_, __) => notifyListeners());
  }
}

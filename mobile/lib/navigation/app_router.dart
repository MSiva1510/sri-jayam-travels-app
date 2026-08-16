// ─────────────────────────────────────────────────────────────────────────────
// app_router.dart — Day 44 (adds /driver/bookings + /driver/bookings/:id)
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/auth/auth_state.dart';
import '../providers/auth_provider.dart';
import '../screens/auth/login_screen.dart';
import '../screens/auth/forgot_password_screen.dart';
import '../screens/auth/unauthorized_screen.dart';
import '../screens/driver/driver_home_screen.dart';
import '../screens/driver/driver_profile_screen.dart';
import '../screens/driver/driver_trips_screen.dart';
import '../screens/driver/trip_details_screen.dart';
import '../screens/driver/driver_bookings_screen.dart';
import '../screens/driver/booking_details_screen.dart';

class AppRoutes {
  AppRoutes._();

  static const login          = '/login';
  static const forgotPassword = '/forgot-password';
  static const unauthorized   = '/unauthorized';
  static const driverHome     = '/driver';
  static const driverProfile  = '/driver/profile';
  static const driverTrips    = '/driver/trips';
  static const driverBookings = '/driver/bookings';

  static String tripDetail(String id)     => '/driver/trips/$id';
  static String bookingDetail(String id)  => '/driver/bookings/$id';
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
        AuthInitializing() || AuthLoadingProfile() => null,
        AuthUnauthenticated() || AuthAuthenticating() =>
            isPublic ? null : AppRoutes.login,
        AuthError(:final code) =>
            code == AuthErrorCode.unauthorizedRole
                ? AppRoutes.unauthorized
                : (isPublic ? null : AppRoutes.login),
        AuthAuthenticated(:final profile) =>
            isPublic
                ? AppRoutes.driverHome
                : (!profile.isDriver ? AppRoutes.unauthorized : null),
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

      // ── Driver (protected via redirect) ───────────────────────────────
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

      // ── Trips ────────────────────────────────────────────────────────
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
      ),

      // ── Bookings ─────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// driver_shell.dart — Driver App Shell
// Wraps all driver screens with shared header, bottom nav, and theme
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../navigation/app_router.dart';
import '../../widgets/shared.dart';

/// Driver shell configuration
class DriverShell extends ConsumerStatefulWidget {
  const DriverShell({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<DriverShell> createState() => _DriverShellState();
}

class _DriverShellState extends ConsumerState<DriverShell> {
  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    final isDashboard = location == AppRoutes.driverHome;
    final isInnerPage = !isDashboard;

    final config = const AppShellConfig(
      headerVariant: AppHeaderVariant.dashboard,
      bottomNavConfig: BottomNavConfig.driver,
      showBottomNav: true,
    );

    if (isDashboard) {
      return AppDashboardScaffold(
        config: config,
        body: widget.child,
        onNotificationTap: () => context.push(AppRoutes.driverNotifications),
        onProfileTap: () => context.push(AppRoutes.driverProfile),
      );
    }

    // For inner pages, determine if we need back button
    final needsBackButton = _needsBackButton(location);

    return AppInnerScaffold(
      config: config.copyWith(
        headerVariant: AppHeaderVariant.innerPage,
      ),
      body: widget.child,
      title: _getPageTitle(location),
      subtitle: _getPageSubtitle(location),
      onBack: needsBackButton ? () => context.pop() : null,
      onNotificationTap: () => context.push(AppRoutes.driverNotifications),
    );
  }

  bool _needsBackButton(String location) {
    // Don't show back button on bottom nav destinations
    final bottomNavRoutes = [
      AppRoutes.driverHome,
      AppRoutes.driverTrips,
      AppRoutes.driverBookings,
      AppRoutes.driverNotifications,
      AppRoutes.driverProfile,
    ];
    return !bottomNavRoutes.contains(location);
  }

  String _getPageTitle(String location) {
    if (location.startsWith('/driver/trips/') && location.contains('/map')) {
      return 'Trip Map';
    }
    if (location.startsWith('/driver/trips/')) {
      return 'Trip Details';
    }
    if (location.startsWith('/driver/bookings/')) {
      return 'Booking Details';
    }
    switch (location) {
      case AppRoutes.driverProfile:
        return 'Profile';
      case AppRoutes.driverDocuments:
        return 'Documents';
      case AppRoutes.attendance:
        return 'Attendance';
      case AppRoutes.attendanceHistory:
        return 'Attendance History';
      case AppRoutes.driverNotifications:
        return 'Notifications';
      case AppRoutes.driverCommunication:
        return 'Messages';
      case AppRoutes.driverSettings:
        return 'Settings';
      default:
        return 'Sri Jayam Travels';
    }
  }

  String? _getPageSubtitle(String location) {
    if (location.startsWith('/driver/trips/') && !location.contains('/map')) {
      return 'Trip Information';
    }
    if (location.startsWith('/driver/bookings/')) {
      return 'Booking Information';
    }
    return null;
  }
}

/// Extension to copy AppShellConfig with modified values
extension AppShellConfigX on AppShellConfig {
  AppShellConfig copyWith({
    AppHeaderVariant? headerVariant,
    BottomNavConfig? bottomNavConfig,
    bool? showBottomNav,
    Widget? floatingActionButton,
    bool? extendBody,
    bool? extendBodyBehindAppBar,
  }) {
    return AppShellConfig(
      headerVariant: headerVariant ?? this.headerVariant,
      bottomNavConfig: bottomNavConfig ?? this.bottomNavConfig,
      showBottomNav: showBottomNav ?? this.showBottomNav,
      floatingActionButton: floatingActionButton ?? this.floatingActionButton,
      extendBody: extendBody ?? this.extendBody,
      extendBodyBehindAppBar: extendBodyBehindAppBar ?? this.extendBodyBehindAppBar,
    );
  }
}
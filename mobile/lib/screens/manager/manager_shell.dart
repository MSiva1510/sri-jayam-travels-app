// ─────────────────────────────────────────────────────────────────────────────
// manager_shell.dart — Manager App Shell
// Wraps all manager screens with shared header, bottom nav, and theme
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../navigation/app_router.dart';
import '../../widgets/shared.dart';

/// Manager shell configuration
class ManagerShell extends ConsumerStatefulWidget {
  const ManagerShell({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<ManagerShell> createState() => _ManagerShellState();
}

class _ManagerShellState extends ConsumerState<ManagerShell> {
  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    final isDashboard = location == AppRoutes.managerHome;
    final isInnerPage = !isDashboard;

    final config = const AppShellConfig(
      headerVariant: AppHeaderVariant.dashboard,
      bottomNavConfig: BottomNavConfig.manager,
      showBottomNav: true,
    );

    if (isDashboard) {
      return AppDashboardScaffold(
        config: config,
        body: widget.child,
        onNotificationTap: () => context.push(AppRoutes.managerAlerts),
        onProfileTap: () => context.push(AppRoutes.managerProfile),
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
      onNotificationTap: () => context.push(AppRoutes.managerAlerts),
    );
  }

  bool _needsBackButton(String location) {
    // Don't show back button on bottom nav destinations
    final bottomNavRoutes = [
      AppRoutes.managerHome,
      AppRoutes.managerFleet,
      AppRoutes.managerTrips,
      AppRoutes.managerAlerts,
      AppRoutes.managerProfile,
    ];
    return !bottomNavRoutes.contains(location);
  }

  String _getPageTitle(String location) {
    if (location.startsWith('/manager/fleet/')) {
      return 'Vehicle Details';
    }
    if (location.startsWith('/manager/trips/')) {
      return 'Trip Details';
    }
    if (location.startsWith('/manager/bookings/')) {
      return 'Booking Details';
    }
    if (location.startsWith('/manager/drivers/')) {
      return 'Driver Details';
    }
    if (location.startsWith('/manager/vehicles/')) {
      return 'Vehicle Details';
    }
    if (location.startsWith('/manager/alerts/')) {
      return 'Alert Details';
    }
    switch (location) {
      case AppRoutes.managerProfile:
        return 'Profile';
      case AppRoutes.managerSettings:
        return 'Settings';
      case AppRoutes.managerDocuments:
        return 'Documents';
      case AppRoutes.managerAttendance:
        return 'Attendance';
      case AppRoutes.managerExpenses:
        return 'Expenses';
      case AppRoutes.managerReports:
        return 'Reports';
      case AppRoutes.managerNotifications:
        return 'Notifications';
      case AppRoutes.managerSos:
        return 'Emergency';
      default:
        return 'Sri Jayam Travels';
    }
  }

  String? _getPageSubtitle(String location) {
    if (location.startsWith('/manager/fleet/')) {
      return 'Vehicle Information';
    }
    if (location.startsWith('/manager/trips/')) {
      return 'Trip Information';
    }
    if (location.startsWith('/manager/bookings/')) {
      return 'Booking Information';
    }
    if (location.startsWith('/manager/drivers/')) {
      return 'Driver Information';
    }
    if (location.startsWith('/manager/vehicles/')) {
      return 'Vehicle Information';
    }
    if (location.startsWith('/manager/alerts/')) {
      return 'Alert Details';
    }
    return null;
  }
}
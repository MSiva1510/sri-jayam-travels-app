// ─────────────────────────────────────────────────────────────────────────────
// app_bottom_navigation.dart — Sri Jayam Travels Master Bottom Navigation
// Identical component for Driver & Manager — only destinations change
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../core/theme/context_extensions.dart';
import '../../navigation/app_router.dart';

/// Bottom navigation item configuration
class BottomNavItem {
  const BottomNavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.route,
  });

  final IconData icon;
  final IconData activeIcon;
  final String label;
  final String route;
}

/// Role-specific navigation configuration
class BottomNavConfig {
  final List<BottomNavItem> items;
  final int initialIndex;

  const BottomNavConfig({
    required this.items,
    this.initialIndex = 0,
  });

  /// Driver: Home, Trips, GPS, Alerts, Profile
  static const driver = BottomNavConfig(
    items: [
      BottomNavItem(
        icon: Icons.home_outlined,
        activeIcon: Icons.home,
        label: 'Home',
        route: AppRoutes.driverHome,
      ),
      BottomNavItem(
        icon: Icons.directions_car_outlined,
        activeIcon: Icons.directions_car,
        label: 'Trips',
        route: AppRoutes.driverTrips,
      ),
      BottomNavItem(
        icon: Icons.gps_not_fixed_outlined,
        activeIcon: Icons.gps_fixed,
        label: 'GPS',
        route: AppRoutes.driverGps,
      ),
      BottomNavItem(
        icon: Icons.notifications_outlined,
        activeIcon: Icons.notifications,
        label: 'Alerts',
        route: AppRoutes.driverAlerts,
      ),
      BottomNavItem(
        icon: Icons.person_outline,
        activeIcon: Icons.person,
        label: 'Profile',
        route: AppRoutes.driverProfile,
      ),
    ],
  );

  /// Manager: Home, Fleet, Trips, Alerts, Profile
  static const manager = BottomNavConfig(
    items: [
      BottomNavItem(
        icon: Icons.dashboard_outlined,
        activeIcon: Icons.dashboard,
        label: 'Home',
        route: AppRoutes.managerHome,
      ),
      BottomNavItem(
        icon: Icons.map_outlined,
        activeIcon: Icons.map,
        label: 'Fleet',
        route: AppRoutes.managerFleet,
      ),
      BottomNavItem(
        icon: Icons.assignment_outlined,
        activeIcon: Icons.assignment,
        label: 'Trips',
        route: AppRoutes.managerTrips,
      ),
      BottomNavItem(
        icon: Icons.warning_outlined,
        activeIcon: Icons.warning,
        label: 'Alerts',
        route: AppRoutes.managerAlerts,
      ),
      BottomNavItem(
        icon: Icons.person_outline,
        activeIcon: Icons.person,
        label: 'Profile',
        route: AppRoutes.managerProfile,
      ),
    ],
  );
}

/// Master bottom navigation bar — shared by Driver & Manager shells
class AppBottomNavigation extends ConsumerWidget {
  const AppBottomNavigation({
    super.key,
    required this.config,
    this.currentIndex = 0,
  });

  final BottomNavConfig config;
  final int currentIndex;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final location = GoRouterState.of(context).matchedLocation;
    final selectedIndex = _calculateSelectedIndex(location, config);

    return Container(
      height: context.bottomNavHeight,
      decoration: BoxDecoration(
        color: context.surface,
        boxShadow: [
          BoxShadow(
            color: context.shadowStrong,
            blurRadius: 20,
            offset: const Offset(0, -4),
            spreadRadius: 0,
          ),
        ],
        border: Border(
          top: BorderSide(
            color: context.outlineVariant,
            width: 1,
          ),
        ),
      ),
      child: SafeArea(
        top: false,
        child: NavigationBar(
          selectedIndex: selectedIndex,
          onDestinationSelected: (index) => _onDestinationSelected(index, config, context),
          backgroundColor: Colors.transparent,
          indicatorColor: Colors.transparent,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
          height: 56,
          animationDuration: const Duration(milliseconds: 200),
          destinations: config.items.map((item) => _buildDestination(context, item)).toList(),
        ),
      ),
    );
  }

  int _calculateSelectedIndex(String location, BottomNavConfig config) {
    for (int i = 0; i < config.items.length; i++) {
      final route = config.items[i].route;
      if (location == route || location.startsWith('$route/')) {
        return i;
      }
    }
    return 0;
  }

  void _onDestinationSelected(int index, BottomNavConfig config, BuildContext context) {
    final route = config.items[index].route;
    if (route != GoRouterState.of(context).matchedLocation) {
      context.go(route);
    }
  }

  NavigationDestination _buildDestination(BuildContext context, BottomNavItem item) {
    return NavigationDestination(
      icon: Icon(
        item.icon,
        size: 24,
        color: context.onSurfaceVariant,
      ),
      selectedIcon: Icon(
        item.activeIcon,
        size: 24,
        color: context.primary,
      ),
      label: item.label,
      tooltip: item.label,
    );
  }
}

/// Floating bottom navigation variant (for inner pages with FAB)
class AppFloatingBottomNavigation extends ConsumerWidget {
  const AppFloatingBottomNavigation({
    super.key,
    required this.config,
    this.currentIndex = 0,
    this.floatingActionButton,
  });

  final BottomNavConfig config;
  final int currentIndex;
  final Widget? floatingActionButton;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final location = GoRouterState.of(context).matchedLocation;
    final selectedIndex = _calculateSelectedIndex(location, config);

    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          height: context.bottomNavHeight,
          decoration: BoxDecoration(
            color: context.surface,
            boxShadow: [
              BoxShadow(
                color: context.shadowStrong,
                blurRadius: 20,
                offset: const Offset(0, -4),
                spreadRadius: 0,
              ),
            ],
            border: Border(
              top: BorderSide(
                color: context.outlineVariant,
                width: 1,
              ),
            ),
          ),
          child: SafeArea(
            top: false,
            child: NavigationBar(
              selectedIndex: selectedIndex,
              onDestinationSelected: (index) => _onDestinationSelected(index, config, context),
              backgroundColor: Colors.transparent,
              indicatorColor: Colors.transparent,
              surfaceTintColor: Colors.transparent,
              elevation: 0,
              labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
              height: 56,
              animationDuration: const Duration(milliseconds: 200),
              destinations: config.items.map((item) => _buildDestination(context, item)).toList(),
            ),
          ),
        ),
        if (floatingActionButton != null)
          Positioned(
            bottom: context.bottomNavHeight + 8,
            right: context.screenMargin,
            child: floatingActionButton!,
          ),
      ],
    );
  }

  int _calculateSelectedIndex(String location, BottomNavConfig config) {
    for (int i = 0; i < config.items.length; i++) {
      final route = config.items[i].route;
      if (location == route || location.startsWith('$route/')) {
        return i;
      }
    }
    return 0;
  }

  void _onDestinationSelected(int index, BottomNavConfig config, BuildContext context) {
    final route = config.items[index].route;
    if (route != GoRouterState.of(context).matchedLocation) {
      context.go(route);
    }
  }

  NavigationDestination _buildDestination(BuildContext context, BottomNavItem item) {
    return NavigationDestination(
      icon: Icon(
        item.icon,
        size: 24,
        color: context.onSurfaceVariant,
      ),
      selectedIcon: Icon(
        item.activeIcon,
        size: 24,
        color: context.primary,
      ),
      label: item.label,
      tooltip: item.label,
    );
  }
}
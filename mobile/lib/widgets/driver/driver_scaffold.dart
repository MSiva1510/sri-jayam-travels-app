// ─────────────────────────────────────────────────────────────────────────────
// driver_scaffold.dart — bottom tab frame for the 4 tab screens.
// Tabs (per wireframe): Home · Trips · Docs · Profile.
// Detail/pushed screens (trip details, expenses, attendance…) render above
// the tabs, without the bar — also per wireframe.
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../navigation/app_router.dart';

class DriverTabScaffold extends StatelessWidget {
  const DriverTabScaffold({
    super.key,
    required this.child,
    required this.location,
  });

  final Widget child;
  final String location;

  static const _tabs = [
    (route: AppRoutes.driverHome, label: 'Home', icon: Icons.home_outlined, activeIcon: Icons.home),
    (route: AppRoutes.driverTrips, label: 'Trips', icon: Icons.route_outlined, activeIcon: Icons.route),
    (route: AppRoutes.driverDocuments, label: 'Docs', icon: Icons.description_outlined, activeIcon: Icons.description),
    (route: AppRoutes.driverProfile, label: 'Profile', icon: Icons.person_outline, activeIcon: Icons.person),
  ];

  int _indexFor(String loc) {
    // Longest-prefix match so future nested tab routes keep their tab lit.
    var best = 0;
    var bestLen = -1;
    for (var i = 0; i < _tabs.length; i++) {
      final r = _tabs[i].route;
      if ((loc == r || loc.startsWith('$r/')) && r.length > bestLen) {
        best = i;
        bestLen = r.length;
      }
    }
    return best;
  }

  @override
  Widget build(BuildContext context) {
    final current = _indexFor(location);
    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: current,
        onDestinationSelected: (i) {
          if (i != current) context.go(_tabs[i].route);
        },
        destinations: [
          for (final t in _tabs)
            NavigationDestination(
              icon: Icon(t.icon),
              selectedIcon: Icon(t.activeIcon),
              label: t.label,
            ),
        ],
      ),
    );
  }
}

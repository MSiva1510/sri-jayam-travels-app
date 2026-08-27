// ─────────────────────────────────────────────────────────────────────────────
// app_scaffold.dart — Sri Jayam Travels Master Scaffold
// Unified scaffold with header, body, bottom navigation
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';

import 'app_header.dart';
import 'app_bottom_navigation.dart';

/// Shell configuration for a role
class AppShellConfig {
  const AppShellConfig({
    required this.headerVariant,
    required this.bottomNavConfig,
    this.showBottomNav = true,
    this.floatingActionButton,
    this.extendBody = false,
    this.extendBodyBehindAppBar = false,
  });

  final AppHeaderVariant headerVariant;
  final BottomNavConfig bottomNavConfig;
  final bool showBottomNav;
  final Widget? floatingActionButton;
  final bool extendBody;
  final bool extendBodyBehindAppBar;

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

/// Master scaffold used by both Driver & Manager shells
class AppScaffold extends StatelessWidget {
  const AppScaffold({
    super.key,
    required this.config,
    required this.body,
    this.headerTitle,
    this.headerSubtitle,
    this.onHeaderBack,
    this.onNotificationTap,
    this.onProfileTap,
    this.showHeaderNotificationBadge = true,
    this.showHeaderProfile = true,
    this.headerActions,
  });

  final AppShellConfig config;
  final Widget body;
  final String? headerTitle;
  final String? headerSubtitle;
  final VoidCallback? onHeaderBack;
  final VoidCallback? onNotificationTap;
  final VoidCallback? onProfileTap;
  final bool showHeaderNotificationBadge;
  final bool showHeaderProfile;
  final List<Widget>? headerActions;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBody: config.extendBody,
      extendBodyBehindAppBar: config.extendBodyBehindAppBar,
      floatingActionButton: config.floatingActionButton,
      floatingActionButtonLocation: FloatingActionButtonLocation.endDocked,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // Header
            AppHeader(
              variant: config.headerVariant,
              title: headerTitle,
              subtitle: headerSubtitle,
              onBack: onHeaderBack,
              onNotificationTap: onNotificationTap,
              onProfileTap: onProfileTap,
              showNotificationBadge: showHeaderNotificationBadge,
              showProfile: showHeaderProfile,
              actions: headerActions,
            ),

            // Body
            Expanded(
              child: body,
            ),
          ],
        ),
      ),

      // Bottom Navigation
      bottomNavigationBar: config.showBottomNav
          ? AppBottomNavigation(config: config.bottomNavConfig)
          : null,
    );
  }
}

/// Inner page scaffold (with back button in header)
class AppInnerScaffold extends StatelessWidget {
  const AppInnerScaffold({
    super.key,
    required this.config,
    required this.body,
    required this.title,
    this.subtitle,
    this.onBack,
    this.onNotificationTap,
    this.showHeaderNotificationBadge = true,
    this.headerActions,
    this.floatingActionButton,
  });

  final AppShellConfig config;
  final Widget body;
  final String title;
  final String? subtitle;
  final VoidCallback? onBack;
  final VoidCallback? onNotificationTap;
  final bool showHeaderNotificationBadge;
  final List<Widget>? headerActions;
  final Widget? floatingActionButton;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBody: config.extendBody,
      floatingActionButton: floatingActionButton,
      floatingActionButtonLocation: FloatingActionButtonLocation.endDocked,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // Inner page header with back button
            AppHeader(
              variant: AppHeaderVariant.innerPage,
              title: title,
              subtitle: subtitle,
              onBack: onBack ?? () => Navigator.of(context).maybePop(),
              onNotificationTap: onNotificationTap,
              showNotificationBadge: showHeaderNotificationBadge,
              showProfile: false,
              actions: headerActions,
            ),

            // Body
            Expanded(
              child: body,
            ),
          ],
        ),
      ),

      // Bottom Navigation
      bottomNavigationBar: config.showBottomNav
          ? (floatingActionButton != null
              ? AppFloatingBottomNavigation(
                  config: config.bottomNavConfig,
                  floatingActionButton: floatingActionButton!,
                )
              : AppBottomNavigation(config: config.bottomNavConfig))
          : null,
    );
  }
}

/// Dashboard scaffold (with greeting header)
class AppDashboardScaffold extends StatelessWidget {
  const AppDashboardScaffold({
    super.key,
    required this.config,
    required this.body,
    this.onNotificationTap,
    this.onProfileTap,
    this.showHeaderNotificationBadge = true,
    this.showHeaderProfile = true,
    this.headerActions,
    this.floatingActionButton,
  });

  final AppShellConfig config;
  final Widget body;
  final VoidCallback? onNotificationTap;
  final VoidCallback? onProfileTap;
  final bool showHeaderNotificationBadge;
  final bool showHeaderProfile;
  final List<Widget>? headerActions;
  final Widget? floatingActionButton;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBody: config.extendBody,
      floatingActionButton: floatingActionButton,
      floatingActionButtonLocation: FloatingActionButtonLocation.endDocked,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // Dashboard header with greeting
            AppHeader(
              variant: AppHeaderVariant.dashboard,
              onNotificationTap: onNotificationTap,
              onProfileTap: onProfileTap,
              showNotificationBadge: showHeaderNotificationBadge,
              showProfile: showHeaderProfile,
              actions: headerActions,
            ),

            // Body
            Expanded(
              child: body,
            ),
          ],
        ),
      ),

      // Bottom Navigation
      bottomNavigationBar: config.showBottomNav
          ? (floatingActionButton != null
              ? AppFloatingBottomNavigation(
                  config: config.bottomNavConfig,
                  floatingActionButton: floatingActionButton!,
                )
              : AppBottomNavigation(config: config.bottomNavConfig))
          : null,
    );
  }
}
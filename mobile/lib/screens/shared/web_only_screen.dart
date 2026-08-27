// ─────────────────────────────────────────────────────────────────────────────
// web_only_screen.dart — Admin Web-Only Access Screen
// Shown when Admin logs into mobile app
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme.dart';
import '../../core/theme/context_extensions.dart';
import '../../providers/auth_provider.dart';

/// Screen shown to Admin users on mobile — directs them to web app
class WebOnlyScreen extends ConsumerWidget {
  const WebOnlyScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final userProfile = authState is AuthAuthenticated ? authState.profile : null;

    return Scaffold(
      backgroundColor: context.background,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: EdgeInsets.all(context.xl),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Illustration / Icon
                Container(
                  width: 120,
                  height: 120,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [context.primary, context.primary.withValues(alpha: 0.7)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: context.primary.withValues(alpha: 0.3),
                        blurRadius: 30,
                        offset: const Offset(0, 12),
                        spreadRadius: -4,
                      ),
                    ],
                  ),
                  child: Icon(
                    Icons.desktop_windows_outlined,
                    size: 60,
                    color: context.onPrimary,
                  ),
                ),

                const SizedBox(height: 32),

                // Title
                Text(
                  'Admin Access — Web Only',
                  style: context.displayLarge.copyWith(
                    color: context.onSurface,
                    fontWeight: FontWeight.w700,
                  ),
                  textAlign: TextAlign.center,
                ),

                const SizedBox(height: 16),

                // Message
                Text(
                  'Admin dashboard is available on the Sri Jayam Travels web application. '
                  'Please use a desktop browser to access full administrative features.',
                  style: context.bodyLarge.copyWith(
                    color: context.onSurfaceVariant,
                    height: 1.5,
                  ),
                  textAlign: TextAlign.center,
                ),

                const SizedBox(height: 24),

                // Web link hint
                Container(
                  padding: EdgeInsets.all(context.lg),
                  decoration: BoxDecoration(
                    color: context.surfaceContainer,
                    borderRadius: context.card,
                    border: Border.all(color: context.outlineVariant),
                  ),
                  child: Column(
                    children: [
                      Icon(
                        Icons.link,
                        size: 24,
                        color: context.primary,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'srijayamtravels.com/admin',
                        style: context.bodyMediumBold.copyWith(
                          color: context.primary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'or scan QR code from web app',
                        style: context.caption.copyWith(
                          color: context.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 32),

                // Logout button
                PrimaryButton(
                  label: 'Log Out',
                  icon: Icons.logout,
                  onPressed: () async {
                    await ref.read(authProvider.notifier).logout();
                    if (context.mounted) {
                      context.go('/login');
                    }
                  },
                ),

                const SizedBox(height: 16),

                // User info
                if (userProfile != null)
                  Text(
                    'Signed in as ${userProfile.fullName} (${userProfile.role.toUpperCase()})',
                    style: context.caption.copyWith(
                      color: context.onSurfaceVariant,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Unauthorized screen for unknown roles (Admin web-only)
class AdminWebOnlyUnauthorizedScreen extends ConsumerWidget {
  const AdminWebOnlyUnauthorizedScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: context.background,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: EdgeInsets.all(context.xl),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    color: context.dangerContainer,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.block_outlined,
                    size: 50,
                    color: context.danger,
                  ),
                ),

                const SizedBox(height: 24),

                Text(
                  'Access Denied',
                  style: context.displayLarge.copyWith(
                    color: context.onSurface,
                    fontWeight: FontWeight.w700,
                  ),
                  textAlign: TextAlign.center,
                ),

                const SizedBox(height: 12),

                Text(
                  'Your account does not have permission to access the mobile application. '
                  'Please contact your administrator.',
                  style: context.bodyLarge.copyWith(
                    color: context.onSurfaceVariant,
                    height: 1.5,
                  ),
                  textAlign: TextAlign.center,
                ),

                const SizedBox(height: 32),

                FilledButton.icon(
                  label: 'Log Out',
                  icon: Icons.logout,
                  onPressed: () async {
                    await ref.read(authProvider.notifier).logout();
                    if (context.mounted) {
                      context.go('/login');
                    }
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
// ─────────────────────────────────────────────────────────────────────────────
// manager_profile_screen.dart — Manager Profile
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../core/theme/context_extensions.dart';
import '../../core/auth/auth_state.dart';
import '../../navigation/app_router.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/shared.dart';

class ManagerProfileScreen extends ConsumerWidget {
  const ManagerProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final profile = authState is AuthAuthenticated ? authState.profile : null;

    return Scaffold(
      backgroundColor: context.background,
      body: SafeArea(
        child: profile == null
            ? Center(child: LoadingState(message: 'Loading profile...'))
            : SingleChildScrollView(
                padding: EdgeInsets.all(context.screenMargin),
                child: Column(
                  children: [
                    // Avatar & Info
                    AppCard(
                      child: Column(
                        children: [
                          CircleAvatar(
                            radius: 48,
                            backgroundColor: context.primaryContainer,
                            child: Text(
                              profile.initials,
                              style: context.displayLarge.copyWith(
                                color: context.onPrimaryContainer,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            profile.fullName,
                            style: context.headlineMedium,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            profile.email,
                            style: context.bodyMedium.copyWith(color: context.onSurfaceVariant),
                          ),
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: context.primaryContainer,
                              borderRadius: context.chip,
                            ),
                            child: Text(
                              profile.role.toUpperCase(),
                              style: context.labelMedium.copyWith(color: context.primary),
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 16),

                    // Details
                    AppCard(
                      child: Column(
                        children: [
                          _DetailRow(
                            icon: Icons.email,
                            label: 'Email',
                            value: profile.email,
                          ),
                          _DetailRow(
                            icon: Icons.badge,
                            label: 'User ID',
                            value: profile.id,
                          ),
                          if (profile.phone != null && profile.phone!.isNotEmpty)
                            _DetailRow(
                              icon: Icons.phone,
                              label: 'Phone',
                              value: profile.phone!,
                            ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 16),

                    // Settings
                    AppCard(
                      child: Column(
                        children: [
                          ListTile(
                            leading: Icon(Icons.palette_outlined, color: context.primary),
                            title: Text('Appearance', style: context.bodyMediumBold),
                            subtitle: Text('Theme, dark mode', style: context.caption),
                            trailing: Icon(Icons.chevron_right, color: context.onSurfaceVariant),
                            onTap: () => context.push(AppRoutes.managerSettings),
                          ),
                          Divider(height: 1, color: context.outlineVariant),
                          ListTile(
                            leading: Icon(Icons.notifications_outlined, color: context.primary),
                            title: Text('Notifications', style: context.bodyMediumBold),
                            subtitle: Text('Alert preferences', style: context.caption),
                            trailing: Icon(Icons.chevron_right, color: context.onSurfaceVariant),
                            onTap: () => context.push(AppRoutes.managerNotifications),
                          ),
                          Divider(height: 1, color: context.outlineVariant),
                          ListTile(
                            leading: Icon(Icons.help_outline, color: context.primary),
                            title: Text('Support', style: context.bodyMediumBold),
                            subtitle: Text('Help & feedback', style: context.caption),
                            trailing: Icon(Icons.chevron_right, color: context.onSurfaceVariant),
                            onTap: () => _showSupport(context),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 16),

                    // Logout
                    PrimaryButton(
                      label: 'Log Out',
                      icon: Icons.logout,
                      style: DangerStyle.outlined,
                      onPressed: () => _confirmLogout(context, ref),
                    ),

                    const SizedBox(height: 24),
                  ],
                ),
              ),
    );
  }

  void _confirmLogout(BuildContext context, WidgetRef ref) {
    ConfirmDialog.show(
      context: context,
      title: 'Log Out',
      message: 'Are you sure you want to log out?',
      confirmLabel: 'Log Out',
      isDestructive: true,
    ).then((confirmed) {
      if (confirmed) {
        ref.read(authProvider.notifier).logout();
        context.go(AppRoutes.login);
      }
    });
  }

  void _showSupport(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Support'),
        content: Text('For assistance, contact:\n\nSri Jayam Travels\n+91 94423 37470\nsupport@srijayamtravels.com'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text('OK'),
          ),
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: context.sm),
      child: Row(
        children: [
          Icon(icon, size: 20, color: context.primary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: context.caption),
                Text(value, style: context.bodyMedium),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
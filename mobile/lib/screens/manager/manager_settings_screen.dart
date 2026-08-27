// ─────────────────────────────────────────────────────────────────────────────
// manager_settings_screen.dart — Manager Settings
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../core/theme/context_extensions.dart';
import '../../providers/auth_provider.dart';
import '../../core/theme/app_theme_controller.dart';
import '../../widgets/shared.dart';

class ManagerSettingsScreen extends ConsumerWidget {
  const ManagerSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeControllerProvider);

    return Scaffold(
      backgroundColor: context.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.all(context.screenMargin),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Appearance
              Text(
                'Appearance',
                style: context.overline.copyWith(color: context.primary),
              ),
              const SizedBox(height: 12),
              AppCard(
                child: Column(
                  children: [
                    ListTile(
                      leading: Icon(Icons.brightness_auto, color: context.primary),
                      title: Text('Theme', style: context.bodyMediumBold),
                      subtitle: Text('Choose light, dark, or system', style: context.caption),
                      trailing: DropdownButton<AppThemeMode>(
                        value: themeMode,
                        underline: const SizedBox(),
                        items: AppThemeMode.values.map((mode) {
                          return DropdownMenuItem(
                            value: mode,
                            child: Row(
                              children: [
                                Icon(mode.icon, size: 18, color: context.primary),
                                const SizedBox(width: 8),
                                Text(mode.label),
                              ],
                            ),
                          );
                        }).toList(),
                        onChanged: (value) {
                          if (value != null) {
                            ref.read(themeControllerProvider.notifier).setThemeMode(value);
                          }
                        },
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // Notifications
              Text(
                'Notifications',
                style: context.overline.copyWith(color: context.primary),
              ),
              const SizedBox(height: 12),
              AppCard(
                child: Column(
                  children: [
                    _SettingsTile(
                      icon: Icons.notifications_active,
                      title: 'Trip Alerts',
                      subtitle: 'New assignments & updates',
                      value: true,
                      onChanged: (_) {},
                    ),
                    Divider(height: 1, color: context.outlineVariant, indent: 56),
                    _SettingsTile(
                      icon: Icons.warning,
                      title: 'Critical Alerts',
                      subtitle: 'Vehicle & driver emergencies',
                      value: true,
                      onChanged: (_) {},
                    ),
                    Divider(height: 1, color: context.outlineVariant, indent: 56),
                    _SettingsTile(
                      icon: Icons.description,
                      title: 'Document Expiry',
                      subtitle: 'License, insurance, permits',
                      value: true,
                      onChanged: (_) {},
                    ),
                    Divider(height: 1, color: context.outlineVariant, indent: 56),
                    _SettingsTile(
                      icon: Icons.directions_car,
                      title: 'Fleet Status',
                      subtitle: 'Offline, maintenance alerts',
                      value: false,
                      onChanged: (_) {},
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // Communication
              Text(
                'Communication',
                style: context.overline.copyWith(color: context.primary),
              ),
              const SizedBox(height: 12),
              AppCard(
                child: Column(
                  children: [
                    ListTile(
                      leading: Icon(Icons.phone, color: context.primary),
                      title: Text('Call Drivers', style: context.bodyMediumBold),
                      subtitle: Text('Direct dial from driver details', style: context.caption),
                      trailing: Icon(Icons.chevron_right, color: context.onSurfaceVariant),
                      onTap: () {},
                    ),
                    Divider(height: 1, color: context.outlineVariant, indent: 56),
                    ListTile(
                      leading: Icon(Icons.message, color: context.primary),
                      title: Text('In-App Messages', style: context.bodyMediumBold),
                      subtitle: Text('Send notifications to drivers', style: context.caption),
                      trailing: Icon(Icons.chevron_right, color: context.onSurfaceVariant),
                      onTap: () => context.push(AppRoutes.managerNotifications),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // Support
              Text(
                'Support',
                style: context.overline.copyWith(color: context.primary),
              ),
              const SizedBox(height: 12),
              AppCard(
                child: Column(
                  children: [
                    ListTile(
                      leading: Icon(Icons.help_outline, color: context.primary),
                      title: Text('Help Center', style: context.bodyMediumBold),
                      subtitle: Text('FAQs & guides', style: context.caption),
                      trailing: Icon(Icons.chevron_right, color: context.onSurfaceVariant),
                      onTap: () {},
                    ),
                    Divider(height: 1, color: context.outlineVariant, indent: 56),
                    ListTile(
                      leading: Icon(Icons.feedback, color: context.primary),
                      title: Text('Send Feedback', style: context.bodyMediumBold),
                      subtitle: Text('Report issues or suggest features', style: context.caption),
                      trailing: Icon(Icons.chevron_right, color: context.onSurfaceVariant),
                      onTap: () {},
                    ),
                    Divider(height: 1, color: context.outlineVariant, indent: 56),
                    ListTile(
                      leading: Icon(Icons.info_outline, color: context.primary),
                      title: Text('About', style: context.bodyMediumBold),
                      subtitle: Text('Version 1.0.0', style: context.caption),
                      trailing: Icon(Icons.chevron_right, color: context.onSurfaceVariant),
                      onTap: () => _showAbout(context),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // Danger Zone
              Text(
                'Account',
                style: context.overline.copyWith(color: context.danger),
              ),
              const SizedBox(height: 12),
              AppCard(
                child: Column(
                  children: [
                    ListTile(
                      leading: Icon(Icons.lock_outline, color: context.danger),
                      title: Text('Change Password', style: context.bodyMediumBold.copyWith(color: context.danger)),
                      subtitle: Text('Update your password', style: context.caption),
                      trailing: Icon(Icons.chevron_right, color: context.onSurfaceVariant),
                      onTap: () {},
                    ),
                    Divider(height: 1, color: context.outlineVariant, indent: 56),
                    ListTile(
                      leading: Icon(Icons.logout, color: context.danger),
                      title: Text('Log Out', style: context.bodyMediumBold.copyWith(color: context.danger)),
                      subtitle: Text('Sign out of your account', style: context.caption),
                      trailing: Icon(Icons.chevron_right, color: context.onSurfaceVariant),
                      onTap: () => _confirmLogout(context, ref),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 32),
            ],
          ),
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

  void _showAbout(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AppDialog(
        title: 'About',
        icon: Icons.info_outline,
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Sri Jayam Travels', style: context.headlineSmall),
            Text('Mobile App v1.0.0', style: context.bodyMedium),
            const SizedBox(height: 16),
            Text('Built for drivers and fleet managers', style: context.bodyMedium),
            Text('© 2026 Sri Jayam Travels', style: context.caption),
          ],
        ),
        actions: [
          PrimaryButton(
            label: 'Close',
            onPressed: () => Navigator.of(context).pop(),
          ),
        ],
      ),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: context.primary),
      title: Text(title, style: context.bodyMediumBold),
      subtitle: Text(subtitle, style: context.caption),
      trailing: Switch(
        value: value,
        onChanged: onChanged,
        activeThumbColor: context.primary,
      ),
    );
  }
}
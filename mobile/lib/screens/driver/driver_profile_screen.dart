// ─────────────────────────────────────────────────────────────────────────────
// driver_profile_screen.dart
// Displays all available driver fields from the live Supabase schema.
// No fake/hardcoded data — empty fields show a placeholder.
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../models/driver_profile.dart';
import '../../navigation/app_router.dart';
import '../../providers/auth_provider.dart';

class DriverProfileScreen extends ConsumerWidget {
  const DriverProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final driver  = ref.watch(currentDriverProvider);
    final profile = ref.watch(currentProfileProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Profile'),
        actions: [
          IconButton(
            icon:    const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: () =>
                ref.read(authProvider.notifier).refreshProfile(),
          ),
        ],
      ),
      body: driver == null
          ? _buildEmpty(context, profile?.fullName)
          : _buildProfile(context, ref, driver),
    );
  }

  // ── Profile loaded ────────────────────────────────────────────────────────

  Widget _buildProfile(
    BuildContext context,
    WidgetRef ref,
    DriverProfile d,
  ) {
    return RefreshIndicator(
      onRefresh: () => ref.read(authProvider.notifier).refreshProfile(),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── Avatar + name ────────────────────────────────────────────────
          _AvatarHeader(driver: d),
          const SizedBox(height: 24),

          // ── Status chip ──────────────────────────────────────────────────
          if (d.status != null)
            Center(child: _StatusChip(status: d.status!)),
          const SizedBox(height: 24),

          // ── Personal info ────────────────────────────────────────────────
          _Section(
            title: 'Personal Information',
            icon:  Icons.person_outline,
            children: [
              _Field(label: 'Full Name',   value: d.name),
              _Field(label: 'Email',       value: d.email),
              _Field(label: 'Phone',       value: d.phone),
              _Field(label: 'Driver ID',   value: d.driverId),
              _Field(label: 'Address',     value: d.address),
              _Field(label: 'City',        value: d.city),
              _Field(
                label: 'Date of Birth',
                value: d.dateOfBirth != null
                    ? _fmt(d.dateOfBirth!)
                    : null,
              ),
              _Field(
                label: 'Joined',
                value: d.joinedDate != null ? _fmt(d.joinedDate!) : null,
              ),
            ],
          ),
          const SizedBox(height: 16),

          // ── License ──────────────────────────────────────────────────────
          _Section(
            title: 'License',
            icon:  Icons.badge_outlined,
            children: [
              _Field(label: 'License No.', value: d.licenseNumber),
              _Field(
                label: 'Expiry',
                value: d.licenseExpiry != null ? _fmt(d.licenseExpiry!) : null,
                warning: d.isLicenseExpired
                    ? 'EXPIRED'
                    : d.isLicenseExpiringSoon
                        ? 'Expires soon'
                        : null,
              ),
              _Field(label: 'Aadhar No.', value: d.aadharNumber),
            ],
          ),
          const SizedBox(height: 16),

          // ── Emergency contact ─────────────────────────────────────────────
          _Section(
            title: 'Emergency Contact',
            icon:  Icons.emergency_outlined,
            children: [
              _Field(label: 'Name',  value: d.emergencyContact),
              _Field(label: 'Phone', value: d.emergencyPhone),
            ],
          ),
          const SizedBox(height: 16),

          // ── Documents shortcut (Day 48) ──────────────────────────────────
          Card(
            margin: const EdgeInsets.only(bottom: 16),
            child: ListTile(
              leading: Icon(
                Icons.badge_outlined,
                color: Theme.of(context).colorScheme.primary,
              ),
              title: const Text('My Documents'),
              subtitle:
                  const Text('Licence, badge & other documents'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push(AppRoutes.driverDocuments),
            ),
          ),

          // ── Notes ─────────────────────────────────────────────────────────
          if (d.notes != null && d.notes!.isNotEmpty)
            _Section(
              title: 'Notes',
              icon:  Icons.notes_outlined,
              children: [
                _Field(label: 'Notes', value: d.notes, multiLine: true),
              ],
            ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────

  Widget _buildEmpty(BuildContext context, String? name) {
    final theme = Theme.of(context);
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.person_off_outlined,
            size:  64,
            color: theme.colorScheme.onSurfaceVariant,
          ),
          const SizedBox(height: 16),
          Text(
            name != null ? 'Hello, $name' : 'Profile',
            style: theme.textTheme.headlineSmall,
          ),
          const SizedBox(height: 8),
          Text(
            'No driver record is linked to your account.\n'
            'Please contact your administrator.',
            textAlign: TextAlign.center,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }

  static String _fmt(DateTime dt) => DateFormat('dd MMM yyyy').format(dt);
}

// ── Sub-widgets ───────────────────────────────────────────────────────────────

class _AvatarHeader extends StatelessWidget {
  const _AvatarHeader({required this.driver});
  final DriverProfile driver;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      children: [
        CircleAvatar(
          radius: 48,
          backgroundColor: theme.colorScheme.primaryContainer,
          backgroundImage: driver.displayPhotoUrl != null
              ? NetworkImage(driver.displayPhotoUrl!)
              : null,
          child: driver.displayPhotoUrl == null
              ? Text(
                  driver.initials,
                  style: TextStyle(
                    fontSize:   32,
                    fontWeight: FontWeight.bold,
                    color:      theme.colorScheme.onPrimaryContainer,
                  ),
                )
              : null,
        ),
        const SizedBox(height: 12),
        Text(
          driver.name,
          style: theme.textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        if (driver.email != null) ...[
          const SizedBox(height: 4),
          Text(
            driver.email!,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ],
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final (color, label) = switch (status) {
      'active'   => (theme.colorScheme.primaryContainer, 'Active'),
      'inactive' => (theme.colorScheme.errorContainer,   'Inactive'),
      'on_leave' => (theme.colorScheme.tertiaryContainer,'On Leave'),
      _          => (theme.colorScheme.surfaceContainerHighest,   status),
    };
    return Chip(
      backgroundColor: color,
      label: Text(
        label,
        style: const TextStyle(fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({
    required this.title,
    required this.icon,
    required this.children,
  });
  final String   title;
  final IconData icon;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    // Filter out fields with no value
    final visible = children
        .whereType<_Field>()
        .where((f) => f.value != null || f.warning != null)
        .toList();

    if (visible.isEmpty) return const SizedBox.shrink();

    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 18, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: theme.textTheme.titleSmall?.copyWith(
                    color:      theme.colorScheme.primary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const Divider(height: 20),
            ...visible,
          ],
        ),
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({
    required this.label,
    required this.value,
    this.warning,
    this.multiLine = false,
  });
  final String  label;
  final String? value;
  final String? warning;
  final bool    multiLine;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment:
            multiLine ? CrossAxisAlignment.start : CrossAxisAlignment.center,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value ?? '—',
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          if (warning != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color:        theme.colorScheme.errorContainer,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                warning!,
                style: TextStyle(
                  fontSize: 11,
                  color:    theme.colorScheme.onErrorContainer,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
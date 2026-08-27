// ─────────────────────────────────────────────────────────────────────────────
// app_header.dart — Sri Jayam Travels Master Header Component
// Two variants: Dashboard (with greeting) & Inner-page (with back button)
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme.dart';
import '../../core/theme/context_extensions.dart';
import '../../core/auth/auth_state.dart';
import '../../models/user_profile.dart';
import '../../models/driver_profile.dart';
import '../../providers/auth_provider.dart';
import '../../providers/trip_provider.dart';

/// Header variant type
enum AppHeaderVariant {
  /// Dashboard variant: Logo + Greeting + Notification + Avatar
  dashboard,
  /// Inner page variant: Back button + Title + Notification
  innerPage,
}

/// Master header widget — used by both Driver and Manager shells
class AppHeader extends ConsumerWidget {
  const AppHeader({
    super.key,
    required this.variant,
    this.title,
    this.subtitle,
    this.onBack,
    this.onNotificationTap,
    this.onProfileTap,
    this.showNotificationBadge = true,
    this.showProfile = true,
    this.actions,
  });

  final AppHeaderVariant variant;
  final String? title;
  final String? subtitle;
  final VoidCallback? onBack;
  final VoidCallback? onNotificationTap;
  final VoidCallback? onProfileTap;
  final bool showNotificationBadge;
  final bool showProfile;
  final List<Widget>? actions;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final unreadCount = ref.watch(unreadNotificationCountProvider);

    final userProfile = authState is AuthAuthenticated ? authState.profile : null;
    final driverProfile = authState is AuthAuthenticated ? authState.driverProfile : null;

    final displayName = driverProfile?.name ?? userProfile?.fullName ?? 'User';
    final hour = DateTime.now().hour;
    final greeting = hour < 12
        ? 'Good morning'
        : hour < 17
            ? 'Good afternoon'
            : 'Good evening';

    return Container(
      height: variant == AppHeaderVariant.dashboard
          ? context.headerHeightLarge
          : context.headerHeight,
      padding: EdgeInsets.symmetric(horizontal: context.screenMargin),
      decoration: BoxDecoration(
        color: context.surface,
        border: Border(
          bottom: BorderSide(
            color: context.outlineVariant,
            width: 1,
          ),
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: _buildContent(
          context,
          userProfile,
          driverProfile,
          displayName,
          greeting,
          unreadCount,
        ),
      ),
    );
  }

  Widget _buildContent(
    BuildContext context,
    UserProfile? userProfile,
    DriverProfile? driverProfile,
    String displayName,
    String greeting,
    int unreadCount,
  ) {
    switch (variant) {
      case AppHeaderVariant.dashboard:
        return _buildDashboardHeader(
          context,
          displayName,
          greeting,
          unreadCount,
          driverProfile?.displayPhotoUrl,
        );
      case AppHeaderVariant.innerPage:
        return _buildInnerPageHeader(
          context,
          unreadCount,
        );
    }
  }

  /// Dashboard variant: SRI JAYAM TRAVELS + Greeting + Notification + Avatar
  Widget _buildDashboardHeader(
    BuildContext context,
    String displayName,
    String greeting,
    int unreadCount,
    String? avatarUrl,
  ) {
    return Row(
      children: [
        // Logo / Brand
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                'SRI JAYAM TRAVELS',
                style: context.overline.copyWith(
                  color: context.primary,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.15,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                '$greeting, $displayName',
                style: context.bodyMedium.copyWith(
                  color: context.onSurfaceVariant,
                  fontWeight: FontWeight.w400,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),

        // Actions
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Custom actions
            if (actions != null) ...actions!,

            // Notification Bell
            if (showNotificationBadge)
              _NotificationBell(
                count: unreadCount,
                onTap: onNotificationTap,
              ),

            const SizedBox(width: 8),

            // Profile Avatar
            if (showProfile)
              _ProfileAvatar(
                name: displayName,
                imageUrl: avatarUrl,
                onTap: onProfileTap,
              ),
          ],
        );
  }

  /// Inner page variant: Back button + Title + Notification
  Widget _buildInnerPageHeader(
    BuildContext context,
    int unreadCount,
  ) {
    return Row(
      children: [
        // Back button or leading space
        if (onBack != null)
          IconButton(
            icon: Icon(
              Icons.chevron_left,
              size: 28,
              color: context.onSurface,
            ),
            onPressed: onBack,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
            tooltip: 'Back',
          )
        else
          const SizedBox(width: 48), // Match back button width

        // Title
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (title != null)
                Text(
                  title!,
                  style: context.headlineSmall.copyWith(
                    color: context.onSurface,
                    fontWeight: FontWeight.w700,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              if (subtitle != null)
                Text(
                  subtitle!,
                  style: context.caption.copyWith(
                    color: context.onSurfaceVariant,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
            ],
          ),
        ),

        // Notification Bell
        if (showNotificationBadge)
          _NotificationBell(
            count: unreadCount,
            onTap: onNotificationTap,
          ),
      ],
    );
  }
}

/// Notification bell with badge
class _NotificationBell extends ConsumerWidget {
  const _NotificationBell({
    required this.count,
    this.onTap,
  });

  final int count;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Stack(
      children: [
        IconButton(
          icon: Icon(
            Icons.notifications_outlined,
            size: 24,
            color: context.onSurface,
          ),
          onPressed: onTap,
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
          tooltip: 'Notifications',
        ),
        if (count > 0)
          Positioned(
            right: 6,
            top: 6,
            child: Container(
              padding: const EdgeInsets.all(2),
              decoration: BoxDecoration(
                color: context.danger,
                shape: BoxShape.circle,
                border: Border.all(
                  color: context.surface,
                  width: 2,
                ),
              ),
              constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
              child: Text(
                count > 9 ? '9+' : count.toString(),
                style: context.caption.copyWith(
                  color: context.onDanger,
                  fontWeight: FontWeight.w700,
                  fontSize: 9,
                ),
                textAlign: TextAlign.center,
              ),
            ),
      ],
    );
  }
}

/// Profile avatar with initials fallback
class _ProfileAvatar extends StatelessWidget {
  const _ProfileAvatar({
    required this.name,
    this.imageUrl,
    this.onTap,
  }) : size = 36;

  final String name;
  final String? imageUrl;
  final VoidCallback? onTap;
  final double size;

  @override
  Widget build(BuildContext context) {
    final initials = _getInitials(name);
    final hasImage = imageUrl != null && imageUrl!.isNotEmpty;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(
            color: context.outlineVariant,
            width: 1.5,
          ),
          image: hasImage
              ? DecorationImage(
                  image: NetworkImage(imageUrl!),
                  fit: BoxFit.cover,
                )
              : null,
          color: hasImage ? null : context.primaryContainer,
        ),
        child: !hasImage
            ? Center(
                child: Text(
                  initials,
                  style: context.labelMedium.copyWith(
                    color: context.onPrimaryContainer,
                    fontWeight: FontWeight.w700,
                    fontSize: size * 0.35,
                  ),
                ),
              )
            : null,
      ),
    );
  }

  String _getInitials(String name) {
    final parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    return name.isNotEmpty ? name[0].toUpperCase() : '?';
  }
}
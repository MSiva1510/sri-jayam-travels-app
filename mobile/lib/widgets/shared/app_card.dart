// ─────────────────────────────────────────────────────────────────────────────
// app_card.dart — Sri Jayam Travels Shared Card Components
// Base cards used across Driver & Manager screens
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';

import '../../core/theme.dart';
import 'app_buttons.dart';

/// Base card with consistent styling
class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.all(AppSpacing.cardPadding),
    this.margin,
    this.elevation = AppElevation.level1,
    this.border,
    this.color,
    this.borderRadius,
    this.gradient,
    this.constrained = true,
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry? margin;
  final AppElevation elevation;
  final BoxBorder? border;
  final Color? color;
  final BorderRadius? borderRadius;
  final LinearGradient? gradient;
  final bool constrained;

  @override
  Widget build(BuildContext context) {
    final cardColor = color ?? context.surface;
    final cardBorder = border ??
        Border.all(
          color: context.outlineVariant,
          width: 1,
        );
    final cardRadius = borderRadius ?? context.card;

    final cardWidget = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: cardRadius,
        border: cardBorder,
        gradient: gradient,
        boxShadow: elevation.resolve(context),
      ),
      child: child,
    );

    if (onTap != null) {
      return InkWell(
        onTap: onTap,
        borderRadius: cardRadius,
        child: constrained
            ? ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 48),
                child: cardWidget,
              )
            : cardWidget,
      );
    }

    return constrained
        ? ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 48),
            child: cardWidget,
          )
        : cardWidget;
  }
}

/// Hero card — prominent card for key metrics (dashboard)
class HeroCard extends StatelessWidget {
  const HeroCard({
    super.key,
    required this.child,
    this.onTap,
    this.gradient,
    this.padding = const EdgeInsets.all(AppSpacing.cardPaddingLarge),
  });

  final Widget child;
  final VoidCallback? onTap;
  final LinearGradient? gradient;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final effectiveGradient = gradient ??
        LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            context.primary.withValues(alpha: 0.08),
            context.primary.withValues(alpha: 0.02),
          ],
        );

    return Container(
      padding: padding,
      decoration: BoxDecoration(
        gradient: effectiveGradient,
        borderRadius: context.cardLarge,
        border: Border.all(
          color: context.primary.withValues(alpha: 0.2),
          width: 1,
        ),
        boxShadow: AppElevation.level1.resolve(context),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: context.cardLarge,
        child: child,
      ),
    );
  }
}

/// Stat card — for dashboard KPIs
class StatCard extends StatelessWidget {
  const StatCard({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    this.subtitle,
    this.gradient,
    this.iconBackground,
    this.onTap,
    this.trend,
    this.trendUp,
  });

  final IconData icon;
  final String label;
  final String value;
  final String? subtitle;
  final LinearGradient? gradient;
  final Color? iconBackground;
  final VoidCallback? onTap;
  final double? trend;
  final bool? trendUp;

  @override
  Widget build(BuildContext context) {
    final cardGradient = gradient ??
        LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            context.surface,
            context.surfaceContainer,
          ],
        );

    return AppCard(
      onTap: onTap,
      padding: EdgeInsets.all(AppSpacing.cardPaddingLarge),
      gradient: cardGradient,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  gradient: gradient ?? LinearGradient(
                    colors: [context.primary, context.primary.withValues(alpha: 0.7)],
                  ),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  icon,
                  size: 20,
                  color: context.onPrimary,
                ),
              ),
              if (trend != null) const Spacer(),
              if (trend != null)
                _TrendBadge(value: trend!, isUp: trendUp ?? true),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            value,
            style: context.headlineMedium.copyWith(
              color: context.onSurface,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: context.caption.copyWith(
              color: context.onSurfaceVariant,
            ),
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 2),
            Text(
              subtitle!,
              style: context.caption.copyWith(
                color: context.onSurfaceVariant,
              ),
            ),
          ],
      );
  }
}

class _TrendBadge extends StatelessWidget {
  const _TrendBadge({required this.value, required this.isUp});

  final double value;
  final bool isUp;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: (isUp ? context.success : context.danger).withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isUp ? Icons.trending_up : Icons.trending_down,
            size: 12,
            color: isUp ? context.success : context.danger,
          ),
          const SizedBox(width: 4),
          Text(
            '${value.abs().toStringAsFixed(1)}%',
            style: context.caption.copyWith(
              color: isUp ? context.success : context.danger,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

/// Section header with optional action
class SectionHeader extends StatelessWidget {
  const SectionHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.actionLabel,
    this.onActionTap,
    this.icon,
  });

  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onActionTap;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: context.screenMargin, vertical: AppSpacing.sm),
      child: Row(
        children: [
          if (icon != null) ...[
            Icon(icon, size: 20, color: context.primary),
            const SizedBox(width: 8),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: context.headlineSmall.copyWith(
                    color: context.onSurface,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (subtitle != null)
                  Text(
                    subtitle!,
                    style: context.caption.copyWith(
                      color: context.onSurfaceVariant,
                    ),
                  ),
              ],
            ),
          ),
          if (actionLabel != null && onActionTap != null)
            TextButton(
              onPressed: onActionTap,
              child: Text(
                actionLabel!,
                style: context.labelMedium.copyWith(
                  color: context.primary,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Status badge — pill-shaped with semantic colors
class StatusBadge extends StatelessWidget {
  const StatusBadge({
    super.key,
    required this.label,
    required this.type,
    this.icon,
    this.compact = false,
  });

  final String label;
  final StatusBadgeType type;
  final IconData? icon;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final (bgColor, textColor, dotColor) = switch (type) {
      StatusBadgeType.success => (context.successContainer, context.onSuccessContainer, context.success),
      StatusBadgeType.warning => (context.warningContainer, context.onWarningContainer, context.warning),
      StatusBadgeType.danger => (context.dangerContainer, context.onDangerContainer, context.danger),
      StatusBadgeType.info => (context.infoContainer, context.onInfoContainer, context.info),
      StatusBadgeType.neutral => (context.surfaceContainerHigh, context.onSurfaceVariant, context.outline),
    };

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 8 : 10,
        vertical: compact ? 4 : 6,
      ),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: context.badge,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: dotColor,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 6),
          if (icon != null) ...[
            Icon(icon, size: compact ? 10 : 12, color: textColor),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: context.statusLabel.copyWith(
              color: textColor,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

enum StatusBadgeType {
  success,
  warning,
  danger,
  info,
  neutral,
}

/// Empty state widget
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.actionLabel,
    this.onActionTap,
    this.iconSize = 64,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onActionTap;
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(context.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: iconSize,
              height: iconSize,
              decoration: BoxDecoration(
                color: context.surfaceContainer,
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                size: iconSize * 0.5,
                color: context.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              title,
              style: context.headlineSmall.copyWith(
                color: context.onSurface,
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 8),
              Text(
                subtitle!,
                style: context.bodyMedium.copyWith(
                  color: context.onSurfaceVariant,
                ),
                textAlign: TextAlign.center,
              ),
            ],
            if (actionLabel != null && onActionTap != null) ...[
              const SizedBox(height: 20),
              PrimaryButton(
                onPressed: onActionTap,
                label: actionLabel!,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Error state widget
class ErrorState extends StatelessWidget {
  const ErrorState({
    super.key,
    required this.message,
    this.onRetry,
    this.retryLabel = 'Try Again',
    this.icon = Icons.error_outline,
  });

  final String message;
  final VoidCallback? onRetry;
  final String retryLabel;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(context.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: context.dangerContainer,
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                size: 32,
                color: context.danger,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Something went wrong',
              style: context.headlineSmall.copyWith(
                color: context.onSurface,
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              message,
              style: context.bodyMedium.copyWith(
                color: context.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 20),
              PrimaryButton(
                onPressed: onRetry,
                label: retryLabel,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Loading state widget
class LoadingState extends StatelessWidget {
  const LoadingState({
    super.key,
    this.message,
    this.size = 32,
  });

  final String? message;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(context.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: size,
              height: size,
              child: CircularProgressIndicator(
                strokeWidth: 3,
                valueColor: AlwaysStoppedAnimation<Color>(context.primary),
              ),
            ),
            if (message != null) ...[
              const SizedBox(height: 16),
              Text(
                message!,
                style: context.bodyMedium.copyWith(
                  color: context.onSurfaceVariant,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Skeleton loader for cards
class Skeleton extends StatelessWidget {
  const Skeleton({
    super.key,
    this.width,
    this.height,
    this.borderRadius,
  });

  final double? width;
  final double? height;
  final BorderRadius? borderRadius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: context.surfaceContainerHighest,
        borderRadius: borderRadius ?? context.card,
      ),
      child: _ShimmerEffect(borderRadius: borderRadius ?? context.card),
    );
  }
}

class _ShimmerEffect extends StatefulWidget {
  final BorderRadius borderRadius;

  const _ShimmerEffect({required this.borderRadius});

  @override
  State<_ShimmerEffect> createState() => _ShimmerEffectState();
}

class _ShimmerEffectState extends State<_ShimmerEffect> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    )..repeat(reverse: true);
    _animation = Tween<double>(begin: 0.4, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return Opacity(
          opacity: _animation.value,
          child: child,
        );
      },
      child: Container(
        decoration: BoxDecoration(
          color: context.surfaceContainer,
          borderRadius: widget.borderRadius,
        ),
      ),
    );
  }
}
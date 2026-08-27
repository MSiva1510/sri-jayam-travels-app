// ─────────────────────────────────────────────────────────────────────────────
// app_buttons.dart — Sri Jayam Travels Shared Button Components
// Primary, Secondary, Danger, Ghost buttons with consistent styling
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';

import '../../core/theme.dart';
import '../../core/theme/context_extensions.dart';

/// Primary button — main CTA
class PrimaryButton extends StatelessWidget {
  const PrimaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.iconPosition = IconPosition.leading,
    this.fullWidth = true,
    this.loading = false,
    this.size = ButtonSize.large,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final IconPosition iconPosition;
  final bool fullWidth;
  final bool loading;
  final ButtonSize size;

  @override
  Widget build(BuildContext context) {
    final buttonStyle = FilledButton.styleFrom(
      backgroundColor: context.primary,
      foregroundColor: context.onPrimary,
      disabledBackgroundColor: context.outlineVariant,
      disabledForegroundColor: context.onSurfaceVariant,
      minimumSize: Size(fullWidth ? double.infinity : 0, _height),
      padding: _padding,
      shape: RoundedRectangleBorder(borderRadius: context.button),
      textStyle: _textStyle,
      elevation: 0,
    ).copyWith(
      overlayColor: WidgetStateProperty.resolveWith<Color?>(
        (states) {
          if (states.contains(WidgetState.pressed)) {
            return context.primary.withValues(alpha: 0.8);
          }
          if (states.contains(WidgetState.hovered)) {
            return context.primary.withValues(alpha: 0.9);
          }
          return null;
        },
      ),
    );

    return FilledButton(
      onPressed: loading ? null : onPressed,
      style: buttonStyle,
      child: loading
          ? SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation<Color>(context.onPrimary),
              ),
            )
          : _buildContent(context),
    );
  }

  Widget _buildContent(BuildContext context) {
    if (icon == null) return Text(label);

    final iconWidget = Icon(icon, size: _iconSize);

    if (iconPosition == IconPosition.leading) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [iconWidget, const SizedBox(width: 8), Text(label)],
      );
    } else {
      return Row(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [Text(label), const SizedBox(width: 8), iconWidget],
      );
    }
  }

  double get _height => switch (size) {
        ButtonSize.small => 36,
        ButtonSize.medium => 44,
        ButtonSize.large => 48,
      };

  EdgeInsets get _padding => switch (size) {
        ButtonSize.small => const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        ButtonSize.medium => const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        ButtonSize.large => const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      };

  TextStyle get _textStyle => context.labelMedium.copyWith(
        fontWeight: FontWeight.w700,
        fontSize: switch (size) {
          ButtonSize.small => 11,
          ButtonSize.medium => 12,
          ButtonSize.large => 13,
        },
      );

  double get _iconSize => switch (size) {
        ButtonSize.small => 16,
        ButtonSize.medium => 18,
        ButtonSize.large => 20,
      };
}

/// Secondary button — outlined alternative
class SecondaryButton extends StatelessWidget {
  const SecondaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.iconPosition = IconPosition.leading,
    this.fullWidth = true,
    this.loading = false,
    this.size = ButtonSize.large,
    this.variant = SecondaryVariant.primary,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final IconPosition iconPosition;
  final bool fullWidth;
  final bool loading;
  final ButtonSize size;
  final SecondaryVariant variant;

  @override
  Widget build(BuildContext context) {
    final (borderColor, textColor) = switch (variant) {
      SecondaryVariant.primary => (context.primary, context.primary),
      SecondaryVariant.success => (context.success, context.success),
      SecondaryVariant.warning => (context.warning, context.warning),
      SecondaryVariant.danger => (context.danger, context.danger),
      SecondaryVariant.neutral => (context.outline, context.onSurfaceVariant),
    };

    final buttonStyle = OutlinedButton.styleFrom(
      foregroundColor: textColor,
      disabledForegroundColor: context.onSurfaceVariant,
      side: BorderSide(color: borderColor, width: 1.5),
      minimumSize: Size(fullWidth ? double.infinity : 0, _height),
      padding: _padding,
      shape: RoundedRectangleBorder(borderRadius: context.button),
      textStyle: _textStyle,
    ).copyWith(
      overlayColor: WidgetStateProperty.resolveWith<Color?>(
        (states) {
          if (states.contains(WidgetState.pressed)) {
            return borderColor.withValues(alpha: 0.1);
          }
          if (states.contains(WidgetState.hovered)) {
            return borderColor.withValues(alpha: 0.05);
          }
          return null;
        },
      ),
    );

    return OutlinedButton(
      onPressed: loading ? null : onPressed,
      style: buttonStyle,
      child: loading
          ? SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation<Color>(textColor),
              ),
            )
          : _buildContent(context),
    );
  }

  Widget _buildContent(BuildContext context) {
    if (icon == null) return Text(label);

    final iconWidget = Icon(icon, size: _iconSize, color: variant == SecondaryVariant.neutral ? context.onSurfaceVariant : null);

    if (iconPosition == IconPosition.leading) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [iconWidget, const SizedBox(width: 8), Text(label)],
      );
    } else {
      return Row(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [Text(label), const SizedBox(width: 8), iconWidget],
      );
    }
  }

  double get _height => switch (size) {
        ButtonSize.small => 36,
        ButtonSize.medium => 44,
        ButtonSize.large => 48,
      };

  EdgeInsets get _padding => switch (size) {
        ButtonSize.small => const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        ButtonSize.medium => const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        ButtonSize.large => const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      };

  TextStyle get _textStyle => context.labelMedium.copyWith(
        fontWeight: FontWeight.w700,
        fontSize: switch (size) {
          ButtonSize.small => 11,
          ButtonSize.medium => 12,
          ButtonSize.large => 13,
        },
      );

  double get _iconSize => switch (size) {
        ButtonSize.small => 16,
        ButtonSize.medium => 18,
        ButtonSize.large => 20,
      };
}

enum SecondaryVariant {
  primary,
  success,
  warning,
  danger,
  neutral,
}

/// Danger button — destructive actions
class DangerButton extends StatelessWidget {
  const DangerButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.iconPosition = IconPosition.leading,
    this.fullWidth = true,
    this.loading = false,
    this.size = ButtonSize.large,
    this.style = DangerStyle.filled,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final IconPosition iconPosition;
  final bool fullWidth;
  final bool loading;
  final ButtonSize size;
  final DangerStyle style;

  @override
  Widget build(BuildContext context) {
    final isFilled = style == DangerStyle.filled;

    final buttonStyle = (isFilled ? FilledButton.styleFrom : OutlinedButton.styleFrom)(
      backgroundColor: isFilled ? context.danger : null,
      foregroundColor: isFilled ? context.onDanger : context.danger,
      disabledBackgroundColor: isFilled ? context.danger.withValues(alpha: 0.4) : null,
      disabledForegroundColor: isFilled ? context.onDanger.withValues(alpha: 0.6) : context.danger.withValues(alpha: 0.4),
      side: isFilled ? null : BorderSide(color: context.danger, width: 1.5),
      minimumSize: Size(fullWidth ? double.infinity : 0, _height),
      padding: _padding,
      shape: RoundedRectangleBorder(borderRadius: context.button),
      textStyle: _textStyle,
      elevation: 0,
    ).copyWith(
      overlayColor: WidgetStateProperty.resolveWith<Color?>(
        (states) {
          if (states.contains(WidgetState.pressed)) {
            return context.danger.withValues(alpha: isFilled ? 0.8 : 0.1);
          }
          if (states.contains(WidgetState.hovered)) {
            return context.danger.withValues(alpha: isFilled ? 0.9 : 0.05);
          }
          return null;
        },
      ),
    );

    return isFilled
        ? FilledButton(
            onPressed: loading ? null : onPressed,
            style: buttonStyle,
            child: loading ? _loadingIndicator(context) : _buildContent(context),
          )
        : OutlinedButton(
            onPressed: loading ? null : onPressed,
            style: buttonStyle,
            child: loading ? _loadingIndicator(context) : _buildContent(context),
          );
  }

  Widget _buildContent(BuildContext context) {
    if (icon == null) return Text(label);

    final iconWidget = Icon(icon, size: _iconSize, color: style == DangerStyle.filled ? context.onDanger : context.danger);

    if (iconPosition == IconPosition.leading) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [iconWidget, const SizedBox(width: 8), Text(label)],
      );
    } else {
      return Row(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [Text(label), const SizedBox(width: 8), iconWidget],
      );
    }
  }

  Widget _loadingIndicator(BuildContext context) {
    return SizedBox(
      width: 20,
      height: 20,
      child: CircularProgressIndicator(
        strokeWidth: 2,
        valueColor: AlwaysStoppedAnimation<Color>(style == DangerStyle.filled ? context.onDanger : context.danger),
      ),
    );
  }

  double get _height => switch (size) {
        ButtonSize.small => 36,
        ButtonSize.medium => 44,
        ButtonSize.large => 48,
      };

  EdgeInsets get _padding => switch (size) {
        ButtonSize.small => const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        ButtonSize.medium => const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        ButtonSize.large => const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      };

  TextStyle get _textStyle => context.labelMedium.copyWith(
        fontWeight: FontWeight.w700,
        fontSize: switch (size) {
          ButtonSize.small => 11,
          ButtonSize.medium => 12,
          ButtonSize.large => 13,
        },
      );

  double get _iconSize => switch (size) {
        ButtonSize.small => 16,
        ButtonSize.medium => 18,
        ButtonSize.large => 20,
      };
}

enum DangerStyle {
  filled,
  outlined,
}

/// Ghost button — minimal, for tertiary actions
class GhostButton extends StatelessWidget {
  const GhostButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.iconPosition = IconPosition.leading,
    this.fullWidth = false,
    this.size = ButtonSize.medium,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final IconPosition iconPosition;
  final bool fullWidth;
  final ButtonSize size;

  @override
  Widget build(BuildContext context) {
    final buttonStyle = TextButton.styleFrom(
      foregroundColor: context.primary,
      disabledForegroundColor: context.onSurfaceVariant,
      minimumSize: Size(fullWidth ? double.infinity : 0, _height),
      padding: _padding,
      shape: RoundedRectangleBorder(borderRadius: context.button),
      textStyle: _textStyle,
    ).copyWith(
      overlayColor: WidgetStateProperty.resolveWith<Color?>(
        (states) {
          if (states.contains(WidgetState.pressed)) {
            return context.primary.withValues(alpha: 0.1);
          }
          if (states.contains(WidgetState.hovered)) {
            return context.primary.withValues(alpha: 0.05);
          }
          return null;
        },
      ),
    );

    return TextButton(
      onPressed: onPressed,
      style: buttonStyle,
      child: _buildContent(context),
    );
  }

  Widget _buildContent(BuildContext context) {
    if (icon == null) return Text(label);

    final iconWidget = Icon(icon, size: _iconSize, color: context.primary);

    if (iconPosition == IconPosition.leading) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [iconWidget, const SizedBox(width: 8), Text(label)],
      );
    } else {
      return Row(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [Text(label), const SizedBox(width: 8), iconWidget],
      );
    }
  }

  double get _height => switch (size) {
        ButtonSize.small => 32,
        ButtonSize.medium => 40,
        ButtonSize.large => 44,
      };

  EdgeInsets get _padding => switch (size) {
        ButtonSize.small => const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        ButtonSize.medium => const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        ButtonSize.large => const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
      };

  TextStyle get _textStyle => context.labelMedium.copyWith(
        fontWeight: FontWeight.w600,
        fontSize: switch (size) {
          ButtonSize.small => 11,
          ButtonSize.medium => 12,
          ButtonSize.large => 13,
        },
      );

  double get _iconSize => switch (size) {
        ButtonSize.small => 14,
        ButtonSize.medium => 16,
        ButtonSize.large => 18,
      };
}

/// Icon button with consistent styling
class AppIconButton extends StatelessWidget {
  const AppIconButton({
    super.key,
    required this.icon,
    this.onPressed,
    this.size = 40,
    this.iconSize = 22,
    this.backgroundColor,
    this.foregroundColor,
    this.tooltip,
    this.semanticLabel,
  });

  final IconData icon;
  final VoidCallback? onPressed;
  final double size;
  final double iconSize;
  final Color? backgroundColor;
  final Color? foregroundColor;
  final String? tooltip;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: backgroundColor ?? Colors.transparent,
      shape: const CircleBorder(),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(size / 2),
        child: Container(
          width: size,
          height: size,
          alignment: Alignment.center,
          child: Icon(
            icon,
            size: iconSize,
            color: foregroundColor ?? context.onSurface,
          ),
        ),
      ),
    );
  }
}

/// Button size enum
enum ButtonSize {
  small,
  medium,
  large,
}

/// Icon position enum
enum IconPosition {
  leading,
  trailing,
}
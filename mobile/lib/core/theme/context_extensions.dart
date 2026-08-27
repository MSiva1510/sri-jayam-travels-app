// ─────────────────────────────────────────────────────────────────────────────
// context_extensions.dart — Consolidated BuildContext Extensions
// Single import for all theme, spacing, radius, and color getters
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';

import 'app_colors.dart';
import 'app_typography.dart';
import 'app_spacing.dart';
import 'app_radius.dart';
import 'app_shadows.dart';

/// Consolidated extension providing all theme-related getters on BuildContext
extension AppContextExtensions on BuildContext {
  // ── Colors ──────────────────────────────────────────────────────────────
  Color get primary => isDark ? AppDarkColors.primary : AppLightColors.primary;
  Color get onPrimary => isDark ? AppDarkColors.onPrimary : AppLightColors.onPrimary;
  Color get primaryContainer => isDark ? AppDarkColors.primaryContainer : AppLightColors.primaryContainer;
  Color get onPrimaryContainer => isDark ? AppDarkColors.onPrimaryContainer : AppLightColors.onPrimaryContainer;

  Color get background => isDark ? AppDarkColors.background : AppLightColors.background;
  Color get surface => isDark ? AppDarkColors.surface : AppLightColors.surface;
  Color get surfaceContainer => isDark ? AppDarkColors.surfaceContainer : AppLightColors.surfaceContainer;
  Color get surfaceContainerHigh => isDark ? AppDarkColors.surfaceContainerHigh : AppLightColors.surfaceContainerHigh;
  Color get surfaceContainerHighest => isDark ? AppDarkColors.surfaceContainerHighest : AppLightColors.surfaceContainerHighest;
  Color get surfaceDim => isDark ? AppDarkColors.surfaceDim : AppLightColors.surfaceDim;
  Color get surfaceBright => isDark ? AppDarkColors.surfaceBright : AppLightColors.surfaceBright;

  Color get onSurface => isDark ? AppDarkColors.onSurface : AppLightColors.onSurface;
  Color get onSurfaceVariant => isDark ? AppDarkColors.onSurfaceVariant : AppLightColors.onSurfaceVariant;
  Color get onBackground => isDark ? AppDarkColors.onBackground : AppLightColors.onBackground;
  Color get outline => isDark ? AppDarkColors.outline : AppLightColors.outline;
  Color get outlineVariant => isDark ? AppDarkColors.outlineVariant : AppLightColors.outlineVariant;

  Color get success => isDark ? AppDarkColors.success : AppLightColors.success;
  Color get onSuccess => isDark ? AppDarkColors.onSuccess : AppLightColors.onSuccess;
  Color get successContainer => isDark ? AppDarkColors.successContainer : AppLightColors.successContainer;
  Color get onSuccessContainer => isDark ? AppDarkColors.onSuccessContainer : AppLightColors.onSuccessContainer;

  Color get warning => isDark ? AppDarkColors.warning : AppLightColors.warning;
  Color get onWarning => isDark ? AppDarkColors.onWarning : AppLightColors.onWarning;
  Color get warningContainer => isDark ? AppDarkColors.warningContainer : AppLightColors.warningContainer;
  Color get onWarningContainer => isDark ? AppDarkColors.onWarningContainer : AppLightColors.onWarningContainer;

  Color get danger => isDark ? AppDarkColors.danger : AppLightColors.danger;
  Color get onDanger => isDark ? AppDarkColors.onDanger : AppLightColors.onDanger;
  Color get dangerContainer => isDark ? AppDarkColors.dangerContainer : AppLightColors.dangerContainer;
  Color get onDangerContainer => isDark ? AppDarkColors.onDangerContainer : AppLightColors.onDangerContainer;

  Color get info => isDark ? AppDarkColors.info : AppLightColors.info;
  Color get onInfo => isDark ? AppDarkColors.onInfo : AppLightColors.onInfo;
  Color get infoContainer => isDark ? AppDarkColors.infoContainer : AppLightColors.infoContainer;
  Color get onInfoContainer => isDark ? AppDarkColors.onInfoContainer : AppLightColors.onInfoContainer;

  Color get inverseSurface => isDark ? AppDarkColors.inverseSurface : AppLightColors.inverseSurface;
  Color get inverseOnSurface => isDark ? AppDarkColors.inverseOnSurface : AppLightColors.inverseOnSurface;
  Color get inversePrimary => isDark ? AppDarkColors.inversePrimary : AppLightColors.inversePrimary;

  Color get shadow => isDark ? AppDarkColors.shadow : AppLightColors.shadow;
  Color get shadowStrong => isDark ? AppDarkColors.shadowStrong : AppLightColors.shadowStrong;

  bool get isDark => Theme.of(this).brightness == Brightness.dark;

  // ── Typography ──────────────────────────────────────────────────────────
  TextStyle get displayLarge => typo.displayLarge(this);
  TextStyle get headlineMedium => typo.headlineMedium(this);
  TextStyle get headlineSmall => typo.headlineSmall(this);
  TextStyle get bodyLarge => typo.bodyLarge(this);
  TextStyle get bodyMedium => typo.bodyMedium(this);
  TextStyle get bodyMediumBold => typo.bodyMediumBold(this);
  TextStyle get labelMedium => typo.labelMedium(this);
  TextStyle get labelSmall => typo.labelSmall(this);
  TextStyle get caption => typo.caption(this);
  TextStyle get overline => typo.overline(this);
  TextStyle get statusLabel => typo.statusLabel(this);

  // ── Spacing ─────────────────────────────────────────────────────────────
  double get xs => AppSpacing.xs;
  double get sm => AppSpacing.sm;
  double get md => AppSpacing.md;
  double get lg => AppSpacing.lg;
  double get xl => AppSpacing.xl;
  double get xxl => AppSpacing.xxl;

  double get screenMargin => AppSpacing.screenMargin;
  double get gutter => AppSpacing.gutter;
  double get cardPadding => AppSpacing.cardPadding;
  double get cardPaddingLarge => AppSpacing.cardPaddingLarge;
  double get buttonHeight => AppSpacing.buttonHeight;

  double get avatarSmall => AppSpacing.avatarSmall;
  double get avatarMedium => AppSpacing.avatarMedium;
  double get avatarLarge => AppSpacing.avatarLarge;
  double get avatarXLarge => AppSpacing.avatarXLarge;

  double get bottomNavHeight => AppSpacing.bottomNavHeight;
  double get headerHeight => AppSpacing.headerHeight;
  double get headerHeightLarge => AppSpacing.headerHeightLarge;

  bool get isMobile => MediaQuery.of(this).size.width < AppSpacing.bpMobile;
  bool get isTablet => MediaQuery.of(this).size.width >= AppSpacing.bpMobile && MediaQuery.of(this).size.width < AppSpacing.bpTablet;
  bool get isDesktop => MediaQuery.of(this).size.width >= AppSpacing.bpDesktop;

  // ── Radius ──────────────────────────────────────────────────────────────
  BorderRadius get card => AppRadius.card;
  BorderRadius get cardLarge => AppRadius.cardLarge;
  BorderRadius get button => AppRadius.button;
  BorderRadius get input => AppRadius.input;
  BorderRadius get badge => AppRadius.badge;
  BorderRadius get avatar => AppRadius.avatar;
  BorderRadius get bottomSheet => AppRadius.bottomSheet;
  BorderRadius get modal => AppRadius.modal;
  BorderRadius get chip => AppRadius.chip;

// ── Shadows ─────────────────────────────────────────────────────────────
  List<BoxShadow> get cardShadow => AppElevation.level1.resolve(this);
  List<BoxShadow> get modalShadow => AppElevation.level2.resolve(this);
  List<BoxShadow> get floatingShadow => AppElevation.level3.resolve(this);
  Border get hairlineBorder => AppShadows.hairline(this);

  // ── Typography shortcut ─────────────────────────────────────────────────
  AppTypography get typo => const AppTypography();
}
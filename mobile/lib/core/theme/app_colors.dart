// ─────────────────────────────────────────────────────────────────────────────
// app_colors.dart — Sri Jayam Travels Semantic Color Tokens
// Based on DESIGN.md (Modern Mobility) — Deep Navy primary, Soft Neutrals
// Supports Light + Dark themes with proper tonal layering
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';

/// Light theme color tokens
class AppLightColors {
  // ── Brand ──────────────────────────────────────────────────────────────
  static const primary = Color(0xFF0F172A);       // Deep Navy — primary actions, headers
  static const onPrimary = Color(0xFFFFFFFF);
  static const primaryContainer = Color(0xFFDAE2FD);
  static const onPrimaryContainer = Color(0xFF131B2E);

  // ── Surface (Tonal Layering) ───────────────────────────────────────────
  static const background = Color(0xFFF8F9FF);    // Level 0 — Main background
  static const surface = Color(0xFFFFFFFF);       // Level 1 — Cards, containers
  static const surfaceContainer = Color(0xFFE5EEFF);
  static const surfaceContainerHigh = Color(0xFFDCE9FF);
  static const surfaceContainerHighest = Color(0xFFD3E4FE);
  static const surfaceDim = Color(0xFFCBDFF5);
  static const surfaceBright = Color(0xFFF8F9FF);

  // ── Content ────────────────────────────────────────────────────────────
  static const onSurface = Color(0xFF0B1C30);           // Primary text
  static const onSurfaceVariant = Color(0xFF45464D);    // Secondary text
  static const onBackground = Color(0xFF0B1C30);
  static const outline = Color(0xFF76777D);             // Borders, dividers
  static const outlineVariant = Color(0xFFC6C6CD);

  // ── Status (Calibrated for Light) ──────────────────────────────────────
  static const success = Color(0xFF059669);      // Active, completed
  static const onSuccess = Color(0xFFFFFFFF);
  static const successContainer = Color(0xFFD1FAE5);
  static const onSuccessContainer = Color(0xFF064E3B);

  static const warning = Color(0xFFD97706);      // Pending, attention
  static const onWarning = Color(0xFFFFFFFF);
  static const warningContainer = Color(0xFFFEF3C7);
  static const onWarningContainer = Color(0xFF78350F);

  static const danger = Color(0xFFDC2626);       // Critical, cancelled
  static const onDanger = Color(0xFFFFFFFF);
  static const dangerContainer = Color(0xFFFEF2F2);
  static const onDangerContainer = Color(0xFF991B1B);

  static const info = Color(0xFF2563EB);         // Info, navigation
  static const onInfo = Color(0xFFFFFFFF);
  static const infoContainer = Color(0xFFDBEAFE);
  static const onInfoContainer = Color(0xFF1E3A8A);

  // ── Inverse (for on-primary surfaces) ──────────────────────────────────
  static const inverseSurface = Color(0xFF213145);
  static const inverseOnSurface = Color(0xFFEAF1FF);
  static const inversePrimary = Color(0xFFBEC6E0);

  // ── Shadow ─────────────────────────────────────────────────────────────
  static const shadow = Color(0x0A000000);  // 4% black for Level 1
  static const shadowStrong = Color(0x14000000); // 8% black for Level 2
}

/// Dark theme color tokens — TRUE DARK, not inverted light
class AppDarkColors {
  // ── Brand ──────────────────────────────────────────────────────────────
  static const primary = Color(0xFFEAF1FF);       // Light navy tint for dark mode
  static const onPrimary = Color(0xFF0F172A);
  static const primaryContainer = Color(0xFF131B2E);
  static const onPrimaryContainer = Color(0xFF7C839B);

  // ── Surface (Tonal Layering) ───────────────────────────────────────────
  static const background = Color(0xFF0F172A);    // Deep Navy base
  static const surface = Color(0xFF1E2A3A);       // Level 1 — Cards
  static const surfaceContainer = Color(0xFF263548);
  static const surfaceContainerHigh = Color(0xFF2E3E52);
  static const surfaceContainerHighest = Color(0xFF36485E);
  static const surfaceDim = Color(0xFF172336);
  static const surfaceBright = Color(0xFF243447);

  // ── Content ────────────────────────────────────────────────────────────
  static const onSurface = Color(0xFFEAF1FF);           // Primary text
  static const onSurfaceVariant = Color(0xFFB0B8C8);    // Secondary text
  static const onBackground = Color(0xFFEAF1FF);
  static const outline = Color(0xFF6A7282);             // Borders, dividers
  static const outlineVariant = Color(0xFF4A5568);

  // ── Status (Calibrated for Dark) ───────────────────────────────────────
  static const success = Color(0xFF34D399);      // Active, completed
  static const onSuccess = Color(0xFF064E3B);
  static const successContainer = Color(0xFF064E3B);
  static const onSuccessContainer = Color(0xFFD1FAE5);

  static const warning = Color(0xFFFBBF24);      // Pending, attention
  static const onWarning = Color(0xFF78350F);
  static const warningContainer = Color(0xFF78350F);
  static const onWarningContainer = Color(0xFFFEF3C7);

  static const danger = Color(0xFFF87171);       // Critical, cancelled
  static const onDanger = Color(0xFF991B1B);
  static const dangerContainer = Color(0xFF991B1B);
  static const onDangerContainer = Color(0xFFFEF2F2);

  static const info = Color(0xFF60A5FA);         // Info, navigation
  static const onInfo = Color(0xFF1E3A8A);
  static const infoContainer = Color(0xFF1E3A8A);
  static const onInfoContainer = Color(0xFFDBEAFE);

  // ── Inverse ────────────────────────────────────────────────────────────
  static const inverseSurface = Color(0xFFF8F9FF);
  static const inverseOnSurface = Color(0xFF0B1C30);
  static const inversePrimary = Color(0xFF0F172A);

  // ── Shadow ─────────────────────────────────────────────────────────────
  static const shadow = Color(0x20000000);  // Darker shadows in dark mode
  static const shadowStrong = Color(0x40000000);
}

/// Semantic color accessor for easy migration
abstract class AppColors {
  // Brand
  static Color get primary => _isDark ? AppDarkColors.primary : AppLightColors.primary;
  static Color get onPrimary => _isDark ? AppDarkColors.onPrimary : AppLightColors.onPrimary;
  static Color get primaryContainer => _isDark ? AppDarkColors.primaryContainer : AppLightColors.primaryContainer;
  static Color get onPrimaryContainer => _isDark ? AppDarkColors.onPrimaryContainer : AppLightColors.onPrimaryContainer;

  // Surface
  static Color get background => _isDark ? AppDarkColors.background : AppLightColors.background;
  static Color get surface => _isDark ? AppDarkColors.surface : AppLightColors.surface;
  static Color get surfaceContainer => _isDark ? AppDarkColors.surfaceContainer : AppLightColors.surfaceContainer;
  static Color get surfaceContainerHigh => _isDark ? AppDarkColors.surfaceContainerHigh : AppLightColors.surfaceContainerHigh;
  static Color get surfaceContainerHighest => _isDark ? AppDarkColors.surfaceContainerHighest : AppLightColors.surfaceContainerHighest;
  static Color get surfaceDim => _isDark ? AppDarkColors.surfaceDim : AppLightColors.surfaceDim;
  static Color get surfaceBright => _isDark ? AppDarkColors.surfaceBright : AppLightColors.surfaceBright;

  // Content
  static Color get onSurface => _isDark ? AppDarkColors.onSurface : AppLightColors.onSurface;
  static Color get onSurfaceVariant => _isDark ? AppDarkColors.onSurfaceVariant : AppLightColors.onSurfaceVariant;
  static Color get onBackground => _isDark ? AppDarkColors.onBackground : AppLightColors.onBackground;
  static Color get outline => _isDark ? AppDarkColors.outline : AppLightColors.outline;
  static Color get outlineVariant => _isDark ? AppDarkColors.outlineVariant : AppLightColors.outlineVariant;

  // Status
  static Color get success => _isDark ? AppDarkColors.success : AppLightColors.success;
  static Color get onSuccess => _isDark ? AppDarkColors.onSuccess : AppLightColors.onSuccess;
  static Color get successContainer => _isDark ? AppDarkColors.successContainer : AppLightColors.successContainer;
  static Color get onSuccessContainer => _isDark ? AppDarkColors.onSuccessContainer : AppLightColors.onSuccessContainer;

  static Color get warning => _isDark ? AppDarkColors.warning : AppLightColors.warning;
  static Color get onWarning => _isDark ? AppDarkColors.onWarning : AppLightColors.onWarning;
  static Color get warningContainer => _isDark ? AppDarkColors.warningContainer : AppLightColors.warningContainer;
  static Color get onWarningContainer => _isDark ? AppDarkColors.onWarningContainer : AppLightColors.onWarningContainer;

  static Color get danger => _isDark ? AppDarkColors.danger : AppLightColors.danger;
  static Color get onDanger => _isDark ? AppDarkColors.onDanger : AppLightColors.onDanger;
  static Color get dangerContainer => _isDark ? AppDarkColors.dangerContainer : AppLightColors.dangerContainer;
  static Color get onDangerContainer => _isDark ? AppDarkColors.onDangerContainer : AppLightColors.onDangerContainer;

  static Color get info => _isDark ? AppDarkColors.info : AppLightColors.info;
  static Color get onInfo => _isDark ? AppDarkColors.onInfo : AppLightColors.onInfo;
  static Color get infoContainer => _isDark ? AppDarkColors.infoContainer : AppLightColors.infoContainer;
  static Color get onInfoContainer => _isDark ? AppDarkColors.onInfoContainer : AppLightColors.onInfoContainer;

  // Inverse
  static Color get inverseSurface => _isDark ? AppDarkColors.inverseSurface : AppLightColors.inverseSurface;
  static Color get inverseOnSurface => _isDark ? AppDarkColors.inverseOnSurface : AppLightColors.inverseOnSurface;
  static Color get inversePrimary => _isDark ? AppDarkColors.inversePrimary : AppLightColors.inversePrimary;

  // Shadow
  static Color get shadow => _isDark ? AppDarkColors.shadow : AppLightColors.shadow;
  static Color get shadowStrong => _isDark ? AppDarkColors.shadowStrong : AppLightColors.shadowStrong;

  // Internal - set by ThemeController
  static bool _isDark = false;
  static void setDarkMode(bool isDark) => _isDark = isDark;
}
// ─────────────────────────────────────────────────────────────────────────────
// app_shadows.dart — Sri Jayam Travels Elevation System
// Tonal Layering + Ambient Shadows per DESIGN.md
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'app_colors.dart';
import 'context_extensions.dart';

class AppShadows {
  const AppShadows();

  // ── Level 0: Base (no shadow) ──────────────────────────────────────────
  static const List<BoxShadow> none = [];

  // ── Level 1: Cards / Containers ────────────────────────────────────────
  /// Soft, diffused shadow — Blur: 15px, Y: 4px, Opacity: 4% Black
  static List<BoxShadow> get level1 => [
        BoxShadow(
          color: AppLightColors.shadow,
          blurRadius: 15,
          offset: const Offset(0, 4),
          spreadRadius: 0,
        ),
      ];

  static List<BoxShadow> get level1Dark => [
        BoxShadow(
          color: AppDarkColors.shadow,
          blurRadius: 15,
          offset: const Offset(0, 4),
          spreadRadius: 0,
        ),
      ];

  // ── Level 2: Modals / Bottom Sheets / Dropdowns ────────────────────────
  /// Stronger shadow — Blur: 25px, Y: 8px, Opacity: 8% Black
  static List<BoxShadow> get level2 => [
        BoxShadow(
          color: AppLightColors.shadowStrong,
          blurRadius: 25,
          offset: const Offset(0, 8),
          spreadRadius: 0,
        ),
      ];

  static List<BoxShadow> get level2Dark => [
        BoxShadow(
          color: AppDarkColors.shadowStrong,
          blurRadius: 25,
          offset: const Offset(0, 8),
          spreadRadius: 0,
        ),
      ];

  // ── Level 3: Floating Action / Overlays ────────────────────────────────
  /// Elevated — Blur: 30px, Y: 12px, Opacity: 12% Black
  static List<BoxShadow> get level3 => [
        BoxShadow(
          color: AppLightColors.shadowStrong,
          blurRadius: 30,
          offset: const Offset(0, 12),
          spreadRadius: -4,
        ),
      ];

  static List<BoxShadow> get level3Dark => [
        BoxShadow(
          color: AppDarkColors.shadowStrong,
          blurRadius: 30,
          offset: const Offset(0, 12),
          spreadRadius: -4,
        ),
      ];

  // ── Zero-Shadow Alternative (High-density data views) ──────────────────
  /// 1px border instead of shadow — for spreadsheet feel
  static Border get hairlineBorder => Border(
        top: BorderSide(
          color: AppColors.outlineVariant,
          width: 1,
        ),
        bottom: BorderSide(
          color: AppColors.outlineVariant,
          width: 1,
        ),
        left: BorderSide(
          color: AppColors.outlineVariant,
          width: 1,
        ),
        right: BorderSide(
          color: AppColors.outlineVariant,
          width: 1,
        ),
      );

  static Border get hairlineBorderDark => Border(
        top: BorderSide(
          color: AppDarkColors.outlineVariant,
          width: 1,
        ),
        bottom: BorderSide(
          color: AppDarkColors.outlineVariant,
          width: 1,
        ),
        left: BorderSide(
          color: AppDarkColors.outlineVariant,
          width: 1,
        ),
        right: BorderSide(
          color: AppDarkColors.outlineVariant,
          width: 1,
        ),
      );

  // ── Semantic Accessors (theme-aware) ───────────────────────────────────
  static List<BoxShadow> card(BuildContext context) =>
      context.isDark ? level1Dark : level1;

  static List<BoxShadow> modal(BuildContext context) =>
      context.isDark ? level2Dark : level2;

  static List<BoxShadow> floating(BuildContext context) =>
      context.isDark ? level3Dark : level3;

  static Border hairline(BuildContext context) =>
      context.isDark ? hairlineBorderDark : hairlineBorder;

  // ── Colored Shadows (for primary actions, status indicators) ───────────
  static List<BoxShadow> primaryGlow(BuildContext context) => [
        BoxShadow(
          color: context.primary.withValues(alpha: 0.3),
          blurRadius: 20,
          offset: const Offset(0, 8),
          spreadRadius: -4,
        ),
      ];

  static List<BoxShadow> successGlow(BuildContext context) => [
        BoxShadow(
          color: context.success.withValues(alpha: 0.3),
          blurRadius: 20,
          offset: const Offset(0, 8),
          spreadRadius: -4,
        ),
      ];

  static List<BoxShadow> dangerGlow(BuildContext context) => [
        BoxShadow(
          color: context.danger.withValues(alpha: 0.3),
          blurRadius: 20,
          offset: const Offset(0, 8),
          spreadRadius: -4,
        ),
      ];
}

/// Card elevation helper
enum AppElevation {
  none,
  level1,  // Cards
  level2,  // Modals, bottom sheets
  level3,  // FAB, floating elements
}

extension AppElevationX on AppElevation {
  List<BoxShadow> resolve(BuildContext context) {
    switch (this) {
      case AppElevation.none:
        return AppShadows.none;
      case AppElevation.level1:
        return AppShadows.card(context);
      case AppElevation.level2:
        return AppShadows.modal(context);
      case AppElevation.level3:
        return AppShadows.floating(context);
    }
  }
}
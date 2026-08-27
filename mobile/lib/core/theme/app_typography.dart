// ─────────────────────────────────────────────────────────────────────────────
// app_typography.dart — Sri Jayam Travels Typography System
// Font: Plus Jakarta Sans (loaded via Google Fonts or bundled)
// Scale based on DESIGN.md — Mobile optimized
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'context_extensions.dart';

class AppTypography {
  const AppTypography();

  // ── Font Family ────────────────────────────────────────────────────────
  static const String fontFamily = 'PlusJakartaSans';

  // ── Text Styles (Mobile Scale) ─────────────────────────────────────────

  /// 28px / 700 / 36px / -0.02em — Screen titles, major headers
  TextStyle displayLarge(BuildContext context) => GoogleFonts.plusJakartaSans(
        fontSize: 28,
        fontWeight: FontWeight.w700,
        height: 36 / 28,
        letterSpacing: -0.02 * 28,
        color: context.onSurface,
      );

  /// 24px / 600 / 32px / -0.01em — Section headers, card titles
  TextStyle headlineMedium(BuildContext context) => GoogleFonts.plusJakartaSans(
        fontSize: 20,
        fontWeight: FontWeight.w600,
        height: 28 / 20,
        letterSpacing: -0.01 * 20,
        color: context.onSurface,
      );

  /// 18px / 600 / 24px — Card titles, important labels
  TextStyle headlineSmall(BuildContext context) => GoogleFonts.plusJakartaSans(
        fontSize: 18,
        fontWeight: FontWeight.w600,
        height: 24 / 18,
        color: context.onSurface,
      );

  /// 16px / 400 / 24px — Primary body text, list items
  TextStyle bodyLarge(BuildContext context) => GoogleFonts.plusJakartaSans(
        fontSize: 16,
        fontWeight: FontWeight.w400,
        height: 24 / 16,
        color: context.onSurface,
      );

  /// 14px / 400 / 20px — Standard UI text, descriptions
  TextStyle bodyMedium(BuildContext context) => GoogleFonts.plusJakartaSans(
        fontSize: 14,
        fontWeight: FontWeight.w400,
        height: 20 / 14,
        color: context.onSurface,
      );

  /// 14px / 500 / 20px — Emphasized body, values
  TextStyle bodyMediumBold(BuildContext context) => GoogleFonts.plusJakartaSans(
        fontSize: 14,
        fontWeight: FontWeight.w500,
        height: 20 / 14,
        color: context.onSurface,
      );

  /// 12px / 600 / 16px / 0.05em — Buttons, chips, labels
  TextStyle labelMedium(BuildContext context) => GoogleFonts.plusJakartaSans(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        height: 16 / 12,
        letterSpacing: 0.05 * 12,
        color: context.onSurface,
      );

  /// 12px / 500 / 16px — Small labels, metadata
  TextStyle labelSmall(BuildContext context) => GoogleFonts.plusJakartaSans(
        fontSize: 12,
        fontWeight: FontWeight.w500,
        height: 16 / 12,
        color: context.onSurfaceVariant,
      );

  /// 11px / 500 / 14px — Captions, timestamps, helper text
  TextStyle caption(BuildContext context) => GoogleFonts.plusJakartaSans(
        fontSize: 11,
        fontWeight: FontWeight.w500,
        height: 14 / 11,
        color: context.onSurfaceVariant,
      );

  /// 10px / 600 / 14px / uppercase — Overlines, category labels
  TextStyle overline(BuildContext context) => GoogleFonts.plusJakartaSans(
        fontSize: 10,
        fontWeight: FontWeight.w600,
        height: 14 / 10,
        letterSpacing: 0.1,
        color: context.onSurfaceVariant,
      );

  /// 10px / 700 / 14px — Status pills, badges
  TextStyle statusLabel(BuildContext context) => GoogleFonts.plusJakartaSans(
        fontSize: 10,
        fontWeight: FontWeight.w700,
        height: 14 / 10,
        color: context.onSurface,
      );

  // ── Semantic Variants ──────────────────────────────────────────────────

  /// Primary colored text (for primary actions, links)
  TextStyle primary(BuildContext context, TextStyle base) => base.copyWith(color: context.primary);

  /// Success colored text
  TextStyle success(BuildContext context, TextStyle base) => base.copyWith(color: context.success);

  /// Warning colored text
  TextStyle warning(BuildContext context, TextStyle base) => base.copyWith(color: context.warning);

  /// Danger colored text
  TextStyle danger(BuildContext context, TextStyle base) => base.copyWith(color: context.danger);

  /// Info colored text
  TextStyle info(BuildContext context, TextStyle base) => base.copyWith(color: context.info);

  /// Muted secondary text
  TextStyle muted(BuildContext context, TextStyle base) => base.copyWith(color: context.onSurfaceVariant);

  /// White text (for on-primary surfaces)
  TextStyle onPrimary(BuildContext context, TextStyle base) => base.copyWith(color: context.onPrimary);

  /// White text (for on-danger surfaces)
  TextStyle onDanger(BuildContext context, TextStyle base) => base.copyWith(color: context.onDanger);

  /// Static factory methods for use in ThemeData (no BuildContext required)
  static TextStyle headlineSmallStatic(Color color) => GoogleFonts.plusJakartaSans(
        fontSize: 18,
        fontWeight: FontWeight.w600,
        height: 24 / 18,
        color: color,
      );

  static TextStyle labelMediumStatic(Color color) => GoogleFonts.plusJakartaSans(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        height: 16 / 12,
        letterSpacing: 0.05 * 12,
        color: color,
      );

  static TextStyle labelSmallStatic(Color color) => GoogleFonts.plusJakartaSans(
        fontSize: 12,
        fontWeight: FontWeight.w500,
        height: 16 / 12,
        color: color,
      );

  static TextStyle captionStatic(Color color) => GoogleFonts.plusJakartaSans(
        fontSize: 11,
        fontWeight: FontWeight.w500,
        height: 14 / 11,
        color: color,
      );

  static TextStyle overlineStatic(Color color) => GoogleFonts.plusJakartaSans(
        fontSize: 10,
        fontWeight: FontWeight.w600,
        height: 14 / 10,
        letterSpacing: 0.1,
        color: color,
      );

  static TextStyle statusLabelStatic(Color color) => GoogleFonts.plusJakartaSans(
        fontSize: 10,
        fontWeight: FontWeight.w700,
        height: 14 / 10,
        color: color,
      );

  static TextStyle bodyMediumStatic(Color color) => GoogleFonts.plusJakartaSans(
        fontSize: 14,
        fontWeight: FontWeight.w400,
        height: 20 / 14,
        color: color,
      );

  static TextStyle bodyMediumBoldStatic(Color color) => GoogleFonts.plusJakartaSans(
        fontSize: 14,
        fontWeight: FontWeight.w500,
        height: 20 / 14,
        color: color,
      );
}
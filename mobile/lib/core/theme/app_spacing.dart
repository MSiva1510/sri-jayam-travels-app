// ─────────────────────────────────────────────────────────────────────────────
// app_spacing.dart — Sri Jayam Travels Spacing System
// 8-point grid base — consistent across all screens
// ─────────────────────────────────────────────────────────────────────────────


class AppSpacing {
  const AppSpacing();

  // ── Base Unit ──────────────────────────────────────────────────────────
  static const double unit = 4.0; // 4px base unit

  // ── Scale (multiples of unit) ──────────────────────────────────────────
  static const double xs = unit;        // 4px  — Internal element spacing
  static const double sm = unit * 2;    // 8px  — Default gap, icon-text
  static const double md = unit * 4;    // 16px — Card padding, screen margins
  static const double lg = unit * 6;    // 24px — Section spacing
  static const double xl = unit * 8;    // 32px — Major section breaks
  static const double xxl = unit * 12;  // 48px — Page-level spacing

  // ── Semantic ───────────────────────────────────────────────────────────
  static const double screenMargin = 20.0;   // Container margins (DESIGN.md)
  static const double gutter = 16.0;         // Grid gutters
  static const double cardPadding = 16.0;    // Internal card padding
  static const double cardPaddingLarge = 20.0; // For feature cards
  static const double buttonHeight = 48.0;   // Minimum touch target (DESIGN.md)
  static const double iconSizeSmall = 16.0;
  static const double iconSizeMedium = 20.0;
  static const double iconSizeLarge = 24.0;
  static const double iconSizeXLarge = 32.0;

  // ── Layout ─────────────────────────────────────────────────────────────
  static const double avatarSmall = 32.0;
  static const double avatarMedium = 40.0;
  static const double avatarLarge = 48.0;
  static const double avatarXLarge = 64.0;

  static const double bottomNavHeight = 72.0; // Includes safe area padding
  static const double headerHeight = 64.0;    // Standard header
  static const double headerHeightLarge = 88.0; // Dashboard header with greeting

  // ── Responsive Breakpoints ─────────────────────────────────────────────
  static const double bpMobile = 600;
  static const double bpTablet = 900;
  static const double bpDesktop = 1200;
}
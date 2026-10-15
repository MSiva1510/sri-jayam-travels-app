// ─────────────────────────────────────────────────────────────────────────────
// wireframe_theme.dart — light theme matching the "Driver App Wireframes".
// iOS-style: #F2F2F7 scaffold, white 14px cards, #007AFF primary, 30px
// screen titles, pill tab bar. Dark mode keeps the seeded M3 theme.
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';

/// Wireframe blue (buttons, links, active tab).
const kWireBlue = Color(0xFF007AFF);

/// Hero gradient (NEW TRIP / earnings cards).
const kHeroGradient = LinearGradient(
  begin: Alignment.topLeft,
  end:   Alignment.bottomRight,
  colors: [Color(0xFF2F8BFF), Color(0xFF0A4FD6)],
);

ThemeData buildWireframeLightTheme() {
  const seed = kWireBlue;
  final scheme = ColorScheme.fromSeed(
    seedColor: seed,
    brightness: Brightness.light,
  ).copyWith(
    // Pin the exact wireframe surfaces (seed would tint them blue).
    surface: const Color(0xFFF2F2F7),
    surfaceContainerLowest: Colors.white,
    primary: seed,
    onPrimary: Colors.white,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: scheme.surface,
    appBarTheme: AppBarTheme(
      backgroundColor: scheme.surface,
      scrolledUnderElevation: 0,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: const TextStyle(
        fontSize: 30,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.4,
        color: Color(0xFF1C1C1E),
      ),
      iconTheme: const IconThemeData(color: Color(0xFF1C1C1E)),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      color: scheme.surfaceContainerLowest,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: Color(0xFFE5E5EA)),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(50),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
        ),
        textStyle: const TextStyle(
          fontSize: 15.5,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: const Color(0xFFE9EFFA),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: seed, width: 1.5),
      ),
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
    ),
    chipTheme: const ChipThemeData(
      shape: StadiumBorder(),
    ),
  );
}

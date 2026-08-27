// ─────────────────────────────────────────────────────────────────────────────
// app_radius.dart — Sri Jayam Travels Border Radius System
// Rounded shape language per DESIGN.md
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';

class AppRadius {
  // Allow instantiation for extension, but all members are static
  const AppRadius();

  // ── Scale ──────────────────────────────────────────────────────────────
  static const double xs = 4.0;    // 0.25rem — Small chips, badges
  static const double sm = 8.0;    // 0.5rem  — Input fields, small buttons
  static const double md = 12.0;   // 0.75rem — Primary buttons (DESIGN.md: 12px)
  static const double lg = 16.0;   // 1rem    — Standard cards
  static const double xl = 20.0;   // 1.5rem  — Feature cards, bottom sheets (DESIGN.md: 20px)
  static const double xxl = 24.0;  // 1.5rem  — Large containers, modals
  static const double full = 9999.0; // Pill / fully rounded

  // ── BorderRadius Objects ───────────────────────────────────────────────
  static const BorderRadius circularXs = BorderRadius.all(Radius.circular(xs));
  static const BorderRadius circularSm = BorderRadius.all(Radius.circular(sm));
  static const BorderRadius circularMd = BorderRadius.all(Radius.circular(md));
  static const BorderRadius circularLg = BorderRadius.all(Radius.circular(lg));
  static const BorderRadius circularXl = BorderRadius.all(Radius.circular(xl));
  static const BorderRadius circularXxl = BorderRadius.all(Radius.circular(xxl));
  static const BorderRadius circularFull = BorderRadius.all(Radius.circular(full));

  // ── Semantic Variants ──────────────────────────────────────────────────
  static const BorderRadius card = circularXl;           // 20px — Cards, containers
  static const BorderRadius cardLarge = circularXxl;     // 24px — Feature cards
  static const BorderRadius button = circularMd;         // 12px — Primary buttons
  static const BorderRadius buttonLarge = circularLg;    // 16px — Large buttons
  static const BorderRadius input = circularSm;          // 8px — Text fields
  static const BorderRadius badge = circularFull;        // Pill — Status badges
  static const BorderRadius avatar = circularFull;       // Circle — Avatars
  static const BorderRadius bottomSheet = BorderRadius.vertical(top: Radius.circular(xxl)); // 24px top
  static const BorderRadius modal = circularXxl;         // 24px — Modals, dialogs
  static const BorderRadius chip = circularFull;         // Chips, filter pills
  static const BorderRadius mapMarker = circularMd;      // 12px — Map info windows

  // ── Asymmetric ─────────────────────────────────────────────────────────
  static const BorderRadius topOnly = BorderRadius.vertical(top: Radius.circular(xl));
  static const BorderRadius bottomOnly = BorderRadius.vertical(bottom: Radius.circular(xl));
  static const BorderRadius leftOnly = BorderRadius.horizontal(left: Radius.circular(xl));
  static const BorderRadius rightOnly = BorderRadius.horizontal(right: Radius.circular(xl));
}
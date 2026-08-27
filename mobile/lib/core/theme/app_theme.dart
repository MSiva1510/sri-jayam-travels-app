// ─────────────────────────────────────────────────────────────────────────────
// app_theme.dart — Sri Jayam Travels ThemeData Builders
// Creates Light + Dark ThemeData from semantic tokens
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'app_colors.dart';
import 'app_typography.dart';
import 'app_spacing.dart';
import 'app_radius.dart';

class AppTheme {
  AppTheme._();

  // ── Light Theme ────────────────────────────────────────────────────────
  static ThemeData get light => ThemeData(
        useMaterial3: true,
        brightness: Brightness.light,

        // Color Scheme (Material3)
        colorScheme: const ColorScheme.light(
          primary: AppLightColors.primary,
          onPrimary: AppLightColors.onPrimary,
          primaryContainer: AppLightColors.primaryContainer,
          onPrimaryContainer: AppLightColors.onPrimaryContainer,
          secondary: AppLightColors.outline,
          onSecondary: AppLightColors.onSurface,
          secondaryContainer: AppLightColors.surfaceContainer,
          onSecondaryContainer: AppLightColors.onSurface,
          tertiary: AppLightColors.info,
          onTertiary: AppLightColors.onInfo,
          tertiaryContainer: AppLightColors.infoContainer,
          onTertiaryContainer: AppLightColors.onInfoContainer,
          error: AppLightColors.danger,
          onError: AppLightColors.onDanger,
          errorContainer: AppLightColors.dangerContainer,
          onErrorContainer: AppLightColors.onDangerContainer,
          surface: AppLightColors.surface,
          onSurface: AppLightColors.onSurface,
          surfaceContainer: AppLightColors.surfaceContainer,
          surfaceContainerHigh: AppLightColors.surfaceContainerHigh,
          surfaceContainerHighest: AppLightColors.surfaceContainerHighest,
          surfaceContainerLow: AppLightColors.surfaceContainer,
          surfaceContainerLowest: AppLightColors.surface,
          surfaceDim: AppLightColors.surfaceDim,
          surfaceBright: AppLightColors.surfaceBright,
          surfaceTint: AppLightColors.primary,
          outline: AppLightColors.outline,
          outlineVariant: AppLightColors.outlineVariant,
          inverseSurface: AppLightColors.inverseSurface,
          onInverseSurface: AppLightColors.inverseOnSurface,
          inversePrimary: AppLightColors.inversePrimary,
          shadow: AppLightColors.shadow,
          scrim: AppLightColors.shadowStrong,
        ),

        // Scaffold
        scaffoldBackgroundColor: AppLightColors.background,

        // AppBar
        appBarTheme: AppBarTheme(
          backgroundColor: AppLightColors.surface,
          foregroundColor: AppLightColors.onSurface,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          scrolledUnderElevation: 0,
          centerTitle: false,
          titleTextStyle: AppTypography.headlineSmallStatic(AppLightColors.onSurface).copyWith(
            color: AppLightColors.onSurface,
            fontWeight: FontWeight.w700,
          ),
          iconTheme: const IconThemeData(
            color: AppLightColors.onSurface,
            size: 24,
          ),
          actionsIconTheme: const IconThemeData(
            color: AppLightColors.onSurface,
            size: 24,
          ),
        ),

        // Card
        cardTheme: CardThemeData(
          color: AppLightColors.surface,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          shadowColor: AppLightColors.shadow,
          shape: RoundedRectangleBorder(
            borderRadius: AppRadius.card,
            side: BorderSide(
              color: AppLightColors.outlineVariant,
              width: 1,
            ),
          ),
          margin: const EdgeInsets.all(AppSpacing.md),
        ),

        // Elevated Button (Primary)
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppLightColors.primary,
            foregroundColor: AppLightColors.onPrimary,
            disabledBackgroundColor: AppLightColors.outlineVariant,
            disabledForegroundColor: AppLightColors.onSurfaceVariant,
            elevation: 0,
            shadowColor: AppLightColors.shadow,
            minimumSize: Size(double.infinity, AppSpacing.buttonHeight),
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.md,
            ),
            shape: RoundedRectangleBorder(
              borderRadius: AppRadius.button,
            ),
            textStyle: AppTypography.labelMediumStatic(AppLightColors.onPrimary).copyWith(
              color: AppLightColors.onPrimary,
              fontWeight: FontWeight.w700,
            ),
          ).copyWith(
            overlayColor: WidgetStateProperty.resolveWith<Color?>(
              (states) {
                if (states.contains(WidgetState.pressed)) {
                  return AppLightColors.primary.withValues(alpha: 0.8);
                }
                if (states.contains(WidgetState.hovered)) {
                  return AppLightColors.primary.withValues(alpha: 0.9);
                }
                return null;
              },
            ),
          ),
        ),

        // Filled Button (Alternative Primary)
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: AppLightColors.primary,
            foregroundColor: AppLightColors.onPrimary,
            disabledBackgroundColor: AppLightColors.outlineVariant,
            disabledForegroundColor: AppLightColors.onSurfaceVariant,
            minimumSize: Size(double.infinity, AppSpacing.buttonHeight),
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.md,
            ),
            shape: RoundedRectangleBorder(
              borderRadius: AppRadius.button,
            ),
            textStyle: AppTypography.labelMediumStatic(AppLightColors.onPrimary).copyWith(
              color: AppLightColors.onPrimary,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),

        // Outlined Button (Secondary)
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: AppLightColors.primary,
            disabledForegroundColor: AppLightColors.onSurfaceVariant,
            side: const BorderSide(
              color: AppLightColors.primary,
              width: 1.5,
            ),
            minimumSize: Size(double.infinity, AppSpacing.buttonHeight),
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.md,
            ),
            shape: RoundedRectangleBorder(
              borderRadius: AppRadius.button,
            ),
            textStyle: AppTypography.labelMediumStatic(AppLightColors.onPrimary).copyWith(
              color: AppLightColors.primary,
              fontWeight: FontWeight.w700,
            ),
          ).copyWith(
            overlayColor: WidgetStateProperty.resolveWith<Color?>(
              (states) {
                if (states.contains(WidgetState.pressed)) {
                  return AppLightColors.primary.withValues(alpha: 0.1);
                }
                if (states.contains(WidgetState.hovered)) {
                  return AppLightColors.primary.withValues(alpha: 0.05);
                }
                return null;
              },
            ),
          ),
        ),

        // Text Button (Ghost)
        textButtonTheme: TextButtonThemeData(
          style: TextButton.styleFrom(
            foregroundColor: AppLightColors.primary,
            disabledForegroundColor: AppLightColors.onSurfaceVariant,
            minimumSize: Size(double.infinity, AppSpacing.buttonHeight),
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.sm,
            ),
            shape: RoundedRectangleBorder(
              borderRadius: AppRadius.button,
            ),
            textStyle: AppTypography.labelMediumStatic(AppLightColors.onPrimary).copyWith(
              color: AppLightColors.primary,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),

        // Input Decoration
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: AppLightColors.surface,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.md,
          ),
          border: OutlineInputBorder(
            borderRadius: AppRadius.input,
            borderSide: BorderSide(
              color: AppLightColors.outlineVariant,
              width: 1,
            ),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: AppRadius.input,
            borderSide: BorderSide(
              color: AppLightColors.outlineVariant,
              width: 1,
            ),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: AppRadius.input,
            borderSide: BorderSide(
              color: AppLightColors.primary,
              width: 2,
            ),
          ),
          errorBorder: OutlineInputBorder(
            borderRadius: AppRadius.input,
            borderSide: BorderSide(
              color: AppLightColors.danger,
              width: 1,
            ),
          ),
          focusedErrorBorder: OutlineInputBorder(
            borderRadius: AppRadius.input,
            borderSide: BorderSide(
              color: AppLightColors.danger,
              width: 2,
            ),
          ),
          disabledBorder: OutlineInputBorder(
            borderRadius: AppRadius.input,
            borderSide: BorderSide(
              color: AppLightColors.outlineVariant.withValues(alpha: 0.5),
              width: 1,
            ),
          ),
          labelStyle: AppTypography.bodyMediumStatic(AppLightColors.onSurface).copyWith(
            color: AppLightColors.onSurfaceVariant,
          ),
          hintStyle: AppTypography.bodyMediumStatic(AppLightColors.onSurface).copyWith(
            color: AppLightColors.onSurfaceVariant.withValues(alpha: 0.6),
          ),
          errorStyle: AppTypography.captionStatic(AppLightColors.onSurface).copyWith(
            color: AppLightColors.danger,
          ),
          floatingLabelStyle: AppTypography.labelSmallStatic(AppLightColors.onSurface).copyWith(
            color: AppLightColors.primary,
          ),
        ),

        // Chip
        chipTheme: ChipThemeData(
          backgroundColor: AppLightColors.surfaceContainer,
          disabledColor: AppLightColors.surfaceContainerHighest,
          selectedColor: AppLightColors.primaryContainer,
          secondarySelectedColor: AppLightColors.primaryContainer,
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.xs,
          ),
          labelStyle: AppTypography.labelSmallStatic(AppLightColors.onSurface).copyWith(
            color: AppLightColors.onSurface,
          ),
          secondaryLabelStyle: AppTypography.labelSmallStatic(AppLightColors.onSurface).copyWith(
            color: AppLightColors.onPrimaryContainer,
          ),
          brightness: Brightness.light,
          elevation: 0,
          pressElevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: AppRadius.chip,
            side: BorderSide(
              color: AppLightColors.outlineVariant,
              width: 1,
            ),
          ),
          showCheckmark: false,
        ),

        // Divider
        dividerTheme: DividerThemeData(
          color: AppLightColors.outlineVariant,
          thickness: 1,
          space: AppSpacing.md,
          indent: AppSpacing.md,
          endIndent: AppSpacing.md,
        ),

        // List Tile
        listTileTheme: ListTileThemeData(
          contentPadding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.xs,
          ),
          titleTextStyle: AppTypography.bodyMediumBoldStatic(AppLightColors.onSurface),
          subtitleTextStyle: AppTypography.bodyMediumStatic(AppLightColors.onSurface).copyWith(
            color: AppLightColors.onSurfaceVariant,
          ),
          leadingAndTrailingTextStyle: AppTypography.bodyMediumStatic(AppLightColors.onSurface),
          iconColor: AppLightColors.onSurfaceVariant,
          textColor: AppLightColors.onSurface,
          selectedColor: AppLightColors.primaryContainer,
          selectedTileColor: AppLightColors.primaryContainer.withValues(alpha: 0.5),
          shape: RoundedRectangleBorder(
            borderRadius: AppRadius.card,
          ),
        ),

        // Bottom Navigation Bar
        bottomNavigationBarTheme: BottomNavigationBarThemeData(
          backgroundColor: AppLightColors.surface,
          selectedItemColor: AppLightColors.primary,
          unselectedItemColor: AppLightColors.onSurfaceVariant,
          type: BottomNavigationBarType.fixed,
          elevation: 8,
          selectedLabelStyle: AppTypography.captionStatic(AppLightColors.onSurface).copyWith(
            fontWeight: FontWeight.w600,
          ),
          unselectedLabelStyle: AppTypography.captionStatic(AppLightColors.onSurface),
          showSelectedLabels: true,
          showUnselectedLabels: true,
          landscapeLayout: BottomNavigationBarLandscapeLayout.centered,
        ),

        // Navigation Bar (Material3)
        navigationBarTheme: NavigationBarThemeData(
          backgroundColor: AppLightColors.surface,
          indicatorColor: AppLightColors.primaryContainer,
          labelTextStyle: WidgetStateProperty.resolveWith<TextStyle>(
            (states) {
              if (states.contains(WidgetState.selected)) {
                return AppTypography.captionStatic(AppLightColors.onSurface).copyWith(
                  color: AppLightColors.primary,
                  fontWeight: FontWeight.w600,
                );
              }
              return AppTypography.captionStatic(AppLightColors.onSurface).copyWith(
                color: AppLightColors.onSurfaceVariant,
              );
            },
          ),
          iconTheme: WidgetStateProperty.resolveWith<IconThemeData>(
            (states) {
              if (states.contains(WidgetState.selected)) {
                return IconThemeData(
                  color: AppLightColors.primary,
                  size: 24,
                );
              }
              return IconThemeData(
                color: AppLightColors.onSurfaceVariant,
                size: 24,
              );
            },
          ),
          height: 64,
          surfaceTintColor: Colors.transparent,
          shadowColor: AppLightColors.shadowStrong,
          elevation: 8,
        ),

        // Dialog
        dialogTheme: DialogThemeData(
          backgroundColor: AppLightColors.surface,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          shadowColor: AppLightColors.shadowStrong,
          shape: RoundedRectangleBorder(
            borderRadius: AppRadius.modal,
          ),
          titleTextStyle: AppTypography.headlineSmallStatic(AppLightColors.onSurface).copyWith(
            color: AppLightColors.onSurface,
          ),
          contentTextStyle: AppTypography.bodyMediumStatic(AppLightColors.onSurface).copyWith(
            color: AppLightColors.onSurface,
          ),
        ),

        // Bottom Sheet
        bottomSheetTheme: BottomSheetThemeData(
          backgroundColor: AppLightColors.surface,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          shadowColor: AppLightColors.shadowStrong,
          shape: RoundedRectangleBorder(
            borderRadius: AppRadius.bottomSheet,
          ),
          modalBackgroundColor: AppLightColors.surface,
          modalElevation: 0,
        ),

        // Snack Bar
        snackBarTheme: SnackBarThemeData(
          backgroundColor: AppLightColors.onSurface,
          contentTextStyle: AppTypography.bodyMediumStatic(AppLightColors.onSurface).copyWith(
            color: AppLightColors.background,
          ),
          actionTextColor: AppLightColors.primaryContainer,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: AppRadius.card,
          ),
          elevation: 4,
        ),

        // Floating Action Button
        floatingActionButtonTheme: FloatingActionButtonThemeData(
          backgroundColor: AppLightColors.primary,
          foregroundColor: AppLightColors.onPrimary,
          elevation: 4,
          focusElevation: 6,
          hoverElevation: 8,
          highlightElevation: 10,
          shape: RoundedRectangleBorder(
            borderRadius: AppRadius.buttonLarge,
          ),
        ),

        // Progress Indicators
        progressIndicatorTheme: ProgressIndicatorThemeData(
          color: AppLightColors.primary,
          linearTrackColor: AppLightColors.surfaceContainerHighest,
          circularTrackColor: AppLightColors.surfaceContainerHighest,
        ),

        // Slider
        sliderTheme: SliderThemeData(
          activeTrackColor: AppLightColors.primary,
          inactiveTrackColor: AppLightColors.surfaceContainerHighest,
          thumbColor: AppLightColors.primary,
          overlayColor: AppLightColors.primary.withValues(alpha: 0.2),
          valueIndicatorColor: AppLightColors.primary,
          valueIndicatorTextStyle: AppTypography.captionStatic(AppLightColors.onSurface).copyWith(
            color: AppLightColors.onPrimary,
          ),
        ),

        // Tab Bar
        tabBarTheme: TabBarThemeData(
          labelColor: AppLightColors.primary,
          unselectedLabelColor: AppLightColors.onSurfaceVariant,
          indicatorColor: AppLightColors.primary,
          indicatorSize: TabBarIndicatorSize.label,
          labelStyle: AppTypography.labelMediumStatic(AppLightColors.onPrimary),
          unselectedLabelStyle: AppTypography.labelMediumStatic(AppLightColors.onPrimary),
          dividerColor: Colors.transparent,
        ),

        // Tooltip
        tooltipTheme: TooltipThemeData(
          decoration: BoxDecoration(
            color: AppLightColors.onSurface.withValues(alpha: 0.9),
            borderRadius: AppRadius.input,
          ),
          textStyle: AppTypography.captionStatic(AppLightColors.onSurface).copyWith(
            color: AppLightColors.background,
          ),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
        ),

        // Text Selection
        textSelectionTheme: TextSelectionThemeData(
          cursorColor: AppLightColors.primary,
          selectionColor: AppLightColors.primaryContainer,
          selectionHandleColor: AppLightColors.primary,
        ),

        // Platform-specific
        platform: TargetPlatform.android,
      );

  // ── Dark Theme ─────────────────────────────────────────────────────────
  static ThemeData get dark => ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,

        // Color Scheme (Material3)
        colorScheme: const ColorScheme.dark(
          primary: AppDarkColors.primary,
          onPrimary: AppDarkColors.onPrimary,
          primaryContainer: AppDarkColors.primaryContainer,
          onPrimaryContainer: AppDarkColors.onPrimaryContainer,
          secondary: AppDarkColors.outline,
          onSecondary: AppDarkColors.onSurface,
          secondaryContainer: AppDarkColors.surfaceContainer,
          onSecondaryContainer: AppDarkColors.onSurface,
          tertiary: AppDarkColors.info,
          onTertiary: AppDarkColors.onInfo,
          tertiaryContainer: AppDarkColors.infoContainer,
          onTertiaryContainer: AppDarkColors.onInfoContainer,
          error: AppDarkColors.danger,
          onError: AppDarkColors.onDanger,
          errorContainer: AppDarkColors.dangerContainer,
          onErrorContainer: AppDarkColors.onDangerContainer,
          surface: AppDarkColors.surface,
          onSurface: AppDarkColors.onSurface,
          surfaceContainer: AppDarkColors.surfaceContainer,
          surfaceContainerHigh: AppDarkColors.surfaceContainerHigh,
          surfaceContainerHighest: AppDarkColors.surfaceContainerHighest,
          surfaceContainerLow: AppDarkColors.surfaceContainer,
          surfaceContainerLowest: AppDarkColors.surface,
          surfaceDim: AppDarkColors.surfaceDim,
          surfaceBright: AppDarkColors.surfaceBright,
          surfaceTint: AppDarkColors.primary,
          outline: AppDarkColors.outline,
          outlineVariant: AppDarkColors.outlineVariant,
          inverseSurface: AppDarkColors.inverseSurface,
          onInverseSurface: AppDarkColors.inverseOnSurface,
          inversePrimary: AppDarkColors.inversePrimary,
          shadow: AppDarkColors.shadow,
          scrim: AppDarkColors.shadowStrong,
        ),

        // Scaffold
        scaffoldBackgroundColor: AppDarkColors.background,

        // AppBar
        appBarTheme: AppBarTheme(
          backgroundColor: AppDarkColors.surface,
          foregroundColor: AppDarkColors.onSurface,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          scrolledUnderElevation: 0,
          centerTitle: false,
          titleTextStyle: AppTypography.headlineSmallStatic(AppDarkColors.onSurface).copyWith(
            color: AppDarkColors.onSurface,
            fontWeight: FontWeight.w700,
          ),
          iconTheme: const IconThemeData(
            color: AppDarkColors.onSurface,
            size: 24,
          ),
          actionsIconTheme: const IconThemeData(
            color: AppDarkColors.onSurface,
            size: 24,
          ),
        ),

        // Card
        cardTheme: CardThemeData(
          color: AppDarkColors.surface,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          shadowColor: AppDarkColors.shadow,
          shape: RoundedRectangleBorder(
            borderRadius: AppRadius.card,
            side: BorderSide(
              color: AppDarkColors.outlineVariant,
              width: 1,
            ),
          ),
          margin: const EdgeInsets.all(AppSpacing.md),
        ),

        // Elevated Button (Primary)
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppDarkColors.primary,
            foregroundColor: AppDarkColors.onPrimary,
            disabledBackgroundColor: AppDarkColors.outlineVariant,
            disabledForegroundColor: AppDarkColors.onSurfaceVariant,
            elevation: 0,
            shadowColor: AppDarkColors.shadow,
            minimumSize: Size(double.infinity, AppSpacing.buttonHeight),
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.md,
            ),
            shape: RoundedRectangleBorder(
              borderRadius: AppRadius.button,
            ),
            textStyle: AppTypography.labelMediumStatic(AppDarkColors.onPrimary).copyWith(
              color: AppDarkColors.onPrimary,
              fontWeight: FontWeight.w700,
            ),
          ).copyWith(
            overlayColor: WidgetStateProperty.resolveWith<Color?>(
              (states) {
                if (states.contains(WidgetState.pressed)) {
                  return AppDarkColors.primary.withValues(alpha: 0.8);
                }
                if (states.contains(WidgetState.hovered)) {
                  return AppDarkColors.primary.withValues(alpha: 0.9);
                }
                return null;
              },
            ),
          ),
        ),

        // Filled Button
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: AppDarkColors.primary,
            foregroundColor: AppDarkColors.onPrimary,
            disabledBackgroundColor: AppDarkColors.outlineVariant,
            disabledForegroundColor: AppDarkColors.onSurfaceVariant,
            minimumSize: Size(double.infinity, AppSpacing.buttonHeight),
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.md,
            ),
            shape: RoundedRectangleBorder(
              borderRadius: AppRadius.button,
            ),
            textStyle: AppTypography.labelMediumStatic(AppDarkColors.onPrimary).copyWith(
              color: AppDarkColors.onPrimary,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),

        // Outlined Button (Secondary)
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: AppDarkColors.primary,
            disabledForegroundColor: AppDarkColors.onSurfaceVariant,
            side: const BorderSide(
              color: AppDarkColors.primary,
              width: 1.5,
            ),
            minimumSize: Size(double.infinity, AppSpacing.buttonHeight),
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.md,
            ),
            shape: RoundedRectangleBorder(
              borderRadius: AppRadius.button,
            ),
            textStyle: AppTypography.labelMediumStatic(AppDarkColors.onPrimary).copyWith(
              color: AppDarkColors.primary,
              fontWeight: FontWeight.w700,
            ),
          ).copyWith(
            overlayColor: WidgetStateProperty.resolveWith<Color?>(
              (states) {
                if (states.contains(WidgetState.pressed)) {
                  return AppDarkColors.primary.withValues(alpha: 0.15);
                }
                if (states.contains(WidgetState.hovered)) {
                  return AppDarkColors.primary.withValues(alpha: 0.08);
                }
                return null;
              },
            ),
          ),
        ),

        // Text Button (Ghost)
        textButtonTheme: TextButtonThemeData(
          style: TextButton.styleFrom(
            foregroundColor: AppDarkColors.primary,
            disabledForegroundColor: AppDarkColors.onSurfaceVariant,
            minimumSize: Size(double.infinity, AppSpacing.buttonHeight),
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.sm,
            ),
            shape: RoundedRectangleBorder(
              borderRadius: AppRadius.button,
            ),
            textStyle: AppTypography.labelMediumStatic(AppDarkColors.onPrimary).copyWith(
              color: AppDarkColors.primary,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),

        // Input Decoration
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: AppDarkColors.surface,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.md,
          ),
          border: OutlineInputBorder(
            borderRadius: AppRadius.input,
            borderSide: BorderSide(
              color: AppDarkColors.outlineVariant,
              width: 1,
            ),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: AppRadius.input,
            borderSide: BorderSide(
              color: AppDarkColors.outlineVariant,
              width: 1,
            ),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: AppRadius.input,
            borderSide: BorderSide(
              color: AppDarkColors.primary,
              width: 2,
            ),
          ),
          errorBorder: OutlineInputBorder(
            borderRadius: AppRadius.input,
            borderSide: BorderSide(
              color: AppDarkColors.danger,
              width: 1,
            ),
          ),
          focusedErrorBorder: OutlineInputBorder(
            borderRadius: AppRadius.input,
            borderSide: BorderSide(
              color: AppDarkColors.danger,
              width: 2,
            ),
          ),
          disabledBorder: OutlineInputBorder(
            borderRadius: AppRadius.input,
            borderSide: BorderSide(
              color: AppDarkColors.outlineVariant.withValues(alpha: 0.5),
              width: 1,
            ),
          ),
          labelStyle: AppTypography.bodyMediumStatic(AppDarkColors.onSurface).copyWith(
            color: AppDarkColors.onSurfaceVariant,
          ),
          hintStyle: AppTypography.bodyMediumStatic(AppDarkColors.onSurface).copyWith(
            color: AppDarkColors.onSurfaceVariant.withValues(alpha: 0.6),
          ),
          errorStyle: AppTypography.captionStatic(AppDarkColors.onSurface).copyWith(
            color: AppDarkColors.danger,
          ),
          floatingLabelStyle: AppTypography.labelSmallStatic(AppDarkColors.onSurface).copyWith(
            color: AppDarkColors.primary,
          ),
        ),

        // Chip
        chipTheme: ChipThemeData(
          backgroundColor: AppDarkColors.surfaceContainer,
          disabledColor: AppDarkColors.surfaceContainerHighest,
          selectedColor: AppDarkColors.primaryContainer,
          secondarySelectedColor: AppDarkColors.primaryContainer,
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.xs,
          ),
          labelStyle: AppTypography.labelSmallStatic(AppDarkColors.onSurface).copyWith(
            color: AppDarkColors.onSurface,
          ),
          secondaryLabelStyle: AppTypography.labelSmallStatic(AppDarkColors.onSurface).copyWith(
            color: AppDarkColors.onPrimaryContainer,
          ),
          brightness: Brightness.dark,
          elevation: 0,
          pressElevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: AppRadius.chip,
            side: BorderSide(
              color: AppDarkColors.outlineVariant,
              width: 1,
            ),
          ),
          showCheckmark: false,
        ),

        // Divider
        dividerTheme: DividerThemeData(
          color: AppDarkColors.outlineVariant,
          thickness: 1,
          space: AppSpacing.md,
          indent: AppSpacing.md,
          endIndent: AppSpacing.md,
        ),

        // List Tile
        listTileTheme: ListTileThemeData(
          contentPadding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.xs,
          ),
          titleTextStyle: AppTypography.bodyMediumBoldStatic(AppDarkColors.onSurface).copyWith(
            color: AppDarkColors.onSurface,
          ),
          subtitleTextStyle: AppTypography.bodyMediumStatic(AppDarkColors.onSurface).copyWith(
            color: AppDarkColors.onSurfaceVariant,
          ),
          leadingAndTrailingTextStyle: AppTypography.bodyMediumStatic(AppDarkColors.onSurface).copyWith(
            color: AppDarkColors.onSurface,
          ),
          iconColor: AppDarkColors.onSurfaceVariant,
          textColor: AppDarkColors.onSurface,
          selectedColor: AppDarkColors.primaryContainer,
          selectedTileColor: AppDarkColors.primaryContainer.withValues(alpha: 0.3),
          shape: RoundedRectangleBorder(
            borderRadius: AppRadius.card,
          ),
        ),

        // Bottom Navigation Bar
        bottomNavigationBarTheme: BottomNavigationBarThemeData(
          backgroundColor: AppDarkColors.surface,
          selectedItemColor: AppDarkColors.primary,
          unselectedItemColor: AppDarkColors.onSurfaceVariant,
          type: BottomNavigationBarType.fixed,
          elevation: 8,
          selectedLabelStyle: AppTypography.captionStatic(AppDarkColors.onSurface).copyWith(
            fontWeight: FontWeight.w600,
          ),
          unselectedLabelStyle: AppTypography.captionStatic(AppDarkColors.onSurface),
          showSelectedLabels: true,
          showUnselectedLabels: true,
          landscapeLayout: BottomNavigationBarLandscapeLayout.centered,
        ),

        // Navigation Bar (Material3)
        navigationBarTheme: NavigationBarThemeData(
          backgroundColor: AppDarkColors.surface,
          indicatorColor: AppDarkColors.primaryContainer,
          labelTextStyle: WidgetStateProperty.resolveWith<TextStyle>(
            (states) {
              if (states.contains(WidgetState.selected)) {
                return AppTypography.captionStatic(AppDarkColors.onSurface).copyWith(
                  color: AppDarkColors.primary,
                  fontWeight: FontWeight.w600,
                );
              }
              return AppTypography.captionStatic(AppDarkColors.onSurface).copyWith(
                color: AppDarkColors.onSurfaceVariant,
              );
            },
          ),
          iconTheme: WidgetStateProperty.resolveWith<IconThemeData>(
            (states) {
              if (states.contains(WidgetState.selected)) {
                return IconThemeData(
                  color: AppDarkColors.primary,
                  size: 24,
                );
              }
              return IconThemeData(
                color: AppDarkColors.onSurfaceVariant,
                size: 24,
              );
            },
          ),
          height: 64,
          surfaceTintColor: Colors.transparent,
          shadowColor: AppDarkColors.shadowStrong,
          elevation: 8,
        ),

        // Dialog
        dialogTheme: DialogThemeData(
          backgroundColor: AppDarkColors.surface,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          shadowColor: AppDarkColors.shadowStrong,
          shape: RoundedRectangleBorder(
            borderRadius: AppRadius.modal,
          ),
          titleTextStyle: AppTypography.headlineSmallStatic(AppDarkColors.onSurface).copyWith(
            color: AppDarkColors.onSurface,
          ),
          contentTextStyle: AppTypography.bodyMediumStatic(AppDarkColors.onSurface).copyWith(
            color: AppDarkColors.onSurface,
          ),
        ),

        // Bottom Sheet
        bottomSheetTheme: BottomSheetThemeData(
          backgroundColor: AppDarkColors.surface,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          shadowColor: AppDarkColors.shadowStrong,
          shape: RoundedRectangleBorder(
            borderRadius: AppRadius.bottomSheet,
          ),
          modalBackgroundColor: AppDarkColors.surface,
          modalElevation: 0,
        ),

        // Snack Bar
        snackBarTheme: SnackBarThemeData(
          backgroundColor: AppDarkColors.onSurface,
          contentTextStyle: AppTypography.bodyMediumStatic(AppDarkColors.onSurface).copyWith(
            color: AppDarkColors.background,
          ),
          actionTextColor: AppDarkColors.primaryContainer,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: AppRadius.card,
          ),
          elevation: 4,
        ),

        // Floating Action Button
        floatingActionButtonTheme: FloatingActionButtonThemeData(
          backgroundColor: AppDarkColors.primary,
          foregroundColor: AppDarkColors.onPrimary,
          elevation: 4,
          focusElevation: 6,
          hoverElevation: 8,
          highlightElevation: 10,
          shape: RoundedRectangleBorder(
            borderRadius: AppRadius.buttonLarge,
          ),
        ),

        // Progress Indicators
        progressIndicatorTheme: ProgressIndicatorThemeData(
          color: AppDarkColors.primary,
          linearTrackColor: AppDarkColors.surfaceContainerHighest,
          circularTrackColor: AppDarkColors.surfaceContainerHighest,
        ),

        // Slider
        sliderTheme: SliderThemeData(
          activeTrackColor: AppDarkColors.primary,
          inactiveTrackColor: AppDarkColors.surfaceContainerHighest,
          thumbColor: AppDarkColors.primary,
          overlayColor: AppDarkColors.primary.withValues(alpha: 0.2),
          valueIndicatorColor: AppDarkColors.primary,
          valueIndicatorTextStyle: AppTypography.captionStatic(AppDarkColors.onSurface).copyWith(
            color: AppDarkColors.onPrimary,
          ),
        ),

        // Tab Bar
        tabBarTheme: TabBarThemeData(
          labelColor: AppDarkColors.primary,
          unselectedLabelColor: AppDarkColors.onSurfaceVariant,
          indicatorColor: AppDarkColors.primary,
          indicatorSize: TabBarIndicatorSize.label,
          labelStyle: AppTypography.labelMediumStatic(AppDarkColors.onPrimary),
          unselectedLabelStyle: AppTypography.labelMediumStatic(AppDarkColors.onPrimary),
          dividerColor: Colors.transparent,
        ),

        // Tooltip
        tooltipTheme: TooltipThemeData(
          decoration: BoxDecoration(
            color: AppDarkColors.onSurface.withValues(alpha: 0.9),
            borderRadius: AppRadius.input,
          ),
          textStyle: AppTypography.captionStatic(AppDarkColors.onSurface).copyWith(
            color: AppDarkColors.background,
          ),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
        ),

        // Text Selection
        textSelectionTheme: TextSelectionThemeData(
          cursorColor: AppDarkColors.primary,
          selectionColor: AppDarkColors.primaryContainer,
          selectionHandleColor: AppDarkColors.primary,
        ),

        // Platform-specific
        platform: TargetPlatform.android,
      );
}
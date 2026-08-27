// ─────────────────────────────────────────────────────────────────────────────
// gps_screen.dart — Placeholder for GPS Tracking Screen (under development)
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../core/theme/context_extensions.dart';
import '../../widgets/shared.dart';

/// Placeholder for GPS tracking screen - under development
class GpsScreen extends ConsumerWidget {
  const GpsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: context.background,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: EdgeInsets.all(context.xl),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    color: context.primaryContainer,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.gps_fixed,
                    size: 48,
                    color: context.primary,
                  ),
                ),

                const SizedBox(height: 24),

                Text(
                  'GPS Tracking',
                  style: context.displayLarge.copyWith(
                    color: context.onSurface,
                    fontWeight: FontWeight.w700,
                  ),
                  textAlign: TextAlign.center,
                ),

                const SizedBox(height: 12),

                Text(
                  'GPS tracking screen is under development. '
                  'This feature will allow drivers to track their trips in real-time.',
                  style: context.bodyLarge.copyWith(
                    color: context.onSurfaceVariant,
                    height: 1.5,
                  ),
                  textAlign: TextAlign.center,
                ),

                const SizedBox(height: 24),

                SecondaryButton(
                  label: 'Go Back',
                  icon: Icons.arrow_back,
                  onPressed: () => context.pop(),
                  fullWidth: false,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
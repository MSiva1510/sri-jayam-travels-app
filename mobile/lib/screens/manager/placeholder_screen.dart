// ─────────────────────────────────────────────────────────────────────────────
// placeholder_screen.dart — Placeholder for Manager Screens Not Yet Implemented
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../core/theme/context_extensions.dart';
import '../../widgets/shared.dart';

/// Placeholder screen for manager modules under development
class PlaceholderScreen extends StatelessWidget {
  const PlaceholderScreen({
    super.key,
    required this.title,
    this.icon,
    this.description,
  });

  final String title;
  final IconData? icon;
  final String? description;

  @override
  Widget build(BuildContext context) {
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
                    icon ?? Icons.construction_outlined,
                    size: 48,
                    color: context.primary,
                  ),
                ),

                const SizedBox(height: 24),

                Text(
                  title,
                  style: context.displayLarge.copyWith(
                    color: context.onSurface,
                    fontWeight: FontWeight.w700,
                  ),
                  textAlign: TextAlign.center,
                ),

                const SizedBox(height: 12),

                Text(
                  description ??
                      'This feature is under development. '
                      'Check back soon for the full implementation.',
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
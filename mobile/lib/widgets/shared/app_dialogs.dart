// ─────────────────────────────────────────────────────────────────────────────
// app_dialogs.dart — Sri Jayam Travels Shared Dialog & Bottom Sheet Components
// Consistent dialogs and bottom sheets across Driver & Manager
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';

import '../../core/theme.dart';
import '../../core/theme/context_extensions.dart';
import 'app_buttons.dart';

/// Standard app dialog
class AppDialog extends StatelessWidget {
  const AppDialog({
    super.key,
    required this.title,
    this.content,
    this.actions = const [],
    this.icon,
    this.iconColor,
    this.width,
    this.maxWidth = 400,
    this.barrierDismissible = true,
  });

  final String title;
  final Widget? content;
  final List<Widget> actions;
  final IconData? icon;
  final Color? iconColor;
  final double? width;
  final double maxWidth;
  final bool barrierDismissible;

  static Future<T?> show<T>({
    required BuildContext context,
    required String title,
    Widget? content,
    List<Widget> actions = const [],
    IconData? icon,
    Color? iconColor,
    bool barrierDismissible = true,
  }) {
    return showDialog<T>(
      context: context,
      barrierDismissible: barrierDismissible,
      builder: (context) => AppDialog(
        title: title,
        content: content,
        actions: actions,
        icon: icon,
        iconColor: iconColor,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: context.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: context.modal),
      insetPadding: EdgeInsets.symmetric(horizontal: context.screenMargin, vertical: 24),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header
            Container(
              padding: EdgeInsets.all(context.cardPaddingLarge),
              decoration: BoxDecoration(
                color: context.surfaceContainer,
                borderRadius: BorderRadius.vertical(top: context.modal.topLeft),
                border: Border(
                  bottom: BorderSide(color: context.outlineVariant, width: 1),
                ),
              ),
              child: Row(
                children: [
                  if (icon != null) ...[
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: (iconColor ?? context.primary).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(icon, color: iconColor ?? context.primary, size: 20),
                    ),
                    const SizedBox(width: 12),
                  ],
                  Expanded(
                    child: Text(
                      title,
                      style: context.headlineSmall.copyWith(
                        color: context.onSurface,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Content
            if (content != null)
              Padding(
                padding: EdgeInsets.all(context.cardPaddingLarge),
                child: content,
              ),

            // Actions
            if (actions.isNotEmpty)
              Padding(
                padding: EdgeInsets.fromLTRB(
                  context.cardPaddingLarge,
                  0,
                  context.cardPaddingLarge,
                  context.cardPaddingLarge,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: actions
                      .expand((widget) => [widget, const SizedBox(width: 8)])
                      .toList()
                    ..removeLast(),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Confirmation dialog with standard actions
class ConfirmDialog extends StatelessWidget {
  const ConfirmDialog({
    super.key,
    required this.title,
    required this.message,
    this.confirmLabel = 'Confirm',
    this.cancelLabel = 'Cancel',
    this.onConfirm,
    this.onCancel,
    this.isDestructive = false,
    this.icon,
  });

  final String title;
  final String message;
  final String confirmLabel;
  final String cancelLabel;
  final VoidCallback? onConfirm;
  final VoidCallback? onCancel;
  final bool isDestructive;
  final IconData? icon;

  static Future<bool> show({
    required BuildContext context,
    required String title,
    required String message,
    String confirmLabel = 'Confirm',
    String cancelLabel = 'Cancel',
    bool isDestructive = false,
    IconData? icon,
  }) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => ConfirmDialog(
        title: title,
        message: message,
        confirmLabel: confirmLabel,
        cancelLabel: cancelLabel,
        isDestructive: isDestructive,
        icon: icon,
      ),
    );
    return result ?? false;
  }

  @override
  Widget build(BuildContext context) {
    return AppDialog(
      title: title,
      icon: icon ?? (isDestructive ? Icons.warning_amber_rounded : Icons.help_outline),
      iconColor: isDestructive ? context.danger : context.primary,
      content: Text(
        message,
        style: context.bodyMedium.copyWith(color: context.onSurface),
      ),
      actions: [
        SecondaryButton(
          label: cancelLabel,
          onPressed: () {
            Navigator.of(context).pop(false);
            onCancel?.call();
          },
        ),
        isDestructive
            ? DangerButton(
                label: confirmLabel,
                onPressed: () {
                  Navigator.of(context).pop(true);
                  onConfirm?.call();
                },
              )
            : PrimaryButton(
                label: confirmLabel,
                onPressed: () {
                  Navigator.of(context).pop(true);
                  onConfirm?.call();
                },
              ),
      ],
    );
  }
}

/// Standard bottom sheet
class AppBottomSheet extends StatelessWidget {
  const AppBottomSheet({
    super.key,
    required this.title,
    required this.child,
    this.showHandle = true,
    this.icon,
    this.actions,
    this.isScrollControlled = true,
    this.maxHeightFactor = 0.9,
  });

  final String title;
  final Widget child;
  final bool showHandle;
  final IconData? icon;
  final List<Widget>? actions;
  final bool isScrollControlled;
  final double maxHeightFactor;

  static Future<T?> show<T>({
    required BuildContext context,
    required String title,
    required Widget child,
    List<Widget>? actions,
    IconData? icon,
    bool isScrollControlled = true,
  }) {
    return showModalBottomSheet<T>(
      context: context,
      isScrollControlled: isScrollControlled,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (context) => AppBottomSheet(
        title: title,
        actions: actions,
        icon: icon,
        isScrollControlled: isScrollControlled,
        child: child,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * maxHeightFactor,
      ),
      child: Container(
        decoration: BoxDecoration(
          color: context.surface,
          borderRadius: context.bottomSheet,
          boxShadow: AppElevation.level2.resolve(context),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Handle
            if (showHandle)
              Center(
                child: Container(
                  margin: EdgeInsets.only(top: 12, bottom: 8),
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: context.outlineVariant,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),

            // Header
            Padding(
              padding: EdgeInsets.fromLTRB(
                context.cardPaddingLarge,
                showHandle ? 0 : context.cardPaddingLarge,
                context.cardPaddingLarge,
                context.cardPaddingLarge,
              ),
              child: Row(
                children: [
                  if (icon != null) ...[
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: context.primaryContainer,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(icon, color: context.primary, size: 20),
                    ),
                    const SizedBox(width: 12),
                  ],
                  Expanded(
                    child: Text(
                      title,
                      style: context.headlineSmall.copyWith(
                        color: context.onSurface,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Content
            Flexible(
              child: SingleChildScrollView(
                padding: EdgeInsets.fromLTRB(
                  context.cardPaddingLarge,
                  0,
                  context.cardPaddingLarge,
                  context.cardPaddingLarge,
                ),
                child: child,
              ),
            ),

            // Actions
            if (actions != null && actions!.isNotEmpty)
              SafeArea(
                top: false,
                child: Padding(
                  padding: EdgeInsets.fromLTRB(
                    context.cardPaddingLarge,
                    0,
                    context.cardPaddingLarge,
                    context.cardPaddingLarge + 16,
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: actions!
                        .expand((widget) => [widget, const SizedBox(width: 8)])
                        .toList()
                      ..removeLast(),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Selection bottom sheet — for picking from a list
class SelectionBottomSheet<T> extends StatelessWidget {
  const SelectionBottomSheet({
    super.key,
    required this.title,
    required this.items,
    required this.onSelected,
    this.selectedValue,
    this.getLabel,
    this.icon,
    this.leadingBuilder,
    this.trailingBuilder,
    this.emptyState,
  });

  final String title;
  final List<T> items;
  final ValueChanged<T> onSelected;
  final T? selectedValue;
  final String Function(T)? getLabel;
  final IconData? icon;
  final Widget Function(T)? leadingBuilder;
  final Widget Function(T)? trailingBuilder;
  final Widget? emptyState;

  @override
  Widget build(BuildContext context) {
    return AppBottomSheet(
      title: title,
      icon: icon,
      child: items.isEmpty
          ? (emptyState ??
              EmptyState(
                icon: Icons.inbox_outlined,
                title: 'No items available',
                subtitle: 'Check back later',
              ))
          : Column(
              mainAxisSize: MainAxisSize.min,
              children: items.map((item) {
                final isSelected = item == selectedValue;
                final label = getLabel?.call(item) ?? item.toString();

                return InkWell(
                  onTap: () {
                    onSelected(item);
                    Navigator.of(context).pop();
                  },
                  child: Container(
                    padding: EdgeInsets.symmetric(
                      horizontal: context.md,
                      vertical: context.md,
                    ),
                    decoration: BoxDecoration(
                      color: isSelected ? context.primaryContainer : Colors.transparent,
                      border: Border(
                        bottom: BorderSide(
                          color: context.outlineVariant,
                          width: 1,
                        ),
                      ),
                    ),
                    child: Row(
                      children: [
                        if (leadingBuilder != null) ...[
                          leadingBuilder!(item),
                          const SizedBox(width: 12),
                        ],
                        Expanded(
                          child: Text(
                            label,
                            style: context.bodyMedium.copyWith(
                              color: isSelected ? context.primary : context.onSurface,
                              fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                            ),
                          ),
                        ),
                        if (trailingBuilder != null) ...[
                          const SizedBox(width: 12),
                          trailingBuilder!(item),
                        ],
                        if (isSelected) ...[
                          const SizedBox(width: 12),
                          Icon(Icons.check_circle, color: context.primary, size: 20),
                        ],
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
    );
  }
}

/// Action bottom sheet — for contextual actions
class ActionBottomSheet extends StatelessWidget {
  const ActionBottomSheet({
    super.key,
    required this.title,
    required this.actions,
    this.icon,
    this.message,
    this.cancelLabel = 'Cancel',
  });

  final String title;
  final List<BottomSheetAction> actions;
  final IconData? icon;
  final String? message;
  final String cancelLabel;

  @override
  Widget build(BuildContext context) {
    return AppBottomSheet(
      title: title,
      icon: icon,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (message != null) ...[
            Text(
              message!,
              style: context.bodyMedium.copyWith(color: context.onSurfaceVariant),
            ),
            const SizedBox(height: 16),
          ],
          ...actions.map((action) => _ActionTile(action: action)),
          const SizedBox(height: 8),
          SecondaryButton(
            label: cancelLabel,
            onPressed: () => Navigator.of(context).pop(),
            variant: SecondaryVariant.neutral,
          ),
        ],
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({required this.action});

  final BottomSheetAction action;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () {
        Navigator.of(context).pop();
        action.onTap?.call();
      },
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: context.md,
          vertical: context.md,
        ),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(
              color: context.outlineVariant,
              width: 1,
            ),
          ),
        ),
        child: Row(
          children: [
            if (action.icon != null) ...[
              Icon(
                action.icon,
                size: 22,
                color: action.isDestructive ? context.danger : context.onSurface,
              ),
              const SizedBox(width: 12),
            ],
            Expanded(
              child: Text(
                action.label,
                style: context.bodyMedium.copyWith(
                  color: action.isDestructive ? context.danger : context.onSurface,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class BottomSheetAction {
  const BottomSheetAction({
    required this.label,
    this.icon,
    this.onTap,
    this.isDestructive = false,
  });

  final String label;
  final IconData? icon;
  final VoidCallback? onTap;
  final bool isDestructive;
}
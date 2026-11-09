// ─────────────────────────────────────────────────────────────────────────────
// manager_alerts_screen.dart — Manager Alerts Inbox
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../core/theme/context_extensions.dart';
import '../../models/alert.dart';
import '../../providers/alert_provider.dart';
import '../../widgets/shared.dart';

class ManagerAlertsScreen extends ConsumerStatefulWidget {
  const ManagerAlertsScreen({super.key});

  @override
  ConsumerState<ManagerAlertsScreen> createState() => _ManagerAlertsScreenState();
}

class _ManagerAlertsScreenState extends ConsumerState<ManagerAlertsScreen> {
  String _selectedPriority = 'All';
  String _selectedCategory = 'All';

  final List<String> _priorities = ['All', 'Critical', 'High', 'Medium', 'Low'];
  final List<String> _categories = ['All', 'Trip', 'GPS', 'Vehicle', 'Driver', 'Document', 'System'];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(alertsProvider.notifier).load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final alertsAsync = ref.watch(alertsProvider);

    return Scaffold(
      backgroundColor: context.background,
      body: Column(
        children: [
          // Filter Chips
          Container(
            padding: EdgeInsets.all(context.screenMargin),
            child: Column(
              children: [
                // Priority filter
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: _priorities.map((priority) {
                      final isSelected = priority == _selectedPriority;
                      return Padding(
                        padding: EdgeInsets.only(right: context.sm),
                        child: FilterChip(
                          label: Text(priority),
                          selected: isSelected,
                          onSelected: (_) => setState(() => _selectedPriority = priority),
                          selectedColor: _getPriorityColor(context, priority).withValues(alpha: 0.15),
                          labelStyle: context.labelSmall.copyWith(
                            color: isSelected ? _getPriorityColor(context, priority) : context.onSurfaceVariant,
                            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                          ),
                          backgroundColor: context.surfaceContainer,
                          side: BorderSide(
                            color: isSelected ? _getPriorityColor(context, priority) : context.outlineVariant,
                          ),
                          shape: RoundedRectangleBorder(borderRadius: context.chip),
                        ),
                      );
                    }).toList(),
                  ),
                ),
                const SizedBox(height: 8),
                // Category filter
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: _categories.map((category) {
                      final isSelected = category == _selectedCategory;
                      return Padding(
                        padding: EdgeInsets.only(right: context.sm),
                        child: FilterChip(
                          label: Text(category),
                          selected: isSelected,
                          onSelected: (_) => setState(() => _selectedCategory = category),
                          selectedColor: context.primaryContainer,
                          labelStyle: context.labelSmall.copyWith(
                            color: isSelected ? context.primary : context.onSurfaceVariant,
                            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                          ),
                          backgroundColor: context.surfaceContainer,
                          side: BorderSide(
                            color: isSelected ? context.primary : context.outlineVariant,
                          ),
                          shape: RoundedRectangleBorder(borderRadius: context.chip),
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ],
            ),
          ),

          // Alert Stats
          _buildAlertStats(context),

          // Alert List
          Expanded(
            child: alertsAsync.when(
              loading: () => LoadingState(message: 'Loading alerts...'),
              error: (error, _) => ErrorState(
                message: 'Failed to load alerts: $error',
                onRetry: () => ref.read(alertsProvider.notifier).load(),
              ),
              data: (alerts) => _buildAlertList(context, _filterAlerts(alerts)),
            ),
          ),
        ],
      ),
    );
  }

  List<Alert> _filterAlerts(List<Alert> alerts) {
    var filtered = alerts;

    if (_selectedPriority != 'All') {
      filtered = filtered.where((a) => a.priority.toLowerCase() == _selectedPriority.toLowerCase()).toList();
    }

    if (_selectedCategory != 'All') {
      filtered = filtered.where((a) => a.category.toLowerCase() == _selectedCategory.toLowerCase()).toList();
    }

    // Sort: unresolved first, then by priority, then by time
    filtered.sort((a, b) {
      final aResolved = a.isResolved;
      final bResolved = b.isResolved;
      if (aResolved != bResolved) return aResolved ? 1 : -1;

      final aPriority = _priorityValue(a.priority);
      final bPriority = _priorityValue(b.priority);
      if (aPriority != bPriority) return bPriority.compareTo(aPriority);

      return b.createdAt.compareTo(a.createdAt);
    });

    return filtered;
  }

  int _priorityValue(String priority) {
    switch (priority.toLowerCase()) {
      case 'critical':
        return 4;
      case 'high':
        return 3;
      case 'medium':
        return 2;
      default:
        return 1;
    }
  }

  Widget _buildAlertStats(BuildContext context) {
    final alertsAsync = ref.watch(alertsProvider);

    return alertsAsync.when(
      data: (alerts) {
        final critical = alerts.where((a) => a.priority == 'critical' && !a.isResolved).length;
        final high = alerts.where((a) => a.priority == 'high' && !a.isResolved).length;
        final total = alerts.where((a) => !a.isResolved).length;

        return Container(
          margin: EdgeInsets.symmetric(horizontal: context.screenMargin),
          padding: EdgeInsets.all(context.cardPadding),
          decoration: BoxDecoration(
            color: context.surface,
            borderRadius: context.card,
            border: Border.all(color: context.outlineVariant),
          ),
          child: Row(
            children: [
              _StatItem(
                label: 'Critical',
                value: critical.toString(),
                color: context.danger,
                icon: Icons.error,
              ),
              _StatItem(
                label: 'High',
                value: high.toString(),
                color: context.warning,
                icon: Icons.warning,
              ),
              _StatItem(
                label: 'Active',
                value: total.toString(),
                color: context.info,
                icon: Icons.notifications_active,
              ),
            ],
          );
      },
      loading: () => const SizedBox.shrink(),
      error: (_, _) => const SizedBox.shrink(),
    );
  }

  Widget _buildAlertList(BuildContext context, List<Alert> alerts) {
    if (alerts.isEmpty) {
      return EmptyState(
        icon: Icons.notifications_none,
        title: 'No alerts',
        subtitle: 'All clear for now',
      );
    }

    return RefreshIndicator(
      onRefresh: () => ref.read(alertsProvider.notifier).load(),
      child: ListView.separated(
        padding: EdgeInsets.all(context.screenMargin),
        itemCount: alerts.length,
        separatorBuilder: (_, __) => SizedBox(height: context.sm),
        itemBuilder: (context, index) {
          final alert = alerts[index];
          return _AlertCard(alert: alert);
        },
      ),
    );
  }

  Color _getPriorityColor(BuildContext context, String priority) {
    switch (priority.toLowerCase()) {
      case 'critical':
        return context.danger;
      case 'high':
        return context.warning;
      case 'medium':
        return context.info;
      case 'low':
        return context.success;
      default:
        return context.primary;
    }
  }
}

class _StatItem extends StatelessWidget {
  const _StatItem({
    required this.label,
    required this.value,
    required this.color,
    required this.icon,
  });

  final String label;
  final String value;
  final Color color;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 22),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: context.headlineSmall.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
            ),
          ),
          Text(
            label,
            style: context.caption,
          ),
        ],
      ),
    );
  }
}

class _AlertCard extends StatelessWidget {
  const _AlertCard({required this.alert});

  final Alert alert;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: () => context.go('/manager/alerts/${alert.id}'),
      border: Border.all(
        color: _getBorderColor(context, alert),
        width: alert.isResolved ? 1 : 2,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: _getPriorityColor(context, alert.priority).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  _getCategoryIcon(alert.category),
                  size: 18,
                  color: _getPriorityColor(context, alert.priority),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            alert.title,
                            style: context.bodyMediumBold.copyWith(
                              decoration: alert.isResolved ? TextDecoration.lineThrough : null,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        StatusBadge(
                          label: alert.priority.toUpperCase(),
                          type: _getPriorityBadgeType(alert.priority),
                          compact: true,
                        ),
                      ],
                    ),
                    Text(
                      '${alert.vehicleReg ?? alert.driverName ?? 'System'} • ${_formatTime(alert.createdAt)}',
                      style: context.caption,
                    ),
                  ],
                ),
              ),
              if (alert.isResolved)
                Icon(
                  Icons.check_circle,
                  color: context.success,
                  size: 22,
                ),
            ],
          ),

          if (alert.description != null) ...[
            const SizedBox(height: 12),
            Text(
              alert.description!,
              style: context.bodyMedium.copyWith(
                color: context.onSurfaceVariant,
                decoration: alert.isResolved ? TextDecoration.lineThrough : null,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],

          if (alert.acknowledgedAt != null && !alert.isResolved) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(Icons.visibility, size: 12, color: context.info),
                const SizedBox(width: 4),
                Text(
                  'Acknowledged ${_formatTime(alert.acknowledgedAt!)}',
                  style: context.caption.copyWith(color: context.info),
                ),
              ],
            ),
          ],
        ],
      );
  }

  Color _getPriorityColor(BuildContext context, String priority) {
    switch (priority.toLowerCase()) {
      case 'critical':
        return context.danger;
      case 'high':
        return context.warning;
      case 'medium':
        return context.info;
      default:
        return context.success;
    }
  }

  Color _getBorderColor(BuildContext context, Alert alert) {
    if (alert.isResolved) return context.outlineVariant;
    return _getPriorityColor(context, alert.priority).withValues(alpha: 0.5);
  }

  StatusBadgeType _getPriorityBadgeType(String priority) {
    switch (priority.toLowerCase()) {
      case 'critical':
        return StatusBadgeType.danger;
      case 'high':
        return StatusBadgeType.warning;
      case 'medium':
        return StatusBadgeType.info;
      default:
        return StatusBadgeType.success;
    }
  }

  IconData _getCategoryIcon(String category) {
    switch (category.toLowerCase()) {
      case 'trip':
        return Icons.directions_car;
      case 'gps':
        return Icons.gps_not_fixed;
      case 'vehicle':
        return Icons.directions_car_filled;
      case 'driver':
        return Icons.person;
      case 'document':
        return Icons.description;
      default:
        return Icons.warning;
    }
  }

  String _formatTime(DateTime dateTime) {
    final now = DateTime.now();
    final diff = now.difference(dateTime);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }
}
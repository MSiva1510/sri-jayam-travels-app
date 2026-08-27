// ─────────────────────────────────────────────────────────────────────────────
// manager_trips_screen.dart — Manager TripModels List
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../core/theme/context_extensions.dart';
import '../../models/trip.dart';
import '../../navigation/app_router.dart';
import '../../providers/trip_provider.dart';
import '../../widgets/shared.dart';

class ManagerTripModelsScreen extends ConsumerStatefulWidget {
  const ManagerTripModelsScreen({super.key});

  @override
  ConsumerState<ManagerTripModelsScreen> createState() => _ManagerTripModelsScreenState();
}

class _ManagerTripModelsScreenState extends ConsumerState<ManagerTripModelsScreen> {
  String _selectedTab = 'Today';

  final List<String> _tabs = ['Today', 'Upcoming', 'Active', 'Completed', 'Pending'];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(allTripModelsProvider.notifier).load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final tripsAsync = ref.watch(allTripModelsProvider);

    return Scaffold(
      backgroundColor: context.background,
      body: Column(
        children: [
          // Tabs
          Container(
            height: 50,
            padding: EdgeInsets.symmetric(horizontal: context.screenMargin),
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _tabs.length,
              separatorBuilder: (_, __) => SizedBox(width: context.sm),
              itemBuilder: (context, index) {
                final tab = _tabs[index];
                final isSelected = tab == _selectedTab;
                return ChoiceChip(
                  label: Text(tab),
                  selected: isSelected,
                  onSelected: (_) => setState(() => _selectedTab = tab),
                  selectedColor: context.primaryContainer,
                  labelStyle: context.labelSmall.copyWith(
                    color: isSelected ? context.primary : context.onSurfaceVariant,
                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                  ),
                  backgroundColor: context.surfaceContainer,
                  side: BorderSide(
                    color: isSelected ? context.primary : context.outlineVariant,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: context.chip,
                  ),
                );
              },
            ),
          ),

          // TripModel List
          Expanded(
            child: tripsAsync.when(
              loading: () => LoadingState(message: 'Loading trips...'),
              error: (error, _) => ErrorState(
                message: 'Failed to load trips: $error',
                onRetry: () => ref.read(allTripModelsProvider.notifier).load(),
              ),
              data: (trips) => _buildTripModelList(context, _filterTripModels(trips)),
            ),
          ),
        ],
      ),
    );
  }

  List<TripModel> _filterTripModels(List<TripModel> trips) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);

    return switch (_selectedTab) {
      'Today' => trips.where((t) => _isSameDay(t.scheduledDate, today)).toList(),
      'Upcoming' => trips.where((t) => t.scheduledDate.isAfter(today) && !t.isCompleted && !t.isCancelled).toList(),
      'Active' => trips.where((t) => t.isActive).toList(),
      'Completed' => trips.where((t) => t.isCompleted).toList(),
      'Pending' => trips.where((t) => t.isPendingAssignment).toList(),
      _ => trips,
    };
  }

  bool _isSameDay(DateTime a, DateTime b) {
    return a.year == b.year && a.month == b.month && a.day == b.day;
  }

  Widget _buildTripModelList(BuildContext context, List<TripModel> trips) {
    if (trips.isEmpty) {
      return EmptyState(
        icon: Icons.event_busy,
        title: 'No trips',
        subtitle: 'No trips found for $_selectedTab',
      );
    }

    return RefreshIndicator(
      onRefresh: () => ref.read(allTripModelsProvider.notifier).load(),
      child: ListView.separated(
        padding: EdgeInsets.all(context.screenMargin),
        itemCount: trips.length,
        separatorBuilder: (_, __) => SizedBox(height: context.sm),
        itemBuilder: (context, index) {
          final trip = trips[index];
          return _TripModelCard(trip: trip);
        },
      ),
    );
  }
}

class _TripModelCard extends StatelessWidget {
  const _TripModelCard({required this.trip});

  final TripModel trip;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: () => context.go('/manager/trips/${trip.id}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: _getTypeColor(context, trip.type).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  _getTypeIcon(trip.type),
                  size: 20,
                  color: _getTypeColor(context, trip.type),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      trip.customerName ?? '',
                      style: context.bodyMediumBold,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      trip.bookingNumber ?? '',
                      style: context.caption,
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  StatusBadge(
                    label: trip.statusDisplay,
                    type: _getStatusBadgeType(trip.status),
                    compact: true,
                  ),
                  ...[
                  const SizedBox(height: 2),
                  Text(
                    trip.scheduledTime!,
                    style: context.caption.copyWith(
                      color: context.onSurfaceVariant,
                    ),
                  ),
                ],
                ],
              ),
            ],
          ),

          const SizedBox(height: 12),

          // Route
          Row(
            children: [
              Icon(Icons.location_on, size: 14, color: context.success),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  trip.pickupLocation ?? '',
                  style: context.caption,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              Icon(Icons.arrow_forward, size: 14, color: context.onSurfaceVariant),
              const SizedBox(width: 8),
              Icon(Icons.flag, size: 14, color: context.danger),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  trip.dropLocation ?? '',
                  style: context.caption,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),

          const SizedBox(height: 8),

          // Meta info
          Row(
            children: [
              if (trip.driverName != null) ...[
                _MetaChip(
                  icon: Icons.person,
                  label: trip.driverName!,
                  color: context.info,
                ),
                const SizedBox(width: 8),
              ],
              if (trip.vehicleReg != null) ...[
                _MetaChip(
                  icon: Icons.directions_car,
                  label: trip.vehicleReg!,
                  color: context.primary,
                ),
                const SizedBox(width: 8),
              ],
              if (trip.fare != null) ...[
                _MetaChip(
                  icon: Icons.currency_rupee,
                  label: '₹${trip.fare!.toStringAsFixed(0)}',
                  color: context.success,
                ),
              ],
            ],
          ),
        ],
      );
  }

  Color _getTypeColor(BuildContext context, String type) {
    switch (type.toLowerCase()) {
      case 'one_way':
        return context.info;
      case 'round_trip':
        return context.primary;
      case 'multi_city':
        return context.warning;
      default:
        return context.onSurfaceVariant;
    }
  }

  IconData _getTypeIcon(String type) {
    switch (type.toLowerCase()) {
      case 'one_way':
        return Icons.directions;
      case 'round_trip':
        return Icons.round_trip;
      case 'multi_city':
        return Icons.multiple_stop;
      default:
        return Icons.local_shipping;
    }
  }

  StatusBadgeType _getStatusBadgeType(String status) {
    switch (status.toLowerCase()) {
      case 'started':
        return StatusBadgeType.info;
      case 'completed':
        return StatusBadgeType.success;
      case 'pending':
      case 'assigned':
      case 'confirmed':
        return StatusBadgeType.warning;
      case 'cancelled':
        return StatusBadgeType.danger;
      default:
        return StatusBadgeType.neutral;
    }
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({
    required this.icon,
    required this.label,
    required this.color,
  });

  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: context.caption.copyWith(
              color: color,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
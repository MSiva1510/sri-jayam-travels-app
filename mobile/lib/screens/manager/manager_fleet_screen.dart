// ─────────────────────────────────────────────────────────────────────────────
// manager_fleet_screen.dart — Manager Live Fleet Map
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../core/theme/context_extensions.dart';
import '../../models/vehicle.dart';
import '../../providers/vehicle_provider.dart';
import '../../widgets/shared.dart';

class ManagerFleetScreen extends ConsumerStatefulWidget {
  const ManagerFleetScreen({super.key});

  @override
  ConsumerState<ManagerFleetScreen> createState() => _ManagerFleetScreenState();
}

class _ManagerFleetScreenState extends ConsumerState<ManagerFleetScreen> {
  String _selectedFilter = 'All';

  final List<String> _filters = [
    'All',
    'Moving',
    'Stopped',
    'On Trip',
    'Available',
    'Offline',
    'Alert',
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(vehiclesProvider.notifier).load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final vehiclesAsync = ref.watch(vehiclesProvider);
    final filteredVehicles = _filterVehicles(vehiclesAsync.value ?? []);

    return Scaffold(
      backgroundColor: context.background,
      body: Column(
        children: [
          // Filter Chips
          Container(
            height: 56,
            padding: EdgeInsets.symmetric(horizontal: context.screenMargin),
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _filters.length,
              separatorBuilder: (_, __) => SizedBox(width: context.sm),
              itemBuilder: (context, index) {
                final filter = _filters[index];
                final isSelected = filter == _selectedFilter;
                return FilterChip(
                  label: Text(filter),
                  selected: isSelected,
                  onSelected: (_) => setState(() => _selectedFilter = filter),
                  selectedColor: context.primaryContainer,
                  checkmarkColor: context.primary,
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

          // Fleet List / Map
          Expanded(
            child: vehiclesAsync.when(
              loading: () => LoadingState(message: 'Loading fleet...'),
              error: (error, _) => ErrorState(
                message: 'Failed to load fleet: $error',
                onRetry: () => ref.read(vehiclesProvider.notifier).load(),
              ),
              data: (vehicles) => _buildFleetList(context, _filterVehicles(vehicles)),
            ),
          ),
        ],
      ),
    );
  }

  List<Vehicle> _filterVehicles(List<Vehicle> vehicles) {
    switch (_selectedFilter) {
      case 'Moving':
        return vehicles.where((v) => v.isMoving).toList();
      case 'Stopped':
        return vehicles.where((v) => !v.isMoving && v.isActive).toList();
      case 'On Trip':
        return vehicles.where((v) => v.currentTripId != null).toList();
      case 'Available':
        return vehicles.where((v) => v.isAvailable).toList();
      case 'Offline':
        return vehicles.where((v) => v.status == 'offline').toList();
      case 'Alert':
        return vehicles.where((v) => v.hasAlert).toList();
      default:
        return vehicles;
    }
  }

  Widget _buildFleetList(BuildContext context, List<Vehicle> vehicles) {
    if (vehicles.isEmpty) {
      return EmptyState(
        icon: Icons.directions_car_outlined,
        title: 'No vehicles found',
        subtitle: 'No vehicles match the current filter',
      );
    }

    return RefreshIndicator(
      onRefresh: () => ref.read(vehiclesProvider.notifier).load(),
      child: ListView.separated(
        padding: EdgeInsets.all(context.screenMargin),
        itemCount: vehicles.length,
        separatorBuilder: (_, __) => SizedBox(height: context.sm),
        itemBuilder: (context, index) {
          final vehicle = vehicles[index];
          return _VehicleCard(vehicle: vehicle);
        },
      ),
    );
  }
}

class _VehicleCard extends StatelessWidget {
  const _VehicleCard({required this.vehicle});

  final Vehicle vehicle;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: () => context.go('/manager/fleet/${vehicle.id}'),
      child: Row(
        children: [
          // Status indicator
          Container(
            width: 12,
            height: 12,
            decoration: BoxDecoration(
              color: _getStatusColor(context, vehicle.status),
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 12),

          // Vehicle info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      vehicle.registration,
                      style: context.bodyMediumBold,
                    ),
                    const SizedBox(width: 8),
                    StatusBadge(
                      label: vehicle.statusDisplay,
                      type: _getStatusBadgeType(vehicle.status),
                      compact: true,
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '${vehicle.make} ${vehicle.model} • ${vehicle.type}',
                  style: context.caption,
                ),
                if (vehicle.currentDriver != null) ...[
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Icon(Icons.person, size: 11, color: context.onSurfaceVariant),
                      const SizedBox(width: 4),
                      Text(
                        vehicle.currentDriver!,
                        style: context.caption,
                      ),
                    ],
                  ),
                ],
                if (vehicle.currentTripId != null) ...[
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Icon(Icons.local_shipping, size: 11, color: context.info),
                      const SizedBox(width: 4),
                      Text(
                        'Trip: ${vehicle.currentTripId}',
                        style: context.caption.copyWith(color: context.info),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // GPS / Speed info
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                if (vehicle.lastGpsUpdate != null)
                  Text(
                    _formatLastUpdate(vehicle.lastGpsUpdate!),
                    style: context.caption.copyWith(color: context.onSurfaceVariant),
                  ),
                if (vehicle.speed != null && vehicle.speed! > 0) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(Icons.speed, size: 11, color: context.onSurfaceVariant),
                      const SizedBox(width: 2),
                      Text(
                        '${vehicle.speed!.toStringAsFixed(0)} km/h',
                        style: context.caption.copyWith(
                          color: context.onSurfaceVariant,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 8),
                Icon(
                  Icons.chevron_right,
                  color: context.onSurfaceVariant,
                ),
              ],
            ),
          ],
        ),
      );
  }

  Color _getStatusColor(BuildContext context, String status) {
    switch (status.toLowerCase()) {
      case 'active':
      case 'on_trip':
        return context.success;
      case 'available':
        return context.info;
      case 'maintenance':
        return context.warning;
      case 'offline':
        return context.danger;
      default:
        return context.onSurfaceVariant;
    }
  }

  StatusBadgeType _getStatusBadgeType(String status) {
    switch (status.toLowerCase()) {
      case 'active':
      case 'on_trip':
      case 'available':
        return StatusBadgeType.success;
      case 'maintenance':
        return StatusBadgeType.warning;
      case 'offline':
        return StatusBadgeType.danger;
      default:
        return StatusBadgeType.neutral;
    }
  }

  String _formatLastUpdate(DateTime dateTime) {
    final now = DateTime.now();
    final diff = now.difference(dateTime);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }
}
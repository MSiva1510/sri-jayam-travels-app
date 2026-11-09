// ─────────────────────────────────────────────────────────────────────────────
// manager_home_screen.dart — Manager Dashboard
// Real data from Supabase via providers
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../core/theme/context_extensions.dart';
import '../../models/trip.dart';
import '../../models/vehicle.dart';
import '../../navigation/app_router.dart';
import '../../providers/trip_provider.dart';
import '../../providers/vehicle_provider.dart';
import '../../providers/driver_provider.dart';
import '../../providers/attendance_provider.dart';
import '../../providers/alert_provider.dart';
import '../../widgets/shared.dart';

class ManagerHomeScreen extends ConsumerStatefulWidget {
  const ManagerHomeScreen({super.key});

  @override
  ConsumerState<ManagerHomeScreen> createState() => _ManagerHomeScreenState();
}

class _ManagerHomeScreenState extends ConsumerState<ManagerHomeScreen> {
  @override
  void initState() {
    super.initState();
    // Load data when screen initializes
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(allTripModelsProvider.notifier).load();
      ref.read(vehiclesProvider.notifier).load();
      ref.read(driversProvider.notifier).load();
      ref.read(todayAttendanceProvider.notifier).load();
      ref.read(activeAlertsProvider.notifier).load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final allTripModels = ref.watch(allTripModelsProvider);
    final vehicles = ref.watch(vehiclesProvider);
    final drivers = ref.watch(driversProvider);
    final attendance = ref.watch(todayAttendanceProvider);
    final alerts = ref.watch(activeAlertsProvider);

    final todayTripModels = allTripModels.where((t) => _isSameDay(t.scheduledDate, DateTime.now())).toList();
    final activeTripModels = todayTripModels.where((t) => t.isActive).toList();
    final pendingTripModels = todayTripModels.where((t) => t.isPendingAssignment).toList();
    final availableVehicles = vehicles.where((v) => v.isAvailable).toList();
    final onlineDrivers = drivers.where((d) => d.isActive).toList();

    final presentCount = attendance.where((a) => a.status == 'present' || a.status == 'half-day').length;
    final absentCount = attendance.where((a) => a.status == 'absent').length;
    final criticalAlerts = alerts.where((a) => a.priority == 'critical').length;

    return RefreshIndicator(
      onRefresh: () async {
        await Future.wait([
          ref.read(allTripModelsProvider.notifier).load(),
          ref.read(vehiclesProvider.notifier).load(),
          ref.read(driversProvider.notifier).load(),
          ref.read(todayAttendanceProvider.notifier).load(),
          ref.read(activeAlertsProvider.notifier).load(),
        ]);
      },
      child: CustomScrollView(
        slivers: [
          // ── Stats Grid ────────────────────────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.all(context.screenMargin),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "Today's Operations",
                    style: context.overline.copyWith(color: context.primary),
                  ),
                  const SizedBox(height: 16),
                  _buildStatsGrid(context, {
                    'Active TripModels': activeTripModels.length.toString(),
                    'Pending Assignment': pendingTripModels.length.toString(),
                    'Available Vehicles': availableVehicles.length.toString(),
                    'Drivers Online': onlineDrivers.length.toString(),
                  }),
                ],
              ),
            ),
          ),

          // ── Live Fleet Preview ────────────────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.all(context.screenMargin),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        'Live Fleet',
                        style: context.overline.copyWith(color: context.primary),
                      ),
                      const Spacer(),
                      TextButton(
                        onPressed: () => context.go(AppRoutes.managerFleet),
                        child: Text('View All', style: context.labelMedium),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _buildFleetPreview(context, vehicles.take(5).toList()),
                ],
              ),
            ),
          ),

          // ── Critical Alerts ───────────────────────────────────────────
          if (criticalAlerts > 0)
            SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.all(context.screenMargin),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          'Critical Alerts',
                          style: context.overline.copyWith(color: context.danger),
                        ),
                        const Spacer(),
                        TextButton(
                          onPressed: () => context.go(AppRoutes.managerAlerts),
                          child: Text('View All', style: context.labelMedium),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    _buildAlertList(context, alerts.where((a) => a.priority == 'critical').take(3).toList()),
                  ],
                ),
              ),
            ),

          // ── Today's TripModels ─────────────────────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.all(context.screenMargin),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        "Today's TripModels",
                        style: context.overline.copyWith(color: context.primary),
                      ),
                      const Spacer(),
                      TextButton(
                        onPressed: () => context.go(AppRoutes.managerTripModels),
                        child: Text('View All', style: context.labelMedium),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _buildTripModelList(context, todayTripModels.take(5).toList()),
                ],
              ),
            ),
          ),

          // ── Quick Actions ─────────────────────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.all(context.screenMargin),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Quick Actions',
                    style: context.overline.copyWith(color: context.primary),
                  ),
                  const SizedBox(height: 12),
                  _buildQuickActions(context),
                ],
              ),
            ),
          ),

          // Bottom padding for nav bar
          SliverToBoxAdapter(
            child: SizedBox(height: context.bottomNavHeight + 24),
          ),
        ],
      ),
    );
  }

  bool _isSameDay(DateTime a, DateTime b) {
    return a.year == b.year && a.month == b.month && a.day == b.day;
  }

  Widget _buildStatsGrid(BuildContext context, Map<String, String> stats) {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 1.4,
      children: stats.entries.map((entry) {
        final (icon, gradient) = _getStatConfig(entry.key);
        return StatCard(
          icon: icon,
          label: entry.key,
          value: entry.value,
          gradient: gradient,
          onTap: () => _onStatTap(entry.key),
        );
      }).toList(),
    );
  }

  (IconData, LinearGradient) _getStatConfig(String key) {
    switch (key) {
      case 'Active TripModels':
        return (Icons.directions_car, LinearGradient(colors: [context.info, context.info.withValues(alpha: 0.7)]));
      case 'Pending Assignment':
        return (Icons.assignment_late, LinearGradient(colors: [context.warning, context.warning.withValues(alpha: 0.7)]));
      case 'Available Vehicles':
        return (Icons.directions_car_filled, LinearGradient(colors: [context.success, context.success.withValues(alpha: 0.7)]));
      case 'Drivers Online':
        return (Icons.people, LinearGradient(colors: [context.primary, context.primary.withValues(alpha: 0.7)]));
      default:
        return (Icons.analytics, LinearGradient(colors: [context.primary, context.primary.withValues(alpha: 0.7)]));
    }
  }

  void _onStatTap(String key) {
    switch (key) {
      case 'Active TripModels':
      case 'Pending Assignment':
        context.go(AppRoutes.managerTripModels);
        break;
      case 'Available Vehicles':
        context.go(AppRoutes.managerFleet);
        break;
      case 'Drivers Online':
        context.go('/manager/drivers');
        break;
    }
  }

  Widget _buildFleetPreview(BuildContext context, List<Vehicle> vehicles) {
    if (vehicles.isEmpty) {
      return AppCard(
        child: Center(
          child: Padding(
            padding: EdgeInsets.all(context.xl),
            child: Column(
              children: [
                Icon(Icons.map_outlined, size: 48, color: context.onSurfaceVariant),
                const SizedBox(height: 12),
                Text('No vehicles in fleet', style: context.bodyMedium),
              ],
            ),
          ),
        );
    }

    return SizedBox(
      height: 140,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: vehicles.length,
        separatorBuilder: (_, __) => SizedBox(width: context.md),
        itemBuilder: (context, index) {
          final vehicle = vehicles[index];
          return SizedBox(
            width: 180,
            child: AppCard(
              onTap: () => context.go(AppRoutes.vehicleDetail(vehicle.id)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: _getStatusColor(context, vehicle.status).withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Icon(
                          Icons.directions_car,
                          size: 18,
                          color: _getStatusColor(context, vehicle.status),
                        ),
                      ),
                      const Spacer(),
                      StatusBadge(
                        label: vehicle.statusDisplay,
                        type: _getStatusBadgeType(vehicle.status),
                        compact: true,
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    vehicle.registration,
                    style: context.headlineSmall.copyWith(fontWeight: FontWeight.w700),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    vehicle.model,
                    style: context.caption.copyWith(color: context.onSurfaceVariant),
                  ),
                  const Spacer(),
                  if (vehicle.currentDriver != null)
                    Row(
                      children: [
                        Icon(Icons.person, size: 12, color: context.onSurfaceVariant),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            vehicle.currentDriver!,
                            style: context.caption,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                ],
              ),
            ),
          );
        },
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

  Widget _buildAlertList(BuildContext context, List<Alert> alerts) {
    return Column(
      children: alerts.map((alert) => AppCard(
        onTap: () => context.go(AppRoutes.alertDetail(alert.id)),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: _getAlertColor(context, alert.priority).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                _getAlertIcon(alert.category),
                size: 18,
                color: _getAlertColor(context, alert.priority),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    alert.title,
                    style: context.bodyMediumBold,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    '${alert.vehicleReg ?? 'System'} • ${_formatTime(alert.createdAt)}',
                    style: context.caption,
                  ),
                ],
              ),
            ),
            StatusBadge(
              label: alert.priority.toUpperCase(),
              type: _getAlertBadgeType(alert.priority),
              compact: true,
            ),
          ],
        ),
      )).toList(),
    );
  }

  Color _getAlertColor(BuildContext context, String priority) {
    switch (priority.toLowerCase()) {
      case 'critical':
        return context.danger;
      case 'high':
        return context.warning;
      case 'medium':
        return context.info;
      default:
        return context.onSurfaceVariant;
    }
  }

  StatusBadgeType _getAlertBadgeType(String priority) {
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

  IconData _getAlertIcon(String category) {
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

  Widget _buildTripModelList(BuildContext context, List<TripModel> trips) {
    if (trips.isEmpty) {
      return AppCard(
        child: Center(
          child: Padding(
            padding: EdgeInsets.all(context.xl),
            child: Column(
              children: [
                Icon(Icons.event_busy, size: 48, color: context.onSurfaceVariant),
                const SizedBox(height: 12),
                Text('No trips today', style: context.bodyMedium),
              ],
            ),
          ),
        );
    }

    return Column(
      children: trips.map((trip) => AppCard(
        onTap: () => context.go(AppRoutes.tripDetailMgr(trip.id)),
        margin: EdgeInsets.only(bottom: context.sm),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: _getTripModelStatusColor(context, trip.status).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Center(
                child: Text(
                  trip.scheduledTime ?? '',
                  style: context.labelSmall.copyWith(
                    color: _getTripModelStatusColor(context, trip.status),
                    fontWeight: FontWeight.w700,
                  ),
                ),
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
                    '${trip.pickupLocation ?? ''} → ${trip.dropLocation ?? ''}',
                    style: context.caption,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                StatusBadge(
                  label: trip.statusDisplay,
                  type: _getTripModelBadgeType(trip.status),
                  compact: true,
                ),
                if (trip.driverName != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    trip.driverName!,
                    style: context.caption.copyWith(color: context.onSurfaceVariant),
                  ),
                ],
              ],
            ),
          ],
        ),
      )).toList(),
    );
  }

  Color _getTripModelStatusColor(BuildContext context, String status) {
    switch (status.toLowerCase()) {
      case 'started':
        return context.info;
      case 'completed':
        return context.success;
      case 'pending':
      case 'assigned':
        return context.warning;
      case 'cancelled':
        return context.danger;
      default:
        return context.onSurfaceVariant;
    }
  }

  StatusBadgeType _getTripModelBadgeType(String status) {
    switch (status.toLowerCase()) {
      case 'started':
        return StatusBadgeType.info;
      case 'completed':
        return StatusBadgeType.success;
      case 'pending':
      case 'assigned':
        return StatusBadgeType.warning;
      case 'cancelled':
        return StatusBadgeType.danger;
      default:
        return StatusBadgeType.neutral;
    }
  }

  Widget _buildQuickActions(BuildContext context) {
    final actions = [
      ('Create Booking', Icons.add, context.primary, () => context.go('/manager/bookings/new')),
      ('Assign Driver', Icons.person_add, context.info, () => context.go(AppRoutes.managerTripModels)),
      ('Assign Vehicle', Icons.directions_car, context.success, () => context.go(AppRoutes.managerTripModels)),
      ('View Fleet', Icons.map, context.warning, () => context.go(AppRoutes.managerFleet)),
    ];

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 1.2,
      children: actions.map((action) => AppCard(
        onTap: action.$4,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: action.$3.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(action.$2, size: 28, color: action.$3),
            ),
            const SizedBox(height: 12),
            Text(
              action.$1,
              style: context.bodyMediumBold,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      )).toList(),
    );
  }
}
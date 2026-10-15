// ─────────────────────────────────────────────────────────────────────────────
// driver_home_screen.dart — Home per the "1 Home" wireframe.
// Greeting + online pill · NEW TRIP hero (accept/decline) · Attendance +
// GPS cards · Earnings today · Quick actions · SOS.
// Logic/providers unchanged — only the presentation follows the wireframe.
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../models/trip.dart';
import '../../navigation/app_router.dart';
import '../../providers/attendance_provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/earnings_provider.dart';
import '../../providers/gps_provider.dart';
import '../../providers/notification_provider.dart';
import '../../providers/trip_provider.dart';
import '../../services/gps_tracking_service.dart' show GpsTrackingStatus;
import '../../widgets/driver/sos_action.dart';

final _inr =
    NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

String _greeting() {
  final h = DateTime.now().hour;
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

String _clock(String? hhmmss) {
  if (hhmmss == null || hhmmss.isEmpty) return '—';
  try {
    final p = hhmmss.split(':');
    final dt = DateTime(2020, 1, 1, int.parse(p[0]), int.parse(p[1]));
    return DateFormat('h:mm a').format(dt);
  } catch (_) {
    return hhmmss;
  }
}

class DriverHomeScreen extends ConsumerWidget {
  const DriverHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final driver = ref.watch(currentDriverProvider);
    final profile = ref.watch(currentProfileProvider);
    final name = driver?.name ?? profile?.fullName ?? 'Driver';
    final code = driver?.driverId ?? '';
    final unread = ref.watch(unreadCountProvider);
    final attendance = ref.watch(todayAttendanceProvider);
    final track = ref.watch(gpsTrackingProvider);
    final upcomingAsync = ref.watch(upcomingTripsProvider);
    final todayCountAsync = ref.watch(todayTripCountProvider);
    final todayEarn = ref.watch(todayEarningsProvider);
    final todayPayouts = ref.watch(driverPayslipsProvider).value
            ?.where((p) {
              final c = p.createdAt;
              final n = DateTime.now();
              return c != null &&
                  c.year == n.year &&
                  c.month == n.month &&
                  c.day == n.day;
            })
            .length ??
        0;

    final gpsLive = track.status == GpsTrackingStatus.active ||
        track.status == GpsTrackingStatus.paused;

    Future<void> refresh() async {
      ref.invalidate(upcomingTripsProvider);
      ref.invalidate(todayTripCountProvider);
      ref.invalidate(driverPayslipsProvider);
      ref.read(todayAttendanceProvider.notifier).refresh();
      await Future.delayed(const Duration(milliseconds: 400));
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Home',
            style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: Badge(
              isLabelVisible: unread > 0,
              label: Text(unread > 99 ? '99+' : '$unread'),
              child: const Icon(Icons.notifications_outlined),
            ),
            tooltip: 'Notifications',
            onPressed: () =>
                context.push(AppRoutes.driverNotifications),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: refresh,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            // ── Greeting row ──
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(_greeting(),
                          style: theme.textTheme.bodyMedium?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant)),
                      Text(
                        code.isEmpty ? name : '$name · ID $code',
                        style: theme.textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ),
                _OnlinePill(attendance: attendance),
              ],
            ),
            const SizedBox(height: 12),

            // ── NEW TRIP hero ──
            upcomingAsync.when(
              loading: () => const SizedBox(),
              error: (_, __) => const SizedBox(),
              data: (trips) {
                final next = trips.where((t) => t.status == 'assigned').isEmpty
                    ? null
                    : trips.firstWhere(
                        (t) => t.status == 'assigned');
                if (next == null) return const SizedBox();
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _NewTripHero(
                    trip: next,
                    onAccept: () => context
                        .push(AppRoutes.tripDetail(next.id)),
                    onDecline: () => _declineSheet(context, ref, next),
                  ),
                );
              },
            ),

            // ── Attendance + GPS ──
            Row(
              children: [
                Expanded(
                    child: _AttendanceMini(
                        state: attendance, ref: ref)),
                const SizedBox(width: 12),
                Expanded(child: _GpsMini(
                  live: gpsLive,
                  accuracyM: track.lastPosition?.accuracy,
                )),
              ],
            ),
            const SizedBox(height: 12),

            // ── Earnings today ──
            _EarningsCard(
              total: todayEarn,
              payouts: todayPayouts,
              trips: todayCountAsync.value ?? 0,
            ),
            const SizedBox(height: 16),

            Text('Quick actions',
                style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant)),
            const SizedBox(height: 8),
            Row(
              children: [
                _QuickTile(
                    icon: Icons.route_outlined,
                    label: 'Trips',
                    onTap: () =>
                        context.push(AppRoutes.driverTrips)),
                const SizedBox(width: 10),
                _QuickTile(
                    icon: Icons.receipt_long_outlined,
                    label: 'Expenses',
                    onTap: () =>
                        context.push(AppRoutes.driverExpenses)),
                const SizedBox(width: 10),
                _QuickTile(
                    icon: Icons.event_available_outlined,
                    label: 'Leave',
                    onTap: () =>
                        context.push(AppRoutes.attendance)),
                const SizedBox(width: 10),
                _QuickTile(
                    icon: Icons.bar_chart_outlined,
                    label: 'Earnings',
                    onTap: () =>
                        context.push(AppRoutes.driverEarnings)),
              ],
            ),
            const SizedBox(height: 20),

            // ── SOS ──
            const SosButton(),
          ],
        ),
      ),
    );
  }

  Future<void> _declineSheet(
      BuildContext context, WidgetRef ref, TripModel trip) async {
    final reason = await showModalBottomSheet<String>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        const reasons = [
          'Vehicle issue',
          'Customer no-show',
          'Route problem',
          'Health emergency',
          'Other',
        ];
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                          color: Theme.of(ctx)
                              .colorScheme
                              .outlineVariant,
                          borderRadius: BorderRadius.circular(2))),
                ),
                const SizedBox(height: 16),
                const Text('Decline trip?',
                    style:
                        TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                const Text(
                    'Pick a reason — dispatch gets it back for reassignment.'),
                const SizedBox(height: 12),
                for (final r in reasons)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(r),
                    trailing:
                        const Icon(Icons.chevron_right_outlined),
                    onTap: () => Navigator.pop(ctx, r),
                  ),
              ],
            ),
          ),
        );
      },
    );
    if (reason == null || !context.mounted) return;
    try {
      await ref
          .read(tripServiceProvider)
          .declineTrip(tripId: trip.id, driver: ref.read(currentDriverProvider), reason: reason);
      ref.invalidate(upcomingTripsProvider);
      ref.invalidate(todayTripsProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Trip declined — sent back to dispatch.')),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not decline: $e')),
        );
      }
    }
  }
}

// ── Online pill (driven by attendance state) ──────────────────────────

class _OnlinePill extends StatelessWidget {
  const _OnlinePill({required this.attendance});

  final AttendanceState attendance;

  @override
  Widget build(BuildContext context) {
    final working = attendance is AttendanceLoaded &&
        (attendance as dynamic).record?.isWorking == true;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: working
            ? Colors.green.withValues(alpha: 0.12)
            : Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(
              color: working ? Colors.green : Colors.grey,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 6),
          Text(working ? 'Online' : 'Off duty',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: working
                    ? Colors.green.shade800
                    : Theme.of(context).colorScheme.onSurfaceVariant,
              )),
        ],
      ),
    );
  }
}

// ── NEW TRIP hero card ────────────────────────────────────────────────

class _NewTripHero extends StatelessWidget {
  const _NewTripHero(
      {required this.trip, required this.onAccept, required this.onDecline});

  final TripModel trip;
  final VoidCallback onAccept;
  final VoidCallback onDecline;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            theme.colorScheme.primary,
            theme.colorScheme.primaryContainer,
          ],
          begin: Alignment.topLeft,
          end:   Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('NEW TRIP · sent by dispatch',
              style: theme.textTheme.labelMedium?.copyWith(
                  color: Colors.white70,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.5)),
          const SizedBox(height: 6),
          Text('${trip.pickupLocation ?? 'Pickup'} → ${trip.dropLocation ?? 'Drop'}',
              style: theme.textTheme.titleMedium?.copyWith(
                  color: Colors.white, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text(
              'Pickup ${_clock(trip.startTime)} · ${trip.vehicleReg ?? 'Vehicle TBD'}',
              style: theme.textTheme.bodyMedium
                  ?.copyWith(color: Colors.white70)),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: FilledButton(
                  onPressed: onDecline,
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: theme.colorScheme.primary,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  child: const Text('DECLINE',
                      style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton(
                  onPressed: onAccept,
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: theme.colorScheme.primary,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  child: const Text('ACCEPT',
                      style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Attendance + GPS mini cards ───────────────────────────────────────

class _AttendanceMini extends StatelessWidget {
  const _AttendanceMini({required this.state, required this.ref});

  final AttendanceState state;
  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final record = switch (state) {
      AttendanceLoaded(:final record) => record,
      AttendanceSubmitting(:final current) => current,
      AttendanceError(:final record) => record,
      _ => null,
    };
    final working = record?.isWorking == true;
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Attendance', style: theme.textTheme.bodySmall),
            const SizedBox(height: 4),
            Text(
              record == null
                  ? 'Not in'
                  : 'In ${record.checkIn ?? '—'}',
              style: theme.textTheme.titleSmall
                  ?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: TextButton(
                onPressed: working
                    ? () => ref
                        .read(todayAttendanceProvider.notifier)
                        .checkOut()
                    : () => ref
                        .read(todayAttendanceProvider.notifier)
                        .checkIn(),
                style: TextButton.styleFrom(
                  backgroundColor: theme.colorScheme.primary
                      .withValues(alpha: 0.12),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
                child: Text(working ? 'Check out' : 'Check in'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GpsMini extends StatelessWidget {
  const _GpsMini({required this.live, this.accuracyM});

  final bool live;
  final double? accuracyM;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('GPS (auto)', style: theme.textTheme.bodySmall),
            const SizedBox(height: 4),
            Text(live ? 'Active' : 'Off',
                style: theme.textTheme.titleSmall
                    ?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Row(
              children: [
                Container(
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(
                    color: live ? Colors.green : Colors.grey,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                    live
                        ? (accuracyM != null
                            ? 'Accuracy ${accuracyM!.toStringAsFixed(0)} m'
                            : 'Sharing with dispatch')
                        : 'Starts on duty',
                    style: theme.textTheme.bodySmall),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ── Earnings today card ───────────────────────────────────────────────

class _EarningsCard extends StatelessWidget {
  const _EarningsCard(
      {required this.total, required this.payouts, required this.trips});

  final double total;
  final int payouts;
  final int trips;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Earnings today', style: theme.textTheme.bodySmall),
            const SizedBox(height: 4),
            Text(
              '${_inr.format(total)} · $payouts payout${payouts == 1 ? '' : 's'} · $trips trip${trips == 1 ? '' : 's'}',
              style: theme.textTheme.titleSmall
                  ?.copyWith(fontWeight: FontWeight.bold),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Quick action tile ─────────────────────────────────────────────────

class _QuickTile extends StatelessWidget {
  const _QuickTile(
      {required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Expanded(
      child: Card(
        margin: EdgeInsets.zero,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 14),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, color: theme.colorScheme.primary),
                const SizedBox(height: 6),
                Text(label,
                    style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.primary,
                        fontWeight: FontWeight.w600)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

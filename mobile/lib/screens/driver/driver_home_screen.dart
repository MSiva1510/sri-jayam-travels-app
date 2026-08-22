// ─────────────────────────────────────────────────────────────────────────────
// driver_home_screen.dart — Day 45 (adds attendance status card)
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../providers/auth_provider.dart';
import '../../providers/gps_provider.dart';
import '../../providers/trip_provider.dart';
import '../../providers/booking_provider.dart';
import '../../providers/attendance_provider.dart';
import '../../services/gps_tracking_service.dart' show GpsTrackingStatus;
import '../../services/location_service.dart';
import '../../navigation/app_router.dart';
import '../../widgets/driver/trip_card.dart';
import '../../widgets/driver/booking_card.dart';

class DriverHomeScreen extends ConsumerWidget {
  const DriverHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final driver  = ref.watch(currentDriverProvider);
    final profile = ref.watch(currentProfileProvider);

    final todayCount   = ref.watch(todayTripCountProvider);
    final bookingCount = ref.watch(activeBookingCountProvider);
    final upcoming     = ref.watch(upcomingTripsProvider);
    final nextBookings = ref.watch(upcomingBookingsProvider);
    final attendance   = ref.watch(todayAttendanceProvider);

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(todayTripCountProvider);
          ref.invalidate(activeBookingCountProvider);
          ref.invalidate(upcomingTripsProvider);
          ref.invalidate(upcomingBookingsProvider);
          ref.read(todayAttendanceProvider.notifier).refresh();
          await Future.delayed(const Duration(milliseconds: 400));
        },
        child: CustomScrollView(
          slivers: [
            // ── App Bar ────────────────────────────────────────────────
            SliverAppBar(
              floating: true,
              expandedHeight: 160,
              flexibleSpace: FlexibleSpaceBar(
                background: _Header(
                  name:     driver?.name ?? profile?.fullName ?? 'Driver',
                  photoUrl: driver?.displayPhotoUrl,
                  initials: driver?.initials ?? profile?.initials ?? '?',
                  status:   driver?.status,
                ),
              ),
              actions: [
                IconButton(
                  icon: const Icon(Icons.person_outline),
                  tooltip: 'Profile',
                  onPressed: () => context.push(AppRoutes.driverProfile),
                ),
                IconButton(
                  icon: const Icon(Icons.logout),
                  tooltip: 'Logout',
                  onPressed: () => _logout(context, ref),
                ),
              ],
            ),

            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ── Date ────────────────────────────────────────────
                    Text(
                      DateFormat('EEEE, d MMMM yyyy').format(DateTime.now()),
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: 16),

                    // ── Attendance card (quick action) ───────────────────
                    _AttendanceCard(state: attendance, ref: ref),
                    const SizedBox(height: 12),


                    // ── GPS status card ────────────────────────────────────
                    const _GpsStatusCard(),
                    const SizedBox(height: 12),

                    // ── My Documents (Day 48) ─────────────────────────────
                    Card(
                      margin: EdgeInsets.zero,
                      child: ListTile(
                        leading: Icon(
                          Icons.badge_outlined,
                          color: Theme.of(context).colorScheme.primary,
                        ),
                        title: const Text('My Documents'),
                        subtitle: const Text(
                            'Upload your licence, badge & other documents'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => context.push(AppRoutes.driverDocuments),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // ── Stats row ────────────────────────────────────────
                    Row(
                      children: [
                        Expanded(
                          child: _StatCard(
                            icon:  Icons.today_outlined,
                            label: "Today's Trips",
                            value: todayCount.when(
                              data: (c) => '$c',
                              loading: () => '…',
                              error: (_, __) => '–',
                            ),
                            onTap: () => context.push(AppRoutes.driverTrips),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _StatCard(
                            icon:  Icons.book_online_outlined,
                            label: 'Active Bookings',
                            value: bookingCount.when(
                              data: (c) => '$c',
                              loading: () => '…',
                              error: (_, __) => '–',
                            ),
                            onTap: () =>
                                context.push(AppRoutes.driverBookings),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // ── Quick nav ─────────────────────────────────────────
                    Row(
                      children: [
                        Expanded(
                          child: _QuickNavButton(
                            icon:  Icons.directions_car_outlined,
                            label: 'Trips',
                            onTap: () => context.push(AppRoutes.driverTrips),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _QuickNavButton(
                            icon:  Icons.book_outlined,
                            label: 'Bookings',
                            onTap: () =>
                                context.push(AppRoutes.driverBookings),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _QuickNavButton(
                            icon:  Icons.fingerprint,
                            label: 'Attendance',
                            onTap: () =>
                                context.push(AppRoutes.attendance),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _QuickNavButton(
                            icon:  Icons.person_outline,
                            label: 'Profile',
                            onTap: () =>
                                context.push(AppRoutes.driverProfile),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // ── Upcoming trips header ─────────────────────────────
                    Row(
                      children: [
                        Text(
                          'Upcoming Trips',
                          style: Theme.of(context)
                              .textTheme
                              .titleMedium
                              ?.copyWith(fontWeight: FontWeight.bold),
                        ),
                        const Spacer(),
                        TextButton(
                          onPressed: () =>
                              context.push(AppRoutes.driverTrips),
                          child: const Text('See All'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            // ── Upcoming trips ──────────────────────────────────────────
            upcoming.when(
              loading: () => const SliverToBoxAdapter(
                child: Center(
                  child: Padding(
                    padding: EdgeInsets.all(24),
                    child: CircularProgressIndicator(),
                  ),
                ),
              ),
              error: (_, __) =>
                  const SliverToBoxAdapter(child: SizedBox()),
              data: (trips) => trips.isEmpty
                  ? const SliverToBoxAdapter(child: SizedBox())
                  : SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (ctx, i) => TripCard(
                          trip:    trips[i],
                          compact: true,
                          onTap:   () => context.push(
                              AppRoutes.tripDetail(trips[i].id)),
                        ),
                        childCount: trips.length > 3 ? 3 : trips.length,
                      ),
                    ),
            ),

            // ── Next bookings header ──────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: Row(
                  children: [
                    Text(
                      'Next Bookings',
                      style: Theme.of(context)
                          .textTheme
                          .titleMedium
                          ?.copyWith(fontWeight: FontWeight.bold),
                    ),
                    const Spacer(),
                    TextButton(
                      onPressed: () =>
                          context.push(AppRoutes.driverBookings),
                      child: const Text('See All'),
                    ),
                  ],
                ),
              ),
            ),

            // ── Next bookings ─────────────────────────────────────────────
            nextBookings.when(
              loading: () => const SliverToBoxAdapter(child: SizedBox()),
              error: (_, __) =>
                  const SliverToBoxAdapter(child: SizedBox()),
              data: (bookings) => bookings.isEmpty
                  ? const SliverToBoxAdapter(child: SizedBox())
                  : SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (ctx, i) => BookingCard(
                          booking: bookings[i],
                          compact: true,
                          onTap:   () => context.push(
                              AppRoutes.bookingDetail(bookings[i].id)),
                        ),
                        childCount:
                            bookings.length > 3 ? 3 : bookings.length,
                      ),
                    ),
            ),

            const SliverToBoxAdapter(child: SizedBox(height: 32)),
          ],
        ),
      ),
    );
  }

  Future<void> _logout(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title:   const Text('Log Out?'),
        content: const Text('You will return to the login screen.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Log Out')),
        ],
      ),
    );
    if (ok == true) ref.read(authProvider.notifier).logout();
  }
}

// ── Attendance card ───────────────────────────────────────────────────────────

class _AttendanceCard extends StatelessWidget {
  const _AttendanceCard({required this.state, required this.ref});
  final AttendanceState state;
  final WidgetRef       ref;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    // Loading
    if (state is AttendanceInitial || state is AttendanceLoading) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              const Icon(Icons.fingerprint),
              const SizedBox(width: 12),
              Text('Loading attendance…',
                  style: theme.textTheme.bodyMedium),
            ],
          ),
        ),
      );
    }

    // Extract record from all states
    final record = switch (state) {
      AttendanceLoaded(:final record)        => record,
      AttendanceSubmitting(:final current)   => current,
      AttendanceError(:final record)         => record,
      _                                      => null,
    };

    final isSubmitting = state is AttendanceSubmitting;

    return Card(
      child: InkWell(
        onTap: () => context.push(AppRoutes.attendance),
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Title row ──────────────────────────────────────────────
              Row(
                children: [
                  const Icon(Icons.fingerprint, size: 20),
                  const SizedBox(width: 8),
                  Text('Attendance',
                      style: theme.textTheme.titleSmall
                          ?.copyWith(fontWeight: FontWeight.bold)),
                  const Spacer(),
                  _StatusDot(record: record),
                ],
              ),
              const SizedBox(height: 12),

              // ── Times row ─────────────────────────────────────────────
              if (record != null) ...[
                Row(
                  children: [
                    _MiniTime(
                      icon:  Icons.login_outlined,
                      label: 'In',
                      value: record.checkIn ?? '—',
                      color: theme.colorScheme.primary,
                    ),
                    const SizedBox(width: 24),
                    _MiniTime(
                      icon:  Icons.logout_outlined,
                      label: 'Out',
                      value: record.checkOut ?? '—',
                      color: record.isCheckedOut
                          ? theme.colorScheme.error
                          : theme.colorScheme.onSurfaceVariant,
                    ),
                    if (record.workingHours != null) ...[
                      const SizedBox(width: 24),
                      _MiniTime(
                        icon:  Icons.timer_outlined,
                        label: 'Hours',
                        value: record.workingHours!,
                        color: Colors.green.shade700,
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 12),
              ],

              // ── Quick action button ────────────────────────────────────
              _QuickAction(
                record:       record,
                isSubmitting: isSubmitting,
                onCheckIn:    () =>
                    ref.read(todayAttendanceProvider.notifier).checkIn(),
                onCheckOut:   () =>
                    ref.read(todayAttendanceProvider.notifier).checkOut(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatusDot extends StatelessWidget {
  const _StatusDot({required this.record});
  // ignore: avoid_annotating_with_dynamic
  final dynamic record;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final (color, label) = record == null
        ? (theme.colorScheme.onSurfaceVariant, 'Not checked in')
        : record.isComplete
            ? (Colors.green.shade600, 'Complete')
            : record.isWorking
                ? (theme.colorScheme.primary, 'Working')
                : (theme.colorScheme.onSurfaceVariant, 'Not checked in');

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8, height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(label,
            style: theme.textTheme.bodySmall?.copyWith(color: color)),
      ],
    );
  }
}

class _MiniTime extends StatelessWidget {
  const _MiniTime({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });
  final IconData icon;
  final String   label, value;
  final Color    color;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            )),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 12, color: color),
            const SizedBox(width: 3),
            Text(value,
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: color,
                  fontSize: 13,
                )),
          ],
        ),
      ],
    );
  }
}

class _QuickAction extends StatelessWidget {
  const _QuickAction({
    required this.record,
    required this.isSubmitting,
    required this.onCheckIn,
    required this.onCheckOut,
  });
  // ignore: avoid_annotating_with_dynamic
  final dynamic      record;
  final bool         isSubmitting;
  final VoidCallback onCheckIn;
  final VoidCallback onCheckOut;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (isSubmitting) {
      return const SizedBox(
        height: 36,
        child: Center(
          child: SizedBox(
            height: 18, width: 18,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      );
    }

    if (record != null && record.isComplete) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color:        theme.colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          '✓ Day Complete',
          textAlign: TextAlign.center,
          style: TextStyle(
            color:      Colors.green.shade700,
            fontWeight: FontWeight.bold,
            fontSize:   13,
          ),
        ),
      );
    }

    if (record != null && record.isWorking) {
      return SizedBox(
        width: double.infinity,
        child: OutlinedButton.icon(
          onPressed: onCheckOut,
          icon:  const Icon(Icons.logout_outlined, size: 16),
          label: const Text('Check Out'),
          style: OutlinedButton.styleFrom(
            foregroundColor: theme.colorScheme.error,
            side: BorderSide(color: theme.colorScheme.error),
            padding: const EdgeInsets.symmetric(vertical: 10),
          ),
        ),
      );
    }

    return SizedBox(
      width: double.infinity,
      child: FilledButton.icon(
        onPressed: onCheckIn,
        icon:  const Icon(Icons.login_outlined, size: 16),
        label: const Text('Check In'),
        style: FilledButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 10),
        ),
      ),
    );
  }
}

// ── Shared sub-widgets ────────────────────────────────────────────────────────

class _Header extends StatelessWidget {
  const _Header({
    required this.name,
    required this.initials,
    this.photoUrl,
    this.status,
  });
  final String  name, initials;
  final String? photoUrl, status;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end:   Alignment.bottomRight,
          colors: [
            theme.colorScheme.primary,
            theme.colorScheme.primaryContainer,
          ],
        ),
      ),
      padding: EdgeInsets.fromLTRB(
          20, MediaQuery.of(context).padding.top + 56, 20, 16),
      child: Row(
        children: [
          CircleAvatar(
            radius:          28,
            backgroundColor: Colors.white24,
            backgroundImage:
                photoUrl != null ? NetworkImage(photoUrl!) : null,
            child: photoUrl == null
                ? Text(initials,
                    style: const TextStyle(
                        color:      Colors.white,
                        fontSize:   20,
                        fontWeight: FontWeight.bold))
                : null,
          ),
          const SizedBox(width: 16),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize:       MainAxisSize.min,
            children: [
              Text(_greeting(),
                  style: const TextStyle(
                      color: Colors.white70, fontSize: 13)),
              Text(name,
                  style: const TextStyle(
                      color:      Colors.white,
                      fontSize:   18,
                      fontWeight: FontWeight.bold)),
              if (status != null)
                Container(
                  margin: const EdgeInsets.only(top: 4),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                      color:        Colors.white24,
                      borderRadius: BorderRadius.circular(10)),
                  child: Text(status!.toUpperCase(),
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          letterSpacing: 1)),
                ),
            ],
          ),
        ],
      ),
    );
  }

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good Morning,';
    if (h < 17) return 'Good Afternoon,';
    return 'Good Evening,';
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
    this.onTap,
  });
  final IconData      icon;
  final String        label, value;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: theme.colorScheme.primary),
              const SizedBox(height: 8),
              Text(value,
                  style: theme.textTheme.headlineMedium
                      ?.copyWith(fontWeight: FontWeight.bold)),
              Text(label,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  )),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuickNavButton extends StatelessWidget {
  const _QuickNavButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final IconData     icon;
  final String       label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color:        theme.colorScheme.secondaryContainer,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap:        onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon,
                  color: theme.colorScheme.onSecondaryContainer,
                  size: 20),
              const SizedBox(height: 4),
              Text(
                label,
                style: theme.textTheme.bodySmall?.copyWith(
                  color:      theme.colorScheme.onSecondaryContainer,
                  fontWeight: FontWeight.w600,
                  fontSize:   10,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── GPS Status Card ───────────────────────────────────────────────────────────

class _GpsStatusCard extends ConsumerStatefulWidget {
  const _GpsStatusCard();

  @override
  ConsumerState<_GpsStatusCard> createState() => _GpsStatusCardState();
}

class _GpsStatusCardState extends ConsumerState<_GpsStatusCard> {
  final _locationService = LocationService();
  LocationStatus _status = LocationStatus.unknown;
  String?        _position;
  bool           _loading = false;

  @override
  void initState() {
    super.initState();
    _checkStatus();
  }

  Future<void> _checkStatus() async {
    final s = await _locationService.getStatus();
    if (mounted) setState(() => _status = s);
  }

  Future<void> _requestAndFix() async {
    setState(() => _loading = true);
    try {
      if (_status == LocationStatus.permanentlyDenied ||
          _status == LocationStatus.gpsDisabled) {
        await _locationService.openSettings();
        await _checkStatus();
        return;
      }

      final s = await _locationService.requestPermission();
      setState(() => _status = s);
      if (!s.isGranted) return;

      final pos = await _locationService.getCurrentPosition();
      if (mounted) {
        setState(() {
          _position =
              '${pos.latitude.toStringAsFixed(5)}, ${pos.longitude.toStringAsFixed(5)}';
        });
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final track = ref.watch(gpsTrackingProvider);
    final trackingLive = track.status == GpsTrackingStatus.active ||
        track.status == GpsTrackingStatus.paused;
    final (color, icon) = switch (_status) {
      LocationStatus.granted           => (Colors.green.shade600, Icons.gps_fixed),
      LocationStatus.denied            => (theme.colorScheme.error, Icons.gps_off),
      LocationStatus.permanentlyDenied => (theme.colorScheme.error, Icons.location_off),
      LocationStatus.gpsDisabled       => (Colors.orange.shade700, Icons.location_disabled),
      LocationStatus.unknown           => (theme.colorScheme.onSurfaceVariant, Icons.gps_not_fixed),
    };

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Live trip-tracking banner (Day 47) ─────────────────────
            if (trackingLive && track.context != null) ...[
              InkWell(
                borderRadius: BorderRadius.circular(10),
                onTap: () => context.push(
                    AppRoutes.tripMap(track.context!.tripId)),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: track.temporarilyOffline
                        ? Colors.orange.shade50
                        : Colors.green.shade50,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: track.temporarilyOffline
                          ? Colors.orange.shade300
                          : Colors.green.shade200,
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        track.temporarilyOffline
                            ? Icons.cloud_off
                            : Icons.track_changes,
                        size: 18,
                        color: track.temporarilyOffline
                            ? Colors.orange.shade800
                            : Colors.green.shade700,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Trip tracking '
                          '${track.status == GpsTrackingStatus.paused ? 'paused' : 'active'}'
                          ' · ${track.routePoints.length} points',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                            color: track.temporarilyOffline
                                ? Colors.orange.shade900
                                : Colors.green.shade800,
                          ),
                        ),
                      ),
                      Text(
                        'View Map',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Theme.of(context).colorScheme.primary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 10),
            ],
            Row(
              children: [
                Icon(icon, color: color, size: 18),
                const SizedBox(width: 8),
                Text(
                  'GPS — ${_status.label}',
                  style: theme.textTheme.titleSmall
                      ?.copyWith(fontWeight: FontWeight.bold),
                ),
                const Spacer(),
                if (_loading)
                  const SizedBox(
                    height: 16, width: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                else
                  TextButton(
                    onPressed: _requestAndFix,
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 4),
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: Text(
                      _status.isGranted ? 'Refresh' :
                      _status.isPermanent || _status.isGpsDisabled
                          ? 'Open Settings'
                          : 'Enable',
                    ),
                  ),
              ],
            ),
            if (_position != null) ...[
              const SizedBox(height: 6),
              Row(
                children: [
                  Icon(Icons.my_location,
                      size: 13,
                      color: theme.colorScheme.onSurfaceVariant),
                  const SizedBox(width: 4),
                  Text(
                    _position!,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color:      theme.colorScheme.onSurfaceVariant,
                      fontFamily: 'monospace',
                    ),
                  ),
                ],
              ),
            ] else if (_status == LocationStatus.denied) ...[
              const SizedBox(height: 6),
              Text(
                'Location is needed to track your trips.',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ] else if (_status == LocationStatus.permanentlyDenied) ...[
              const SizedBox(height: 6),
              Text(
                'Permission blocked. Open Settings → Location → Allow.',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.error,
                ),
              ),
            ] else if (_status == LocationStatus.gpsDisabled) ...[
              const SizedBox(height: 6),
              Text(
                'GPS is turned off. Enable it in device settings.',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: Colors.orange.shade700,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

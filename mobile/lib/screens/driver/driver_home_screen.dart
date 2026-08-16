// ─────────────────────────────────────────────────────────────────────────────
// driver_home_screen.dart — Day 44 (adds bookings section + quick nav)
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../providers/auth_provider.dart';
import '../../providers/trip_provider.dart';
import '../../providers/booking_provider.dart';
import '../../navigation/app_router.dart';
import '../../widgets/driver/trip_card.dart';
import '../../widgets/driver/booking_card.dart';

class DriverHomeScreen extends ConsumerWidget {
  const DriverHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final driver  = ref.watch(currentDriverProvider);
    final profile = ref.watch(currentProfileProvider);

    final todayCount    = ref.watch(todayTripCountProvider);
    final bookingCount  = ref.watch(activeBookingCountProvider);
    final upcoming      = ref.watch(upcomingTripsProvider);
    final nextBookings  = ref.watch(upcomingBookingsProvider);

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(todayTripCountProvider);
          ref.invalidate(activeBookingCountProvider);
          ref.invalidate(upcomingTripsProvider);
          ref.invalidate(upcomingBookingsProvider);
          await Future.delayed(const Duration(milliseconds: 400));
        },
        child: CustomScrollView(
          slivers: [
            // ── App Bar ──────────────────────────────────────────────────
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

            // ── Date + stats ──────────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      DateFormat('EEEE, d MMMM yyyy').format(DateTime.now()),
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: 16),

                    // ── Stat cards ────────────────────────────────────────
                    Row(
                      children: [
                        Expanded(
                          child: _StatCard(
                            icon:  Icons.today_outlined,
                            label: "Today's Trips",
                            value: todayCount.when(
                              data: (c) => '$c', loading: () => '…',
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
                              data: (c) => '$c', loading: () => '…',
                              error: (_, __) => '–',
                            ),
                            onTap: () =>
                                context.push(AppRoutes.driverBookings),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // ── Quick nav row ─────────────────────────────────────
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
                          onPressed: () => context.push(AppRoutes.driverTrips),
                          child: const Text('See All'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            // ── Upcoming trips ────────────────────────────────────────────
            upcoming.when(
              loading: () => const SliverToBoxAdapter(
                child: Center(
                  child: Padding(
                    padding: EdgeInsets.all(24),
                    child: CircularProgressIndicator(),
                  ),
                ),
              ),
              error: (_, __) => const SliverToBoxAdapter(child: SizedBox()),
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

            // ── Next bookings list ────────────────────────────────────────
            nextBookings.when(
              loading: () => const SliverToBoxAdapter(
                child: Center(
                  child: Padding(
                    padding: EdgeInsets.all(24),
                    child: CircularProgressIndicator(),
                  ),
                ),
              ),
              error: (_, __) => const SliverToBoxAdapter(child: SizedBox()),
              data: (bookings) => bookings.isEmpty
                  ? SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Text(
                          'No upcoming bookings.',
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Theme.of(context).colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ),
                    )
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

// ── Sub-widgets ───────────────────────────────────────────────────────────────

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
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.bold))
                : null,
          ),
          const SizedBox(width: 16),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize:       MainAxisSize.min,
            children: [
              Text(_greeting(),
                  style:
                      const TextStyle(color: Colors.white70, fontSize: 13)),
              Text(name,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
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
                  size: 22),
              const SizedBox(height: 4),
              Text(
                label,
                style: theme.textTheme.bodySmall?.copyWith(
                  color:      theme.colorScheme.onSecondaryContainer,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

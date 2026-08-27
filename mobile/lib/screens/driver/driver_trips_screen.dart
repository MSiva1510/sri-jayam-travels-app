// ─────────────────────────────────────────────────────────────────────────────
// driver_trips_screen.dart
// Today's trips list for the authenticated driver.
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../providers/trip_provider.dart';
import '../../navigation/app_router.dart';
import '../../widgets/driver/trip_card.dart';

class DriverTripsScreen extends ConsumerStatefulWidget {
  const DriverTripsScreen({super.key});

  @override
  ConsumerState<DriverTripsScreen> createState() => _DriverTripsScreenState();
}

class _DriverTripsScreenState extends ConsumerState<DriverTripsScreen> {
  @override
  void initState() {
    super.initState();
    // Trigger load on first visit
    Future.microtask(() => ref.read(todayTripsProvider.notifier).load());
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(todayTripsProvider);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text("Today's Trips"),
            Text(
              DateFormat('EEEE, d MMMM').format(DateTime.now()),
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: () => ref.read(todayTripsProvider.notifier).refresh(),
          ),
        ],
      ),
      body: switch (state) {
        TripListInitial() || TripListLoading() => const _LoadingState(),

        TripListRefreshing(:final previous) => _TripList(
            trips:       previous,
            isRefreshing: true,
            onRefresh:   () => ref.read(todayTripsProvider.notifier).refresh(),
            onTripTap:   (id) => context.push(AppRoutes.tripDetail(id)),
          ),

        TripListLoaded(:final trips) => _TripList(
            trips:     trips,
            onRefresh: () => ref.read(todayTripsProvider.notifier).refresh(),
            onTripTap: (id) => context.push(AppRoutes.tripDetail(id)),
          ),

        TripListEmpty() => _EmptyState(
            onRefresh: () => ref.read(todayTripsProvider.notifier).refresh(),
          ),

        TripListError(:final message) => _ErrorState(
            message:   message,
            onRetry:   () => ref.read(todayTripsProvider.notifier).refresh(),
          ),
      },
    );
  }
}

// ── Sub-widgets ───────────────────────────────────────────────────────────────

class _TripList extends StatelessWidget {
  const _TripList({
    required this.trips,
    required this.onRefresh,
    required this.onTripTap,
    this.isRefreshing = false,
  });

  final List trips;
  final Future<void> Function() onRefresh;
  final void Function(String id) onTripTap;
  final bool isRefreshing;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: Stack(
        children: [
          ListView.builder(
            padding: const EdgeInsets.symmetric(vertical: 8),
            itemCount: trips.length,
            itemBuilder: (ctx, i) => TripCard(
              trip:  trips[i],
              onTap: () => onTripTap(trips[i].id),
            ),
          ),
          if (isRefreshing)
            const Positioned(
              top: 0, left: 0, right: 0,
              child: LinearProgressIndicator(),
            ),
        ],
      ),
    );
  }
}

class _LoadingState extends StatelessWidget {
  const _LoadingState();

  @override
  Widget build(BuildContext context) => const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('Loading your trips…'),
          ],
        ),
      );
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.onRefresh});
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return RefreshIndicator(
      onRefresh: () async => onRefresh(),
      child: ListView(
        children: [
          SizedBox(
            height: MediaQuery.of(context).size.height * 0.6,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.event_busy_outlined,
                    size: 72,
                    color: theme.colorScheme.onSurfaceVariant),
                const SizedBox(height: 16),
                Text(
                  'No trips scheduled today',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Pull down to check for updates.',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cloud_off_outlined,
                size: 64, color: theme.colorScheme.error),
            const SizedBox(height: 16),
            Text(
              message,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyLarge,
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: onRetry,
              icon:  const Icon(Icons.refresh),
              label: const Text('Try Again'),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// trip_details_screen.dart
// Full trip details for the driver. Shows only driver-appropriate fields.
// base_fare / total_fare are NOT fetched or displayed.
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../models/trip.dart';
import '../../providers/trip_provider.dart';

class TripDetailsScreen extends ConsumerWidget {
  const TripDetailsScreen({super.key, required this.tripId});
  final String tripId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(tripDetailProvider(tripId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Trip Details'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.read(tripDetailProvider(tripId).notifier).refresh(),
          ),
        ],
      ),
      body: switch (state) {
        TripDetailLoading() => const Center(child: CircularProgressIndicator()),
        TripDetailError(:final message) => _ErrorState(message: message),
        TripDetailLoaded(:final trip) => _TripDetail(trip: trip),
      },
    );
  }
}

// ── Full detail view ──────────────────────────────────────────────────────────

class _TripDetail extends StatelessWidget {
  const _TripDetail({required this.trip});
  final TripModel trip;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async {},
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── Status banner ──────────────────────────────────────────────
          _StatusBanner(status: trip.status),
          const SizedBox(height: 16),

          // ── Trip reference ─────────────────────────────────────────────
          _Section(
            icon: Icons.confirmation_number_outlined,
            title: 'Booking Reference',
            children: [
              _DetailRow('Booking No.', trip.bookingNumber ?? trip.bookingId ?? '—'),
              _DetailRow('Trip Type', trip.tripTypeLabel),
              if (trip.startDate != null)
                _DetailRow(
                  'Date',
                  DateFormat('EEEE, d MMMM yyyy').format(trip.startDate!),
                ),
              if (trip.startTime != null)
                _DetailRow('Pickup Time', trip.displayTime),
              if (trip.endDate != null)
                _DetailRow(
                  'Return Date',
                  DateFormat('d MMM yyyy').format(trip.endDate!),
                ),
            ],
          ),
          const SizedBox(height: 12),

          // ── Route ─────────────────────────────────────────────────────
          _Section(
            icon: Icons.route_outlined,
            title: 'Route',
            children: [
              _LocationRow(
                icon: Icons.trip_origin,
                color: Theme.of(context).colorScheme.primary,
                label: 'Pickup',
                value: trip.pickupLocation ?? '—',
              ),
              const SizedBox(height: 8),
              _LocationRow(
                icon: Icons.location_on,
                color: Theme.of(context).colorScheme.error,
                label: 'Drop-off',
                value: trip.dropLocation ?? '—',
              ),
              if (trip.totalKm != null) ...[
                const Divider(height: 20),
                _DetailRow(
                  'Distance',
                  '${trip.totalKm!.toStringAsFixed(1)} km',
                ),
              ],
            ],
          ),
          const SizedBox(height: 12),

          // ── Customer ──────────────────────────────────────────────────
          _Section(
            icon: Icons.person_outline,
            title: 'Customer',
            children: [
              _DetailRow('Name', trip.customerName ?? '—'),
              if (trip.customerContact != null)
                _PhoneRow(phone: trip.customerContact!),
            ],
          ),
          const SizedBox(height: 12),

          // ── Vehicle ───────────────────────────────────────────────────
          if (trip.vehicleReg != null)
            _Section(
              icon: Icons.directions_car_outlined,
              title: 'Vehicle',
              children: [
                _DetailRow('Registration', trip.vehicleReg!),
              ],
            ),

          // ── Extra stops from type_data ────────────────────────────────
          if (_hasStops(trip)) ...[
            const SizedBox(height: 12),
            _StopsSection(typeData: trip.typeData!),
          ],

          // ── Notes ─────────────────────────────────────────────────────
          if (trip.notes != null && trip.notes!.trim().isNotEmpty) ...[
            const SizedBox(height: 12),
            _Section(
              icon: Icons.notes_outlined,
              title: 'Notes',
              children: [
                Text(
                  trip.notes!,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ],

          const SizedBox(height: 32),
        ],
      ),
    );
  }

  bool _hasStops(TripModel t) =>
      t.typeData != null &&
      t.typeData!['stops'] is List &&
      (t.typeData!['stops'] as List).isNotEmpty;
}

// ── Section wrapper ───────────────────────────────────────────────────────────

class _Section extends StatelessWidget {
  const _Section({
    required this.icon,
    required this.title,
    required this.children,
  });
  final IconData     icon;
  final String       title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 18, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: theme.textTheme.titleSmall?.copyWith(
                    color:      theme.colorScheme.primary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const Divider(height: 20),
            ...children,
          ],
        ),
      ),
    );
  }
}

// ── Row widgets ───────────────────────────────────────────────────────────────

class _DetailRow extends StatelessWidget {
  const _DetailRow(this.label, this.value);
  final String label, value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PhoneRow extends StatelessWidget {
  const _PhoneRow({required this.phone});
  final String phone;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(
            width: 110,
            child: Text(
              'Contact',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ),
          Expanded(
            child: Text(
              phone,
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.copy, size: 16),
            tooltip: 'Copy number',
            onPressed: () {
              Clipboard.setData(ClipboardData(text: phone));
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Phone number copied'),
                  duration: Duration(seconds: 2),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _LocationRow extends StatelessWidget {
  const _LocationRow({
    required this.icon,
    required this.color,
    required this.label,
    required this.value,
  });
  final IconData icon;
  final Color    color;
  final String   label, value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 20, color: color),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              Text(
                value,
                style: theme.textTheme.bodyLarge?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _StopsSection extends StatelessWidget {
  const _StopsSection({required this.typeData});
  final Map<String, dynamic> typeData;

  @override
  Widget build(BuildContext context) {
    final stops = (typeData['stops'] as List).cast<String>();
    return _Section(
      icon: Icons.stop_circle_outlined,
      title: 'Stops (${stops.length})',
      children: stops
          .asMap()
          .entries
          .map((e) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 10,
                      backgroundColor:
                          Theme.of(context).colorScheme.primaryContainer,
                      child: Text(
                        '${e.key + 1}',
                        style: TextStyle(
                          fontSize: 11,
                          color: Theme.of(context).colorScheme.onPrimaryContainer,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(child: Text(e.value)),
                  ],
                ),
              ))
          .toList(),
    );
  }
}

class _StatusBanner extends StatelessWidget {
  const _StatusBanner({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final (bg, fg, icon, label) = switch (status) {
      'assigned'  => (theme.colorScheme.primaryContainer,
                      theme.colorScheme.onPrimaryContainer,
                      Icons.assignment_ind_outlined, 'Assigned'),
      'started'   => (const Color(0xFFE8F5E9), const Color(0xFF1B5E20),
                      Icons.play_circle_outline, 'In Progress'),
      'completed' => (theme.colorScheme.surfaceContainerHighest,
                      theme.colorScheme.onSurfaceVariant,
                      Icons.check_circle_outline, 'Completed'),
      'cancelled' => (theme.colorScheme.errorContainer,
                      theme.colorScheme.onErrorContainer,
                      Icons.cancel_outlined, 'Cancelled'),
      _           => (theme.colorScheme.surfaceContainerHighest,
                      theme.colorScheme.onSurfaceVariant,
                      Icons.info_outline, status),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: bg, borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(icon, color: fg, size: 20),
          const SizedBox(width: 10),
          Text(
            label,
            style: TextStyle(
              color: fg, fontWeight: FontWeight.bold, fontSize: 15,
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, size: 64, color: theme.colorScheme.error),
            const SizedBox(height: 16),
            Text(message, textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}
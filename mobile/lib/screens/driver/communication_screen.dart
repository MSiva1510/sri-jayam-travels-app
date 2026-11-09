// ─────────────────────────────────────────────────────────────────────────────
// communication_screen.dart
// Driver communication hub. Provider-independent: all delivery goes through
// CommunicationService → backend (Edge Function) → external provider.
//
// WhatsApp is NOT configured on the backend yet, so the tile shows an honest
// "coming soon" state — never a fake success.
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../navigation/app_router.dart';
import '../../providers/auth_provider.dart';
import '../../services/communication_service.dart';

final communicationServiceProvider = Provider<CommunicationService>(
  (ref) => const CommunicationService(),
);

class CommunicationScreen extends ConsumerWidget {
  const CommunicationScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final driver = ref.watch(currentDriverProvider);
    final comm = ref.watch(communicationServiceProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Messages')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── In-app notifications shortcut ───────────────────────────────
          Card(
            margin: EdgeInsets.zero,
            child: ListTile(
              leading: Icon(
                Icons.notifications_outlined,
                color: theme.colorScheme.primary,
              ),
              title: const Text('Notifications'),
              subtitle:
                  const Text('Trip & booking updates from the office'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push(AppRoutes.driverNotifications),
            ),
          ),
          const SizedBox(height: 12),

          // ── WhatsApp ────────────────────────────────────────────────────
          _WhatsAppTile(ready: comm.whatsAppReady),
          const SizedBox(height: 12),

          // ── Office contact (real driver record data only) ──────────────
          Card(
            margin: EdgeInsets.zero,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.support_agent_outlined,
                          size: 18, color: theme.colorScheme.primary),
                      const SizedBox(width: 8),
                      Text(
                        'Office Contact',
                        style: theme.textTheme.titleSmall?.copyWith(
                          color: theme.colorScheme.primary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const Divider(height: 20),
                  Text(
                    'For trip changes or emergencies contact your '
                    'fleet manager directly.',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                  if (driver?.phone != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      'Your registered number: ${driver!.phone}',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),

          const SizedBox(height: 24),
          Text(
            'WhatsApp, SMS and push channels will be enabled by your '
            'administrator once the delivery provider is configured.',
            textAlign: TextAlign.center,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

// ── WhatsApp tile ─────────────────────────────────────────────────────────────

class _WhatsAppTile extends ConsumerWidget {
  const _WhatsAppTile({required this.ready});
  final bool ready;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);

    return Card(
      margin: EdgeInsets.zero,
      child: ListTile(
        leading: ready
            ? Icon(Icons.chat_outlined, color: Colors.green.shade700)
            : Icon(Icons.hourglass_empty_rounded,
                color: theme.colorScheme.onSurfaceVariant),
        title: const Text('WhatsApp'),
        subtitle: Text(
          ready ? 'Send trip updates via WhatsApp' : 'Coming soon',
          style: TextStyle(
            color: ready
                ? theme.colorScheme.onSurfaceVariant
                : theme.colorScheme.onSurfaceVariant.withValues(alpha: 0.7),
          ),
        ),
        trailing: ready
            ? const Icon(Icons.chevron_right)
            : Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: theme.colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  'SOON',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1,
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ),
        onTap: () async {
          final result = await ref
              .read(communicationServiceProvider)
              .sendWhatsApp(templateKey: 'driver_generic');
          if (!result.delivered && context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: Text(switch (result) {
                CommunicationNotConfigured(:final userMessage) => userMessage,
                CommunicationFailed(:final userMessage) => userMessage,
                _ => 'Message could not be sent.',
              }),
            ));
          }
        },
      ),
    );
  }
}

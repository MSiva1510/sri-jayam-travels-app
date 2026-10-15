// ─────────────────────────────────────────────────────────────────────────────
// sos_action.dart — SOS hold-to-confirm + dispatch contact.
// HOLD TO SEND triggers a WhatsApp SOS through the backend provider
// (honest result handling — never fakes a send). CALL OPS dials the
// operations desk via url_launcher.
//
// TODO(settings): move kOpsPhone into app settings so dispatch can change
// it without a release.
// ─────────────────────────────────────────────────────────────────────────────

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../navigation/app_router.dart';
import '../../services/communication_service.dart';

/// Operations desk number (fallback until the settings screen owns it).
const kOpsPhone = '+919442337470';

final _commServiceProvider = Provider<CommunicationService>((ref) {
  // Mirrors the construction used by the communication screen.
  return CommunicationService();
});

/// Big red SOS button (Home) or compact variant. Opens the SOS sheet.
class SosButton extends StatelessWidget {
  const SosButton({super.key, this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: FilledButton(
        onPressed: () => showSosSheet(context),
        style: FilledButton.styleFrom(
          backgroundColor: compact
              ? Theme.of(context).colorScheme.error
              : Colors.transparent,
          foregroundColor:
              compact ? Colors.white : Theme.of(context).colorScheme.error,
          side: compact
              ? BorderSide.none
              : BorderSide(color: Theme.of(context).colorScheme.error),
          padding: EdgeInsets.symmetric(vertical: compact ? 14 : 18),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
        child: const Text('SOS',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
      ),
    );
  }
}

/// Bottom sheet: hold-to-send + call ops.
Future<void> showSosSheet(BuildContext context) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => const _SosSheet(),
  );
}

class _SosSheet extends ConsumerStatefulWidget {
  const _SosSheet();

  @override
  ConsumerState<_SosSheet> createState() => _SosSheetState();
}

class _SosSheetState extends ConsumerState<_SosSheet> {
  double _hold = 0; // 0..1
  Timer? _timer;
  bool _sending = false;
  String? _result;

  void _startHold() {
    _timer?.cancel();
    const step = Duration(milliseconds: 50);
    _timer = Timer.periodic(step, (t) {
      setState(() => _hold += 50 / 1500);
      if (_hold >= 1) {
        t.cancel();
        _send();
      }
    });
  }

  void _cancelHold() {
    _timer?.cancel();
    if (!_sending) setState(() => _hold = 0);
  }

  Future<void> _send() async {
    if (_sending) return;
    setState(() {
      _sending = true;
      _result = null;
    });
    final res = await ref.read(_commServiceProvider).sendWhatsApp(
      templateKey: 'sos_alert',
      variables: const {'channel': 'driver_app'},
    );
    if (!mounted) return;
    setState(() {
      _sending = false;
      _result = switch (res) {
        CommunicationSent() =>
          'SOS sent to dispatch.',
        CommunicationNotConfigured(:final userMessage) => userMessage,
        CommunicationFailed(:final userMessage) => userMessage,
      };
    });
  }

  Future<void> _callOps() async {
    final uri = Uri(scheme: 'tel', path: kOpsPhone);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not place the call. Dial ops: $kOpsPhone')),
      );
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: theme.colorScheme.outlineVariant,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 16),
            const Text('SOS',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text(
              'Hold 3 s · sends driver, vehicle, trip and location to ops',
              style: theme.textTheme.bodySmall,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onLongPressStart: (_) => _startHold(),
                    onLongPressEnd: (_) => _cancelHold(),
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        SizedBox(
                          height: 56,
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(14),
                            child: LinearProgressIndicator(
                              value: _hold.clamp(0.0, 1.0),
                              backgroundColor: theme.colorScheme.error,
                              valueColor: const AlwaysStoppedAnimation(
                                  Colors.white24),
                              minHeight: 56,
                            ),
                          ),
                        ),
                        Text(
                          _sending ? 'SENDING…' : 'HOLD TO SEND',
                          style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton(
                    onPressed: _callOps,
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: const Text('CALL OPS',
                        style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
            if (_result != null) ...[
              const SizedBox(height: 12),
              Text(_result!,
                  style: theme.textTheme.bodySmall,
                  textAlign: TextAlign.center),
              const SizedBox(height: 4),
              TextButton(
                onPressed: () {
                  Navigator.pop(context);
                  context.push(AppRoutes.driverCommunication);
                },
                child: const Text('Open dispatch chat instead'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

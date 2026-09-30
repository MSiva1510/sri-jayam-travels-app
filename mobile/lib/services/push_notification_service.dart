// ─────────────────────────────────────────────────────────────────────────────
// push_notification_service.dart — FCM Push + Token Registration (Driver App)
// ─────────────────────────────────────────────────────────────────────────────
// Registers the device FCM token into Supabase `drivers.push_token` so the
// web ERP can broadcast mobile pushes to registered driver apps.
// Requires: firebase_core, firebase_messaging, flutter_local_notifications,
// supabase_flutter (see mobile/FCM_SETUP.md for native setup).

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Background handler — must be top-level with the vm entry-point pragma.
@pragma('vm:entry-point')
Future<void> fcmBackgroundHandler(RemoteMessage message) async {
  // Delivery is confirmed by FCM; no UI work needed here.
}

class PushNotificationService {
  PushNotificationService(this._supabase);

  final SupabaseClient _supabase;
  final FlutterLocalNotificationsPlugin _local =
      FlutterLocalNotificationsPlugin();

  static const AndroidNotificationChannel _channel = AndroidNotificationChannel(
    'sjt_high_importance',
    'Sri Jayam Travels',
    description: 'Trip assignments, payroll and announcements.',
    importance: Importance.high,
  );

  String? _token;
  String? get token => _token;

  /// Initialise FCM, show foreground notifications, register the token.
  /// Call once after driver login with the driver's `driver_id`.
  /// Returns the FCM token, or null when permission is denied.
  Future<String?> initialize({required String driverId}) async {
    if (Firebase.apps.isEmpty) {
      await Firebase.initializeApp();
    }
    FirebaseMessaging.onBackgroundMessage(fcmBackgroundHandler);

    final settings = await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      return null;
    }

    await _local.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      ),
    );
    await _local
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(_channel);

    FirebaseMessaging.onMessage.listen(_showForeground);
    FirebaseMessaging.instance.onTokenRefresh
        .listen((t) => registerToken(driverId: driverId, token: t));

    _token = await FirebaseMessaging.instance.getToken();
    if (_token != null) {
      await registerToken(driverId: driverId, token: _token!);
    }
    await FirebaseMessaging.instance.subscribeToTopic('all_drivers');
    return _token;
  }

  Future<void> _showForeground(RemoteMessage message) async {
    final n = message.notification;
    if (n == null) return;
    await _local.show(
      n.hashCode,
      n.title,
      n.body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _channel.id,
          _channel.name,
          channelDescription: _channel.description,
          importance: Importance.high,
          priority: Priority.high,
        ),
      ),
      payload: message.data['type']?.toString(),
    );
  }

  /// Write (or refresh) this device token for the driver row.
  Future<void> registerToken({
    required String driverId,
    required String token,
  }) async {
    _token = token;
    try {
      final res = await _supabase
          .from('drivers')
          .update({'push_token': token}).eq('driver_id', driverId).select('id');
      if ((res as List).isNotEmpty) return;
      // Fall back to primary-key match for legacy rows.
      await _supabase
          .from('drivers')
          .update({'push_token': token}).eq('id', driverId);
    } catch (_) {
      // Offline — token refreshes on next launch via getToken().
    }
  }

  /// Clear this device token on logout so pushes stop.
  Future<void> unregisterToken({required String driverId}) async {
    _token = null;
    try {
      await _supabase
          .from('drivers')
          .update({'push_token': null}).eq('driver_id', driverId);
    } catch (_) {}
    try {
      await FirebaseMessaging.instance.unsubscribeFromTopic('all_drivers');
    } catch (_) {}
  }
}

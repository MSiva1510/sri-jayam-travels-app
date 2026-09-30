# FCM Setup — Driver Mobile App Push

Web ERP side is done (token column, broadcast service, Settings UI).
This checklist wires the Flutter app and the final server hop.

## 1. Files needed from the Firebase Console (you provide)

1. Create (or open) a Firebase project at https://console.firebase.google.com
2. Add an **Android** app (package name from `android/app/build.gradle`) →
   download **`google-services.json`** → place in `mobile/android/app/`
3. Add an **iOS** app (bundle id from Xcode) →
   download **`GoogleService-Info.plist`** → place in `mobile/ios/Runner/`
   (add to Xcode Runner target)
4. In Firebase → Project Settings → Cloud Messaging: note the **Server key**
   (legacy) — used ONLY by the server sender below, never in the app/repo.

## 2. Flutter dependencies (`mobile/pubspec.yaml`)

```yaml
dependencies:
  firebase_core: ^3.0.0
  firebase_messaging: ^15.0.0
  flutter_local_notifications: ^17.0.0
  supabase_flutter: ^2.0.0
  flutter_riverpod: ^2.5.0
```

Then `flutter pub get`.

## 3. Android native (`mobile/android/`)

- `android/build.gradle`: add `com.google.gms:google-services` classpath.
- `android/app/build.gradle`: apply `com.google.gms.google-services` plugin,
  set `minSdkVersion 21`.
- `AndroidManifest.xml`: permissions `POST_NOTIFICATIONS`, `VIBRATE`,
  `RECEIVE_BOOT_COMPLETED`; service
  `com.google.firebase.MESSAGING_EVENT` is auto-registered by the plugin.

## 4. iOS native (`mobile/ios/`)

- Xcode → Runner → Signing & Capabilities: **Push Notifications** +
  **Background Modes** (remote notifications, background fetch).
- `AppDelegate.swift`: `FirebaseApp.configure()` +
  `UNUserNotificationCenter.current().delegate = self` (firebase_messaging
  docs snippet).
- APNs key (.p8) uploaded in Firebase → Project Settings → Cloud Messaging.

## 5. Dart wiring (already added)

- `lib/services/push_notification_service.dart` — init, foreground display,
  token refresh, `drivers.push_token` registration, logout cleanup.
- `lib/providers/notification_provider.dart` — Riverpod state.
- After driver login call:
  `ref.read(pushNotifierProvider.notifier).initialize(driver.driverId)`
- On logout call `.logout(driver.driverId)`.

## 6. Supabase

- Run `supabase/migrations/20260927_drivers_push_token.sql` once in SQL Editor.
- RLS: drivers table must allow the logged-in driver to update their own
  `push_token` (add policy if reads/writes fail from the app).

## 7. Server-side send (final hop) — implemented, needs deploy

Function: `supabase/functions/send-push/index.ts` (FCM HTTP v1, OAuth2 JWT
grant from the service-account JSON — no external deps).

```bash
# 1. Deploy once
supabase functions deploy send-push --project-ref <your-project-ref>

# 2. Store the service-account JSON as a function secret
#    (Firebase Console → Project Settings → Service accounts → Generate key)
supabase secrets set FCM_SERVICE_ACCOUNT='<paste full service-account JSON>'

# 3. Verify
curl -X POST 'https://<ref>.supabase.co/functions/v1/send-push' \
  -H "apikey: <anon-key>" -H 'Content-Type: application/json' \
  -d '{"tokens":["<test-fcm-token>"],"title":"Test","body":"Hello"}'
```

Web behavior (`broadcastMobilePush` in `src/services/communicationService.js`):
- Edge Function reachable → real FCM delivery, each result logged in
  Comm Logs (`via: edge` in metadata).
- Function missing / secret unset → automatic fallback to the engine push
  channel, which logs failures with the real reason (never fake-delivered).
- Settings shows `sender_not_configured` hint until step 2 is done.

Do NOT paste the service-account JSON into the repo or the app.

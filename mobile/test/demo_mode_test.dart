// ─────────────────────────────────────────────────────────────────────────────
// demo_mode_test.dart — end-to-end demo flow in-widget:
// login screen → demo tap → Home hero → ACCEPT → trip details.
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart' hide AuthState;

import 'package:sri_jayam_travels_mobile/main.dart';

void main() {
  testWidgets('demo mode: login, hero, accept navigation',
      (WidgetTester tester) async {
    TestWidgetsFlutterBinding.ensureInitialized();
    SharedPreferences.setMockInitialValues({});

    await Supabase.initialize(
      url: 'https://example.supabase.co',
      publishableKey: 'test-anon-key',
      authOptions: const FlutterAuthClientOptions(
        autoRefreshToken: false,
      ),
    );

    await tester.pumpWidget(
      const ProviderScope(child: SriJayamApp()),
    );
    await tester.pump(const Duration(seconds: 1));
    await tester.pump(const Duration(seconds: 1));

    // Login screen with the demo entry point.
    expect(find.text('Explore demo (fake data)'), findsOneWidget);

    // Real tap → demo session → router to driver home.
    await tester.tap(find.text('Explore demo (fake data)'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));
    await tester.pump(const Duration(seconds: 1));
    await tester.pump(const Duration(seconds: 1));
    await tester.pump(const Duration(seconds: 1));

    // Home: greeting + NEW TRIP hero + earnings from fixtures.
    expect(find.text('Home'), findsWidgets);
    expect(find.textContaining('NEW TRIP'), findsOneWidget);
    expect(find.textContaining('Pondicherry Rock Beach'), findsWidgets);

    // ACCEPT → trip details screen for TRP-1024.
    await tester.tap(find.text('ACCEPT'));
    await tester.pump(const Duration(seconds: 1));
    await tester.pump(const Duration(seconds: 1));
    expect(find.textContaining('Arun Kumar'), findsWidgets);
  });
}

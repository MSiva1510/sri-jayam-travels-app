// ─────────────────────────────────────────────────────────────────────────────
// main.dart
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'core/config/supabase_config.dart';
import 'screens/splash_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // supabase_flutter v2+ uses the anonKey param (publishableKey in some docs).
  // Both point to the same publishable/anon key — NOT the service-role key.
  await Supabase.initialize(
    url:     SupabaseConfig.url,
    anonKey: SupabaseConfig.anonKey,
  );

  runApp(const ProviderScope(child: SriJayamApp()));
}

class SriJayamApp extends StatelessWidget {
  const SriJayamApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title:                      'Sri Jayam Travels',
      debugShowCheckedModeBanner: false,
      theme:                      _buildTheme(Brightness.light),
      darkTheme:                  _buildTheme(Brightness.dark),
      themeMode:                  ThemeMode.system,
      // SplashScreen checks the current Supabase session on startup and
      // replaces itself with LoginScreen or DriverHomeScreen accordingly.
      home:                       const SplashScreen(),
    );
  }

  ThemeData _buildTheme(Brightness brightness) {
    return ThemeData(
      useMaterial3:    true,
      colorSchemeSeed: const Color(0xFF1565C0),
      brightness:      brightness,
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16, vertical: 16,
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(
            color: brightness == Brightness.dark
                ? Colors.white12
                : Colors.black12,
          ),
        ),
      ),
    );
  }
}

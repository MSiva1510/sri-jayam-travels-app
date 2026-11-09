// ─────────────────────────────────────────────────────────────────────────────
// app_theme_controller.dart — Theme Mode Persistence & Control
// Persists selection locally (UI preference, not business data)
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Theme mode options
enum AppThemeMode {
  system,
  light,
  dark;

  /// Convert to Material ThemeMode
  ThemeMode get materialThemeMode => switch (this) {
        AppThemeMode.system => ThemeMode.system,
        AppThemeMode.light => ThemeMode.light,
        AppThemeMode.dark => ThemeMode.dark,
      };

  /// Display label
  String get label => switch (this) {
        AppThemeMode.system => 'System',
        AppThemeMode.light => 'Light',
        AppThemeMode.dark => 'Dark',
      };

  /// Icon for settings
  IconData get icon => switch (this) {
        AppThemeMode.system => Icons.brightness_auto,
        AppThemeMode.light => Icons.light_mode,
        AppThemeMode.dark => Icons.dark_mode,
      };
}

/// Storage key
const _themeModeKey = 'sjt_theme_mode';

/// Theme controller notifier
class ThemeController extends StateNotifier<AppThemeMode> {
  ThemeController() : super(AppThemeMode.system) {
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(_themeModeKey);
    if (stored != null) {
      state = AppThemeMode.values.byName(stored);
    }
  }

  bool get _isEffectivelyDark {
    if (state == AppThemeMode.dark) return true;
    if (state == AppThemeMode.light) return false;
    // System mode - check platform brightness
    return WidgetsBinding.instance.platformDispatcher.platformBrightness == Brightness.dark;
  }

  Future<void> setThemeMode(AppThemeMode mode) async {
    if (state == mode) return;
    state = mode;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_themeModeKey, mode.name);
  }

  /// Toggle between light/dark (skips system)
  Future<void> toggle() async {
    final modes = [AppThemeMode.light, AppThemeMode.dark];
    final currentIndex = modes.indexOf(state);
    final next = modes[(currentIndex + 1) % modes.length];
    await setThemeMode(next);
  }
}

/// Provider
final themeControllerProvider = StateNotifierProvider<ThemeController, AppThemeMode>((ref) {
  return ThemeController();
});

/// Convenience provider for ThemeMode
final themeModeProvider = Provider<ThemeMode>((ref) {
  return ref.watch(themeControllerProvider).materialThemeMode;
});

/// Watch effective brightness
final effectiveBrightnessProvider = Provider<Brightness>((ref) {
  final mode = ref.watch(themeControllerProvider);
  if (mode == AppThemeMode.dark) return Brightness.dark;
  if (mode == AppThemeMode.light) return Brightness.light;
  // System
  return WidgetsBinding.instance.platformDispatcher.platformBrightness;
});

/// Listen to system brightness changes when in system mode
class _SystemBrightnessListener extends StatefulWidget {
  const _SystemBrightnessListener({required this.child});
  final Widget child;

  @override
  State<_SystemBrightnessListener> createState() => _SystemBrightnessListenerState();
}

class _SystemBrightnessListenerState extends State<_SystemBrightnessListener>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangePlatformBrightness() {
    // Trigger rebuild of providers that depend on effective brightness
    // The providers will automatically recompute
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

/// Wrapper to listen for system brightness changes
Widget withSystemBrightnessListener({required Widget child}) {
  return _SystemBrightnessListener(child: child);
}
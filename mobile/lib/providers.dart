// ─────────────────────────────────────────────────────────────────────────────
// providers.dart — Barrel export for all providers
// ─────────────────────────────────────────────────────────────────────────────

export 'providers/auth_provider.dart' show
    supabaseClientProvider,
    authRepositoryProvider,
    authServiceProvider,
    authProvider,
    isAuthenticatedProvider,
    currentProfileProvider,
    currentDriverProvider;
export 'core/theme/app_theme_controller.dart' show themeControllerProvider;
export 'providers/trip_provider.dart';
export 'providers/booking_provider.dart';
export 'providers/notification_provider.dart';
export 'providers/attendance_provider.dart';
export 'providers/document_provider.dart';
export 'providers/gps_provider.dart';
export 'providers/vehicle_provider.dart';
export 'providers/driver_provider.dart';
export 'providers/alert_provider.dart';
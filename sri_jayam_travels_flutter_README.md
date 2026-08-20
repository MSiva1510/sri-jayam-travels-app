# Sri Jayam Travels Flutter Foundation

This document outlines the foundation for the Sri Jayam Travels Flutter mobile application that will serve as the client for the existing React + Supabase Web ERP.

## Project Structure

```
sri-jayam-travels-flutter/
├── android/
├── ios/
├── lib/
│   ├── core/
│   │   ├── config/
│   │   │   └── supabase_config.dart
│   │   ├── error/
│   │   ├── utils/
│   │   └── extensions/
│   ├── config/
│   │   ├── app_constants.dart
│   │   └── routes.dart
│   ├── models/
│   │   ├── user_profile.dart
│   │   └── driver_profile.dart
│   ├── repositories/
│   │   ├── user_repository.dart
│   │   └── driver_repository.dart
│   ├── services/
│   │   ├── auth_service.dart
│   │   ├── location_service.dart
│   │   └── notification_service.dart
│   ├── providers/
│   │   ├── auth_provider.dart
│   │   ├── user_provider.dart
│   │   └── driver_provider.dart
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── login_screen.dart
│   │   │   └── splash_screen.dart
│   │   ├── driver/
│   │   │   ├── home_screen.dart
│   │   │   └── profile_screen.dart
│   │   └── common/
│   │       └── error_screen.dart
│   ├── widgets/
│   │   ├── common/
│   │   │   ├── app_bar.dart
│   │   │   ├── buttons.dart
│   │   │   └── text_fields.dart
│   │   └── layout/
│   │       ├── responsive_layout.dart
│   │       └── adaptive_layout.dart
│   ├── navigation/
│   │   ├── app_router.dart
│   │   └── route_guard.dart
│   ├── utils/
│   │   ├── validators.dart
│   │   ├── formatters.dart
│   │   └── helpers.dart
│   ├── theme/
│   │   ├── app_theme.dart
│   │   ├── color_scheme.dart
│   │   └── typography.dart
│   └── main.dart
├── test/
├── pubspec.yaml
├── README.md
��── .env.example
```

## Key Implementation Details

### 1. Supabase Configuration
- Initialize Supabase before app startup
- Use environment variables for SUPABASE_URL and SUPABASE_ANON_KEY
- Never hardcode secrets
- Use Supabase Auth for authentication

### 2. Authentication Foundation
- Login/Logout functionality
- Session restore on app start
- Auth state listener
- Profile and role loading
- Loading and error states

### 3. Role-Based Access
- Support for Admin, Manager, Driver roles
- Initial focus on Driver role
- Protected navigation based on roles
- Role validation on protected screens

### 4. State Management
- Using Flutter Riverpod for state management
- Providers for auth, user, and driver data
- Scoped providers for feature-specific state

### 5. Repository Pattern
- Screen → Provider/State → Service → Repository → Supabase
- No direct Supabase calls from UI
- Clean separation of concerns

### 6. Error Handling
- Centralized error handling
- User-friendly error messages
- No exposure of database internals
- Network, auth, supabase, permission, timeout handling

### 7. GPS Foundation
- Prepared interfaces for GPS functionality
- Location service abstraction
- Repository for GPS data
- Ready for live tracking implementation

### 8. Notification Foundation
- Notification service and repository
- Unread count functionality
- Notification list foundation
- Ready for push notification integration

### 9. Offline Foundation
- Interfaces prepared for local cache
- Pending operations queue
- Network status monitoring
- Marked for future implementation

### 10. Security
- No service-role keys in client
- Secure session handling
- Protected navigation with role validation
- Environment-based configuration

## Next Steps (Day 42)
- Implement authentication flow
- Create driver profile screen
- Set up session management
- Test login/logout with Supabase
- Verify protected navigation works
- Ensure driver dashboard foundation loads properly

## Environment Configuration
Create .env file (not committed) with:
```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Success Criteria for Day 41
- �� Flutter project created
- �� Supabase connected (configuration ready)
- �� Login/logout foundation works
- �� Session restore foundation works
- �� Profile loading foundation works
- �� Driver role foundation works
- �� Protected navigation foundation works
- �� Driver dashboard foundation works
- �� No mock business data
- �� No duplicate backend
- �� Repository architecture established
- �� Error handling foundation established
- �� Theme foundation established
- �� GPS foundation prepared
- �� Notification foundation prepared
- �� Offline foundation prepared
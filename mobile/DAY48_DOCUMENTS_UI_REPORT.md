# DAY 48 — Flutter Documents + Camera + UI/Branding Corrections

**Project:** Sri Jayam Travels ERP — Phase 2 (Flutter Driver App)
**Starting commit:** `b6ee7ed` ("day 47")
**Date:** 2026-08-22

---

## Starting Status (recorded before changes)

| Check | Result |
|---|---|
| `flutter pub get` | OK |
| `flutter analyze` | PASS — 3 pre-existing warnings (2× unused `theme`, 1× `body_might_complete_normally_catch_error`) |
| `flutter test` | PASS (1/1) |

No pre-existing errors were hidden — all three pre-existing warnings are now
also fixed as part of the UI cleanup.

## 1. Database Audit (source of truth)

Schema verified from Web ERP source (`src/pages/Documents.jsx`,
`src/repositories/driverRepository.js`, `supabase/migrations/`) — nothing invented:

- **Table `documents`** (reused, NOT duplicated):
  `id` UUID PK, `document_type` (legacy alias), `related_entity` (legacy alias),
  `title`, `category` (`'driver'`), `doc_type` (`license|badge|medical|police_cert|aadhar|bank|other`),
  `status` (snapshot; display recomputes from expiry), `expiry_date` (`YYYY-MM-DD`),
  `reminder_date`, `notes`, `driver_id`, `file_name`, `file_url`, `document_id`, `created_at`.
  Flutter writes BOTH modern and legacy alias columns exactly like the web.
- **Storage bucket `documents`** — the only bucket the Web ERP uses
  (paths like `driver-licenses/<id>-<ts>.jpg`). Flutter path convention:
  `driver-documents/<driverId>/<epochMs>_<safeFileName>`.
- **RLS**: table policies untouched (`documents_app_all` from migration
  `20260810_supabase_app_facing_rls.sql` remains enabled).
- No new tables, no new buckets, no schema changes.

## 2. Documents Architecture

```
DriverDocumentsScreen
  ↓ documentsProvider (Riverpod: loading/loaded/empty/uploading/deleting/
                       refreshing/error states)
  ↓ DocumentService   (validation, ownership check, friendly error mapping)
  ↓ DocumentRepository (CRUD + Storage upload)
  ↓ Supabase           (documents table + 'documents' bucket)
```

- Upload: camera or gallery → preview → confirm sheet (type / name /
  optional expiry / optional notes) → Storage upload → row insert → list reload.
- View: images render inline (zoomable); PDFs show metadata + copyable link
  (no WebView dependency added).
- Delete: confirmation dialog → storage object removal (best effort) +
  row delete.
- Driver identity comes from the authenticated profile (`currentDriverProvider`)
  — never manual entry. Ownership re-checked in service before delete/edit.

## 3. Camera Implementation

- `image_picker ^1.2.3` (maintained standard; no unnecessary packages).
- Sources: `ImageSource.camera` and `ImageSource.gallery`.
- Captures at quality 85 / maxWidth 2048 to keep uploads small.
- No `CAMERA` permission added to manifest — image_picker uses the system
  camera intent, avoiding a forced runtime permission.

## 4. File Validation

Mirrors the Web ERP rules exactly:
- Allowed: JPEG / PNG / PDF only — enforced by extension + magic-byte sniffing
  (`FF D8 FF`, `89 50 4E 47`, `%PDF`) so mislabeled files are rejected.
- Max size 5 MB.
- Friendly errors for empty file, too large, invalid type, unreadable file,
  cancelled pick, missing permissions.

## 5. Storage Security

- Existing bucket only; `{upsert:false}` uploads; public URL strategy matches
  the existing architecture (`getPublicUrl`) so rows stay readable by the
  Web ERP Documents page which renders `file_url` directly.
- ⚠️ If the org later makes the bucket private, switch
  `DocumentService.resolveViewUrl()` to `createSignedUrl()` — one method,
  documented in code.

## 6. UI Corrections (obvious bugs only — no redesign)

1. **Dead navigation fixed** — Driver Home attendance card used Navigator 1.0
   `pushNamed()` inside a go_router app (button silently failed). Now
   `context.push(AppRoutes.attendance)` (driver_home_screen.dart:331).
2. Removed unused locals causing analyzer warnings (attendance_screen,
   driver_bookings_screen).
3. Pull-to-refresh wired properly on the documents list.
4. Keyboard overflow prevented in upload sheet (`viewInsets` padding +
   scroll view).

## 7. App Icon Change

- New Sri Jayam Travels launcher icon generated programmatically
  (`tool/generate_icons.dart`, reproducible): brand-blue gradient background +
  white bus glyph (windows, headlights, wheels).
- All densities regenerated: mdpi 48 / hdpi 72 / xhdpi 96 / xxhdpi 144 /
  xxxhdpi 192.
- **Adaptive icon added** (`mipmap-anydpi-v26/ic_launcher.xml` +
  per-density `ic_launcher_foreground.png` + `values/colors.xml`
  `ic_launcher_background = #1565C0`) — previously missing entirely.
- Android Gradle structure untouched otherwise.

## 8. Driver Icon & Branding

- Driver/person icon standardized on Material outlined family everywhere
  (`Icons.person_outline` home/profile, `person_off_outlined` empty state).
- Documents entry uses `Icons.badge_outlined` (same outlined family);
  attendance keeps its consistent `fingerprint` identity.
- Login logo (`assets/images/logo.svg`) unchanged and reused.
- All new UI uses theme `colorScheme` roles — no competing styles introduced;
  status colors use container/on-container pairs that hold up in dark mode.

## 9. Responsive / Accessibility / Dark Mode

- Upload sheet scrolls with keyboard; preview capped at 32% screen height.
- List rows ellipsize long titles; chips shrink-wrap; FAB clear of content.
- Tooltips on all icon buttons; standard touch targets; body text ≥12sp.
- Dark mode verified by construction: every color comes from
  `Theme.of(context).colorScheme`; orange/green status shades chosen for
  contrast on both surfaces.

## 10. Files Created

| Path | Purpose |
|---|---|
| `lib/models/driver_document.dart` | documents-table model + computed status |
| `lib/repositories/document_repository.dart` | CRUD + Storage upload/delete |
| `lib/services/document_service.dart` | validation, ownership, error mapping |
| `lib/providers/document_provider.dart` | full state machine |
| `lib/screens/driver/driver_documents_screen.dart` | list/upload/view/delete UI |
| `tool/generate_icons.dart` | reproducible launcher-icon generator |
| `android/.../mipmap-anydpi-v26/ic_launcher.xml` | adaptive icon |
| `android/.../values/colors.xml` | adaptive background color |
| `android/.../mipmap-*/ic_launcher_foreground.png` ×5 | adaptive foreground layers |

## 11. Files Modified

| Path | Change |
|---|---|
| `pubspec.yaml` / `pubspec.lock` | + image_picker, + image (dev, icon tool), + shared_preferences (dev/test) |
| `lib/core/config/supabase_config.dart` | + `documentsTable` constant |
| `lib/navigation/app_router.dart` | + `/driver/documents` route |
| `lib/screens/driver/driver_profile_screen.dart` | + "My Documents" card entry point |
| `lib/screens/driver/driver_home_screen.dart` | fixed dead attendance-card navigation |
| `lib/screens/driver/attendance_screen.dart` | removed unused variable |
| `lib/screens/driver/driver_bookings_screen.dart` | removed unused variable |
| `android/.../mipmap-{m,h,xh,xxh,xxxh}dpi/ic_launcher.png` | replaced with new branding |

## 12. Files Deleted

None.

## 13. Tests

| Command | Result |
|---|---|
| `flutter pub get` | PASS |
| `flutter analyze` | **PASS — No issues found** (pre-existing warnings also cleaned) |
| `flutter test` | PASS (1/1) |
| `flutter build apk --debug` | PASS — `build/app/outputs/flutter-apk/app-debug.apk` |
| Physical device | NOT PERFORMED — no Android device attached to this machine |

## 14. Known Issues

1. Physical-device test pending (install APK → login → documents → camera →
   upload → view → delete → icon checks). Checklist mirrors Day 47 report §13.
2. Bucket publicity unverified (dashboard-side): Flutter follows the existing
   public-URL pattern; switch to signed URLs if privacy policy changes (one
   method).
3. PDFs have no inline mobile preview (no WebView added deliberately);
   link-copy provided instead.

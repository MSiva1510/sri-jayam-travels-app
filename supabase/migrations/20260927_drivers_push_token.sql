-- Sri Jayam Travels — driver push token for mobile-app notifications
-- The Flutter driver app registers its FCM token here on login /
-- token refresh. The web ERP broadcasts mobile pushes to registered
-- tokens only. No incentives, no other changes.
--
-- Apply once in Supabase → SQL Editor. Idempotent (safe to re-run).

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS push_token text;

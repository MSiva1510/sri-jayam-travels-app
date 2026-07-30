-- ─────────────────────────────────────────────────────────────
-- SRI JAYAM TRAVELS – DAY 31: ENTERPRISE SECURITY & ADMIN
-- ─────────────────────────────────────────────────────────────

-- ── 1. Role permissions table (per-role granular settings) ────
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role         TEXT NOT NULL,
  permission   TEXT NOT NULL,
  is_allowed   BOOLEAN DEFAULT false,
  updated_by   TEXT,
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(role, permission)
);
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY role_perms_all ON public.role_permissions FOR ALL USING (true);

-- Seed default permissions
INSERT INTO public.role_permissions (role, permission, is_allowed) VALUES
  -- Admin — all on
  ('admin','view_dashboard',true),('admin','create_booking',true),('admin','edit_booking',true),
  ('admin','delete_booking',true),('admin','approve_expense',true),('admin','generate_invoice',true),
  ('admin','manage_drivers',true),('admin','manage_vehicles',true),('admin','manage_users',true),
  ('admin','view_reports',true),('admin','export_reports',true),('admin','view_finance',true),
  ('admin','manage_payroll',true),('admin','system_settings',true),('admin','notification_management',true),
  ('admin','manage_customers',true),('admin','view_audit_log',true),('admin','manage_communications',true),
  ('admin','manage_roles',true),('admin','backup_restore',true),('admin','view_health',true),
  -- Manager — operational
  ('manager','view_dashboard',true),('manager','create_booking',true),('manager','edit_booking',true),
  ('manager','delete_booking',false),('manager','approve_expense',true),('manager','generate_invoice',false),
  ('manager','manage_drivers',true),('manager','manage_vehicles',true),('manager','manage_users',false),
  ('manager','view_reports',false),('manager','export_reports',false),('manager','view_finance',false),
  ('manager','manage_payroll',true),('manager','system_settings',false),('manager','notification_management',true),
  ('manager','manage_customers',true),('manager','view_audit_log',false),('manager','manage_communications',true),
  ('manager','manage_roles',false),('manager','backup_restore',false),('manager','view_health',false),
  -- Driver — minimal
  ('driver','view_dashboard',false),('driver','create_booking',false),('driver','edit_booking',false),
  ('driver','delete_booking',false),('driver','approve_expense',false),('driver','generate_invoice',false),
  ('driver','manage_drivers',false),('driver','manage_vehicles',false),('driver','manage_users',false),
  ('driver','view_reports',false),('driver','export_reports',false),('driver','view_finance',false),
  ('driver','manage_payroll',false),('driver','system_settings',false),('driver','notification_management',false),
  ('driver','manage_customers',false),('driver','view_audit_log',false),('driver','manage_communications',false),
  ('driver','manage_roles',false),('driver','backup_restore',false),('driver','view_health',false)
ON CONFLICT (role, permission) DO NOTHING;

-- ── 2. Session log ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.session_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES public.users(id) ON DELETE CASCADE,
  user_name        TEXT,
  user_role        TEXT,
  event            TEXT NOT NULL CHECK (event IN ('login','logout','timeout','forced_logout','password_changed')),
  device_info      TEXT,
  session_duration INTEGER,                              -- seconds
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_session_log_user ON public.session_log(user_id);
CREATE INDEX IF NOT EXISTS idx_session_log_created ON public.session_log(created_at DESC);
ALTER TABLE public.session_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY session_log_all ON public.session_log FOR ALL USING (true);

-- ── 3. Error log ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.error_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity     TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('info','warning','error','critical')),
  module       TEXT,
  message      TEXT NOT NULL,
  stack        TEXT,
  user_id      TEXT,
  user_role    TEXT,
  resolved     BOOLEAN DEFAULT false,
  resolved_by  TEXT,
  resolved_at  TIMESTAMP WITH TIME ZONE,
  metadata     JSONB DEFAULT '{}'::jsonb,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_error_log_severity ON public.error_log(severity);
CREATE INDEX IF NOT EXISTS idx_error_log_resolved ON public.error_log(resolved);
ALTER TABLE public.error_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY error_log_all ON public.error_log FOR ALL USING (true);

-- ── 4. Backup config ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.backup_config (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  provider         TEXT NOT NULL DEFAULT 'manual',  -- manual, supabase, gdrive, onedrive
  is_active        BOOLEAN DEFAULT false,
  schedule         TEXT,                             -- cron expression (future)
  retention_days   INTEGER DEFAULT 30,
  last_backup_at   TIMESTAMP WITH TIME ZONE,
  last_backup_size TEXT,
  last_backup_status TEXT DEFAULT 'never',
  config           JSONB DEFAULT '{}'::jsonb,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.backup_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY backup_config_all ON public.backup_config FOR ALL USING (true);

-- Seed default backup configs
INSERT INTO public.backup_config (name, provider, is_active, retention_days) VALUES
  ('Manual Backup',      'manual',    true,  30),
  ('Supabase Auto',      'supabase',  false, 7 ),
  ('Google Drive',       'gdrive',    false, 90),
  ('OneDrive',           'onedrive',  false, 90)
ON CONFLICT DO NOTHING;

-- ── 5. Backup history ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.backup_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id    UUID REFERENCES public.backup_config(id),
  provider     TEXT,
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending','running','success','failed')),
  size_bytes   BIGINT,
  tables_count INTEGER,
  initiated_by TEXT,
  error_msg    TEXT,
  started_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.backup_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY backup_history_all ON public.backup_history FOR ALL USING (true);

-- ── 6. System settings table (key-value) ─────────────────────
-- Extend existing settings; add security-specific keys
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS is_sensitive BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_by TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Seed security settings
INSERT INTO public.settings (setting_key, setting_value, category, description) VALUES
  ('session_timeout_minutes',  '60',    'security', 'Auto-logout after N minutes of inactivity'),
  ('max_login_attempts',       '5',     'security', 'Lock account after N failed attempts'),
  ('password_min_length',      '8',     'security', 'Minimum password length'),
  ('password_require_uppercase','true', 'security', 'Require at least one uppercase letter'),
  ('password_require_number',  'true',  'security', 'Require at least one number'),
  ('allow_concurrent_sessions','false', 'security', 'Allow same user logged in on multiple devices'),
  ('force_password_change_days','90',   'security', 'Force password change every N days (0=disabled)'),
  ('data_retention_audit_days','365',   'security', 'Keep audit logs for N days'),
  ('data_retention_comm_days', '180',   'security', 'Keep comm logs for N days')
ON CONFLICT (setting_key) DO NOTHING;

-- ── 7. Enhance audit_logs table ───────────────────────────────
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS severity   TEXT DEFAULT 'info' CHECK (severity IN ('info','warning','error','critical')),
  ADD COLUMN IF NOT EXISTS module     TEXT,
  ADD COLUMN IF NOT EXISTS old_values JSONB,
  ADD COLUMN IF NOT EXISTS user_name  TEXT,
  ADD COLUMN IF NOT EXISTS user_role  TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON public.audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module   ON public.audit_logs(module);

-- ── 8. System health view ─────────────────────────────────────
CREATE OR REPLACE VIEW public.system_health_summary AS
SELECT
  (SELECT COUNT(*) FROM public.bookings)             AS total_bookings,
  (SELECT COUNT(*) FROM public.bookings WHERE status = 'started') AS active_trips,
  (SELECT COUNT(*) FROM public.drivers  WHERE is_active = true)   AS active_drivers,
  (SELECT COUNT(*) FROM public.vehicles)             AS total_vehicles,
  (SELECT COUNT(*) FROM public.customers WHERE is_active = true)  AS total_customers,
  (SELECT COUNT(*) FROM public.audit_logs WHERE created_at > NOW() - INTERVAL '24 hours') AS audit_events_24h,
  (SELECT COUNT(*) FROM public.error_log WHERE resolved = false)  AS unresolved_errors,
  (SELECT COUNT(*) FROM public.communication_logs WHERE created_at > NOW() - INTERVAL '24 hours') AS comm_events_24h,
  NOW() AS checked_at;

SELECT 'Day 31 migration complete' AS result;

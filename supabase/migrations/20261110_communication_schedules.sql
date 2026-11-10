-- ─────────────────────────────────────────────────────────────────────────────
-- communication_schedules — persistent store for the in-browser Scheduler
--
-- Replaces localStorage key 'sjt_comm_schedule'. Schedules survive page
-- refreshes and are visible across all staff sessions.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.communication_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  run_at timestamptz,
  interval_ms bigint,
  payload jsonb DEFAULT '{}'::jsonb,
  recurring boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS: any active staff can read/write schedules
ALTER TABLE public.communication_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY communication_schedules_authenticated_all ON public.communication_schedules
  FOR ALL TO authenticated
  USING (public.app_role() IS NOT NULL)
  WITH CHECK (public.app_role() IS NOT NULL);

-- Index for lookups by type
CREATE INDEX IF NOT EXISTS idx_communication_schedules_type ON public.communication_schedules (type);
CREATE INDEX IF NOT EXISTS idx_communication_schedules_recurring ON public.communication_schedules (recurring);

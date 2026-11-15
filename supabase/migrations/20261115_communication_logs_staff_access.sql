-- communication_logs: staff read + cancel (update status) from the dashboard.
-- The WhatsApp tables got staff policies in 2026-10-27; communication_logs was
-- missed, so the Communications "cancel pending" action (which updates the log
-- status through the browser client) was being silently denied.

ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS communication_logs_staff_read ON public.communication_logs;
CREATE POLICY communication_logs_staff_read
  ON public.communication_logs FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS communication_logs_staff_update ON public.communication_logs;
CREATE POLICY communication_logs_staff_update
  ON public.communication_logs FOR UPDATE TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

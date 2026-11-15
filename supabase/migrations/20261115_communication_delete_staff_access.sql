-- Permanently delete rows from the dashboard (Delete buttons).
-- The 2026-09-15 security hardening grants DELETE to authenticated on every
-- public table, but these two tables only received explicit staff SELECT/UPDATE
-- policies in 20261115_communication_logs_staff_access.sql, so this makes the
-- delete path explicit and safe to re-run.

GRANT SELECT, UPDATE, DELETE ON public.communication_logs TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;

-- communication_logs: staff may delete log rows
DROP POLICY IF EXISTS communication_logs_staff_delete ON public.communication_logs;
CREATE POLICY communication_logs_staff_delete
  ON public.communication_logs FOR DELETE TO authenticated
  USING (public.is_staff());

-- notifications: a user may delete their own rows; staff may delete any
DROP POLICY IF EXISTS notifications_delete_own_or_staff ON public.notifications;
CREATE POLICY notifications_delete_own_or_staff
  ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_staff());

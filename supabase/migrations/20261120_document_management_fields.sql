-- Additive fields for the redesigned Add / Edit Document modal.
-- Every column is nullable and optional: existing documents keep working,
-- and the app falls back to the legacy single-file columns before this
-- migration is applied. No column is renamed, deleted or backfilled.

ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS document_number text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS issuing_authority text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS issue_date date;

ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS reminder_enabled boolean;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS reminder_interval integer;

ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS tags text[];

-- The original `file_*` triple remains the front-side attachment.
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS back_file_url text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS back_file_name text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS back_file_size bigint;

-- Storage object paths allow short-lived signed URLs to be regenerated when
-- a preview link expires. The signed URLs already stored in file_url /
-- back_file_url remain the fallback for legacy rows.
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_path text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS back_file_path text;

CREATE INDEX IF NOT EXISTS idx_documents_document_number ON public.documents (document_number);
CREATE INDEX IF NOT EXISTS idx_documents_reminder_date ON public.documents (reminder_date);

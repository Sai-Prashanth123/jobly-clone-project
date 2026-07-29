-- 029_expense_receipts_bucket.sql
-- expense_reports itself already exists (created directly, outside the
-- tracked migration history — confirmed via information_schema before
-- writing this). What's genuinely missing is a place to put uploaded
-- receipt files, replacing the old paste-a-URL "Receipt URL" text field.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('expense-receipts', 'expense-receipts', false, 20971520, ARRAY[
  'application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp'
])
ON CONFLICT (id) DO NOTHING;

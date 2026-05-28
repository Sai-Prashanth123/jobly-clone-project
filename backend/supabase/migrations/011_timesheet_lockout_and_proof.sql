-- Pass 2 of the corporate-grade hardening sweep.
--
-- Adds two related capabilities to weekly + monthly timesheets:
--   1. leave_reason — required when total_hours = 0 (employee was on leave /
--      medical / sick / unpaid). The reason is free text with a Select hint
--      list in the UI; backend just stores the chosen value as text for
--      reporting flexibility.
--   2. client_signed_url + client_signed_filename — proof attachment that the
--      employee uploads (PDF / image / DOC) showing the client-signed copy of
--      this period's timesheet. Required at submit-time when total_hours > 0;
--      hidden + skipped when total_hours = 0 (no work performed → no client
--      signature exists).
--
-- Also creates the private storage bucket `timesheet-proofs` that holds the
-- uploaded files (20 MB cap matching the existing employee-docs convention).
--
-- All additions are nullable and have no defaults, so this migration is
-- backwards compatible — historical rows simply have NULL on the new columns.
-- Rollback: ALTER TABLE … DROP COLUMN IF EXISTS … (4×) + DELETE FROM
-- storage.buckets WHERE id = 'timesheet-proofs'.

ALTER TABLE timesheets
  ADD COLUMN IF NOT EXISTS leave_reason            TEXT,
  ADD COLUMN IF NOT EXISTS client_signed_url       TEXT,
  ADD COLUMN IF NOT EXISTS client_signed_filename  TEXT;

ALTER TABLE monthly_timesheets
  ADD COLUMN IF NOT EXISTS leave_reason            TEXT,
  ADD COLUMN IF NOT EXISTS client_signed_url       TEXT,
  ADD COLUMN IF NOT EXISTS client_signed_filename  TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('timesheet-proofs', 'timesheet-proofs', false, 20971520)
ON CONFLICT (id) DO NOTHING;

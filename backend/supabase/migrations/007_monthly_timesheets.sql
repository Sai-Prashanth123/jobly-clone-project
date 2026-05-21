-- 007_monthly_timesheets.sql
-- Monthly attendance timesheet — a NEW, self-contained feature.
-- Completely independent of the weekly billing `timesheets`/`timesheet_entries`
-- tables and of invoicing. One row per (employee, year, month); the day-by-day
-- breakdown lives in the `entries` JSONB array (mirrors employees.identity_documents).

CREATE TYPE monthly_timesheet_status AS ENUM ('draft','submitted','approved','rejected');

CREATE SEQUENCE IF NOT EXISTS monthly_timesheet_seq START 1;

CREATE TABLE monthly_timesheets (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id       TEXT NOT NULL UNIQUE DEFAULT generate_display_id('MTS-', 'monthly_timesheet_seq'),
  employee_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  year             INT NOT NULL,
  month            INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  -- each entry: { date, dayOfWeek, project, task, startTime, endTime, hours, status }
  entries          JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_hours      NUMERIC(7,2) NOT NULL DEFAULT 0,   -- sum of present-day hours
  expected_hours   NUMERIC(7,2) NOT NULL DEFAULT 0,   -- working_days * 8
  working_days     INT NOT NULL DEFAULT 0,            -- non-weekend, non-holiday days
  leave_days       INT NOT NULL DEFAULT 0,
  status           monthly_timesheet_status NOT NULL DEFAULT 'draft',
  notes            TEXT,
  rejection_reason TEXT,
  pdf_url          TEXT,
  submitted_at     TIMESTAMPTZ,
  reviewed_at      TIMESTAMPTZ,
  reviewed_by      UUID REFERENCES portal_users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, year, month)
);

CREATE TRIGGER trg_monthly_timesheets_updated_at
  BEFORE UPDATE ON monthly_timesheets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_monthly_ts_employee ON monthly_timesheets(employee_id);
CREATE INDEX idx_monthly_ts_status   ON monthly_timesheets(status);
CREATE INDEX idx_monthly_ts_period   ON monthly_timesheets(year, month);

-- RLS: backend uses the service-role key (bypasses RLS). Deny direct client access,
-- same posture as every other table (keeps get_advisors clean).
ALTER TABLE monthly_timesheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON monthly_timesheets USING (false);

-- Private bucket for the generated monthly-timesheet PDFs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('monthly-timesheets', 'monthly-timesheets', false, 20971520, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

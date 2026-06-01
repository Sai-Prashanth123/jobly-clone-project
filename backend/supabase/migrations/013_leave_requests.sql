-- 013_leave_requests.sql
-- Dedicated employee leave-request workflow. Unlike the inline zero-hour
-- `leave_reason` on a weekly/monthly timesheet (a retroactive notation), this is
-- a PROSPECTIVE application: the employee applies before the leave, and HR/admin
-- approve or reject it. MVP — no PTO balance/accrual tracking.

CREATE TYPE leave_request_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

CREATE SEQUENCE IF NOT EXISTS leave_request_seq START 1;

CREATE TABLE leave_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id       TEXT NOT NULL UNIQUE DEFAULT generate_display_id('LV-', 'leave_request_seq'),
  employee_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  -- Mirrors the existing leave-reason vocabulary used on timesheets. TEXT+CHECK
  -- (not an enum) so new reasons can be added without a type migration.
  leave_type       TEXT NOT NULL CHECK (leave_type IN (
                     'medical_leave','sick','vacation','unpaid_leave','bereavement','jury_duty','other')),
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  days_requested   INT NOT NULL DEFAULT 0,
  reason           TEXT,
  status           leave_request_status NOT NULL DEFAULT 'pending',
  reviewed_by      UUID REFERENCES portal_users(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

CREATE TRIGGER trg_leave_requests_updated_at
  BEFORE UPDATE ON leave_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX idx_leave_requests_status   ON leave_requests(status);
CREATE INDEX idx_leave_requests_dates    ON leave_requests(start_date, end_date);

-- RLS: backend uses the service-role key (bypasses RLS). Deny direct client access.
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON leave_requests USING (false);

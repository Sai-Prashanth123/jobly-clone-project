-- 014_employee_leave_termination.sql
-- Extended-leave window + termination metadata on employees. Both reuse the
-- existing 'inactive' status (no new enum value): the presence of
-- `leave_return_date` marks "on extended leave" (auto-returns on that date);
-- `terminated_at` marks "terminated" (login disabled, record kept).

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS leave_started_at   DATE,
  ADD COLUMN IF NOT EXISTS leave_return_date  DATE,
  ADD COLUMN IF NOT EXISTS leave_reason       TEXT,
  ADD COLUMN IF NOT EXISTS terminated_at      DATE,
  ADD COLUMN IF NOT EXISTS termination_reason TEXT;

-- Daily scheduler reactivation queries by return date.
CREATE INDEX IF NOT EXISTS idx_employees_leave_return
  ON employees(leave_return_date) WHERE leave_return_date IS NOT NULL;

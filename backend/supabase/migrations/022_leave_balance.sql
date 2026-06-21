-- Migration 022: Leave Balance Tracker
-- HR configures leave types (fixed grant or accrual-based).
-- Per-employee entitlement overrides allow HR to grant extra days.
-- Balances are computed: granted + carried_over - approved_leave_days_used.

CREATE SEQUENCE IF NOT EXISTS leave_type_seq START 1;

CREATE TABLE IF NOT EXISTS leave_types (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id    TEXT        NOT NULL UNIQUE DEFAULT generate_display_id('LT-', 'leave_type_seq'),
  name          TEXT        NOT NULL,
  -- code must match existing leave_requests.leave_type CHECK constraint values
  code          TEXT        NOT NULL UNIQUE,
  description   TEXT,
  accrual_type  TEXT        NOT NULL DEFAULT 'fixed'
                CHECK (accrual_type IN ('fixed', 'accrual')),
  -- for fixed: annual entitlement days; for accrual: maximum days per year
  default_days  DECIMAL(5,2) NOT NULL DEFAULT 0,
  -- days earned per month (only used when accrual_type = 'accrual')
  accrual_rate  DECIMAL(5,2),
  -- max days that roll into the next calendar year
  max_carryover DECIMAL(5,2) DEFAULT 0,
  color         TEXT        NOT NULL DEFAULT '#6366f1',
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_leave_types_updated_at
  BEFORE UPDATE ON leave_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Per-employee entitlement overrides (HR can grant extra or fewer days than the type default)
CREATE TABLE IF NOT EXISTS employee_leave_entitlements (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    UUID        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id  UUID        NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  year           INTEGER     NOT NULL,
  -- overrides leave_types.default_days for this employee+year combination
  granted_days   DECIMAL(5,2) NOT NULL,
  carried_over   DECIMAL(5,2) NOT NULL DEFAULT 0,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, leave_type_id, year)
);

CREATE OR REPLACE TRIGGER trg_leave_entitlements_updated_at
  BEFORE UPDATE ON employee_leave_entitlements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_leave_entitlements_employee ON employee_leave_entitlements(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_entitlements_year     ON employee_leave_entitlements(year);

-- Seed default leave types matching the existing leave_requests.leave_type CHECK values
INSERT INTO leave_types (name, code, accrual_type, default_days, accrual_rate, color)
VALUES
  ('Vacation',       'vacation',      'accrual', 15,  1.25, '#6366f1'),
  ('Sick Leave',     'sick',          'fixed',   10,  NULL, '#f59e0b'),
  ('Medical Leave',  'medical_leave', 'fixed',   30,  NULL, '#ef4444'),
  ('Bereavement',    'bereavement',   'fixed',    5,  NULL, '#8b5cf6'),
  ('Jury Duty',      'jury_duty',     'fixed',    5,  NULL, '#06b6d4'),
  ('Unpaid Leave',   'unpaid_leave',  'fixed',   30,  NULL, '#6b7280'),
  ('Other',          'other',         'fixed',   10,  NULL, '#84cc16')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE leave_types                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_leave_entitlements  ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_only" ON leave_types;
DROP POLICY IF EXISTS "service_role_only" ON employee_leave_entitlements;
CREATE POLICY "service_role_only" ON leave_types                 USING (false);
CREATE POLICY "service_role_only" ON employee_leave_entitlements USING (false);

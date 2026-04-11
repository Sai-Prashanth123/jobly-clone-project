-- Drop redundant employee columns that are not in the workforce spec.
--
-- `manager_id` is a legacy duplicate of `reporting_manager_id` — the frontend
--   and every service read/write path has been migrated to use
--   `reporting_manager_id` exclusively.
--
-- `pay_frequency` (weekly/biweekly/monthly) is not required by the spec and
--   is not referenced by any payroll calculation.  It was only displayed in
--   read-only profile views.

ALTER TABLE employees DROP COLUMN IF EXISTS manager_id;
ALTER TABLE employees DROP COLUMN IF EXISTS pay_frequency;

-- The enum type becomes orphaned once the column is dropped.
DROP TYPE IF EXISTS pay_frequency;

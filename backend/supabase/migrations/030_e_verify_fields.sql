-- 030_e_verify_fields.sql
-- E-Verify (the US government employment-eligibility system HR runs after
-- I-9) tracking, mirroring the existing i9_status column pattern — a status
-- enum plus the case number issued when a case is created.

CREATE TYPE e_verify_status AS ENUM ('not_started','pending','employment_authorized','tentative_nonconfirmation','case_closed');

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS e_verify_status e_verify_status,
  ADD COLUMN IF NOT EXISTS e_verify_case_number TEXT;

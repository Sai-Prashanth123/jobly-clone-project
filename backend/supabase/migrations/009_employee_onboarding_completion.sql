-- 009_employee_onboarding_completion.sql
-- Employee self-onboarding gate.
--
-- A new hire must complete their own profile (personal details, addresses,
-- emergency contact, education, government-ID number + scan, photo, résumé)
-- before they get dashboard access. `onboarding_completed_at` records when they
-- finished (NULL = still onboarding → gated). New employees start NULL; existing
-- rows are backfilled so no one already in the system is locked out.

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

UPDATE employees
  SET onboarding_completed_at = COALESCE(created_at, now())
  WHERE onboarding_completed_at IS NULL;

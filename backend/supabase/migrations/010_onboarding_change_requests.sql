-- Onboarding change-request workflow (HR ↔ employee).
--
-- The "changes_requested" state is derived in the application layer
-- (auth.controller.ts computeOnboardingStatus) as:
--   employees.status = 'onboarding'
--     AND onboarding_change_request_message IS NOT NULL
--     AND onboarding_completed_at IS NULL
-- so no new enum value is needed here.
--
-- HR clicks "Request Changes" on the employee detail → backend writes the three
-- columns below and clears onboarding_completed_at. The employee's pending
-- screen reads the message and shows an "Update my information" CTA. When the
-- employee resubmits, completeOnboarding clears these columns.

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS onboarding_change_request_message TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_change_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_change_requested_by UUID REFERENCES portal_users(id) ON DELETE SET NULL;

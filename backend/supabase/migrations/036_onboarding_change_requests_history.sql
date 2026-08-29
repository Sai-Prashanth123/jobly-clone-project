-- Append-only history of HR "Request Changes" messages on an employee's
-- onboarding. The 3 flat columns on `employees`
-- (onboarding_change_request_message/_at/_by, migration 010) only ever hold
-- the CURRENT request and get overwritten/nulled on every new request or
-- resubmission, so there was no way to see past requests. This table is
-- purely additive history alongside those columns — it does not replace them
-- or change any onboarding-gate logic.
CREATE TABLE onboarding_change_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  message       TEXT NOT NULL,
  requested_by  UUID REFERENCES portal_users(id) ON DELETE SET NULL,
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ
);
CREATE INDEX idx_onboarding_change_requests_employee ON onboarding_change_requests(employee_id, requested_at DESC);

ALTER TABLE onboarding_change_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON onboarding_change_requests USING (false);

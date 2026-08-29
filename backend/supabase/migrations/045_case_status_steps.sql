CREATE TABLE case_status_steps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id       UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  step_key      TEXT NOT NULL,
  step_order    INT NOT NULL,
  completed_at  TIMESTAMPTZ,
  UNIQUE (case_id, step_key)
);
CREATE INDEX idx_case_status_steps_case ON case_status_steps(case_id, step_order);

ALTER TABLE case_status_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON case_status_steps USING (false);

-- Backfill the 11 fixed steps for every existing case so none are left
-- without a timeline.
INSERT INTO case_status_steps (case_id, step_key, step_order)
SELECT c.id, s.step_key, s.step_order
FROM cases c
CROSS JOIN (VALUES
  ('started', 1), ('beneficiary_questionnaire', 2), ('petitioner_reviewed', 3),
  ('forms_letters_generated', 4), ('paralegal_review', 5), ('forms_sent_for_signatures', 6),
  ('received_signed_forms', 7), ('supervisor_review', 8), ('submitted_to_uscis', 9),
  ('receipt_received', 10), ('uscis_response', 11)
) AS s(step_key, step_order)
ON CONFLICT (case_id, step_key) DO NOTHING;

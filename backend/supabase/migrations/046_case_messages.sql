CREATE TABLE case_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  author_id   UUID REFERENCES portal_users(id) ON DELETE SET NULL,
  audience    TEXT NOT NULL CHECK (audience IN ('all','law_firm','beneficiary')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_case_messages_case ON case_messages(case_id, created_at DESC);

ALTER TABLE case_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON case_messages USING (false);

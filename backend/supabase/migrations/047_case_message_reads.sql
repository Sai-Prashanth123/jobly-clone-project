CREATE TABLE case_message_reads (
  message_id  UUID NOT NULL REFERENCES case_messages(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
  read_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);

ALTER TABLE case_message_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON case_message_reads USING (false);

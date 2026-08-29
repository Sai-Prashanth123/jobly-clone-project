CREATE TABLE case_wages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  wage_year       INT NOT NULL,
  salary_received NUMERIC(12,2),
  document_id     UUID REFERENCES documents(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (case_id, wage_year)
);
CREATE TRIGGER trg_case_wages_updated_at BEFORE UPDATE ON case_wages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_case_wages_case ON case_wages(case_id);

ALTER TABLE case_wages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON case_wages USING (false);

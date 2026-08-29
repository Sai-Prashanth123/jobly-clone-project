CREATE TABLE case_tax_returns (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id      UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  tax_year     INT NOT NULL,
  amount       NUMERIC(12,2),
  document_id  UUID REFERENCES documents(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (case_id, tax_year)
);
CREATE TRIGGER trg_case_tax_returns_updated_at BEFORE UPDATE ON case_tax_returns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_case_tax_returns_case ON case_tax_returns(case_id);

ALTER TABLE case_tax_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON case_tax_returns USING (false);

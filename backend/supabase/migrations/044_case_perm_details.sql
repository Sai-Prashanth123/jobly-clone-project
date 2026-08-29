CREATE TABLE case_perm_details (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                UUID NOT NULL UNIQUE REFERENCES cases(id) ON DELETE CASCADE,
  job_title              TEXT,
  full_time_position     BOOLEAN,
  work_hours_per_week    NUMERIC,
  wage_rate              NUMERIC(12,2),
  soc_code               TEXT,
  pay_frequency          TEXT,
  classification         TEXT,
  permanent_position     BOOLEAN,
  experience_required    BOOLEAN,
  months_of_experience   INT,
  work_address           TEXT,
  minimum_education      TEXT,
  major_field_of_study   TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_case_perm_details_updated_at BEFORE UPDATE ON case_perm_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE case_perm_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON case_perm_details USING (false);

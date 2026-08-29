-- Petitioner (sponsoring employer) entity for Legal cases. Varies per case —
-- not always the same company (e.g. staffing clients can petition too) — so
-- this is a real lookup table a case links to, not a fixed company record.
CREATE TABLE petitioners (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  address_street    TEXT,
  address_city      TEXT,
  address_state     TEXT,
  address_zip       TEXT,
  address_country   TEXT,
  ein_fein          TEXT,
  deleted_at        TIMESTAMPTZ,
  created_by        UUID REFERENCES portal_users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_petitioners_updated_at BEFORE UPDATE ON petitioners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE petitioners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON petitioners USING (false);

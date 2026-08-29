-- Reconciles two pieces of schema drift that already exist live but were
-- never captured in a migration file, so a fresh `supabase db reset` would
-- produce a DB missing them. No behavior change — the app already reads and
-- writes both.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS expiry_date DATE;

CREATE TABLE IF NOT EXISTS tax_documents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  tax_year       INT NOT NULL,
  document_type  TEXT NOT NULL,
  file_url       TEXT,
  notes          TEXT,
  generated_at   TIMESTAMPTZ,
  sent_at        TIMESTAMPTZ,
  created_by     UUID REFERENCES portal_users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tax_documents_employee ON tax_documents(employee_id);

ALTER TABLE tax_documents ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service_role_only" ON tax_documents USING (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE cases ADD COLUMN IF NOT EXISTS petitioner_id UUID REFERENCES petitioners(id) ON DELETE SET NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS classification TEXT;
CREATE INDEX IF NOT EXISTS idx_cases_petitioner ON cases(petitioner_id);

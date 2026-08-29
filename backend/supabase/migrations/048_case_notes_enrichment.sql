-- Extends case_notes rather than a parallel table — same conceptual entity,
-- just enriched with the fields the Notes tab's filter bar needs. All
-- nullable so existing notes remain valid.
ALTER TABLE case_notes ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE case_notes ADD COLUMN IF NOT EXISTS tagged_to UUID REFERENCES portal_users(id) ON DELETE SET NULL;
ALTER TABLE case_notes ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE case_notes ADD COLUMN IF NOT EXISTS access_level TEXT;

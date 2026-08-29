-- Extends the existing polymorphic documents.entity_type/entity_id pattern
-- (rather than adding a case_id column) so case documents reuse every
-- existing upload/signed-URL/delete code path as-is. `category` is only
-- meaningful when entity_type='case' (named category buckets like "Clear
-- Copy of New and Old Passport..."), null for employee/client/invoice docs.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS category TEXT;

-- Private bucket (unlike document-templates) — these are per-case uploaded
-- files (passports, W2s, approval notices), not shared public templates.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('case-docs', 'case-docs', false, 20971520, NULL)
ON CONFLICT (id) DO NOTHING;

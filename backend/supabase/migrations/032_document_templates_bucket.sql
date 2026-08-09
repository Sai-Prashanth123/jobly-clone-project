-- 032_document_templates_bucket.sql
-- Public bucket for static, shared document templates (e.g. a blank Insurance
-- Waiver Form) that every employee downloads the same copy of — distinct from
-- the existing document buckets (employee-docs, client-docs, etc.), which are
-- private and per-employee-document via signed URLs, not suited for a single
-- shared permanent link. Mirrors the existing employee-photos public bucket.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('document-templates', 'document-templates', true, 20971520, NULL)
ON CONFLICT (id) DO NOTHING;

-- H-4 dependents (H1B holder's spouse/children) as a JSONB array, same
-- pattern as the existing education/work_history columns (005). Each entry:
-- { id, relationship: 'spouse'|'child', firstName, lastName, passportExpiry,
--   passportStoragePath?, passportFileName? } — the passport file itself
-- lives in the private employee-docs storage bucket, addressed by
-- passportStoragePath; it is NOT a row in the documents table (no existing
-- column there associates a document with "which dependent").
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS dependents JSONB NOT NULL DEFAULT '[]'::jsonb;

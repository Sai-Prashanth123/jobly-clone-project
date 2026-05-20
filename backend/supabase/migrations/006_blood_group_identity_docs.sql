-- Two more nullable fields requested by the Add Employee form polish pass:
--
-- `blood_group` — optional dropdown on the Personal Info card (A+/A-/…/O-).
-- `identity_documents` — JSONB array of US-issued ID numbers + optional
--    metadata, e.g. [{type:'driver_license', number:'D1234567', state:'CA'}].
--    The file scans themselves stay in the existing `documents` table tagged
--    by docType; this column only stores the numbers.

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS blood_group TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS identity_documents JSONB NOT NULL DEFAULT '[]'::jsonb;

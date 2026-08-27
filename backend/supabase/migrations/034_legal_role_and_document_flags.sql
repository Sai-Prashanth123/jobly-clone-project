-- New "legal" portal role (documents/immigration review only, enforced via
-- backend requireRole + an allowlist redaction in employees.service.ts's
-- redactEmployee — see that file for the exact field list legal can see).
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'legal';

-- Legal marks a document reviewed/flagged for HR's attention, with an
-- optional note. Lives on the existing documents table (same one every other
-- document type already uses) rather than a new table — no per-flag history
-- needed, just current flag state per document.
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS legal_flagged BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS legal_flag_comment TEXT;

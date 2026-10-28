-- 058_document_categories.sql
--
-- Group related documents so the same kind of paperwork sits in one place.
--
-- WHY
--
-- The onboarding wizard rendered every applicable document as a flat grid of
-- cards — 23 of them for an H-1B employee — with a passport next to a PERM
-- questionnaire next to a pay stub. Nothing said which of them were about the
-- same subject. That is also how two separate rows for the LCA went unnoticed:
-- 'lca' filed as employee-provided and 'lca_copy' as employer-issued, the same
-- document under two names.
--
-- `category` is deliberately a plain text column rather than an enum or a
-- lookup table, for the same reason `state` on document_requirements is: HR
-- edits these on the Document Policy page, and a new grouping should not need
-- a migration. text is also in the decided type set that schemaTypes.test.ts
-- enforces.
--
-- THE VALUES ARE GENERATED, NOT TYPED HERE
--   npx tsx scripts/emitCategorySeed.ts
-- reads them out of FALLBACK_POLICY, which generateDocumentPolicy.ts builds by
-- importing the frontend's documentTypes.ts. So the compiled-in default, the
-- seed below and the apps all come from one map.
--
-- UPDATE rather than an upsert: document_types was already seeded by 055, so
-- an INSERT ... ON CONFLICT DO NOTHING would leave every existing row on the
-- column default and categorise nothing.
--
-- Applying this changes no behaviour on its own — nothing reads the column
-- until the code that groups by it ships.

ALTER TABLE public.document_types
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'project';

COMMENT ON COLUMN public.document_types.category IS
  'Grouping for display: identity, work_auth, questionnaire, employment, background, project, employer. Editable by HR on the Document Policy page; the compiled-in default lives in src/portal/lib/documentTypes.ts.';

-- SEED

UPDATE public.document_types SET category = 'identity'
  WHERE key IN ('ssn', 'driver_license', 'state_id', 'passport');

UPDATE public.document_types SET category = 'work_auth'
  WHERE key IN ('green_card', 'ead', 'opt_card', 'stem_opt_card', 'i983', 'i20', 'i94', 'us_visa', 'i797', 'i140', 'i140_approval_notice', 'labor_certificate');

UPDATE public.document_types SET category = 'background'
  WHERE key IN ('resume', 'pay_stubs_w2_tax_returns', 'experience_letters', 'education_documents', 'certificates');

UPDATE public.document_types SET category = 'employment'
  WHERE key IN ('offer_letter', 'i9_form', 'w4', 'insurance_waiver');

UPDATE public.document_types SET category = 'questionnaire'
  WHERE key IN ('i140_questionnaire', 'perm_questionnaire', 'h1b_employee_questionnaire', 'h4_beneficiary_questionnaire');

UPDATE public.document_types SET category = 'project'
  WHERE key IN ('vendor_letter', 'project_documents', 'lca', 'other');

UPDATE public.document_types SET category = 'employer'
  WHERE key IN ('e_verify_letter', 'i129', 'lca_copy', 'employer_verification_letter', 'employer_offer_contract', 'vendor_msa');

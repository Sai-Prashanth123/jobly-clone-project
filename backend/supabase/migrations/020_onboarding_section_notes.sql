-- Migration 020: Add section-level HR annotation notes to employee onboarding
-- HR can now flag specific sections (personal, immigration, etc.) with targeted notes
-- instead of only sending one global change-request message.
-- Structure: { "personal": "DOB looks wrong", "immigration": "Need clearer I-9 copy" }

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS onboarding_section_notes JSONB DEFAULT '{}';

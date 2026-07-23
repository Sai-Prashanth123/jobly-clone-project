-- 028_emergency_contact_address_split.sql
-- Emergency contact address was a single free-text field. Split into
-- structured city/state/zip columns matching how present/permanent address
-- already work (address_street/city/state/zip) — emergency_contact_address
-- (the existing column) is now treated as "Address Line 1".

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS emergency_contact_city TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_state TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_zip TEXT;

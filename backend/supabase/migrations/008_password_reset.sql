-- 008_password_reset.sql
-- Mandatory first-login password reset.
--
-- A new employee's temporary password is first-login-only: after logging in
-- with it the user must set their own password before getting any other access.
-- `must_reset_password` carries that state (the Supabase JWT is opaque, so the
-- flag lives on portal_users and is surfaced via login / GET /auth/me and
-- enforced by the authenticate middleware allowlist).
--
-- Existing users default to FALSE — they already have working passwords and
-- must NOT be locked out. Credential issuance (new employee, admin reset,
-- forgot-password) sets it TRUE; completing a password change clears it.

ALTER TABLE portal_users
  ADD COLUMN IF NOT EXISTS must_reset_password BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

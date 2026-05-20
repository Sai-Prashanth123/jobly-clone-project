-- Onboarding form expansion: add the fields the new card-per-section
-- /portal/employees/new page collects. Everything is nullable so existing
-- rows continue to work without backfill.
--
-- The two JSONB columns (education, work_history) keep the migration small
-- and match how `documents` already lives on the employee response. If we
-- ever need to query history rows by company / dates, we can move them to
-- separate tables in a later migration.

-- Safety: the code has long expected `work_email` but no migration ever
-- created it. Add idempotently so this migration is safe to re-run.
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS work_email TEXT;

-- Personal
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS middle_name TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS marital_status TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS nationality TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS preferred_language TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS languages_known TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

-- Contact
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS alt_phone TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS skype_id TEXT;

-- Permanent address (present address already exists)
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS permanent_address_street TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS permanent_address_city TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS permanent_address_state TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS permanent_address_zip TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS permanent_address_country TEXT;

-- Emergency contact
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS emergency_contact_relationship TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS emergency_contact_alt_phone TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS emergency_contact_address TEXT;

-- Education + work history as JSONB arrays
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS education JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS work_history JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS total_experience_years NUMERIC(4,1);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS experience_level TEXT;

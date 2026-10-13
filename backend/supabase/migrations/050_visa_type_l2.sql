-- Add 'l2' to the visa_type enum.
--
-- The dropdown alone is not enough: visa_type is a Postgres ENUM, so a value
-- the frontend offers but the type does not hold is rejected at write time
-- with 22P02 — which is exactly what happened when h4_ead was added and the
-- employee could pick it, fill in the form, and have the save fail.
--
-- ADD VALUE is safe inside a transaction from PG12 onward (this database is
-- PG 18.3), and IF NOT EXISTS makes it re-runnable.

ALTER TYPE public.visa_type ADD VALUE IF NOT EXISTS 'l2' AFTER 'l1';

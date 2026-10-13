-- Store WHERE the client-signed timesheet lives, not just a link to it.
--
-- Both tables kept only `client_signed_url` — a presigned S3 URL written once
-- at upload. Presigned URLs expire: the code asked for 30 days, AWS caps
-- SigV4 at 7, which is why every upload was failing with a 500 until that was
-- clamped. Clamping fixed the upload but left the link dying after a week.
--
-- With the object's path on the row, the API can mint a fresh URL on every
-- read and the link never goes stale. `client_signed_url` stays — it is what
-- the frontend reads, and it is now filled in at read time rather than
-- being a stored artefact with an expiry date baked into it.
--
-- Existing rows have no path, so their stored URL is used as-is until the
-- proof is re-uploaded. Nothing breaks; those links simply keep whatever life
-- they had.

ALTER TABLE public.timesheets
  ADD COLUMN IF NOT EXISTS client_signed_path text;

ALTER TABLE public.monthly_timesheets
  ADD COLUMN IF NOT EXISTS client_signed_path text;

COMMENT ON COLUMN public.timesheets.client_signed_path IS
  'S3 object path of the client-signed timesheet. A fresh presigned URL is minted from this on read; client_signed_url is the short-lived result, not a durable value.';
COMMENT ON COLUMN public.monthly_timesheets.client_signed_path IS
  'S3 object path of the client-signed timesheet. See timesheets.client_signed_path.';

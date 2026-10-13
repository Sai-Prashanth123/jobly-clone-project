-- Invoice contact address: billing@ -> ap@
--
-- The address was hardcoded in five code sites (now a single BILLING_EMAIL
-- constant in backend/src/lib/billing.ts) AND seeded into invoice_templates
-- rows by migrations 016/017. The PDF generator reads
-- `theme?.footerText || BILLING_FOOTER`, so a seeded row wins over the code
-- default — without this, existing templates would keep printing billing@ on
-- every invoice while the code claimed to have changed.
--
-- Targeted replace rather than an overwrite: templates that an admin has since
-- customised keep their wording and only the address changes.

UPDATE public.invoice_templates
   SET footer_text = replace(footer_text, 'billing@joblysolutions.com', 'ap@joblysolutions.com')
 WHERE footer_text LIKE '%billing@joblysolutions.com%';

UPDATE public.email_templates
   SET body_html = replace(body_html, 'billing@joblysolutions.com', 'ap@joblysolutions.com')
 WHERE body_html LIKE '%billing@joblysolutions.com%';

-- The column DEFAULT carries the old address too, so a template created
-- without an explicit footer would reintroduce it after the rows above are
-- fixed.
ALTER TABLE public.invoice_templates
  ALTER COLUMN footer_text
  SET DEFAULT 'Jobly Solutions · ap@joblysolutions.com · www.joblysolutions.com';

-- 016_email_templates.sql
-- Reusable email templates for the Finance "Email clients" blast composer.
-- Each template has an editable Header / Body / Footer (HTML, authored in the
-- portal's WYSIWYG editor) + a subject line, with {{placeholder}} tokens that
-- are filled per recipient at send time. Security is at the route layer
-- (requireRole admin/finance); no RLS, consistent with the rest of the schema.

CREATE TABLE IF NOT EXISTS email_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  subject     TEXT NOT NULL DEFAULT '',
  header_html TEXT NOT NULL DEFAULT '',
  body_html   TEXT NOT NULL DEFAULT '',
  footer_html TEXT NOT NULL DEFAULT '',
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_by  UUID REFERENCES portal_users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed a few premium starter templates (only if the table is empty).
INSERT INTO email_templates (name, subject, header_html, body_html, footer_html, is_default)
SELECT * FROM (VALUES
  (
    'Payment reminder',
    'Payment reminder from Jobly Solutions',
    '<h2 style="margin:0 0 4px;">Payment reminder</h2>',
    '<p>Dear {{contact_name}},</p><p>This is a friendly reminder regarding the outstanding balance on your account with <strong>{{company_name}}</strong>. We''d appreciate it if you could arrange payment at your earliest convenience.</p><p>If you have already sent payment, please disregard this message. For any questions, just reply to this email.</p>',
    '<p>Kind regards,<br/><strong>Jobly Solutions</strong> · Billing Team<br/>billing@joblysolutions.com</p>',
    TRUE
  ),
  (
    'Account statement',
    'Your account statement from Jobly Solutions',
    '<h2 style="margin:0 0 4px;">Account statement</h2>',
    '<p>Hello {{contact_name}},</p><p>Please find a summary of your account with <strong>{{company_name}}</strong> below. Reach out to our billing team if anything looks off — we''re happy to help.</p>',
    '<p>Thank you for your business,<br/><strong>Jobly Solutions</strong><br/>billing@joblysolutions.com</p>',
    FALSE
  ),
  (
    'General announcement',
    'An update from Jobly Solutions',
    '<h2 style="margin:0 0 4px;">A quick update</h2>',
    '<p>Hi {{contact_name}},</p><p>We wanted to share an update with you. {{company_name}} continues to value your partnership, and we''re always working to serve you better.</p>',
    '<p>Warm regards,<br/><strong>The Jobly Solutions Team</strong></p>',
    FALSE
  )
) AS seed(name, subject, header_html, body_html, footer_html, is_default)
WHERE NOT EXISTS (SELECT 1 FROM email_templates);

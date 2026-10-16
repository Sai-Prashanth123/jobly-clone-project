-- 056_document_policy_permissions.sql
--
-- The two keys guarding the document-policy catalogue.
--
-- Reading is open to every role, because the onboarding wizard itself needs
-- it: an employee filling in their own forms has to know what is being asked
-- of them, and the gate that approves them reads the same answer.
--
-- Writing is admin and HR. HR files these documents daily and will spot a
-- missing requirement first; waiting for an admin is the delay this feature
-- exists to remove. It remains a narrow door, because this policy decides
-- whether somebody can finish onboarding.

INSERT INTO public.permissions (key, label, group_name, is_custom) VALUES
  ('documentPolicy.view',   'View document policy',   'Document Policy', false),
  ('documentPolicy.manage', 'Change document policy', 'Document Policy', false)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key, granted) VALUES
  ('admin',      'documentPolicy.view', true),
  ('hr',         'documentPolicy.view', true),
  ('operations', 'documentPolicy.view', true),
  ('finance',    'documentPolicy.view', true),
  ('legal',      'documentPolicy.view', true),
  ('employee',   'documentPolicy.view', true),
  ('admin',      'documentPolicy.manage', true),
  ('hr',         'documentPolicy.manage', true)
ON CONFLICT (role_key, permission_key) DO NOTHING;

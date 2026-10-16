-- 054_document_gaps_permission.sql
--
-- One permission key for the Document Gaps report (GET /employees/document-gaps).
--
-- Admin and HR, deliberately: HR files these documents daily and will spot a
-- missing requirement before anyone else. The report is read-only — it changes
-- no policy and blocks nobody — so a wider door costs nothing and waiting for
-- an admin is exactly the delay it exists to remove.

INSERT INTO public.permissions (key, label, group_name, is_custom) VALUES
  ('employees.view.document-gaps', 'View Employees — document gaps report', 'Employees', false)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key, granted) VALUES
  ('admin', 'employees.view.document-gaps', true),
  ('hr',    'employees.view.document-gaps', true)
ON CONFLICT (role_key, permission_key) DO NOTHING;

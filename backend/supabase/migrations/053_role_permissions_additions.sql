-- 053_role_permissions_additions.sql
--
-- Three permission keys that 052 missed, and the reason is worth recording:
-- the route scanner read only to the end of a line, so routes whose arguments
-- span several lines were invisible to it. notifications.view was one of
-- them and had been missing all along; the other two are the editor API
-- added in step 4. The scanner now reads a window and cuts at the handler
-- body, so multi-line routes are counted.

INSERT INTO public.permissions (key, label, group_name, is_custom) VALUES
  ('notifications.view', 'View Notifications', 'Notifications', false),
  ('permissions.view', 'View Role Permissions', 'Role Permissions', false),
  ('permissions.manage', 'Manage Role Permissions', 'Role Permissions', false)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key, granted) VALUES
  ('admin', 'notifications.view', true),
  ('admin', 'permissions.view', true),
  ('admin', 'permissions.manage', true)
ON CONFLICT (role_key, permission_key) DO NOTHING;

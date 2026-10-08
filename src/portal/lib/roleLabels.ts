import type { UserRole } from '../types';

/**
 * How each role is NAMED to users.
 *
 * The stored value stays `operations` everywhere — the database column, every
 * `requireRole('operations')` on the backend, every `allowedRoles` on a route.
 * Renaming the value would mean a migration plus touching every access check,
 * for a change that is purely what the label says. Only the display changes.
 *
 * Added because "Operations" was being rendered in five places from four
 * different hardcoded strings, so renaming it meant finding them all. Anything
 * that shows a role to a human should call roleLabel(); anything that makes an
 * access decision keeps using the raw value.
 */
const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  hr: 'HR',
  operations: 'Project Manager',
  finance: 'Finance',
  legal: 'Legal',
  employee: 'Employee',
};

/** Display name for a role. Falls back to Title Case for anything unmapped. */
export function roleLabel(role?: string | null): string {
  if (!role) return 'Member';
  return ROLE_LABELS[role] ?? role.charAt(0).toUpperCase() + role.slice(1);
}

/** The roles a person can be assigned, in the order they should be listed. */
export const ASSIGNABLE_ROLES: UserRole[] = ['admin', 'hr', 'operations', 'finance', 'legal', 'employee'];

/** `[{ value, label }]` for dropdowns and checkbox lists. */
export const ROLE_OPTIONS = ASSIGNABLE_ROLES.map(value => ({ value, label: roleLabel(value) }));

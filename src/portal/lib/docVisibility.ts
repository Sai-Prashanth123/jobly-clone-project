import type { UserRole } from '../types';

/**
 * Who may see an employee's immigration and education paperwork.
 *
 * HR (Oct 2026): "I9, I94, I-140, LCA, 797, Visa, DL, Education to be visible
 * only for Manager." Confirmed with Prashanth as **admin + operations** — the
 * role shown in the UI as Project Manager.
 *
 * This is presentation only. The employee record page is already restricted to
 * admin/hr/operations at the route (PortalApp.tsx), and the API applies its own
 * rules; this stops the documents being rendered for the roles that can still
 * open the page. Anyone relying on it as an access control would be wrong — a
 * determined reader can call the API directly, which is why the server-side
 * policy in backend/src/lib/documentAccess.ts exists and is the real boundary.
 */
const SENSITIVE_DOC_ROLES: ReadonlySet<string> = new Set<UserRole>(['admin', 'operations']);

export function canSeeSensitiveDocs(role?: string | null): boolean {
  return !!role && SENSITIVE_DOC_ROLES.has(role);
}

/**
 * Role permissions, as data rather than as code.
 *
 * `requireRole('admin','hr')` states an answer. `requirePermission('employees.view')`
 * asks a question whose answer an admin can change. This is the machinery
 * behind the second form.
 *
 * THREE RULES SHAPE ALL OF IT, and they come from this system's own history:
 * a password rotation once locked people out, and a document-visibility change
 * cost HR access that was reported within hours.
 *
 *   1. Day one behaves exactly as today. The seed in migration 052 is
 *      GENERATED from the running `requireRole` calls, not typed from the
 *      matrix on the Admin Settings screen — that matrix and the code disagree
 *      in both directions, and obeying it as written would move 113 of 256
 *      routes immediately.
 *
 *   2. A database problem must not become an outage, and must not become a
 *      free-for-all either. If the tables are empty, unreachable, or silent
 *      about a key, the answer falls back to the compiled-in role tuple for
 *      that permission. Never open, never shut.
 *
 *   3. Admin cannot lose admin. The permission that reaches this screen
 *      cannot be revoked from the last role holding it, enforced in the
 *      service rather than by hiding a checkbox.
 */

/**
 * The compiled-in answer for every permission key: what the routes enforce
 * today. This is the fallback, and it is also the thing the parity test
 * compares the database against.
 *
 * Generated from the live route guards — see scripts/generatePermissions.mjs.
 * Regenerate it rather than editing by hand, or it stops describing the code.
 */
export const FALLBACK_GRANTS: Record<string, readonly string[]> = Object.freeze({
  'activityLogs.view': ['admin', 'hr'],
  'admin.manage': ['admin'],
  'admin.view': ['admin'],
  'analyticsReports.view': ['admin', 'hr', 'operations'],
  'analyticsReports.view.cash-flow-forecast': ['admin', 'finance'],
  'analyticsReports.view.expense-analytics': ['admin', 'finance'],
  'analyticsReports.view.headcount': ['admin', 'hr'],
  'analyticsReports.view.invoice-analytics': ['admin', 'finance'],
  'analyticsReports.view.milestones': ['admin', 'hr'],
  'analyticsReports.view.probation': ['admin', 'hr'],
  'announcements.create.mark-seen': ['admin', 'employee', 'finance', 'hr', 'legal', 'operations'],
  'announcements.manage': ['admin', 'hr'],
  'announcements.view': ['admin', 'employee', 'finance', 'hr', 'legal', 'operations'],
  'assets.manage': ['admin', 'hr'],
  'assets.view': ['admin', 'hr', 'operations'],
  'assets.view.employee-employeeId': ['admin', 'employee', 'hr', 'operations'],
  'assignments.create': ['admin', 'operations'],
  'assignments.delete': ['admin'],
  'assignments.edit': ['admin', 'operations'],
  'assignments.view': ['admin', 'employee', 'finance', 'hr', 'operations'],
  'budgets.manage': ['admin', 'finance'],
  'budgets.view': ['admin', 'finance'],
  'cases.create.id-messages': ['admin', 'employee', 'hr', 'legal'],
  'cases.create.id-messages-messageId-read': ['admin', 'employee', 'hr', 'legal'],
  'cases.create.root': ['admin', 'hr'],
  'cases.manage': ['admin', 'hr', 'legal'],
  'cases.view': ['admin', 'hr', 'legal'],
  'cases.view.id-messages': ['admin', 'employee', 'hr', 'legal'],
  'clients.create': ['admin'],
  'clients.delete': ['admin'],
  'clients.edit': ['admin', 'hr'],
  'clients.edit.id': ['admin'],
  'clients.view': ['admin', 'employee', 'finance', 'hr', 'operations'],
  'documents.create': ['admin', 'hr', 'operations'],
  'documents.delete': ['admin', 'hr', 'operations'],
  'documents.edit': ['admin', 'legal'],
  'documents.view': ['admin', 'employee', 'finance', 'hr', 'legal', 'operations'],
  'emailTemplates.manage': ['admin', 'finance'],
  'emailTemplates.view': ['admin', 'finance'],
  'employees.create': ['admin', 'hr'],
  'employees.create.id-dependents-dependentId-passport': ['admin', 'employee', 'hr'],
  'employees.create.id-documents': ['admin', 'employee', 'hr'],
  'employees.create.id-onboarding-complete': ['admin', 'employee', 'hr'],
  'employees.create.id-onboarding-reopen': ['admin', 'employee', 'hr'],
  'employees.create.id-photo': ['admin', 'employee', 'hr'],
  'employees.delete': ['admin', 'hr'],
  'employees.delete.id-documents-docId': ['admin', 'employee', 'hr'],
  'employees.edit': ['admin', 'employee', 'hr'],
  'employees.view': ['admin', 'hr', 'operations'],
  'employees.view.directory': ['admin', 'finance', 'hr', 'operations'],
  'employees.view.expiring-documents': ['admin', 'hr', 'legal'],
  'employees.view.id': ['admin', 'employee', 'finance', 'hr', 'operations'],
  'employees.view.id-dependents-dependentId-passport-url': ['admin', 'employee', 'hr', 'legal'],
  'employees.view.id-onboarding-change-requests': ['admin', 'employee', 'hr'],
  'employees.view.root': ['admin', 'employee', 'finance', 'hr', 'operations'],
  'enrollmentForms.create': ['admin', 'hr'],
  'enrollmentForms.create.id-submit': ['employee'],
  'enrollmentForms.delete': ['admin', 'hr'],
  'enrollmentForms.edit': ['employee'],
  'enrollmentForms.view': ['admin', 'employee', 'hr'],
  'expenses.create.id-paid': ['admin', 'finance'],
  'expenses.create.id-review': ['admin', 'finance', 'hr'],
  'expenses.manage': ['admin', 'employee', 'hr'],
  'expenses.view': ['admin', 'employee', 'finance', 'hr', 'operations'],
  'holidays.manage': ['admin', 'hr'],
  'holidays.view': ['admin', 'employee', 'finance', 'hr', 'operations'],
  'invoiceTemplates.manage': ['admin', 'finance'],
  'invoiceTemplates.view': ['admin', 'finance'],
  'invoices.manage': ['admin', 'finance'],
  'invoices.view': ['admin', 'finance'],
  'leaveBalance.manage': ['admin', 'hr'],
  'leaveBalance.view': ['admin', 'employee', 'finance', 'hr', 'operations'],
  'leaveBalance.view.balances': ['admin', 'employee', 'hr'],
  'leaveBalance.view.balances-empId': ['admin', 'hr'],
  'leaveRequests.create': ['admin', 'employee', 'hr'],
  'leaveRequests.edit': ['admin', 'hr'],
  'leaveRequests.view': ['admin', 'employee', 'hr'],
  'monthlyTimesheets.create': ['admin', 'employee', 'hr', 'operations'],
  'monthlyTimesheets.create.id-client-proof': ['admin', 'employee', 'hr'],
  'monthlyTimesheets.create.root': ['admin', 'employee', 'hr'],
  'monthlyTimesheets.delete': ['admin', 'employee', 'hr'],
  'monthlyTimesheets.edit': ['admin', 'employee', 'hr'],
  'monthlyTimesheets.edit.id-entries': ['admin', 'hr'],
  'monthlyTimesheets.edit.id-hr-notes': ['admin', 'hr'],
  'monthlyTimesheets.view': ['admin', 'employee', 'hr', 'operations'],
  'monthlyTimesheets.view.leave-check': ['admin', 'employee', 'hr'],
  'monthlyTimesheets.view.me': ['admin', 'employee', 'hr'],
  'monthlyTimesheets.view.not-submitted': ['admin', 'hr'],
  'notifications.manage': ['admin'],
  'offboarding.manage': ['admin', 'hr'],
  'offboarding.view': ['admin', 'hr'],
  'onboardingChecklist.manage': ['admin', 'hr'],
  'onboardingChecklist.view': ['admin', 'hr'],
  'performanceReviews.manage': ['admin', 'hr'],
  'performanceReviews.view': ['admin', 'employee', 'hr'],
  'petitioners.manage': ['admin', 'hr', 'legal'],
  'petitioners.view': ['admin', 'hr', 'legal'],
  'reports.view': ['admin', 'finance'],
  'reports.view.employee-utilization': ['admin', 'finance', 'hr', 'operations'],
  'reports.view.missing-timesheets': ['admin', 'finance', 'hr', 'operations'],
  'reports.view.timesheet-summary': ['admin', 'finance', 'hr', 'operations'],
  'reports.view.visa-expiry': ['admin', 'finance', 'hr', 'operations'],
  'settings.manage': ['admin'],
  'settings.view': ['admin'],
  'shifts.manage': ['admin', 'hr', 'operations'],
  'shifts.view': ['admin', 'employee', 'finance', 'hr', 'operations'],
  'skills.manage': ['admin', 'employee', 'finance', 'hr', 'operations'],
  'skills.view': ['admin', 'hr'],
  'skills.view.employee-employeeId': ['admin', 'employee', 'finance', 'hr', 'operations'],
  'supportTickets.create': ['admin', 'hr', 'legal'],
  'supportTickets.edit': ['admin', 'legal'],
  'supportTickets.view': ['admin', 'hr', 'legal'],
  'system.manage': ['admin'],
  'taxDocuments.manage': ['admin', 'finance'],
  'taxDocuments.view': ['admin', 'employee', 'finance', 'hr'],
  'timesheets.create': ['admin', 'employee', 'operations'],
  'timesheets.delete': ['admin', 'employee', 'operations'],
  'timesheets.edit': ['admin', 'finance', 'hr', 'operations'],
  'timesheets.edit.id': ['admin', 'employee', 'operations'],
  'timesheets.edit.id-hr-notes': ['admin', 'hr'],
  'timesheets.edit.id-reopen': ['admin', 'hr', 'operations'],
  'timesheets.edit.id-status': ['admin', 'employee', 'finance', 'hr', 'operations'],
  'timesheets.view': ['admin', 'employee', 'finance', 'hr', 'operations'],
  'timesheets.view.export': ['admin', 'finance', 'hr', 'operations'],
});

/** Roles that may never be deleted, and the one permission admin may never lose. */
export const BUILTIN_ROLES = ['admin', 'hr', 'operations', 'finance', 'legal', 'employee'] as const;
export const UNREVOKABLE_PERMISSION = 'admin.view';

export type PermissionRow = { role_key: string; permission_key: string; granted: boolean };

/**
 * Build a lookup from database rows, falling back per key.
 *
 * Per KEY, deliberately, not per table: a table that loads but is missing a
 * row for one permission should fall back for that one permission only, not
 * discard the admin's other decisions.
 */
export function buildPermissionIndex(
  rows: PermissionRow[] | null | undefined,
  fallback: Record<string, readonly string[]> = FALLBACK_GRANTS,
): (role: string, key: string) => boolean {
  const known = new Set<string>();
  const granted = new Set<string>();
  for (const r of rows ?? []) {
    known.add(r.permission_key);
    if (r.granted) granted.add(`${r.role_key}\u0000${r.permission_key}`);
  }

  return (role: string, key: string): boolean => {
    if (known.has(key)) return granted.has(`${role}\u0000${key}`);
    const tuple = fallback[key];
    // A key nothing knows about is not a key anybody should pass. Returning
    // false here rather than true: an unknown permission is a bug, and the
    // safe reading of a bug in an authorisation check is "no".
    return tuple ? tuple.includes(role) : false;
  };
}

/**
 * Would this change leave nobody able to administer permissions?
 *
 * Checked against the state the change would PRODUCE, not the state it starts
 * from, so a single call that revokes the last grant is caught.
 */
export function wouldOrphanAdmin(
  rows: PermissionRow[],
  change: { role_key: string; permission_key: string; granted: boolean },
): boolean {
  if (change.permission_key !== UNREVOKABLE_PERMISSION || change.granted) return false;
  const after = rows
    .filter(r => r.permission_key === UNREVOKABLE_PERMISSION)
    .filter(r => r.role_key !== change.role_key)
    .filter(r => r.granted);
  return after.length === 0;
}

// Single place that decides where an employee's system emails go, respecting
// the `block_personal_email` flag HR can set once an official/work email has
// been assigned (see updateEmployee's guard in employees.service.ts, which
// ensures a work email always exists before this flag can be true).
export function resolveEmployeeEmailRecipients(emp: {
  email?: string | null;
  work_email?: string | null;
  block_personal_email?: boolean | null;
}): string[] {
  const personal = (emp.email ?? '').trim();
  const work = (emp.work_email ?? '').trim();
  if (emp.block_personal_email) return work ? [work] : [];
  // work-email-first: preserves the pre-existing `work_email || email`
  // single-recipient priority at call sites that pick the first entry.
  return [...new Set([work, personal].filter(Boolean))];
}

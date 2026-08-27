import type { TimesheetStatus, InvoiceStatus, AssignmentStatus, EmployeeStatus, CaseStatus, FilingStatus, TicketStatus } from '../../types';

type AnyStatus = TimesheetStatus | InvoiceStatus | AssignmentStatus | EmployeeStatus | CaseStatus | FilingStatus | TicketStatus | string;

const STATUS_MAP: Record<string, { label: string; className: string; meaning: string }> = {
  // Employee
  active:           { label: 'Active',      className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
                      meaning: 'Currently on payroll and assignable.' },
  inactive:         { label: 'Inactive',    className: 'bg-gray-100   text-gray-600    border border-gray-200',
                      meaning: 'Off-boarded or on hold. Cannot be assigned to new projects.' },
  onboarding:       { label: 'Onboarding',  className: 'bg-blue-100   text-blue-700    border border-blue-200',
                      meaning: 'New hire — paperwork pending. Becomes Active once HR approves onboarding.' },

  // Timesheet
  draft:            { label: 'Draft',       className: 'bg-gray-100   text-gray-600    border border-gray-200',
                      meaning: 'Saved but not yet submitted. For invoices, this means it was created but has not been emailed to the client yet.' },
  submitted:        { label: 'Submitted',   className: 'bg-amber-100  text-amber-700   border border-amber-200',
                      meaning: 'Employee submitted the timesheet — awaiting manager approval.' },
  manager_approved: { label: 'Approved',    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
                      meaning: 'Approved — these hours are eligible to be invoiced.' },
  rejected:         { label: 'Rejected',    className: 'bg-red-100    text-red-700     border border-red-200',
                      meaning: 'Returned to the employee for correction. Once edited, it can be re-submitted.' },
  approved:         { label: 'Approved',    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
                      meaning: 'Reviewed and approved by your reporting manager or HR.' },

  // Invoice
  sent:             { label: 'Sent',        className: 'bg-blue-100   text-blue-700    border border-blue-200',
                      meaning: 'Invoice was emailed to the client. Waiting on payment.' },
  paid:             { label: 'Paid',        className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
                      meaning: 'Payment received — closed out.' },
  overdue:          { label: 'Overdue',     className: 'bg-red-100    text-red-700     border border-red-200',
                      meaning: 'Past the due date and not yet paid. Send a reminder to the client.' },

  // Assignment
  completed:        { label: 'Completed',   className: 'bg-violet-100 text-violet-700  border border-violet-200',
                      meaning: 'Assignment finished — no further timesheets expected.' },
  pending:          { label: 'Pending',     className: 'bg-amber-100  text-amber-700   border border-amber-200',
                      meaning: 'Created but not yet started.' },
  terminated:       { label: 'Terminated',  className: 'bg-red-100    text-red-700     border border-red-200',
                      meaning: 'Ended early. No further timesheets accepted.' },

  // I-9
  complete:         { label: 'Complete',    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
                      meaning: 'I-9 verification complete — employment eligibility confirmed.' },
  expired:          { label: 'Expired',     className: 'bg-red-100    text-red-700     border border-red-200',
                      meaning: 'Work authorization expired. Needs renewal before further timesheets.' },

  // Legal case
  open:             { label: 'Open',            className: 'bg-blue-100    text-blue-700    border border-blue-200',
                      meaning: 'Case created — Legal has not yet filed anything with USCIS/DOL.' },
  pending_uscis:    { label: 'Pending USCIS',    className: 'bg-amber-100   text-amber-700   border border-amber-200',
                      meaning: 'Filed and awaiting a decision from USCIS or DOL.' },
  rfe_received:     { label: 'RFE Received',     className: 'bg-amber-100   text-amber-700   border border-amber-200',
                      meaning: 'USCIS issued a Request for Evidence — a response is due.' },
  case_approved:    { label: 'Approved',         className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
                      meaning: 'USCIS approved this immigration case.' },
  denied:           { label: 'Denied',           className: 'bg-red-100     text-red-700     border border-red-200',
                      meaning: 'USCIS/DOL denied this case or filing.' },
  closed:           { label: 'Closed',           className: 'bg-gray-100    text-gray-600    border border-gray-200',
                      meaning: 'Case closed — no further action expected.' },

  // Case filing (CAP registration / PWD)
  filed:            { label: 'Filed',            className: 'bg-blue-100    text-blue-700    border border-blue-200',
                      meaning: 'Submitted to USCIS/DOL — awaiting a result.' },
  certified:        { label: 'Certified',        className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
                      meaning: 'DOL certified this PWD filing.' },
  selected:         { label: 'Selected',         className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
                      meaning: 'Selected in the H-1B cap lottery.' },
  not_selected:     { label: 'Not Selected',     className: 'bg-gray-100    text-gray-600    border border-gray-200',
                      meaning: 'Not selected in the H-1B cap lottery this cycle.' },
  withdrawn:        { label: 'Withdrawn',        className: 'bg-gray-100    text-gray-600    border border-gray-200',
                      meaning: 'Filing withdrawn before a decision was issued.' },

  // Support ticket
  new:              { label: 'New',              className: 'bg-blue-100    text-blue-700    border border-blue-200',
                      meaning: 'Submitted to Legal — not yet reviewed.' },
  in_progress:      { label: 'In Progress',      className: 'bg-amber-100   text-amber-700   border border-amber-200',
                      meaning: 'Legal is working on this request.' },
  resolved:         { label: 'Resolved',         className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
                      meaning: 'Legal has answered and closed this request.' },
};

export function StatusBadge({ status }: { status: AnyStatus }) {
  const config = STATUS_MAP[status] ?? {
    label: status,
    className: 'bg-gray-100 text-gray-600 border border-gray-200',
    meaning: '',
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-help ${config.className}`}
      title={config.meaning ? `${config.label} — ${config.meaning}` : config.label}
    >
      {config.label}
    </span>
  );
}

import type { TimesheetStatus, InvoiceStatus, AssignmentStatus, EmployeeStatus } from '../../types';

type AnyStatus = TimesheetStatus | InvoiceStatus | AssignmentStatus | EmployeeStatus | string;

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  // Employee
  active:           { label: 'Active',      className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  inactive:         { label: 'Inactive',    className: 'bg-gray-100   text-gray-600    border border-gray-200' },
  onboarding:       { label: 'Onboarding',  className: 'bg-blue-100   text-blue-700    border border-blue-200' },
  // Timesheet
  draft:            { label: 'Draft',       className: 'bg-gray-100   text-gray-600    border border-gray-200' },
  submitted:        { label: 'Submitted',   className: 'bg-amber-100  text-amber-700   border border-amber-200' },
  manager_approved: { label: 'Mgr Approved',className: 'bg-violet-100 text-violet-700  border border-violet-200' },
  client_approved:  { label: 'Approved',    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  rejected:         { label: 'Rejected',    className: 'bg-red-100    text-red-700     border border-red-200' },
  // Invoice
  sent:             { label: 'Sent',        className: 'bg-blue-100   text-blue-700    border border-blue-200' },
  paid:             { label: 'Paid',        className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  overdue:          { label: 'Overdue',     className: 'bg-red-100    text-red-700     border border-red-200' },
  // Assignment
  completed:        { label: 'Completed',   className: 'bg-violet-100 text-violet-700  border border-violet-200' },
  pending:          { label: 'Pending',     className: 'bg-amber-100  text-amber-700   border border-amber-200' },
  terminated:       { label: 'Terminated',  className: 'bg-red-100    text-red-700     border border-red-200' },
  // I-9
  complete:         { label: 'Complete',    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  expired:          { label: 'Expired',     className: 'bg-red-100    text-red-700     border border-red-200' },
};

export function StatusBadge({ status }: { status: AnyStatus }) {
  const config = STATUS_MAP[status] ?? {
    label: status,
    className: 'bg-gray-100 text-gray-600 border border-gray-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}

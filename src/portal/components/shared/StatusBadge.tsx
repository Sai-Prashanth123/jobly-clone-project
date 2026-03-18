import { Badge } from '@/components/ui/badge';
import type { TimesheetStatus, InvoiceStatus, AssignmentStatus, EmployeeStatus } from '../../types';

type AnyStatus = TimesheetStatus | InvoiceStatus | AssignmentStatus | EmployeeStatus | string;

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
  // Employee
  active: { label: 'Active', variant: 'default', className: 'bg-green-100 text-green-800 hover:bg-green-100' },
  inactive: { label: 'Inactive', variant: 'secondary', className: 'bg-gray-100 text-gray-600 hover:bg-gray-100' },
  onboarding: { label: 'Onboarding', variant: 'outline', className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
  // Timesheet
  draft: { label: 'Draft', variant: 'secondary', className: 'bg-gray-100 text-gray-600 hover:bg-gray-100' },
  submitted: { label: 'Submitted', variant: 'outline', className: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100' },
  manager_approved: { label: 'Mgr Approved', variant: 'default', className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
  client_approved: { label: 'Approved', variant: 'default', className: 'bg-green-100 text-green-800 hover:bg-green-100' },
  rejected: { label: 'Rejected', variant: 'destructive', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
  // Invoice
  sent: { label: 'Sent', variant: 'outline', className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
  paid: { label: 'Paid', variant: 'default', className: 'bg-green-100 text-green-800 hover:bg-green-100' },
  overdue: { label: 'Overdue', variant: 'destructive', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
  // Assignment
  completed: { label: 'Completed', variant: 'secondary', className: 'bg-purple-100 text-purple-700 hover:bg-purple-100' },
  pending: { label: 'Pending', variant: 'outline', className: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100' },
  terminated: { label: 'Terminated', variant: 'destructive', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
};

export function StatusBadge({ status }: { status: AnyStatus }) {
  const config = STATUS_MAP[status] ?? { label: status, variant: 'secondary' as const, className: '' };
  return (
    <Badge variant={config.variant} className={`text-xs font-medium border-0 ${config.className}`}>
      {config.label}
    </Badge>
  );
}

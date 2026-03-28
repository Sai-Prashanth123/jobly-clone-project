import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserPlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/shared/PageHeader';
import { DataTable, type Column } from '../components/shared/DataTable';
import { StatusBadge } from '../components/shared/StatusBadge';
import { EmployeeForm } from '../components/employees/EmployeeForm';
import { useEmployees, useCreateEmployee } from '../hooks/useEmployees';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../lib/apiClient';
import { formatDate } from '../lib/utils';
import type { Employee } from '../types';

export default function Employees() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading } = useEmployees({ limit: 100 });
  const createEmployee = useCreateEmployee();
  const [showForm, setShowForm] = useState(false);
  const canManage = user?.role === 'admin' || user?.role === 'hr';

  const employees = data?.data ?? [];

  const columns: Column<Employee>[] = [
    {
      key: 'id',
      header: 'ID',
      render: e => <span className="text-xs font-mono text-blue-600">{e.displayId ?? e.id.slice(0, 8)}</span>,
      getValue: e => e.displayId ?? e.id.slice(0, 8),
    },
    {
      key: 'name',
      header: 'Name',
      render: e => (
        <div>
          <p className="font-medium">{e.firstName} {e.lastName}</p>
          <p className="text-xs text-muted-foreground">{e.email}</p>
        </div>
      ),
      getValue: e => `${e.firstName} ${e.lastName}`,
      sortable: true,
    },
    {
      key: 'department',
      header: 'Department',
      hideOnMobile: true,
      getValue: e => e.department ?? '',
      sortable: true,
    },
    { key: 'jobTitle', header: 'Job Title', hideOnMobile: true },
    {
      key: 'employmentType',
      header: 'Type',
      hideOnMobile: true,
      render: e => <span className="uppercase text-xs font-medium">{e.employmentType}</span>,
      getValue: e => e.employmentType ?? '',
    },
    {
      key: 'startDate',
      header: 'Start Date',
      hideOnMobile: true,
      render: e => formatDate(e.startDate),
      getValue: e => e.startDate ?? '',
    },
    {
      key: 'status',
      header: 'Status',
      render: e => <StatusBadge status={e.status} />,
      getValue: e => e.status,
      sortable: true,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Employees"
        description={isLoading ? 'Loading...' : `${employees.length} total employees`}
        action={canManage ? (
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Add Employee
          </Button>
        ) : undefined}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DataTable
          data={employees}
          columns={columns}
          searchPlaceholder="Search by name, email, department..."
          searchKeys={['firstName', 'lastName', 'email', 'department', 'jobTitle']}
          getRowKey={e => e.id}
          onRowClick={e => navigate(`/portal/employees/${e.id}`)}
          emptyTitle="No employees found"
          emptyDescription="Add your first employee to get started."
          exportFilename="employees"
        />
      )}

      {canManage && (
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
              <DialogDescription className="sr-only">Fill in the employee details to create a new employee record.</DialogDescription>
            </DialogHeader>
            <EmployeeForm
              onSubmit={async (data, pendingFiles) => {
                try {
                  const emp = await createEmployee.mutateAsync(data as Partial<Employee>);
                  if (pendingFiles.size > 0) {
                    const docMeta = new Map(data.documents.map(d => [d.id, d]));
                    await Promise.all(
                      Array.from(pendingFiles.entries()).map(([docId, file]) => {
                        const meta = docMeta.get(docId);
                        const fd = new FormData();
                        fd.append('file', file);
                        fd.append('name', file.name);
                        fd.append('docType', meta?.type ?? 'Document');
                        return apiClient.post(`/employees/${emp.id}/documents`, fd, {
                          headers: { 'Content-Type': 'multipart/form-data' },
                        });
                      })
                    );
                  }
                  toast.success(`Employee ${emp.displayId ?? emp.id} created successfully`);
                  setShowForm(false);
                } catch (err: any) {
                  toast.error(err?.response?.data?.error ?? 'Failed to create employee');
                }
              }}
              onCancel={() => setShowForm(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

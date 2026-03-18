import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/shared/PageHeader';
import { DataTable, type Column } from '../components/shared/DataTable';
import { StatusBadge } from '../components/shared/StatusBadge';
import { EmployeeForm } from '../components/employees/EmployeeForm';
import { usePortalData } from '../hooks/usePortalData';
import { formatDate } from '../lib/utils';
import type { Employee } from '../types';

export default function Employees() {
  const navigate = useNavigate();
  const { employees, addEmployee } = usePortalData();
  const [showForm, setShowForm] = useState(false);

  const columns: Column<Employee>[] = [
    {
      key: 'id',
      header: 'ID',
      render: e => <span className="text-xs font-mono text-blue-600">{e.id}</span>,
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
    },
    { key: 'department', header: 'Department' },
    { key: 'jobTitle', header: 'Job Title' },
    {
      key: 'employmentType',
      header: 'Type',
      render: e => <span className="uppercase text-xs font-medium">{e.employmentType}</span>,
    },
    {
      key: 'startDate',
      header: 'Start Date',
      render: e => formatDate(e.startDate),
    },
    {
      key: 'status',
      header: 'Status',
      render: e => <StatusBadge status={e.status} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Employees"
        description={`${employees.length} total employees`}
        action={
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Add Employee
          </Button>
        }
      />

      <DataTable
        data={employees}
        columns={columns}
        searchPlaceholder="Search by name, email, department..."
        searchKeys={['firstName', 'lastName', 'email', 'department', 'jobTitle']}
        getRowKey={e => e.id}
        onRowClick={e => navigate(`/portal/employees/${e.id}`)}
        emptyTitle="No employees found"
        emptyDescription="Add your first employee to get started."
      />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
          </DialogHeader>
          <EmployeeForm
            onSubmit={data => {
              const emp = addEmployee({ ...data, documents: [] });
              toast.success(`Employee ${emp.id} created successfully`);
              setShowForm(false);
            }}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

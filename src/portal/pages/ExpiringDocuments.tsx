import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileWarning } from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';
import { DataTable } from '../components/shared/DataTable';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useExpiringDocuments, type ExpiringDocEntry } from '../hooks/useEmployees';

function urgencyBadge(days: number) {
  if (days <= 14) return <Badge variant="destructive">{days}d left</Badge>;
  if (days <= 30) return <Badge className="bg-amber-100 text-amber-800 border-amber-200">{days}d left</Badge>;
  return <Badge variant="secondary">{days}d left</Badge>;
}

function docTypeBadge(type: string) {
  const lower = type.toLowerCase();
  if (lower.includes('passport'))   return <Badge className="bg-blue-100 text-blue-800 border-blue-200">{type}</Badge>;
  if (lower.includes('visa') || lower.includes('work auth')) return <Badge className="bg-purple-100 text-purple-800 border-purple-200">{type}</Badge>;
  if (lower.includes('opt') || lower.includes('stem'))       return <Badge className="bg-amber-100 text-amber-800 border-amber-200">{type}</Badge>;
  if (lower.includes('i-983') || lower.includes('i983'))     return <Badge className="bg-orange-100 text-orange-800 border-orange-200">{type}</Badge>;
  if (lower.includes('driver') || lower.includes('license')) return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">{type}</Badge>;
  return <Badge variant="outline">{type}</Badge>;
}

export function ExpiringDocuments() {
  const navigate = useNavigate();
  const [days, setDays] = useState(90);
  const { data: docs = [], isLoading } = useExpiringDocuments(days);

  const columns = [
    {
      key: 'employee',
      label: 'Employee',
      render: (r: ExpiringDocEntry) => (
        <div>
          <div className="font-medium text-sm">{r.firstName} {r.lastName}</div>
          <div className="text-xs text-gray-400">{r.displayId}</div>
        </div>
      ),
      getValue: (r: ExpiringDocEntry) => `${r.firstName} ${r.lastName}`,
    },
    {
      key: 'documentType',
      label: 'Document',
      render: (r: ExpiringDocEntry) => docTypeBadge(r.documentType),
      getValue: (r: ExpiringDocEntry) => r.documentType,
    },
    {
      key: 'expiryDate',
      label: 'Expiry Date',
      render: (r: ExpiringDocEntry) => (
        <span className="text-sm">{new Date(r.expiryDate + 'T00:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
      ),
      getValue: (r: ExpiringDocEntry) => r.expiryDate,
    },
    {
      key: 'daysRemaining',
      label: 'Time Remaining',
      render: (r: ExpiringDocEntry) => urgencyBadge(r.daysRemaining),
      getValue: (r: ExpiringDocEntry) => r.daysRemaining,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expiring Documents"
        description={`Documents expiring within the next ${days} days.`}
        actions={
          <Select value={String(days)} onValueChange={v => setDays(Number(v))}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Next 30 days</SelectItem>
              <SelectItem value="60">Next 60 days</SelectItem>
              <SelectItem value="90">Next 90 days</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {!isLoading && docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
          <FileWarning className="h-10 w-10 text-gray-300" />
          <p className="text-sm">No documents expiring in the next {days} days.</p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={docs}
          loading={isLoading}
          onRowClick={r => navigate(`/portal/employees/${r.employeeId}`)}
          emptyMessage="No expiring documents found."
        />
      )}
    </div>
  );
}

export default ExpiringDocuments;

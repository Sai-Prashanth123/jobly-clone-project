import { useState, useMemo } from 'react';
import { Search, Mail, Phone, MapPin, Users2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '../components/shared/PageHeader';
import { useEmployeeDirectory } from '../hooks/useEmployees';
import type { DirectoryEmployee } from '../types';

function Avatar({ emp }: { emp: DirectoryEmployee }) {
  if (emp.avatarUrl) {
    return (
      <img
        src={emp.avatarUrl}
        alt={`${emp.firstName} ${emp.lastName}`}
        className="h-12 w-12 rounded-full object-cover flex-shrink-0"
      />
    );
  }
  const initials = `${emp.firstName[0] ?? ''}${emp.lastName[0] ?? ''}`.toUpperCase();
  const colors = [
    'from-[#4069FF] to-[#32CDDC]',
    'from-violet-500 to-purple-400',
    'from-amber-500 to-orange-400',
    'from-emerald-500 to-teal-400',
  ];
  const color = colors[((emp.firstName.charCodeAt(0) || 65) + (emp.lastName.charCodeAt(0) || 65)) % colors.length];
  return (
    <div className={`h-12 w-12 rounded-full bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0`}>
      <span className="text-white text-[13px] font-semibold">{initials}</span>
    </div>
  );
}

export default function People() {
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState<string>('all');

  const { data: allEmployees = [], isLoading: allLoading } = useEmployeeDirectory();
  const departments = useMemo(
    () => [...new Set(allEmployees.map(e => e.department).filter(Boolean) as string[])].sort(),
    [allEmployees],
  );

  const { data: employees = [], isLoading, isError, refetch } = useEmployeeDirectory(
    search || undefined,
    department !== 'all' ? department : undefined,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Company"
        title="People"
        description="Find and connect with your colleagues."
        onRefresh={refetch}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Search by name, title, or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={department} onValueChange={setDepartment} disabled={allLoading}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder={allLoading ? 'Loading…' : 'All departments'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map(d => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-2 text-[12px] text-gray-500">
        <Users2 className="h-3.5 w-3.5" />
        <span>
          {isLoading ? '…' : employees.length} active {employees.length === 1 ? 'employee' : 'employees'}
          {search && ` matching "${search}"`}
        </span>
      </div>

      {/* Grid */}
      {isError ? (
        <div className="portal-panel p-12 text-center">
          <p className="text-sm text-red-500">Failed to load employee directory. Please refresh.</p>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="portal-panel">
              <div className="portal-panel-body flex items-start gap-3">
                <div className="h-12 w-12 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-36 rounded bg-gray-200 animate-pulse" />
                  <div className="h-3 w-24 rounded bg-gray-200 animate-pulse" />
                  <div className="h-4 w-16 rounded-full bg-gray-200 animate-pulse" />
                  <div className="mt-2 space-y-1.5">
                    <div className="h-3 w-40 rounded bg-gray-200 animate-pulse" />
                    <div className="h-3 w-28 rounded bg-gray-200 animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : employees.length === 0 ? (
        <div className="portal-panel p-12 text-center">
          <Users2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No employees found.</p>
          {(search || department !== 'all') && (
            <button
              className="mt-2 text-[12px] text-[#4069FF] hover:underline"
              onClick={() => { setSearch(''); setDepartment('all'); }}
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((emp, i) => (
            <div
              key={emp.id}
              className="portal-panel portal-stagger"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <div className="portal-panel-body flex items-start gap-3">
                <Avatar emp={emp} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-gray-900 truncate">
                    {emp.firstName} {emp.lastName}
                  </p>
                  {emp.jobTitle && (
                    <p className="text-[12px] text-gray-500 truncate">{emp.jobTitle}</p>
                  )}
                  {emp.department && (
                    <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {emp.department}
                    </span>
                  )}

                  <div className="mt-2 space-y-1">
                    {emp.workEmail && (
                      <a
                        href={`mailto:${emp.workEmail}`}
                        className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-[#4069FF] transition-colors truncate"
                      >
                        <Mail className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{emp.workEmail}</span>
                      </a>
                    )}
                    {emp.phone && (
                      <a
                        href={`tel:${emp.phone}`}
                        className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-[#4069FF] transition-colors"
                      >
                        <Phone className="h-3 w-3 flex-shrink-0" />
                        {emp.phone}
                      </a>
                    )}
                    {emp.workLocation && (
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        {emp.workLocation}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

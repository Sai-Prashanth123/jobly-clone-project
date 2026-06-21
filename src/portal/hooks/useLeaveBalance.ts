import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { LeaveTypeConfig, LeaveBalance } from '../types';

function mapLeaveType(raw: any): LeaveTypeConfig {
  return {
    id:           raw.id,
    displayId:    raw.display_id ?? undefined,
    name:         raw.name,
    code:         raw.code,
    description:  raw.description ?? null,
    accrualType:  raw.accrual_type,
    defaultDays:  Number(raw.default_days ?? 0),
    accrualRate:  raw.accrual_rate != null ? Number(raw.accrual_rate) : null,
    maxCarryover: Number(raw.max_carryover ?? 0),
    color:        raw.color ?? '#6366f1',
    isActive:     raw.is_active ?? true,
    createdAt:    raw.created_at,
    updatedAt:    raw.updated_at,
  };
}

function mapBalance(raw: any): LeaveBalance {
  return {
    leaveType:   mapLeaveType(raw.leaveType ?? raw.leave_type ?? {}),
    year:        raw.year,
    granted:     Number(raw.granted ?? 0),
    carriedOver: Number(raw.carriedOver ?? raw.carried_over ?? 0),
    used:        Number(raw.used ?? 0),
    remaining:   Number(raw.remaining ?? 0),
  };
}

// ── Leave Types ───────────────────────────────────────────────────────────────

export function useLeaveTypes() {
  return useQuery({
    queryKey: ['leave-types'],
    queryFn: async () => {
      const { data } = await apiClient.get('/leave/types');
      return (data.data as any[]).map(mapLeaveType);
    },
    staleTime: 5 * 60_000,
  });
}

export function useCreateLeaveType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<LeaveTypeConfig, 'id' | 'displayId' | 'createdAt' | 'updatedAt'>) => {
      const { data } = await apiClient.post('/leave/types', {
        name:         input.name,
        code:         input.code,
        description:  input.description,
        accrualType:  input.accrualType,
        defaultDays:  input.defaultDays,
        accrualRate:  input.accrualRate,
        maxCarryover: input.maxCarryover,
        color:        input.color,
        isActive:     input.isActive,
      });
      return mapLeaveType(data.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave-types'] }),
  });
}

export function useUpdateLeaveType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<LeaveTypeConfig> & { id: string }) => {
      const { data } = await apiClient.put(`/leave/types/${id}`, {
        name:         input.name,
        code:         input.code,
        description:  input.description,
        accrualType:  input.accrualType,
        defaultDays:  input.defaultDays,
        accrualRate:  input.accrualRate,
        maxCarryover: input.maxCarryover,
        color:        input.color,
        isActive:     input.isActive,
      });
      return mapLeaveType(data.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave-types'] }),
  });
}

export function useDeleteLeaveType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/leave/types/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave-types'] }),
  });
}

// ── Balances ──────────────────────────────────────────────────────────────────

export function useMyLeaveBalances(year?: number) {
  return useQuery({
    queryKey: ['leave-balances', 'me', year],
    queryFn: async () => {
      const params = year ? `?year=${year}` : '';
      const { data } = await apiClient.get(`/leave/balances${params}`);
      return (data.data as any[]).map(mapBalance);
    },
    staleTime: 60_000,
  });
}

export function useEmployeeLeaveBalances(empId: string | undefined, year?: number) {
  return useQuery({
    queryKey: ['leave-balances', empId, year],
    queryFn: async () => {
      const params = year ? `?year=${year}` : '';
      const { data } = await apiClient.get(`/leave/balances/${empId}${params}`);
      return (data.data as any[]).map(mapBalance);
    },
    enabled: !!empId,
    staleTime: 60_000,
  });
}

export function useSetLeaveEntitlement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      empId,
      leaveTypeId,
      year,
      grantedDays,
      carriedOver = 0,
      notes,
    }: {
      empId: string;
      leaveTypeId: string;
      year: number;
      grantedDays: number;
      carriedOver?: number;
      notes?: string;
    }) => {
      const { data } = await apiClient.put(`/leave/entitlements/${empId}`, {
        leaveTypeId,
        year,
        grantedDays,
        carriedOver,
        notes,
      });
      return data.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['leave-balances', vars.empId] });
      qc.invalidateQueries({ queryKey: ['leave-balances', 'me'] });
    },
  });
}

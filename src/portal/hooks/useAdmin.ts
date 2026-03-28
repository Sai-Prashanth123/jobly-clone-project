import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export interface PortalUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'hr' | 'operations' | 'finance' | 'employee';
  employeeId?: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  actorId?: string;
  actorEmail?: string;
  actorName?: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapUser(raw: any): PortalUser {
  return {
    id: raw.id,
    email: raw.email,
    name: raw.name,
    role: raw.role,
    employeeId: raw.employee_id ?? undefined,
    createdAt: raw.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapLog(raw: any): ActivityLog {
  const actor = raw.portal_users ?? null;
  return {
    id: raw.id,
    actorId: raw.actor_id ?? undefined,
    actorEmail: actor?.email ?? undefined,
    actorName: actor?.name ?? undefined,
    actorRole: actor?.role ?? undefined,
    action: raw.action,
    entityType: raw.entity_type,
    entityId: raw.entity_id,
    entityLabel: raw.entity_label ?? undefined,
    metadata: raw.metadata ?? undefined,
    createdAt: raw.created_at,
  };
}

export function usePortalUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/users');
      return (data.data as any[]).map(mapUser);
    },
  });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { data } = await apiClient.patch(`/admin/users/${userId}/role`, { role });
      return mapUser(data.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => apiClient.delete(`/admin/users/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await apiClient.post(`/admin/users/${userId}/reset-password`);
      return data.data.tempPassword as string;
    },
  });
}

export interface ActivityLogsParams {
  entityType?: string;
  action?: string;
  page?: number;
  limit?: number;
}

export function useActivityLogs(params?: ActivityLogsParams) {
  return useQuery({
    queryKey: ['admin', 'activity-logs', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/activity-logs', { params });
      return {
        data: (data.data as any[]).map(mapLog),
        total: data.total as number,
      };
    },
  });
}

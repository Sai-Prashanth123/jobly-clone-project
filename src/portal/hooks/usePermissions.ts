import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

/**
 * The role-permission editor's data.
 *
 * What the server sends is what the ROUTES enforce, seeded from the code
 * rather than from the read-only table this screen used to show — those two
 * disagreed, and obeying the old table would have moved 113 routes and taken
 * 30 away from HR.
 */

export interface PermissionRole { key: string; label: string; is_builtin: boolean }
export interface Permission { key: string; label: string; group_name: string; is_custom: boolean }
export interface Grant { role_key: string; permission_key: string; granted: boolean }

export interface PermissionEditorData {
  roles: PermissionRole[];
  permissions: Permission[];
  grants: Grant[];
}

export function usePermissionEditor() {
  return useQuery({
    queryKey: ['permissions', 'editor'],
    queryFn: async (): Promise<PermissionEditorData> => {
      const { data } = await apiClient.get('/permissions');
      return data.data as PermissionEditorData;
    },
  });
}

export function useSetGrant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (change: Grant) => {
      await apiClient.patch('/permissions/grant', change);
    },
    // Refetch rather than patching the cache by hand: the server refuses some
    // changes (the last admin grant), so the truth after a write is whatever
    // it says, not what was asked for.
    onSettled: () => { void qc.invalidateQueries({ queryKey: ['permissions', 'editor'] }); },
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (role: { key: string; label: string }) => {
      await apiClient.post('/permissions/roles', role);
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: ['permissions', 'editor'] }); },
  });
}

export function useCreateCustomPermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { key: string; label: string; group_name: string }) => {
      await apiClient.post('/permissions/custom', p);
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: ['permissions', 'editor'] }); },
  });
}

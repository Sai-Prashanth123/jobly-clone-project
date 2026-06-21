import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export type OffboardingCategory = 'it'|'hr'|'compliance'|'equipment'|'finance'|'general';
export interface OffboardingTemplate { id: string; title: string; description?: string | null; category: OffboardingCategory; isRequired: boolean; sortOrder: number; isActive: boolean; }
export interface OffboardingTask { id: string; employeeId: string; templateId?: string | null; title: string; description?: string | null; category: OffboardingCategory; isRequired: boolean; isCompleted: boolean; completedBy?: string | null; completedAt?: string | null; notes?: string | null; dueDate?: string | null; sortOrder: number; completedByName?: string | null; }

const CAT_COLORS: Record<OffboardingCategory, string> = { it:'bg-blue-100 text-blue-700', hr:'bg-violet-100 text-violet-700', compliance:'bg-red-100 text-red-700', equipment:'bg-amber-100 text-amber-700', finance:'bg-green-100 text-green-700', general:'bg-gray-100 text-gray-600' };
export { CAT_COLORS };

function mapTemplate(r: any): OffboardingTemplate { return { id: r.id, title: r.title, description: r.description ?? null, category: r.category, isRequired: r.is_required, sortOrder: r.sort_order, isActive: r.is_active }; }
function mapTask(r: any): OffboardingTask { return { id: r.id, employeeId: r.employee_id, templateId: r.template_id ?? null, title: r.title, description: r.description ?? null, category: r.category, isRequired: r.is_required, isCompleted: r.is_completed, completedBy: r.completed_by ?? null, completedAt: r.completed_at ?? null, notes: r.notes ?? null, dueDate: r.due_date ?? null, sortOrder: r.sort_order, completedByName: r.completed_by_user?.name ?? null }; }

export function useOffboardingTemplates() {
  return useQuery({ queryKey: ['offboarding-templates'], queryFn: async () => { const { data } = await apiClient.get('/offboarding-checklist/templates'); return (data.data as any[]).map(mapTemplate); } });
}
export function useCreateOffboardingTemplate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (input: Omit<OffboardingTemplate,'id'>) => { const { data } = await apiClient.post('/offboarding-checklist/templates', input); return mapTemplate(data.data); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['offboarding-templates'] }) });
}
export function useUpdateOffboardingTemplate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async ({ id, ...input }: OffboardingTemplate) => { const { data } = await apiClient.put(`/offboarding-checklist/templates/${id}`, input); return mapTemplate(data.data); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['offboarding-templates'] }) });
}
export function useDeleteOffboardingTemplate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (id: string) => { await apiClient.delete(`/offboarding-checklist/templates/${id}`); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['offboarding-templates'] }) });
}
export function useEmployeeOffboardingTasks(employeeId?: string) {
  return useQuery({ queryKey: ['offboarding-tasks', employeeId], queryFn: async () => { const { data } = await apiClient.get(`/offboarding-checklist/tasks/${employeeId}`); return (data.data as any[]).map(mapTask); }, enabled: !!employeeId });
}
export function useGenerateOffboardingTasks() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (employeeId: string) => { await apiClient.post(`/offboarding-checklist/tasks/${employeeId}/generate`); }, onSuccess: (_d, eid) => qc.invalidateQueries({ queryKey: ['offboarding-tasks', eid] }) });
}
export function useToggleOffboardingTask() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async ({ taskId, employeeId }: { taskId: string; employeeId: string }) => { const { data } = await apiClient.patch(`/offboarding-checklist/tasks/${taskId}/toggle`); return mapTask(data.data); }, onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['offboarding-tasks', v.employeeId] }) });
}

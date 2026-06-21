import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export type ChecklistCategory = 'it' | 'hr' | 'compliance' | 'equipment' | 'finance' | 'general';

export interface ChecklistTemplate {
  id: string;
  title: string;
  description?: string | null;
  category: ChecklistCategory;
  isRequired: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingTask {
  id: string;
  employeeId: string;
  templateId?: string | null;
  title: string;
  description?: string | null;
  category: ChecklistCategory;
  isRequired: boolean;
  isCompleted: boolean;
  completedBy?: string | null;
  completedByName?: string | null;
  completedAt?: string | null;
  notes?: string | null;
  dueDate?: string | null;
  sortOrder: number;
  createdAt: string;
}

function mapTemplate(raw: any): ChecklistTemplate {
  return {
    id:          raw.id,
    title:       raw.title,
    description: raw.description ?? null,
    category:    raw.category as ChecklistCategory,
    isRequired:  raw.is_required,
    sortOrder:   raw.sort_order,
    isActive:    raw.is_active,
    createdAt:   raw.created_at,
    updatedAt:   raw.updated_at,
  };
}

function mapTask(raw: any): OnboardingTask {
  return {
    id:              raw.id,
    employeeId:      raw.employee_id,
    templateId:      raw.template_id ?? null,
    title:           raw.title,
    description:     raw.description ?? null,
    category:        raw.category as ChecklistCategory,
    isRequired:      raw.is_required,
    isCompleted:     raw.is_completed,
    completedBy:     raw.completed_by ?? null,
    completedByName: raw.completed_by_user?.name ?? null,
    completedAt:     raw.completed_at ?? null,
    notes:           raw.notes ?? null,
    dueDate:         raw.due_date ?? null,
    sortOrder:       raw.sort_order,
    createdAt:       raw.created_at,
  };
}

// ── Templates ──────────────────────────────────────────────────────────────────

export function useChecklistTemplates() {
  return useQuery({
    queryKey: ['checklist-templates'],
    queryFn: async () => {
      const { data } = await apiClient.get('/onboarding-checklist/templates');
      return (data.data as any[]).map(mapTemplate);
    },
    staleTime: 5 * 60_000,
  });
}

export function useCreateChecklistTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<ChecklistTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
      const { data } = await apiClient.post('/onboarding-checklist/templates', {
        title: input.title, description: input.description, category: input.category,
        isRequired: input.isRequired, sortOrder: input.sortOrder, isActive: input.isActive,
      });
      return mapTemplate(data.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist-templates'] }),
  });
}

export function useUpdateChecklistTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<ChecklistTemplate> & { id: string }) => {
      const { data } = await apiClient.put(`/onboarding-checklist/templates/${id}`, {
        title: input.title, description: input.description, category: input.category,
        isRequired: input.isRequired, sortOrder: input.sortOrder, isActive: input.isActive,
      });
      return mapTemplate(data.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist-templates'] }),
  });
}

export function useDeleteChecklistTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await apiClient.delete(`/onboarding-checklist/templates/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist-templates'] }),
  });
}

// ── Employee Tasks ──────────────────────────────────────────────────────────────

export function useEmployeeOnboardingTasks(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['onboarding-tasks', employeeId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/onboarding-checklist/tasks/${employeeId}`);
      return (data.data as any[]).map(mapTask);
    },
    enabled: !!employeeId,
    staleTime: 30_000,
  });
}

export function useAddOnboardingTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ employeeId, ...input }: { employeeId: string; title: string; description?: string; category?: ChecklistCategory; isRequired?: boolean; dueDate?: string; notes?: string }) => {
      const { data } = await apiClient.post(`/onboarding-checklist/tasks/${employeeId}`, input);
      return mapTask(data.data);
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['onboarding-tasks', v.employeeId] }),
  });
}

export function useToggleOnboardingTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, employeeId }: { taskId: string; employeeId: string }) => {
      const { data } = await apiClient.patch(`/onboarding-checklist/tasks/${taskId}/toggle`);
      return mapTask(data.data);
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['onboarding-tasks', v.employeeId] }),
  });
}

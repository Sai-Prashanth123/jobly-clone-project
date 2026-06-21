import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export type Proficiency = 'beginner'|'intermediate'|'advanced'|'expert';
export interface Skill { id: string; employeeId: string; skillName: string; proficiency: Proficiency; lastUsedYear?: number | null; isPrimary: boolean; employeeName?: string; employeeTitle?: string; employeeDept?: string; }

const PROF_COLORS: Record<Proficiency, string> = { beginner:'bg-gray-100 text-gray-600', intermediate:'bg-blue-100 text-blue-700', advanced:'bg-violet-100 text-violet-700', expert:'bg-amber-100 text-amber-700' };
export { PROF_COLORS };

function map(r: any): Skill {
  const e = r.employee ?? {};
  return { id: r.id, employeeId: r.employee_id, skillName: r.skill_name, proficiency: r.proficiency, lastUsedYear: r.last_used_year ?? null, isPrimary: r.is_primary, employeeName: e.first_name ? `${e.first_name} ${e.last_name}`.trim() : undefined, employeeTitle: e.job_title, employeeDept: e.department };
}

export function useEmployeeSkills(employeeId?: string) {
  return useQuery({ queryKey: ['skills', employeeId], queryFn: async () => { const { data } = await apiClient.get(`/skills/employee/${employeeId}`); return (data.data as any[]).map(map); }, enabled: !!employeeId });
}
export function useSkillSearch(skill: string) {
  return useQuery({ queryKey: ['skills-search', skill], queryFn: async () => { const { data } = await apiClient.get('/skills/search', { params: { skill } }); return (data.data as any[]).map(map); }, enabled: skill.length >= 2, staleTime: 30_000 });
}
export function useAddSkill() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async ({ employeeId, ...input }: { employeeId: string; skillName: string; proficiency?: string; lastUsedYear?: number; isPrimary?: boolean }) => { const { data } = await apiClient.post(`/skills/employee/${employeeId}`, input); return map(data.data); }, onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['skills', v.employeeId] }) });
}
export function useUpdateSkill() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async ({ id, employeeId, ...input }: { id: string; employeeId: string; proficiency?: string; lastUsedYear?: number; isPrimary?: boolean }) => { const { data } = await apiClient.put(`/skills/${id}`, input); return map(data.data); }, onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['skills', v.employeeId] }) });
}
export function useDeleteSkill() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async ({ id, employeeId }: { id: string; employeeId: string }) => { await apiClient.delete(`/skills/${id}`); }, onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['skills', v.employeeId] }) });
}

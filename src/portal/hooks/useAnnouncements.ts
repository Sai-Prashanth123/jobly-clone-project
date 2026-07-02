import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { Announcement, AnnouncementType, UserRole } from '../types';

function mapAnnouncement(raw: any): Announcement {
  return {
    id:          raw.id,
    displayId:   raw.display_id ?? undefined,
    title:       raw.title,
    body:        raw.body,
    type:        raw.type as AnnouncementType,
    isPinned:    raw.is_pinned ?? false,
    targetRoles: raw.target_roles ?? [],
    authorId:    raw.author_id ?? undefined,
    author:      raw.author ?? undefined,
    expiresAt:   raw.expires_at ?? null,
    deletedAt:   raw.deleted_at ?? null,
    createdAt:   raw.created_at,
    updatedAt:   raw.updated_at,
  };
}

export interface AnnouncementsFilter {
  type?: AnnouncementType;
  limit?: number;
  page?: number;
}

export function useAnnouncements(filter: AnnouncementsFilter = {}) {
  return useQuery({
    queryKey: ['announcements', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter.type)  params.set('type',  filter.type);
      if (filter.limit) params.set('limit', String(filter.limit));
      if (filter.page)  params.set('page',  String(filter.page));
      const { data } = await apiClient.get(`/announcements?${params}`);
      return {
        data:  (data.data as any[]).map(mapAnnouncement),
        total: data.total as number,
      };
    },
    staleTime: 60_000,
  });
}

export function useAnnouncement(id: string | undefined) {
  return useQuery({
    queryKey: ['announcements', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/announcements/${id}`);
      return mapAnnouncement(data.data);
    },
    enabled: !!id,
  });
}

export interface CreateAnnouncementInput {
  title: string;
  body: string;
  type: AnnouncementType;
  isPinned: boolean;
  targetRoles: UserRole[];
  expiresAt?: string | null;
}

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAnnouncementInput) => {
      const { data } = await apiClient.post('/announcements', input);
      return mapAnnouncement(data.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  });
}

export function useUpdateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<CreateAnnouncementInput> & { id: string }) => {
      const { data } = await apiClient.put(`/announcements/${id}`, input);
      return mapAnnouncement(data.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  });
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/announcements/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  });
}

export function useMarkAnnouncementsSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post('/announcements/mark-seen'),
    onSuccess: () => {
      qc.setQueryData(['announcements-unread-count'], 0);
      // Zero the announcements count inside the consolidated nav-badges cache.
      qc.setQueriesData({ queryKey: ['nav-badges'] }, (prev: unknown) =>
        prev && typeof prev === 'object' ? { ...prev, announcements: 0 } : prev,
      );
    },
  });
}

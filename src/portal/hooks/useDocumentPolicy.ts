import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

/**
 * Which documents each work status needs.
 *
 * One endpoint serves the whole app. The frontend and backend each kept their
 * own copy of these lists, keyed differently — by row type on one side and by
 * label on the other — with a test existing solely to stop the two drifting.
 */

export type DocState = 'required' | 'optional' | 'hidden';

export interface PolicyDocument {
  key: string;
  label: string;
  issuedBy: string;
  hasExpiry: boolean;
  aliases: string[];
  states: Record<string, DocState>;
}

export interface DocumentPolicy {
  documents: PolicyDocument[];
  visaTypes: string[];
}

export function useDocumentPolicy() {
  return useQuery({
    queryKey: ['document-policy'],
    queryFn: async (): Promise<DocumentPolicy> => {
      const { data } = await apiClient.get('/document-policy');
      return data.data as DocumentPolicy;
    },
    // The wizard reads this on every render of the documents section; it
    // changes rarely, and a stale minute is cheaper than a request per view.
    staleTime: 60_000,
  });
}

export function useSetDocumentState() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (change: { document_key: string; visa_type: string; state: DocState }) => {
      const { data } = await apiClient.patch('/document-policy/state', change);
      return data as { success: boolean; warning?: string };
    },
    // Refetch rather than patching the cache: the server decides, and it can
    // answer with a warning the UI needs to show.
    onSettled: () => { void qc.invalidateQueries({ queryKey: ['document-policy'] }); },
  });
}

export function useSetDocumentAliases() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, aliases }: { key: string; aliases: string[] }) => {
      await apiClient.patch(`/document-policy/${key}/aliases`, { aliases });
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: ['document-policy'] }); },
  });
}

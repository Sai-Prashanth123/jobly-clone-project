import { QueryCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getApiErrorMessage, getStatus } from './apiError';

export const queryClient = new QueryClient({
  // Any data load that fails surfaces a clear popup with the reason, instead of
  // failing silently in the console. Mutations keep their own toasts at the
  // call site. A query can opt out by setting meta.silentError = true.
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.silentError) return;
      const status = getStatus(error);
      // 401 is handled by the apiClient redirect to login — don't double-notify.
      if (status === 401) return;
      const { title, description } = getApiErrorMessage(error);
      // Stable id dedupes identical errors that fire together (e.g. several
      // queries returning 403 at once) into a single toast.
      toast.error(title, { description, id: `api-${status ?? 'net'}-${description}` });
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,       // 30 seconds
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getApiErrorMessage, getStatus } from './apiError';

// Single, app-wide place that turns ANY failed request (query OR mutation) into
// a user-visible toast — so a status code that lands in the console is never
// silent in the UI. Lives on the TanStack caches because their onError fires for
// every query/mutation failure, regardless of the call site.
//
// Opt out per query/mutation with `meta: { silentError: true }` — used for the
// deliberately-quiet cases (deleted-employee 404 tolerance, background polls).
function surfaceRequestError(error: unknown, meta?: Record<string, unknown> | undefined) {
  if (meta?.silentError) return;

  const status = getStatus(error);
  // 401 (session) and the PASSWORD_RESET_REQUIRED 403 are handled by apiClient's
  // interceptor (it redirects); a toast there would be noise mid-redirect.
  if (status === 401) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (status === 403 && (error as any)?.response?.data?.code === 'PASSWORD_RESET_REQUIRED') return;
  // Cancelled requests (e.g. the idle-timeout reject) aren't user errors.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((error as any)?.code === 'ERR_CANCELED' || (error as any)?.name === 'CanceledError') return;

  const { title, description } = getApiErrorMessage(error);
  // Stable id → identical concurrent failures (and a call-site toast that reuses
  // this id) collapse into one toast instead of stacking.
  toast.error(title, { description, id: `reqerr-${status ?? 'net'}-${description}` });
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => surfaceRequestError(error, query.meta),
  }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => surfaceRequestError(error, mutation.meta),
  }),
  defaultOptions: {
    queries: {
      staleTime: 60_000,        // 60 s — lists won't refetch on every tab switch
      gcTime: 5 * 60_000,       // keep unused cache for 5 min (was default 5 min, explicit now)
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

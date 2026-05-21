import { QueryClient } from '@tanstack/react-query';

// Error toasts are surfaced centrally in apiClient's response interceptor
// (it runs for every HTTP response, so it's the most reliable place). See
// apiClient.ts.
export const queryClient = new QueryClient({
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

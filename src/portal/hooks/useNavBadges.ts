import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

// One consolidated request for all sidebar badge counts. The backend runs the
// count queries in parallel and caches the role-shared portion, so this is
// dramatically cheaper than the previous 7 independently-polled queries.
const POLL = 120_000; // 2 min

interface NavBadgeCounts {
  timesheets: number;
  leaveRequests: number;
  expenses: number;
  attendanceReview: number;
  expiringDocs: number;
  announcements: number;
}

const ZERO: NavBadgeCounts = {
  timesheets: 0, leaveRequests: 0, expenses: 0,
  attendanceReview: 0, expiringDocs: 0, announcements: 0,
};

export function useNavBadges(role: string): Record<string, number> {
  const { data } = useQuery<NavBadgeCounts>({
    queryKey: ['nav-badges', role],
    queryFn: async () => {
      const res = await apiClient.get('/nav-badges');
      return res.data.data ?? ZERO;
    },
    staleTime: POLL,
    refetchInterval: POLL,
    enabled: !!role,
    meta: { silentError: true }, // badge counts failing shouldn't toast
  });

  return { ...ZERO, ...(data ?? {}) };
}

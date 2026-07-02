import { supabaseAdmin } from '../config/supabase';
import { getAnnouncementUnreadCount } from './announcements.service';
import { listExpiringDocuments } from './employees.service';

// Consolidated sidebar badge counts. Replaces 7 separate polled endpoints —
// one request returns everything, with the role-shared counts cached briefly
// so concurrent users of the same role share a single set of DB queries.

export interface NavBadgeCounts {
  timesheets: number;
  leaveRequests: number;
  expenses: number;
  attendanceReview: number;
  expiringDocs: number;
  announcements: number;
}

interface SharedCounts {
  timesheets: number;
  leaveRequests: number;
  expenses: number;
  attendanceReview: number;
  expiringDocs: number;
}

// Role-keyed cache for the counts that are identical across users of a role.
// Announcements (per-user last-viewed) and employee-scoped counts are never cached.
const CACHE_TTL_MS = 60_000;
const sharedCache = new Map<string, { at: number; data: SharedCounts }>();

async function headCount(table: string, apply: (q: any) => any): Promise<number> {
  const { count, error } = await apply(
    supabaseAdmin.from(table).select('id', { count: 'exact', head: true }),
  );
  if (error) throw error;
  return count ?? 0;
}

async function getSharedCounts(role: string): Promise<SharedCounts> {
  const hit = sharedCache.get(role);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const isHrAdmin = role === 'admin' || role === 'hr';
  const canActOnTimesheets = ['admin', 'hr', 'operations', 'finance'].includes(role);
  const canActOnExpenses = ['admin', 'hr', 'finance'].includes(role);

  const [timesheets, leaveRequests, expenses, attendanceReview, expiringDocs] = await Promise.all([
    canActOnTimesheets ? headCount('timesheets', q => q.eq('status', 'submitted')) : Promise.resolve(0),
    isHrAdmin ? headCount('leave_requests', q => q.eq('status', 'pending')) : Promise.resolve(0),
    canActOnExpenses ? headCount('expense_reports', q => q.eq('status', 'submitted')) : Promise.resolve(0),
    isHrAdmin ? headCount('monthly_timesheets', q => q.eq('status', 'submitted')) : Promise.resolve(0),
    isHrAdmin ? listExpiringDocuments(30).then(d => d.length).catch(() => 0) : Promise.resolve(0),
  ]);

  const data: SharedCounts = { timesheets, leaveRequests, expenses, attendanceReview, expiringDocs };
  sharedCache.set(role, { at: Date.now(), data });
  return data;
}

export async function getNavBadges(user: { id: string; role: string; employeeId?: string }): Promise<NavBadgeCounts> {
  const { id, role, employeeId } = user;
  const isEmployee = role === 'employee';
  const canActOnTimesheets = ['admin', 'hr', 'operations', 'finance'].includes(role);
  const canActOnExpenses = ['admin', 'hr', 'finance'].includes(role);

  const [shared, announcements, myTimesheets, myExpenses] = await Promise.all([
    getSharedCounts(role),
    (async () => {
      const { data: pu } = await supabaseAdmin
        .from('portal_users')
        .select('announcements_last_viewed_at')
        .eq('id', id)
        .single();
      return getAnnouncementUnreadCount(role, (pu as any)?.announcements_last_viewed_at ?? null);
    })().catch(() => 0),
    isEmployee && employeeId
      ? headCount('timesheets', q => q.eq('status', 'submitted').eq('employee_id', employeeId))
      : Promise.resolve(0),
    isEmployee && employeeId
      ? headCount('expense_reports', q => q.eq('status', 'submitted').eq('employee_id', employeeId))
      : Promise.resolve(0),
  ]);

  return {
    timesheets: canActOnTimesheets ? shared.timesheets : myTimesheets,
    leaveRequests: shared.leaveRequests,
    expenses: canActOnExpenses ? shared.expenses : myExpenses,
    attendanceReview: shared.attendanceReview,
    expiringDocs: shared.expiringDocs,
    announcements,
  };
}

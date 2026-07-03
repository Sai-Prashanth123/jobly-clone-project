import { supabaseAdmin } from '../config/supabase';

// ── Headcount & Turnover ─────────────────────────────────────────────────────

export async function getHeadcount() {
  const { data: employees } = await supabaseAdmin
    .from('employees')
    .select('id, status, department, employment_type, start_date, created_at')
    .is('deleted_at', null);

  const all = employees ?? [];
  const active = all.filter(e => e.status === 'active');
  const inactive = all.filter(e => e.status === 'inactive');

  // Hires per month (last 12 months)
  const hiresMap: Record<string, number> = {};
  const termsMap: Record<string, number> = {};
  for (const e of all) {
    const m = (e.start_date ?? e.created_at ?? '').slice(0, 7);
    if (m) hiresMap[m] = (hiresMap[m] ?? 0) + 1;
  }

  // Department breakdown
  const deptMap: Record<string, number> = {};
  for (const e of active) {
    const d = e.department ?? 'Unassigned';
    deptMap[d] = (deptMap[d] ?? 0) + 1;
  }

  const turnoverRate = all.length > 0 ? ((inactive.length / all.length) * 100).toFixed(1) : '0.0';

  return {
    total: all.length,
    active: active.length,
    inactive: inactive.length,
    turnoverRate: parseFloat(turnoverRate),
    hiresPerMonth: hiresMap,
    byDepartment: deptMap,
    byEmploymentType: all.reduce((acc: Record<string, number>, e) => {
      const t = e.employment_type ?? 'unknown';
      acc[t] = (acc[t] ?? 0) + 1;
      return acc;
    }, {}),
  };
}

export async function getMilestones(month: string) {
  const [y, m] = month.split('-').map(Number);
  const { data: employees } = await supabaseAdmin
    .from('employees')
    .select('id, first_name, last_name, dob, start_date, department, job_title, display_id')
    .eq('status', 'active')
    .is('deleted_at', null);

  const birthdays: any[] = [];
  const anniversaries: any[] = [];
  const now = new Date();

  for (const e of employees ?? []) {
    if (e.dob) {
      // dob/start_date are YYYY-MM-DD strings parsed as UTC midnight — read
      // them back with UTC getters too, or a server west of UTC rolls
      // early-month dates into the previous month.
      const d = new Date(e.dob);
      if (d.getUTCMonth() + 1 === m) {
        birthdays.push({ ...e, type: 'birthday', day: d.getUTCDate() });
      }
    }
    if (e.start_date) {
      const s = new Date(e.start_date);
      if (s.getUTCMonth() + 1 === m) {
        const thisYearAnniversary = Date.UTC(now.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate());
        const nowUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
        const years = now.getUTCFullYear() - s.getUTCFullYear() - (nowUTC >= thisYearAnniversary ? 0 : 1);
        anniversaries.push({ ...e, type: 'anniversary', day: s.getUTCDate(), years });
      }
    }
  }
  return { birthdays, anniversaries };
}

// ── Probation ────────────────────────────────────────────────────────────────

export async function getProbationEmployees() {
  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('id, display_id, first_name, last_name, department, job_title, start_date, probation_end_date')
    .eq('status', 'active')
    .not('probation_end_date', 'is', null)
    .order('probation_end_date');
  if (error) throw error;
  const now = new Date();
  return (data ?? []).map(e => ({
    ...e,
    daysLeft: e.probation_end_date ? Math.ceil((new Date(e.probation_end_date).getTime() - now.getTime()) / 86400000) : null,
    isOverdue: e.probation_end_date ? new Date(e.probation_end_date) < now : false,
  }));
}

// ── Capacity Utilization ──────────────────────────────────────────────────────

// Last day of a YYYY-MM month as YYYY-MM-DD (Date.UTC(y, m, 0) = day 0 of the
// NEXT month = last day of month m). Hard-coding "-31" raises Postgres 22008
// (date out of range) for 30-day months and February.
function monthEndStr(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export async function getCapacityUtilization(month: string) {
  const start = `${month}-01`;
  const end = monthEndStr(month);

  const [emps, timesheets] = await Promise.all([
    supabaseAdmin.from('employees').select('id, first_name, last_name, display_id, department').eq('status', 'active').is('deleted_at', null),
    supabaseAdmin.from('timesheets').select('employee_id, total_hours').gte('week_start_date', start).lte('week_start_date', end).in('status', ['submitted','manager_approved','client_approved']),
  ]);

  const hoursMap = new Map<string, number>();
  for (const ts of timesheets.data ?? []) {
    hoursMap.set(ts.employee_id, (hoursMap.get(ts.employee_id) ?? 0) + (ts.total_hours ?? 0));
  }

  const workingHours = 160; // ~40h/week × 4 weeks
  return (emps.data ?? []).map(e => {
    const billed = hoursMap.get(e.id) ?? 0;
    return { ...e, billedHours: billed, workingHours, utilizationPct: Math.min(100, Math.round((billed / workingHours) * 100)) };
  }).sort((a, b) => b.utilizationPct - a.utilizationPct);
}

// ── Workforce Availability ───────────────────────────────────────────────────

export async function getWorkforceAvailability(startDate: string, endDate: string) {
  const [emps, leaves] = await Promise.all([
    supabaseAdmin.from('employees').select('id, first_name, last_name, display_id, department').eq('status', 'active').is('deleted_at', null),
    supabaseAdmin.from('leave_requests').select('employee_id, start_date, end_date, leave_type').eq('status', 'approved').gte('end_date', startDate).lte('start_date', endDate),
  ]);

  const leavesByEmp = new Map<string, { start: string; end: string }[]>();
  for (const lr of leaves.data ?? []) {
    if (!leavesByEmp.has(lr.employee_id)) leavesByEmp.set(lr.employee_id, []);
    leavesByEmp.get(lr.employee_id)!.push({ start: lr.start_date, end: lr.end_date });
  }

  return (emps.data ?? []).map(e => ({
    ...e,
    leaveRanges: leavesByEmp.get(e.id) ?? [],
  }));
}

// ── Contractor Compliance ─────────────────────────────────────────────────────

export async function getContractorCompliance() {
  // Column is visa_expiry (not visa_expiry_date); employment_type values are
  // lowercase; i9_status values are pending|complete|expired. This endpoint is
  // visible to operations — never return the raw bank account number.
  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('id, display_id, first_name, last_name, department, job_title, employment_type, visa_type, visa_expiry, i9_status, bank_account_number')
    .in('employment_type', ['1099', 'c2c', 'contract'])
    .eq('status', 'active')
    .is('deleted_at', null);
  if (error) throw error;

  const now = new Date();
  const in90 = new Date(now.getTime() + 90 * 86400000);

  return (data ?? []).map(e => {
    const issues: string[] = [];
    if (!e.visa_expiry) issues.push('Missing visa expiry');
    else if (new Date(e.visa_expiry) < in90) issues.push(`Visa expiring: ${e.visa_expiry}`);
    if (e.i9_status !== 'complete') issues.push('I-9 not verified');
    if (!e.bank_account_number) issues.push('Missing bank info');
    const { bank_account_number, ...safe } = e;
    return { ...safe, hasBankInfo: !!bank_account_number, issues, riskLevel: issues.length === 0 ? 'ok' : issues.length === 1 ? 'warn' : 'critical' };
  }).sort((a, b) => (b.issues.length) - (a.issues.length));
}

// ── Client SLA ────────────────────────────────────────────────────────────────

export async function getClientSLA(month: string) {
  const start = `${month}-01`;
  const end = monthEndStr(month);

  const [clients, assignments, timesheets] = await Promise.all([
    supabaseAdmin.from('clients').select('id, company_name, display_id').is('deleted_at', null),
    supabaseAdmin.from('assignments').select('id, client_id, employee_id, max_hours_per_week').eq('status', 'active'),
    supabaseAdmin.from('timesheets').select('employee_id, total_hours, week_start_date, assignment_id').gte('week_start_date', start).lte('week_start_date', end).in('status', ['submitted','manager_approved','client_approved']),
  ]);

  const clientMap = new Map((clients.data ?? []).map(c => [c.id, c]));
  const assignByClient = new Map<string, { contractedHours: number; billedHours: number }>();

  for (const a of assignments.data ?? []) {
    if (!a.client_id) continue;
    const existing = assignByClient.get(a.client_id) ?? { contractedHours: 0, billedHours: 0 };
    existing.contractedHours += (a.max_hours_per_week ?? 40) * 4;
    assignByClient.set(a.client_id, existing);
  }
  for (const ts of timesheets.data ?? []) {
    const a = (assignments.data ?? []).find(x => x.id === ts.assignment_id);
    if (!a?.client_id) continue;
    const existing = assignByClient.get(a.client_id);
    if (existing) existing.billedHours += ts.total_hours ?? 0;
  }

  return Array.from(assignByClient.entries()).map(([clientId, d]) => ({
    clientId,
    clientName: clientMap.get(clientId)?.company_name ?? 'Unknown',
    ...d,
    fulfillmentPct: d.contractedHours > 0 ? Math.round((d.billedHours / d.contractedHours) * 100) : 0,
  })).sort((a, b) => a.fulfillmentPct - b.fulfillmentPct);
}

// ── Cash Flow Forecast ────────────────────────────────────────────────────────

export async function getCashFlowForecast(months: number = 3) {
  // Templates store line_items (JSONB {quantity, unitPrice}) + tax_rate +
  // frequency (weekly|biweekly|monthly|quarterly|semiannual|yearly) — there is
  // no `amount`/`billing_cycle` column, so derive the per-run total here.
  const { data: recurring } = await supabaseAdmin
    .from('recurring_invoice_templates')
    .select('line_items, tax_rate, frequency')
    .eq('status', 'active');

  const runTotal = (r: any): number => {
    const subtotal = ((r.line_items as any[]) ?? []).reduce(
      (s, li) => s + (Number(li?.quantity) || 1) * (Number(li?.unitPrice) || 0), 0,
    );
    return subtotal * (1 + (Number(r.tax_rate) || 0) / 100);
  };

  const now = new Date();
  const forecast: Array<{ month: string; projectedRevenue: number }> = [];

  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    let revenue = 0;
    for (const r of recurring ?? []) {
      const amt = runTotal(r);
      switch (r.frequency) {
        case 'weekly':     revenue += amt * (52 / 12); break; // monthly equivalent
        case 'biweekly':   revenue += amt * (26 / 12); break;
        case 'monthly':    revenue += amt; break;
        case 'quarterly':  if (i % 3 === 0) revenue += amt; break;
        case 'semiannual': if (i % 6 === 0) revenue += amt; break;
        case 'yearly':     if (i === 0) revenue += amt; break;
        default:           revenue += amt; break;
      }
    }
    forecast.push({ month: label, projectedRevenue: Math.round(revenue * 100) / 100 });
  }
  return forecast;
}

// ── Invoice Analytics ─────────────────────────────────────────────────────────

export async function getInvoiceAnalytics() {
  // Real columns are issue_date / paid_at; invoices are hard-deleted (no deleted_at).
  const { data: invoices } = await supabaseAdmin
    .from('invoices')
    .select('id, status, total_amount, issue_date, due_date, paid_at, client_id');

  const all = invoices ?? [];
  const paid = all.filter(i => i.status === 'paid');
  const overdue = all.filter(i => i.status === 'overdue' || (i.status === 'sent' && i.due_date && new Date(i.due_date) < new Date()));

  const paidWithDates = paid.filter(i => i.issue_date && i.paid_at);
  const avgDaysToPay = paidWithDates.length > 0
    ? paidWithDates.reduce((sum, i) => {
        const days = Math.ceil((new Date(i.paid_at!).getTime() - new Date(i.issue_date!).getTime()) / 86400000);
        return sum + days;
      }, 0) / paidWithDates.length : 0;

  const totalRevenue = paid.reduce((s, i) => s + Number(i.total_amount ?? 0), 0);
  const totalOutstanding = all.filter(i => ['sent','overdue'].includes(i.status)).reduce((s, i) => s + Number(i.total_amount ?? 0), 0);

  // Aging buckets
  const now = new Date();
  const aging = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  for (const i of overdue) {
    if (!i.due_date) continue;
    const days = Math.floor((now.getTime() - new Date(i.due_date).getTime()) / 86400000);
    if (days <= 30) aging['0-30'] += Number(i.total_amount ?? 0);
    else if (days <= 60) aging['31-60'] += Number(i.total_amount ?? 0);
    else if (days <= 90) aging['61-90'] += Number(i.total_amount ?? 0);
    else aging['90+'] += Number(i.total_amount ?? 0);
  }

  return {
    totalInvoices: all.length, totalRevenue, totalOutstanding,
    avgDaysToPay: Math.round(avgDaysToPay),
    collectionRate: all.length > 0 ? Math.round((paid.length / all.length) * 100) : 0,
    overdueCount: overdue.length, agingBuckets: aging,
  };
}

// ── Expense Analytics ─────────────────────────────────────────────────────────

export async function getExpenseAnalytics() {
  const { data: expenses } = await supabaseAdmin
    .from('expense_reports')
    .select('amount, category, status, expense_date, employee_id')
    .is('deleted_at', null)
    .neq('status', 'draft');

  const all = expenses ?? [];
  const approved = all.filter(e => ['approved','paid'].includes(e.status));

  const byCategory: Record<string, number> = {};
  const byMonth: Record<string, number> = {};

  for (const e of approved) {
    const cat = e.category ?? 'other';
    byCategory[cat] = (byCategory[cat] ?? 0) + Number(e.amount ?? 0);
    const m = (e.expense_date ?? '').slice(0, 7);
    if (m) byMonth[m] = (byMonth[m] ?? 0) + Number(e.amount ?? 0);
  }

  return {
    totalSubmitted: all.length,
    totalApproved: approved.length,
    totalAmount: approved.reduce((s, e) => s + Number(e.amount ?? 0), 0),
    byCategory,
    byMonth,
  };
}

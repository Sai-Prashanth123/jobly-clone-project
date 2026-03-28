import { supabaseAdmin } from '../config/supabase';

export async function getEmployeeUtilization() {
  const { data: assignments } = await supabaseAdmin
    .from('assignments')
    .select('employee_id, max_hours_per_week')
    .eq('status', 'active');

  const { data: timesheets } = await supabaseAdmin
    .from('timesheets')
    .select('employee_id, total_hours, week_start_date')
    .in('status', ['submitted', 'manager_approved', 'client_approved'])
    .gte('week_start_date', getWeekStart(new Date(), -4));

  const { data: employees } = await supabaseAdmin
    .from('employees')
    .select('id, first_name, last_name, department')
    .eq('status', 'active');

  const empMap = new Map((employees ?? []).map(e => [e.id, e]));
  const hoursMap = new Map<string, number>();

  for (const ts of timesheets ?? []) {
    hoursMap.set(ts.employee_id, (hoursMap.get(ts.employee_id) ?? 0) + ts.total_hours);
  }

  const result = [...new Set((assignments ?? []).map(a => a.employee_id))].map(empId => {
    const emp = empMap.get(empId);
    const maxHours = (assignments ?? [])
      .filter(a => a.employee_id === empId)
      .reduce((sum, a) => sum + a.max_hours_per_week, 0);
    const loggedHours = hoursMap.get(empId) ?? 0;
    return {
      employeeId: empId,
      name: emp ? `${emp.first_name} ${emp.last_name}` : empId,
      department: emp?.department,
      maxHoursPerWeek: maxHours,
      loggedHoursLast4Weeks: loggedHours,
      utilizationPct: maxHours > 0 ? Math.round((loggedHours / (maxHours * 4)) * 100) : 0,
    };
  });

  return result;
}

export async function getVisaExpiry(daysAhead = 90) {
  // UTC-safe: build cutoff by adding days to today's UTC date string
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const cutoffDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysAhead));
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('id, first_name, last_name, email, visa_type, visa_expiry, i9_status')
    .not('visa_expiry', 'is', null)
    .gte('visa_expiry', todayStr)
    .lte('visa_expiry', cutoffStr)
    .eq('status', 'active')
    .order('visa_expiry', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getMissingTimesheets(weekStartDate: string) {
  const { data: activeAssignments } = await supabaseAdmin
    .from('assignments')
    .select('employee_id, id, project_name, client_id')
    .eq('status', 'active');

  const { data: submitted } = await supabaseAdmin
    .from('timesheets')
    .select('employee_id, assignment_id')
    .eq('week_start_date', weekStartDate);

  const submittedSet = new Set(
    (submitted ?? []).map(t => `${t.employee_id}:${t.assignment_id}`)
  );

  const missing = (activeAssignments ?? []).filter(
    a => !submittedSet.has(`${a.employee_id}:${a.id}`)
  );

  const empIds = [...new Set(missing.map(m => m.employee_id))];
  const { data: employees } = await supabaseAdmin
    .from('employees')
    .select('id, first_name, last_name, email')
    .in('id', empIds);

  const empMap = new Map((employees ?? []).map(e => [e.id, e]));

  return missing.map(m => {
    const emp = empMap.get(m.employee_id);
    return {
      employeeId: m.employee_id,
      name: emp ? `${emp.first_name} ${emp.last_name}` : m.employee_id,
      email: emp?.email,
      assignmentId: m.id,
      projectName: m.project_name,
      clientId: m.client_id,
      weekStartDate,
    };
  });
}

export async function getTimesheetSummary(startDate: string, endDate: string) {
  const { data: timesheets, error } = await supabaseAdmin
    .from('timesheets')
    .select('employee_id, client_id, total_hours, week_start_date, status')
    .gte('week_start_date', startDate)
    .lte('week_start_date', endDate)
    .in('status', ['submitted', 'manager_approved', 'client_approved']);

  if (error) throw error;

  const empIds = [...new Set((timesheets ?? []).map(t => t.employee_id))];
  const clientIds = [...new Set((timesheets ?? []).map(t => t.client_id))];

  const [{ data: employees }, { data: clients }] = await Promise.all([
    supabaseAdmin.from('employees').select('id, first_name, last_name').in('id', empIds),
    supabaseAdmin.from('clients').select('id, company_name').in('id', clientIds),
  ]);

  const empMap = new Map((employees ?? []).map(e => [e.id, `${e.first_name} ${e.last_name}`]));
  const clientMap = new Map((clients ?? []).map(c => [c.id, c.company_name]));

  const summary = new Map<string, { employeeId: string; employeeName: string; clientId: string; clientName: string; totalHours: number }>();

  for (const ts of timesheets ?? []) {
    const key = `${ts.employee_id}:${ts.client_id}`;
    const existing = summary.get(key);
    if (existing) {
      existing.totalHours += ts.total_hours;
    } else {
      summary.set(key, {
        employeeId: ts.employee_id,
        employeeName: empMap.get(ts.employee_id) ?? ts.employee_id,
        clientId: ts.client_id,
        clientName: clientMap.get(ts.client_id) ?? ts.client_id,
        totalHours: ts.total_hours,
      });
    }
  }

  return [...summary.values()].sort((a, b) => b.totalHours - a.totalHours);
}

export async function getFinancialSummary() {
  const { data: invoices } = await supabaseAdmin
    .from('invoices')
    .select('status, total_amount');

  const summary = { paid: 0, outstanding: 0, overdue: 0, draft: 0 };
  for (const inv of invoices ?? []) {
    if (inv.status === 'paid') summary.paid += inv.total_amount;
    else if (inv.status === 'sent') summary.outstanding += inv.total_amount;
    else if (inv.status === 'overdue') summary.overdue += inv.total_amount;
    else if (inv.status === 'draft') summary.draft += inv.total_amount;
  }

  return summary;
}

export async function getProfitability() {
  const { data: assignments } = await supabaseAdmin
    .from('assignments')
    .select('id, client_id, employee_id, bill_rate, pay_rate');

  const { data: timesheets } = await supabaseAdmin
    .from('timesheets')
    .select('assignment_id, client_id, employee_id, total_hours')
    .eq('status', 'client_approved');

  const { data: clients } = await supabaseAdmin
    .from('clients')
    .select('id, company_name');

  const asnMap = new Map((assignments ?? []).map(a => [a.id, a]));
  const clientMap = new Map((clients ?? []).map(c => [c.id, c.company_name]));

  const profitMap = new Map<string, { clientId: string; clientName: string; revenue: number; cost: number }>();

  for (const ts of timesheets ?? []) {
    const asgn = (assignments ?? []).find(a =>
      a.client_id === ts.client_id && a.employee_id === ts.employee_id
    );
    if (!asgn) continue;

    const revenue = ts.total_hours * asgn.bill_rate;
    const cost = ts.total_hours * asgn.pay_rate;
    const clientId = ts.client_id;

    const existing = profitMap.get(clientId);
    if (existing) {
      existing.revenue += revenue;
      existing.cost += cost;
    } else {
      profitMap.set(clientId, {
        clientId,
        clientName: clientMap.get(clientId) ?? clientId,
        revenue,
        cost,
      });
    }
  }

  return [...profitMap.values()].map(p => ({
    ...p,
    profit: p.revenue - p.cost,
    margin: p.revenue > 0 ? Math.round(((p.revenue - p.cost) / p.revenue) * 100) : 0,
  }));
}

export async function getBillingByClient() {
  const { data: invoices } = await supabaseAdmin
    .from('invoices')
    .select('client_id, total_amount, status, issue_date')
    .eq('status', 'paid');

  const clientIds = [...new Set((invoices ?? []).map(i => i.client_id))];
  const { data: clients } = await supabaseAdmin
    .from('clients')
    .select('id, company_name')
    .in('id', clientIds);

  const clientMap = new Map((clients ?? []).map(c => [c.id, c.company_name]));
  const billingMap = new Map<string, number>();

  for (const inv of invoices ?? []) {
    billingMap.set(inv.client_id, (billingMap.get(inv.client_id) ?? 0) + inv.total_amount);
  }

  return [...billingMap.entries()]
    .map(([clientId, total]) => ({
      clientId,
      clientName: clientMap.get(clientId) ?? clientId,
      totalBilled: total,
    }))
    .sort((a, b) => b.totalBilled - a.totalBilled);
}

function getWeekStart(_date: Date, weeksOffset: number): string {
  // UTC-safe: use getUTCDay() so the result is consistent across all server timezones
  const now = new Date();
  const utcDay = now.getUTCDay(); // 0=Sun … 6=Sat
  const daysToMonday = utcDay === 0 ? -6 : 1 - utcDay;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysToMonday + weeksOffset * 7));
  return monday.toISOString().split('T')[0];
}

import { supabaseAdmin } from '../config/supabase';

export async function getEmployeeUtilization() {
  const [{ data: assignments }, { data: timesheets }, { data: employees }] = await Promise.all([
    supabaseAdmin
      .from('assignments')
      .select('employee_id, max_hours_per_week')
      .eq('status', 'active'),
    supabaseAdmin
      .from('timesheets')
      .select('employee_id, total_hours, week_start_date')
      .in('status', ['submitted', 'manager_approved', 'client_approved'])
      .gte('week_start_date', getWeekStartOffset(-4)),
    supabaseAdmin
      .from('employees')
      .select('id, first_name, last_name, department')
      .eq('status', 'active'),
  ]);

  const empMap = new Map((employees ?? []).map(e => [e.id, e]));
  const hoursMap = new Map<string, number>();

  for (const ts of timesheets ?? []) {
    hoursMap.set(ts.employee_id, (hoursMap.get(ts.employee_id) ?? 0) + ts.total_hours);
  }

  // Pre-aggregate assignment capacity per employee in a single pass (O(n)
  // instead of the previous O(n × m) filter-per-employee).
  const capacityMap = new Map<string, number>();
  for (const a of assignments ?? []) {
    capacityMap.set(a.employee_id, (capacityMap.get(a.employee_id) ?? 0) + a.max_hours_per_week);
  }

  const result = [...capacityMap.keys()].map(empId => {
    const emp = empMap.get(empId);
    const maxHours = capacityMap.get(empId) ?? 0;
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
  // UTC-safe: build cutoff by adding days to today's UTC date string. We
  // intentionally do NOT filter by `>= today` so that already-expired visas
  // remain visible — admins need to see them so the expired authorization
  // gets followed up on, not hidden.
  const now = new Date();
  const cutoffDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysAhead));
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('id, first_name, last_name, email, visa_type, visa_expiry, i9_status')
    .not('visa_expiry', 'is', null)
    .lte('visa_expiry', cutoffStr)
    .eq('status', 'active')
    .order('visa_expiry', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getMissingTimesheets(weekStartDate: string) {
  const [{ data: activeAssignments }, { data: submitted }] = await Promise.all([
    supabaseAdmin
      .from('assignments')
      .select('employee_id, id, project_name, client_id')
      .eq('status', 'active'),
    supabaseAdmin
      .from('timesheets')
      .select('employee_id, assignment_id')
      .eq('week_start_date', weekStartDate),
  ]);

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
    .select('status, total_amount, amount_paid');

  // outstanding/overdue count the remaining BALANCE and include viewed +
  // partially_paid (previously dropped, which under-reported what's owed).
  const summary = { paid: 0, outstanding: 0, overdue: 0, draft: 0 };
  for (const inv of invoices ?? []) {
    const total = Number(inv.total_amount) || 0;
    const balance = Math.round((total - (Number(inv.amount_paid) || 0)) * 100) / 100;
    if (inv.status === 'paid') summary.paid += total;
    else if (inv.status === 'overdue') summary.overdue += balance;
    else if (inv.status === 'sent' || inv.status === 'viewed' || inv.status === 'partially_paid') summary.outstanding += balance;
    else if (inv.status === 'draft') summary.draft += total;
  }

  return summary;
}

export async function getProfitability() {
  const [{ data: assignments }, { data: timesheets }, { data: clients }] = await Promise.all([
    supabaseAdmin
      .from('assignments')
      .select('id, client_id, employee_id, bill_rate, pay_rate'),
    supabaseAdmin
      .from('timesheets')
      .select('assignment_id, client_id, employee_id, total_hours')
      .eq('status', 'client_approved'),
    supabaseAdmin
      .from('clients')
      .select('id, company_name'),
  ]);

  const clientMap = new Map((clients ?? []).map(c => [c.id, c.company_name]));

  // Pre-index assignments by (client_id, employee_id) so the inner lookup is
  // O(1). Previously a `.find()` per timesheet made this O(n × m) — a large
  // tenant with thousands of approved timesheets would spike the request.
  type AssignmentRow = { id: string; client_id: string; employee_id: string; bill_rate: number; pay_rate: number };
  const assignmentIndex = new Map<string, AssignmentRow>();
  for (const a of (assignments ?? []) as AssignmentRow[]) {
    assignmentIndex.set(`${a.client_id}:${a.employee_id}`, a);
  }

  const profitMap = new Map<string, { clientId: string; clientName: string; revenue: number; cost: number }>();

  for (const ts of timesheets ?? []) {
    const asgn = assignmentIndex.get(`${ts.client_id}:${ts.employee_id}`);
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

export async function getRevenueByDateRange(startDate: string, endDate: string) {
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('id, invoice_number, client_id, issue_date, status, total_amount, amount_paid, paid_at')
    .gte('issue_date', startDate)
    .lte('issue_date', endDate);

  if (error) throw error;

  let totalInvoiced = 0;
  let totalPaid = 0;
  let totalOutstanding = 0;
  const monthMap = new Map<string, { invoiced: number; paid: number; outstanding: number; count: number }>();

  for (const inv of data ?? []) {
    const total = Number(inv.total_amount) || 0;
    const amountPaid = Number(inv.amount_paid) || 0;
    totalInvoiced += total;

    if (inv.status === 'paid') {
      totalPaid += total;
    } else if (['sent', 'viewed', 'partially_paid', 'overdue'].includes(inv.status)) {
      totalOutstanding += Math.round((total - amountPaid) * 100) / 100;
    }

    const month = inv.issue_date.substring(0, 7);
    const existing = monthMap.get(month);
    if (existing) {
      existing.invoiced += total;
      if (inv.status === 'paid') existing.paid += total;
      else if (['sent', 'viewed', 'partially_paid', 'overdue'].includes(inv.status)) {
        existing.outstanding += Math.round((total - amountPaid) * 100) / 100;
      }
      existing.count += 1;
    } else {
      monthMap.set(month, {
        invoiced: total,
        paid: inv.status === 'paid' ? total : 0,
        outstanding: ['sent', 'viewed', 'partially_paid', 'overdue'].includes(inv.status)
          ? Math.round((total - amountPaid) * 100) / 100
          : 0,
        count: 1,
      });
    }
  }

  const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthlyBreakdown = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, vals]) => {
      const [yyyy, mm] = month.split('-');
      return {
        month,
        monthLabel: `${MONTH_LABELS[parseInt(mm, 10) - 1]} ${yyyy}`,
        ...vals,
      };
    });

  return {
    totalInvoiced,
    totalPaid,
    totalOutstanding,
    invoiceCount: (data ?? []).length,
    monthlyBreakdown,
  };
}

export async function getProfitLoss(startDate: string, endDate: string, basis: 'accrual' | 'cash') {
  // Fetch invoices based on accounting basis
  let query = supabaseAdmin
    .from('invoices')
    .select('id, invoice_number, client_id, issue_date, paid_at, status, total_amount, amount_paid, tax_amount')
    .is('deleted_at', null);

  if (basis === 'cash') {
    // Cash basis: only invoices that have been paid, within paid_at range
    query = query.eq('status', 'paid').gte('paid_at', startDate).lte('paid_at', endDate);
  } else {
    // Accrual basis: all invoices issued in range (paid or unpaid)
    query = query.gte('issue_date', startDate).lte('issue_date', endDate);
  }

  const { data: invoices } = await query;
  const rows = (invoices ?? []) as any[];

  // Fetch client names
  const clientIds = [...new Set(rows.map((r: any) => r.client_id).filter(Boolean))];
  const clientMap: Record<string, string> = {};
  if (clientIds.length > 0) {
    const { data: clients } = await supabaseAdmin.from('clients').select('id, company_name').in('id', clientIds);
    for (const c of (clients ?? [])) clientMap[c.id] = c.company_name;
  }

  let totalIncome = 0;
  const monthlyMap: Record<string, { income: number; count: number }> = {};

  for (const inv of rows) {
    const amount = Number(inv.total_amount ?? 0);
    totalIncome += amount;
    const dateKey = basis === 'cash' ? (inv.paid_at ?? inv.issue_date) : inv.issue_date;
    const month = String(dateKey ?? '').slice(0, 7); // YYYY-MM
    if (!monthlyMap[month]) monthlyMap[month] = { income: 0, count: 0 };
    monthlyMap[month].income += amount;
    monthlyMap[month].count += 1;
  }

  const monthlyBreakdown = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      monthLabel: new Date(month + '-02').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      income: Math.round(v.income * 100) / 100,
      count: v.count,
    }));

  const grossProfit = totalIncome; // No COGS tracked yet
  const operatingExpenses = 0;     // No expense tracking yet
  const netProfit = grossProfit - operatingExpenses;
  const grossProfitPct = totalIncome > 0 ? Math.round((grossProfit / totalIncome) * 10000) / 100 : 0;
  const netProfitPct = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 10000) / 100 : 0;

  const detailRows = rows.map((inv: any) => ({
    invoiceNumber: inv.invoice_number,
    clientName: clientMap[inv.client_id] ?? 'Unknown',
    date: basis === 'cash' ? (inv.paid_at ?? inv.issue_date) : inv.issue_date,
    amount: Math.round(Number(inv.total_amount ?? 0) * 100) / 100,
    status: inv.status,
  }));

  return {
    basis,
    startDate,
    endDate,
    totalIncome: Math.round(totalIncome * 100) / 100,
    costOfGoodsSold: 0,
    grossProfit: Math.round(grossProfit * 100) / 100,
    operatingExpenses: 0,
    netProfit: Math.round(netProfit * 100) / 100,
    grossProfitPct,
    netProfitPct,
    monthlyBreakdown,
    detailRows,
    invoiceCount: rows.length,
  };
}

/**
 * Returns the ISO date string of the Monday that is `weeksOffset` weeks away
 * from the current week's Monday (UTC).
 */
function getWeekStartOffset(weeksOffset: number): string {
  const now = new Date();
  const utcDay = now.getUTCDay(); // 0=Sun … 6=Sat
  const daysToMonday = utcDay === 0 ? -6 : 1 - utcDay;
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysToMonday + weeksOffset * 7),
  );
  return monday.toISOString().split('T')[0];
}

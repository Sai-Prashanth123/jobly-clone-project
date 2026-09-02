import { supabaseAdmin } from '../config/supabase';
import { logActivity } from '../lib/activityLogger';
import { NotFoundError, ConflictError } from '../lib/errors';
import { daysBetween } from '../lib/dateUtils';
import type {
  CreateLeaveTypeInput,
  UpdateLeaveTypeInput,
  SetEntitlementInput,
} from '../schemas/leaveBalance.schema';

// ─── Leave Types ────────────────────────────────────────────────────────────

export async function listLeaveTypes(activeOnly = true) {
  let q = supabaseAdmin.from('leave_types').select('*').order('name');
  if (activeOnly) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getLeaveType(id: string): Promise<any> {
  const { data, error } = await supabaseAdmin.from('leave_types').select('*').eq('id', id).single();
  if (error || !data) throw new NotFoundError('Leave type not found');
  return data as any;
}

export async function createLeaveType(input: CreateLeaveTypeInput, actorId: string) {
  // Check code uniqueness
  const { data: existing } = await supabaseAdmin.from('leave_types').select('id').eq('code', input.code).single();
  if (existing) throw new ConflictError(`Leave type with code "${input.code}" already exists`);

  const { data, error } = await supabaseAdmin
    .from('leave_types')
    .insert({
      name:          input.name,
      code:          input.code,
      description:   input.description ?? null,
      accrual_type:  input.accrualType,
      default_days:  input.defaultDays,
      accrual_rate:  input.accrualRate ?? null,
      max_carryover: input.maxCarryover,
      color:         input.color,
      is_active:     input.isActive,
    })
    .select('*')
    .single();
  if (error || !data) throw error ?? new Error('Insert returned no data');
  const row = data as any;
  void logActivity(actorId, 'created', 'leave_type', row.id, `Created leave type: ${row.name}`);
  return data as any;
}

export async function updateLeaveType(id: string, input: UpdateLeaveTypeInput, actorId: string) {
  await getLeaveType(id);

  const patch: Record<string, unknown> = {};
  if (input.name         !== undefined) patch.name          = input.name;
  if (input.description  !== undefined) patch.description   = input.description ?? null;
  if (input.accrualType  !== undefined) patch.accrual_type  = input.accrualType;
  if (input.defaultDays  !== undefined) patch.default_days  = input.defaultDays;
  if (input.accrualRate  !== undefined) patch.accrual_rate  = input.accrualRate ?? null;
  if (input.maxCarryover !== undefined) patch.max_carryover = input.maxCarryover;
  if (input.color        !== undefined) patch.color         = input.color;
  if (input.isActive     !== undefined) patch.is_active     = input.isActive;

  const { data, error } = await supabaseAdmin.from('leave_types').update(patch).eq('id', id).select('*').single();
  if (error || !data) throw error ?? new Error('Update returned no data');
  void logActivity(actorId, 'updated', 'leave_type', id, `Updated leave type: ${(data as any).name}`);
  return data as any;
}

export async function deleteLeaveType(id: string, actorId: string) {
  const lt = await getLeaveType(id);
  // Soft-disable instead of hard-delete to preserve historical references
  const { error } = await supabaseAdmin.from('leave_types').update({ is_active: false }).eq('id', id);
  if (error) throw error;
  void logActivity(actorId, 'deleted', 'leave_type', id, `Deactivated leave type: ${lt.name}`);
}

// ─── Balances ────────────────────────────────────────────────────────────────

export async function getEmployeeBalances(employeeId: string, year?: number) {
  const targetYear = year ?? new Date().getUTCFullYear();

  // Get active leave types
  const leaveTypes = await listLeaveTypes(true);

  // Get any per-employee entitlement overrides for this year
  const { data: entitlements, error: entErr } = await supabaseAdmin
    .from('employee_leave_entitlements')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('year', targetYear);
  if (entErr) throw entErr;

  const entitlementMap = new Map<string, any>();
  for (const e of entitlements ?? []) {
    entitlementMap.set(e.leave_type_id, e);
  }

  // Get employee hire date for accrual computation
  const { data: emp, error: empErr } = await supabaseAdmin
    .from('employees')
    .select('start_date')
    .eq('id', employeeId)
    .single();
  if (empErr) throw empErr;

  // Sum of approved leave days for this employee in the target year, by leave_type code.
  // A request that SPANS the year boundary (e.g. Dec 29–Jan 3) must only count
  // the portion that actually falls in the target year — filtering by
  // start_date alone (the old behavior) attributed the FULL day count to
  // whichever year the request started in, letting the other year's portion
  // go uncounted (double-spendable) in that year's balance.
  const yearStart = `${targetYear}-01-01`;
  const yearEnd   = `${targetYear}-12-31`;
  const { data: usedRows, error: usedErr } = await supabaseAdmin
    .from('leave_requests')
    .select('leave_type, days_requested, start_date, end_date')
    .eq('employee_id', employeeId)
    .eq('status', 'approved')
    .lte('start_date', yearEnd)
    .gte('end_date', yearStart);
  if (usedErr) throw usedErr;

  const usedByCode = new Map<string, number>();
  for (const row of usedRows ?? []) {
    const totalSpanDays = daysBetween(row.start_date, row.end_date) + 1;
    const overlapStart = row.start_date < yearStart ? yearStart : row.start_date;
    const overlapEnd = row.end_date > yearEnd ? yearEnd : row.end_date;
    const overlapDays = daysBetween(overlapStart, overlapEnd) + 1;
    // Calendar-day proration — days_requested was likely computed with
    // business-day/holiday logic this service doesn't have access to, so this
    // is an approximation, not an exact business-day recount. Still closes
    // the double-count/double-spend at year boundaries the old logic had.
    const proratedDays = totalSpanDays > 0 ? Number(row.days_requested) * (overlapDays / totalSpanDays) : 0;
    usedByCode.set(row.leave_type, (usedByCode.get(row.leave_type) ?? 0) + proratedDays);
  }

  // Build balance per leave type
  const balances = leaveTypes.map((lt: any) => {
    const override   = entitlementMap.get(lt.id);
    const carriedOver = override?.carried_over ?? 0;
    let granted: number;

    if (lt.accrual_type === 'accrual') {
      // Accrue from hire date or year start, whichever is later
      const hireDate  = emp?.start_date ? new Date(emp.start_date) : new Date(yearStart);
      const accrualStart = hireDate > new Date(yearStart) ? hireDate : new Date(yearStart);
      // Reference point must be relative to the YEAR BEING QUERIED, not
      // always "today" — otherwise a past year's accrual keeps growing after
      // the year ended, and a future year (not yet started) wrongly accrues
      // as if it were already underway.
      const now = new Date();
      const referenceDate = targetYear < now.getUTCFullYear() ? new Date(yearEnd)
        : targetYear > now.getUTCFullYear() ? accrualStart // clamps monthsElapsed to 0 below
        : now;
      const monthsElapsed = Math.max(
        0,
        (referenceDate.getUTCFullYear() - accrualStart.getUTCFullYear()) * 12 +
        (referenceDate.getUTCMonth() - accrualStart.getUTCMonth()),
      );
      const rate    = lt.accrual_rate ?? 0;
      const accrued = Math.min(monthsElapsed * rate, lt.default_days);
      granted = override?.granted_days ?? accrued;
    } else {
      granted = override?.granted_days ?? lt.default_days;
    }

    const used      = usedByCode.get(lt.code) ?? 0;
    const remaining = Math.max(0, granted + carriedOver - used);

    return {
      leaveType:   lt,
      year:        targetYear,
      granted,
      carriedOver,
      used,
      remaining,
    };
  });

  return balances;
}

// ─── Entitlement Overrides ───────────────────────────────────────────────────

export async function setEntitlement(employeeId: string, input: SetEntitlementInput, actorId: string) {
  const { data, error } = await supabaseAdmin
    .from('employee_leave_entitlements')
    .upsert(
      {
        employee_id:    employeeId,
        leave_type_id:  input.leaveTypeId,
        year:           input.year,
        granted_days:   input.grantedDays,
        carried_over:   input.carriedOver,
        notes:          input.notes ?? null,
      },
      { onConflict: 'employee_id,leave_type_id,year' },
    )
    .select('*')
    .single();
  if (error) throw error;
  void logActivity(actorId, 'updated', 'leave_entitlement', employeeId, `Set leave entitlement for employee ${employeeId}, year ${input.year}`);
  return data;
}

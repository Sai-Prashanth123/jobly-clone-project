import { supabaseAdmin } from '../config/supabase';
import { NotFoundError } from '../lib/errors';
import { logActivity } from '../lib/activityLogger';
import { sendWelcomeEmail } from '../lib/mailer';
import { createNotification, getUserIdsByRole } from './notifications.service';
import type { CreateEmployeeInput, UpdateEmployeeInput, ListEmployeesQuery } from '../schemas/employee.schema';

// Supabase returns snake_case — pass through as-is, just ensure numeric types are correct
function serializeEmployee(emp: any) {
  return {
    ...emp,
    pay_rate: emp.pay_rate != null ? Number(emp.pay_rate) : 0,
  };
}

// ── list ─────────────────────────────────────────────────────────────────────

export async function listEmployees(query: ListEmployeesQuery) {
  let q = supabaseAdmin
    .from('employees')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (query.status)     q = q.eq('status', query.status);
  if (query.department) q = q.eq('department', query.department);
  if (query.search) {
    const s = `%${query.search}%`;
    q = q.or(`first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s}`);
  }

  const skip = (query.page - 1) * query.limit;
  q = q.range(skip, skip + query.limit - 1);

  const { data, error, count } = await q;
  if (error) throw error;

  return { data: (data ?? []).map(serializeEmployee), total: count ?? 0 };
}

// ── getOne ───────────────────────────────────────────────────────────────────

export async function getEmployee(id: string) {
  const { data: emp, error } = await supabaseAdmin
    .from('employees')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !emp) throw new NotFoundError('Employee not found');

  const { data: docs } = await supabaseAdmin
    .from('documents')
    .select('*')
    .eq('entity_type', 'employee')
    .eq('entity_id', id);

  return { ...serializeEmployee(emp), documents: docs ?? [] };
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function issueCredentials(empId: string, emp: any, input: CreateEmployeeInput) {
  // workEmail = portal login credential; email = personal email to receive credentials
  const portalLoginEmail = input.workEmail ?? input.email;
  const tempPassword = 'Jobly@' + Math.random().toString(36).slice(2, 8).toUpperCase();
  let credentialsReady = false;

  try {
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const existingAuthUser = existingUsers?.users?.find((u: any) => u.email === portalLoginEmail);

    if (existingAuthUser) {
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
        existingAuthUser.id, { password: tempPassword }
      );
      if (updateErr) throw updateErr;

      await supabaseAdmin.from('portal_users').upsert({
        id: existingAuthUser.id,
        email: portalLoginEmail,
        name: `${input.firstName} ${input.lastName}`,
        role: 'employee',
        employee_id: empId,
        avatar_initials: `${input.firstName[0]}${input.lastName[0]}`.toUpperCase(),
      }, { onConflict: 'id' });

      credentialsReady = true;
    } else {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: portalLoginEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { role: 'employee' },
      });
      if (authError) throw authError;

      if (authData?.user) {
        await supabaseAdmin.from('portal_users').insert({
          id: authData.user.id,
          email: portalLoginEmail,
          name: `${input.firstName} ${input.lastName}`,
          role: 'employee',
          employee_id: empId,
          avatar_initials: `${input.firstName[0]}${input.lastName[0]}`.toUpperCase(),
        });
        credentialsReady = true;
      }
    }
  } catch (err) {
    console.error('[issueCredentials] auth setup failed for', portalLoginEmail, err);
  }

  if (!credentialsReady) {
    console.error('[mailer] skipping welcome email — credentials were not set for', portalLoginEmail);
    return;
  }

  try {
    // Send credentials to personal email (input.email), login is portalLoginEmail
    await sendWelcomeEmail({
      to: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      displayId: emp.display_id ?? emp.id?.slice(0, 8) ?? empId.slice(0, 8),
      jobTitle: input.jobTitle,
      department: input.department,
      startDate: input.startDate,
      workLocation: input.workLocation ?? undefined,
      employmentType: input.employmentType,
      paymentType: input.paymentType ?? undefined,
      loginEmail: portalLoginEmail,
      tempPassword,
    });
    console.log('[mailer] credentials email sent to', input.email, '(login:', portalLoginEmail, ')');
  } catch (err) {
    console.error('[mailer] credentials email failed for', input.email, err);
  }
}

// ── create ───────────────────────────────────────────────────────────────────

export async function createEmployee(input: CreateEmployeeInput, actorId?: string) {
  // If employee with this email already exists (active or soft-deleted), re-issue credentials
  const { data: existingEmp } = await supabaseAdmin
    .from('employees')
    .select('*')
    .eq('email', input.email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingEmp) {
    // Restore soft-deleted employee if needed
    if (existingEmp.deleted_at) {
      await supabaseAdmin.from('employees').update({ deleted_at: null }).eq('id', existingEmp.id);
      existingEmp.deleted_at = null;
    }
    // Re-issue new login credentials and send welcome email
    await issueCredentials(existingEmp.id, existingEmp, input);
    logActivity(actorId ?? null, 'updated', 'employee', existingEmp.id, existingEmp.display_id ?? input.email);
    return serializeEmployee(existingEmp);
  }

  const { data: emp, error } = await supabaseAdmin
    .from('employees')
    .insert({
      first_name:        input.firstName,
      last_name:         input.lastName,
      email:             input.email,
      phone:             input.phone ?? '',
      dob:               input.dob || null,
      address_street:    input.address?.street ?? '',
      address_city:      input.address?.city ?? '',
      address_state:     input.address?.state ?? '',
      address_zip:       input.address?.zip ?? '',
      address_country:   input.address?.country ?? 'US',
      department:        input.department ?? '',
      job_title:         input.jobTitle ?? '',
      employment_type:   input.employmentType,
      start_date:        input.startDate,
      manager_id:        input.managerId ?? null,
      status:            input.status ?? 'onboarding',
      visa_type:         input.visaType ?? null,
      visa_expiry:       input.visaExpiry || null,
      i9_status:         input.i9Status ?? null,
      pay_rate:          input.payRate,
      pay_type:          input.payType,
      pay_frequency:     input.payFrequency,
      work_location:     input.workLocation ?? null,
      ssn:               input.ssn ?? null,
      payment_type:      input.paymentType ?? null,
      bank_name:         input.bankName ?? null,
      bank_routing_number: input.bankRoutingNumber ?? null,
      bank_account_number: input.bankAccountNumber ?? null,
      tax_form_type:     input.taxFormType ?? null,
      reporting_manager_id: input.reportingManagerId ?? null,
      work_email:        input.workEmail ?? null,
    })
    .select()
    .single();

  if (error) throw error;

  logActivity(actorId ?? null, 'created', 'employee', emp.id, emp.display_id ?? `${input.firstName} ${input.lastName}`);

  // Issue credentials and send welcome email
  await issueCredentials(emp.id, emp, input);

  // Notify HR about new onboarding employee (fire-and-forget)
  try {
    const hrIds = await getUserIdsByRole('hr');
    const adminIds = await getUserIdsByRole('admin');
    const label = emp.display_id ?? `${input.firstName} ${input.lastName}`;
    for (const uid of [...new Set([...hrIds, ...adminIds])]) {
      await createNotification(
        uid,
        'New Employee Onboarding',
        `${label} (${input.firstName} ${input.lastName}) has been added and is pending onboarding completion.`,
        'info', 'employee', emp.id,
      );
    }
  } catch (_) { /* non-blocking */ }

  return serializeEmployee(emp);
}

// ── update ───────────────────────────────────────────────────────────────────

export async function updateEmployee(id: string, input: UpdateEmployeeInput, actorId?: string) {
  const { data: existing, error: findErr } = await supabaseAdmin
    .from('employees')
    .select('id, display_id')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  if (findErr || !existing) throw new NotFoundError('Employee not found');

  const patch: Record<string, any> = {};
  if (input.email !== undefined)      patch.email           = input.email;
  if (input.phone !== undefined)      patch.phone           = input.phone;
  if (input.dob !== undefined)        patch.dob             = input.dob || null;
  if (input.department !== undefined) patch.department      = input.department;
  if (input.firstName !== undefined)  patch.first_name      = input.firstName;
  if (input.lastName !== undefined)   patch.last_name       = input.lastName;
  if (input.jobTitle !== undefined)   patch.job_title       = input.jobTitle;
  if (input.employmentType !== undefined) patch.employment_type = input.employmentType;
  if (input.startDate !== undefined)  patch.start_date      = input.startDate;
  if (input.managerId !== undefined)  patch.manager_id      = input.managerId;
  if (input.status !== undefined)     patch.status          = input.status;
  if (input.visaType !== undefined)   patch.visa_type       = input.visaType;
  if (input.visaExpiry !== undefined) patch.visa_expiry     = input.visaExpiry || null;
  if (input.i9Status !== undefined)   patch.i9_status       = input.i9Status;
  if (input.payRate !== undefined)    patch.pay_rate        = input.payRate;
  if (input.payType !== undefined)    patch.pay_type        = input.payType;
  if (input.payFrequency !== undefined) patch.pay_frequency = input.payFrequency;
  if (input.workLocation !== undefined) patch.work_location = input.workLocation;
  if (input.ssn !== undefined)        patch.ssn             = input.ssn;
  if (input.paymentType !== undefined) patch.payment_type   = input.paymentType;
  if (input.bankName !== undefined)   patch.bank_name       = input.bankName;
  if (input.bankRoutingNumber !== undefined) patch.bank_routing_number = input.bankRoutingNumber;
  if (input.bankAccountNumber !== undefined) patch.bank_account_number = input.bankAccountNumber;
  if (input.taxFormType !== undefined) patch.tax_form_type  = input.taxFormType;
  if (input.reportingManagerId !== undefined) patch.reporting_manager_id = input.reportingManagerId;
  if (input.workEmail !== undefined) patch.work_email = input.workEmail;
  if (input.address !== undefined) {
    patch.address_street  = input.address.street ?? '';
    patch.address_city    = input.address.city ?? '';
    patch.address_state   = input.address.state ?? '';
    patch.address_zip     = input.address.zip ?? '';
    patch.address_country = input.address.country ?? 'US';
  }

  const { data: emp, error } = await supabaseAdmin
    .from('employees')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  logActivity(actorId ?? null, 'updated', 'employee', id, emp.display_id ?? id.slice(0, 8));
  return serializeEmployee(emp);
}

// ── delete ───────────────────────────────────────────────────────────────────

export async function deleteEmployee(id: string, actorId?: string) {
  const { data: existing, error: findErr } = await supabaseAdmin
    .from('employees')
    .select('id, display_id')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  if (findErr || !existing) throw new NotFoundError('Employee not found');

  await supabaseAdmin
    .from('employees')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  logActivity(actorId ?? null, 'deleted', 'employee', id, existing.display_id ?? id.slice(0, 8));
}

// ── sub-resources ─────────────────────────────────────────────────────────────

export async function getEmployeeAssignments(employeeId: string) {
  const { data, error } = await supabaseAdmin
    .from('assignments')
    .select('*')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getEmployeeTimesheets(employeeId: string) {
  const { data, error } = await supabaseAdmin
    .from('timesheets')
    .select('*, timesheet_entries(*)')
    .eq('employee_id', employeeId)
    .order('week_start_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ── CSV export ────────────────────────────────────────────────────────────────

export async function exportEmployeesCSV(query: { status?: string; department?: string }): Promise<string> {
  let q = supabaseAdmin
    .from('employees')
    .select('display_id,first_name,last_name,email,phone,department,job_title,employment_type,start_date,status,visa_type,visa_expiry,pay_rate,pay_type,pay_frequency,work_location')
    .order('display_id');
  if (query.status) q = q.eq('status', query.status);
  if (query.department) q = q.eq('department', query.department);
  const { data, error } = await q;
  if (error) throw error;

  const headers = ['ID','First Name','Last Name','Email','Phone','Department','Job Title','Employment Type','Start Date','Status','Visa Type','Visa Expiry','Pay Rate','Pay Type','Pay Frequency','Work Location'];
  const rows = (data ?? []).map(e => [
    e.display_id ?? '',
    e.first_name, e.last_name, e.email, e.phone ?? '',
    e.department, e.job_title, e.employment_type, e.start_date, e.status,
    e.visa_type ?? '', e.visa_expiry ?? '',
    e.pay_rate, e.pay_type, e.pay_frequency, e.work_location ?? '',
  ]);
  return [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
}

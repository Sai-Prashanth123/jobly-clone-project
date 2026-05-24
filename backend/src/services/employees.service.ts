import { supabaseAdmin } from '../config/supabase';
import { ConflictError, NotFoundError } from '../lib/errors';
import { logActivity } from '../lib/activityLogger';
import { sendWelcomeEmail, mailerConfigured } from '../lib/mailer';
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

export interface CredentialsResult {
  credentialsReady: boolean;
  emailSent: boolean;
  warning?: string;        // operator-friendly message
  loginEmail: string;
  tempPassword?: string;   // only when freshly issued
}

async function issueCredentials(empId: string, emp: any, input: CreateEmployeeInput): Promise<CredentialsResult> {
  // Login = work email if provided, else personal. The credentials email is
  // sent to BOTH the personal and work addresses (deduped) so the employee
  // receives it wherever they check (e.g. Gmail + Outlook). If only one is
  // given, it goes to that one.
  const personalEmail = (input.email ?? '').trim();
  const workEmail = (input.workEmail ?? '').trim();
  const portalLoginEmail = workEmail || personalEmail;
  const tempPassword = 'Jobly@' + Math.random().toString(36).slice(2, 8).toUpperCase();
  let credentialsReady = false;
  let credentialsError: any = null;

  try {
    // Prefer linking by employee_id — this survives email edits (looking up by
    // email would miss the existing login after the address changed and spawn a
    // duplicate auth user). Fall back to the login email, else create fresh.
    let portalUserId: string | null = null;
    const { data: byEmp } = await supabaseAdmin
      .from('portal_users').select('id').eq('employee_id', empId).maybeSingle();
    if (byEmp?.id) portalUserId = byEmp.id;
    if (!portalUserId && portalLoginEmail) {
      const { data: byEmail } = await supabaseAdmin
        .from('portal_users').select('id').eq('email', portalLoginEmail).maybeSingle();
      if (byEmail?.id) portalUserId = byEmail.id;
    }

    if (portalUserId) {
      // Update the existing login — email (in case it changed) + new password.
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
        portalUserId, { email: portalLoginEmail, password: tempPassword, email_confirm: true },
      );
      if (updateErr) throw updateErr;

      const { error: upsertErr } = await supabaseAdmin.from('portal_users').upsert({
        id: portalUserId,
        email: portalLoginEmail,
        name: `${input.firstName} ${input.lastName}`,
        role: 'employee',
        employee_id: empId,
        avatar_initials: `${input.firstName[0]}${input.lastName[0]}`.toUpperCase(),
      }, { onConflict: 'id' });
      if (upsertErr) throw upsertErr;

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
        const { error: insertErr } = await supabaseAdmin.from('portal_users').insert({
          id: authData.user.id,
          email: portalLoginEmail,
          name: `${input.firstName} ${input.lastName}`,
          role: 'employee',
          employee_id: empId,
          avatar_initials: `${input.firstName[0]}${input.lastName[0]}`.toUpperCase(),
        });
        if (insertErr) throw insertErr;
        credentialsReady = true;
      }
    }
  } catch (err) {
    credentialsError = err;
    console.error('[issueCredentials] auth setup failed for', portalLoginEmail, err);
  }

  if (!credentialsReady) {
    console.error('[mailer] skipping welcome email — credentials were not set for', portalLoginEmail);
    return {
      credentialsReady: false,
      emailSent: false,
      warning: `Could not create login for ${portalLoginEmail}: ${(credentialsError as any)?.message ?? 'auth setup failed'}`,
      loginEmail: portalLoginEmail,
    };
  }

  if (!mailerConfigured) {
    return {
      credentialsReady: true,
      emailSent: false,
      warning: 'Login was created but the welcome email was not sent: mailer is not configured (GMAIL_USER / GMAIL_APP_PASSWORD missing on the server). Share these credentials manually.',
      loginEmail: portalLoginEmail,
      tempPassword,
    };
  }

  // Send to personal + work (deduped). Both belong to the same employee.
  const recipients = [...new Set([personalEmail, workEmail].filter(Boolean))];
  if (recipients.length === 0) {
    return {
      credentialsReady: true, emailSent: false,
      warning: 'Login was created but there is no email address to send the credentials to.',
      loginEmail: portalLoginEmail, tempPassword,
    };
  }
  try {
    await sendWelcomeEmail({
      to: recipients,
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
    console.log('[mailer] credentials email sent to', recipients.join(', '), '(login:', portalLoginEmail, ')');
    return { credentialsReady: true, emailSent: true, loginEmail: portalLoginEmail };
  } catch (err: any) {
    // Rich detail so ops can see WHY a recipient failed (bad address vs throttle
    // vs auth) — the generic message alone made this undiagnosable.
    console.error('[mailer] credentials email FAILED for', recipients.join(', '), {
      code: err?.code, responseCode: err?.responseCode, response: err?.response,
      rejected: err?.rejected, message: err?.message,
    });
    return {
      credentialsReady: true,
      emailSent: false,
      warning: `Login was created but the welcome email could not be sent (${err?.code ?? ''} ${err?.message ?? 'send failed'}). Share these credentials manually.`,
      loginEmail: portalLoginEmail,
      tempPassword,
    };
  }
}

// ── create ───────────────────────────────────────────────────────────────────

export async function createEmployee(input: CreateEmployeeInput, actorId?: string) {
  // Pre-check by email so HR gets a precise 409 with the existing employee's
  // displayId, instead of a generic 500 from the DB unique-violation.
  // Soft-deleted rows are silently restored — that path predates this guard and
  // is useful for HR who delete by accident, then immediately re-create.
  const { data: existingEmp } = await supabaseAdmin
    .from('employees')
    .select('*')
    .eq('email', input.email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingEmp) {
    if (existingEmp.deleted_at) {
      await supabaseAdmin.from('employees').update({ deleted_at: null }).eq('id', existingEmp.id);
      existingEmp.deleted_at = null;
      const credsResult = await issueCredentials(existingEmp.id, existingEmp, input);
      logActivity(actorId ?? null, 'updated', 'employee', existingEmp.id, existingEmp.display_id ?? input.email, { event: 'restored_soft_deleted' });
      return { ...serializeEmployee(existingEmp), _credentials: credsResult };
    }
    // Active duplicate — refuse with a clear message including the existing
    // employee's displayId and name so HR can find the right record.
    const label = existingEmp.display_id ?? existingEmp.id.slice(0, 8);
    throw new ConflictError(
      `An employee with email ${input.email} already exists (${label} — ${existingEmp.first_name} ${existingEmp.last_name}). Open their profile or use a different email.`,
    );
  }

  let emp: any;
  try {
    const { data, error } = await supabaseAdmin
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
        status:            input.status ?? 'onboarding',
        visa_type:         input.visaType ?? null,
        visa_expiry:       input.visaExpiry || null,
        i9_status:         input.i9Status ?? null,
        pay_rate:          input.payRate,
        pay_type:          input.payType,
        work_location:     input.workLocation ?? null,
        ssn:               input.ssn ?? null,
        payment_type:      input.paymentType ?? null,
        bank_name:         input.bankName ?? null,
        bank_routing_number: input.bankRoutingNumber ?? null,
        bank_account_number: input.bankAccountNumber ?? null,
        tax_form_type:     input.taxFormType ?? null,
        reporting_manager_id: input.reportingManagerId ?? null,
        work_email:        input.workEmail ?? null,

        // Onboarding-form extension fields (see migration 005). All nullable.
        middle_name:               input.middleName ?? null,
        gender:                    input.gender ?? null,
        marital_status:            input.maritalStatus ?? null,
        nationality:               input.nationality ?? null,
        preferred_language:        input.preferredLanguage ?? null,
        languages_known:           input.languagesKnown ?? null,
        profile_photo_url:         input.profilePhotoUrl ?? null,
        alt_phone:                 input.altPhone ?? null,
        linkedin_url:              input.linkedinUrl ?? null,
        skype_id:                  input.skypeId ?? null,
        permanent_address_street:  input.permanentAddress?.street ?? null,
        permanent_address_city:    input.permanentAddress?.city ?? null,
        permanent_address_state:   input.permanentAddress?.state ?? null,
        permanent_address_zip:     input.permanentAddress?.zip ?? null,
        permanent_address_country: input.permanentAddress?.country ?? null,
        emergency_contact_name:         input.emergencyContact?.name ?? null,
        emergency_contact_relationship: input.emergencyContact?.relationship ?? null,
        emergency_contact_phone:        input.emergencyContact?.phone ?? null,
        emergency_contact_alt_phone:    input.emergencyContact?.altPhone ?? null,
        emergency_contact_address:      input.emergencyContact?.address ?? null,
        education:                 input.education ?? [],
        work_history:              input.workHistory ?? [],
        total_experience_years:    input.totalExperienceYears ?? null,
        experience_level:          input.experienceLevel ?? null,
        blood_group:               input.bloodGroup ?? null,
        identity_documents:        input.identityDocuments ?? [],
      })
      .select()
      .single();
    if (error) throw error;
    emp = data;
  } catch (err: any) {
    // 23505 = unique_violation. The pre-check should catch this, but if two
    // requests race the second one ends up here. Translate to a friendly 409.
    if (err?.code === '23505') {
      throw new ConflictError(
        `An employee with email ${input.email} already exists. Reload the page and search by email to find the existing record.`,
      );
    }
    throw err;
  }

  logActivity(actorId ?? null, 'created', 'employee', emp.id, emp.display_id ?? `${input.firstName} ${input.lastName}`);

  // Issue credentials and send welcome email — capture status so the controller
  // can surface email failures back to the HR user instead of silently dropping them.
  const credsResult = await issueCredentials(emp.id, emp, input);

  // Best-effort rollback: if auth setup failed entirely (no portal_users row
  // created), soft-delete the employee row so HR can retry cleanly. Without
  // this the employee exists but cannot log in, with no way to recover except
  // manual DB edits.
  if (!credsResult.credentialsReady) {
    await supabaseAdmin.from('employees')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', emp.id);
    logActivity(actorId ?? null, 'deleted', 'employee', emp.id, emp.display_id ?? input.email, { reason: 'auth_setup_failed' });
    return { ...serializeEmployee(emp), _credentials: credsResult };
  }

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
  } catch (err) {
    // Non-blocking, but surface the failure in logs so silent drops are visible
    // to operators. We deliberately do NOT rethrow — onboarding must succeed
    // even when the notification pipeline is degraded.
    console.error('[employees.service] onboarding notification failed', err);
  }

  return { ...serializeEmployee(emp), _credentials: credsResult };
}

// ── resend credentials ───────────────────────────────────────────────────────
// Lets HR re-trigger the welcome email (and rotate the temp password) without
// having to delete/recreate the employee.
export async function resendCredentials(employeeId: string, actorId?: string): Promise<CredentialsResult> {
  const { data: emp, error } = await supabaseAdmin
    .from('employees')
    .select('*')
    .eq('id', employeeId)
    .is('deleted_at', null)
    .single();
  if (error || !emp) throw new NotFoundError('Employee not found');

  // Build a CreateEmployeeInput-shaped object from the stored row to reuse
  // issueCredentials. The fields not strictly needed for the email are set to
  // safe defaults — issueCredentials only reads the email/name/work fields.
  const input: CreateEmployeeInput = {
    firstName: emp.first_name,
    lastName: emp.last_name,
    email: emp.email,
    workEmail: emp.work_email ?? undefined,
    phone: emp.phone ?? '',
    dob: emp.dob ?? '',
    address: {
      street: emp.address_street ?? '', city: emp.address_city ?? '',
      state: emp.address_state ?? '', zip: emp.address_zip ?? '',
      country: emp.address_country ?? 'US',
    },
    department: emp.department ?? '',
    jobTitle: emp.job_title ?? '',
    employmentType: emp.employment_type,
    startDate: emp.start_date,
    status: emp.status,
    visaType: emp.visa_type,
    visaExpiry: emp.visa_expiry ?? '',
    i9Status: emp.i9_status,
    payRate: Number(emp.pay_rate),
    payType: emp.pay_type,
    workLocation: emp.work_location ?? null,
    ssn: emp.ssn ?? '',
    paymentType: emp.payment_type ?? null,
    bankName: emp.bank_name ?? null,
    bankRoutingNumber: emp.bank_routing_number ?? null,
    bankAccountNumber: emp.bank_account_number ?? null,
    taxFormType: emp.tax_form_type ?? null,
    reportingManagerId: emp.reporting_manager_id ?? null,
    // Onboarding-form extension fields. issueCredentials only touches
    // name/email/work_email so empty defaults are fine here.
    education: [],
    workHistory: [],
    identityDocuments: [],
  };

  const result = await issueCredentials(emp.id, emp, input);
  logActivity(actorId ?? null, 'updated', 'employee', emp.id, emp.display_id ?? `${emp.first_name} ${emp.last_name}`, { event: 'resent_credentials' });
  return result;
}

// ── update ───────────────────────────────────────────────────────────────────

export async function updateEmployee(id: string, input: UpdateEmployeeInput, actorId?: string) {
  const { data: existing, error: findErr } = await supabaseAdmin
    .from('employees')
    .select('id, display_id, email, work_email')
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
  if (input.status !== undefined)     patch.status          = input.status;
  if (input.visaType !== undefined)   patch.visa_type       = input.visaType;
  if (input.visaExpiry !== undefined) patch.visa_expiry     = input.visaExpiry || null;
  if (input.i9Status !== undefined)   patch.i9_status       = input.i9Status;
  if (input.payRate !== undefined)    patch.pay_rate        = input.payRate;
  if (input.payType !== undefined)    patch.pay_type        = input.payType;
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

  // Onboarding-form extension fields. Only patch when explicitly provided so
  // existing rows keep their values unless the form sends an explicit change.
  if (input.middleName !== undefined)        patch.middle_name        = input.middleName;
  if (input.gender !== undefined)            patch.gender             = input.gender;
  if (input.maritalStatus !== undefined)     patch.marital_status     = input.maritalStatus;
  if (input.nationality !== undefined)       patch.nationality        = input.nationality;
  if (input.preferredLanguage !== undefined) patch.preferred_language = input.preferredLanguage;
  if (input.languagesKnown !== undefined)    patch.languages_known    = input.languagesKnown;
  if (input.profilePhotoUrl !== undefined)   patch.profile_photo_url  = input.profilePhotoUrl;
  if (input.altPhone !== undefined)          patch.alt_phone          = input.altPhone;
  if (input.linkedinUrl !== undefined)       patch.linkedin_url       = input.linkedinUrl;
  if (input.skypeId !== undefined)           patch.skype_id           = input.skypeId;
  if (input.permanentAddress !== undefined) {
    patch.permanent_address_street  = input.permanentAddress?.street ?? null;
    patch.permanent_address_city    = input.permanentAddress?.city ?? null;
    patch.permanent_address_state   = input.permanentAddress?.state ?? null;
    patch.permanent_address_zip     = input.permanentAddress?.zip ?? null;
    patch.permanent_address_country = input.permanentAddress?.country ?? null;
  }
  if (input.emergencyContact !== undefined) {
    patch.emergency_contact_name         = input.emergencyContact?.name ?? null;
    patch.emergency_contact_relationship = input.emergencyContact?.relationship ?? null;
    patch.emergency_contact_phone        = input.emergencyContact?.phone ?? null;
    patch.emergency_contact_alt_phone    = input.emergencyContact?.altPhone ?? null;
    patch.emergency_contact_address      = input.emergencyContact?.address ?? null;
  }
  if (input.education !== undefined)            patch.education             = input.education;
  if (input.workHistory !== undefined)          patch.work_history          = input.workHistory;
  if (input.totalExperienceYears !== undefined) patch.total_experience_years = input.totalExperienceYears;
  if (input.experienceLevel !== undefined)      patch.experience_level      = input.experienceLevel;
  if (input.bloodGroup !== undefined)           patch.blood_group           = input.bloodGroup;
  if (input.identityDocuments !== undefined)    patch.identity_documents    = input.identityDocuments;

  const { data: emp, error } = await supabaseAdmin
    .from('employees')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // If an email changed, automatically (re-)send the credentials to the new
  // address(es). resendCredentials → issueCredentials links the login by
  // employee_id, so it updates the existing login's email + password and emails
  // BOTH the personal and work addresses. This is what HR expects: "edit the
  // email → the new mailbox gets the login credentials." Best-effort; a send
  // failure must not fail the update.
  const personalChanged = input.email !== undefined && (input.email ?? '') !== (existing.email ?? '');
  const workChanged     = input.workEmail !== undefined && (input.workEmail ?? '') !== (existing.work_email ?? '');
  if (personalChanged || workChanged) {
    try {
      await resendCredentials(id, actorId);
      console.log('[updateEmployee] email changed → re-sent credentials for', id);
    } catch (err) {
      console.error('[updateEmployee] auto-resend credentials failed for', id, err);
    }
  }

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

  // Remove the linked portal login + auth user. Without this the deleted
  // employee could still sign in, and their session keeps fetching this
  // now-404 record (sidebar avatar, My Profile) — the "random 404s". Best-effort:
  // a cleanup failure must not abort the delete. portal_users.id === auth user id.
  try {
    const { data: pu } = await supabaseAdmin
      .from('portal_users').select('id').eq('employee_id', id).maybeSingle();
    if (pu?.id) {
      await supabaseAdmin.from('portal_users').delete().eq('id', pu.id);
      const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(pu.id);
      if (authErr) console.error('[deleteEmployee] auth.deleteUser failed for', pu.id, authErr);
    }
  } catch (err) {
    console.error('[deleteEmployee] login cleanup failed for employee', id, err);
  }

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
    .select('display_id,first_name,last_name,email,phone,department,job_title,employment_type,start_date,status,visa_type,visa_expiry,pay_rate,pay_type,work_location')
    .order('display_id');
  if (query.status) q = q.eq('status', query.status);
  if (query.department) q = q.eq('department', query.department);
  const { data, error } = await q;
  if (error) throw error;

  const headers = ['ID','First Name','Last Name','Email','Phone','Department','Job Title','Employment Type','Start Date','Status','Visa Type','Visa Expiry','Pay Rate','Pay Type','Work Location'];
  const rows = (data ?? []).map(e => [
    e.display_id ?? '',
    e.first_name ?? '', e.last_name ?? '', e.email ?? '', e.phone ?? '',
    e.department ?? '', e.job_title ?? '', e.employment_type ?? '', e.start_date ?? '', e.status ?? '',
    e.visa_type ?? '', e.visa_expiry ?? '',
    e.pay_rate ?? '', e.pay_type ?? '', e.work_location ?? '',
  ]);
  return [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
}

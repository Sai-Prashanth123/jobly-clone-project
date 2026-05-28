import { supabaseAdmin } from '../config/supabase';
import { ConflictError, NotFoundError, ForbiddenError, ValidationError } from '../lib/errors';
import { logActivity } from '../lib/activityLogger';
import { sendWelcomeEmail, sendOnboardingCompletedEmail, sendOnboardingChangesRequestedEmail, mailerConfigured } from '../lib/mailer';
import { createNotification, getUserIdsByRole } from './notifications.service';
import { computeOnboarding } from '../lib/onboarding';
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

  const rows = data ?? [];
  // One aggregate query for the page's document types so each row can carry its
  // onboarding completeness % (list rows don't otherwise include documents).
  const ids = rows.map(r => r.id);
  const typesByEmp = new Map<string, Set<string>>();
  if (ids.length) {
    const { data: docs } = await supabaseAdmin
      .from('documents')
      .select('entity_id, type')
      .eq('entity_type', 'employee')
      .in('entity_id', ids);
    for (const d of docs ?? []) {
      if (!typesByEmp.has(d.entity_id)) typesByEmp.set(d.entity_id, new Set());
      typesByEmp.get(d.entity_id)!.add(d.type);
    }
  }

  return {
    data: rows.map(r => ({
      ...serializeEmployee(r),
      onboarding: computeOnboarding(r, typesByEmp.get(r.id) ?? new Set()),
    })),
    total: count ?? 0,
  };
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

  const docList = docs ?? [];
  const docTypes = new Set<string>(docList.map((d: any) => d.type));
  return {
    ...serializeEmployee(emp),
    documents: docList,
    onboarding: computeOnboarding(emp, docTypes),
  };
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
        must_reset_password: true,   // the temp password is first-login-only
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
          must_reset_password: true,   // the temp password is first-login-only
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
  // Fire-and-forget the welcome email — a slow SMTP roundtrip (500-3000ms +
  // retries) was making the entire create-employee response wait on mail
  // delivery. The credentials row is already persisted; HR has a "Resend
  // Welcome Email" button on the detail page if delivery fails.
  void sendWelcomeEmail({
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
  })
    .then(() => console.log('[mailer] credentials email sent to', recipients.join(', '), '(login:', portalLoginEmail, ')'))
    .catch((err: any) => console.error('[mailer] credentials email FAILED for', recipients.join(', '), {
      code: err?.code, responseCode: err?.responseCode, response: err?.response,
      rejected: err?.rejected, message: err?.message,
    }));
  return { credentialsReady: true, emailSent: true, loginEmail: portalLoginEmail };
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
        employment_type:   input.employmentType ?? 'contract',
        // start_date is NOT NULL; default to today when HR didn't set it.
        start_date:        input.startDate || new Date().toISOString().slice(0, 10),
        // New hires ALWAYS start in onboarding — they auto-activate only after
        // completing self-onboarding. (Ignore any status the form sent.)
        status:            'onboarding',
        visa_type:         input.visaType ?? null,
        visa_expiry:       input.visaExpiry || null,
        i9_status:         input.i9Status ?? null,
        pay_rate:          input.payRate ?? 0,
        pay_type:          input.payType ?? 'hourly',
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

  // Notify HR/admin about the new onboarding employee — TRULY fire-and-forget,
  // and fan out the inserts in parallel (was sequential `await` per user). The
  // employee + auth + portal_users are already persisted, so create response
  // returns immediately. Mirrors invoices.service generateInvoice notify block.
  void (async () => {
    try {
      const [hrIds, adminIds] = await Promise.all([
        getUserIdsByRole('hr'),
        getUserIdsByRole('admin'),
      ]);
      const label = emp.display_id ?? `${input.firstName} ${input.lastName}`;
      const msg = `${label} (${input.firstName} ${input.lastName}) has been added and is pending onboarding completion.`;
      await Promise.all(
        [...new Set([...hrIds, ...adminIds])].map(uid =>
          createNotification(uid, 'New Employee Onboarding', msg, 'info', 'employee', emp.id),
        ),
      );
    } catch (err) {
      console.error('[employees.service] new-employee notification failed', err);
    }
  })();

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

  // If the employee has already completed their first-login reset (i.e. set
  // their OWN password), do NOT regenerate a temp — that would overwrite the
  // password they chose. Send an info letter (login email + portal link, no
  // password) instead.
  const { data: pu } = await supabaseAdmin
    .from('portal_users')
    .select('id, email, must_reset_password')
    .eq('employee_id', employeeId)
    .maybeSingle();

  if (pu && pu.must_reset_password === false) {
    const personalEmail = (emp.email ?? '').trim();
    const workEmail = (emp.work_email ?? '').trim();
    const loginEmail = (pu.email as string) || workEmail || personalEmail;
    const recipients = [...new Set([personalEmail, workEmail].filter(Boolean))];
    let emailSent = false;
    let warning: string | undefined;
    if (!mailerConfigured) {
      warning = 'Mailer is not configured; no info letter was sent.';
    } else if (recipients.length === 0) {
      warning = 'No email address on file to send to.';
    } else {
      try {
        await sendWelcomeEmail({
          to: recipients,
          firstName: emp.first_name,
          lastName: emp.last_name,
          loginEmail,
          // no tempPassword → info-only letter (the account is already active)
        });
        emailSent = true;
      } catch (err: any) {
        warning = `Info letter could not be sent (${err?.code ?? ''} ${err?.message ?? 'send failed'}).`;
      }
    }
    logActivity(actorId ?? null, 'updated', 'employee', emp.id, emp.display_id ?? `${emp.first_name} ${emp.last_name}`, { event: 'resent_welcome_info' });
    return { credentialsReady: true, emailSent, warning, loginEmail };
  }

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

export async function updateEmployee(id: string, input: UpdateEmployeeInput, actorId?: string, actorRole?: string) {
  const { data: existing, error: findErr } = await supabaseAdmin
    .from('employees')
    .select('id, display_id, email, work_email, status')
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

  // When an EMPLOYEE edits their own record (self-onboarding / profile edit),
  // HR/legal/pay fields are off-limits — strip them so a self-update can never
  // change pay, SSN, visa, I-9, status, employment terms, or the login email.
  if (actorRole === 'employee') {
    const HR_ONLY = [
      'pay_rate', 'pay_type', 'payment_type', 'bank_name', 'bank_routing_number',
      'bank_account_number', 'tax_form_type', 'ssn', 'visa_type', 'visa_expiry',
      'i9_status', 'employment_type', 'status', 'reporting_manager_id',
      'department', 'job_title', 'start_date', 'work_location', 'email', 'work_email',
    ];
    for (const k of HR_ONLY) delete patch[k];
  }

  const { data: emp, error } = await supabaseAdmin
    .from('employees')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // HR approved onboarding (onboarding → active): notify the employee in-app so
  // they're not stuck on the "awaiting review" screen. Fire-and-forget.
  if (input.status === 'active' && existing.status === 'onboarding') {
    void (async () => {
      try {
        const { data: pu } = await supabaseAdmin
          .from('portal_users').select('id').eq('employee_id', id).maybeSingle();
        if (pu?.id) {
          await createNotification(
            pu.id,
            'Onboarding approved',
            'Your onboarding has been approved — welcome aboard! You now have full access to the portal.',
            'success', 'employee', id,
          );
        }
      } catch (err) {
        console.error('[employees.service] onboarding-approved notification failed', err);
      }
    })();
  }

  // If an email changed, update the login accordingly — WITHOUT ever overwriting
  // a password the employee chose. If they're still on the one-time temp (or have
  // no login yet) we re-issue a fresh temp to the new address. If they've already
  // set their own password, we only move the login email and keep their password,
  // notifying them of the change. Best-effort; a failure must not fail the update.
  const personalChanged = input.email !== undefined && (input.email ?? '') !== (existing.email ?? '');
  const workChanged     = input.workEmail !== undefined && (input.workEmail ?? '') !== (existing.work_email ?? '');
  // Email is HR-owned (stripped from an employee's own patch above), so only act
  // on a real email change made by HR/admin.
  if ((personalChanged || workChanged) && actorRole !== 'employee') {
    try {
      const { data: pu } = await supabaseAdmin
        .from('portal_users')
        .select('id, must_reset_password')
        .eq('employee_id', id)
        .maybeSingle();

      if (!pu || pu.must_reset_password !== false) {
        // No login yet, or still on the temp → re-issue temp creds to the new email.
        await resendCredentials(id, actorId);
        console.log('[updateEmployee] email changed → re-issued temp credentials for', id);
      } else {
        // User has their own password → move the login email only, keep password.
        const newPersonal = (emp.email ?? '').trim();
        const newWork = (emp.work_email ?? '').trim();
        const newLoginEmail = newWork || newPersonal;
        if (newLoginEmail) {
          const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(
            pu.id, { email: newLoginEmail, email_confirm: true },
          );
          if (authErr) throw authErr;
          await supabaseAdmin.from('portal_users').update({ email: newLoginEmail }).eq('id', pu.id);

          try {
            await createNotification(
              pu.id, 'Login email updated',
              `Your Jobly login email is now ${newLoginEmail}. Your password is unchanged.`,
              'info',
            );
          } catch { /* notification is best-effort */ }

          const recipients = [...new Set([newPersonal, newWork].filter(Boolean))];
          if (mailerConfigured && recipients.length) {
            try {
              await sendWelcomeEmail({
                to: recipients,
                firstName: emp.first_name,
                lastName: emp.last_name,
                loginEmail: newLoginEmail,
                subject: 'Your Jobly login email has changed',
                bodyIntro: 'Your Jobly Portal login email has been updated. Use the address below to log in next time &mdash; your password is unchanged.',
              });
            } catch (e) {
              console.error('[updateEmployee] login-email-changed notice failed for', id, e);
            }
          }
          console.log('[updateEmployee] email changed → moved login email (password kept) for', id);
        }
      }
    } catch (err) {
      console.error('[updateEmployee] email-change credential handling failed for', id, err);
    }
  }

  logActivity(actorId ?? null, 'updated', 'employee', id, emp.display_id ?? id.slice(0, 8));
  return serializeEmployee(emp);
}

// Notify HR + admin that an employee finished onboarding — in-app notification
// + email. Fire-and-forget: callers must NOT await this (it must never block or
// fail onboarding completion). Internally swallows its own errors.
async function notifyOnboardingCompleted(emp: any): Promise<void> {
  const fullName = `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim();
  const label = emp.display_id ?? fullName;

  // In-app notifications to all HR + admin users.
  try {
    const hrIds = await getUserIdsByRole('hr');
    const adminIds = await getUserIdsByRole('admin');
    for (const uid of [...new Set([...hrIds, ...adminIds])]) {
      await createNotification(
        uid,
        'Onboarding submitted for review',
        `${label} (${fullName}) submitted their onboarding and is awaiting your review & approval.`,
        'info', 'employee', emp.id,
      );
    }
  } catch (err) {
    console.error('[employees.service] onboarding-completed in-app notification failed', err);
  }

  // Email HR + admin (respects mailer config).
  if (!mailerConfigured) return;
  try {
    const { data: recipients } = await supabaseAdmin
      .from('portal_users').select('email').in('role', ['hr', 'admin']);
    const to = [...new Set((recipients ?? []).map((r: any) => r.email).filter(Boolean))];
    if (to.length === 0) return;
    const portalBase = (process.env.FRONTEND_URL ?? '').replace(/\/$/, '');
    await sendOnboardingCompletedEmail({
      to,
      employeeName: fullName,
      displayId: emp.display_id ?? emp.id,
      department: emp.department ?? undefined,
      jobTitle: emp.job_title ?? undefined,
      completedAt: emp.onboarding_completed_at ?? new Date().toISOString(),
      detailUrl: portalBase ? `${portalBase}/portal/employees/${emp.id}` : undefined,
    });
  } catch (err) {
    console.error('[employees.service] onboarding-completed email failed', err);
  }
}

// ── onboarding submission ───────────────────────────────────────────────────────
// Submits self-onboarding for HR review: server-side re-validates the full
// checklist (so the gate can't be skipped) and stamps onboarding_completed_at as
// the "submitted" marker. Status stays 'onboarding' until HR approves (which sets
// status → 'active' via updateEmployee / the Approve Onboarding button). An
// employee may only submit their own.
export async function completeOnboarding(id: string, actorRole?: string, actorEmployeeId?: string, actorId?: string) {
  if (actorRole === 'employee' && actorEmployeeId !== id) {
    throw new ForbiddenError('You may only complete your own onboarding');
  }

  const { data: emp, error } = await supabaseAdmin
    .from('employees').select('*').eq('id', id).is('deleted_at', null).single();
  if (error || !emp) throw new NotFoundError('Employee not found');

  const { data: docs } = await supabaseAdmin
    .from('documents').select('type').eq('entity_type', 'employee').eq('entity_id', id);
  const docTypes = new Set<string>((docs ?? []).map((d: any) => d.type));

  const result = computeOnboarding(emp, docTypes);
  if (!result.complete) {
    throw new ValidationError(`Onboarding is incomplete. Still required: ${result.missing.join(', ')}`);
  }

  // Mark as submitted for HR review — do NOT auto-activate. HR approval flips
  // status → 'active' (see updateEmployee / the Approve Onboarding button).
  // If this is a re-submission after an HR "Request Changes", clear the
  // change-request columns so the pending screen renders normally and HR sees
  // a clean "submitted for review" state again.
  const wasChangeRequested = !!emp.onboarding_change_request_message;
  const patch: Record<string, any> = { onboarding_completed_at: new Date().toISOString() };
  if (wasChangeRequested) {
    patch.onboarding_change_request_message = null;
    patch.onboarding_change_requested_at = null;
    patch.onboarding_change_requested_by = null;
  }
  const { data: updated, error: updErr } = await supabaseAdmin
    .from('employees').update(patch).eq('id', id).select().single();
  if (updErr) throw updErr;

  logActivity(
    actorId ?? null, 'updated', 'employee', id,
    updated.display_id ?? id.slice(0, 8),
    { event: wasChangeRequested ? 'onboarding_resubmitted' : 'onboarding_submitted' },
  );

  // Tell HR an employee submitted onboarding and is awaiting review (in-app + email).
  // Fire-and-forget so a slow mailer can never delay/504 the employee's "Finish".
  void notifyOnboardingCompleted(updated);

  // Build the full documents list from rows we ALREADY fetched above — no
  // second round-trip. The `docs` query selected only `type`; for the response
  // we want full rows, so reuse and project from a single query (replace the
  // initial query with the full select inline).
  const { data: docList } = await supabaseAdmin
    .from('documents').select('*').eq('entity_type', 'employee').eq('entity_id', id);
  return { ...serializeEmployee(updated), documents: docList ?? [], onboarding: computeOnboarding(updated, docTypes) };
}

// ── HR-side: request changes from the employee ─────────────────────────────────
// Called by HR/admin from the employee detail page. Stashes HR's message on the
// employee row, clears onboarding_completed_at (so the gate re-routes the
// employee from "pending review" back to "needs to update"), and notifies the
// employee (in-app + email). status stays 'onboarding'; we surface the
// "changes_requested" state in the application layer (computeOnboardingStatus).
export async function requestOnboardingChanges(
  id: string,
  message: string,
  actorId?: string,
): Promise<{ employee: any }> {
  const { data: emp, error } = await supabaseAdmin
    .from('employees').select('*').eq('id', id).is('deleted_at', null).single();
  if (error || !emp) throw new NotFoundError('Employee not found');
  if (emp.status !== 'onboarding') {
    throw new ValidationError('Change requests are only valid for employees currently onboarding.');
  }
  if (!emp.onboarding_completed_at) {
    throw new ValidationError('Employee has not submitted their onboarding yet — nothing to review.');
  }

  const patch: Record<string, any> = {
    onboarding_change_request_message: message,
    onboarding_change_requested_at: new Date().toISOString(),
    onboarding_change_requested_by: actorId ?? null,
    // Clear the submission timestamp so the gate routes them back to the
    // wizard and the pending screen shows the "HR has requested changes" UI.
    onboarding_completed_at: null,
  };
  const { data: updated, error: updErr } = await supabaseAdmin
    .from('employees').update(patch).eq('id', id).select().single();
  if (updErr) throw updErr;

  logActivity(actorId ?? null, 'updated', 'employee', id, updated.display_id ?? id.slice(0, 8), {
    event: 'onboarding_changes_requested',
  });

  // Fire-and-forget: notify the employee in-app + by email.
  void notifyOnboardingChangesRequested(updated, message);

  return { employee: updated };
}

// Internal helper — mirrors notifyOnboardingCompleted but for the changes-requested case.
async function notifyOnboardingChangesRequested(emp: any, message: string): Promise<void> {
  const fullName = `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim();
  // In-app notification to the employee's portal user.
  try {
    const { data: pu } = await supabaseAdmin
      .from('portal_users').select('id, email').eq('employee_id', emp.id).maybeSingle();
    if (pu?.id) {
      await createNotification(
        pu.id,
        'HR has requested changes to your onboarding',
        message.length > 280 ? `${message.slice(0, 277)}…` : message,
        'warning',
        'employee',
        emp.id,
      );
    }
    if (pu?.email && mailerConfigured) {
      const portalBase = (process.env.FRONTEND_URL ?? '').replace(/\/$/, '');
      await sendOnboardingChangesRequestedEmail({
        to: pu.email,
        employeeName: fullName || 'there',
        displayId: emp.display_id ?? emp.id,
        message,
        portalUrl: portalBase ? `${portalBase}/portal/onboarding/pending` : undefined,
      });
    }
  } catch (err) {
    console.error('[employees.service] changes-requested notification failed', err);
  }
}

// ── Employee-side: self-reopen the wizard before HR has acted ──────────────────
// Called from the OnboardingPending screen's "Change information" button. Only
// valid when the caller IS the employee, status is 'onboarding', and
// onboarding_completed_at is set (they're on the pending screen). Clears the
// submission timestamp so the gate sends them back to the wizard.
export async function reopenOnboarding(
  id: string,
  actorRole?: string,
  actorEmployeeId?: string,
): Promise<{ employee: any }> {
  if (actorRole === 'employee' && actorEmployeeId !== id) {
    throw new ForbiddenError('You may only reopen your own onboarding.');
  }
  const { data: emp, error } = await supabaseAdmin
    .from('employees').select('id, status, onboarding_completed_at, display_id').eq('id', id).is('deleted_at', null).single();
  if (error || !emp) throw new NotFoundError('Employee not found');
  if (emp.status !== 'onboarding' || !emp.onboarding_completed_at) {
    throw new ValidationError('Onboarding is not in a submitted state — nothing to reopen.');
  }
  const { data: updated, error: updErr } = await supabaseAdmin
    .from('employees').update({ onboarding_completed_at: null }).eq('id', id).select().single();
  if (updErr) throw updErr;
  logActivity(actorEmployeeId ?? null, 'updated', 'employee', id, emp.display_id ?? id.slice(0, 8), {
    event: 'onboarding_reopened',
  });
  return { employee: updated };
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

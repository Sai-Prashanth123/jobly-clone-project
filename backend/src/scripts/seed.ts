/**
 * Seed script — populates Supabase with demo data matching the 5 portal roles.
 * Run: cd backend && npm run seed
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const USERS = [
  { email: 'admin@joblysolutions.com',    password: 'Jbly#Adm!n2026',  name: 'Alex Admin',     role: 'admin',      initials: 'AA' },
  { email: 'hr@joblysolutions.com',       password: 'Jbly#Hr!2026',    name: 'Hannah HR',      role: 'hr',         initials: 'HH' },
  { email: 'ops@joblysolutions.com',      password: 'Jbly#0ps!2026',   name: 'Oscar Ops',      role: 'operations', initials: 'OO' },
  { email: 'finance@joblysolutions.com',  password: 'Jbly#F!n2026',    name: 'Fiona Finance',  role: 'finance',    initials: 'FF' },
  { email: 'john.doe@joblysolutions.com', password: 'Jbly#Emp!2026',   name: 'John Doe',       role: 'employee',   initials: 'JD' },
];

async function seed() {
  console.log('🌱 Seeding Supabase...\n');

  // 1. Create auth users + portal_users
  const userIds: Record<string, string> = {};

  for (const u of USERS) {
    console.log(`Creating auth user: ${u.email}`);
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    });

    if (error) {
      if (error.message.includes('already')) {
        console.log(`  ⚠ Already exists, fetching...`);
        const { data: list } = await supabase.auth.admin.listUsers();
        const existing = list?.users?.find(us => us.email === u.email);
        if (existing) userIds[u.email] = existing.id;
      } else {
        console.error(`  ✗ Error:`, error.message);
      }
      continue;
    }

    const userId = data.user.id;
    userIds[u.email] = userId;

    await supabase.from('portal_users').upsert({
      id: userId,
      email: u.email,
      name: u.name,
      role: u.role,
      avatar_initials: u.initials,
    });
    console.log(`  ✓ Created portal_user`);
  }

  // 2. Create employees
  console.log('\nCreating employees...');
  const { data: emp1 } = await supabase.from('employees').insert({
    first_name: 'John', last_name: 'Doe',
    email: 'john.doe@joblysolutions.com', phone: '555-0101',
    department: 'Engineering', job_title: 'Software Engineer',
    employment_type: 'w2', start_date: '2024-01-15',
    status: 'active', visa_type: 'h1b', visa_expiry: '2027-01-14',
    i9_status: 'complete', pay_rate: 85.00, pay_type: 'hourly',
    pay_frequency: 'biweekly', work_location: 'Remote',
  }).select().single();

  const { data: emp2 } = await supabase.from('employees').insert({
    first_name: 'Jane', last_name: 'Smith',
    email: 'jane.smith@joblysolutions.com', phone: '555-0102',
    department: 'Engineering', job_title: 'Senior Developer',
    employment_type: 'w2', start_date: '2023-06-01',
    status: 'active', pay_rate: 95.00, pay_type: 'hourly',
    pay_frequency: 'biweekly', work_location: 'On-site',
  }).select().single();

  const { data: emp3 } = await supabase.from('employees').insert({
    first_name: 'Carlos', last_name: 'Rivera',
    email: 'carlos.rivera@joblysolutions.com', phone: '555-0103',
    department: 'QA', job_title: 'QA Engineer',
    employment_type: '1099', start_date: '2024-03-01',
    status: 'active', visa_type: 'opt', visa_expiry: '2025-12-31',
    i9_status: 'complete', pay_rate: 70.00, pay_type: 'hourly',
    pay_frequency: 'weekly', work_location: 'Hybrid',
  }).select().single();

  console.log(`  ✓ Created 3 employees`);

  // Link John Doe portal user to employee record
  const johnId = userIds['john.doe@joblysolutions.com'];
  if (johnId && emp1) {
    await supabase.from('portal_users')
      .update({ employee_id: emp1.id })
      .eq('id', johnId);
  }

  // 3. Create clients
  console.log('\nCreating clients...');
  const { data: client1 } = await supabase.from('clients').insert({
    company_name: 'TechCorp Solutions', contact_name: 'Mike Johnson',
    contact_email: 'mike@techcorp.com', contact_phone: '555-1001',
    industry: 'Technology', contract_start_date: '2024-01-01',
    net_payment_days: 30, default_bill_rate: 150.00, currency: 'USD',
    billing_type: 'hourly', status: 'active',
  }).select().single();

  const { data: client2 } = await supabase.from('clients').insert({
    company_name: 'FinServ Inc', contact_name: 'Sarah Williams',
    contact_email: 'sarah@finserv.com', contact_phone: '555-1002',
    industry: 'Finance', contract_start_date: '2023-07-01',
    net_payment_days: 45, default_bill_rate: 175.00, currency: 'USD',
    billing_type: 'hourly', status: 'active',
  }).select().single();

  console.log(`  ✓ Created 2 clients`);

  // 4. Create assignments
  if (!emp1 || !emp2 || !emp3 || !client1 || !client2) {
    console.error('Failed to create base entities');
    return;
  }

  console.log('\nCreating assignments...');
  const { data: asgn1 } = await supabase.from('assignments').insert({
    employee_id: emp1.id, client_id: client1.id,
    project_name: 'Platform Migration', role: 'Backend Developer',
    start_date: '2024-02-01', bill_rate: 150.00, pay_rate: 85.00,
    max_hours_per_week: 40, status: 'active', billing_type: 'hourly',
    work_location: 'Remote',
  }).select().single();

  const { data: asgn2 } = await supabase.from('assignments').insert({
    employee_id: emp2.id, client_id: client1.id,
    project_name: 'Platform Migration', role: 'Senior Developer',
    start_date: '2024-02-01', bill_rate: 150.00, pay_rate: 95.00,
    max_hours_per_week: 40, status: 'active', billing_type: 'hourly',
  }).select().single();

  const { data: asgn3 } = await supabase.from('assignments').insert({
    employee_id: emp3.id, client_id: client2.id,
    project_name: 'Core Banking QA', role: 'QA Engineer',
    start_date: '2024-03-15', bill_rate: 120.00, pay_rate: 70.00,
    max_hours_per_week: 40, status: 'active', billing_type: 'hourly',
  }).select().single();

  console.log(`  ✓ Created 3 assignments`);

  // 5. Create timesheets
  if (!asgn1 || !asgn2 || !asgn3) {
    console.error('Failed to create assignments');
    return;
  }

  console.log('\nCreating timesheets...');
  const weeks = ['2025-01-06', '2025-01-13', '2025-01-20', '2025-01-27'];

  for (const weekStart of weeks) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    const { data: ts } = await supabase.from('timesheets').insert({
      employee_id: emp1.id, assignment_id: asgn1.id, client_id: client1.id,
      week_start_date: weekStart, week_end_date: weekEndStr,
      total_hours: 40, status: 'client_approved',
      submitted_at: new Date().toISOString(),
      manager_approved_at: new Date().toISOString(),
      client_approved_at: new Date().toISOString(),
    }).select().single();

    if (ts) {
      const entries = ['Mon','Tue','Wed','Thu','Fri'].map((day, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return {
          timesheet_id: ts.id, entry_date: d.toISOString().split('T')[0],
          day_of_week: day, hours: 8, is_billable: true,
        };
      });
      await supabase.from('timesheet_entries').insert(entries);
    }
  }

  // One pending timesheet for approval flow demo
  const pendingWeek = '2025-02-03';
  const pendingEnd = '2025-02-09';
  await supabase.from('timesheets').insert({
    employee_id: emp2.id, assignment_id: asgn2.id, client_id: client1.id,
    week_start_date: pendingWeek, week_end_date: pendingEnd,
    total_hours: 38, status: 'submitted',
    submitted_at: new Date().toISOString(),
  });

  console.log(`  ✓ Created timesheets`);

  console.log('\n✅ Seed complete!\n');
  console.log('Demo accounts ready:');
  for (const u of USERS) {
    console.log(`  ${u.role.padEnd(12)} ${u.email}  /  ${u.password}`);
  }
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});

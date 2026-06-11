/**
 * One-off: add admin login users with a shared temporary password.
 * Each is forced to set their own password on first login
 * (portal_users.must_reset_password = true → ProtectedRoute force-reset gate).
 *
 * Run: cd backend && npx tsx src/scripts/addAdmins.ts
 * Idempotent — safe to re-run (re-applies the temp password if the user exists).
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Shared one-time temp password — both admins must change it on first login.
const TEMP_PASSWORD = 'JoblyAdmin@2026!';

const ADMINS = [
  { email: 'gayathri.s@joblysolutions.com', name: 'Gayathri S', initials: 'GS' },
  { email: 'mahe@joblysolutions.com',       name: 'Mahe',       initials: 'MH' },
];

async function findUserIdByEmail(email: string): Promise<string | undefined> {
  // listUsers is paginated — page through in case the project has many users.
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found.id;
    if (data.users.length < 200) break;
  }
  return undefined;
}

async function run() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in backend/.env');
  }
  console.log('Adding admin users...\n');

  for (const a of ADMINS) {
    let userId: string | undefined;

    const { data, error } = await supabase.auth.admin.createUser({
      email: a.email,
      password: TEMP_PASSWORD,
      email_confirm: true,
    });

    if (error) {
      const exists = error.message.toLowerCase().includes('already') || (error as { status?: number }).status === 422;
      if (exists) {
        console.log(`  ⚠ ${a.email} already exists — re-applying temp password`);
        userId = await findUserIdByEmail(a.email);
        if (!userId) { console.error(`  ✗ could not locate existing user ${a.email}`); continue; }
        const { error: updErr } = await supabase.auth.admin.updateUserById(userId, {
          password: TEMP_PASSWORD,
          email_confirm: true,
        });
        if (updErr) { console.error(`  ✗ password update failed for ${a.email}:`, updErr.message); continue; }
      } else {
        console.error(`  ✗ createUser failed for ${a.email}:`, error.message);
        continue;
      }
    } else {
      userId = data.user.id;
      console.log(`  ✓ Created auth user ${a.email}`);
    }

    const { error: puErr } = await supabase.from('portal_users').upsert({
      id: userId,
      email: a.email,
      name: a.name,
      role: 'admin',
      avatar_initials: a.initials,
      must_reset_password: true,
    });
    if (puErr) { console.error(`  ✗ portal_users upsert failed for ${a.email}:`, puErr.message); continue; }
    console.log(`  ✓ portal_user ready (admin · must_reset_password=true) for ${a.email}`);
  }

  // Read-back verification
  const { data: rows, error: readErr } = await supabase
    .from('portal_users')
    .select('email, role, must_reset_password')
    .in('email', ADMINS.map(a => a.email));
  console.log('\nVerification (portal_users):');
  console.log(JSON.stringify(rows ?? readErr, null, 2));

  console.log(`\nDONE. Shared temporary password for both admins: ${TEMP_PASSWORD}`);
  console.log('Both will be forced to set their own password on first login.');
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

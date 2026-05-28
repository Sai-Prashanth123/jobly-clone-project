# Edge-case hardening — remaining items

Out of the 50 edge cases identified during the corporate-grade audit, the following
high-impact items are **shipped** in commits `b241634` + the Pass 3 follow-up:

| # | Item | Status |
|---|---|---|
| 1 | Monthly-TS duplicate upsert race (23505 retry) | ✅ shipped |
| 5 | Rate-limit POST /auth/change-password | ✅ shipped |
| 8 | Idle session timeout (30 min) in apiClient | ✅ shipped |
| 9 | Document URL endpoint ownership check | ✅ already present (verified) |
| 12 | Audit invoice PDF downloads | ✅ shipped |
| 15 | Server-computed total_hours on weekly timesheets | ✅ shipped |
| 16 | Assignment endDate ≥ startDate refine | ✅ already present (verified) |
| 17 | SSN-last-4 rejects placeholder values (0000/1234) | ✅ shipped |
| 19 | Document signed-URL TTL bumped from 15→60 min | ✅ shipped |
| 21 | Profile photo upload cleans up old files | ✅ shipped |
| 36 | Soft-deleted employee can't log in (Supabase auth.deleteUser) | ✅ already present (verified — see deleteEmployee purge) |
| — | **Period lockout on past timesheets (weekly + monthly)** | ✅ shipped (user-requested) |
| — | **Zero-hour timesheet requires leave_reason** | ✅ shipped (user-requested) |
| — | **Non-zero timesheet requires client-signed proof upload** | ✅ shipped (user-requested) |
| — | **Hide client-proof requirement on zero-hour (medical leave) periods** | ✅ shipped (user-requested) |
| — | **Clients = admin-only create; ops manages** | ✅ shipped (user-requested) |
| — | **Employee self-update persists onboarding-required fields** | ✅ shipped (prior commit) |
| — | **HR_ONLY allow-list trimmed to only truly sensitive fields** | ✅ shipped (prior commit) |
| — | **activityLogger action enum widened for new audit events** | ✅ shipped |

## Deferred to a follow-up PR

These 30+ items need their own focused PR — most require schema migrations,
service rewrites, or new infrastructure (retry queues, idempotency cache, etc.):

### Concurrency (high impact, needs care)
- **#2** Invoice-number Postgres sequence (replace count-and-pad loop) — schema migration + service rewrite.
- **#3** Optimistic-lock `version` column on timesheets + monthly_timesheets — migration + every status patch updated.
- **#4** Monthly-TS PDF idempotency (delete old storage object on regen).
- **#27** Weekly-TS week-length CHECK constraint (`week_end_date = week_start_date + 6 days`).

### Auth + Session
- **#6** Rate-limit `/auth/me` + `/auth/logout` with `apiLimiter`.
- **#7** Verify post-reset stale-token window (already partially fixed; add a comment).
- **#47** `auth.admin.signOut(userId, 'global')` on user delete (Supabase auth.deleteUser already invalidates, but explicit signOut is belt-and-suspenders).

### RBAC + Data redaction
- **#10** HR audit history on requested_changes (JSONB array of changes).
- **#11** Redact SSN / bank_account / bank_routing from operations employee list responses.
- **#46** Block admin from changing their own role (not just self-demote).

### Validation + Constraints (schema migrations)
- **#13** Switch `timesheets.assignment_id` FK to `ON DELETE RESTRICT`.
- **#14** Convert client soft-delete → `status = 'archived'`.
- **#22** Recompute `total = subtotal + tax_amount` on every invoice PUT.
- **#23** Idempotency-Key header for invoice generation.
- **#48** Postgres enum `activity_entity_type` migration.

### File / Storage
- **#18** Refresh invoice PDF signed URL on every GET (drop the cached column).
- **#20** Drop cached `pdf_url` / `storage_url` columns (always mint fresh on read).

### Money / Invoicing (Pass 4 — finance feature flag)
- **#24** Refuse invoice generation when any included timesheet's assignment is deleted.
- **#25** Server-side line-item sum validation (`SUM(amount) == subtotal`).
- **#26** Controller-side state-machine enforcement on invoice PATCH.
- **#29** Invalidate cached PDF on any invoice field change.
- **Currency rounding helper** for partial-hour × rate math.

### Onboarding / HR
- **#31** Change-request history JSONB column + migration.
- **#34** Surface `reopen` 403 in frontend toast.
- **#35** Add a comment confirming photo is intentionally optional (already shipped).

### Deletion / Soft-deletes
- **#38** Client soft-delete auto-archives assignments.

### Notifications / Email (new infra)
- **#40** `failed_notifications` table for retry queue.
- **#41** Notification dedup window (10-min UNIQUE).
- **#42** Mailer health check exposed via `/health/mailer`.
- **#44** Standardize mailer response shape `{ ok, error?, queued? }`.
- **#45** `p-retry` wrapping every `mailer.send` call.

### Password reset / Admin
- **#43** Invalidate prior unused temp password on a fresh reset.
- **#50** DB trigger ensuring portal_user.email == employee.email when linked.

## Why deferred?

Most of these need either:
1. A schema migration with a backfill (e.g., #2 invoice sequence — need to count existing invoices and seed the sequence at `MAX(invoice_number) + 1` per year, then atomically swap).
2. A new background-job system or queue (e.g., #40 / #45 mailer retry).
3. A controller + service rewrite with thorough regression testing (e.g., #22 / #25 / #26 invoice math).

Each of these is best landed as a focused PR with its own test plan, not bundled
into the current sweep.

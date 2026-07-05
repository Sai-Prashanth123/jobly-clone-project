import { supabaseAdmin } from '../config/supabase';
import { logActivity } from '../lib/activityLogger';
import { NotFoundError } from '../lib/errors';
import { mailerConfigured, sendAnnouncementEmail } from '../lib/mailer';
import type { CreateAnnouncementInput, UpdateAnnouncementInput, ListAnnouncementsQuery } from '../schemas/announcements.schema';

const SELECT = `
  id, display_id, title, body, type, is_pinned, target_roles,
  expires_at, deleted_at, created_at, updated_at,
  author:portal_users!author_id(id, name, email)
`.trim();

// Roles that manage announcements should always see the full historical list
// (they need it for management/auditing purposes). Everyone else (e.g.
// employees) only sees announcements posted since they joined.
const ROLES_EXEMPT_FROM_JOIN_DATE_SCOPING = new Set(['admin', 'hr']);

export async function listAnnouncements(
  query: ListAnnouncementsQuery,
  viewerRole: string,
  viewerCreatedAt?: string | null,
) {
  const now = new Date().toISOString();

  let q = supabaseAdmin
    .from('announcements')
    .select(SELECT, { count: 'exact' })
    .is('deleted_at', null)
    .or(`expires_at.is.null,expires_at.gt.${now}`);

  if (query.type) q = q.eq('type', query.type);

  // Filter by target_roles: show when array is empty (all roles) OR contains viewerRole
  // Supabase: use contains for the "has role in array" check
  // announcements with target_roles = {} are visible to everyone
  q = q.or(`target_roles.eq.{},target_roles.cs.{${viewerRole}}`);

  // Join-date scoping: non-admin/hr viewers only see announcements created
  // since their portal account was created, so a brand-new employee doesn't
  // see announcements posted long before they joined. If we can't resolve
  // the viewer's created_at for any reason, fail open (show everything)
  // rather than accidentally hiding announcements that should be visible.
  if (!ROLES_EXEMPT_FROM_JOIN_DATE_SCOPING.has(viewerRole) && viewerCreatedAt) {
    q = q.gte('created_at', viewerCreatedAt);
  }

  // Pinned first, then newest
  q = q.order('is_pinned', { ascending: false })
       .order('created_at', { ascending: false });

  const offset = (query.page - 1) * query.limit;
  q = q.range(offset, offset + query.limit - 1);

  const { data, error, count } = await q;
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0 };
}

export async function getAnnouncement(id: string): Promise<any> {
  const { data, error } = await supabaseAdmin
    .from('announcements')
    .select(SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  if (error || !data) throw new NotFoundError('Announcement not found');
  return data as any;
}

export async function createAnnouncement(input: CreateAnnouncementInput, authorId: string) {
  const { data, error } = await supabaseAdmin
    .from('announcements')
    .insert({
      title:        input.title,
      body:         input.body,
      type:         input.type,
      is_pinned:    input.isPinned,
      target_roles: input.targetRoles,
      expires_at:   input.expiresAt ?? null,
      author_id:    authorId,
    })
    .select(SELECT)
    .single();
  if (error || !data) throw error ?? new Error('Insert returned no data');
  const row = data as any;
  void logActivity(authorId, 'created', 'announcement', row.id, `Created announcement: ${row.title}`);

  // Fire-and-forget: email all targeted users
  void (async () => {
    try {
      if (!mailerConfigured) return;
      let q = supabaseAdmin.from('portal_users').select('email');
      if (input.targetRoles && input.targetRoles.length > 0) {
        q = (q as any).in('role', input.targetRoles);
      }
      const { data: recipients } = await q;
      const emails = ((recipients ?? []) as any[]).map((r: any) => r.email).filter(Boolean) as string[];
      if (emails.length === 0) return;
      for (let i = 0; i < emails.length; i += 50) {
        await sendAnnouncementEmail({
          to: emails.slice(i, i + 50),
          announcementTitle: row.title,
          announcementBody: row.body,
          announcementType: row.type,
          authorName: row.author?.name ?? 'HR Team',
        });
      }
    } catch (e) { console.error('[announcement email]', e); }
  })();

  return data;
}

export async function updateAnnouncement(id: string, input: UpdateAnnouncementInput, actorId: string) {
  const existing = await getAnnouncement(id);

  const patch: Record<string, unknown> = {};
  if (input.title       !== undefined) patch.title        = input.title;
  if (input.body        !== undefined) patch.body         = input.body;
  if (input.type        !== undefined) patch.type         = input.type;
  if (input.isPinned    !== undefined) patch.is_pinned    = input.isPinned;
  if (input.targetRoles !== undefined) patch.target_roles = input.targetRoles;
  if (input.expiresAt   !== undefined) patch.expires_at   = input.expiresAt ?? null;

  const { data, error } = await supabaseAdmin
    .from('announcements')
    .update(patch)
    .eq('id', id)
    .select(SELECT)
    .single();
  if (error || !data) throw error ?? new Error('Update returned no data');
  void logActivity(actorId, 'updated', 'announcement', id, `Updated announcement: ${existing.title}`);
  return data as any;
}

export async function getAnnouncementUnreadCount(
  userRole: string,
  lastViewedAt: string | null,
  viewerCreatedAt?: string | null,
): Promise<number> {
  const now = new Date().toISOString();
  let q = supabaseAdmin
    .from('announcements')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .or(`target_roles.eq.{},target_roles.cs.{${userRole}}`);
  if (lastViewedAt) q = q.gt('created_at', lastViewedAt);

  // Same join-date scoping as listAnnouncements, so the unread-count badge
  // matches what the list actually shows. Fail open on missing data.
  if (!ROLES_EXEMPT_FROM_JOIN_DATE_SCOPING.has(userRole) && viewerCreatedAt) {
    q = q.gte('created_at', viewerCreatedAt);
  }

  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

export async function markAnnouncementsSeen(portalUserId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('portal_users')
    .update({ announcements_last_viewed_at: new Date().toISOString() })
    .eq('id', portalUserId);
  if (error) throw error;
}

export async function deleteAnnouncement(id: string, actorId: string) {
  const existing = await getAnnouncement(id);
  const { error } = await supabaseAdmin
    .from('announcements')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
  void logActivity(actorId, 'deleted', 'announcement', id, `Deleted announcement: ${existing.title}`);
}

import { supabaseAdmin } from '../config/supabase';
import { logActivity } from '../lib/activityLogger';
import { NotFoundError } from '../lib/errors';
import type { CreateAnnouncementInput, UpdateAnnouncementInput, ListAnnouncementsQuery } from '../schemas/announcements.schema';

const SELECT = `
  id, display_id, title, body, type, is_pinned, target_roles,
  expires_at, deleted_at, created_at, updated_at,
  author:portal_users!author_id(id, name, email)
`.trim();

export async function listAnnouncements(query: ListAnnouncementsQuery, viewerRole: string) {
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

export async function deleteAnnouncement(id: string, actorId: string) {
  const existing = await getAnnouncement(id);
  const { error } = await supabaseAdmin
    .from('announcements')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
  void logActivity(actorId, 'deleted', 'announcement', id, `Deleted announcement: ${existing.title}`);
}

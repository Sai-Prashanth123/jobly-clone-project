import { supabaseAdmin } from '../config/supabase';
import { logActivity } from '../lib/activityLogger';
import { createNotification } from './notifications.service';
import { getPortalUserByEmployeeId } from './notifications.service';
import { NotFoundError, ForbiddenError, ConflictError } from '../lib/errors';
import type { CreateAssetInput, UpdateAssetInput, AssignAssetInput, ListAssetsQuery } from '../schemas/assets.schema';

const SELECT = `
  id, display_id, name, category, brand, model, serial_number, condition, status,
  purchase_date, purchase_price, warranty_expiry, notes,
  assigned_to, assigned_at, assigned_by, deleted_at, created_at, updated_at,
  employee:employees!assigned_to(id, first_name, last_name, display_id)
`.trim();

export async function listAssets(query: ListAssetsQuery) {
  let q = supabaseAdmin
    .from('assets')
    .select(SELECT, { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (query.status !== 'all')   q = q.eq('status', query.status);
  if (query.category !== 'all') q = q.eq('category', query.category);
  if (query.employeeId)         q = q.eq('assigned_to', query.employeeId);

  const offset = (query.page - 1) * query.limit;
  q = q.range(offset, offset + query.limit - 1);

  const { data, error, count } = await q;
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0 };
}

export async function getAsset(id: string): Promise<any> {
  const { data, error } = await supabaseAdmin
    .from('assets')
    .select(SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  if (error || !data) throw new NotFoundError('Asset not found');
  return data as any;
}

export async function getEmployeeAssets(employeeId: string) {
  const { data, error } = await supabaseAdmin
    .from('assets')
    .select(SELECT)
    .eq('assigned_to', employeeId)
    .eq('status', 'assigned')
    .is('deleted_at', null)
    .order('assigned_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createAsset(input: CreateAssetInput, actorId: string) {
  const { data, error } = await supabaseAdmin
    .from('assets')
    .insert({
      name:            input.name,
      category:        input.category,
      brand:           input.brand ?? null,
      model:           input.model ?? null,
      serial_number:   input.serialNumber ?? null,
      condition:       input.condition,
      status:          input.status,
      purchase_date:   input.purchaseDate ?? null,
      purchase_price:  input.purchasePrice ?? null,
      warranty_expiry: input.warrantyExpiry ?? null,
      notes:           input.notes ?? null,
    })
    .select(SELECT)
    .single();
  if (error || !data) throw error ?? new Error('Insert returned no data');
  const row = data as any;
  void logActivity(actorId, 'created', 'asset', row.id, `Created asset: ${row.name}`);
  return row;
}

export async function updateAsset(id: string, input: UpdateAssetInput, actorId: string) {
  const asset = await getAsset(id);

  const patch: Record<string, unknown> = {};
  if (input.name           !== undefined) patch.name            = input.name;
  if (input.category       !== undefined) patch.category        = input.category;
  if (input.brand          !== undefined) patch.brand           = input.brand ?? null;
  if (input.model          !== undefined) patch.model           = input.model ?? null;
  if (input.serialNumber   !== undefined) patch.serial_number   = input.serialNumber ?? null;
  if (input.condition      !== undefined) patch.condition       = input.condition;
  if (input.status         !== undefined) patch.status          = input.status;
  if (input.purchaseDate   !== undefined) patch.purchase_date   = input.purchaseDate ?? null;
  if (input.purchasePrice  !== undefined) patch.purchase_price  = input.purchasePrice ?? null;
  if (input.warrantyExpiry !== undefined) patch.warranty_expiry = input.warrantyExpiry ?? null;
  if (input.notes          !== undefined) patch.notes           = input.notes ?? null;

  const { data, error } = await supabaseAdmin
    .from('assets')
    .update(patch)
    .eq('id', id)
    .select(SELECT)
    .single();
  if (error || !data) throw error ?? new Error('Update returned no data');
  void logActivity(actorId, 'updated', 'asset', id, `Updated asset: ${asset.name}`);
  return data as any;
}

export async function assignAsset(id: string, input: AssignAssetInput, actorId: string) {
  const asset = await getAsset(id);
  if (asset.status === 'assigned') throw new ConflictError('Asset is already assigned to someone');
  if (asset.status === 'retired' || asset.status === 'lost') {
    throw new ForbiddenError(`Cannot assign a ${asset.status} asset`);
  }

  const { data, error } = await supabaseAdmin
    .from('assets')
    .update({
      assigned_to: input.employeeId,
      assigned_at: new Date().toISOString(),
      assigned_by: actorId,
      status:      'assigned',
    })
    .eq('id', id)
    .select(SELECT)
    .single();
  if (error || !data) throw error ?? new Error('Update returned no data');

  void logActivity(actorId, 'updated', 'asset', id, `Assigned asset ${asset.name} to employee ${input.employeeId}`);

  // Notify employee
  const empUserId = await getPortalUserByEmployeeId(input.employeeId);
  if (empUserId) {
    void createNotification(empUserId, 'Equipment Assigned', `${asset.name} has been assigned to you`, 'info', 'asset', id);
  }

  return data as any;
}

export async function unassignAsset(id: string, actorId: string) {
  const asset = await getAsset(id);
  if (asset.status !== 'assigned') throw new ForbiddenError('Asset is not currently assigned');

  const prevEmployee = asset.assigned_to;

  const { data, error } = await supabaseAdmin
    .from('assets')
    .update({
      assigned_to: null,
      assigned_at: null,
      assigned_by: null,
      status:      'available',
    })
    .eq('id', id)
    .select(SELECT)
    .single();
  if (error || !data) throw error ?? new Error('Update returned no data');

  void logActivity(actorId, 'updated', 'asset', id, `Unassigned asset ${asset.name}`);

  if (prevEmployee) {
    const empUserId = await getPortalUserByEmployeeId(prevEmployee);
    if (empUserId) {
      void createNotification(empUserId, 'Equipment Returned', `${asset.name} has been returned`, 'info', 'asset', id);
    }
  }

  return data as any;
}

export async function deleteAsset(id: string, actorId: string) {
  const asset = await getAsset(id);
  if (asset.status === 'assigned') throw new ForbiddenError('Cannot delete an assigned asset — unassign it first');

  const { error } = await supabaseAdmin
    .from('assets')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
  void logActivity(actorId, 'deleted', 'asset', id, `Deleted asset: ${asset.name}`);
}

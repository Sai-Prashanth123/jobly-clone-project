import { supabaseAdmin } from '../config/supabase';
import { NotFoundError } from '../lib/errors';
import { logActivity } from '../lib/activityLogger';
import type { CreateProductInput, UpdateProductInput, ListProductsQuery } from '../schemas/product.schema';

// Catalog of reusable services/items that can be dropped into the invoice
// builder (Wave's "products & services" list).

export async function listProducts(query: ListProductsQuery) {
  let q = supabaseAdmin.from('products').select('*', { count: 'exact' });
  if (query.active !== undefined) q = q.eq('active', query.active);
  const offset = (query.page - 1) * query.limit;
  q = q.order('name', { ascending: true }).range(offset, offset + query.limit - 1);
  const { data, error, count } = await q;
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0 };
}

export async function createProduct(input: CreateProductInput, actorId?: string) {
  const { data, error } = await supabaseAdmin
    .from('products')
    .insert({
      name: input.name,
      description: input.description ?? null,
      unit_price: input.unitPrice,
      unit: input.unit,
      active: input.active,
      created_by: actorId ?? null,
    })
    .select().single();
  if (error) throw error;
  logActivity(actorId ?? null, 'created', 'product', data.id, data.name);
  return data;
}

export async function updateProduct(id: string, input: UpdateProductInput, actorId?: string) {
  const { data: existing } = await supabaseAdmin.from('products').select('id').eq('id', id).maybeSingle();
  if (!existing) throw new NotFoundError('Product not found');
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.unitPrice !== undefined) patch.unit_price = input.unitPrice;
  if (input.unit !== undefined) patch.unit = input.unit;
  if (input.active !== undefined) patch.active = input.active;
  const { data, error } = await supabaseAdmin.from('products').update(patch).eq('id', id).select().single();
  if (error) throw error;
  logActivity(actorId ?? null, 'updated', 'product', id, data.name);
  return data;
}

export async function deleteProduct(id: string, actorId?: string) {
  const { data: existing } = await supabaseAdmin.from('products').select('id, name').eq('id', id).maybeSingle();
  if (!existing) throw new NotFoundError('Product not found');
  // Soft-archive instead of hard delete so historical invoice line items that
  // reference this product keep their link.
  const { error } = await supabaseAdmin.from('products').update({ active: false }).eq('id', id);
  if (error) throw error;
  logActivity(actorId ?? null, 'updated', 'product', id, existing.name, { event: 'archived' });
}

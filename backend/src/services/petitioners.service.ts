import { supabaseAdmin } from '../config/supabase';
import { NotFoundError } from '../lib/errors';
import { logActivity } from '../lib/activityLogger';
import type { CreatePetitionerInput, UpdatePetitionerInput } from '../schemas/petitioner.schema';

export async function listPetitioners() {
  const { data, error } = await supabaseAdmin
    .from('petitioners')
    .select('*')
    .is('deleted_at', null)
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getPetitioner(id: string) {
  const { data, error } = await supabaseAdmin
    .from('petitioners').select('*').eq('id', id).is('deleted_at', null).single();
  if (error || !data) throw new NotFoundError('Petitioner not found');
  return data;
}

export async function createPetitioner(input: CreatePetitionerInput, actorId?: string) {
  const { data, error } = await supabaseAdmin
    .from('petitioners')
    .insert({
      name: input.name,
      address_street: input.addressStreet,
      address_city: input.addressCity,
      address_state: input.addressState,
      address_zip: input.addressZip,
      address_country: input.addressCountry,
      ein_fein: input.einFein,
      created_by: actorId ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  logActivity(actorId ?? null, 'created', 'petitioner', data.id, data.name, {});
  return data;
}

export async function updatePetitioner(id: string, input: UpdatePetitionerInput, actorId?: string) {
  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.addressStreet !== undefined) updateData.address_street = input.addressStreet;
  if (input.addressCity !== undefined) updateData.address_city = input.addressCity;
  if (input.addressState !== undefined) updateData.address_state = input.addressState;
  if (input.addressZip !== undefined) updateData.address_zip = input.addressZip;
  if (input.addressCountry !== undefined) updateData.address_country = input.addressCountry;
  if (input.einFein !== undefined) updateData.ein_fein = input.einFein;

  const { data, error } = await supabaseAdmin
    .from('petitioners').update(updateData).eq('id', id).select().single();
  if (error || !data) throw new NotFoundError('Petitioner not found');
  logActivity(actorId ?? null, 'updated', 'petitioner', id, data.name, {});
  return data;
}

export async function deletePetitioner(id: string, actorId?: string) {
  const { data, error } = await supabaseAdmin
    .from('petitioners').update({ deleted_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error || !data) throw new NotFoundError('Petitioner not found');
  logActivity(actorId ?? null, 'deleted', 'petitioner', id, data.name, {});
}

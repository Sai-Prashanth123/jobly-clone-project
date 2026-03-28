import { supabaseAdmin } from '../config/supabase';
import { NotFoundError, ConflictError } from '../lib/errors';
import type { CreateClientInput, UpdateClientInput, ListClientsQuery } from '../schemas/client.schema';

export async function listClients(query: ListClientsQuery) {
  let q = supabaseAdmin.from('clients').select('*', { count: 'exact' }).is('deleted_at', null);

  if (query.status) q = q.eq('status', query.status);
  if (query.search) {
    q = q.or(`company_name.ilike.%${query.search}%,contact_name.ilike.%${query.search}%,contact_email.ilike.%${query.search}%`);
  }

  const offset = (query.page - 1) * query.limit;
  q = q.order('created_at', { ascending: false }).range(offset, offset + query.limit - 1);

  const { data, error, count } = await q;
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0 };
}

export async function getClient(id: string) {
  const { data, error } = await supabaseAdmin
    .from('clients')
    .select('*, documents(*)')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !data) throw new NotFoundError('Client not found');
  return data;
}

export async function createClient(input: CreateClientInput) {
  const { data: existing } = await supabaseAdmin
    .from('clients')
    .select('id')
    .eq('contact_email', input.contactEmail)
    .is('deleted_at', null)
    .maybeSingle();

  if (existing) throw new ConflictError('Client with this contact email already exists');

  const { address, ...rest } = input;
  const { data, error } = await supabaseAdmin
    .from('clients')
    .insert({
      company_name: rest.companyName,
      contact_name: rest.contactName,
      contact_email: rest.contactEmail,
      contact_phone: rest.contactPhone ?? null,
      industry: rest.industry,
      address_street: address?.street ?? '',
      address_city: address?.city ?? '',
      address_state: address?.state ?? '',
      address_zip: address?.zip ?? '',
      address_country: address?.country ?? 'US',
      contract_start_date: rest.contractStartDate,
      contract_end_date: rest.contractEndDate ?? null,
      net_payment_days: rest.netPaymentDays,
      default_bill_rate: rest.defaultBillRate,
      currency: rest.currency,
      billing_type: rest.billingType ?? null,
      billing_contact_name: rest.billingContactName ?? null,
      billing_contact_email: rest.billingContactEmail ?? null,
      billing_contact_phone: rest.billingContactPhone ?? null,
      billing_street: rest.billingStreet ?? null,
      billing_city: rest.billingCity ?? null,
      billing_state: rest.billingState ?? null,
      billing_zip: rest.billingZip ?? null,
      billing_country: rest.billingCountry ?? null,
      tax_id: rest.taxId ?? null,
      status: rest.status,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateClient(id: string, input: UpdateClientInput) {
  const existing = await getClient(id);
  if (!existing) throw new NotFoundError('Client not found');

  const updateData: Record<string, unknown> = {};
  if (input.companyName !== undefined) updateData.company_name = input.companyName;
  if (input.contactName !== undefined) updateData.contact_name = input.contactName;
  if (input.contactEmail !== undefined) updateData.contact_email = input.contactEmail;
  if (input.contactPhone !== undefined) updateData.contact_phone = input.contactPhone;
  if (input.industry !== undefined) updateData.industry = input.industry;
  if (input.contractStartDate !== undefined) updateData.contract_start_date = input.contractStartDate;
  if (input.contractEndDate !== undefined) updateData.contract_end_date = input.contractEndDate;
  if (input.netPaymentDays !== undefined) updateData.net_payment_days = input.netPaymentDays;
  if (input.defaultBillRate !== undefined) updateData.default_bill_rate = input.defaultBillRate;
  if (input.currency !== undefined) updateData.currency = input.currency;
  if (input.billingType !== undefined) updateData.billing_type = input.billingType;
  if (input.billingContactName !== undefined) updateData.billing_contact_name = input.billingContactName;
  if (input.billingContactEmail !== undefined) updateData.billing_contact_email = input.billingContactEmail;
  if (input.billingContactPhone !== undefined) updateData.billing_contact_phone = input.billingContactPhone;
  if (input.billingStreet !== undefined) updateData.billing_street = input.billingStreet;
  if (input.billingCity !== undefined) updateData.billing_city = input.billingCity;
  if (input.billingState !== undefined) updateData.billing_state = input.billingState;
  if (input.billingZip !== undefined) updateData.billing_zip = input.billingZip;
  if (input.billingCountry !== undefined) updateData.billing_country = input.billingCountry;
  if (input.taxId !== undefined) updateData.tax_id = input.taxId;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.address) {
    updateData.address_street = input.address.street ?? '';
    updateData.address_city = input.address.city ?? '';
    updateData.address_state = input.address.state ?? '';
    updateData.address_zip = input.address.zip ?? '';
    updateData.address_country = input.address.country ?? 'US';
  }

  const { data, error } = await supabaseAdmin
    .from('clients')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteClient(id: string) {
  const existing = await getClient(id);
  if (!existing) throw new NotFoundError('Client not found');

  const { error } = await supabaseAdmin
    .from('clients')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

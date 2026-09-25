'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentAdmin } from './auth';
import { revalidatePath } from 'next/cache';
import { emitWa } from '@/lib/notifications';

export async function createCustomer(formData: {
  first_name: string;
  last_name?: string;
  phone: string;
  gender?: string;
  dob?: string;
}) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized' };

  if (!formData.first_name || !formData.phone) {
    return { error: 'First name and phone are required.' };
  }

  const { data, error } = await supabase
    .from('customers')
    .insert({
      first_name: formData.first_name.trim(),
      last_name: formData.last_name?.trim() || null,
      phone: formData.phone.trim(),
      gender: formData.gender || null,
      dob: formData.dob || null,
      status: 'Not Submitted',
      current_credit: 0,
    })
    .select('id')
    .single();

  if (error) return { error: error.message };

  await supabase.from('admin_audit_logs').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: 'customer',
    entity_id: data.id,
    action_type: 'CREATE_CUSTOMER',
    field_name: 'all',
  });

  revalidatePath('/admin/customers');
  return { success: true, customerId: data.id };
}

export async function updateCustomer(
  id: string,
  formData: {
    first_name: string;
    last_name?: string;
    phone: string;
    gender?: string;
    dob?: string;
    status: string;
    current_credit?: number;
  }
) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized' };

  const isSuperAdmin = admin.role?.toLowerCase().replace(/[\s_-]+/g, '') === 'superadmin';
  const { data: existingCustomer } = await supabase
    .from('customers')
    .select('current_credit')
    .eq('id', id)
    .single();

  let creditToSave = existingCustomer?.current_credit ?? 0;
  if (formData.current_credit !== undefined && formData.current_credit !== existingCustomer?.current_credit) {
    if (!isSuperAdmin) {
      return { error: 'Unauthorized: Only Superadmins can manually adjust store credit.' };
    }
    creditToSave = formData.current_credit;
    await supabase.from('credit_logs').insert({
      customer_id: id,
      movement: formData.current_credit > (existingCustomer?.current_credit ?? 0) ? 'credit_in' : 'credit_applied',
      ref: 'Manual Admin Adjustment',
      method: 'Admin Dashboard',
      amount: Math.abs(formData.current_credit - (existingCustomer?.current_credit ?? 0)),
    });
  }

  const { error } = await supabase
    .from('customers')
    .update({
      first_name: formData.first_name.trim(),
      last_name: formData.last_name?.trim() || null,
      phone: formData.phone.trim(),
      gender: formData.gender || null,
      dob: formData.dob || null,
      status: formData.status,
      current_credit: creditToSave,
    })
    .eq('id', id);

  if (error) return { error: error.message };

  await supabase.from('admin_audit_logs').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: 'customer',
    entity_id: id,
    action_type: 'UPDATE_CUSTOMER',
    field_name: 'profile',
  });

  revalidatePath('/admin/customers');
  revalidatePath(`/admin/customers/${id}`);
  return { success: true };
}

export async function deleteCustomer(id: string) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized' };

  const { error } = await supabase.from('customers').delete().eq('id', id);
  if (error) return { error: error.message };

  await supabase.from('admin_audit_logs').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: 'customer',
    entity_id: id,
    action_type: 'DELETE_CUSTOMER',
    field_name: 'all',
  });

  revalidatePath('/admin/customers');
  return { success: true };
}

export async function saveAddress(
  customerId: string,
  addressData: {
    id?: number;
    label?: string;
    street_address: string;
    city: string;
    postal_code: string;
    latitude?: number | null;
    longitude?: number | null;
    is_default?: boolean;
  }
) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized' };

  if (!addressData.street_address || !addressData.city) {
    return { error: 'Street address and city are required.' };
  }

  if (addressData.is_default) {
    await supabase
      .from('addresses')
      .update({ is_default: false })
      .eq('customer_id', customerId);
  }

  const payload = {
    customer_id: customerId,
    label: addressData.label || 'Home',
    street_address: addressData.street_address,
    city: addressData.city,
    postal_code: addressData.postal_code,
    latitude: addressData.latitude ?? null,
    longitude: addressData.longitude ?? null,
    is_default: addressData.is_default ?? false,
  };

  if (addressData.id) {
    const { error } = await supabase
      .from('addresses')
      .update(payload)
      .eq('id', addressData.id);
    if (error) return { error: error.message };
  } else {
    const { count } = await supabase
      .from('addresses')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', customerId);

    if (count === 0) {
      payload.is_default = true;
    }

    const { error } = await supabase.from('addresses').insert(payload);
    if (error) return { error: error.message };
  }

  revalidatePath(`/admin/customers/${customerId}`);
  return { success: true };
}

export async function deleteAddress(addressId: number, customerId: string) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized' };

  const { error } = await supabase.from('addresses').delete().eq('id', addressId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/customers/${customerId}`);
  return { success: true };
}

export async function setDefaultAddress(addressId: number, customerId: string) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized' };

  await supabase
    .from('addresses')
    .update({ is_default: false })
    .eq('customer_id', customerId);

  const { error } = await supabase
    .from('addresses')
    .update({ is_default: true })
    .eq('id', addressId);

  if (error) return { error: error.message };

  revalidatePath(`/admin/customers/${customerId}`);
  return { success: true };
}

export async function reviewKtp(
  customerId: string,
  status: 'Verified' | 'Not Submitted' | 'KTP Pending',
  notes: string
) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized' };

  // Rejection requires a reason — it flows into the WhatsApp message.
  if (status === 'Not Submitted' && !notes.trim()) {
    return { error: 'A rejection reason is required.' };
  }

  const { error } = await supabase
    .from('customers')
    .update({ status })
    .eq('id', customerId);

  if (error) return { error: error.message };

  await supabase.from('ktp_logs').insert({
    customer_id: customerId,
    status,
    description: notes || `Status updated to ${status} by ${admin.name}`,
  });

  await supabase.from('admin_audit_logs').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: 'customer',
    entity_id: customerId,
    action_type: 'KTP_REVIEW',
    field_name: 'status',
    new_value: status,
  });

  // --- WhatsApp notification via Fonnte ------------------------------------
  // Approved  → ktp_approved
  // Rejected  → ktp_rejected with the reason the admin typed
  const { data: customer } = await supabase
    .from('customers')
    .select('first_name, last_name, phone')
    .eq('id', customerId)
    .single();

  if (customer?.phone) {
    const customerName =
      `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'there';

    let kind: string | null = null;
    let fallbackTemplate = '';
    const vars: Record<string, string> = { CUSTOMER_NAME: customerName };

    if (status === 'Verified') {
      kind = 'ktp_approved';
      fallbackTemplate =
        'Hi [CUSTOMER_NAME], your ID verification has been approved! Your order is now confirmed for dispatch.';
    } else if (status === 'Not Submitted') {
      kind = 'ktp_rejected';
      fallbackTemplate =
        'Hi [CUSTOMER_NAME], we could not verify your ID: [REJECTION_REASON]. Please upload a clearer photo on your KORA account.';
      vars.REJECTION_REASON = notes.trim();
    }

    if (kind) {
      try {
        await emitWa(supabase, admin, {
          entity: 'customer',
          entityId: customerId,
          kind,
          to: customer.phone,
          vars,
          fallbackTemplate,
        });
      } catch {
        // Non-blocking — the status change has already committed.
      }
    }
  }

  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath('/admin/customers');
  return { success: true };
}

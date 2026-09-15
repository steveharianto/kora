'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentAdmin } from './auth';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';

function isSuperAdmin(role?: string): boolean {
  return role?.toLowerCase().replace(/[\s_-]+/g, '') === 'superadmin';
}

// Generic updater for app_settings JSONB records
export async function saveAppSetting(key: string, value: any) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized: Session not found.' };

  if (!isSuperAdmin(admin.role)) {
    return { error: 'Unauthorized: Only Superadmins can change system settings.' };
  }

  const { error } = await supabase
    .from('app_settings')
    .upsert({
      key,
      value,
      updated_at: new Date().toISOString(),
      updated_by: admin.id,
    });

  if (error) return { error: error.message };

  await supabase.from('admin_audit_logs').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: 'setting',
    entity_id: key,
    action_type: 'UPDATE_SETTING',
    field_name: key,
    details: value,
  });

  revalidatePath('/admin/settings');
  return { success: true };
}

// Deposit Tiers Updater
export async function saveDepositTiers(
  tiers: { id?: number; price_up_to: number; deposit_value: number }[]
) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin || !isSuperAdmin(admin.role)) {
    return { error: 'Unauthorized: Only Superadmins can update deposit tiers.' };
  }

  for (const tier of tiers) {
    if (tier.id) {
      await supabase
        .from('deposit_tiers')
        .update({
          price_up_to: tier.price_up_to,
          deposit_value: tier.deposit_value,
        })
        .eq('id', tier.id);
    } else {
      await supabase.from('deposit_tiers').insert({
        price_up_to: tier.price_up_to,
        deposit_value: tier.deposit_value,
      });
    }
  }

  revalidatePath('/admin/settings');
  revalidatePath('/admin/inventory');
  return { success: true };
}

// Create new Admin / Staff user
export async function createAdminUser(formData: {
  name: string;
  email: string;
  password: string;
  role: string;
}) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin || !isSuperAdmin(admin.role)) {
    return { error: 'Unauthorized: Only Superadmins can create system users.' };
  }

  if (!formData.name || !formData.email || !formData.password) {
    return { error: 'Name, email, and password are required.' };
  }

  const hashedPassword = await bcrypt.hash(formData.password, 10);

  const { data, error } = await supabase
    .from('admins')
    .insert({
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      password: hashedPassword,
      role: formData.role || 'staff',
      is_active: true,
    })
    .select('id')
    .single();

  if (error) return { error: error.message };

  await supabase.from('admin_audit_logs').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: 'admin',
    entity_id: data.id,
    action_type: 'CREATE_ADMIN',
    field_name: 'all',
  });

  revalidatePath('/admin/settings');
  return { success: true };
}

// Update Admin Role
export async function updateAdminRole(adminId: string, role: string) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin || !isSuperAdmin(admin.role)) {
    return { error: 'Unauthorized: Only Superadmins can change user roles.' };
  }

  if (admin.id === adminId && role !== 'superadmin') {
    return { error: 'You cannot demote your own account from Super Admin.' };
  }

  const { error } = await supabase
    .from('admins')
    .update({ role })
    .eq('id', adminId);

  if (error) return { error: error.message };

  await supabase.from('admin_audit_logs').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: 'admin',
    entity_id: adminId,
    action_type: 'UPDATE_ROLE',
    field_name: 'role',
    new_value: role,
  });

  revalidatePath('/admin/settings');
  return { success: true };
}

// Toggle Admin Active Status
export async function toggleAdminStatus(adminId: string, currentStatus: boolean) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin || !isSuperAdmin(admin.role)) {
    return { error: 'Unauthorized: Only Superadmins can deactivate users.' };
  }

  if (admin.id === adminId) {
    return { error: 'You cannot deactivate your own account.' };
  }

  const { error } = await supabase
    .from('admins')
    .update({ is_active: !currentStatus })
    .eq('id', adminId);

  if (error) return { error: error.message };

  revalidatePath('/admin/settings');
  return { success: true };
}

// Delete Admin User
export async function deleteAdminUser(adminId: string) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin || !isSuperAdmin(admin.role)) {
    return { error: 'Unauthorized: Only Superadmins can delete users.' };
  }

  if (admin.id === adminId) {
    return { error: 'You cannot delete your own account.' };
  }

  const { error } = await supabase.from('admins').delete().eq('id', adminId);
  if (error) return { error: error.message };

  await supabase.from('admin_audit_logs').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: 'admin',
    entity_id: adminId,
    action_type: 'DELETE_ADMIN',
    field_name: 'all',
  });

  revalidatePath('/admin/settings');
  return { success: true };
}

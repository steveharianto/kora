'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentAdmin } from './auth';
import { revalidatePath } from 'next/cache';

function checkSuperAdmin(role?: string): boolean {
  return role?.toLowerCase().replace(/[\s_-]+/g, '') === 'superadmin';
}

// Retrieves configured permissions from app_settings with clean fallbacks
async function getSystemPermissions(supabase: any) {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'permissions')
    .single();

  return data?.value || {
    reset_order_draft: 'superadmin_only',
    refund_store_credit: 'superadmin_only',
    archive_inventory_item: 'staff_and_superadmin',
    delete_inventory_item: 'superadmin_only',
    staff_edits_product_info: 'require_approval',
  };
}

export async function saveItem(itemData: any, isNew: boolean) {
  if (!itemData?.sku) return { error: 'SKU is required.' };

  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized: Session not found.' };

  const isSuperAdmin = checkSuperAdmin(admin.role);
  const permissions = await getSystemPermissions(supabase);

  // Direct save allowed for superadmins OR if staff direct save is enabled in settings
  const canDirectSave = isSuperAdmin || permissions.staff_edits_product_info === 'direct_save';

  const coreData = {
    sku: itemData.sku,
    brand_id: itemData.brand_id ? parseInt(itemData.brand_id) : null,
    category_id: itemData.category_id ? parseInt(itemData.category_id) : null,
    type_id: itemData.type_id ? parseInt(itemData.type_id) : null,
    name: itemData.name,
    size: itemData.size,
    color: itemData.color,
    tags: itemData.tags || [],
    rental_price: itemData.rental_price ? parseFloat(itemData.rental_price) : null,
    buffer_override: itemData.buffer_override !== '' && itemData.buffer_override !== null && itemData.buffer_override !== undefined
      ? parseInt(itemData.buffer_override)
      : null,
    status: itemData.status,
    website_status: itemData.website_status,
    description: itemData.description,
    date_added: itemData.date_added,
    measurements: itemData.measurements,
  };

  if (canDirectSave) {
    // DIRECT EXECUTION: Superadmin or staff with direct permission
    const dbPayload = {
      ...coreData,
      pending_changes: null,
      pending_action: null,
      pending_by: null
    };

    if (isNew) {
      const { error } = await supabase.from('items').insert(dbPayload);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase.from('items').update(dbPayload).eq('sku', itemData.sku);
      if (error) return { error: error.message };
    }
  } else {
    // STAGED APPROVAL: Required for staff when require_approval is set
    if (isNew) {
      const dbPayload = {
        sku: itemData.sku,
        name: itemData.name || 'Draft Name',
        rental_price: itemData.rental_price ? parseFloat(itemData.rental_price) : 0,
        website_status: 'Draft',
        status: 'Unavailable',
        pending_changes: coreData,
        pending_action: 'CREATE',
        pending_by: admin.id
      };
      const { error } = await supabase.from('items').insert(dbPayload);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase.from('items').update({
        pending_changes: coreData,
        pending_action: 'EDIT',
        pending_by: admin.id
      }).eq('sku', itemData.sku);
      if (error) return { error: error.message };
    }
  }

  await supabase.from('admin_audit_logs').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: 'item',
    entity_id: itemData.sku,
    action_type: canDirectSave
      ? (isNew ? 'CREATE' : 'DIRECT_EDIT')
      : (isNew ? 'REQUEST_CREATE' : 'REQUEST_EDIT'),
    field_name: 'all',
  });

  revalidatePath('/admin/inventory');
  revalidatePath(`/admin/inventory/${itemData.sku}`);
  return { success: true };
}

export async function approvePendingChanges(sku: string) {
  if (!sku) return { error: 'SKU is required.' };

  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin || !checkSuperAdmin(admin.role)) {
    return { error: 'Unauthorized: Only superadmins can approve actions.' };
  }

  const { data: item, error: fetchError } = await supabase
    .from('items')
    .select('pending_changes, pending_action')
    .eq('sku', sku)
    .single();

  if (fetchError || !item) return { error: fetchError?.message || `Item ${sku} not found.` };
  if (!item.pending_action) return { error: 'No pending changes to approve.' };

  let dbError = null;

  if (item.pending_action === 'DELETE') {
    const { error } = await supabase.from('items').delete().eq('sku', sku);
    dbError = error;
  } else if (item.pending_action === 'ARCHIVE') {
    const { error } = await supabase.from('items').update({
      is_archived: true,
      pending_action: null,
      pending_changes: null,
      pending_by: null
    }).eq('sku', sku);
    dbError = error;
  } else if (item.pending_action === 'UNARCHIVE') {
    const { error } = await supabase.from('items').update({
      is_archived: false,
      pending_action: null,
      pending_changes: null,
      pending_by: null
    }).eq('sku', sku);
    dbError = error;
  } else {
    // CREATE or EDIT
    const changes = item.pending_changes || {};
    const { error } = await supabase.from('items').update({
      ...changes,
      pending_changes: null,
      pending_action: null,
      pending_by: null
    }).eq('sku', sku);
    dbError = error;
  }

  if (dbError) return { error: dbError.message };

  await supabase.from('admin_audit_logs').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: 'item',
    entity_id: sku,
    action_type: `APPROVE_${item.pending_action}`,
    field_name: 'all',
  });

  revalidatePath('/admin/inventory');
  revalidatePath(`/admin/inventory/${sku}`);
  return { success: true };
}

export async function rejectPendingAction(sku: string) {
  if (!sku) return { error: 'SKU is required.' };

  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin || !checkSuperAdmin(admin.role)) {
    return { error: 'Unauthorized: Only superadmins can reject actions.' };
  }

  const { data: item, error: fetchError } = await supabase
    .from('items')
    .select('pending_action')
    .eq('sku', sku)
    .single();

  if (fetchError || !item) return { error: fetchError?.message || `Item ${sku} not found.` };
  if (!item.pending_action) return { error: 'No pending action to reject.' };

  let dbError = null;

  if (item.pending_action === 'CREATE') {
    const { error } = await supabase.from('items').delete().eq('sku', sku);
    dbError = error;
  } else {
    const { error } = await supabase.from('items').update({
      pending_changes: null,
      pending_action: null,
      pending_by: null
    }).eq('sku', sku);
    dbError = error;
  }

  if (dbError) return { error: dbError.message };

  await supabase.from('admin_audit_logs').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: 'item',
    entity_id: sku,
    action_type: `REJECT_${item.pending_action}`,
    field_name: 'all',
  });

  revalidatePath('/admin/inventory');
  revalidatePath(`/admin/inventory/${sku}`);
  return { success: true };
}

export async function toggleArchive(sku: string, currentStatus: boolean) {
  if (!sku) return { error: 'SKU is required.' };

  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized: Session not found.' };

  const isSuperAdmin = checkSuperAdmin(admin.role);
  const permissions = await getSystemPermissions(supabase);
  const actionType = currentStatus ? 'UNARCHIVE' : 'ARCHIVE';

  // Check if staff can archive directly based on settings
  const canDirectArchive = isSuperAdmin || permissions.archive_inventory_item === 'staff_and_superadmin';

  let dbError = null;

  if (canDirectArchive) {
    const { error } = await supabase.from('items').update({ is_archived: !currentStatus }).eq('sku', sku);
    dbError = error;
  } else {
    const { error } = await supabase.from('items').update({
      pending_action: actionType,
      pending_by: admin.id
    }).eq('sku', sku);
    dbError = error;
  }

  if (dbError) return { error: dbError.message };

  await supabase.from('admin_audit_logs').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: 'item',
    entity_id: sku,
    action_type: canDirectArchive ? actionType : `REQUEST_${actionType}`,
    field_name: 'is_archived',
  });

  revalidatePath('/admin/inventory');
  revalidatePath(`/admin/inventory/${sku}`);
  return { success: true };
}

export async function deleteItem(sku: string) {
  if (!sku) return { error: 'SKU is required.' };

  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized: Session not found.' };

  const isSuperAdmin = checkSuperAdmin(admin.role);
  const permissions = await getSystemPermissions(supabase);

  // Check if staff can delete directly based on settings
  const canDirectDelete = isSuperAdmin || permissions.delete_inventory_item === 'staff_and_superadmin';

  if (canDirectDelete) {
    const { error } = await supabase.from('items').delete().eq('sku', sku);
    if (error) return { error: 'Cannot delete item. It may have existing order history.' };
  } else {
    const { error } = await supabase.from('items').update({
      pending_action: 'DELETE',
      pending_by: admin.id
    }).eq('sku', sku);
    if (error) return { error: error.message };
  }

  await supabase.from('admin_audit_logs').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: 'item',
    entity_id: sku,
    action_type: canDirectDelete ? 'DELETE_ITEM' : 'REQUEST_DELETE',
    field_name: 'all',
  });

  revalidatePath('/admin/inventory');
  return { success: true };
}

export async function saveNotes(sku: string, notes: string) {
  if (!sku) return { error: 'SKU is required.' };

  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized: Session not found.' };

  const { error } = await supabase.from('items').update({ notes }).eq('sku', sku);
  if (error) return { error: error.message };

  revalidatePath(`/admin/inventory/${sku}`);
  return { success: true };
}

export async function addImageRecord(sku: string, url: string, order: number) {
  if (!sku || !url) return { error: 'SKU and URL are required.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('item_images')
    .insert({ item_sku: sku, image_url: url, display_order: order })
    .select()
    .single();

  revalidatePath(`/admin/inventory/${sku}`);
  if (error) return { error: error.message };
  return { data };
}

export async function deleteImageRecord(imageId: number, sku: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('item_images').delete().eq('id', imageId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/inventory/${sku}`);
  return { success: true };
}

export async function reorderImages(images: { id: number; display_order: number }[], sku: string) {
  const supabase = await createClient();
  for (const img of images) {
    const { error } = await supabase
      .from('item_images')
      .update({ display_order: img.display_order })
      .eq('id', img.id);
    if (error) return { error: error.message };
  }
  revalidatePath(`/admin/inventory/${sku}`);
  return { success: true };
}

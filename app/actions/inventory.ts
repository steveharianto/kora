'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentAdmin } from './auth';
import { revalidatePath } from 'next/cache';

export async function saveItem(itemData: any, isNew: boolean) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized' };

  const isSuperAdmin = admin.role === 'superadmin';

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
    buffer_override: itemData.buffer_override ? parseInt(itemData.buffer_override) : null,
    status: itemData.status,
    website_status: itemData.website_status,
    description: itemData.description,
    date_added: itemData.date_added,
    measurements: itemData.measurements,
  };

  if (isSuperAdmin) {
    // SUPERADMIN: Direct Execution
    const dbPayload = { ...coreData, pending_changes: null, pending_action: null, pending_by: null };

    if (isNew) {
      const { error } = await supabase.from('items').insert(dbPayload);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase.from('items').update(dbPayload).eq('sku', itemData.sku);
      if (error) return { error: error.message };
    }
  } else {
    // STAFF: Route to Pending
    if (isNew) {
      // Must insert row with required NOT NULL fields so images can attach, but staged as Draft
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
    action_type: isSuperAdmin ? (isNew ? 'CREATE' : 'DIRECT_EDIT') : (isNew ? 'REQUEST_CREATE' : 'REQUEST_EDIT'),
    field_name: 'all',
  });

  revalidatePath('/admin/inventory');
  revalidatePath(`/admin/inventory/${itemData.sku}`);
  return { success: true };
}

export async function approvePendingChanges(sku: string) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin || admin.role !== 'superadmin') return { error: 'Unauthorized' };

  const { data: item } = await supabase.from('items').select('pending_changes, pending_action').eq('sku', sku).single();
  if (!item?.pending_action) return { error: 'No changes to approve.' };

  if (item.pending_action === 'DELETE') {
    await supabase.from('items').delete().eq('sku', sku);
  } else if (item.pending_action === 'ARCHIVE') {
    await supabase.from('items').update({ is_archived: true, pending_action: null, pending_changes: null, pending_by: null }).eq('sku', sku);
  } else if (item.pending_action === 'UNARCHIVE') {
    await supabase.from('items').update({ is_archived: false, pending_action: null, pending_changes: null, pending_by: null }).eq('sku', sku);
  } else {
    // CREATE or EDIT
    await supabase.from('items').update({ ...item.pending_changes, pending_changes: null, pending_action: null, pending_by: null }).eq('sku', sku);
  }

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
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin || admin.role !== 'superadmin') return { error: 'Unauthorized' };

  const { data: item } = await supabase.from('items').select('pending_action').eq('sku', sku).single();

  if (item?.pending_action === 'CREATE') {
    await supabase.from('items').delete().eq('sku', sku); // Delete the draft shell entirely
  } else {
    await supabase.from('items').update({ pending_changes: null, pending_action: null, pending_by: null }).eq('sku', sku);
  }

  await supabase.from('admin_audit_logs').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: 'item',
    entity_id: sku,
    action_type: `REJECT_${item?.pending_action || 'REQUEST'}`,
    field_name: 'all',
  });

  revalidatePath('/admin/inventory');
  revalidatePath(`/admin/inventory/${sku}`);
  return { success: true };
}

export async function toggleArchive(sku: string, currentStatus: boolean) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized' };

  const isSuperAdmin = admin.role === 'superadmin';
  const actionType = currentStatus ? 'UNARCHIVE' : 'ARCHIVE';

  if (isSuperAdmin) {
    await supabase.from('items').update({ is_archived: !currentStatus }).eq('sku', sku);
  } else {
    await supabase.from('items').update({ pending_action: actionType, pending_by: admin.id }).eq('sku', sku);
  }

  await supabase.from('admin_audit_logs').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: 'item',
    entity_id: sku,
    action_type: isSuperAdmin ? actionType : `REQUEST_${actionType}`,
    field_name: 'is_archived',
  });

  revalidatePath('/admin/inventory');
  revalidatePath(`/admin/inventory/${sku}`);
  return { success: true };
}

export async function deleteItem(sku: string) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized' };

  const isSuperAdmin = admin.role === 'superadmin';

  if (isSuperAdmin) {
    const { error } = await supabase.from('items').delete().eq('sku', sku);
    if (error) return { error: 'Cannot delete item. It may have existing order history.' };
  } else {
    await supabase.from('items').update({ pending_action: 'DELETE', pending_by: admin.id }).eq('sku', sku);
  }

  await supabase.from('admin_audit_logs').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: 'item',
    entity_id: sku,
    action_type: isSuperAdmin ? 'DELETE_ITEM' : 'REQUEST_DELETE',
    field_name: 'all',
  });

  revalidatePath('/admin/inventory');
  return { success: true };
}

export async function saveNotes(sku: string, notes: string) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized' };

  await supabase.from('items').update({ notes }).eq('sku', sku);
  revalidatePath(`/admin/inventory/${sku}`);
  return { success: true };
}

export async function addImageRecord(sku: string, url: string, order: number) {
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
  await supabase.from('item_images').delete().eq('id', imageId);
  revalidatePath(`/admin/inventory/${sku}`);
}

export async function reorderImages(images: { id: number; display_order: number }[], sku: string) {
  const supabase = await createClient();
  for (const img of images) {
    await supabase.from('item_images').update({ display_order: img.display_order }).eq('id', img.id);
  }
  revalidatePath(`/admin/inventory/${sku}`);
}

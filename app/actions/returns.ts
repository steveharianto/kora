'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentAdmin } from './auth';
import { createBiteshipOrder } from '@/lib/biteship';
import { revalidatePath } from 'next/cache';

// -----------------------------------------------------------------------------
// 1. CREATE RETURN REQUEST (Manual fallback or called by website webhook)
// -----------------------------------------------------------------------------
export async function createReturnRequest(payload: {
  order_id: string;
  return_method: 'KORA arranges pickup (Biteship)' | 'Customer self-return';
  pickup_address_id?: number | string | null;
  pickup_recipient_name?: string;
  pickup_phone?: string;
  pickup_street_address?: string;
  pickup_city?: string;
  pickup_postal_code?: string;
  pickup_latitude?: number | null;
  pickup_longitude?: number | null;
}) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized: Session not found.' };

  // Guard against unique constraint violations
  const { data: existingReturn } = await supabase
    .from('returns')
    .select('id')
    .eq('order_id', payload.order_id)
    .maybeSingle();

  if (existingReturn) {
    return { error: `A return request (${existingReturn.id}) already exists for this order.` };
  }

  // Fetch the anchor order with customer and products
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select(`
      *,
      customers (
        id,
        first_name,
        last_name,
        phone,
        addresses (*)
      )
    `)
    .eq('id', payload.order_id)
    .single();

  if (orderErr || !order) return { error: 'Anchor order not found.' };

  const customerName = `${order.customers?.first_name || ''} ${order.customers?.last_name || ''}`.trim();
  const returnId = `RET-${order.id}`;

  // Resolve pickup address
  let address = {
    label: 'Home',
    recipient_name: payload.pickup_recipient_name || customerName,
    phone: payload.pickup_phone || order.customers?.phone || '',
    street_address: payload.pickup_street_address || order.street_address,
    city: payload.pickup_city || order.city,
    postal_code: payload.pickup_postal_code || order.postal_code,
    latitude: payload.pickup_latitude ?? order.latitude,
    longitude: payload.pickup_longitude ?? order.longitude,
  };

  if (payload.pickup_address_id) {
    const matchedAddr = order.customers?.addresses?.find(
      (a: any) => String(a.id) === String(payload.pickup_address_id)
    );
    if (matchedAddr) {
      address = {
        label: matchedAddr.label || 'Home',
        recipient_name: customerName,
        phone: order.customers?.phone || '',
        street_address: matchedAddr.street_address,
        city: matchedAddr.city,
        postal_code: matchedAddr.postal_code,
        latitude: matchedAddr.latitude,
        longitude: matchedAddr.longitude,
      };
    }
  }

  const depositHeld = Number(order.total_deposit) || 0;

  const { error: insertErr } = await supabase.from('returns').insert({
    id: returnId,
    order_id: order.id,
    customer_id: order.customer_id,
    status: 'Requested',
    return_method: payload.return_method,
    request_source: 'Manual',
    pickup_address_id: payload.pickup_address_id ? Number(payload.pickup_address_id) : null,
    pickup_label: address.label,
    pickup_recipient_name: address.recipient_name,
    pickup_phone: address.phone,
    pickup_street_address: address.street_address,
    pickup_city: address.city,
    pickup_postal_code: address.postal_code,
    pickup_latitude: address.latitude ?? null,
    pickup_longitude: address.longitude ?? null,
    deposit_held: depositHeld,
    refund_amount: depositHeld,
  });

  if (insertErr) return { error: insertErr.message };

  await supabase.from('admin_audit_logs').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: 'return',
    entity_id: returnId,
    action_type: 'CREATE_RETURN_REQUEST',
    field_name: 'status',
    new_value: 'Requested',
  });

  revalidatePath('/admin/returns');
  return { success: true, returnId };
}

// -----------------------------------------------------------------------------
// 2. DISPATCH RETURN VIA REVERSE BITESHIP
// -----------------------------------------------------------------------------
export async function dispatchReturnViaBiteship(returnId: string, courierChoice?: string) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized: Session not found.' };

  const { data: ret, error: retErr } = await supabase
    .from('returns')
    .select(`
      *,
      orders (
        id,
        order_products (
          item_sku,
          quantity,
          price,
          items (
            name
          )
        )
      )
    `)
    .eq('id', returnId)
    .single();

  if (retErr || !ret) return { error: 'Return record not found.' };

  if (!ret.pickup_street_address || !ret.pickup_city) {
    return { error: 'Customer return pickup address is incomplete.' };
  }

  // 1. Fetch Showroom Destination from app_settings
  const { data: shippingSettings } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'shipping')
    .single();

  const rawOrigin = shippingSettings?.value?.dispatch_addresses?.primary;
  const showroom = typeof rawOrigin === 'object' && rawOrigin !== null ? rawOrigin : {
    name: 'KORA Showroom Jakarta',
    phone: '081234567890',
    street_address: 'Jl. Gunawarman No. 30, Kebayoran Baru',
    city: 'Jakarta Selatan',
    postal_code: '12180',
    latitude: -6.2382700,
    longitude: 106.8105600,
  };

  // 2. Parse Courier choice
  const methodStr = (courierChoice || ret.courier_company || 'paxel - regular').toLowerCase();
  let courierCompany = 'paxel';
  let courierType = 'medium';

  if (methodStr.includes('gosend') || methodStr.includes('gojek')) {
    courierCompany = 'gojek';
    courierType = 'instant';
  } else if (methodStr.includes('grab')) {
    courierCompany = 'grab';
    courierType = 'instant';
  } else if (methodStr.includes('sicepat')) {
    courierCompany = 'sicepat';
    courierType = 'reg';
  } else if (methodStr.includes('jne')) {
    courierCompany = 'jne';
    courierType = 'reg';
  }

  // Guard: Coordinates check for instant couriers (safely supporting equator latitude 0.0)
  if (['gojek', 'grab'].includes(courierCompany)) {
    if (
      ret.pickup_latitude === null ||
      ret.pickup_latitude === undefined ||
      ret.pickup_longitude === null ||
      ret.pickup_longitude === undefined
    ) {
      return {
        error: 'Customer pickup coordinates (latitude & longitude) are required for instant courier dispatch. Please pin location first.',
      };
    }
  }

  // 3. Build Reverse Line Items
  const items = (ret.orders?.order_products || []).map((p: any) => ({
    name: `Return: ${p.items?.name || p.item_sku}`,
    value: 500000,
    quantity: p.quantity || 1,
    weight: 1000,
  }));

  // 4. Reverse Biteship Order (Origin = Customer, Destination = Showroom)
  const biteshipRes = await createBiteshipOrder({
    origin: {
      name: ret.pickup_recipient_name || 'Customer',
      phone: ret.pickup_phone || '081234567890',
      address: `${ret.pickup_street_address}, ${ret.pickup_city}`,
      postal_code: ret.pickup_postal_code ? String(ret.pickup_postal_code) : undefined,
      coordinate:
        ret.pickup_latitude !== null &&
        ret.pickup_latitude !== undefined &&
        ret.pickup_longitude !== null &&
        ret.pickup_longitude !== undefined
          ? {
              latitude: Number(ret.pickup_latitude),
              longitude: Number(ret.pickup_longitude),
            }
          : undefined,
    },
    destination: {
      name: showroom.name || 'KORA Showroom',
      phone: showroom.phone || '081234567890',
      address: `${showroom.street_address}, ${showroom.city}`,
      postal_code: String(showroom.postal_code || '12180'),
      coordinate: {
        latitude: Number(showroom.latitude),
        longitude: Number(showroom.longitude),
      },
    },
    courier_company: courierCompany,
    courier_type: courierType,
    delivery_type: 'now',
    reference_id: `RET-${ret.order_id}`,
    items,
    note: `KORA Return ${ret.order_id} - Studio Receiving`,
  });

  if (!biteshipRes.success) {
    return { error: biteshipRes.error || 'Failed to dispatch courier via Biteship.' };
  }

  const generatedResi = biteshipRes.waybill_id || biteshipRes.tracking_id || `RET-WYB-${Date.now()}`;

  // 5. Update Return Record
  const { error: upErr } = await supabase
    .from('returns')
    .update({
      status: 'Shipping',
      courier_company: courierCompany,
      courier_type: courierType,
      waybill_id: generatedResi,
      biteship_order_id: biteshipRes.id || null,
      tracking_url: biteshipRes.courier?.link || `https://biteship.com/id/tracking/${generatedResi}`,
      shipped_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', returnId);

  if (upErr) return { error: upErr.message };

  await supabase.from('admin_audit_logs').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: 'return',
    entity_id: returnId,
    action_type: 'BITESHIP_RETURN_DISPATCH',
    field_name: 'waybill_id',
    new_value: generatedResi,
    details: { courier: courierCompany, type: courierType },
  });

  revalidatePath('/admin/returns');
  revalidatePath(`/admin/returns/${returnId}`);
  return { success: true, waybill: generatedResi };
}

// -----------------------------------------------------------------------------
// 3. SAVE RETURN RESI (MANUAL OR CUSTOMER SELF-RETURN)
// -----------------------------------------------------------------------------
export async function saveReturnResi(returnId: string, courier: string, resi: string) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized: Session not found.' };

  if (!resi.trim()) return { error: 'Return Resi / Waybill number cannot be empty.' };

  const { error } = await supabase
    .from('returns')
    .update({
      courier_company: courier,
      waybill_id: resi.trim(),
      status: 'Shipping',
      shipped_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', returnId);

  if (error) return { error: error.message };

  await supabase.from('admin_audit_logs').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: 'return',
    entity_id: returnId,
    action_type: 'SAVE_RETURN_RESI',
    field_name: 'waybill_id',
    new_value: resi.trim(),
  });

  revalidatePath('/admin/returns');
  revalidatePath(`/admin/returns/${returnId}`);
  return { success: true };
}

// -----------------------------------------------------------------------------
// 4. MARK RETURN RECEIVED (UNLOCKS QC)
// -----------------------------------------------------------------------------
export async function markReturnReceived(returnId: string) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized: Session not found.' };

  const { error } = await supabase
    .from('returns')
    .update({
      status: 'Received',
      received_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', returnId);

  if (error) return { error: error.message };

  await supabase.from('admin_audit_logs').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: 'return',
    entity_id: returnId,
    action_type: 'RECEIVE_RETURN',
    field_name: 'status',
    new_value: 'Received',
  });

  revalidatePath('/admin/returns');
  revalidatePath(`/admin/returns/${returnId}`);
  return { success: true };
}

// -----------------------------------------------------------------------------
// 5. RELEASE DEPOSIT & COMPLETE RETURN (QC + MANUAL SETTLEMENT)
// -----------------------------------------------------------------------------
export async function releaseDepositAndCompleteReturn(
  returnId: string,
  payload: {
    has_stains: boolean;
    has_damage: boolean;
    is_incomplete: boolean;
    has_odor: boolean;
    qc_deduction: number;
    return_shipping_cost: number;
    refund_destination: string;
    deduction_reason?: string;
    qc_notes?: string;
  }
) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized: Session not found.' };

  if (!payload.refund_destination) {
    return { error: 'Refund destination account is required.' };
  }

  // 1. Fetch return with order and products
  const { data: ret, error: retErr } = await supabase
    .from('returns')
    .select(`
      *,
      orders (
        id,
        order_products (
          item_sku
        )
      )
    `)
    .eq('id', returnId)
    .single();

  if (retErr || !ret) return { error: 'Return record not found.' };

  if (ret.status === 'Completed' || ret.refund_status === 'Refunded') {
    return { error: 'Deposit has already been released for this return.' };
  }

  const depositHeld = Number(ret.deposit_held) || 0;
  const qcDeduction = Math.max(0, Number(payload.qc_deduction) || 0);
  const shippingCost = Math.max(0, Number(payload.return_shipping_cost) || 0);
  const netRefund = Math.max(0, depositHeld - qcDeduction - shippingCost);

  // 2. Update Return Record to Completed
  const { error: upErr } = await supabase
    .from('returns')
    .update({
      has_stains: payload.has_stains,
      has_damage: payload.has_damage,
      is_incomplete: payload.is_incomplete,
      has_odor: payload.has_odor,
      qc_deduction: qcDeduction,
      return_shipping_cost: shippingCost,
      refund_amount: netRefund,
      refund_destination: payload.refund_destination,
      deduction_reason: payload.deduction_reason || null,
      qc_notes: payload.qc_notes || null,
      refund_status: 'Refunded',
      refunded_at: new Date().toISOString(),
      refunded_by_admin_id: admin.id,
      status: 'Completed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', returnId);

  if (upErr) return { error: upErr.message };

  // 3. Mark the Order Completed
  await supabase.from('orders').update({ status: 'Completed' }).eq('id', ret.order_id);

  // 4. Update Inventory Items: If damaged -> 'Under Repair', else -> 'Available'
  const skus = (ret.orders?.order_products || []).map((p: any) => p.item_sku).filter(Boolean);
  if (skus.length > 0) {
    if (payload.has_damage) {
      await supabase.from('items').update({ status: 'Under Repair' }).in('sku', skus);
    } else {
      await supabase.from('items').update({ status: 'Available' }).in('sku', skus);
    }
  }

  // 5. Audit Log
  await supabase.from('admin_audit_logs').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: 'return',
    entity_id: returnId,
    action_type: 'RELEASE_DEPOSIT_AND_COMPLETE',
    field_name: 'refund_status',
    new_value: `Refunded ${netRefund} via ${payload.refund_destination}`,
    details: {
      deposit_held: depositHeld,
      qc_deduction: qcDeduction,
      shipping_cost: shippingCost,
      refund_amount: netRefund,
      damage: payload.has_damage,
    },
  });

  revalidatePath('/admin/returns');
  revalidatePath(`/admin/returns/${returnId}`);
  revalidatePath('/admin/orders');
  revalidatePath('/admin/inventory');

  return { success: true };
}

// -----------------------------------------------------------------------------
// 6. ADD RETURN INTERNAL NOTE
// -----------------------------------------------------------------------------
export async function addReturnNote(returnId: string, note: string) {
  if (!note.trim()) return { error: 'Note cannot be empty.' };

  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized: Session not found.' };

  const { error } = await supabase.from('admin_audit_logs').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: 'return',
    entity_id: returnId,
    action_type: 'RETURN_NOTE',
    field_name: 'notes',
    new_value: note.trim(),
  });

  if (error) return { error: error.message };

  revalidatePath(`/admin/returns/${returnId}`);
  return { success: true };
}

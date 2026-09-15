'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentAdmin } from './auth';
import { revalidatePath } from 'next/cache';

export async function getNextManualOrderId(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('orders')
    .select('id')
    .like('id', 'M%')
    .order('id', { ascending: false })
    .limit(1);

  if (!data || data.length === 0) return 'M0101';

  const lastId = data[0].id;
  const numPart = parseInt(lastId.replace(/\D/g, ''), 10);
  if (isNaN(numPart)) return 'M0101';

  return `M${String(numPart + 1).padStart(4, '0')}`;
}

export async function createOrderDraft(): Promise<{ orderId?: string; error?: string }> {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized: Session not found.' };

  const newId = await getNextManualOrderId();

  const { error } = await supabase.from('orders').insert({
    id: newId,
    order_date: new Date().toISOString().split('T')[0],
    order_method: 'Manual',
    status: 'Draft',
    event_days: 1,
    shipping_fee: 0,
    store_credit_applied: 0,
    total_price: 0,
    total_deposit: 0,
    total: 0,
    pick_up_method: 'Self pickup',
    payment_method: 'QRIS (EDC)',
  });

  if (error) return { error: error.message };

  await supabase.from('admin_audit_logs').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: 'order',
    entity_id: newId,
    action_type: 'CREATE_DRAFT',
    field_name: 'all',
  });

  revalidatePath('/admin/orders');
  return { orderId: newId };
}

// -----------------------------------------------------------------------------
// HELPER: Validate SKU Availability, Repairs, and Turnaround Overlap
// -----------------------------------------------------------------------------
async function checkInventoryAvailability(
  orderId: string,
  skus: string[],
  pickupDate: string,
  returnDate: string
): Promise<{ conflict?: string }> {
  if (skus.length === 0) return {};

  const supabase = await createClient();

  const { data: itemsData } = await supabase
    .from('items')
    .select(`
      sku,
      name,
      status,
      is_archived,
      buffer_override,
      types (
        default_buffer_days
      )
    `)
    .in('sku', skus);

  for (const item of itemsData || []) {
    if (item.is_archived) {
      return { conflict: `Item "${item.sku}" (${item.name}) is archived and cannot be booked.` };
    }
    if (item.status === 'Under Repair') {
      return { conflict: `Item "${item.sku}" (${item.name}) is currently Under Repair and unavailable for rental.` };
    }
  }

  if (!pickupDate || !returnDate) return {};

  const { data: conflictingOrders } = await supabase
    .from('order_products')
    .select(`
      item_sku,
      orders!inner (
        id,
        pickup_date,
        return_date,
        status
      )
    `)
    .in('item_sku', skus)
    .neq('orders.id', orderId)
    .not('orders.status', 'in', '("Cancelled", "Draft")');

  if (!conflictingOrders || conflictingOrders.length === 0) return {};

  const newPickup = new Date(pickupDate).getTime();
  const newReturn = new Date(returnDate).getTime();

  for (const conf of conflictingOrders) {
    const existingOrder = conf.orders as any;
    if (!existingOrder.pickup_date || !existingOrder.return_date) continue;

    const itemMeta = itemsData?.find((i) => i.sku === conf.item_sku);
    const bufferDays =
      itemMeta?.buffer_override ??
      (itemMeta?.types as any)?.default_buffer_days ??
      2;

    const existStart = new Date(existingOrder.pickup_date).getTime();
    const existEnd = new Date(existingOrder.return_date);
    existEnd.setDate(existEnd.getDate() + bufferDays);
    const existEndWithBuffer = existEnd.getTime();

    if (newPickup <= existEndWithBuffer && newReturn >= existStart) {
      return {
        conflict: `Item "${conf.item_sku}" (${itemMeta?.name || 'Garment'}) is already reserved by order ${existingOrder.id} from ${existingOrder.pickup_date} until ${existEnd.toISOString().split('T')[0]} (including turnaround buffer).`,
      };
    }
  }

  return {};
}

// -----------------------------------------------------------------------------
// HELPER: Cascade Eviction of Conflicting Fittings upon Order Checkout
// -----------------------------------------------------------------------------
async function evictConflictingFittings(
  orderId: string,
  skus: string[],
  pickupDate: string,
  returnDate: string
) {
  if (skus.length === 0 || !pickupDate || !returnDate) return;

  const supabase = await createClient();

  const { data: itemsData } = await supabase
    .from('items')
    .select('sku, buffer_override, types(default_buffer_days)')
    .in('sku', skus);

  let maxBuffer = 2;
  for (const it of itemsData || []) {
    const b = it.buffer_override ?? (it.types as any)?.default_buffer_days ?? 2;
    if (b > maxBuffer) maxBuffer = b;
  }

  const endWithBuffer = new Date(returnDate);
  endWithBuffer.setDate(endWithBuffer.getDate() + maxBuffer);
  const endWithBufferStr = endWithBuffer.toISOString().split('T')[0];

  const { data: collidingItems } = await supabase
    .from('fitting_items')
    .select(`
      id,
      fitting_id,
      item_sku,
      fittings!inner (
        id,
        date,
        status,
        customer_id
      )
    `)
    .in('item_sku', skus)
    .eq('is_evicted', false)
    .gte('fittings.date', pickupDate)
    .lte('fittings.date', endWithBufferStr)
    .not('fittings.status', 'in', '("Cancelled", "Conflict Evicted", "Completed")');

  if (!collidingItems || collidingItems.length === 0) return;

  const impactedFittingIds = new Set<string>();

  for (const ci of collidingItems) {
    await supabase
      .from('fitting_items')
      .update({
        is_evicted: true,
        evicted_by_order_id: orderId,
        eviction_reason: `Rented out in Order ${orderId} (${pickupDate} - ${returnDate})`,
      })
      .eq('id', ci.id);

    impactedFittingIds.add(ci.fitting_id);
  }

  for (const fitId of Array.from(impactedFittingIds)) {
    const { data: allFitItems } = await supabase
      .from('fitting_items')
      .select('id, is_evicted')
      .eq('fitting_id', fitId);

    const activeCount = (allFitItems || []).filter((i) => !i.is_evicted).length;

    if (activeCount === 0) {
      await supabase
        .from('fittings')
        .update({
          status: 'Conflict Evicted',
          conflict_notes: `All items were checked out in paid orders (last evicted by ${orderId}). Showroom slot freed.`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', fitId);

      // Automated system action: admin_id must be null to prevent UUID syntax error
      await supabase.from('admin_audit_logs').insert({
        admin_id: null,
        admin_name: 'Automation',
        entity_type: 'fitting',
        entity_id: fitId,
        action_type: 'CONFLICT_EVICTION',
        field_name: 'status',
        new_value: 'Conflict Evicted',
        details: { evicted_by_order: orderId },
      });
    }
  }

  revalidatePath('/admin/fittings');
}

// -----------------------------------------------------------------------------
// SAVE ORDER ACTION
// -----------------------------------------------------------------------------
export async function saveOrder(orderData: {
  id: string;
  customer_id?: string;
  order_date: string;
  event_start_date?: string | null;
  event_days: number;
  pickup_date?: string | null;
  return_date?: string | null;
  city?: string;
  postal_code?: string;
  street_address?: string;
  longitude?: number | null;
  latitude?: number | null;
  order_method: string;
  status: string;
  pick_up_method?: string;
  packing_slip_id?: string;
  payment_method?: string;
  shipping_fee: number;
  store_credit_applied: number;
  products: {
    item_sku: string;
    quantity: number;
    price: number;
    deposit: number;
  }[];
}) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized: Session not found.' };

  const validSkus = orderData.products.map((p) => p.item_sku).filter(Boolean);

  if (orderData.status !== 'Draft' && orderData.pickup_date && orderData.return_date) {
    const availability = await checkInventoryAvailability(
      orderData.id,
      validSkus,
      orderData.pickup_date,
      orderData.return_date
    );
    if (availability.conflict) {
      return { error: availability.conflict };
    }
  }

  const { data: previousOrder } = await supabase
    .from('orders')
    .select('store_credit_applied, customer_id, status')
    .eq('id', orderData.id)
    .single();

  let subtotalPrice = 0;
  let subtotalDeposit = 0;
  for (const p of orderData.products) {
    const qty = p.quantity || 1;
    subtotalPrice += (Number(p.price) || 0) * qty;
    subtotalDeposit += (Number(p.deposit) || 0) * qty;
  }

  const shippingFee = Number(orderData.shipping_fee) || 0;
  const newStoreCreditApplied = Number(orderData.store_credit_applied) || 0;
  const grandTotal = Math.max(0, subtotalPrice + subtotalDeposit + shippingFee - newStoreCreditApplied);

  const { error: orderError } = await supabase
    .from('orders')
    .update({
      customer_id: orderData.customer_id || null,
      order_date: orderData.order_date,
      event_start_date: orderData.event_start_date || null,
      event_days: orderData.event_days || 1,
      pickup_date: orderData.pickup_date || null,
      return_date: orderData.return_date || null,
      city: orderData.city || null,
      postal_code: orderData.postal_code || null,
      street_address: orderData.street_address || null,
      longitude: orderData.longitude ?? null,
      latitude: orderData.latitude ?? null,
      order_method: orderData.order_method || 'Manual',
      status: orderData.status || 'Draft',
      pick_up_method: orderData.pick_up_method || null,
      packing_slip_id: orderData.packing_slip_id || null,
      payment_method: orderData.payment_method || null,
      total_price: subtotalPrice,
      total_deposit: subtotalDeposit,
      shipping_fee: shippingFee,
      store_credit_applied: newStoreCreditApplied,
      total: grandTotal,
    })
    .eq('id', orderData.id);

  if (orderError) return { error: orderError.message };

  await supabase.from('order_products').delete().eq('order_id', orderData.id);

  if (orderData.products.length > 0) {
    const productPayloads = orderData.products
      .filter((p) => p.item_sku)
      .map((p) => ({
        order_id: orderData.id,
        item_sku: p.item_sku,
        quantity: p.quantity || 1,
        price: Number(p.price) || 0,
        deposit: Number(p.deposit) || 0,
        subtotal: (Number(p.price) || 0) * (p.quantity || 1),
      }));

    if (productPayloads.length > 0) {
      const { error: pErr } = await supabase.from('order_products').insert(productPayloads);
      if (pErr) return { error: pErr.message };
    }
  }

  // Synchronize Physical Item Availability Status in items table
  if (validSkus.length > 0) {
    if (['In Shipping', 'Active'].includes(orderData.status)) {
      await supabase.from('items').update({ status: 'Unavailable' }).in('sku', validSkus);
    } else if (['Completed', 'Cancelled', 'Draft'].includes(orderData.status)) {
      await supabase.from('items').update({ status: 'Available' }).in('sku', validSkus);
    }
  }

  // Cascade Eviction: Evict overlapping dresses from fittings if this order is active/confirmed
  if (orderData.status !== 'Draft' && orderData.status !== 'Cancelled' && orderData.pickup_date && orderData.return_date) {
    await evictConflictingFittings(orderData.id, validSkus, orderData.pickup_date, orderData.return_date);
  }

  // Store credit reconciliation
  const prevCustomerId = previousOrder?.customer_id;
  const newCustomerId = orderData.customer_id;
  const prevCreditApplied = Number(previousOrder?.store_credit_applied) || 0;

  if (prevCustomerId && prevCustomerId !== newCustomerId && prevCreditApplied > 0) {
    // Refund credit to previous customer
    const { data: prevCust } = await supabase
      .from('customers')
      .select('current_credit')
      .eq('id', prevCustomerId)
      .single();
    if (prevCust) {
      await supabase
        .from('customers')
        .update({ current_credit: Number(prevCust.current_credit) + prevCreditApplied })
        .eq('id', prevCustomerId);
      await supabase.from('credit_logs').insert({
        customer_id: prevCustomerId,
        movement: 'credit_in',
        ref: orderData.id,
        method: 'Customer Reassignment Refund',
        amount: prevCreditApplied,
      });
    }

    // Deduct credit from newly assigned customer
    if (newCustomerId && newStoreCreditApplied > 0) {
      const { data: newCust } = await supabase
        .from('customers')
        .select('current_credit')
        .eq('id', newCustomerId)
        .single();
      if (newCust) {
        await supabase
          .from('customers')
          .update({ current_credit: Math.max(0, Number(newCust.current_credit) - newStoreCreditApplied) })
          .eq('id', newCustomerId);
        await supabase.from('credit_logs').insert({
          customer_id: newCustomerId,
          movement: 'credit_applied',
          ref: orderData.id,
          method: 'Order Checkout',
          amount: newStoreCreditApplied,
        });
      }
    }
  } else if (newCustomerId) {
    const creditDelta = newStoreCreditApplied - prevCreditApplied;
    if (creditDelta !== 0) {
      const { data: customer } = await supabase
        .from('customers')
        .select('current_credit')
        .eq('id', newCustomerId)
        .single();

      if (customer) {
        const updatedBalance = Math.max(0, Number(customer.current_credit) - creditDelta);
        await supabase
          .from('customers')
          .update({ current_credit: updatedBalance })
          .eq('id', newCustomerId);

        await supabase.from('credit_logs').insert({
          customer_id: newCustomerId,
          movement: creditDelta > 0 ? 'credit_applied' : 'credit_in',
          ref: orderData.id,
          method: 'Order Checkout Adjustment',
          amount: Math.abs(creditDelta),
        });
      }
    }
  }

  await supabase.from('admin_audit_logs').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: 'order',
    entity_id: orderData.id,
    action_type: 'SAVE_ORDER',
    field_name: 'all',
  });

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${orderData.id}`);
  revalidatePath('/admin/inventory');
  return { success: true };
}

// -----------------------------------------------------------------------------
// UPDATE STATUS ACTION
// -----------------------------------------------------------------------------
export async function updateOrderStatus(orderId: string, newStatus: string) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized: Session not found.' };

  const { data: currentOrder } = await supabase
    .from('orders')
    .select(`
      status,
      order_method,
      customer_id,
      store_credit_applied,
      order_products (
        item_sku
      )
    `)
    .eq('id', orderId)
    .single();

  if (!currentOrder) return { error: 'Order not found.' };

  if (newStatus === 'Draft' && currentOrder.order_method === 'Website') {
    return { error: 'Website orders cannot be reset to draft.' };
  }

  // Server-side RBAC guard for Reset to Draft
  const isSuperAdmin = admin.role?.toLowerCase().replace(/[\s_-]+/g, '') === 'superadmin';
  if (newStatus === 'Draft' && !isSuperAdmin) {
    const { data: permSetting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'permissions')
      .single();
    if (permSetting?.value?.reset_order_draft === 'superadmin_only') {
      return { error: 'Unauthorized: Only superadmins can reset orders to draft.' };
    }
  }

  // Refund store credit and zero it out on the order to prevent duplicate refund loops
  if (
    newStatus === 'Cancelled' &&
    currentOrder.status !== 'Cancelled' &&
    Number(currentOrder.store_credit_applied) > 0 &&
    currentOrder.customer_id
  ) {
    const { data: cust } = await supabase
      .from('customers')
      .select('current_credit')
      .eq('id', currentOrder.customer_id)
      .single();

    if (cust) {
      await supabase
        .from('customers')
        .update({
          current_credit: Number(cust.current_credit) + Number(currentOrder.store_credit_applied),
        })
        .eq('id', currentOrder.customer_id);

      await supabase.from('credit_logs').insert({
        customer_id: currentOrder.customer_id,
        movement: 'credit_in',
        ref: orderId,
        method: 'Cancellation Refund',
        amount: Number(currentOrder.store_credit_applied),
      });

      await supabase
        .from('orders')
        .update({ store_credit_applied: 0 })
        .eq('id', orderId);
    }
  }

  const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
  if (error) return { error: error.message };

  const skus = (currentOrder.order_products || []).map((op: any) => op.item_sku).filter(Boolean);
  if (skus.length > 0) {
    if (['In Shipping', 'Active'].includes(newStatus)) {
      await supabase.from('items').update({ status: 'Unavailable' }).in('sku', skus);
    } else if (['Completed', 'Cancelled', 'Draft'].includes(newStatus)) {
      await supabase.from('items').update({ status: 'Available' }).in('sku', skus);
    }
  }

  await supabase.from('admin_audit_logs').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: 'order',
    entity_id: orderId,
    action_type: 'STATUS_CHANGE',
    field_name: 'status',
    old_value: currentOrder.status,
    new_value: newStatus,
  });

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath('/admin/inventory');
  return { success: true };
}

// -----------------------------------------------------------------------------
// ADD ADDRESS ACTION
// -----------------------------------------------------------------------------
export async function createCustomerAddress(data: {
  customer_id: string;
  label: string;
  street_address: string;
  city: string;
  postal_code: string;
  latitude?: number | null;
  longitude?: number | null;
}) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized: Session not found.' };

  if (!data.customer_id) return { error: 'Customer ID is required.' };
  if (!data.street_address || !data.city) {
    return { error: 'Street address and City are required.' };
  }

  const { data: newAddr, error } = await supabase
    .from('addresses')
    .insert({
      customer_id: data.customer_id,
      label: data.label?.trim() || 'Home',
      street_address: data.street_address.trim(),
      city: data.city.trim(),
      postal_code: data.postal_code?.trim() || null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      is_default: false,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  await supabase.from('admin_audit_logs').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: 'customer',
    entity_id: data.customer_id,
    action_type: 'ADD_ADDRESS',
    field_name: 'addresses',
    new_value: `${newAddr.label}: ${newAddr.street_address}, ${newAddr.city}`,
  });

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/customers/${data.customer_id}`);

  return { success: true, address: newAddr };
}

export async function addOrderNote(orderId: string, note: string) {
  if (!note.trim()) return { error: 'Note cannot be empty.' };

  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized: Session not found.' };

  const { error } = await supabase.from('admin_audit_logs').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: 'order',
    entity_id: orderId,
    action_type: 'ORDER_NOTE',
    field_name: 'notes',
    new_value: note.trim(),
  });

  if (error) return { error: error.message };

  revalidatePath(`/admin/orders/${orderId}`);
  return { success: true };
}

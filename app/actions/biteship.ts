'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentAdmin } from './auth';
import { createBiteshipOrder } from '@/lib/biteship';
import { revalidatePath } from 'next/cache';

export async function dispatchOrderViaBiteship(orderId: string) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized: Session not found.' };

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select(`
      *,
      customers (
        first_name,
        last_name,
        phone,
        status
      ),
      order_products (
        item_sku,
        quantity,
        price,
        items (
          name
        )
      )
    `)
    .eq('id', orderId)
    .single();

  if (orderErr || !order) {
    return { error: orderErr?.message || `Order ${orderId} not found.` };
  }

  // Guard: KTP must be verified
  if (order.customers?.status !== 'Verified') {
    return {
      error: 'Cannot dispatch: Customer KTP is not verified. Review KTP before courier pickup.',
    };
  }

  // Guard: Self pickup orders must not dispatch courier
  const methodStr = (order.pick_up_method || '').toLowerCase();
  if (methodStr.includes('self pickup') || methodStr.includes('diambil')) {
    return { error: 'Cannot book courier for Self Pickup orders.' };
  }

  // Guard: Destination must have full address and coordinates (supporting equator zero)
  if (!order.street_address || !order.city) {
    return { error: 'Destination address is incomplete on this order.' };
  }

  if (order.latitude === null || order.latitude === undefined || order.longitude === null || order.longitude === undefined) {
    return {
      error: 'Destination latitude and longitude are missing. Please pin the address on the map in the customer order.',
    };
  }

  const { data: shippingSettings } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'shipping')
    .single();

  const rawOrigin = shippingSettings?.value?.dispatch_addresses?.primary;

  const origin = typeof rawOrigin === 'object' && rawOrigin !== null ? rawOrigin : {
    name: 'KORA Showroom Jakarta',
    phone: '081234567890',
    street_address: 'Jl. Gunawarman No. 30, Kebayoran Baru',
    city: 'Jakarta Selatan',
    postal_code: '12180',
    latitude: -6.2382700,
    longitude: 106.8105600,
  };

  if (origin.latitude === null || origin.latitude === undefined || origin.longitude === null || origin.longitude === undefined) {
    return {
      error: 'Origin coordinates are missing. Please set Showroom Latitude and Longitude in Settings > Shipping.',
    };
  }

  // Map Service Codes
  let courierCompany = 'jne';
  let courierType = 'reg';

  if (methodStr.includes('gosend') || methodStr.includes('gojek')) {
    courierCompany = 'gojek';
    courierType = methodStr.includes('same') ? 'same_day' : 'instant';
  } else if (methodStr.includes('grab')) {
    courierCompany = 'grab';
    courierType = methodStr.includes('same') ? 'same_day' : 'instant';
  } else if (methodStr.includes('sicepat')) {
    courierCompany = 'sicepat';
    courierType = methodStr.includes('best') ? 'best' : 'reg';
  } else if (methodStr.includes('paxel')) {
    courierCompany = 'paxel';
    courierType = 'medium';
  } else if (methodStr.includes('tiki')) {
    courierCompany = 'tiki';
    courierType = methodStr.includes('ons') ? 'ons' : 'reg';
  } else {
    courierCompany = 'jne';
    courierType = methodStr.includes('yes') ? 'yes' : 'reg';
  }

  const packageItems = (order.order_products || []).map((op: any) => ({
    name: op.items?.name || op.item_sku,
    value: Number(op.price) || 500000,
    quantity: op.quantity || 1,
    weight: 800,
  }));

  if (packageItems.length === 0) {
    packageItems.push({
      name: `KORA Rental Parcel (${orderId})`,
      value: 1000000,
      quantity: 1,
      weight: 1000,
    });
  }

  const customerName = `${order.customers?.first_name || ''} ${order.customers?.last_name || ''}`.trim() || 'Customer';

  // Sanitize Indonesian phone numbers
  const rawDestPhone = (order.customers?.phone || '').replace(/\D/g, '');
  const destinationPhone = rawDestPhone.startsWith('62') ? `0${rawDestPhone.slice(2)}` : rawDestPhone;
  const rawOriginPhone = (origin.phone || '081234567890').replace(/\D/g, '');
  const originPhone = rawOriginPhone.startsWith('62') ? `0${rawOriginPhone.slice(2)}` : rawOriginPhone;

  const biteshipResult = await createBiteshipOrder({
    origin: {
      name: origin.name || 'KORA Showroom',
      phone: originPhone,
      address: `${origin.street_address}, ${origin.city}`,
      postal_code: String(origin.postal_code || '12180'),
      coordinate: {
        latitude: Number(origin.latitude),
        longitude: Number(origin.longitude),
      },
    },
    destination: {
      name: customerName,
      phone: destinationPhone,
      address: `${order.street_address}, ${order.city}`,
      postal_code: order.postal_code ? String(order.postal_code) : undefined,
      coordinate: {
        latitude: Number(order.latitude),
        longitude: Number(order.longitude),
      },
    },
    courier_company: courierCompany,
    courier_type: courierType,
    delivery_type: 'now',
    reference_id: orderId,
    items: packageItems,
    note: `KORA Rental ${orderId} - Handle with care`,
  });

  if (!biteshipResult.success) {
    return { error: biteshipResult.error };
  }

  const generatedWaybill =
    biteshipResult.waybill_id || biteshipResult.tracking_id || biteshipResult.id || `BTS-${Date.now()}`;

  const { error: updateErr } = await supabase
    .from('orders')
    .update({
      packing_slip_id: generatedWaybill,
      status: 'In Shipping',
      return_label_url: biteshipResult.courier?.link || null,
    })
    .eq('id', orderId);

  if (updateErr) return { error: updateErr.message };

  const skus = (order.order_products || []).map((op: any) => op.item_sku).filter(Boolean);
  if (skus.length > 0) {
    await supabase.from('items').update({ status: 'Unavailable' }).in('sku', skus);
  }

  await supabase.from('admin_audit_logs').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: 'order',
    entity_id: orderId,
    action_type: 'BITESHIP_DISPATCH',
    field_name: 'packing_slip_id',
    new_value: generatedWaybill,
    details: {
      courier: courierCompany,
      type: courierType,
      tracking_id: biteshipResult.tracking_id,
      early_dispatch: Boolean(order.pickup_date && order.pickup_date > new Date().toISOString().split('T')[0]),
    },
  });

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath('/admin/inventory');

  return { success: true, waybill: generatedWaybill };
}

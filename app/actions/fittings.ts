'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentAdmin } from './auth';
import { getNextManualOrderId } from './orders';
import { revalidatePath } from 'next/cache';

// -----------------------------------------------------------------------------
// HELPER: Generate Next FIT-xxxx ID
// -----------------------------------------------------------------------------
export async function getNextFittingId(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('fittings')
    .select('id')
    .like('id', 'FIT-%')
    .order('id', { ascending: false })
    .limit(1);

  if (!data || data.length === 0) return 'FIT-0346';

  const lastId = data[0].id;
  const num = parseInt(lastId.replace('FIT-', ''), 10);
  if (isNaN(num)) return 'FIT-0346';

  return `FIT-${String(num + 1).padStart(4, '0')}`;
}

// -----------------------------------------------------------------------------
// 1. GET AVAILABLE TIME SLOTS FOR A SPECIFIC DATE
// -----------------------------------------------------------------------------
export async function getAvailableSlotsForDate(dateStr: string) {
  if (!dateStr) return { slots: [], isClosed: false, reason: 'Date required' };

  const [year, month, day] = dateStr.split('-').map(Number);
  const targetDate = new Date(year, month - 1, day);
  const dayOfWeek = targetDate.getDay(); // 0 = Sunday, 1 = Monday ... 6 = Saturday

  if (dayOfWeek === 0) {
    return { slots: [], isClosed: true, reason: 'Sunday: Showroom is closed. No bookings possible.' };
  }

  const supabase = await createClient();

  const { data: settingsData } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'fittings')
    .single();

  const fittingRules = settingsData?.value || {
    operating_hours: {
      weekday: { regular: '10:00 - 17:00', after_hours: '17:00 - 18:00' },
      saturday: { regular: '10:00 - 13:00', after_hours: '13:00 - 15:00' },
    },
    session_rules: { after_hours_fee: 100000 },
  };

  type SlotDef = { slot: string; end: string; isAfterHours: boolean; fee: number };
  const candidateSlots: SlotDef[] = [];

  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    for (let h = 10; h <= 16; h++) {
      candidateSlots.push({
        slot: `${String(h).padStart(2, '0')}:00`,
        end: `${String(h + 1).padStart(2, '0')}:00`,
        isAfterHours: false,
        fee: 0,
      });
    }
    candidateSlots.push({
      slot: '17:00',
      end: '18:00',
      isAfterHours: true,
      fee: fittingRules.session_rules?.after_hours_fee || 100000,
    });
  } else if (dayOfWeek === 6) {
    for (let h = 10; h <= 12; h++) {
      candidateSlots.push({
        slot: `${String(h).padStart(2, '0')}:00`,
        end: `${String(h + 1).padStart(2, '0')}:00`,
        isAfterHours: false,
        fee: 0,
      });
    }
    for (let h = 13; h <= 14; h++) {
      candidateSlots.push({
        slot: `${String(h).padStart(2, '0')}:00`,
        end: `${String(h + 1).padStart(2, '0')}:00`,
        isAfterHours: true,
        fee: fittingRules.session_rules?.after_hours_fee || 100000,
      });
    }
  }

  const { data: bookedFittings } = await supabase
    .from('fittings')
    .select('slot')
    .eq('date', dateStr)
    .not('status', 'in', '("Cancelled", "Conflict Evicted", "No Show")');

  const bookedSlotSet = new Set((bookedFittings || []).map((b) => b.slot.slice(0, 5)));

  const computedSlots = candidateSlots.map((s) => ({
    ...s,
    isBooked: bookedSlotSet.has(s.slot),
  }));

  return { slots: computedSlots, isClosed: false };
}

// -----------------------------------------------------------------------------
// 2. GET DRESS AVAILABILITY ON A TARGET FITTING DATE
// -----------------------------------------------------------------------------
export async function getDressesAvailabilityForDate(dateStr: string) {
  const supabase = await createClient();

  const { data: items } = await supabase
    .from('items')
    .select(`
      sku,
      name,
      size,
      color,
      status,
      is_archived,
      buffer_override,
      types (
        default_buffer_days
      )
    `)
    .order('name');

  if (!items) return [];
  if (!dateStr) {
    return items.map((i) => ({
      ...i,
      isAvailable: !i.is_archived && i.status !== 'Under Repair',
      reason: i.is_archived ? 'Archived' : i.status === 'Under Repair' ? 'Under Repair' : 'Available',
    }));
  }

  const { data: activeOrderProducts } = await supabase
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
    .not('orders.status', 'in', '("Cancelled", "Draft")');

  const [y, m, d] = dateStr.split('-').map(Number);
  const fitDate = new Date(y, m - 1, d).getTime();

  return items.map((item) => {
    if (item.is_archived) {
      return { ...item, isAvailable: false, reason: 'Archived item' };
    }
    if (item.status === 'Under Repair') {
      return { ...item, isAvailable: false, reason: 'Currently Under Repair' };
    }

    const itemRentals = (activeOrderProducts || []).filter((p) => p.item_sku === item.sku);
    const bufferDays = item.buffer_override ?? (item.types as any)?.default_buffer_days ?? 2;

    for (const rental of itemRentals) {
      const order = rental.orders as any;
      if (!order.pickup_date || !order.return_date) continue;

      const [py, pm, pd] = order.pickup_date.split('-').map(Number);
      const pickupTime = new Date(py, pm - 1, pd).getTime();

      const [ry, rm, rd] = order.return_date.split('-').map(Number);
      const returnDateObj = new Date(ry, rm - 1, rd);
      returnDateObj.setDate(returnDateObj.getDate() + bufferDays);
      const returnWithBufferTime = returnDateObj.getTime();

      if (fitDate >= pickupTime && fitDate <= returnWithBufferTime) {
        return {
          ...item,
          isAvailable: false,
          reason: `On rental (${order.id}) until ${returnDateObj.toISOString().split('T')[0]}`,
        };
      }
    }

    return { ...item, isAvailable: true, reason: 'Available in Showroom' };
  });
}

// -----------------------------------------------------------------------------
// 3. CREATE FITTING SESSION (ADMIN MANUAL BOOKING)
// -----------------------------------------------------------------------------
export async function createFittingSession(payload: {
  customer_id: string;
  date: string;
  slot: string;
  dresses: string[];
}) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized: Session not found.' };

  if (!payload.customer_id) return { error: 'Customer account is required.' };
  if (!payload.date || !payload.slot) return { error: 'Date and Slot are required.' };

  const validDresses = payload.dresses.filter(Boolean);
  if (validDresses.length === 0) return { error: 'At least one dress must be selected.' };
  if (validDresses.length > 3) return { error: 'Maximum 3 dresses allowed per fitting session.' };

  // 1. Double check dress availability on date
  const availability = await getDressesAvailabilityForDate(payload.date);
  for (const sku of validDresses) {
    const itemMatch = availability.find((a) => a.sku === sku);
    if (!itemMatch?.isAvailable) {
      return { error: `Cannot book: Item "${sku}" is ${itemMatch?.reason || 'unavailable'}.` };
    }
  }

  // 2. Check if time slot is already taken
  const { data: existingSlot } = await supabase
    .from('fittings')
    .select('id')
    .eq('date', payload.date)
    .eq('slot', `${payload.slot}:00`)
    .not('status', 'in', '("Cancelled", "Conflict Evicted", "No Show")')
    .maybeSingle();

  if (existingSlot) {
    return { error: `Slot ${payload.slot} on ${payload.date} is already booked.` };
  }

  // 3. Determine after-hours fee using system settings
  const { data: settings } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'fittings')
    .single();

  const configuredFee = Number(settings?.value?.session_rules?.after_hours_fee) || 100000;

  const slotHour = parseInt(payload.slot.split(':')[0], 10);
  const [year, month, day] = payload.date.split('-').map(Number);
  const targetDate = new Date(year, month - 1, day);
  const dayOfWeek = targetDate.getDay();
  const isAfterHours = (dayOfWeek >= 1 && dayOfWeek <= 5 && slotHour >= 17) || (dayOfWeek === 6 && slotHour >= 13);
  const afterHoursFee = isAfterHours ? configuredFee : 0;

  const newFittingId = await getNextFittingId();
  const endHour = String(slotHour + 1).padStart(2, '0');

  // 4. Insert fitting
  const { error: fitErr } = await supabase.from('fittings').insert({
    id: newFittingId,
    customer_id: payload.customer_id,
    date: payload.date,
    slot: `${payload.slot}:00`,
    end_time: `${endHour}:00`,
    status: 'Confirmed',
    source: 'Manual',
    is_after_hours: isAfterHours,
    after_hours_fee: afterHoursFee,
    fee_payment_status: isAfterHours ? 'Unpaid' : 'n/a',
  });

  if (fitErr) return { error: fitErr.message };

  // 5. Insert fitting items
  const itemPayloads = validDresses.map((sku, index) => ({
    fitting_id: newFittingId,
    item_sku: sku,
    slot_number: index + 1,
  }));

  const { error: itemErr } = await supabase.from('fitting_items').insert(itemPayloads);
  if (itemErr) return { error: itemErr.message };

  // 6. Audit Log
  await supabase.from('admin_audit_logs').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: 'fitting',
    entity_id: newFittingId,
    action_type: 'CREATE_FITTING',
    field_name: 'all',
    details: { dresses: validDresses, date: payload.date, slot: payload.slot },
  });

  revalidatePath('/admin/fittings');
  return { success: true, fittingId: newFittingId };
}

// -----------------------------------------------------------------------------
// 4. UPDATE FITTING STATUS
// -----------------------------------------------------------------------------
export async function updateFittingStatus(fittingId: string, newStatus: string) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized: Session not found.' };

  const { error } = await supabase
    .from('fittings')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', fittingId);

  if (error) return { error: error.message };

  await supabase.from('admin_audit_logs').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: 'fitting',
    entity_id: fittingId,
    action_type: 'FITTING_STATUS_CHANGE',
    field_name: 'status',
    new_value: newStatus,
  });

  revalidatePath('/admin/fittings');
  revalidatePath(`/admin/fittings/${fittingId}`);
  return { success: true };
}

// -----------------------------------------------------------------------------
// 5. RECORD AFTER-HOURS FEE PAYMENT
// -----------------------------------------------------------------------------
export async function recordAfterHoursFeePayment(fittingId: string, method: string) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized: Session not found.' };

  const { error } = await supabase
    .from('fittings')
    .update({
      fee_payment_status: 'Paid',
      fee_payment_method: method || 'Cash',
      fee_paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', fittingId);

  if (error) return { error: error.message };

  await supabase.from('admin_audit_logs').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: 'fitting',
    entity_id: fittingId,
    action_type: 'RECORD_FITTING_FEE',
    field_name: 'fee_payment_status',
    new_value: `Paid via ${method}`,
  });

  revalidatePath(`/admin/fittings/${fittingId}`);
  return { success: true };
}

// -----------------------------------------------------------------------------
// 6. RECORD WHATSAPP REMINDER SENT
// -----------------------------------------------------------------------------
export async function markFittingReminderSent(fittingId: string) {
  const supabase = await createClient();
  await supabase
    .from('fittings')
    .update({ reminder_sent_at: new Date().toISOString() })
    .eq('id', fittingId);

  revalidatePath('/admin/fittings');
  revalidatePath(`/admin/fittings/${fittingId}`);
  return { success: true };
}

// -----------------------------------------------------------------------------
// 7. CONVERT FITTING TO ORDER DRAFT ("Post the order first")
// -----------------------------------------------------------------------------
export async function convertFittingToOrder(fittingId: string) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized: Session not found.' };

  const { data: fitting, error: fitErr } = await supabase
    .from('fittings')
    .select(`
      *,
      customers (
        id,
        first_name,
        last_name,
        phone,
        addresses (
          id,
          street_address,
          city,
          postal_code,
          latitude,
          longitude,
          is_default
        )
      ),
      fitting_items (
        item_sku,
        is_evicted,
        items (
          name,
          rental_price
        )
      )
    `)
    .eq('id', fittingId)
    .single();

  if (fitErr || !fitting) return { error: 'Fitting session not found.' };

  const newOrderId = await getNextManualOrderId();

  const defaultAddress =
    fitting.customers?.addresses?.find((a: any) => a.is_default) ||
    fitting.customers?.addresses?.[0];

  const activeItems = (fitting.fitting_items || []).filter((fi: any) => !fi.is_evicted);

  let totalPrice = 0;
  let totalDeposit = 0;
  const orderProductRows = activeItems.map((fi: any) => {
    const price = Number(fi.items?.rental_price) || 0;
    const deposit = price > 1000000 ? 250000 : 150000;
    totalPrice += price;
    totalDeposit += deposit;
    return {
      order_id: newOrderId,
      item_sku: fi.item_sku,
      quantity: 1,
      price,
      deposit,
      subtotal: price,
    };
  });

  const [fy, fm, fd] = fitting.date.split('-').map(Number);
  const eventDateObj = new Date(fy, fm - 1, fd);
  eventDateObj.setDate(eventDateObj.getDate() + 2);
  const eventStartDate = eventDateObj.toISOString().split('T')[0];

  const returnDateObj = new Date(eventDateObj);
  returnDateObj.setDate(returnDateObj.getDate() + 3);
  const returnDate = returnDateObj.toISOString().split('T')[0];

  const { error: orderErr } = await supabase.from('orders').insert({
    id: newOrderId,
    customer_id: fitting.customer_id,
    order_date: new Date().toISOString().split('T')[0],
    event_start_date: eventStartDate,
    event_days: 1,
    pickup_date: fitting.date,
    return_date: returnDate,
    city: defaultAddress?.city || null,
    postal_code: defaultAddress?.postal_code || null,
    street_address: defaultAddress?.street_address || null,
    latitude: defaultAddress?.latitude ?? null,
    longitude: defaultAddress?.longitude ?? null,
    order_method: 'Manual',
    status: 'Draft',
    pick_up_method: 'Self pickup',
    payment_method: 'QRIS (EDC)',
    total_price: totalPrice,
    total_deposit: totalDeposit,
    shipping_fee: 0,
    store_credit_applied: 0,
    total: totalPrice + totalDeposit,
  });

  if (orderErr) return { error: orderErr.message };

  if (orderProductRows.length > 0) {
    await supabase.from('order_products').insert(orderProductRows);
  }

  await supabase
    .from('fittings')
    .update({ converted_order_id: newOrderId, status: 'Completed' })
    .eq('id', fittingId);

  await supabase.from('admin_audit_logs').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: 'fitting',
    entity_id: fittingId,
    action_type: 'CONVERT_TO_ORDER',
    field_name: 'converted_order_id',
    new_value: newOrderId,
  });

  revalidatePath('/admin/fittings');
  revalidatePath('/admin/orders');

  return { success: true, orderId: newOrderId };
}

// -----------------------------------------------------------------------------
// 8. ADD FITTING NOTE
// -----------------------------------------------------------------------------
export async function addFittingNote(fittingId: string, note: string) {
  if (!note.trim()) return { error: 'Note cannot be empty.' };

  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized: Session not found.' };

  const { error } = await supabase.from('admin_audit_logs').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: 'fitting',
    entity_id: fittingId,
    action_type: 'FITTING_NOTE',
    field_name: 'notes',
    new_value: note.trim(),
  });

  if (error) return { error: error.message };

  revalidatePath(`/admin/fittings/${fittingId}`);
  return { success: true };
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "./auth";
import { getNextManualOrderId } from "./orders";
import { revalidatePath } from "next/cache";

export async function getNextFittingId(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fittings")
    .select("id")
    .like("id", "FIT-%")
    .order("id", { ascending: false })
    .limit(1);
  if (!data || data.length === 0) return "FIT-0346";
  const num = parseInt(data[0].id.replace("FIT-", ""), 10);
  if (isNaN(num)) return "FIT-0346";
  return `FIT-${String(num + 1).padStart(4, "0")}`;
}

export async function getAvailableSlotsForDate(dateStr: string) {
  if (!dateStr) return { slots: [], isClosed: false, reason: "Date required" };
  const [year, month, day] = dateStr.split("-").map(Number);
  const targetDate = new Date(year, month - 1, day);
  const dayOfWeek = targetDate.getDay();

  if (dayOfWeek === 0) {
    return {
      slots: [],
      isClosed: true,
      reason: "Sunday: Showroom is closed. No bookings possible.",
    };
  }

  const supabase = await createClient();
  const { data: settingsData } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "fittings")
    .single();
  const fittingRules = settingsData?.value || {
    session_rules: { after_hours_fee: 100000 },
  };

  type SlotDef = {
    slot: string;
    end: string;
    isAfterHours: boolean;
    fee: number;
  };
  const candidateSlots: SlotDef[] = [];
  const fee = fittingRules.session_rules?.after_hours_fee || 100000;

  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    for (let h = 10; h <= 16; h++) {
      candidateSlots.push({
        slot: `${String(h).padStart(2, "0")}:00`,
        end: `${String(h + 1).padStart(2, "0")}:00`,
        isAfterHours: false,
        fee: 0,
      });
    }
    candidateSlots.push({
      slot: "17:00",
      end: "18:00",
      isAfterHours: true,
      fee,
    });
  } else if (dayOfWeek === 6) {
    for (let h = 10; h <= 12; h++) {
      candidateSlots.push({
        slot: `${String(h).padStart(2, "0")}:00`,
        end: `${String(h + 1).padStart(2, "0")}:00`,
        isAfterHours: false,
        fee: 0,
      });
    }
    for (let h = 13; h <= 14; h++) {
      candidateSlots.push({
        slot: `${String(h).padStart(2, "0")}:00`,
        end: `${String(h + 1).padStart(2, "0")}:00`,
        isAfterHours: true,
        fee,
      });
    }
  }

  const { data: booked } = await supabase
    .from("fittings")
    .select("slot")
    .eq("date", dateStr)
    .not("status", "in", '("Cancelled", "Conflict Evicted", "No Show")');
  const bookedSet = new Set((booked || []).map((b) => b.slot.slice(0, 5)));

  return {
    slots: candidateSlots.map((s) => ({
      ...s,
      isBooked: bookedSet.has(s.slot),
    })),
    isClosed: false,
  };
}

export async function getDressesAvailabilityForDate(dateStr: string) {
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("items")
    .select(
      "sku, name, size, color, status, is_archived, buffer_override, types(default_buffer_days)",
    )
    .order("name");
  if (!items) return [];

  if (!dateStr) {
    return items.map((i) => ({
      ...i,
      isAvailable: !i.is_archived && i.status !== "Under Repair",
      reason: i.is_archived
        ? "Archived"
        : i.status === "Under Repair"
          ? "Under Repair"
          : "Available",
    }));
  }

  const { data: activeProducts } = await supabase
    .from("order_products")
    .select("item_sku, orders!inner(id, pickup_date, return_date, status)")
    .not("orders.status", "in", '("Cancelled", "Draft")');

  const [y, m, d] = dateStr.split("-").map(Number);
  const fitTime = new Date(y, m - 1, d).getTime();

  return items.map((item) => {
    if (item.is_archived)
      return { ...item, isAvailable: false, reason: "Archived item" };
    if (item.status === "Under Repair")
      return { ...item, isAvailable: false, reason: "Currently Under Repair" };

    const rentals = (activeProducts || []).filter(
      (p) => p.item_sku === item.sku,
    );
    const bufferDays =
      item.buffer_override ?? (item.types as any)?.default_buffer_days ?? 2;

    for (const rental of rentals) {
      const order = rental.orders as any;
      if (!order.pickup_date || !order.return_date) continue;
      const [py, pm, pd] = order.pickup_date.split("-").map(Number);
      const pickupTime = new Date(py, pm - 1, pd).getTime();
      const [ry, rm, rd] = order.return_date.split("-").map(Number);
      const endObj = new Date(ry, rm - 1, rd);
      endObj.setDate(endObj.getDate() + bufferDays);
      if (fitTime >= pickupTime && fitTime <= endObj.getTime()) {
        return {
          ...item,
          isAvailable: false,
          reason: `On rental (${order.id}) until ${endObj.toISOString().split("T")[0]}`,
        };
      }
    }
    return { ...item, isAvailable: true, reason: "Available in Showroom" };
  });
}

export async function createFittingSession(payload: {
  customer_id: string;
  date: string;
  slot: string;
  dresses: string[];
}) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Unauthorized: Session not found." };
  if (!payload.customer_id) return { error: "Customer account is required." };
  if (!payload.date || !payload.slot)
    return { error: "Date and Slot are required." };

  const dresses = payload.dresses.filter(Boolean);
  if (dresses.length === 0)
    return { error: "At least one dress must be selected." };
  if (dresses.length > 3) return { error: "Maximum 3 dresses allowed." };

  const availability = await getDressesAvailabilityForDate(payload.date);
  for (const sku of dresses) {
    const m = availability.find((a) => a.sku === sku);
    if (!m?.isAvailable)
      return {
        error: `Cannot book: Item "${sku}" is ${m?.reason || "unavailable"}.`,
      };
  }

  const { data: existingSlot } = await supabase
    .from("fittings")
    .select("id")
    .eq("date", payload.date)
    .eq("slot", `${payload.slot}:00`)
    .not("status", "in", '("Cancelled", "Conflict Evicted", "No Show")')
    .maybeSingle();
  if (existingSlot)
    return {
      error: `Slot ${payload.slot} on ${payload.date} is already booked.`,
    };

  const { data: settings } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "fittings")
    .single();
  const configuredFee =
    Number(settings?.value?.session_rules?.after_hours_fee) || 100000;

  const slotHour = parseInt(payload.slot.split(":")[0], 10);
  const [year, month, day] = payload.date.split("-").map(Number);
  const dow = new Date(year, month - 1, day).getDay();
  const isAfterHours =
    (dow >= 1 && dow <= 5 && slotHour >= 17) || (dow === 6 && slotHour >= 13);
  const afterHoursFee = isAfterHours ? configuredFee : 0;

  const newId = await getNextFittingId();
  const endHour = String(slotHour + 1).padStart(2, "0");

  const { error: fitErr } = await supabase.from("fittings").insert({
    id: newId,
    customer_id: payload.customer_id,
    date: payload.date,
    slot: `${payload.slot}:00`,
    end_time: `${endHour}:00`,
    status: "Confirmed",
    source: "Manual",
    is_after_hours: isAfterHours,
    after_hours_fee: afterHoursFee,
    fee_payment_status: isAfterHours ? "Unpaid" : "n/a",
  });
  if (fitErr) return { error: fitErr.message };

  const itemRows = dresses.map((sku, i) => ({
    fitting_id: newId,
    item_sku: sku,
    slot_number: i + 1,
  }));
  const { error: itemErr } = await supabase
    .from("fitting_items")
    .insert(itemRows);
  if (itemErr) return { error: itemErr.message };

  await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: "fitting",
    entity_id: newId,
    action_type: "CREATE_FITTING",
    field_name: "all",
    details: { dresses, date: payload.date, slot: payload.slot },
  });

  revalidatePath("/admin/fittings");
  return { success: true, fittingId: newId };
}

export async function updateFittingStatus(
  fittingId: string,
  newStatus: string,
) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Unauthorized: Session not found." };

  const { data: current } = await supabase
    .from("fittings")
    .select("fee_payment_status, after_hours_fee")
    .eq("id", fittingId)
    .single();

  const wasPaid = current?.fee_payment_status === "Paid";
  const shouldRefund =
    wasPaid && (newStatus === "Cancelled" || newStatus === "Conflict Evicted");

  const update: Record<string, any> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };

  if (shouldRefund) {
    update.refund_status = "Pending";
    update.refund_amount = Number(current.after_hours_fee) || 0;
  }

  const { error } = await supabase
    .from("fittings")
    .update(update)
    .eq("id", fittingId);

  if (error) return { error: error.message };

  await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: "fitting",
    entity_id: fittingId,
    action_type: "FITTING_STATUS_CHANGE",
    field_name: "status",
    new_value: newStatus,
    details: shouldRefund
      ? { refund_owed: true, refund_amount: update.refund_amount }
      : undefined,
  });

  revalidatePath("/admin/fittings");
  revalidatePath(`/admin/fittings/${fittingId}`);
  return { success: true };
}

export async function recordAfterHoursFeePayment(
  fittingId: string,
  method: string,
) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Unauthorized: Session not found." };

  const { error } = await supabase
    .from("fittings")
    .update({
      fee_payment_status: "Paid",
      fee_payment_method: method || "Cash",
      fee_paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", fittingId);
  if (error) return { error: error.message };

  await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: "fitting",
    entity_id: fittingId,
    action_type: "RECORD_FITTING_FEE",
    field_name: "fee_payment_status",
    new_value: `Paid via ${method}`,
  });

  revalidatePath(`/admin/fittings/${fittingId}`);
  return { success: true };
}

// -----------------------------------------------------------------------------
// Send reminder → timestamp the row, then dispatch `fitting_reminder` via Fonnte
// -----------------------------------------------------------------------------
export async function markFittingReminderSent(fittingId: string) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Unauthorized: Session not found." };

  const { data: fitting } = await supabase
    .from("fittings")
    .select("id, date, slot, customers(first_name, last_name, phone)")
    .eq("id", fittingId)
    .single();

  if (!fitting) return { error: "Fitting not found." };

  // Timestamp regardless of whether the WA send succeeds so the "REMINDER DUE"
  // badge clears (the admin can always re-send later via the same button).
  await supabase
    .from("fittings")
    .update({ reminder_sent_at: new Date().toISOString() })
    .eq("id", fittingId);

  const customer = (fitting as any).customers as
    | { first_name?: string; last_name?: string; phone?: string }
    | undefined;

  if (!customer?.phone) {
    revalidatePath("/admin/fittings");
    revalidatePath(`/admin/fittings/${fittingId}`);
    return { success: true, sent: false, error: "Customer has no phone number." };
  }

  const customerName =
    `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "there";
  const timeFormatted = fitting.slot ? String(fitting.slot).slice(0, 5) : "10:00";

  try {
    const { emitWa } = await import("@/lib/notifications");
    const res = await emitWa(supabase, admin, {
      entity: "fitting",
      entityId: fittingId,
      kind: "fitting_reminder",
      to: customer.phone,
      vars: {
        CUSTOMER_NAME: customerName,
        FITTING_TIME: `${fitting.date} · ${timeFormatted}`,
        FITTING_DATE: String(fitting.date),
      },
      fallbackTemplate:
        "Hi [CUSTOMER_NAME], reminder for your fitting appointment tomorrow at [FITTING_TIME]. See you at our showroom!",
    });

    revalidatePath("/admin/fittings");
    revalidatePath(`/admin/fittings/${fittingId}`);
    return { success: true, waUrl: res.waUrl, sent: res.sent, error: res.error };
  } catch (e: any) {
    revalidatePath("/admin/fittings");
    revalidatePath(`/admin/fittings/${fittingId}`);
    return { success: true, sent: false, error: e.message };
  }
}

// -----------------------------------------------------------------------------
// Convert to order — accepts optional pick_up_method; default Self pickup
// -----------------------------------------------------------------------------
export async function convertFittingToOrder(
  fittingId: string,
  options?: { pick_up_method?: string },
) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Unauthorized: Session not found." };

  const { data: fitting, error: fitErr } = await supabase
    .from("fittings")
    .select(
      `
      *,
      customers(id, first_name, last_name, phone, addresses(*)),
      fitting_items(item_sku, is_evicted, items(name, rental_price))
    `,
    )
    .eq("id", fittingId)
    .single();
  if (fitErr || !fitting) return { error: "Fitting session not found." };

  const newOrderId = await getNextManualOrderId();
  const defaultAddress =
    fitting.customers?.addresses?.find((a: any) => a.is_default) ||
    fitting.customers?.addresses?.[0];
  const activeItems = (fitting.fitting_items || []).filter(
    (fi: any) => !fi.is_evicted,
  );

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

  const [fy, fm, fd] = fitting.date.split("-").map(Number);
  const eventDate = new Date(fy, fm - 1, fd);
  eventDate.setDate(eventDate.getDate() + 2);
  const eventStartDate = eventDate.toISOString().split("T")[0];
  const returnDate = new Date(eventDate);
  returnDate.setDate(returnDate.getDate() + 3);

  const pickUpMethod = options?.pick_up_method || "Self pickup";

  const { error: orderErr } = await supabase.from("orders").insert({
    id: newOrderId,
    customer_id: fitting.customer_id,
    order_date: new Date().toISOString().split("T")[0],
    event_start_date: eventStartDate,
    event_days: 1,
    pickup_date: fitting.date,
    return_date: returnDate.toISOString().split("T")[0],
    city: defaultAddress?.city || null,
    postal_code: defaultAddress?.postal_code || null,
    street_address: defaultAddress?.street_address || null,
    latitude: defaultAddress?.latitude ?? null,
    longitude: defaultAddress?.longitude ?? null,
    order_method: "Manual",
    status: "Draft",
    pick_up_method: pickUpMethod,
    payment_method: "QRIS (EDC)",
    total_price: totalPrice,
    total_deposit: totalDeposit,
    shipping_fee: 0,
    store_credit_applied: 0,
    total: totalPrice + totalDeposit,
  });
  if (orderErr) return { error: orderErr.message };

  if (orderProductRows.length > 0) {
    await supabase.from("order_products").insert(orderProductRows);
  }

  await supabase
    .from("fittings")
    .update({ converted_order_id: newOrderId, status: "Completed" })
    .eq("id", fittingId);

  await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: "fitting",
    entity_id: fittingId,
    action_type: "CONVERT_TO_ORDER",
    field_name: "converted_order_id",
    new_value: newOrderId,
    details: { pick_up_method: pickUpMethod },
  });

  revalidatePath("/admin/fittings");
  revalidatePath("/admin/orders");
  return { success: true, orderId: newOrderId };
}

export async function addFittingNote(fittingId: string, note: string) {
  if (!note.trim()) return { error: "Note cannot be empty." };
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Unauthorized: Session not found." };

  const { error } = await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: "fitting",
    entity_id: fittingId,
    action_type: "FITTING_NOTE",
    field_name: "notes",
    new_value: note.trim(),
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/fittings/${fittingId}`);
  return { success: true };
}

export async function markFittingRefunded(fittingId: string, amount: number) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Unauthorized: Session not found." };

  if (!amount || amount <= 0) {
    return { error: "Refund amount must be greater than zero." };
  }

  const { data: fitting } = await supabase
    .from("fittings")
    .select("refund_status, refund_amount")
    .eq("id", fittingId)
    .single();

  if (!fitting) return { error: "Fitting not found." };
  if (fitting.refund_status !== "Pending") {
    return { error: "This fitting has no pending refund." };
  }

  const { error } = await supabase
    .from("fittings")
    .update({
      refund_status: "Refunded",
      refund_amount: Number(amount),
      refunded_at: new Date().toISOString(),
      refunded_by: admin.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", fittingId);

  if (error) return { error: error.message };

  await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: "fitting",
    entity_id: fittingId,
    action_type: "FITTING_REFUND_MARKED",
    field_name: "refund_status",
    old_value: "Pending",
    new_value: "Refunded",
    details: { amount },
  });

  revalidatePath("/admin/fittings");
  revalidatePath(`/admin/fittings/${fittingId}`);
  return { success: true };
}

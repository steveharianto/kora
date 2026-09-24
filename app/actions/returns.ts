"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "./auth";
import { createBiteshipOrder } from "@/lib/biteship";
import { revalidatePath } from "next/cache";
import { resolveReturnCourier } from "@/lib/courierMap";

export async function createReturnRequest(payload: {
  order_id: string;
  return_method: "KORA arranges pickup (Biteship)" | "Customer self-return";
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
  if (!admin) return { error: "Unauthorized: Session not found." };

  const { data: existing } = await supabase
    .from("returns")
    .select("id")
    .eq("order_id", payload.order_id)
    .maybeSingle();
  if (existing)
    return {
      error: `A return (${existing.id}) already exists for this order.`,
    };

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("*, customers(id, first_name, last_name, phone, addresses(*))")
    .eq("id", payload.order_id)
    .single();
  if (orderErr || !order) return { error: "Anchor order not found." };

  const customerName =
    `${order.customers?.first_name || ""} ${order.customers?.last_name || ""}`.trim();
  const returnId = `RET-${order.id}`;

  let address = {
    label: "Home",
    recipient_name: payload.pickup_recipient_name || customerName,
    phone: payload.pickup_phone || order.customers?.phone || "",
    street_address: payload.pickup_street_address || order.street_address,
    city: payload.pickup_city || order.city,
    postal_code: payload.pickup_postal_code || order.postal_code,
    latitude: payload.pickup_latitude ?? order.latitude,
    longitude: payload.pickup_longitude ?? order.longitude,
  };

  if (payload.pickup_address_id) {
    const matched = order.customers?.addresses?.find(
      (a: any) => String(a.id) === String(payload.pickup_address_id),
    );
    if (matched) {
      address = {
        label: matched.label || "Home",
        recipient_name: customerName,
        phone: order.customers?.phone || "",
        street_address: matched.street_address,
        city: matched.city,
        postal_code: matched.postal_code,
        latitude: matched.latitude,
        longitude: matched.longitude,
      };
    }
  }

  const depositHeld = Number(order.total_deposit) || 0;

  const { error: insertErr } = await supabase.from("returns").insert({
    id: returnId,
    order_id: order.id,
    customer_id: order.customer_id,
    status: "Requested",
    return_method: payload.return_method,
    request_source: "Manual",
    pickup_address_id: payload.pickup_address_id
      ? Number(payload.pickup_address_id)
      : null,
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

  await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: "return",
    entity_id: returnId,
    action_type: "CREATE_RETURN_REQUEST",
    field_name: "status",
    new_value: "Requested",
  });

  revalidatePath("/admin/returns");
  return { success: true, returnId };
}

export async function dispatchReturnViaBiteship(
  returnId: string,
  courierChoice?: string,
) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Unauthorized: Session not found." };

  const { data: ret, error: retErr } = await supabase
    .from("returns")
    .select("*, orders(id, order_products(item_sku, quantity, items(name)))")
    .eq("id", returnId)
    .single();
  if (retErr || !ret) return { error: "Return record not found." };

  if (
    ret.waybill_id &&
    ["Shipping", "Received", "In Review", "Completed"].includes(ret.status)
  ) {
    return { error: `Return already dispatched (waybill: ${ret.waybill_id}).` };
  }
  if (!ret.pickup_street_address || !ret.pickup_city) {
    return { error: "Customer return pickup address is incomplete." };
  }

  const { data: shippingSettings } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "shipping")
    .single();
  const rawShowroom = shippingSettings?.value?.dispatch_addresses?.primary;
  const showroom =
    typeof rawShowroom === "object" && rawShowroom !== null
      ? rawShowroom
      : null;
  if (
    !showroom?.street_address ||
    !showroom?.latitude ||
    !showroom?.longitude
  ) {
    return { error: "Showroom return destination is not fully configured." };
  }

  let codes;
  try {
    codes = resolveReturnCourier(
      courierChoice || ret.courier_company || "paxel - regular",
    );
  } catch (e: any) {
    return { error: e.message };
  }

  if (["gojek", "grab"].includes(codes.company)) {
    if (
      ret.pickup_latitude === null ||
      ret.pickup_latitude === undefined ||
      ret.pickup_longitude === null ||
      ret.pickup_longitude === undefined
    ) {
      return { error: "Instant courier requires customer pickup coordinates." };
    }
  }

  const items = (ret.orders?.order_products || []).map((p: any) => ({
    name: `Return: ${p.items?.name || p.item_sku}`,
    value: 500000,
    quantity: p.quantity || 1,
    weight: shippingSettings?.value?.default_item_weight_g ?? 1000,
  }));

  const biteshipRes = await createBiteshipOrder({
    origin: {
      name: ret.pickup_recipient_name || "Customer",
      phone: ret.pickup_phone || "081234567890",
      address: `${ret.pickup_street_address}, ${ret.pickup_city}`,
      postal_code: ret.pickup_postal_code
        ? String(ret.pickup_postal_code)
        : undefined,
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
      name: showroom.name || "KORA Showroom",
      phone: showroom.phone || "081234567890",
      address: `${showroom.street_address}, ${showroom.city}`,
      postal_code: String(showroom.postal_code || "12180"),
      coordinate: {
        latitude: Number(showroom.latitude),
        longitude: Number(showroom.longitude),
      },
    },
    courier_company: codes.company,
    courier_type: codes.type,
    delivery_type: "now",
    reference_id: `RET-${ret.order_id}`,
    items,
    note: `KORA Return ${ret.order_id} - Studio Receiving`,
  });

  if (!biteshipRes.success)
    return { error: biteshipRes.error || "Failed to dispatch courier." };

  const resi =
    biteshipRes.waybill_id ||
    biteshipRes.tracking_id ||
    `RET-WYB-${Date.now()}`;
  const { error: upErr } = await supabase
    .from("returns")
    .update({
      status: "Shipping",
      courier_company: codes.company,
      courier_type: codes.type,
      waybill_id: resi,
      biteship_order_id: biteshipRes.id || null,
      tracking_url:
        biteshipRes.courier?.link ||
        (biteshipRes.tracking_id
          ? `https://track.biteship.com/${biteshipRes.tracking_id}`
          : null),
      shipped_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", returnId);
  if (upErr) return { error: upErr.message };

  await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: "return",
    entity_id: returnId,
    action_type: "BITESHIP_RETURN_DISPATCH",
    field_name: "waybill_id",
    new_value: resi,
    details: { courier: codes.company, type: codes.type },
  });

  revalidatePath("/admin/returns");
  revalidatePath(`/admin/returns/${returnId}`);
  return { success: true, waybill: resi };
}

export async function saveReturnResi(
  returnId: string,
  courier: string,
  resi: string,
) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Unauthorized: Session not found." };
  if (!resi.trim())
    return { error: "Return Resi / Waybill number cannot be empty." };

  // Validate courier is a known key (upper/lower normalized)
  try {
    resolveReturnCourier(courier);
  } catch (e: any) {
    return { error: e.message };
  }

  const { error } = await supabase
    .from("returns")
    .update({
      courier_company: courier,
      waybill_id: resi.trim(),
      status: "Shipping",
      shipped_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", returnId);
  if (error) return { error: error.message };

  await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: "return",
    entity_id: returnId,
    action_type: "SAVE_RETURN_RESI",
    field_name: "waybill_id",
    new_value: resi.trim(),
  });

  revalidatePath("/admin/returns");
  revalidatePath(`/admin/returns/${returnId}`);
  return { success: true };
}

export async function markReturnReceived(returnId: string) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Unauthorized: Session not found." };

  const { error } = await supabase
    .from("returns")
    .update({
      status: "Received",
      received_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", returnId);
  if (error) return { error: error.message };

  await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: "return",
    entity_id: returnId,
    action_type: "RECEIVE_RETURN",
    field_name: "status",
    new_value: "Received",
  });

  revalidatePath("/admin/returns");
  revalidatePath(`/admin/returns/${returnId}`);
  return { success: true };
}

export async function startReturnQc(returnId: string) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Unauthorized: Session not found." };

  const { data: ret } = await supabase
    .from("returns")
    .select("status")
    .eq("id", returnId)
    .single();
  if (!ret) return { error: "Return not found." };
  if (ret.status !== "Received") {
    return { error: `Cannot start QC from status ${ret.status}.` };
  }

  const { data: settings } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "permissions")
    .single();
  const requireQc = settings?.value?.require_qc_review !== false;

  if (requireQc) {
    const { error } = await supabase
      .from("returns")
      .update({ status: "In Review", updated_at: new Date().toISOString() })
      .eq("id", returnId);
    if (error) return { error: error.message };
  }

  await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: "return",
    entity_id: returnId,
    action_type: requireQc ? "START_QC_REVIEW" : "QC_SKIPPED",
    field_name: "status",
    new_value: requireQc ? "In Review" : "Received",
  });

  revalidatePath(`/admin/returns/${returnId}`);
  return { success: true };
}

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
    per_item_qc?: Array<{
      sku: string;
      stains: boolean;
      damage: boolean;
      odor: boolean;
      missing: boolean;
    }>;
  },
) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Unauthorized: Session not found." };
  if (!payload.refund_destination)
    return { error: "Refund destination is required." };

  const { data: ret, error: retErr } = await supabase
    .from("returns")
    .select("*, orders(id, return_date, order_products(item_sku))")
    .eq("id", returnId)
    .single();
  if (retErr || !ret) return { error: "Return not found." };

  if (ret.status === "Completed" || ret.refund_status === "Refunded") {
    return { error: "Deposit has already been released for this return." };
  }

  const { data: settings } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "permissions")
    .single();
  const requireQc = settings?.value?.require_qc_review !== false;
  if (requireQc && ret.status !== "In Review") {
    return { error: 'QC not started. Press "Start QC review" first.' };
  }

  const depositHeld = Number(ret.deposit_held) || 0;
  const qcDeduction = Math.max(0, Number(payload.qc_deduction) || 0);
  const shippingCost = Math.max(0, Number(payload.return_shipping_cost) || 0);
  const netRefund = Math.max(0, depositHeld - qcDeduction - shippingCost);

  // Server-side late_days recompute
  const deadline = ret.orders?.return_date
    ? new Date(ret.orders.return_date)
    : null;
  if (deadline) deadline.setHours(0, 0, 0, 0);
  const refDate = ret.received_at ? new Date(ret.received_at) : new Date();
  refDate.setHours(0, 0, 0, 0);
  const lateDays = deadline
    ? Math.max(
        0,
        Math.round((refDate.getTime() - deadline.getTime()) / 86400000),
      )
    : 0;

  const { error: upErr } = await supabase
    .from("returns")
    .update({
      has_stains: payload.has_stains,
      has_damage: payload.has_damage,
      is_incomplete: payload.is_incomplete,
      has_odor: payload.has_odor,
      late_days: lateDays,
      qc_deduction: qcDeduction,
      return_shipping_cost: shippingCost,
      refund_amount: netRefund,
      refund_destination: payload.refund_destination,
      deduction_reason: payload.deduction_reason || null,
      qc_notes: payload.qc_notes || null,
      refund_status: "Refunded",
      refunded_at: new Date().toISOString(),
      refunded_by_admin_id: admin.id,
      status: "Completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", returnId);
  if (upErr) return { error: upErr.message };

  await supabase
    .from("orders")
    .update({ status: "Completed" })
    .eq("id", ret.order_id);

  const skus: string[] = (ret.orders?.order_products || [])
    .map((p: any) => p.item_sku as string)
    .filter(Boolean);
  if (skus.length > 0) {
    const perItem = payload.per_item_qc || [];
    const damagedSkus = perItem.filter((i) => i.damage).map((i) => i.sku);
    const cleanSkus = skus.filter((s) => !damagedSkus.includes(s));
    if (damagedSkus.length > 0) {
      await supabase
        .from("items")
        .update({ status: "Under Repair" })
        .in("sku", damagedSkus);
    }
    if (cleanSkus.length > 0) {
      await supabase
        .from("items")
        .update({ status: "Available" })
        .in("sku", cleanSkus);
    }
  }

  await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: "return",
    entity_id: returnId,
    action_type: "RELEASE_DEPOSIT_AND_COMPLETE",
    field_name: "refund_status",
    new_value: `Refunded ${netRefund} via ${payload.refund_destination}`,
    details: {
      deposit_held: depositHeld,
      qc_deduction: qcDeduction,
      shipping_cost: shippingCost,
      refund_amount: netRefund,
      late_days: lateDays,
      damage: payload.has_damage,
      per_item_qc: payload.per_item_qc || null,
    },
  });

  revalidatePath("/admin/returns");
  revalidatePath(`/admin/returns/${returnId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/inventory");

  return { success: true };
}

export async function addReturnNote(returnId: string, note: string) {
  if (!note.trim()) return { error: "Note cannot be empty." };
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Unauthorized: Session not found." };

  const { error } = await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: "return",
    entity_id: returnId,
    action_type: "RETURN_NOTE",
    field_name: "notes",
    new_value: note.trim(),
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/returns/${returnId}`);
  return { success: true };
}

// -----------------------------------------------------------------------------
// NEW: Remind customer (WA) — reusable server-side emit
// -----------------------------------------------------------------------------
export async function remindReturnCustomer(returnId: string) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Unauthorized: Session not found." };

  const { data: ret } = await supabase
    .from("returns")
    .select(
      "*, customers(first_name, last_name, phone), orders(id, return_date)",
    )
    .eq("id", returnId)
    .single();
  if (!ret) return { error: "Return not found." };
  const phone = ret.customers?.phone;
  if (!phone) return { error: "Customer has no phone number." };

  const { emitWa } = await import("@/lib/notifications");
  try {
    const res = await emitWa(supabase, admin, {
      entity: "return",
      entityId: returnId,
      kind: "return_due",
      to: phone,
      vars: {
        CUSTOMER_NAME:
          `${ret.customers?.first_name || ""} ${ret.customers?.last_name || ""}`.trim(),
        ORDER_ID: ret.orders?.id || "",
        RETURN_DATE: ret.orders?.return_date || "",
      },
      fallbackTemplate:
        "Hi [CUSTOMER_NAME], gentle reminder to return your rental for order [ORDER_ID] by [RETURN_DATE].",
    });
    revalidatePath(`/admin/returns/${returnId}`);
    return { success: true, waUrl: res.waUrl };
  } catch (e: any) {
    return { error: e.message };
  }
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "./auth";
import { createBiteshipOrder, getBiteshipRates } from "@/lib/biteship";
import { revalidatePath } from "next/cache";
import { formatRupiah } from "@/lib/utils";

/* ── Courier rate lookup for reverse pickups ─────────────────────── */

const RETURN_COURIER_QUERY =
  "jne,sicepat,gojek,paxel,grab,anteraja,ninja,pos,tiki,lion";

const COURIER_LABELS: Record<string, string> = {
  "jne|reg": "JNE — REG",
  "jne|yes": "JNE — YES",
  "sicepat|reg": "SiCepat — REG",
  "sicepat|best": "SiCepat — BEST",
  "gojek|instant": "GoSend — Instant",
  "gojek|sameday": "GoSend — Same Day",
  "paxel|small": "Paxel — Small",
  "paxel|medium": "Paxel — Medium",
  "paxel|large": "Paxel — Large",
  "paxel|regular": "Paxel — Regular",
  "paxel|instant": "Paxel — Instant",
  "grab|instant": "GrabExpress — Instant",
  "grab|sameday": "GrabExpress — Same Day",
  "anteraja|reg": "Anteraja — REG",
  "anteraja|sameday": "Anteraja — Same Day",
  "ninja|standard": "Ninja Xpress — Standard",
  "pos|reg": "Pos Indonesia — Reguler",
  "tiki|reg": "TIKI — REG",
  "lion|reg": "Lion Parcel — REG",
};

function labelForCourier(company: string, type: string): string {
  const key = `${company.toLowerCase()}|${type.toLowerCase()}`;
  if (COURIER_LABELS[key]) return COURIER_LABELS[key];
  const comp = company.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const typ = type.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return `${comp} — ${typ}`;
}

export interface ReturnRateOption {
  label: string;
  price: number;
  etd: string;
  courierCompany: string;
  courierType: string;
}

/**
 * Fetches live reverse-pickup rates for a return — origin is the customer's
 * address, destination is the showroom. Mirrors the checkout quote flow so
 * the admin sees the same courier list the customer saw at checkout.
 */
export async function getReturnShippingRates(
  returnId: string,
): Promise<{ success?: boolean; options?: ReturnRateOption[]; error?: string }> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Unauthorized." };

  const supabase = await createClient();

  const { data: ret } = await supabase
    .from("returns")
    .select(
      `
      id, pickup_street_address, pickup_city, pickup_postal_code,
      pickup_latitude, pickup_longitude,
      orders ( id, order_products ( item_sku, quantity, items ( name ) ) )
    `,
    )
    .eq("id", returnId)
    .single();

  if (!ret) return { error: "Return record not found." };

  if (!ret.pickup_postal_code) {
    return {
      error:
        "Customer pickup address has no postal code — add one to the return before booking a courier.",
    };
  }

  const { data: shippingSettings } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "shipping")
    .single();

  const showroom = shippingSettings?.value?.dispatch_addresses?.primary;
  if (!showroom?.postal_code) {
    return { error: "Showroom return destination is not configured." };
  }

  const defaultWeight = Number(
    shippingSettings?.value?.default_item_weight_g ?? 800,
  );
  const overrides: Record<string, number> =
    shippingSettings?.value?.item_weight_overrides ?? {};

  const orderProducts: any[] = (ret.orders as any)?.order_products || [];
  const items = orderProducts.map((p) => ({
    name: `Return: ${p.items?.name || p.item_sku}`,
    value: 500000,
    quantity: p.quantity || 1,
    weight: overrides[p.item_sku] ?? defaultWeight,
  }));
  if (items.length === 0) {
    items.push({
      name: "KORA Rental Return",
      value: 500000,
      quantity: 1,
      weight: defaultWeight,
    });
  }

  const res = await getBiteshipRates({
    origin_postal_code: String(ret.pickup_postal_code),
    destination_postal_code: String(showroom.postal_code),
    couriers: RETURN_COURIER_QUERY,
    items,
    origin_coordinate:
      ret.pickup_latitude != null && ret.pickup_longitude != null
        ? {
            latitude: Number(ret.pickup_latitude),
            longitude: Number(ret.pickup_longitude),
          }
        : undefined,
    destination_coordinate:
      showroom.latitude != null && showroom.longitude != null
        ? {
            latitude: Number(showroom.latitude),
            longitude: Number(showroom.longitude),
          }
        : undefined,
  });

  if (!res.success || !res.rates) {
    return { error: res.error || "Could not fetch courier rates." };
  }

  const options: ReturnRateOption[] = res.rates.map((r) => ({
    label: labelForCourier(r.courier_company, r.courier_type),
    price: r.price,
    etd: r.etd || r.duration || "",
    courierCompany: r.courier_company,
    courierType: r.courier_type,
  }));

  options.sort((a, b) => a.price - b.price);

  return { success: true, options };
}

/* ── Create return request ───────────────────────────────────────── */

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
  pickup_date?: string | null;
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
    pickup_date: payload.pickup_date || null,
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

/* ── Book reverse courier via Biteship ───────────────────────────── */

/* ── Book reverse courier via Biteship ───────────────────────────── */

export type DispatchReturnResult =
  | {
      success: true;
      waybill: string;
      trackingUrl: string | null;
      price: number | null;
    }
  | {
      error: string;
      /** True when the failure is "courier can't do scheduled" — UI offers Try as Instant. */
      retryAsInstant?: boolean;
    };

export async function dispatchReturnViaBiteship(
  returnId: string,
  courier: { company: string; type: string },
  options?: { forceInstant?: boolean },
): Promise<DispatchReturnResult> {
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
  if (!showroom?.street_address || !showroom?.latitude || !showroom?.longitude) {
    return { error: "Showroom return destination is not fully configured." };
  }

  if (
    ["gojek", "grab"].includes(courier.company) &&
    (ret.pickup_latitude === null ||
      ret.pickup_latitude === undefined ||
      ret.pickup_longitude === null ||
      ret.pickup_longitude === undefined)
  ) {
    return { error: "Instant courier requires customer pickup coordinates." };
  }

  // Decide delivery_type from the customer's chosen pickup_date.
  //
  //   pickup_date = today or earlier  → "now"       (immediate pickup)
  //   pickup_date = future            → "scheduled" (advance booking)
  //   forceInstant = true             → "now"       (admin override — some
  //                                                  couriers reject scheduled)
  const todayStr = new Date().toISOString().split("T")[0];
  const requestedDate = ret.pickup_date
    ? String(ret.pickup_date).split("T")[0]
    : null;
  const isImmediateDate = !requestedDate || requestedDate <= todayStr;
  const wantsScheduled = !isImmediateDate && !options?.forceInstant;
  const deliveryType: "now" | "scheduled" = wantsScheduled
    ? "scheduled"
    : "now";
  const deliveryDate = wantsScheduled ? requestedDate : undefined;

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
    courier_company: courier.company,
    courier_type: courier.type,
    delivery_type: deliveryType,
    delivery_date: deliveryDate,
    reference_id: `RET-${ret.order_id}`,
    items,
    note: `KORA Return ${ret.order_id} - Studio Receiving`,
  });

  if (!biteshipRes.success) {
    const rawError = biteshipRes.error || "";

    // Same "can't do scheduled" detection as the outbound flow — some
    // couriers (GoSend, GrabExpress, most instant tiers) reject advance
    // bookings with this exact message.
    const scheduledBlocked =
      /not available for scheduled delivery/i.test(rawError) ||
      /scheduled delivery/i.test(rawError);

    let friendlyError = rawError;
    if (scheduledBlocked) {
      friendlyError =
        `${courier.company.toUpperCase()} — ${courier.type.toUpperCase()} doesn't accept advance bookings (pickup scheduled for ${requestedDate}). ` +
        `Either click "Try as Instant" below to dispatch right now, or pick a different courier that supports scheduled pickups (JNE, SiCepat, Paxel, Anteraja, Ninja, POS, TIKI).`;
    }

    console.error("[Biteship] Return dispatch failed:", {
      returnId,
      courier: `${courier.company}/${courier.type}`,
      deliveryType,
      pickupDate: requestedDate,
      error: rawError,
    });

    return {
      error: friendlyError,
      retryAsInstant: scheduledBlocked,
    };
  }

  const resi =
    biteshipRes.waybill_id ||
    biteshipRes.tracking_id ||
    `RET-WYB-${Date.now()}`;
  const trackingUrl =
    biteshipRes.courier?.link ||
    (biteshipRes.tracking_id
      ? `https://track.biteship.com/${biteshipRes.tracking_id}`
      : null);

  const { error: upErr } = await supabase
    .from("returns")
    .update({
      status: "Shipping",
      courier_company: courier.company,
      courier_type: courier.type,
      waybill_id: resi,
      biteship_order_id: biteshipRes.id || null,
      tracking_url: trackingUrl,
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
    details: {
      courier: courier.company,
      type: courier.type,
      delivery_type: deliveryType,
      delivery_date: deliveryDate ?? null,
      customer_pickup_date: requestedDate,
      forced_instant: Boolean(options?.forceInstant),
      price: biteshipRes.price ?? null,
    },
  });

  revalidatePath("/admin/returns");
  revalidatePath(`/admin/returns/${returnId}`);
  return {
    success: true,
    waybill: resi,
    trackingUrl,
    price: biteshipRes.price ?? null,
  };
}

/* ── Save manual resi ────────────────────────────────────────────── */

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

/* ── Mark received ───────────────────────────────────────────────── */

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

/* ── Start QC ────────────────────────────────────────────────────── */

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

/* ── Release deposit ─────────────────────────────────────────────── */

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
    .select(
      "*, orders(id, return_date, order_products(item_sku)), customers(id, first_name, last_name, phone)",
    )
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

  const customer = (ret as any).customers as
    | { first_name?: string; last_name?: string; phone?: string }
    | undefined;

  if (customer?.phone) {
    const customerName =
      `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
      "there";

    const qcParts: string[] = [];
    if (payload.has_stains) qcParts.push("stains");
    if (payload.has_damage) qcParts.push("damage");
    if (payload.is_incomplete) qcParts.push("missing items");
    if (payload.has_odor) qcParts.push("odor");

    const qcSummary =
      qcParts.length > 0
        ? `QC notes: ${qcParts.join(", ")}. Deduction: ${formatRupiah(qcDeduction)}.`
        : "All items passed QC — no deductions.";

    try {
      const { emitWa } = await import("@/lib/notifications");
      await emitWa(supabase, admin, {
        entity: "return",
        entityId: returnId,
        kind: "deposit_refunded",
        to: customer.phone,
        vars: {
          CUSTOMER_NAME: customerName,
          REFUND_AMOUNT: formatRupiah(netRefund),
          QC_SUMMARY: qcSummary,
        },
        fallbackTemplate:
          "Hi [CUSTOMER_NAME], your deposit refund of [REFUND_AMOUNT] has been transferred. [QC_SUMMARY] Thank you for choosing KORA!",
      });
    } catch {
      // Non-blocking
    }
  }

  revalidatePath("/admin/returns");
  revalidatePath(`/admin/returns/${returnId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/inventory");

  return { success: true };
}

/* ── Log note ────────────────────────────────────────────────────── */

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

/* ── Remind customer ─────────────────────────────────────────────── */

export async function remindReturnCustomer(returnId: string) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Unauthorized: Session not found." };

  const { data: ret } = await supabase
    .from("returns")
    .select("*, customers(first_name, last_name, phone), orders(id, return_date)")
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
      kind: "return_reminder",
      to: phone,
      vars: {
        CUSTOMER_NAME:
          `${ret.customers?.first_name || ""} ${ret.customers?.last_name || ""}`.trim(),
        ORDER_ID: ret.orders?.id || "",
        RETURN_DATE: ret.orders?.return_date || "",
        RETURN_DEADLINE: ret.orders?.return_date || "",
      },
      fallbackTemplate:
        "Hi [CUSTOMER_NAME], gentle reminder to return your rental for order [ORDER_ID] by [RETURN_DATE].",
    });
    revalidatePath(`/admin/returns/${returnId}`);
    return { success: true, waUrl: res.waUrl, sent: res.sent };
  } catch (e: any) {
    return { error: e.message };
  }
}

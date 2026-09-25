// Single source of truth for order-status side effects.
// TODO(schema): true transactions + advisory locks would replace the shims here.

import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type Admin = { id: string; name: string; role: string };

export const RESERVING_STATUSES = ["Ordered", "In Shipping", "Active"] as const;
export const RELEASING_STATUSES = ["Draft", "Cancelled", "Completed"] as const;

export function shouldReserveItems(status: string): boolean {
  return (RESERVING_STATUSES as readonly string[]).includes(status);
}
export function shouldReleaseItems(status: string): boolean {
  return (RELEASING_STATUSES as readonly string[]).includes(status);
}
export function isCommittable(status: string): boolean {
  return status !== "Draft" && status !== "Cancelled";
}

export interface SideEffectContext {
  orderId: string;
  prevStatus: string;
  newStatus: string;
  skus: string[];
  pickupDate?: string | null;
  returnDate?: string | null;
  prevCustomerId?: string | null;
  newCustomerId?: string | null;
  prevCreditApplied: number;
  newCreditApplied: number;
}

// -----------------------------------------------------------------------------
// GUARD: availability (turnaround buffer overlap + arch/repair)
// -----------------------------------------------------------------------------
export async function guardAvailability(
  supabase: SupabaseClient,
  orderId: string,
  skus: string[],
  pickupDate?: string | null,
  returnDate?: string | null,
): Promise<{ error?: string }> {
  if (skus.length === 0) return {};

  const { data: itemsData } = await supabase
    .from("items")
    .select(
      "sku, name, status, is_archived, buffer_override, types(default_buffer_days)",
    )
    .in("sku", skus);

  for (const item of itemsData || []) {
    if (item.is_archived) {
      return {
        error: `Item "${item.sku}" (${item.name}) is archived and cannot be booked.`,
      };
    }
    if (item.status === "Under Repair") {
      return {
        error: `Item "${item.sku}" (${item.name}) is currently Under Repair.`,
      };
    }
  }

  if (!pickupDate || !returnDate) return {};

  const { data: conflicting } = await supabase
    .from("order_products")
    .select("item_sku, orders!inner(id, pickup_date, return_date, status)")
    .in("item_sku", skus)
    .neq("orders.id", orderId)
    .not("orders.status", "in", '("Cancelled", "Draft")');

  if (!conflicting || conflicting.length === 0) return {};

  const newPickup = new Date(pickupDate).getTime();
  const newReturn = new Date(returnDate).getTime();

  for (const conf of conflicting) {
    const existing = conf.orders as any;
    if (!existing.pickup_date || !existing.return_date) continue;
    const meta = itemsData?.find((i: any) => i.sku === conf.item_sku);
    const bufferDays =
      meta?.buffer_override ?? (meta?.types as any)?.default_buffer_days ?? 2;
    const existStart = new Date(existing.pickup_date).getTime();
    const existEnd = new Date(existing.return_date);
    existEnd.setDate(existEnd.getDate() + bufferDays);
    const existEndWithBuffer = existEnd.getTime();

    if (newPickup <= existEndWithBuffer && newReturn >= existStart) {
      return {
        error: `Item "${conf.item_sku}" (${meta?.name || "Garment"}) is already reserved by order ${existing.id} from ${existing.pickup_date} until ${existEnd.toISOString().split("T")[0]} (including turnaround buffer).`,
      };
    }
  }
  return {};
}

// -----------------------------------------------------------------------------
// GUARD: credit (server-side clamp — rejects over-spend)
// -----------------------------------------------------------------------------
export async function guardCredit(
  supabase: SupabaseClient,
  customerId: string,
  requested: number,
  alreadyDeducted: number,
): Promise<{ error?: string }> {
  if (!customerId || requested <= alreadyDeducted) return {};
  const { data: cust } = await supabase
    .from("customers")
    .select("current_credit")
    .eq("id", customerId)
    .single();
  const available = Number(cust?.current_credit) || 0;
  if (requested - alreadyDeducted > available) {
    return {
      error: `Store credit requested (${requested - alreadyDeducted}) exceeds available (${available}).`,
    };
  }
  return {};
}

// -----------------------------------------------------------------------------
// GUARD: can dispatch (idempotency + booking window)
// -----------------------------------------------------------------------------
export async function guardCanDispatch(
  supabase: SupabaseClient,
  orderId: string,
): Promise<{ error?: string; order?: any }> {
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, status, packing_slip_id, pickup_date, order_method, pick_up_method, street_address, city, postal_code, latitude, longitude, customers(first_name, last_name, phone, status)",
    )
    .eq("id", orderId)
    .single();

  if (!order) return { error: `Order ${orderId} not found.` };

  if (
    order.packing_slip_id &&
    ["In Shipping", "Active", "Completed"].includes(order.status)
  ) {
    return {
      error: `Order already dispatched (waybill: ${order.packing_slip_id}).`,
    };
  }

  const { data: settings } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "shipping")
    .single();
  const windowDays = Number(settings?.value?.booking_window_days ?? 3);

  if (order.pickup_date) {
    const [py, pm, pd] = order.pickup_date.split("-").map(Number);
    const pickup = new Date(py, pm - 1, pd);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    pickup.setHours(0, 0, 0, 0);
    const days = Math.round((pickup.getTime() - today.getTime()) / 86400000);
    if (days > windowDays) {
      pickup.setDate(pickup.getDate() - windowDays);
      return {
        error: `Booking window not open yet. Bookable from ${pickup.toISOString().split("T")[0]} (${windowDays} days before pickup).`,
      };
    }
  }
  return { order };
}

// -----------------------------------------------------------------------------
// GUARD: can cancel website orders (superadmin-only configurable)
// -----------------------------------------------------------------------------
export async function guardCanCancelWebsite(
  supabase: SupabaseClient,
  orderMethod: string,
  admin: Admin,
): Promise<{ error?: string }> {
  if (orderMethod !== "Website") return {};
  const { data: perm } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "permissions")
    .single();
  const rule = perm?.value?.cancel_website_orders ?? "superadmin_only";
  const isSuper =
    admin.role?.toLowerCase().replace(/[\s_-]+/g, "") === "superadmin";
  if (rule === "superadmin_only" && !isSuper) {
    return {
      error:
        "Only superadmins can cancel website orders. Use the gateway refund process.",
    };
  }
  return {};
}

// -----------------------------------------------------------------------------
// SIDE EFFECT: item status sync (safe across concurrent orders)
// -----------------------------------------------------------------------------
async function syncItemStatus(
  supabase: SupabaseClient,
  skus: string[],
  newStatus: string,
  excludeOrderId: string,
): Promise<void> {
  if (skus.length === 0) return;

  if (shouldReserveItems(newStatus)) {
    await supabase
      .from("items")
      .update({ status: "Unavailable" })
      .in("sku", skus);
    return;
  }
  if (!shouldReleaseItems(newStatus)) return;

  // Only release SKUs that are not reserved by any other active order.
  const { data: active } = await supabase
    .from("order_products")
    .select("item_sku, orders!inner(id, status)")
    .in("item_sku", skus)
    .neq("orders.id", excludeOrderId)
    .in("orders.status", ["Ordered", "In Shipping", "Active"]);

  const busy = new Set((active || []).map((r: any) => r.item_sku));
  const releasable = skus.filter((s) => !busy.has(s));
  if (releasable.length > 0) {
    await supabase
      .from("items")
      .update({ status: "Available" })
      .in("sku", releasable);
  }
}

// -----------------------------------------------------------------------------
// SIDE EFFECT: fitting eviction (with per-fitting status transition)
// -----------------------------------------------------------------------------
async function evictFittings(
  supabase: SupabaseClient,
  orderId: string,
  skus: string[],
  pickupDate: string,
  returnDate: string,
): Promise<void> {
  if (skus.length === 0) return;

  const { data: itemsData } = await supabase
    .from("items")
    .select("sku, buffer_override, types(default_buffer_days)")
    .in("sku", skus);

  let maxBuffer = 2;
  for (const it of itemsData || []) {
    const b = it.buffer_override ?? (it.types as any)?.default_buffer_days ?? 2;
    if (b > maxBuffer) maxBuffer = b;
  }

  const endWithBuffer = new Date(returnDate);
  endWithBuffer.setDate(endWithBuffer.getDate() + maxBuffer);
  const endStr = endWithBuffer.toISOString().split("T")[0];

  const { data: colliding } = await supabase
    .from("fitting_items")
    .select("id, fitting_id, item_sku, fittings!inner(id, date, status)")
    .in("item_sku", skus)
    .eq("is_evicted", false)
    .gte("fittings.date", pickupDate)
    .lte("fittings.date", endStr)
    .not(
      "fittings.status",
      "in",
      '("Cancelled", "Conflict Evicted", "Completed")',
    );

  if (!colliding || colliding.length === 0) return;

  const impacted = new Set<string>();
  for (const ci of colliding) {
    await supabase
      .from("fitting_items")
      .update({
        is_evicted: true,
        evicted_by_order_id: orderId,
        eviction_reason: `Rented out in Order ${orderId} (${pickupDate} - ${returnDate})`,
      })
      .eq("id", ci.id);
    impacted.add(ci.fitting_id);
  }
  for (const fitId of Array.from(impacted)) {
    const { data: all } = await supabase
      .from("fitting_items")
      .select("id, is_evicted")
      .eq("fitting_id", fitId);
    const activeCount = (all || []).filter((i: any) => !i.is_evicted).length;

    if (activeCount === 0) {
      // Fetch the fitting's payment state to decide refund
      const { data: fitRow } = await supabase
        .from("fittings")
        .select("fee_payment_status, after_hours_fee")
        .eq("id", fitId)
        .single();

      const wasPaid = fitRow?.fee_payment_status === "Paid";
      const refundAmount = wasPaid ? Number(fitRow.after_hours_fee) || 0 : 0;

      await supabase
        .from("fittings")
        .update({
          status: "Conflict Evicted",
          conflict_notes: `All items checked out in paid orders (last evicted by ${orderId}). Showroom slot freed.`,
          refund_status: wasPaid ? "Pending" : "n/a",
          refund_amount: refundAmount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", fitId);

      await supabase.from("admin_audit_logs").insert({
        admin_id: null,
        admin_name: "Automation",
        entity_type: "fitting",
        entity_id: fitId,
        action_type: "CONFLICT_EVICTION",
        field_name: "status",
        new_value: "Conflict Evicted",
        details: {
          evicted_by_order: orderId,
          refund_owed: wasPaid,
          refund_amount: refundAmount,
        },
      });
    }
  }
}

// -----------------------------------------------------------------------------
// SIDE EFFECT: unevict fittings (called on order Cancelled)
// -----------------------------------------------------------------------------
async function unevictFittings(
  supabase: SupabaseClient,
  orderId: string,
): Promise<void> {
  const { data: evicted } = await supabase
    .from("fitting_items")
    .select("id, fitting_id, fittings!inner(id, date, status)")
    .eq("evicted_by_order_id", orderId)
    .eq("is_evicted", true);

  if (!evicted || evicted.length === 0) return;

  const today = new Date().toISOString().split("T")[0];
  const impacted = new Set<string>();

  for (const ei of evicted) {
    const fit = ei.fittings as any;
    if (!fit || fit.date < today) continue;
    await supabase
      .from("fitting_items")
      .update({
        is_evicted: false,
        evicted_by_order_id: null,
        eviction_reason: null,
      })
      .eq("id", ei.id);
    impacted.add(ei.fitting_id);
  }

  for (const fitId of Array.from(impacted)) {
    await supabase
      .from("fittings")
      .update({
        status: "Confirmed",
        conflict_notes: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", fitId);
    await supabase.from("admin_audit_logs").insert({
      admin_id: null,
      admin_name: "Automation",
      entity_type: "fitting",
      entity_id: fitId,
      action_type: "CONFLICT_UNEVICTION",
      field_name: "status",
      new_value: "Confirmed",
      details: { unevicted_by_order: orderId },
    });
  }
}

// -----------------------------------------------------------------------------
// SIDE EFFECT: credit reconciliation (delta-based)
// -----------------------------------------------------------------------------
async function reconcileCredit(
  supabase: SupabaseClient,
  orderId: string,
  prevCustomerId: string | null | undefined,
  newCustomerId: string | null | undefined,
  prevApplied: number,
  newApplied: number,
): Promise<void> {
  // Full customer reassignment: refund old, deduct from new.
  if (prevCustomerId && newCustomerId && prevCustomerId !== newCustomerId) {
    if (prevApplied > 0) {
      const { data: prev } = await supabase
        .from("customers")
        .select("current_credit")
        .eq("id", prevCustomerId)
        .single();
      if (prev) {
        await supabase
          .from("customers")
          .update({ current_credit: Number(prev.current_credit) + prevApplied })
          .eq("id", prevCustomerId);
        await supabase.from("credit_logs").insert({
          customer_id: prevCustomerId,
          movement: "credit_in",
          ref: orderId,
          method: "Customer Reassignment Refund",
          amount: prevApplied,
        });
      }
    }
    if (newApplied > 0) {
      const { data: nw } = await supabase
        .from("customers")
        .select("current_credit")
        .eq("id", newCustomerId)
        .single();
      if (nw) {
        const updated = Math.max(0, Number(nw.current_credit) - newApplied);
        await supabase
          .from("customers")
          .update({ current_credit: updated })
          .eq("id", newCustomerId);
        await supabase.from("credit_logs").insert({
          customer_id: newCustomerId,
          movement: "credit_applied",
          ref: orderId,
          method: "Order Checkout",
          amount: newApplied,
        });
      }
    }
    return;
  }

  if (!newCustomerId) return;
  const delta = newApplied - prevApplied;
  if (delta === 0) return;

  const { data: cust } = await supabase
    .from("customers")
    .select("current_credit")
    .eq("id", newCustomerId)
    .single();
  if (!cust) return;

  const updated = Math.max(0, Number(cust.current_credit) - delta);
  await supabase
    .from("customers")
    .update({ current_credit: updated })
    .eq("id", newCustomerId);
  await supabase.from("credit_logs").insert({
    customer_id: newCustomerId,
    movement: delta > 0 ? "credit_applied" : "credit_in",
    ref: orderId,
    method: "Order Checkout Adjustment",
    amount: Math.abs(delta),
  });
}

// -----------------------------------------------------------------------------
// SIDE EFFECT: auto-create return record when order becomes Active
// -----------------------------------------------------------------------------
async function autoCreateReturn(
  supabase: SupabaseClient,
  orderId: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from("returns")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle();
  if (existing) return;

  const { data: settings } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "orders")
    .single();
  if (settings?.value?.auto_create_return_on_active === false) return;

  const { data: order } = await supabase
    .from("orders")
    .select("*, customers(id, first_name, last_name, phone, addresses(*))")
    .eq("id", orderId)
    .single();
  if (!order) return;

  const customerName =
    `${order.customers?.first_name || ""} ${order.customers?.last_name || ""}`.trim();
  const returnId = `RET-${order.id}`;

  await supabase.from("returns").insert({
    id: returnId,
    order_id: order.id,
    customer_id: order.customer_id,
    status: "Requested",
    return_method: "KORA arranges pickup (Biteship)",
    request_source: "Automation",
    pickup_label: "Home",
    pickup_recipient_name: customerName,
    pickup_phone: order.customers?.phone || "",
    pickup_street_address: order.street_address,
    pickup_city: order.city,
    pickup_postal_code: order.postal_code,
    pickup_latitude: order.latitude ?? null,
    pickup_longitude: order.longitude ?? null,
    deposit_held: Number(order.total_deposit) || 0,
    refund_amount: Number(order.total_deposit) || 0,
  });
  await supabase.from("admin_audit_logs").insert({
    admin_id: null,
    admin_name: "Automation",
    entity_type: "return",
    entity_id: returnId,
    action_type: "AUTO_CREATE_RETURN",
    field_name: "status",
    new_value: "Requested",
  });
}

// -----------------------------------------------------------------------------
// SIDE EFFECT: per-SKU audit log for item availability flips
// -----------------------------------------------------------------------------
async function logItemFlips(
  supabase: SupabaseClient,
  admin: Admin,
  orderId: string,
  skus: string[],
  from: string,
  to: string,
): Promise<void> {
  if (skus.length === 0) return;
  await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: "order",
    entity_id: orderId,
    action_type: "ITEM_STATUS_SYNC",
    field_name: "items.status",
    old_value: from,
    new_value: to,
    details: { skus },
  });
}

// -----------------------------------------------------------------------------
// PUBLIC: apply all side effects for a status transition
// -----------------------------------------------------------------------------
export async function applyOrderSideEffects(
  supabase: SupabaseClient,
  admin: Admin,
  ctx: SideEffectContext,
): Promise<void> {
  const { orderId, prevStatus, newStatus, skus } = ctx;

  const wasReserving = shouldReserveItems(prevStatus);
  const willReserve = shouldReserveItems(newStatus);

  if (willReserve && !wasReserving) {
    await syncItemStatus(supabase, skus, newStatus, orderId);
    await logItemFlips(
      supabase,
      admin,
      orderId,
      skus,
      "Available",
      "Unavailable",
    );
    if (ctx.pickupDate && ctx.returnDate) {
      await evictFittings(
        supabase,
        orderId,
        skus,
        ctx.pickupDate,
        ctx.returnDate,
      );
    }
  } else if (!willReserve && wasReserving) {
    await syncItemStatus(supabase, skus, newStatus, orderId);
    await logItemFlips(
      supabase,
      admin,
      orderId,
      skus,
      "Unavailable",
      "Available",
    );
  }

  if (newStatus === "Cancelled" && prevStatus !== "Cancelled") {
    await unevictFittings(supabase, orderId);
  }

  if (isCommittable(newStatus) || prevStatus === newStatus) {
    // For committed orders, reconcile credit delta. Draft never touches customer balance.
  }
  if (isCommittable(newStatus)) {
    await reconcileCredit(
      supabase,
      orderId,
      ctx.prevCustomerId,
      ctx.newCustomerId,
      ctx.prevCreditApplied,
      ctx.newCreditApplied,
    );
  }

  if (newStatus === "Active" && prevStatus !== "Active") {
    await autoCreateReturn(supabase, orderId);
  }
}

// -----------------------------------------------------------------------------
// PUBLIC: snapshot reader for saveOrder restore
// -----------------------------------------------------------------------------
export async function snapshotOrder(supabase: SupabaseClient, orderId: string) {
  const [{ data: order }, { data: products }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", orderId).single(),
    supabase.from("order_products").select("*").eq("order_id", orderId),
  ]);
  return { order, products: products || [] };
}

export async function restoreOrder(
  supabase: SupabaseClient,
  snap: { order: any; products: any[] },
): Promise<void> {
  if (!snap.order) return;
  const { id, created_at, ...rest } = snap.order;
  await supabase.from("orders").update(rest).eq("id", id);
  await supabase.from("order_products").delete().eq("order_id", id);
  if (snap.products.length > 0) {
    await supabase.from("order_products").insert(snap.products);
  }
}

// -----------------------------------------------------------------------------
// PUBLIC: notification markers via audit log
// -----------------------------------------------------------------------------
export async function markNotification(
  supabase: SupabaseClient,
  admin: Admin | null,
  entityType: "order" | "return" | "fitting",
  entityId: string,
  kind: string,
  value: string,
): Promise<void> {
  await supabase.from("admin_audit_logs").insert({
    admin_id: admin?.id ?? null,
    admin_name: admin?.name ?? "Automation",
    entity_type: entityType,
    entity_id: entityId,
    action_type: "WA_DISPATCHED",
    field_name: kind,
    new_value: value,
  });
}

export async function hasNotification(
  supabase: SupabaseClient,
  entityType: string,
  entityId: string,
  kind: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("admin_audit_logs")
    .select("id")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("action_type", "WA_DISPATCHED")
    .eq("field_name", kind)
    .limit(1);
  return (data || []).length > 0;
}

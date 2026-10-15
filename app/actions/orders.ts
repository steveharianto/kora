"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "./auth";
import { revalidatePath } from "next/cache";
import {
  guardAvailability,
  guardCredit,
  guardCanCancelWebsite,
  applyOrderSideEffects,
  isCommittable,
  snapshotOrder,
  restoreOrder,
  isUniqueViolation,
} from "@/lib/orderLifecycle";
import { emitWa } from "@/lib/notifications";
import { formatRupiah } from "@/lib/utils";

export async function getNextManualOrderId(): Promise<string> {
  const supabase = await createClient();
  const staleCutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  await supabase
    .from("admin_audit_logs")
    .delete()
    .eq("action_type", "AVAILABILITY_LOCK")
    .lt("created_at", staleCutoff);

  const { data } = await supabase
    .from("orders")
    .select("id")
    .like("id", "M%")
    .order("id", { ascending: false })
    .limit(1);

  if (!data || data.length === 0) return "M0101";
  const lastId = data[0].id;
  const num = parseInt(lastId.replace(/\D/g, ""), 10);
  if (isNaN(num)) return "M0101";
  return `M${String(num + 1).padStart(4, "0")}`;
}

export async function createOrderDraft(): Promise<{
  orderId?: string;
  error?: string;
}> {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Unauthorized: Session not found." };

  let orderId: string | null = null;
  let lastErr: any = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = await getNextManualOrderId();
    const { error } = await supabase.from("orders").insert({
      id: candidate,
      order_date: new Date().toISOString().split("T")[0],
      order_method: "Manual",
      status: "Draft",
      event_days: 1,
      shipping_fee: 0,
      store_credit_applied: 0,
      total_price: 0,
      total_deposit: 0,
      total: 0,
      pick_up_method: "Self pickup",
      payment_method: "QRIS (EDC)",
    });

    if (!error) {
      orderId = candidate;
      break;
    }
    if (!isUniqueViolation(error)) return { error: error.message };
    lastErr = error;
  }

  if (!orderId) {
    return {
      error:
        lastErr?.message ||
        "Could not allocate a unique order ID after 5 attempts.",
    };
  }

  await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: "order",
    entity_id: orderId,
    action_type: "CREATE_DRAFT",
    field_name: "all",
  });

  revalidatePath("/admin/orders");
  return { orderId };
}

async function acquireLock(
  supabase: any,
  orderId: string,
  skus: string[],
  adminId: string,
): Promise<string> {
  const key = `LOCK-${orderId}-${skus.sort().join("_")}`;
  await supabase.from("admin_audit_logs").insert({
    admin_id: adminId,
    admin_name: "Availability Lock",
    entity_type: "order",
    entity_id: key,
    action_type: "AVAILABILITY_LOCK",
    field_name: "lock",
  });
  return key;
}

async function releaseLock(supabase: any, lockKey: string) {
  await supabase
    .from("admin_audit_logs")
    .delete()
    .eq("action_type", "AVAILABILITY_LOCK")
    .eq("entity_id", lockKey);
}

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
    addOnPrice?: number;
    days?: number;
  }[];
}) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Unauthorized: Session not found." };

  const validSkus = orderData.products.map((p) => p.item_sku).filter(Boolean);
  const targetStatus = orderData.status || "Draft";
  const isReserving = ["Ordered", "In Shipping", "Active"].includes(
    targetStatus,
  );
  const isCommittableStatus = isCommittable(targetStatus);

  const snap = await snapshotOrder(supabase, orderData.id, validSkus, [
    null,
    orderData.customer_id,
  ]);
  const prevOrder = snap.order;
  if (!prevOrder) return { error: "Order not found." };

  if (
    prevOrder.customer_id &&
    prevOrder.customer_id !== orderData.customer_id
  ) {
    const reSnap = await snapshotOrder(supabase, orderData.id, validSkus, [
      prevOrder.customer_id,
      orderData.customer_id,
    ]);
    Object.assign(snap, reSnap);
  }

  const prevCredit = Number(prevOrder.store_credit_applied) || 0;
  const newCredit = Number(orderData.store_credit_applied) || 0;

  let lockKey: string | null = null;
  try {
    if (isReserving) {
      if (orderData.pickup_date && orderData.return_date) {
        lockKey = await acquireLock(
          supabase,
          orderData.id,
          validSkus,
          admin.id,
        );
      }
      const av = await guardAvailability(
        supabase,
        orderData.id,
        validSkus,
        orderData.pickup_date,
        orderData.return_date,
      );
      if (av.error) return { error: av.error };
    }
    if (isCommittableStatus && orderData.customer_id) {
      const cr = await guardCredit(
        supabase,
        orderData.customer_id,
        newCredit,
        prevOrder.customer_id === orderData.customer_id ? prevCredit : 0,
      );
      if (cr.error) return { error: cr.error };
    }

    const distinctSkus = Array.from(
      new Set(orderData.products.map((p) => p.item_sku).filter(Boolean)),
    );

    const { data: itemRows } = await supabase
      .from("items")
      .select("sku, rental_price, add_on_price")
      .in("sku", distinctSkus);

    const priceMap = new Map<string, { base: number; addOn: number }>();
    for (const row of itemRows || []) {
      const base = Number(row.rental_price) || 0;
      const addOn = row.add_on_price != null ? Number(row.add_on_price) : base;
      priceMap.set(row.sku, { base, addOn });
    }

    let subtotalPrice = 0;
    let subtotalDeposit = 0;
    const pricedRows: Array<{
      item_sku: string;
      quantity: number;
      price: number;
      base_price: number;
      add_on_price: number;
      days: number;
      deposit: number;
      subtotal: number;
    }> = [];

    for (const p of orderData.products) {
      if (!p.item_sku) continue;
      const info = priceMap.get(p.item_sku);
      if (!info) {
        throw new Error(
          `Item "${p.item_sku}" is not in the catalog and cannot be priced.`,
        );
      }
      const qty = Math.max(1, Number(p.quantity) || 1);
      const days = Math.max(1, Number(p.days) || 1);
      const unit = info.base + info.addOn * (days - 1);
      const lineTotal = unit * qty;
      const deposit = info.base > 1000000 ? 250000 : 150000;

      subtotalPrice += lineTotal;
      subtotalDeposit += deposit * qty;

      pricedRows.push({
        item_sku: p.item_sku,
        quantity: qty,
        price: unit,
        base_price: info.base,
        add_on_price: info.addOn,
        days,
        deposit,
        subtotal: lineTotal,
      });
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[saveOrder] server recalc", {
        orderId: orderData.id,
        lines: pricedRows,
        subtotalPrice,
        subtotalDeposit,
      });
    }

    const shippingFee = Number(orderData.shipping_fee) || 0;
    const grandTotal = Math.max(
      0,
      subtotalPrice + subtotalDeposit + shippingFee - newCredit,
    );

    const { error: orderErr } = await supabase
      .from("orders")
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
        order_method: orderData.order_method || "Manual",
        status: targetStatus,
        pick_up_method: orderData.pick_up_method || null,
        packing_slip_id: orderData.packing_slip_id || null,
        payment_method: orderData.payment_method || null,
        total_price: subtotalPrice,
        total_deposit: subtotalDeposit,
        shipping_fee: shippingFee,
        store_credit_applied: newCredit,
        total: grandTotal,
      })
      .eq("id", orderData.id);
    if (orderErr) throw new Error(orderErr.message);

    await supabase.from("order_products").delete().eq("order_id", orderData.id);
    if (pricedRows.length > 0) {
      const { error: pErr } = await supabase
        .from("order_products")
        .insert(pricedRows.map((r) => ({ order_id: orderData.id, ...r })));
      if (pErr) throw new Error(pErr.message);
    }

    await applyOrderSideEffects(supabase, admin, {
      orderId: orderData.id,
      prevStatus: prevOrder.status,
      newStatus: targetStatus,
      skus: pricedRows.map((r) => r.item_sku),
      pickupDate: orderData.pickup_date,
      returnDate: orderData.return_date,
      prevCustomerId: prevOrder.customer_id,
      newCustomerId: orderData.customer_id,
      prevCreditApplied: prevCredit,
      newCreditApplied: newCredit,
    });

    await supabase.from("admin_audit_logs").insert({
      admin_id: admin.id,
      admin_name: admin.name,
      entity_type: "order",
      entity_id: orderData.id,
      action_type: "SAVE_ORDER",
      field_name: "all",
    });
  } catch (e: any) {
    await restoreOrder(supabase, snap);
    return { error: e.message || "Failed to save order." };
  } finally {
    if (lockKey) await releaseLock(supabase, lockKey);
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderData.id}`);
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/fittings");
  return { success: true };
}

export async function updateOrderStatus(orderId: string, newStatus: string) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Unauthorized: Session not found." };

  const { data: currentOrder } = await supabase
    .from("orders")
    .select(
      `status, order_method, customer_id, store_credit_applied, pickup_date, return_date,
       order_products(item_sku)`,
    )
    .eq("id", orderId)
    .single();
  if (!currentOrder) return { error: "Order not found." };

  const isSuper =
    admin.role?.toLowerCase().replace(/[\s_-]+/g, "") === "superadmin";

  if (newStatus === "Draft") {
    if (currentOrder.order_method === "Website") {
      return { error: "Website orders cannot be reset to draft." };
    }
    if (!isSuper) {
      const { data: perm } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "permissions")
        .single();
      if (perm?.value?.reset_order_draft === "superadmin_only") {
        return {
          error: "Unauthorized: Only superadmins can reset orders to draft.",
        };
      }
    }
  }

  if (newStatus === "Cancelled") {
    const cw = await guardCanCancelWebsite(
      supabase,
      currentOrder.order_method,
      admin,
    );
    if (cw.error) return { error: cw.error };
  }

  const skus = (currentOrder.order_products || [])
    .map((op: any) => op.item_sku)
    .filter(Boolean);

  const snap = await snapshotOrder(supabase, orderId, skus, [
    currentOrder.customer_id,
  ]);

  const wasReserving = ["Ordered", "In Shipping", "Active"].includes(
    currentOrder.status,
  );
  const willReserve = ["Ordered", "In Shipping", "Active"].includes(newStatus);
  let lockKey: string | null = null;
  if (willReserve && !wasReserving) {
    if (currentOrder.pickup_date && currentOrder.return_date) {
      lockKey = await acquireLock(supabase, orderId, skus, admin.id);
    }
    const av = await guardAvailability(
      supabase,
      orderId,
      skus,
      currentOrder.pickup_date,
      currentOrder.return_date,
    );
    if (av.error) return { error: av.error };
  }

  try {
    if (
      newStatus === "Cancelled" &&
      currentOrder.status !== "Cancelled" &&
      Number(currentOrder.store_credit_applied) > 0 &&
      currentOrder.customer_id
    ) {
      const { data: cust } = await supabase
        .from("customers")
        .select("current_credit")
        .eq("id", currentOrder.customer_id)
        .single();
      if (cust) {
        await supabase
          .from("customers")
          .update({
            current_credit:
              Number(cust.current_credit) +
              Number(currentOrder.store_credit_applied),
          })
          .eq("id", currentOrder.customer_id);
        await supabase.from("credit_logs").insert({
          customer_id: currentOrder.customer_id,
          movement: "credit_in",
          ref: orderId,
          method: "Cancellation Refund",
          amount: Number(currentOrder.store_credit_applied),
        });
        await supabase
          .from("orders")
          .update({ store_credit_applied: 0 })
          .eq("id", orderId);
      }
    }

    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);
    if (error) throw new Error(error.message);

    if (newStatus !== "Cancelled") {
      await applyOrderSideEffects(supabase, admin, {
        orderId,
        prevStatus: currentOrder.status,
        newStatus,
        skus,
        pickupDate: currentOrder.pickup_date,
        returnDate: currentOrder.return_date,
        prevCustomerId: currentOrder.customer_id,
        newCustomerId: currentOrder.customer_id,
        prevCreditApplied: Number(currentOrder.store_credit_applied) || 0,
        newCreditApplied: Number(currentOrder.store_credit_applied) || 0,
      });
    } else {
      await applyOrderSideEffects(supabase, admin, {
        orderId,
        prevStatus: currentOrder.status,
        newStatus,
        skus,
        pickupDate: currentOrder.pickup_date,
        returnDate: currentOrder.return_date,
        prevCustomerId: null,
        newCustomerId: null,
        prevCreditApplied: 0,
        newCreditApplied: 0,
      });
    }

    await supabase.from("admin_audit_logs").insert({
      admin_id: admin.id,
      admin_name: admin.name,
      entity_type: "order",
      entity_id: orderId,
      action_type: "STATUS_CHANGE",
      field_name: "status",
      old_value: currentOrder.status,
      new_value: newStatus,
    });

    if (newStatus === "Ordered") {
      const { data: cust } = await supabase
        .from("customers")
        .select("first_name, last_name, phone")
        .eq("id", currentOrder.customer_id || "")
        .maybeSingle();
      if (cust?.phone) {
        const { data: orderRow } = await supabase
          .from("orders")
          .select("total")
          .eq("id", orderId)
          .single();
        try {
          await emitWa(supabase, admin, {
            entity: "order",
            entityId: orderId,
            kind: "order_posted",
            to: cust.phone,
            vars: {
              CUSTOMER_NAME:
                `${cust.first_name || ""} ${cust.last_name || ""}`.trim(),
              ORDER_ID: orderId,
              TOTAL: formatRupiah(Number(orderRow?.total) || 0),
            },
            fallbackTemplate:
              "Hi [CUSTOMER_NAME], thank you for your order [ORDER_ID]! Total: [TOTAL].",
          });
        } catch {
          // Non-blocking.
        }
      }
    }
  } catch (e: any) {
    await restoreOrder(supabase, snap);
    return { error: e.message };
  } finally {
    if (lockKey) await releaseLock(supabase, lockKey);
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/fittings");
  return { success: true };
}

export async function createCustomerAddress(data: {
  customer_id: string;
  label: string;
  street_address: string;
  city: string;
  postal_code: string;
  latitude?: number | null;
  longitude?: number | null;
  is_default?: boolean;
}) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Unauthorized: Session not found." };

  if (!data.customer_id) return { error: "Customer ID is required." };
  if (!data.street_address || !data.city) {
    return { error: "Street address and City are required." };
  }

  const { count } = await supabase
    .from("addresses")
    .select("*", { count: "exact", head: true })
    .eq("customer_id", data.customer_id);

  const isFirstAddress = (count ?? 0) === 0;
  const finalIsDefault = isFirstAddress || Boolean(data.is_default);

  if (finalIsDefault) {
    await supabase
      .from("addresses")
      .update({ is_default: false })
      .eq("customer_id", data.customer_id);
  }

  const { data: newAddr, error } = await supabase
    .from("addresses")
    .insert({
      customer_id: data.customer_id,
      label: data.label?.trim() || "Home",
      street_address: data.street_address.trim(),
      city: data.city.trim(),
      postal_code: data.postal_code?.trim() || null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      is_default: finalIsDefault,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: "customer",
    entity_id: data.customer_id,
    action_type: "ADD_ADDRESS",
    field_name: "addresses",
    new_value: `${newAddr.label}: ${newAddr.street_address}, ${newAddr.city}`,
  });

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/customers/${data.customer_id}`);

  return { success: true, address: newAddr };
}

export async function addOrderNote(orderId: string, note: string) {
  if (!note.trim()) return { error: "Note cannot be empty." };
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Unauthorized: Session not found." };

  const { error } = await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: "order",
    entity_id: orderId,
    action_type: "ORDER_NOTE",
    field_name: "notes",
    new_value: note.trim(),
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/orders/${orderId}`);
  return { success: true };
}

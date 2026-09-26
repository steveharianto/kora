"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "./auth";
import { createBiteshipOrder } from "@/lib/biteship";
import { revalidatePath } from "next/cache";
import { guardCanDispatch } from "@/lib/orderLifecycle";
import { resolveOutboundCourier } from "@/lib/courierMap";

function stripToLocal(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.startsWith("62")) return "0" + digits.slice(2);
  return digits;
}

export type DispatchOrderResult =
  | {
      success: true;
      waybill: string;
      trackingId: string | null;
      trackingUrl: string | null;
      courierCompany: string;
      courierType: string;
      price: number | null;
    }
  | {
      error: string;
      /** True when the failure is specifically "courier can't do scheduled
       *  delivery" — the UI surfaces a "Try as Instant" retry button. */
      retryAsInstant?: boolean;
    };

export async function dispatchOrderViaBiteship(
  orderId: string,
  options?: { note?: string; forceInstant?: boolean },
): Promise<DispatchOrderResult> {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Unauthorized: Session not found." };

  const guard = await guardCanDispatch(supabase, orderId);
  if (guard.error) return { error: guard.error };
  const order = guard.order;

  if (order.customers?.status !== "Verified") {
    return { error: "Cannot dispatch: Customer KTP is not verified." };
  }
  const methodStr = (order.pick_up_method || "").toLowerCase();
  if (methodStr.includes("self pickup") || methodStr.includes("diambil")) {
    return { error: "Cannot book courier for Self Pickup orders." };
  }
  if (!order.street_address || !order.city) {
    return { error: "Destination address is incomplete on this order." };
  }
  if (
    order.latitude === null ||
    order.latitude === undefined ||
    order.longitude === null ||
    order.longitude === undefined
  ) {
    return { error: "Destination latitude and longitude are missing." };
  }

  const { data: shippingSettings } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "shipping")
    .single();

  const rawOrigin = shippingSettings?.value?.dispatch_addresses?.primary;
  const origin =
    typeof rawOrigin === "object" && rawOrigin !== null ? rawOrigin : null;
  if (!origin) return { error: "Origin showroom address is not configured." };

  if (
    !origin.name ||
    !origin.phone ||
    !origin.street_address ||
    !origin.city ||
    !origin.postal_code ||
    origin.latitude === null ||
    origin.latitude === undefined ||
    origin.longitude === null ||
    origin.longitude === undefined
  ) {
    return {
      error:
        "Origin configuration incomplete. Settings › Shipping requires name, phone, street, city, postal code, latitude, longitude.",
    };
  }

  let codes;
  try {
    codes = resolveOutboundCourier(order.pick_up_method || "");
  } catch (e: any) {
    return { error: e.message };
  }

  const { data: orderProducts } = await supabase
    .from("order_products")
    .select("item_sku, quantity, price, items(name)")
    .eq("order_id", orderId);

  const defaultWeight = Number(
    shippingSettings?.value?.default_item_weight_g ?? 800,
  );
  const overrides: Record<string, number> =
    shippingSettings?.value?.item_weight_overrides ?? {};

  const packageItems = (orderProducts || []).map((op: any) => ({
    name: op.items?.name || op.item_sku,
    value: Number(op.price) || 500000,
    quantity: op.quantity || 1,
    weight: overrides[op.item_sku] ?? defaultWeight,
  }));
  if (packageItems.length === 0) {
    packageItems.push({
      name: `KORA Rental Parcel (${orderId})`,
      value: 1000000,
      quantity: 1,
      weight: defaultWeight,
    });
  }

  const customerName =
    `${order.customers?.first_name || ""} ${order.customers?.last_name || ""}`.trim() ||
    "Customer";

  // delivery_type decision:
  //   pickup today (or unspecified) → "now"
  //   pickup in the future         → "scheduled"
  //   admin explicitly forced      → "now" (escape hatch when scheduled is rejected)
  const todayStr = new Date().toISOString().split("T")[0];
  const isToday = !order.pickup_date || order.pickup_date === todayStr;
  const wantsScheduled = !isToday && !options?.forceInstant;
  const deliveryType: "now" | "scheduled" = wantsScheduled
    ? "scheduled"
    : "now";

  // ── Call Biteship ─────────────────────────────────────────────────────
  let biteshipResult;
  try {
    biteshipResult = await createBiteshipOrder({
      origin: {
        name: origin.name,
        phone: stripToLocal(origin.phone),
        address: `${origin.street_address}, ${origin.city}`,
        postal_code: String(origin.postal_code),
        coordinate: {
          latitude: Number(origin.latitude),
          longitude: Number(origin.longitude),
        },
      },
      destination: {
        name: customerName,
        phone: stripToLocal(order.customers?.phone || ""),
        address: `${order.street_address}, ${order.city}`,
        postal_code: order.postal_code ? String(order.postal_code) : undefined,
        coordinate: {
          latitude: Number(order.latitude),
          longitude: Number(order.longitude),
        },
      },
      courier_company: codes.company,
      courier_type: codes.type,
      delivery_type: deliveryType,
      delivery_date: wantsScheduled ? order.pickup_date : undefined,
      reference_id: orderId,
      items: packageItems,
      note: options?.note || `KORA Rental ${orderId} - Handle with care`,
    });
  } catch (err: any) {
    console.error("[Biteship] Unexpected throw:", err);
    return {
      error: `Unexpected error dispatching via Biteship: ${err?.message || "unknown"}`,
    };
  }

  if (!biteshipResult.success) {
    const rawError = biteshipResult.error || "";

    // Detect the specific "courier can't do scheduled" rejection so the UI
    // can offer a one-click "Try as Instant" fallback.
    const scheduledBlocked =
      /not available for scheduled delivery/i.test(rawError) ||
      /scheduled delivery/i.test(rawError);

    let friendlyError = rawError;
    if (scheduledBlocked) {
      friendlyError =
        `${codes.company.toUpperCase()} — ${codes.type.toUpperCase()} doesn't accept advance bookings (pickup scheduled for ${order.pickup_date}). ` +
        `Either click "Try as Instant" below to dispatch right now, or switch Pick Up Method to Gosend - Instant / Paxel - Medium which support scheduled pickups.`;
    }

    console.error("[Biteship] Dispatch failed:", {
      orderId,
      courier: `${codes.company}/${codes.type}`,
      deliveryType,
      pickupDate: order.pickup_date,
      error: rawError,
    });

    return {
      error: friendlyError,
      retryAsInstant: scheduledBlocked,
    };
  }

  const waybill =
    biteshipResult.waybill_id ||
    biteshipResult.tracking_id ||
    biteshipResult.id ||
    `BTS-${Date.now()}`;

  const trackingId = biteshipResult.tracking_id || null;
  const trackingUrl =
    biteshipResult.courier?.link ||
    (trackingId ? `https://track.biteship.com/${trackingId}` : null);

  const { error: updateErr } = await supabase
    .from("orders")
    .update({
      packing_slip_id: waybill,
      status: "In Shipping",
      return_label_url: trackingUrl,
    })
    .eq("id", orderId);
  if (updateErr) return { error: updateErr.message };

  const skus = (orderProducts || [])
    .map((op: any) => op.item_sku)
    .filter(Boolean);
  if (skus.length > 0) {
    await supabase
      .from("items")
      .update({ status: "Unavailable" })
      .in("sku", skus);
  }

  await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: "order",
    entity_id: orderId,
    action_type: "BITESHIP_DISPATCH",
    field_name: "packing_slip_id",
    new_value: waybill,
    details: {
      courier: codes.company,
      type: codes.type,
      tracking_id: trackingId,
      waybill_id: waybill,
      note: options?.note || null,
      early_dispatch: !isToday,
      delivery_type: deliveryType,
      forced_instant: Boolean(options?.forceInstant),
    },
  });

  // --- WhatsApp notification: package_shipped ------------------------------
  if (order.customers?.phone) {
    try {
      const { emitWa } = await import("@/lib/notifications");
      await emitWa(supabase, admin, {
        entity: "order",
        entityId: orderId,
        kind: "package_shipped",
        to: order.customers.phone,
        vars: {
          CUSTOMER_NAME: customerName,
          ORDER_ID: orderId,
          TRACKING_LINK: trackingUrl || waybill,
        },
        fallbackTemplate:
          "Hi [CUSTOMER_NAME], your order [ORDER_ID] is on its way! Track courier progress here: [TRACKING_LINK].",
      });
    } catch {
      // Non-blocking: dispatch already succeeded, don't roll back on WA failure.
    }
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/inventory");

  return {
    success: true,
    waybill,
    trackingId: biteshipResult.tracking_id || null,
    trackingUrl,
    courierCompany: codes.company,
    courierType: codes.type,
    price: biteshipResult.price ?? null,
  };
}

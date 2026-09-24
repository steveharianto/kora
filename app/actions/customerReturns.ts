"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentCustomer } from "./customerAuth";
import { revalidatePath } from "next/cache";

/* ── KORA arranges pickup ────────────────────────────────────────── */

export async function requestReturn(orderId: string) {
  const session = await getCurrentCustomer();
  if (!session) return { error: "Unauthorized." };

  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(`
      id, status, total_deposit, street_address, city, postal_code,
      latitude, longitude, customer_id
    `)
    .eq("id", orderId)
    .eq("customer_id", session.id)
    .maybeSingle();

  if (!order) return { error: "Order not found." };
  if (order.status !== "Active") {
    return { error: "This order is not eligible for return yet." };
  }

  const { data: existing } = await supabase
    .from("returns")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle();
  if (existing) {
    return { error: "A return has already been initiated for this order." };
  }

  const returnId = `RET-${orderId}`;
  const recipientName =
    `${session.firstName} ${session.lastName || ""}`.trim() || "Customer";

  const { error } = await supabase.from("returns").insert({
    id: returnId,
    order_id: orderId,
    customer_id: session.id,
    status: "Requested",
    return_method: "KORA arranges pickup (Biteship)",
    request_source: "Website",
    pickup_recipient_name: recipientName,
    pickup_phone: session.phone,
    pickup_street_address: order.street_address || "",
    pickup_city: order.city || "",
    pickup_postal_code: order.postal_code || null,
    pickup_latitude: order.latitude ?? null,
    pickup_longitude: order.longitude ?? null,
    deposit_held: Number(order.total_deposit) || 0,
    refund_amount: Number(order.total_deposit) || 0,
  });

  if (error) return { error: error.message };

  revalidatePath("/account/orders");
  return { success: true, returnId };
}

/* ── Customer self-return ────────────────────────────────────────── */

export async function submitSelfReturn(
  orderId: string,
  data: { courier: string; returnDate: string; trackingNumber: string },
) {
  const session = await getCurrentCustomer();
  if (!session) return { error: "Unauthorized." };

  if (!data.courier?.trim()) return { error: "Please select a courier." };
  if (!data.returnDate) return { error: "Return date is required." };
  if (!data.trackingNumber?.trim()) {
    return { error: "Tracking number is required." };
  }

  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(`
      id, status, total_deposit, street_address, city, postal_code,
      latitude, longitude, customer_id
    `)
    .eq("id", orderId)
    .eq("customer_id", session.id)
    .maybeSingle();

  if (!order) return { error: "Order not found." };
  if (order.status !== "Active") {
    return { error: "This order is not eligible for return yet." };
  }

  const { data: existing } = await supabase
    .from("returns")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle();
  if (existing) {
    return { error: "A return has already been initiated for this order." };
  }

  const returnId = `RET-${orderId}`;
  const recipientName =
    `${session.firstName} ${session.lastName || ""}`.trim() || "Customer";

  // "JNE - REG" → company="JNE", type="REG"
  const [courierCompany, courierType] = data.courier.split(" - ");

  const { error } = await supabase.from("returns").insert({
    id: returnId,
    order_id: orderId,
    customer_id: session.id,
    status: "Shipping",
    return_method: "Customer self-return",
    request_source: "Website",
    courier_company: courierCompany || data.courier,
    courier_type: courierType || null,
    waybill_id: data.trackingNumber.trim(),
    shipped_at: new Date(`${data.returnDate}T12:00:00`).toISOString(),
    pickup_recipient_name: recipientName,
    pickup_phone: session.phone,
    pickup_street_address: order.street_address || "",
    pickup_city: order.city || "",
    pickup_postal_code: order.postal_code || null,
    pickup_latitude: order.latitude ?? null,
    pickup_longitude: order.longitude ?? null,
    deposit_held: Number(order.total_deposit) || 0,
    refund_amount: Number(order.total_deposit) || 0,
  });

  if (error) return { error: error.message };

  revalidatePath("/account/orders");
  return { success: true, returnId };
}

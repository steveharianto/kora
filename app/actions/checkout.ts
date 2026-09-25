"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentCustomer } from "./customerAuth";
import { getBiteshipRates } from "@/lib/biteship";
import { createXenditInvoice } from "@/lib/xendit";
import {
  guardAvailability,
  guardCredit,
  applyOrderSideEffects,
} from "@/lib/orderLifecycle";
import { revalidatePath } from "next/cache";

/* ── Courier rate lookup ─────────────────────────────────────────── */

const COURIER_QUERY = "jne,sicepat,gojek,paxel";

// Biteship company|type → our internal label used across admin + PDP
const COURIER_LABELS: Record<string, string> = {
  "jne|reg": "JNE - REG",
  "jne|yes": "JNE - YES",
  "sicepat|reg": "SiCepat - REG",
  "gojek|instant": "Gosend - Instant",
  "paxel|medium": "Paxel - Medium",
};

export async function getCheckoutShippingRates(input: {
  destinationPostalCode: string;
  itemSkus: string[];
}) {
  const customer = await getCurrentCustomer();
  if (!customer) return { error: "Unauthorized." };

  if (!input.destinationPostalCode || input.destinationPostalCode.length < 5) {
    return { error: "A valid postal code is required." };
  }
  if (input.itemSkus.length === 0) {
    return { error: "Cart is empty." };
  }

  const supabase = await createClient();

  const { data: shippingSettings } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "shipping")
    .single();

  const origin = shippingSettings?.value?.dispatch_addresses?.primary;
  if (!origin?.postal_code) {
    return { error: "Showroom origin is not configured. Contact support." };
  }

  const defaultWeight = Number(
    shippingSettings?.value?.default_item_weight_g ?? 800,
  );
  const overrides: Record<string, number> =
    shippingSettings?.value?.item_weight_overrides ?? {};

  const { data: items } = await supabase
    .from("items")
    .select("sku, name, rental_price")
    .in("sku", input.itemSkus);

  const packageItems = (items || []).map((i: any) => ({
    name: i.name,
    value: Number(i.rental_price) || 500000,
    quantity: 1,
    weight: overrides[i.sku] ?? defaultWeight,
  }));

  if (packageItems.length === 0) {
    return { error: "No valid items in cart." };
  }

  const res = await getBiteshipRates({
    origin_postal_code: String(origin.postal_code),
    destination_postal_code: input.destinationPostalCode,
    couriers: COURIER_QUERY,
    items: packageItems,
  });

  if (!res.success || !res.rates) {
    return { error: res.error || "Could not fetch shipping rates." };
  }

  const options = res.rates
    .map((r) => {
      const key = `${r.courier_company.toLowerCase()}|${r.courier_type.toLowerCase()}`;
      const label = COURIER_LABELS[key];
      if (!label) return null;
      return {
        label,
        price: r.price,
        etd: r.etd || r.duration || "",
        courierCompany: r.courier_company,
        courierType: r.courier_type,
      };
    })
    .filter(Boolean) as Array<{
    label: string;
    price: number;
    etd: string;
    courierCompany: string;
    courierType: string;
  }>;

  return { success: true, options };
}

/* ── Website order ID ────────────────────────────────────────────── */

async function getNextWebsiteOrderId(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id")
    .like("id", "S%")
    .order("id", { ascending: false })
    .limit(1);

  if (!data || data.length === 0) return "S0001";
  const lastId = data[0].id;
  const num = parseInt(lastId.replace(/\D/g, ""), 10);
  if (isNaN(num)) return "S0001";
  return `S${String(num + 1).padStart(4, "0")}`;
}

/* ── Create website order (Draft) ────────────────────────────────── */

export async function createWebsiteOrder(input: {
  items: {
    sku: string;
    quantity: number;
    price: number;
    deposit: number;
  }[];
  eventStartDate: string;
  eventDays: number;
  pickupDate: string;
  returnDate: string;
  streetAddress: string;
  city: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  courierLabel: string;
  shippingFee: number;
  storeCreditApplied: number;
}) {
  const customer = await getCurrentCustomer();
  if (!customer) return { error: "Unauthorized." };

  if (customer.status === "Not Submitted") {
    return { error: "Please upload your ID before checking out." };
  }

  if (!input.items.length) return { error: "Cart is empty." };
  if (!input.streetAddress || !input.city) {
    return { error: "Delivery address is incomplete." };
  }

  const supabase = await createClient();
  const skus = input.items.map((i) => i.sku);

  // Availability check — no existing order to exclude, so pass a placeholder id
  const av = await guardAvailability(
    supabase,
    "NEW_WEBSITE_ORDER",
    skus,
    input.pickupDate,
    input.returnDate,
  );
  if (av.error) return { error: av.error };

  const cr = await guardCredit(supabase, customer.id, input.storeCreditApplied, 0);
  if (cr.error) return { error: cr.error };

  // Server-side price recalculation — never trust client totals
  const { data: itemRows } = await supabase
    .from("items")
    .select("sku, rental_price")
    .in("sku", skus);

  const priceMap = new Map(
    (itemRows || []).map((i: any) => [i.sku, Number(i.rental_price) || 0]),
  );

  let totalPrice = 0;
  let totalDeposit = 0;

  const productRows = input.items
    .filter((i) => priceMap.has(i.sku))
    .map((i) => {
      const serverPrice = priceMap.get(i.sku)!;
      const deposit = serverPrice > 1000000 ? 250000 : 150000;
      totalPrice += serverPrice * i.quantity;
      totalDeposit += deposit * i.quantity;
      return {
        item_sku: i.sku,
        quantity: i.quantity,
        price: serverPrice,
        deposit,
        subtotal: serverPrice * i.quantity,
      };
    });

  const shippingFee = Math.max(0, Number(input.shippingFee) || 0);
  const credit = Math.max(0, Number(input.storeCreditApplied) || 0);
  const grandTotal = Math.max(0, totalPrice + totalDeposit + shippingFee - credit);

  const orderId = await getNextWebsiteOrderId();
  const recipientName =
    `${customer.firstName} ${customer.lastName || ""}`.trim() || "Customer";

  const { error: orderErr } = await supabase.from("orders").insert({
    id: orderId,
    customer_id: customer.id,
    order_date: new Date().toISOString().split("T")[0],
    event_start_date: input.eventStartDate,
    event_days: input.eventDays,
    pickup_date: input.pickupDate,
    return_date: input.returnDate,
    city: input.city,
    postal_code: input.postalCode,
    street_address: input.streetAddress,
    latitude: input.latitude,
    longitude: input.longitude,
    total_price: totalPrice,
    total_deposit: totalDeposit,
    shipping_fee: shippingFee,
    store_credit_applied: credit,
    total: grandTotal,
    order_method: "Website",
    status: "Draft",
    pick_up_method: input.courierLabel,
    payment_method: "Xendit",
    return_shipping_cost: 0,
    qc_deduction: 0,
  });

  if (orderErr) return { error: orderErr.message };

  const { error: prodErr } = await supabase
    .from("order_products")
    .insert(productRows.map((p) => ({ ...p, order_id: orderId })));

  if (prodErr) {
    await supabase.from("orders").delete().eq("id", orderId);
    return { error: prodErr.message };
  }

  await supabase.from("admin_audit_logs").insert({
    admin_id: null,
    admin_name: "Website Checkout",
    entity_type: "order",
    entity_id: orderId,
    action_type: "CREATE_WEBSITE_DRAFT",
    field_name: "all",
    details: { customer_id: customer.id, recipient: recipientName },
  });

  revalidatePath("/account/orders");
  return { success: true, orderId, grandTotal };
}

/* ── Xendit invoice ──────────────────────────────────────────────── */

export async function createXenditInvoiceForOrder(orderId: string) {
  const customer = await getCurrentCustomer();
  if (!customer) return { error: "Unauthorized." };

  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, customer_id, total, status")
    .eq("id", orderId)
    .eq("customer_id", customer.id)
    .maybeSingle();

  if (!order) return { error: "Order not found." };
  if (order.status !== "Draft") {
    return { error: "This order is no longer awaiting payment." };
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  const invoice = await createXenditInvoice({
    external_id: orderId,
    amount: Number(order.total) || 0,
    description: `KORA Rental ${orderId} — payment for your rental booking`,
    customer: {
      given_names: customer.firstName,
      surname: customer.lastName || undefined,
      email: customer.email || undefined,
      mobile_number: customer.phone,
    },
    items: [
      {
        name: "Rental fee + deposit (incl. shipping)",
        quantity: 1,
        price: Number(order.total) || 0,
      },
    ],
    success_redirect_url: `${baseUrl}/checkout/success?order_id=${orderId}`,
    failure_redirect_url: `${baseUrl}/checkout?failed=${orderId}`,
  });

  if (!invoice.success || !invoice.invoice_url) {
    return { error: invoice.error || "Could not create payment session." };
  }

  await supabase.from("admin_audit_logs").insert({
    admin_id: null,
    admin_name: "Website Checkout",
    entity_type: "order",
    entity_id: orderId,
    action_type: "XENDIT_INVOICE_CREATED",
    field_name: "invoice_id",
    new_value: invoice.id || null,
    details: {
      invoice_url: invoice.invoice_url,
      status: invoice.status,
    },
  });

  return { success: true, invoiceUrl: invoice.invoice_url };
}

/* ── Webhook handler: mark paid ──────────────────────────────────── */

export async function markWebsiteOrderPaid(
  orderId: string,
  xenditMeta: {
    invoice_id?: string;
    status?: string;
    paid_amount?: number;
    paid_at?: string;
    payment_method?: string;
    payment_channel?: string;
  },
) {
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      `id, status, customer_id, store_credit_applied, pickup_date, return_date,
       order_products(item_sku)`,
    )
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return { error: "Order not found." };

  // Idempotency — Xendit can retry the webhook
  if (order.status !== "Draft") {
    return { success: true, alreadyProcessed: true };
  }

  const skus = (order.order_products || [])
    .map((p: any) => p.item_sku)
    .filter(Boolean);

  const { error: upErr } = await supabase
    .from("orders")
    .update({
      status: "Ordered",
      payment_method: xenditMeta.payment_channel
        ? `Xendit - ${xenditMeta.payment_channel}`
        : "Xendit",
    })
    .eq("id", orderId);

  if (upErr) return { error: upErr.message };

  // Apply reservation side effects (items Unavailable, fitting eviction, credit)
  const { data: sysAdmin } = await supabase
    .from("admins")
    .select("id, name, role")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (sysAdmin && skus.length > 0) {
    await applyOrderSideEffects(
      supabase,
      {
        id: sysAdmin.id,
        name: "Website Payment (Xendit)",
        role: sysAdmin.role,
      },
      {
        orderId,
        prevStatus: "Draft",
        newStatus: "Ordered",
        skus,
        pickupDate: order.pickup_date,
        returnDate: order.return_date,
        prevCustomerId: order.customer_id,
        newCustomerId: order.customer_id,
        prevCreditApplied: 0,
        newCreditApplied: Number(order.store_credit_applied) || 0,
      },
    );
  }

  await supabase.from("admin_audit_logs").insert({
    admin_id: null,
    admin_name: "Xendit Webhook",
    entity_type: "order",
    entity_id: orderId,
    action_type: "XENDIT_PAYMENT_SUCCESS",
    field_name: "status",
    old_value: "Draft",
    new_value: "Ordered",
    details: xenditMeta,
  });

  revalidatePath("/account/orders");
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);

  return { success: true };
}

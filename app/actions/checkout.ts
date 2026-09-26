"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentCustomer } from "./customerAuth";
import { getBiteshipRates } from "@/lib/biteship";
import {
  createXenditInvoice,
  getXenditInvoiceByExternalId,
} from "@/lib/xendit";
import {
  guardAvailability,
  guardCredit,
  applyOrderSideEffects,
} from "@/lib/orderLifecycle";
import { emitWa } from "@/lib/notifications";
import { formatRupiah } from "@/lib/utils";
import { revalidatePath } from "next/cache";

/* ── Courier rate lookup ─────────────────────────────────────────── */

const COURIER_QUERY =
  "jne,sicepat,gojek,paxel,grab,anteraja,ninja,pos,tiki,lion";

// Curated display labels for the common combinations. Anything Biteship
// returns that isn't in here still passes through — it just gets a
// dynamically formatted label instead of being silently dropped.
const COURIER_LABELS: Record<string, string> = {
  "jne|reg": "JNE - REG",
  "jne|yes": "JNE - YES",
  "sicepat|reg": "SiCepat - REG",
  "sicepat|best": "SiCepat - BEST",
  "gojek|instant": "Gosend - Instant",
  "gojek|sameday": "Gosend - Same Day",
  "paxel|small": "Paxel - Small",
  "paxel|medium": "Paxel - Medium",
  "paxel|large": "Paxel - Large",
  "paxel|regular": "Paxel - Regular",
  "paxel|instant": "Paxel - Instant",
  "grab|instant": "GrabExpress - Instant",
  "grab|sameday": "GrabExpress - Same Day",
  "anteraja|reg": "Anteraja - REG",
  "anteraja|sameday": "Anteraja - Same Day",
  "ninja|standard": "Ninja Xpress - Standard",
  "pos|reg": "Pos Indonesia - Reguler",
  "tiki|reg": "TIKI - REG",
  "lion|reg": "Lion Parcel - REG",
};

function labelForCourier(company: string, type: string): string {
  const key = `${company.toLowerCase()}|${type.toLowerCase()}`;
  if (COURIER_LABELS[key]) return COURIER_LABELS[key];

  const comp = company
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const typ = type
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return `${comp} - ${typ}`;
}

export async function getCheckoutShippingRates(input: {
  destinationPostalCode: string;
  /** Coordinates of the selected delivery address. Required for instant
   *  couriers like Paxel, Gosend, GrabExpress to be priced by Biteship. */
  destinationLatitude?: number | null;
  destinationLongitude?: number | null;
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

  // Origin coordinate — required by Biteship for instant courier pricing.
  const originCoordinate =
    origin.latitude != null && origin.longitude != null
      ? {
          latitude: Number(origin.latitude),
          longitude: Number(origin.longitude),
        }
      : undefined;

  // Destination coordinate — from the customer's selected address.
  const destinationCoordinate =
    input.destinationLatitude != null && input.destinationLongitude != null
      ? {
          latitude: Number(input.destinationLatitude),
          longitude: Number(input.destinationLongitude),
        }
      : undefined;

  const res = await getBiteshipRates({
    origin_postal_code: String(origin.postal_code),
    destination_postal_code: input.destinationPostalCode,
    couriers: COURIER_QUERY,
    items: packageItems,
    origin_coordinate: originCoordinate,
    destination_coordinate: destinationCoordinate,
  });

  if (!res.success || !res.rates) {
    return { error: res.error || "Could not fetch shipping rates." };
  }

  // Build options with the dynamic label — nothing gets dropped.
  const options = res.rates.map((r) => ({
    label: labelForCourier(r.courier_company, r.courier_type),
    price: r.price,
    etd: r.etd || r.duration || "",
    courierCompany: r.courier_company,
    courierType: r.courier_type,
  }));

  // Sort by price ascending — cheapest floats to the top.
  options.sort((a, b) => a.price - b.price);

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
    /** Per-event-day rental price in IDR. */
    price: number;
    deposit: number;
    /** Number of event days for this item. Multiplies `price`. */
    eventDays: number;
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

  const av = await guardAvailability(
    supabase,
    "NEW_WEBSITE_ORDER",
    skus,
    input.pickupDate,
    input.returnDate,
  );
  if (av.error) return { error: av.error };

  const cr = await guardCredit(
    supabase,
    customer.id,
    input.storeCreditApplied,
    0,
  );
  if (cr.error) return { error: cr.error };

  // Server-side price recalculation. The client sends the per-day unit price
  // for display; the server independently derives the unit price from the
  // items table and multiplies by event days, so a tampered client payload
  // can't underpay.
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
      const serverUnitPrice = priceMap.get(i.sku)!;
      const days = Math.max(1, Number(i.eventDays) || 1);
      const qty = Math.max(1, Number(i.quantity) || 1);

      // Line total = unit price × event days × quantity.
      const lineSubtotal = serverUnitPrice * days * qty;

      // Deposit tracks the item's value (unit price), not the rental length.
      const deposit = serverUnitPrice > 1000000 ? 250000 : 150000;

      totalPrice += lineSubtotal;
      totalDeposit += deposit * qty;

      return {
        item_sku: i.sku,
        quantity: qty,
        price: lineSubtotal,
        deposit,
        subtotal: lineSubtotal,
      };
    });

  const shippingFee = Math.max(0, Number(input.shippingFee) || 0);
  const credit = Math.max(0, Number(input.storeCreditApplied) || 0);
  const grandTotal = Math.max(
    0,
    totalPrice + totalDeposit + shippingFee - credit,
  );

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
    details: {
      customer_id: customer.id,
      recipient: recipientName,
      event_days: input.eventDays,
      lines: productRows.map((p) => ({
        sku: p.item_sku,
        unit_days: input.items.find((x) => x.sku === p.item_sku)?.eventDays,
        line_total: p.price,
      })),
    },
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
  source: string = "Xendit Webhook",
) {
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      `id, status, customer_id, store_credit_applied, pickup_date, return_date, total,
       order_products(item_sku),
       customers ( first_name, last_name, phone )`,
    )
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return { error: "Order not found." };

  const sessionCustomer = await getCurrentCustomer();
  if (sessionCustomer && order.customer_id !== sessionCustomer.id) {
    return { error: "Order not found." };
  }

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

  const { data: sysAdmin } = await supabase
    .from("admins")
    .select("id, name, role")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const actor = {
    id: sysAdmin?.id || "00000000-0000-0000-0000-000000000000",
    name: source,
    role: sysAdmin?.role || "staff",
  };

  if (skus.length > 0) {
    await applyOrderSideEffects(supabase, actor, {
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
    });
  }

  await supabase.from("admin_audit_logs").insert({
    admin_id: null,
    admin_name: source,
    entity_type: "order",
    entity_id: orderId,
    action_type: "XENDIT_PAYMENT_SUCCESS",
    field_name: "status",
    old_value: "Draft",
    new_value: "Ordered",
    details: xenditMeta,
  });

  const customer = (order as any).customers as
    | { first_name?: string; last_name?: string; phone?: string }
    | undefined;

  if (customer?.phone) {
    const customerName =
      `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
      "there";
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";

    try {
      await emitWa(supabase, actor, {
        entity: "order",
        entityId: orderId,
        kind: "order_posted",
        to: customer.phone,
        vars: {
          CUSTOMER_NAME: customerName,
          ORDER_ID: orderId,
          INVOICE_LINK: `${baseUrl}/account/orders`,
          TOTAL: formatRupiah(Number(order.total) || 0),
        },
        fallbackTemplate:
          "Hi [CUSTOMER_NAME], thank you for your order [ORDER_ID]! Here is your invoice link: [INVOICE_LINK]. Total: [TOTAL].",
      });
    } catch {
      // Non-blocking — payment has already committed.
    }
  }

  revalidatePath("/account/orders");
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/inventory");

  return { success: true };
}

/* ── Success-page verifier ───────────────────────────────────────── */

const VERIFY_ATTEMPTS = 3;
const VERIFY_DELAY_MS = 1500;

export async function verifyAndPostWebsiteOrder(orderId: string) {
  if (!orderId) return { error: "order_id is required." };

  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return { error: "Order not found." };
  if (order.status !== "Draft") {
    return { success: true, status: order.status, paid: true };
  }

  for (let attempt = 0; attempt < VERIFY_ATTEMPTS; attempt++) {
    const lookup = await getXenditInvoiceByExternalId(orderId);

    if (lookup.success && lookup.invoice) {
      const inv = lookup.invoice;
      const isPaid = inv.status === "PAID" || inv.status === "SETTLED";

      if (isPaid) {
        const res = await markWebsiteOrderPaid(
          orderId,
          {
            invoice_id: inv.id,
            status: inv.status,
            paid_amount: inv.paid_amount,
            paid_at: inv.paid_at || inv.updated,
            payment_method: inv.payment_method,
            payment_channel: inv.payment_channel,
          },
          "Website Checkout Verification",
        );
        if (res.error) return { error: res.error };
        return { success: true, status: "Ordered", paid: true };
      }

      if (inv.status === "EXPIRED") {
        return { success: true, status: "Draft", paid: false, expired: true };
      }
    }

    if (attempt < VERIFY_ATTEMPTS - 1) {
      await new Promise((r) => setTimeout(r, VERIFY_DELAY_MS));
    }
  }

  return { success: true, status: "Draft", paid: false };
}

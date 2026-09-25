"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentCustomer } from "./customerAuth";
import { createXenditInvoice } from "@/lib/xendit";
import { revalidatePath } from "next/cache";

const BLOCKING_STATUSES = ["Cancelled", "Conflict Evicted", "No Show"];

export interface FittingBookingSession {
  date: string;
  slot: string;
  fee: number;
  isAfterHours: boolean;
  skus: string[];
}

/* ── Create booking (inserts fittings + optional Xendit invoice) ─── */

export async function createFittingBooking(sessions: FittingBookingSession[]) {
  const customer = await getCurrentCustomer();
  if (!customer) return { error: "Unauthorized." };

  if (!sessions || sessions.length === 0) {
    return { error: "No fitting sessions to book." };
  }

  for (const s of sessions) {
    if (!s.date || !s.slot) return { error: "Session date/slot missing." };
    if (!s.skus || s.skus.length === 0) {
      return { error: "Each session needs at least one piece." };
    }
    if (s.skus.length > 3) {
      return { error: "Maximum 3 pieces per fitting session." };
    }
  }

  const supabase = await createClient();

  // ── Validate slot availability (live) ──────────────────────────
  for (const s of sessions) {
    const { data: conflict } = await supabase
      .from("fittings")
      .select("id")
      .eq("date", s.date)
      .eq("slot", `${s.slot}:00`)
      .not("status", "in", '("Cancelled", "Conflict Evicted", "No Show")')
      .maybeSingle();

    if (conflict) {
      return {
        error: `Slot ${s.slot} on ${s.date} is no longer available. Please pick another.`,
      };
    }
  }

  // ── Reserve next FIT ids atomically ────────────────────────────
  const { data: lastFit } = await supabase
    .from("fittings")
    .select("id")
    .like("id", "FIT-%")
    .order("id", { ascending: false })
    .limit(1);

  const lastNum = lastFit?.[0]?.id
    ? parseInt(lastFit[0].id.replace("FIT-", ""), 10)
    : 346;

  const totalFee = sessions.reduce((sum, s) => sum + (Number(s.fee) || 0), 0);
  const hasPayment = totalFee > 0;

  const bookingId = `FB-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const fittingRows = sessions.map((s, i) => {
    const hour = parseInt(s.slot.split(":")[0], 10);
    const endHour = String(hour + 1).padStart(2, "0");
    const isPaid = (Number(s.fee) || 0) > 0;

    return {
      id: `FIT-${String(lastNum + 1 + i).padStart(4, "0")}`,
      customer_id: customer.id,
      date: s.date,
      slot: `${s.slot}:00`,
      end_time: `${endHour}:00`,
      status: isPaid ? "Pending" : "Confirmed",
      source: "Website",
      is_after_hours: s.isAfterHours,
      after_hours_fee: Number(s.fee) || 0,
      fee_payment_status: isPaid ? "Unpaid" : "n/a",
      booking_id: bookingId,
    };
  });

  const { error: fitErr } = await supabase.from("fittings").insert(fittingRows);
  if (fitErr) return { error: fitErr.message };

  const itemRows = sessions.flatMap((s, i) =>
    s.skus.map((sku, j) => ({
      fitting_id: fittingRows[i].id,
      item_sku: sku,
      slot_number: j + 1,
    })),
  );

  if (itemRows.length > 0) {
    const { error: itemErr } = await supabase
      .from("fitting_items")
      .insert(itemRows);

    if (itemErr) {
      // Rollback the fittings we just created
      await supabase
        .from("fittings")
        .delete()
        .in("id", fittingRows.map((f) => f.id));
      return { error: itemErr.message };
    }
  }

  // ── If there's a fee, create a single Xendit invoice ───────────
  if (hasPayment) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const sessionCount = sessions.length;

    const invoice = await createXenditInvoice({
      external_id: bookingId,
      amount: totalFee,
      description: `KORA Fitting Session — ${sessionCount} session${sessionCount > 1 ? "s" : ""}`,
      customer: {
        given_names: customer.firstName,
        surname: customer.lastName || undefined,
        email: customer.email || undefined,
        mobile_number: customer.phone,
      },
      items: [
        {
          name: `After-hours fitting session fee (${sessionCount}×)`,
          quantity: 1,
          price: totalFee,
        },
      ],
      success_redirect_url: `${baseUrl}/account/fittings?booking=${bookingId}`,
      failure_redirect_url: `${baseUrl}/shop?booking_failed=${bookingId}`,
    });

    if (!invoice.success || !invoice.invoice_url) {
      await supabase
        .from("fittings")
        .delete()
        .in("id", fittingRows.map((f) => f.id));
      return { error: invoice.error || "Could not create payment session." };
    }

    await supabase.from("admin_audit_logs").insert({
      admin_id: null,
      admin_name: "Website Fitting Booking",
      entity_type: "fitting",
      entity_id: bookingId,
      action_type: "XENDIT_FITTING_INVOICE_CREATED",
      field_name: "invoice_id",
      new_value: invoice.id || null,
      details: {
        invoice_url: invoice.invoice_url,
        fitting_ids: fittingRows.map((f) => f.id),
        total_fee: totalFee,
      },
    });

    return { success: true, bookingId, invoiceUrl: invoice.invoice_url };
  }

  // Free booking — done immediately
  await supabase.from("admin_audit_logs").insert({
    admin_id: null,
    admin_name: "Website Fitting Booking",
    entity_type: "fitting",
    entity_id: bookingId,
    action_type: "CREATE_FREE_FITTING_BOOKING",
    field_name: "all",
    details: { fitting_ids: fittingRows.map((f) => f.id) },
  });

  revalidatePath("/account/fittings");
  return { success: true, bookingId, free: true };
}

/* ── Webhook handler: mark booking paid ──────────────────────────── */

export async function markFittingBookingPaid(
  bookingId: string,
  meta: {
    invoice_id?: string;
    status?: string;
    paid_amount?: number;
    paid_at?: string;
    payment_channel?: string;
  },
) {
  const supabase = await createClient();

  const { data: fittings } = await supabase
    .from("fittings")
    .select("id, status, fee_payment_status")
    .eq("booking_id", bookingId);

  if (!fittings || fittings.length === 0) {
    return { error: "No fittings found for booking." };
  }

  // Idempotency — Xendit can retry
  const allPaid = fittings.every(
    (f: any) => f.fee_payment_status === "Paid" || f.fee_payment_status === "n/a",
  );
  if (allPaid) return { success: true, alreadyProcessed: true };

  const { error } = await supabase
    .from("fittings")
    .update({
      status: "Confirmed",
      fee_payment_status: "Paid",
      fee_paid_at: new Date().toISOString(),
      fee_payment_method: meta.payment_channel
        ? `Xendit - ${meta.payment_channel}`
        : "Xendit",
      updated_at: new Date().toISOString(),
    })
    .eq("booking_id", bookingId)
    .eq("fee_payment_status", "Unpaid");

  if (error) return { error: error.message };

  await supabase.from("admin_audit_logs").insert({
    admin_id: null,
    admin_name: "Xendit Webhook",
    entity_type: "fitting",
    entity_id: bookingId,
    action_type: "XENDIT_FITTING_PAYMENT_SUCCESS",
    field_name: "fee_payment_status",
    old_value: "Unpaid",
    new_value: "Paid",
    details: meta,
  });

  revalidatePath("/account/fittings");
  revalidatePath("/admin/fittings");

  return { success: true };
}

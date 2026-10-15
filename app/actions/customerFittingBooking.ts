"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentCustomer } from "./customerAuth";
import {
  createXenditInvoice,
  getXenditInvoiceByExternalId,
} from "@/lib/xendit";
import { isUniqueViolation } from "@/lib/orderLifecycle";
import { revalidatePath } from "next/cache";

function todayJakartaISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(
    new Date(),
  );
}

export interface FittingBookingSession {
  date: string;
  slot: string;
  fee: number;
  isAfterHours: boolean;
  skus: string[];
}

export interface FittingPaymentMeta {
  invoice_id?: string;
  status?: string;
  paid_amount?: number;
  paid_at?: string;
  payment_method?: string;
  payment_channel?: string;
}

async function fetchLastFittingNumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<number> {
  const { data } = await supabase
    .from("fittings")
    .select("id")
    .like("id", "FIT-%")
    .order("id", { ascending: false })
    .limit(1);

  if (!data || data.length === 0) return 346;
  const num = parseInt(data[0].id.replace("FIT-", ""), 10);
  return isNaN(num) ? 346 : num;
}

export async function createFittingBooking(sessions: FittingBookingSession[]) {
  const customer = await getCurrentCustomer();
  if (!customer) return { error: "Unauthorized." };

  if (!sessions || sessions.length === 0) {
    return { error: "No fitting sessions to book." };
  }

  const todayStr = todayJakartaISO();

  for (const s of sessions) {
    if (!s.date || !s.slot) return { error: "Session date/slot missing." };
    if (s.date <= todayStr) {
      return {
        error:
          "Fitting sessions must be booked at least one day in advance. Please pick tomorrow or a later date.",
      };
    }
    if (!s.skus || s.skus.length === 0) {
      return { error: "Each session needs at least one piece." };
    }
    if (s.skus.length > 3) {
      return { error: "Maximum 3 pieces per fitting session." };
    }
  }

  const supabase = await createClient();

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

  const totalFee = sessions.reduce((sum, s) => sum + (Number(s.fee) || 0), 0);
  const hasPayment = totalFee > 0;

  let fittingRows: any[] = [];
  let bookingId: string | null = null;
  let lastErr: any = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const lastNum = await fetchLastFittingNumber(supabase);
    const candidateBookingId = `FB-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const candidateRows = sessions.map((s, i) => {
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
        booking_id: candidateBookingId,
      };
    });

    const { error } = await supabase.from("fittings").insert(candidateRows);
    if (!error) {
      fittingRows = candidateRows;
      bookingId = candidateBookingId;
      break;
    }
    if (!isUniqueViolation(error)) return { error: error.message };
    lastErr = error;
  }

  if (!bookingId) {
    return {
      error:
        lastErr?.message ||
        "Could not allocate unique fitting IDs after 5 attempts.",
    };
  }

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
      await supabase
        .from("fittings")
        .delete()
        .in(
          "id",
          fittingRows.map((f) => f.id),
        );
      return { error: itemErr.message };
    }
  }

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
        .in(
          "id",
          fittingRows.map((f) => f.id),
        );
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

export async function markFittingBookingPaid(
  bookingId: string,
  meta: FittingPaymentMeta,
) {
  const supabase = await createClient();

  const { data: fittings } = await supabase
    .from("fittings")
    .select("id, status, fee_payment_status")
    .eq("booking_id", bookingId);

  if (!fittings || fittings.length === 0) {
    return { error: "No fittings found for booking." };
  }

  const allPaid = fittings.every(
    (f: any) =>
      f.fee_payment_status === "Paid" || f.fee_payment_status === "n/a",
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

export async function verifyAndConfirmFittingBooking(bookingId: string) {
  if (!bookingId) return { error: "booking_id is required." };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("fittings")
    .select("fee_payment_status")
    .eq("booking_id", bookingId);

  if (!existing || existing.length === 0) {
    return { error: "No fittings found for this booking." };
  }

  const stillUnpaid = existing.some(
    (f: any) => f.fee_payment_status === "Unpaid",
  );
  if (!stillUnpaid) {
    return { success: true, alreadyProcessed: true };
  }

  const lookup = await getXenditInvoiceByExternalId(bookingId);
  if (!lookup.success || !lookup.invoice) {
    return { error: lookup.error || "Invoice not found on Xendit." };
  }

  const inv = lookup.invoice;
  const isPaid = inv.status === "PAID" || inv.status === "SETTLED";

  if (!isPaid) {
    return {
      success: true,
      paid: false,
      status: inv.status,
    };
  }

  const res = await markFittingBookingPaid(bookingId, {
    invoice_id: inv.id,
    status: inv.status,
    paid_amount: inv.paid_amount,
    paid_at: inv.paid_at || inv.updated,
    payment_method: inv.payment_method,
    payment_channel: inv.payment_channel,
  });

  if (res.error) return { error: res.error };

  return { success: true, paid: true, status: inv.status };
}

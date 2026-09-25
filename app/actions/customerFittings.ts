"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentCustomer } from "./customerAuth";
import { revalidatePath } from "next/cache";

const CANCELLATION_FEE = 100000;
const FEE_WINDOW_HOURS = 24;
const BLOCKING_STATUSES = [
  "Cancelled",
  "Completed",
  "Conflict Evicted",
  "No Show",
];

/* ── Cancel ─────────────────────────────────────────────────────── */

export async function cancelFitting(fittingId: string) {
  const session = await getCurrentCustomer();
  if (!session) return { error: "Unauthorized." };

  const supabase = await createClient();

  const { data: fitting } = await supabase
    .from("fittings")
    .select("id, date, slot, status, customer_id, fee_payment_status, after_hours_fee")
    .eq("id", fittingId)
    .eq("customer_id", session.id)
    .maybeSingle();

  if (!fitting) return { error: "Fitting session not found." };
  if (BLOCKING_STATUSES.includes(fitting.status)) {
    return { error: "This session can no longer be cancelled." };
  }

  const sessionDateTime = new Date(`${fitting.date}T${fitting.slot}`);
  const hoursUntil =
    (sessionDateTime.getTime() - Date.now()) / (1000 * 60 * 60);

  if (hoursUntil < 0) {
    return { error: "This session has already passed." };
  }

  const wasPaid = (fitting as any).fee_payment_status === "Paid";
  const paidAmount = Number((fitting as any).after_hours_fee) || 0;
  const fee = hoursUntil < FEE_WINDOW_HOURS ? CANCELLATION_FEE : 0;

  let refundStatus: "n/a" | "Pending" | "Forfeited" = "n/a";
  let refundAmount = 0;

  if (wasPaid) {
    if (hoursUntil < FEE_WINDOW_HOURS) {
      refundStatus = "Forfeited";
      refundAmount = 0;
    } else {
      refundStatus = "Pending";
      refundAmount = paidAmount;
    }
  }

  const { error } = await supabase
    .from("fittings")
    .update({
      status: "Cancelled",
      cancellation_fee: fee,
      cancelled_at: new Date().toISOString(),
      cancelled_by: "Customer",
      refund_status: refundStatus,
      refund_amount: refundAmount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", fittingId);

  if (error) return { error: error.message };

  revalidatePath("/account/fittings");
  return { success: true, fee };
}

/* ── Reschedule ─────────────────────────────────────────────────── */

export async function rescheduleFitting(
  fittingId: string,
  data: { date: string; slot: string },
) {
  const session = await getCurrentCustomer();
  if (!session) return { error: "Unauthorized." };

  if (!data.date || !data.slot) {
    return { error: "New date and time are required." };
  }

  const supabase = await createClient();

  const { data: fitting } = await supabase
    .from("fittings")
    .select("id, date, slot, status, customer_id")
    .eq("id", fittingId)
    .eq("customer_id", session.id)
    .maybeSingle();

  if (!fitting) return { error: "Fitting session not found." };
  if (BLOCKING_STATUSES.includes(fitting.status)) {
    return { error: "This session can no longer be rescheduled." };
  }

  // Check the target slot is free (excluding this fitting itself)
  const { data: conflict } = await supabase
    .from("fittings")
    .select("id")
    .eq("date", data.date)
    .eq("slot", `${data.slot}:00`)
    .neq("id", fittingId)
    .not("status", "in", '("Cancelled", "Conflict Evicted", "No Show")')
    .maybeSingle();

  if (conflict) {
    return {
      error: "That time slot is no longer available. Please pick another.",
    };
  }

  const hour = parseInt(data.slot.split(":")[0], 10);
  const endHour = String(hour + 1).padStart(2, "0");

  const { error } = await supabase
    .from("fittings")
    .update({
      date: data.date,
      slot: `${data.slot}:00`,
      end_time: `${endHour}:00`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", fittingId);

  if (error) return { error: error.message };

  revalidatePath("/account/fittings");
  return { success: true };
}

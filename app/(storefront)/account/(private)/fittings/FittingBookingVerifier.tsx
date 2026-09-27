"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { verifyAndConfirmFittingBooking } from "@/app/actions/customerFittingBooking";

/**
 * Runs once on mount when the fittings page loads with `?booking=FB-...`.
 * Polls Xendit (up to 4 attempts, 2s apart) to confirm the fitting payment.
 * Refreshes the page on success so the status chip flips.
 *
 * Renders a discreet "checking payment" strip while running, and nothing
 * once confirmed or if the booking has no pending payment.
 */
export default function FittingBookingVerifier({
  bookingId,
}: {
  bookingId: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "confirmed" | "pending" | "failed">(
    "checking",
  );
  const [attempt, setAttempt] = useState(0);

  const MAX_ATTEMPTS = 4;
  const DELAY_MS = 2000;

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        if (cancelled) return;

        const res = await verifyAndConfirmFittingBooking(bookingId);

        if (cancelled) return;

        if (res.success && (res as any).paid === true) {
          setState("confirmed");
          router.refresh();
          return;
        }
        if (res.success && (res as any).alreadyProcessed === true) {
          setState("confirmed");
          router.refresh();
          return;
        }

        setAttempt(i + 1);

        if (i < MAX_ATTEMPTS - 1) {
          await new Promise((r) => setTimeout(r, DELAY_MS));
        }
      }

      if (!cancelled) setState("pending");
    };

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  if (state === "confirmed") {
    return (
      <div className="mb-6 p-3.5 border border-[#CAD3C5] bg-[#EAF3E7] text-[#2E7D47] rounded-md text-[12.5px] flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#2E7D47] inline-block" />
        Payment confirmed — your fitting session is booked.
      </div>
    );
  }

  if (state === "pending") {
    return (
      <div className="mb-6 p-3.5 border border-[#F1DFB7] bg-[#FDF3DE] text-[#977028] rounded-md text-[12.5px] flex items-start gap-2">
        <span className="w-2 h-2 rounded-full bg-[#977028] inline-block mt-1.5 flex-shrink-0" />
        <span>
          We&apos;re still waiting on Xendit to confirm your payment. It usually
          lands within a minute — refresh this page if it stays pending. Our
          team will be in touch either way.
        </span>
      </div>
    );
  }

  if (state === "failed") {
    return null;
  }

  // checking
  return (
    <div className="mb-6 p-3.5 border border-line bg-[#FDFCFA] text-store-fg-muted rounded-md text-[12.5px] flex items-center gap-2">
      <span className="w-3.5 h-3.5 border-2 border-store-accent border-t-transparent rounded-full animate-spin" />
      Confirming payment with Xendit
      {attempt > 0 ? ` (attempt ${attempt + 1}/${MAX_ATTEMPTS})…` : "…"}
    </div>
  );
}

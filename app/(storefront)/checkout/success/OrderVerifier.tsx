"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { verifyAndPostWebsiteOrder } from "@/app/actions/checkout";

/**
 * Runs the Xendit invoice verification once on mount, after the success page
 * has already rendered. This keeps the `revalidatePath` calls inside
 * `markWebsiteOrderPaid` out of the Server Component's render pass — which
 * Next.js rejects — while still transitioning the order Draft → Ordered
 * without an admin click.
 *
 * Renders nothing.
 */
export default function OrderVerifier({
  orderId,
  enabled = true,
}: {
  orderId: string;
  /** Skip the call if the page already sees a posted order. */
  enabled?: boolean;
}) {
  const router = useRouter();
  const [fired, setFired] = useState(false);

  useEffect(() => {
    if (!enabled || fired) return;
    setFired(true);

    let cancelled = false;
    (async () => {
      try {
        await verifyAndPostWebsiteOrder(orderId);
      } catch {
        // Silent — the webhook will still catch up if this attempt failed.
      }
      if (!cancelled) {
        router.refresh();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId, enabled, fired, router]);

  return null;
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCustomer } from "@/app/actions/customerAuth";
import { redirect } from "next/navigation";
import OrderVerifier from "./OrderVerifier";

export const metadata = {
  title: "Order Confirmed | KORA",
};

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order_id?: string }>;
}) {
  const { order_id } = await searchParams;
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/account/login");

  let orderStatus: string | null = null;

  if (order_id) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("orders")
      .select("status")
      .eq("id", order_id)
      .eq("customer_id", customer.id)
      .maybeSingle();
    orderStatus = data?.status || null;
  }

  const isPaid =
    orderStatus === "Ordered" ||
    orderStatus === "In Shipping" ||
    orderStatus === "Active" ||
    orderStatus === "Completed";

  // Kick off the Draft → Ordered transition from a client component so the
  // `revalidatePath` calls inside the action run outside this render pass.
  // Idempotent with the webhook — whichever lands first wins.
  const needsVerification = Boolean(order_id && !isPaid);

  return (
    <div className="w-full bg-store-bg">
      {order_id && (
        <OrderVerifier orderId={order_id} enabled={needsVerification} />
      )}

      <div className="max-w-[600px] mx-auto px-6 py-24 text-center">
        <h1 className="font-serif text-[32px] sm:text-[40px] text-store-accent font-normal tracking-[0.01em] mb-5">
          {isPaid ? "Thank you for your order!" : "Processing your payment…"}
        </h1>

        <p className="text-[13px] text-store-fg-muted leading-relaxed mb-3">
          {isPaid
            ? "Your payment was successful. Your order is confirmed and we'll start preparing your rental — you'll hear from us on WhatsApp shortly."
            : "We're confirming your payment with Xendit. This usually takes a few seconds — the page will update automatically."}
        </p>

        {order_id && (
          <p className="text-[12px] text-store-fg-muted font-mono mb-12">
            Order reference: {order_id}
          </p>
        )}

        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/account/orders"
            className="px-8 py-3.5 bg-store-accent text-white text-[11px] tracking-[0.22em] uppercase font-medium hover:bg-store-accent-hover transition-colors"
          >
            View My Orders
          </Link>
          <Link
            href="/shop"
            className="px-8 py-3.5 border border-store-fg text-store-fg text-[11px] tracking-[0.22em] uppercase font-medium hover:bg-store-hover/50 transition-colors"
          >
            Continue Browsing
          </Link>
        </div>
      </div>
    </div>
  );
}

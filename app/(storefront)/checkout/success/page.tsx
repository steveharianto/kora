import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCustomer } from "@/app/actions/customerAuth";
import { redirect } from "next/navigation";

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

  const isPaid = orderStatus === "Ordered" || orderStatus === "In Shipping" || orderStatus === "Active" || orderStatus === "Completed";

  return (
    <div className="w-full bg-store-bg">
      <div className="max-w-[600px] mx-auto px-6 py-24 text-center">
        <h1 className="font-serif text-[32px] sm:text-[40px] text-store-accent font-normal tracking-[0.01em] mb-5">
          {isPaid ? "Thank you for your order!" : "Processing your payment…"}
        </h1>
        <p className="text-[13px] text-store-fg-muted leading-relaxed mb-3">
          {isPaid
            ? "Your payment was successful. We'll start preparing your rental and be in touch via WhatsApp shortly."
            : "We're waiting for the payment confirmation from Xendit. This usually takes a few seconds — refresh this page in a moment."}
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

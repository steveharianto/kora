import { redirect } from "next/navigation";
import { getCurrentCustomer } from "@/app/actions/customerAuth";
import { createClient } from "@/lib/supabase/server";
import CheckoutClient from "./CheckoutClient";

export const metadata = {
  title: "Checkout | KORA",
};

export default async function CheckoutPage() {
  const customer = await getCurrentCustomer();
  if (!customer) {
    redirect("/account/login?redirect=/checkout");
  }

  if (customer.status === "Not Submitted") {
    // Customer needs to upload KTP before checkout — bounce them back.
    redirect("/account?ktp=required");
  }

  const supabase = await createClient();

  const [addressesRes, shippingRes] = await Promise.all([
    supabase
      .from("addresses")
      .select("*")
      .eq("customer_id", customer.id)
      .order("is_default", { ascending: false }),
    supabase.from("app_settings").select("value").eq("key", "shipping").single(),
  ]);

  const leadTimes = shippingRes.data?.value?.delivery_lead_times || [];

  return (
    <CheckoutClient
      customer={customer}
      addresses={addressesRes.data || []}
      deliveryLeadTimes={leadTimes}
    />
  );
}

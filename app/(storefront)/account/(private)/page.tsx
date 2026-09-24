import { createClient } from "@/lib/supabase/server";
import { getCurrentCustomer } from "@/app/actions/customerAuth";
import { redirect } from "next/navigation";
import AccountClient from "./AccountClient";

export const metadata = {
  title: "My Account | KORA",
};

export default async function AccountPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/account/login");

  const supabase = await createClient();

  const [addressesRes, ktpRes] = await Promise.all([
    supabase
      .from("addresses")
      .select("*")
      .eq("customer_id", customer.id)
      .order("is_default", { ascending: false }),
    supabase
      .from("ktp_logs")
      .select("photo_url, status, created_at")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <AccountClient
      customer={customer}
      addresses={addressesRes.data || []}
      latestKtp={ktpRes.data}
    />
  );
}

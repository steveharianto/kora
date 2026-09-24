import { createClient } from "@/lib/supabase/server";
import { getCurrentCustomer } from "@/app/actions/customerAuth";
import { redirect } from "next/navigation";
import OrdersClient from "./OrdersClient";

export const metadata = {
  title: "Order History | KORA",
};

export default async function OrdersPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/account/login");

  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select(`
      id, order_date, status, total, pickup_date, return_date,
      street_address, city, postal_code, packing_slip_id,
      customers ( phone ),
      returns ( id, status ),
      order_products (
        item_sku, quantity, price,
        items ( name, item_images ( image_url, display_order ) )
      )
    `)
    .eq("customer_id", customer.id)
    .order("order_date", { ascending: false });

  return <OrdersClient orders={orders || []} />;
}

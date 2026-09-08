import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import ItemForm from "./ItemForm";
import { getCurrentAdmin } from "@/app/actions/auth";

const CURATED_COLORS = [
  "Black", "White", "Off-White", "Ivory", "Cream", "Beige", "Champagne",
  "Taupe", "Camel", "Tan", "Charcoal", "Blush", "Rose", "Baby Pink",
  "Dusty Rose", "Peach", "Coral", "Lavender", "Lilac", "Mint", "Baby Blue",
  "Sage", "Emerald", "Forest Green", "Olive", "Navy", "Midnight Blue",
  "Royal Blue", "Sapphire", "Burgundy", "Wine", "Maroon", "Plum", "Rust",
  "Terracotta", "Mustard", "Gold", "Rose Gold", "Silver", "Bronze",
];

export default async function InventoryDetailPage({
  params,
}: {
  params: Promise<{ sku: string }>;
}) {
  const { sku } = await params;
  const isNew = sku === "new";
  const supabase = await createClient();
  const currentAdmin = await getCurrentAdmin();

  const [brandsRes, categoriesRes, typesRes, colorsRes, tiersRes] =
    await Promise.all([
      supabase.from("brands").select("id, name").order("name"),
      supabase.from("categories").select("id, name").order("name"),
      supabase.from("types").select("id, name").order("name"),
      supabase.from("items").select("color").not("color", "is", null),
      supabase
        .from("deposit_tiers")
        .select("*")
        .order("price_up_to", { ascending: true }),
    ]);

  const existingColors = colorsRes.data ? colorsRes.data.map((d) => d.color) : [];
  const colorOptions = Array.from(new Set([...CURATED_COLORS, ...existingColors])).sort();

  let initialData = null;
  let images = [];
  let orders = [];
  let auditLogs = [];

  if (!isNew) {
    const { data: item, error } = await supabase
      .from("items")
      .select("*")
      .eq("sku", sku)
      .single();
    if (error || !item) notFound();
    initialData = item;

    const [imgRes, orderRes, logRes] = await Promise.all([
      supabase
        .from("item_images")
        .select("*")
        .eq("item_sku", sku)
        .order("display_order", { ascending: true }),
      supabase
        .from("order_products")
        .select(`
          order_id,
          orders ( order_date, event_start_date, return_date, status, customer_id, customers ( first_name, last_name ) )
        `)
        .eq("item_sku", sku)
        .order("created_at", { ascending: false }),
      supabase
        .from("admin_audit_logs")
        .select("*")
        .eq("entity_id", sku)
        .order("created_at", { ascending: false }),
    ]);

    images = imgRes.data || [];
    auditLogs = logRes.data || [];

    orders = (orderRes.data || []).map((op: any) => ({
      order_id: op.order_id,
      ...op.orders,
      customer_name: op.orders?.customers
        ? `${op.orders.customers.first_name} ${op.orders.customers.last_name || ""}`
        : "Unknown",
    }));
  }

  return (
    <div className="max-w-[1200px] pb-20">
      <Link
        href="/admin/inventory"
        className="text-[12.5px] text-muted hover:text-wine-ink inline-block mb-2.5 transition"
      >
        ← Back to Inventory
      </Link>

      <ItemForm
        isNew={isNew}
        initialData={initialData}
        brands={brandsRes.data || []}
        categories={categoriesRes.data || []}
        types={typesRes.data || []}
        colorOptions={colorOptions}
        depositTiers={tiersRes.data || []}
        initialImages={images}
        orders={orders}
        auditLogs={auditLogs}
        currentAdmin={currentAdmin}
      />
    </div>
  );
}

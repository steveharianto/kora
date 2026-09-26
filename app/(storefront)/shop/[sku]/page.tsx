import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ProductDetail from "./ProductDetail";
import { getAccessoriesForLook } from "@/app/actions/storefront";

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ sku: string }>;
  searchParams: Promise<{ fitting_date?: string; fitting_slot?: string }>;
}) {
  const { sku } = await params;
  const { fitting_date, fitting_slot } = await searchParams;

  const supabase = await createClient();

  const [itemRes, shippingRes] = await Promise.all([
    supabase
      .from("items")
      .select(`
        sku, name, description, size, color, tags, rental_price, measurements,
        brands ( id, name ),
        types ( name ),
        item_images ( image_url, display_order )
      `)
      .ilike("sku", sku)
      .eq("website_status", "Published")
      .eq("is_archived", false)
      .maybeSingle(),
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "shipping")
      .single(),
  ]);

  const item = itemRes.data;
  if (!item) notFound();

  const deliveryLeadTimes: { prefix: string; region: string; days: number }[] =
    (shippingRes.data?.value?.delivery_lead_times as any[]) || [];

  // Related — same brand first
  const brandId = (item.brands as any)?.id;
  const brandName = (item.brands as any)?.name || "";

  let related: any[] = [];
  if (brandId) {
    const { data } = await supabase
      .from("items")
      .select(`sku, name, rental_price, item_images(image_url, display_order)`)
      .eq("brand_id", brandId)
      .eq("website_status", "Published")
      .eq("is_archived", false)
      .eq("status", "Available")
      .neq("sku", item.sku)
      .limit(4);
    related = data || [];
  }

  if (related.length < 4) {
    const exclude = [item.sku, ...related.map((r) => r.sku)];
    const { data: filler } = await supabase
      .from("items")
      .select(`sku, name, rental_price, item_images(image_url, display_order)`)
      .eq("website_status", "Published")
      .eq("is_archived", false)
      .eq("status", "Available")
      .not("sku", "in", `(${exclude.map((s) => `"${s}"`).join(",")})`)
      .limit(4 - related.length);
    related = [...related, ...(filler || [])];
  }

  const accessories = await getAccessoriesForLook(item.sku, 3);

  const normaliseRelated = (arr: any[]) =>
    arr.map((r: any) => {
      const imgs = (r.item_images || []).sort(
        (a: any, b: any) => a.display_order - b.display_order,
      );
      return {
        sku: r.sku,
        name: r.name,
        rentalPrice: Number(r.rental_price) || 0,
        coverImage: imgs[0]?.image_url || null,
      };
    });

  const images = (item.item_images || [])
    .sort((a: any, b: any) => a.display_order - b.display_order)
    .map((im: any) => im.image_url);

  const fittingPrefill =
    fitting_date && fitting_slot
      ? { date: fitting_date, slot: fitting_slot }
      : null;

  return (
    <ProductDetail
      item={{
        sku: item.sku,
        name: item.name,
        brand: brandName,
        type: (item.types as any)?.name || "",
        description: item.description || "",
        size: item.size || "",
        color: item.color || "",
        tags: item.tags || [],
        rentalPrice: Number(item.rental_price) || 0,
        measurements: item.measurements || {},
        images,
      }}
      relatedItems={normaliseRelated(related)}
      accessories={accessories}
      fittingPrefill={fittingPrefill}
      deliveryLeadTimes={deliveryLeadTimes}
    />
  );
}

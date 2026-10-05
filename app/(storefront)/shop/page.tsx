import { createClient } from "@/lib/supabase/server";
import ShopClient from "./ShopClient";
import {
  deriveSizeBucket,
  SIZE_BUCKET_ORDER,
  type SizeBucket,
} from "@/lib/sizeBucket";
import { STYLE_TAGS } from "@/lib/styleTags";

export const metadata = {
  title: "Shop | KORA",
  description: "Every piece, ready to rent.",
};

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    filter?: string;
    sort?: string;
    brand?: string;
    size?: string;
    color?: string;
    style?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("items")
    .select(
      `
      sku,
      name,
      size,
      color,
      tags,
      rental_price,
      status,
      website_status,
      date_added,
      measurements,
      brands ( name ),
      item_images ( image_url, display_order )
    `,
    )
    .eq("website_status", "Published")
    .eq("is_archived", false)
    .order("date_added", { ascending: false });

  // Flatten + normalise the shape the client expects.
  const normalised = (items || []).map((i: any) => {
    const images = (i.item_images || [])
      .sort((a: any, b: any) => a.display_order - b.display_order)
      .map((im: any) => im.image_url);

    const tags: string[] = (i.tags || []).map((t: string) => t.toLowerCase());
    let derivedCategory = "dresses";
    if (tags.includes("kebaya") || tags.includes("kaftan"))
      derivedCategory = "traditional";

    const sizeBucket = deriveSizeBucket({
      size: i.size,
      measurements: i.measurements,
    });

    return {
      sku: i.sku,
      name: i.name,
      brand: i.brands?.name || "",
      size: i.size || "",
      sizeBucket,
      color: i.color || "",
      rentalPrice: Number(i.rental_price) || 0,
      status: i.status,
      tags: i.tags || [],
      coverImage: images[0] || null,
      images,
      dateAdded: i.date_added,
      category: derivedCategory,
    };
  });

  // Only show items that are physically rentable.
  const availableItems = normalised.filter((i) => i.status === "Available");

  // Facets — computed from the *available* set so counts are honest.
  const brandSet = new Set<string>();
  const sizeBucketSet = new Set<SizeBucket>();
  const colorSet = new Set<string>();
  const styleSet = new Set<string>();

  for (const i of availableItems) {
    if (i.brand) brandSet.add(i.brand);
    if (i.sizeBucket) sizeBucketSet.add(i.sizeBucket);
    if (i.color) colorSet.add(i.color);

    // Style facet — only the canonical 4 ever surface, matched
    // case-insensitively against whatever tags the item carries.
    for (const t of i.tags || []) {
      const lower = String(t).toLowerCase();
      const canonical = STYLE_TAGS.find((s) => s.toLowerCase() === lower);
      if (canonical) styleSet.add(canonical);
    }
  }

  // Preserve canonical ordering — XS · S · M · L · XL · Free Size
  const sizeBuckets = SIZE_BUCKET_ORDER.filter((b) => sizeBucketSet.has(b));
  const colors = Array.from(colorSet).sort();
  const brands = Array.from(brandSet).sort();
  // STYLE_TAGS order (Mini · Midi · Maxi · Hijab Friendly)
  const styles = STYLE_TAGS.filter((s) => styleSet.has(s));

  return (
    <ShopClient
      items={availableItems}
      facets={{ brands, sizeBuckets, colors, styles }}
      initial={{
        q: params.q || "",
        category: params.category || "",
        filter: params.filter || "",
        sort: params.sort || "date-desc",
        brand: params.brand || "",
        size: params.size || "",
        color: params.color || "",
        style: params.style || "",
      }}
    />
  );
}

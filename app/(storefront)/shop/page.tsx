import { createClient } from "@/lib/supabase/server";
import ShopClient from "./ShopClient";

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
  }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("items")
    .select(`
      sku,
      name,
      size,
      color,
      tags,
      rental_price,
      status,
      website_status,
      date_added,
      brands ( name ),
      item_images ( image_url, display_order )
    `)
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
    if (tags.includes("kebaya") || tags.includes("kaftan")) derivedCategory = "traditional";

    return {
      sku: i.sku,
      name: i.name,
      brand: i.brands?.name || "",
      size: i.size || "",
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
  const sizeSet = new Set<string>();
  const colorSet = new Set<string>();
  for (const i of availableItems) {
    if (i.brand) brandSet.add(i.brand);
    if (i.size) sizeSet.add(i.size);
    if (i.color) colorSet.add(i.color);
  }

  const sizes = Array.from(sizeSet).sort(sortSizes);
  const colors = Array.from(colorSet).sort();
  const brands = Array.from(brandSet).sort();

  return (
    <ShopClient
      items={availableItems}
      facets={{ brands, sizes, colors }}
      initial={{
        q: params.q || "",
        category: params.category || "",
        filter: params.filter || "",
        sort: params.sort || "date-desc",
        brand: params.brand || "",
        size: params.size || "",
        color: params.color || "",
      }}
    />
  );
}

/** Standard sizes first (XS→XXL), then everything else alphabetical. */
const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
function sortSizes(a: string, b: string) {
  const ai = SIZE_ORDER.indexOf(a.toUpperCase());
  const bi = SIZE_ORDER.indexOf(b.toUpperCase());
  if (ai !== -1 && bi !== -1) return ai - bi;
  if (ai !== -1) return -1;
  if (bi !== -1) return 1;
  return a.localeCompare(b);
}

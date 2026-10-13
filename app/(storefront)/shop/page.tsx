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

/* ── Storefront category taxonomy ────────────────────────────────── */

// Types table names that map to the "Accessories" storefront category.
const ACCESSORY_TYPES = [
  "veil",
  "belt / sash",
  "belt/sash",
  "jewelry",
  "bag / clutch",
  "bag/clutch",
];

// Types that map to the "Traditional" derived bucket. Not exposed as a
// dropdown link but preserved as a URL param for deep links.
const TRADITIONAL_TYPES = ["kebaya", "kaftan"];

type StoreCategory = "dresses" | "traditional" | "accessories";

/**
 * Maps an item's `types.name` (plus any tag-based signal) to the
 * storefront's public category. Defaults to "dresses" — the catch-all
 * for any wearable garment (Dress, Set / Outer, Top, etc.).
 */
function deriveStoreCategory(
  typeName: string | null | undefined,
  tags: string[],
): StoreCategory {
  const t = String(typeName || "")
    .trim()
    .toLowerCase();
  const lowerTags = (tags || []).map((x) => String(x).toLowerCase());

  if (ACCESSORY_TYPES.includes(t)) return "accessories";
  if (TRADITIONAL_TYPES.includes(t)) return "traditional";
  if (lowerTags.includes("kebaya") || lowerTags.includes("kaftan")) {
    return "traditional";
  }
  return "dresses";
}

/* ── Date helpers ────────────────────────────────────────────────── */

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toISODate(dt);
}

/* ── Page ────────────────────────────────────────────────────────── */

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
      buffer_override,
      brands ( name ),
      types ( name, default_buffer_days ),
      item_images ( image_url, display_order )
    `,
    )
    .eq("website_status", "Published")
    .eq("is_archived", false)
    .order("date_added", { ascending: false });

  const rawItems = items || [];
  const skus = rawItems.map((i: any) => i.sku);

  /* ── Availability computation ──────────────────────────────────────
     "Available This Week" means: the item's rental window does not
     overlap the next 7 days, taking turnaround buffer into account.
  */
  const todayISO = toISODate(new Date());
  const weekAheadISO = addDaysISO(todayISO, 7);

  // Per-item buffer lookup — mirrors the fallback chain used by
  // guardAvailability (lib/orderLifecycle.ts).
  const bufferMap: Record<string, number> = {};
  for (const i of rawItems) {
    bufferMap[i.sku] =
      i.buffer_override ?? (i.types as any)?.default_buffer_days ?? 2;
  }

  const { data: conflicting } =
    skus.length > 0
      ? await supabase
          .from("order_products")
          .select(
            `
            item_sku,
            orders!inner ( id, pickup_date, return_date, status )
          `,
          )
          .in("item_sku", skus)
          .in("orders.status", ["Ordered", "In Shipping", "Active"])
          // Rough SQL cut — client-side filter below is authoritative.
          .gte("orders.return_date", addDaysISO(todayISO, -30))
      : { data: [] };

  const busyThisWeek = new Set<string>();
  for (const b of conflicting || []) {
    const order = (b as any).orders;
    if (!order?.pickup_date || !order.return_date) continue;

    const buffer = bufferMap[b.item_sku] ?? 2;
    const windowStart = order.pickup_date;
    const windowEnd = addDaysISO(order.return_date, buffer);

    // Overlap test against [today, today + 7].
    if (windowStart <= weekAheadISO && windowEnd >= todayISO) {
      busyThisWeek.add(b.item_sku);
    }
  }

  /* ── Normalise the shape the client expects ──────────────────────── */

  const normalised = rawItems.map((i: any) => {
    const images = (i.item_images || [])
      .sort((a: any, b: any) => a.display_order - b.display_order)
      .map((im: any) => im.image_url);

    const tags: string[] = i.tags || [];
    const category = deriveStoreCategory(i.types?.name, tags);

    const sizeBucket = deriveSizeBucket({
      size: i.size,
      measurements: i.measurements,
    });

    return {
      sku: i.sku,
      name: i.name,
      brand: i.brands?.name || "",
      type: i.types?.name || "",
      size: i.size || "",
      sizeBucket,
      color: i.color || "",
      rentalPrice: Number(i.rental_price) || 0,
      status: i.status,
      tags,
      coverImage: images[0] || null,
      images,
      dateAdded: i.date_added,
      category,
      availableThisWeek: !busyThisWeek.has(i.sku),
    };
  });

  // Only show items that are physically rentable right now.
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

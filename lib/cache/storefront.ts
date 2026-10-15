// Cached data fetchers for read-heavy, low-churn storefront tables.
//
// Every fetcher uses `unstable_cache` with:
//   • a short revalidate window (safety net)
//   • a tag so admin writes can invalidate instantly
//
// They must NOT use `createClient()` from `lib/supabase/server` because
// that reads cookies — a dynamic data source forbidden inside `unstable_cache`.

import { unstable_cache } from "next/cache";
import { createStaticClient } from "@/lib/supabase/static";

/* ── Items ────────────────────────────────────────────────────────── */

export const getCachedShopRawItems = unstable_cache(
  async () => {
    const supabase = createStaticClient();
    const { data } = await supabase
      .from("items")
      .select(
        `
        sku,
        name,
        size,
        color,
        tags,
        rental_price,
        add_on_price,
        status,
        website_status,
        date_added,
        buffer_override,
        measurements,
        brands ( name ),
        types ( name, default_buffer_days ),
        item_images ( image_url, display_order )
      `,
      )
      .eq("website_status", "Published")
      .eq("is_archived", false)
      .order("date_added", { ascending: false });

    return data || [];
  },
  ["shop-raw-items"],
  { revalidate: 60, tags: ["items"] },
);

/* ── Deposit tiers ────────────────────────────────────────────────── */

export interface DepositTier {
  price_up_to: number;
  deposit_value: number;
}

export const getCachedDepositTiers = unstable_cache(
  async (): Promise<DepositTier[]> => {
    const supabase = createStaticClient();
    const { data } = await supabase
      .from("deposit_tiers")
      .select("price_up_to, deposit_value")
      .order("price_up_to", { ascending: true });

    return (data || []).map((t: any) => ({
      price_up_to: Number(t.price_up_to),
      deposit_value: Number(t.deposit_value),
    }));
  },
  ["deposit-tiers"],
  { revalidate: 300, tags: ["settings", "deposit-tiers"] },
);

/* ── Rental rules ─────────────────────────────────────────────────── */

export interface RentalRules {
  late_fee_schedule?: { label: string; fee: number }[];
  period?: Record<string, unknown>;
  [k: string]: unknown;
}

export const getCachedRentalRules = unstable_cache(
  async (): Promise<RentalRules | null> => {
    const supabase = createStaticClient();
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "rental_rules")
      .single();

    return (data?.value as RentalRules) || null;
  },
  ["rental-rules"],
  { revalidate: 300, tags: ["settings", "rental-rules"] },
);

/* ── Brands / Types / Categories ──────────────────────────────────── */

export interface NamedRef {
  id: number;
  name: string;
}

export const getCachedBrands = unstable_cache(
  async (): Promise<NamedRef[]> => {
    const supabase = createStaticClient();
    const { data } = await supabase
      .from("brands")
      .select("id, name")
      .order("name");
    return data || [];
  },
  ["brands"],
  { revalidate: 300, tags: ["reference"] },
);

export const getCachedTypes = unstable_cache(
  async (): Promise<NamedRef[]> => {
    const supabase = createStaticClient();
    const { data } = await supabase
      .from("types")
      .select("id, name")
      .order("name");
    return data || [];
  },
  ["types"],
  { revalidate: 300, tags: ["reference"] },
);

export const getCachedCategories = unstable_cache(
  async (): Promise<NamedRef[]> => {
    const supabase = createStaticClient();
    const { data } = await supabase
      .from("categories")
      .select("id, name")
      .order("name");
    return data || [];
  },
  ["categories"],
  { revalidate: 300, tags: ["reference"] },
);

/* ── Product detail (item + related + accessories + shipping) ─────── */

export interface ProductDetailItem {
  sku: string;
  name: string;
  brand: string;
  type: string;
  description: string;
  size: string;
  color: string;
  tags: string[];
  /**
   * Base per-rental-day price (Day 1 charge). Sourced from
   * `items.rental_price`.
   */
  rentalPrice: number;
  /**
   * Per-extra-day rate charged for every rental day beyond Day 1.
   * Sourced from `items.add_on_price`. Falls back to `rentalPrice` when
   * the DB column is null — Q1 semantics ("null add-on = same as base").
   * Post-backfill this fallback should never trigger; it exists purely
   * as defence against a stale cache or a manually-inserted row.
   */
  addOnPrice: number;
  measurements: Record<string, any>;
  images: string[];
}

export interface ProductDetailRelated {
  sku: string;
  name: string;
  rentalPrice: number;
  coverImage: string | null;
}

export interface ProductDetailAccessory {
  sku: string;
  name: string;
  rentalPrice: number;
  image: string | null;
}

export interface ProductDetailLeadTime {
  prefix: string;
  region: string;
  days: number;
}

export interface ProductDetailPayload {
  item: ProductDetailItem | null;
  relatedItems: ProductDetailRelated[];
  accessories: ProductDetailAccessory[];
  deliveryLeadTimes: ProductDetailLeadTime[];
}

// Single cached fetcher for the entire product page. Items + shipping +
// accessories fire in parallel; related + filler collapse into one query
// with an in-memory same-brand sort.
//
// Tagged 'items' so admin edits (revalidateTag('items', 'max')) bust this
// along with the shop list. SKU normalization happens at the call site
// so 'zm19' and 'ZM19' share one cache entry.
export const getCachedProductDetail = unstable_cache(
  async (sku: string): Promise<ProductDetailPayload> => {
    const canonicalSku = sku.toUpperCase();
    const supabase = createStaticClient();

    const [itemRes, shippingRes, accessoriesRes] = await Promise.all([
      supabase
        .from("items")
        .select(
          `
          sku, name, description, size, color, tags, rental_price, add_on_price, measurements,
          brands ( id, name ),
          types ( name ),
          item_images ( image_url, display_order )
        `,
        )
        .eq("sku", canonicalSku)
        .eq("website_status", "Published")
        .eq("is_archived", false)
        .maybeSingle(),

      supabase
        .from("app_settings")
        .select("value")
        .eq("key", "shipping")
        .single(),

      supabase
        .from("items")
        .select(
          "sku, name, rental_price, item_images(image_url, display_order)",
        )
        .eq("website_status", "Published")
        .eq("is_archived", false)
        .eq("status", "Available")
        .neq("sku", canonicalSku)
        .limit(3),
    ]);

    const item = itemRes.data;

    if (!item) {
      return {
        item: null,
        relatedItems: [],
        accessories: [],
        deliveryLeadTimes: [],
      };
    }

    const brandId = (item.brands as any)?.id;

    // One query for related + filler. Over-fetch, sort same-brand first
    // in memory, take the top 4.
    const { data: relatedData } = await supabase
      .from("items")
      .select(
        `
        sku, name, rental_price,
        brands ( id ),
        item_images ( image_url, display_order )
      `,
      )
      .eq("website_status", "Published")
      .eq("is_archived", false)
      .eq("status", "Available")
      .neq("sku", canonicalSku)
      .limit(12);

    const sortedRelated = (relatedData || [])
      .slice()
      .sort((a: any, b: any) => {
        const aMatch = (a.brands as any)?.id === brandId ? 1 : 0;
        const bMatch = (b.brands as any)?.id === brandId ? 1 : 0;
        return bMatch - aMatch;
      })
      .slice(0, 4);

    const relatedItems: ProductDetailRelated[] = sortedRelated.map((r: any) => {
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

    const accessories: ProductDetailAccessory[] = (
      accessoriesRes.data || []
    ).map((i: any) => {
      const imgs = (i.item_images || []).sort(
        (a: any, b: any) => a.display_order - b.display_order,
      );
      return {
        sku: i.sku,
        name: i.name,
        rentalPrice: Number(i.rental_price) || 0,
        image: imgs[0]?.image_url || null,
      };
    });

    const deliveryLeadTimes: ProductDetailLeadTime[] =
      (shippingRes.data?.value?.delivery_lead_times as any[]) || [];

    const images = (item.item_images || [])
      .slice()
      .sort((a: any, b: any) => a.display_order - b.display_order)
      .map((im: any) => im.image_url);

    // Q1 fallback: null add_on_price means "same as base rental price".
    // After Step 1's backfill this should never actually fire, but we
    // keep it defensive so a stale cache or a manually-inserted row
    // can never produce NaN / undefined downstream.
    const rentalPrice = Number(item.rental_price) || 0;
    const addOnPrice =
      item.add_on_price != null ? Number(item.add_on_price) : rentalPrice;

    return {
      item: {
        sku: item.sku,
        name: item.name,
        brand: (item.brands as any)?.name || "",
        type: (item.types as any)?.name || "",
        description: item.description || "",
        size: item.size || "",
        color: item.color || "",
        tags: item.tags || [],
        rentalPrice,
        addOnPrice,
        measurements: item.measurements || {},
        images,
      },
      relatedItems,
      accessories,
      deliveryLeadTimes,
    };
  },
  ["product-detail"],
  { revalidate: 300, tags: ["items"] },
);

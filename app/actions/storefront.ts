"use server";

import { createClient } from "@/lib/supabase/server";

/* ── Date helpers (local, no deps) ─────────────────────────────────── */

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDays(s: string, n: number): string {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Today's date in Asia/Jakarta, as YYYY-MM-DD. */
function todayJakartaISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(
    new Date(),
  );
}

/* ── Availability map for a single SKU, one month ──────────────────── */

/**
 * Returns a per-day free/busy map for the requested month.
 *
 * A day D is `true` if the SKU is NOT committed to any active order on that
 * specific calendar day (existing order windows are expanded by the item-type
 * turnaround buffer). This lets the caller validate arbitrary-length rental
 * windows (delivery → event day(s) → rest → return) by checking that every
 * day in the proposed range returns `true`.
 */
export async function getSkuAvailabilityMap(
  sku: string,
  year: number,
  month: number,
): Promise<Record<string, boolean>> {
  const supabase = await createClient();
  const daysInMonth = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, "0");
  const monthStart = `${year}-${mm}-01`;
  const monthEnd = `${year}-${mm}-${String(daysInMonth).padStart(2, "0")}`;

  const buildAllFalse = () => {
    const m: Record<string, boolean> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      m[`${year}-${mm}-${String(d).padStart(2, "0")}`] = false;
    }
    return m;
  };

  const { data: item } = await supabase
    .from("items")
    .select(
      "sku, status, is_archived, buffer_override, types(default_buffer_days)",
    )
    .ilike("sku", sku)
    .maybeSingle();

  if (!item || item.is_archived || item.status !== "Available") {
    return buildAllFalse();
  }

  const bufferDays =
    item.buffer_override ?? (item.types as any)?.default_buffer_days ?? 2;

  const fetchStart = addDays(monthStart, -(bufferDays + 30));
  const fetchEnd = addDays(monthEnd, bufferDays + 30);

  const { data: conflicts } = await supabase
    .from("order_products")
    .select("item_sku, orders!inner(id, pickup_date, return_date, status)")
    .eq("item_sku", item.sku)
    .not("orders.status", "in", '("Cancelled", "Draft")')
    .gte("orders.return_date", fetchStart)
    .lte("orders.pickup_date", fetchEnd);

  const blockedIntervals: { start: number; end: number }[] = [];
  for (const c of conflicts || []) {
    const o = (c as any).orders;
    if (!o.pickup_date || !o.return_date) continue;
    const start = parseISO(o.pickup_date).getTime();
    const end = parseISO(addDays(o.return_date, bufferDays)).getTime();
    blockedIntervals.push({ start, end });
  }

  const map: Record<string, boolean> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = `${year}-${mm}-${String(d).padStart(2, "0")}`;
    const dayTime = parseISO(dayStr).getTime();

    let available = true;
    for (const interval of blockedIntervals) {
      if (dayTime >= interval.start && dayTime <= interval.end) {
        available = false;
        break;
      }
    }
    map[dayStr] = available;
  }
  return map;
}

/* ── Weekly fitting-slot grid ──────────────────────────────────────── */

export interface WeekSlot {
  slot: string;
  end: string;
  available: boolean;
  isAfterHours: boolean;
  fee: number;
}
export type WeekGrid = Record<string, WeekSlot[]>;

/**
 * Weekly grid of fitting slots.
 *
 * H-1 rule: a fitting must be booked at least one day in advance. Days
 * whose date is today or earlier are returned as an empty array.
 */
export async function getWeekSlots(
  weekStart: string,
  excludeFittingId?: string,
): Promise<WeekGrid> {
  const supabase = await createClient();
  const todayStr = todayJakartaISO();

  const { data: settings } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "fittings")
    .single();

  const afterHoursFee =
    Number(settings?.value?.session_rules?.after_hours_fee) || 100000;

  const weekEnd = addDays(weekStart, 6);
  const { data: booked } = await supabase
    .from("fittings")
    .select("id, date, slot, status")
    .gte("date", weekStart)
    .lte("date", weekEnd)
    .not("status", "in", '("Cancelled", "Conflict Evicted", "No Show")');

  const bookedSet = new Set(
    (booked || [])
      .filter((b: any) => !excludeFittingId || b.id !== excludeFittingId)
      .map((b: any) => `${b.date}|${(b.slot || "").slice(0, 5)}`),
  );

  const grid: WeekGrid = {};
  for (let i = 0; i < 7; i++) {
    const dateStr = addDays(weekStart, i);

    // H-1 guard: today and every earlier day is unbookable.
    if (dateStr <= todayStr) {
      grid[dateStr] = [];
      continue;
    }

    const dt = parseISO(dateStr);
    const dow = dt.getDay();

    if (dow === 0) {
      grid[dateStr] = [];
      continue;
    }

    const slots: WeekSlot[] = [];
    if (dow >= 1 && dow <= 5) {
      for (let h = 10; h < 17; h++) {
        const s = `${String(h).padStart(2, "0")}:00`;
        slots.push({
          slot: s,
          end: `${String(h + 1).padStart(2, "0")}:00`,
          available: !bookedSet.has(`${dateStr}|${s}`),
          isAfterHours: false,
          fee: 0,
        });
      }
      slots.push({
        slot: "17:00",
        end: "18:00",
        available: !bookedSet.has(`${dateStr}|17:00`),
        isAfterHours: true,
        fee: afterHoursFee,
      });
    } else if (dow === 6) {
      for (let h = 10; h < 13; h++) {
        const s = `${String(h).padStart(2, "0")}:00`;
        slots.push({
          slot: s,
          end: `${String(h + 1).padStart(2, "0")}:00`,
          available: !bookedSet.has(`${dateStr}|${s}`),
          isAfterHours: false,
          fee: 0,
        });
      }
      for (let h = 13; h < 15; h++) {
        const s = `${String(h).padStart(2, "0")}:00`;
        slots.push({
          slot: s,
          end: `${String(h + 1).padStart(2, "0")}:00`,
          available: !bookedSet.has(`${dateStr}|${s}`),
          isAfterHours: true,
          fee: afterHoursFee,
        });
      }
    }
    grid[dateStr] = slots;
  }
  return grid;
}

/* ── Accessories for "Complete Your Look" ──────────────────────────── */

export async function getAccessoriesForLook(excludeSku: string, limit = 3) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("items")
    .select("sku, name, rental_price, item_images(image_url, display_order)")
    .eq("website_status", "Published")
    .eq("is_archived", false)
    .eq("status", "Available")
    .neq("sku", excludeSku)
    .limit(limit);

  return (data || []).map((i: any) => {
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
}

/* ── Header search auto-suggest ────────────────────────────────────── */

export interface SearchProductHit {
  sku: string;
  name: string;
  brand: string;
  rentalPrice: number;
  coverImage: string | null;
  snippet: string;
}

export interface SearchPageHit {
  title: string;
  subtitle: string;
  href: string;
}

const SITE_PAGES: Array<{
  title: string;
  subtitle: string;
  href: string;
  keywords: string;
}> = [
  {
    title: "Home",
    subtitle: "New arrivals, editorial picks, and how to rent.",
    href: "/",
    keywords: "home index main landing",
  },
  {
    title: "Shop",
    subtitle: "Browse the full collection — dresses, accessories, traditional.",
    href: "/shop",
    keywords: "shop all browse collection catalog dresses accessories",
  },
  {
    title: "New Arrivals",
    subtitle: "Fresh in, ready to rent.",
    href: "/shop?filter=new",
    keywords: "new arrival latest fresh just added",
  },
  {
    title: "Available This Week",
    subtitle: "Pieces ready for your next event.",
    href: "/shop?filter=available-now",
    keywords: "available this week ready now",
  },
  {
    title: "How to Rent",
    subtitle: "Designer dresses, five simple steps.",
    href: "/how-to-rent",
    keywords: "how rent guide steps process deposit refund",
  },
  {
    title: "About Kora",
    subtitle: "For the girl with a full calendar.",
    href: "/about",
    keywords: "about story brand showroom contact",
  },
  {
    title: "Terms & Conditions",
    subtitle: "Rental terms, deposit and refund policy.",
    href: "/terms",
    keywords: "terms conditions legal policy rules",
  },
];

/**
 * Powers the header search panel. Returns up to 6 product hits plus up to
 * 4 static page suggestions. Runs two product queries — one on the item
 * row itself (name/sku/description), one on brand names — and merges the
 * results, deduped by SKU.
 */
export async function searchProductsAndPages(query: string) {
  const raw = (query || "").trim();
  if (raw.length < 2) return { products: [], pages: [] };

  // Strip PostgREST-illegal characters used in the .or() filter syntax.
  const safeQ = raw.replace(/[%,()]/g, "");
  if (safeQ.length < 2) return { products: [], pages: [] };

  const supabase = await createClient();

  const itemSelect = `
    sku, name, description, rental_price,
    brands ( name ),
    item_images ( image_url, display_order )
  `;

  const [directRes, brandsRes] = await Promise.all([
    supabase
      .from("items")
      .select(itemSelect)
      .eq("website_status", "Published")
      .eq("is_archived", false)
      .or(
        `name.ilike.%${safeQ}%,sku.ilike.%${safeQ}%,description.ilike.%${safeQ}%`,
      )
      .limit(6),
    supabase.from("brands").select("id").ilike("name", `%${safeQ}%`),
  ]);

  const brandIds = (brandsRes.data || []).map((b: any) => b.id);

  let brandItems: any[] = [];
  if (brandIds.length > 0) {
    const { data } = await supabase
      .from("items")
      .select(itemSelect)
      .eq("website_status", "Published")
      .eq("is_archived", false)
      .in("brand_id", brandIds)
      .limit(6);
    brandItems = data || [];
  }

  const seen = new Set<string>();
  const merged = [...(directRes.data || []), ...brandItems].filter((p: any) => {
    if (seen.has(p.sku)) return false;
    seen.add(p.sku);
    return true;
  });

  const products: SearchProductHit[] = merged.slice(0, 6).map((p: any) => {
    const imgs = (p.item_images || []).sort(
      (a: any, b: any) => a.display_order - b.display_order,
    );
    const desc = (p.description || "").replace(/\s+/g, " ").trim();
    return {
      sku: p.sku,
      name: p.name,
      brand: p.brands?.name || "",
      rentalPrice: Number(p.rental_price) || 0,
      coverImage: imgs[0]?.image_url || null,
      snippet: desc.length > 90 ? `${desc.slice(0, 90)}…` : desc,
    };
  });

  const lowerQ = safeQ.toLowerCase();
  const pages: SearchPageHit[] = SITE_PAGES.filter(
    (p) =>
      p.title.toLowerCase().includes(lowerQ) ||
      p.subtitle.toLowerCase().includes(lowerQ) ||
      p.keywords.includes(lowerQ),
  )
    .slice(0, 4)
    .map(({ title, subtitle, href }) => ({ title, subtitle, href }));

  return { products, pages };
}

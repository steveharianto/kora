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

/* ── Availability map for a single SKU, one month ──────────────────── */

/**
 * Returns a per-day availability map for the requested month.
 * "Available" means: a fresh 4-day rental starting on that day would not
 * collide with any active order (including the item-type turnaround buffer).
 */
export async function getSkuAvailabilityMap(
  sku: string,
  year: number,
  month: number, // 1-12
): Promise<Record<string, boolean>> {
  const supabase = await createClient();
  const RENTAL_LEN = 4;
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
    .select("sku, status, is_archived, buffer_override, types(default_buffer_days)")
    .ilike("sku", sku)
    .maybeSingle();

  if (!item || item.is_archived || item.status !== "Available") {
    return buildAllFalse();
  }

  const bufferDays =
    item.buffer_override ?? (item.types as any)?.default_buffer_days ?? 2;

  const fetchStart = addDays(monthStart, -(bufferDays + RENTAL_LEN));
  const fetchEnd = addDays(monthEnd, bufferDays + RENTAL_LEN);

  const { data: conflicts } = await supabase
    .from("order_products")
    .select("item_sku, orders!inner(id, pickup_date, return_date, status)")
    .eq("item_sku", item.sku)
    .not("orders.status", "in", '("Cancelled", "Draft")')
    .gte("orders.return_date", fetchStart)
    .lte("orders.pickup_date", fetchEnd);

  const map: Record<string, boolean> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = `${year}-${mm}-${String(d).padStart(2, "0")}`;
    const winStart = parseISO(dayStr).getTime();
    const winEnd = parseISO(addDays(dayStr, RENTAL_LEN - 1)).getTime();

    let available = true;
    for (const c of conflicts || []) {
      const o = (c as any).orders;
      if (!o.pickup_date || !o.return_date) continue;
      const existStart = parseISO(o.pickup_date).getTime();
      const existEnd = parseISO(addDays(o.return_date, bufferDays)).getTime();
      if (winStart <= existEnd && winEnd >= existStart) {
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
  slot: string;        // "10:00"
  end: string;         // "11:00"
  available: boolean;
  isAfterHours: boolean;
  fee: number;
}
export type WeekGrid = Record<string, WeekSlot[]>; // keyed YYYY-MM-DD

export async function getWeekSlots(weekStart: string): Promise<WeekGrid> {
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "fittings")
    .single();

  const afterHoursFee = Number(settings?.value?.session_rules?.after_hours_fee) || 100000;

  const weekEnd = addDays(weekStart, 6);
  const { data: booked } = await supabase
    .from("fittings")
    .select("date, slot, status")
    .gte("date", weekStart)
    .lte("date", weekEnd)
    .not("status", "in", '("Cancelled", "Conflict Evicted", "No Show")');

  const bookedSet = new Set(
    (booked || []).map((b: any) => `${b.date}|${(b.slot || "").slice(0, 5)}`),
  );

  const grid: WeekGrid = {};
  for (let i = 0; i < 7; i++) {
    const dateStr = addDays(weekStart, i);
    const dt = parseISO(dateStr);
    const dow = dt.getDay(); // 0=Sun

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

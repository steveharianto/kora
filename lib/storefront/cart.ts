/* Storefront cart — pure localStorage module, no React. */

export interface RentalCartItem {
  sku: string;
  name: string;
  /**
   * Base per-rental-day price in IDR. Day 1 is always billed at this rate.
   */
  price: number;
  /**
   * Per-extra-day rate in IDR, charged for every rental day beyond Day 1.
   * Day 2 costs `addOnPrice`, Day 3 costs `addOnPrice`, and so on.
   *
   * A value of 0 means extra days are free. Legacy cart entries written
   * before the multi-day pricing feature shipped do not carry this field;
   * `readRentalCart()` backfills them with `price` so their totals stay
   * `base × days` — the same number they rendered before the feature.
   */
  addOnPrice: number;
  /** Number of event days the customer selected. */
  eventDays: number;
  image: string | null;
  rentalStart: string; // YYYY-MM-DD — delivery / pickup day
  rentalEnd: string; // YYYY-MM-DD — return deadline
  eventStart: string; // YYYY-MM-DD — first event day
  eventEnd: string; // YYYY-MM-DD — last event day
  postalCode: string;
  accessories: string[];
}

export interface FittingCartItem {
  sku: string;
  name: string;
  price: number;
  image: string | null;
}

export interface FittingSession {
  date: string;
  slot: string;
  fee: number;
  isAfterHours: boolean;
  items: FittingCartItem[];
}

const RENTAL_KEY = "kora_rental_cart";
const FITTING_KEY = "kora_fitting_cart";
const EVENT = "kora-cart-updated";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

/* ── Rental cart ──────────────────────────────────────────────────── */

export function readRentalCart(): RentalCartItem[] {
  if (typeof window === "undefined") return [];
  const raw = safeParse<any[]>(localStorage.getItem(RENTAL_KEY), []);

  return raw
    .filter(
      (x) =>
        x &&
        typeof x === "object" &&
        typeof x.sku === "string" &&
        typeof x.price === "number" &&
        typeof x.rentalStart === "string" &&
        typeof x.rentalEnd === "string",
    )
    .map((x) => {
      /*
       * addOnPrice coercion:
       *
       *   • Valid (number, >= 0)          → use as-is.
       *   • Missing (legacy cart entry),   → default to `price` so the
       *     null, NaN, negative, string,      historical total is preserved:
       *     or otherwise malformed             base + base × (days−1)
       *                                          == base × days
       *
       * Q1 semantics: a null add-on price at the DB level means "same as
       * base rental price". This mirrors that rule at the cart layer so a
       * returning customer's saved cart behaves identically to a freshly
       * constructed one.
       *
       * We do NOT default to 0 (free) — that would silently discount extra
       * days on every legacy cart and change what the customer owes.
       */
      const price = typeof x.price === "number" ? x.price : 0;
      const addOnPrice =
        typeof x.addOnPrice === "number" && x.addOnPrice >= 0
          ? x.addOnPrice
          : price;

      return {
        sku: x.sku,
        name: x.name || "",
        price,
        addOnPrice,
        // Backward-compat: older cart entries have no eventDays — treat as 1.
        eventDays:
          typeof x.eventDays === "number" && x.eventDays >= 1 ? x.eventDays : 1,
        image: x.image ?? null,
        rentalStart: x.rentalStart,
        rentalEnd: x.rentalEnd,
        eventStart:
          typeof x.eventStart === "string" ? x.eventStart : x.rentalStart,
        eventEnd: typeof x.eventEnd === "string" ? x.eventEnd : x.rentalEnd,
        postalCode: typeof x.postalCode === "string" ? x.postalCode : "",
        accessories: Array.isArray(x.accessories) ? x.accessories : [],
      };
    }) as RentalCartItem[];
}

export function writeRentalCart(items: RentalCartItem[]) {
  localStorage.setItem(RENTAL_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(EVENT));
}

export function countRentalCart(): number {
  return readRentalCart().length;
}

/**
 * Line-item total for a rental line.
 *
 *   Day 1              → price
 *   Each extra day     → + addOnPrice
 *
 *   total = price + addOnPrice × (days − 1)
 *
 * Worked examples (base = 1.700.000, add-on = 400.000):
 *   1 day  → 1.700.000
 *   2 days → 1.700.000 + 400.000 × 1 = 2.100.000
 *   3 days → 1.700.000 + 400.000 × 2 = 2.500.000
 *
 * Edge cases:
 *   • addOnPrice = 0        → total = price (extra days free)
 *   • days = 0 or negative  → clamped to 1 by the `|| 1` guard and the
 *                             `Math.max(0, days - 1)` clamp on the
 *                             multiplier, so total = price
 *   • Legacy cart item with addOnPrice backfilled to `price`
 *                           → total = price × days (identical to the old
 *                             formula — no behaviour change)
 */
export function rentalLineTotal(item: RentalCartItem): number {
  const days = item.eventDays || 1;
  return (item.price || 0) + (item.addOnPrice || 0) * Math.max(0, days - 1);
}

/** Sum of all line totals. */
export function rentalCartSubtotal(items: RentalCartItem[]): number {
  return items.reduce((s, i) => s + rentalLineTotal(i), 0);
}

/* ── Fitting cart ─────────────────────────────────────────────────── */

export function readFittingCart(): FittingSession[] {
  if (typeof window === "undefined") return [];
  const raw = safeParse<any[]>(localStorage.getItem(FITTING_KEY), []);
  return raw
    .filter(
      (x) =>
        x &&
        typeof x === "object" &&
        typeof x.date === "string" &&
        typeof x.slot === "string" &&
        Array.isArray(x.items),
    )
    .map((x) => ({
      date: x.date,
      slot: x.slot,
      fee: typeof x.fee === "number" ? x.fee : 0,
      isAfterHours: Boolean(x.isAfterHours),
      items: (x.items as any[]).filter(
        (i) => i && typeof i.sku === "string" && typeof i.price === "number",
      ),
    }))
    .filter((s) => s.items.length > 0) as FittingSession[];
}

export function writeFittingCart(sessions: FittingSession[]) {
  localStorage.setItem(FITTING_KEY, JSON.stringify(sessions));
  window.dispatchEvent(new Event(EVENT));
}

export function countFittingCart(): number {
  return readFittingCart().reduce((n, s) => n + s.items.length, 0);
}

/* ── Helpers ──────────────────────────────────────────────────────── */

export function isAfterHoursSlot(dateStr: string, slot: string): boolean {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  const hour = parseInt(slot.split(":")[0], 10);
  if (dow === 6) return hour >= 13;
  return hour >= 17;
}

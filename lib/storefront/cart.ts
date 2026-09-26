/* Storefront cart — pure localStorage module, no React. */

export interface RentalCartItem {
  sku: string;
  name: string;
  /** Per-event-day rental price in IDR. Total for this line = price × eventDays. */
  price: number;
  /** Number of event days the customer selected. Multiplies `price`. */
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
    .map((x) => ({
      sku: x.sku,
      name: x.name || "",
      price: x.price,
      // Backward-compat: older cart entries have no eventDays — treat as 1.
      eventDays:
        typeof x.eventDays === "number" && x.eventDays >= 1 ? x.eventDays : 1,
      image: x.image ?? null,
      rentalStart: x.rentalStart,
      rentalEnd: x.rentalEnd,
      eventStart: typeof x.eventStart === "string" ? x.eventStart : x.rentalStart,
      eventEnd: typeof x.eventEnd === "string" ? x.eventEnd : x.rentalEnd,
      postalCode: typeof x.postalCode === "string" ? x.postalCode : "",
      accessories: Array.isArray(x.accessories) ? x.accessories : [],
    })) as RentalCartItem[];
}

export function writeRentalCart(items: RentalCartItem[]) {
  localStorage.setItem(RENTAL_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(EVENT));
}

export function countRentalCart(): number {
  return readRentalCart().length;
}

/** Line-item total: per-day price × number of event days. */
export function rentalLineTotal(item: RentalCartItem): number {
  return (item.price || 0) * (item.eventDays || 1);
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

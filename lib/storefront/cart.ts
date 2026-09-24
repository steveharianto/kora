/* Storefront cart — pure localStorage module, no React. */

export interface RentalCartItem {
  sku: string;
  name: string;
  price: number;
  image: string | null;
  rentalStart: string; // YYYY-MM-DD
  rentalEnd: string; // YYYY-MM-DD
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
  date: string; // YYYY-MM-DD
  slot: string; // "HH:MM"
  fee: number; // 0 for regular hours, >0 for after-hours
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
  // Drop any entry that doesn't match the current shape.
  return raw.filter(
    (x) =>
      x &&
      typeof x === "object" &&
      typeof x.sku === "string" &&
      typeof x.price === "number" &&
      typeof x.rentalStart === "string" &&
      typeof x.rentalEnd === "string",
  ) as RentalCartItem[];
}

export function writeRentalCart(items: RentalCartItem[]) {
  localStorage.setItem(RENTAL_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(EVENT));
}

export function countRentalCart(): number {
  return readRentalCart().length;
}

/* ── Fitting cart ─────────────────────────────────────────────────── */

export function readFittingCart(): FittingSession[] {
  if (typeof window === "undefined") return [];
  const raw = safeParse<any[]>(localStorage.getItem(FITTING_KEY), []);
  // Drop any entry that doesn't match the current shape (e.g. old {skus} format).
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

/** True if a slot falls inside after-hours for its day. */
export function isAfterHoursSlot(dateStr: string, slot: string): boolean {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  const hour = parseInt(slot.split(":")[0], 10);
  if (dow === 6) return hour >= 13;
  return hour >= 17;
}

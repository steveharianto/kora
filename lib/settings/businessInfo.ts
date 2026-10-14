// lib/settings/businessInfo.ts
//
// Client-safe helpers for the `business_info` app_setting.
//
// The setting now only carries `operating_hours` — showroom address,
// brand name, and contact numbers live in `lib/business/contactInfo.ts`
// as hardcoded constants (see that file for why).
//
// The normaliser tolerates three historical shapes for `operating_hours`:
//
//   v3 (current) — { mon: { open, close, closed }, tue: {...}, … }
//   v2           — { mon_fri_open, mon_fri_close, sat_open, sat_close }
//   v1 / null    — free-text string or missing row → defaults

/* ── Types ──────────────────────────────────────────────────────── */

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface DayHours {
  /** "HH:MM" 24-hour, e.g. "10:00". Ignored when `closed` is true. */
  open: string;
  close: string;
  /** When true, the showroom is closed on this day. */
  closed: boolean;
}

export type OperatingHours = Record<DayKey, DayHours>;

export const DAY_ORDER: DayKey[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

export const DAY_LABEL: Record<DayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

/* ── Defaults ───────────────────────────────────────────────────── */

/**
 * Returns a fresh default schedule on every call — avoids shared object
 * references leaking between React state trees.
 *
 *   Mon–Fri: 10:00–17:00 · Sat: 10:00–13:00 · Sun: closed
 */
export function defaultOperatingHours(): OperatingHours {
  const weekday: DayHours = { open: "10:00", close: "17:00", closed: false };
  const saturday: DayHours = { open: "10:00", close: "13:00", closed: false };
  const sunday: DayHours = { open: "10:00", close: "13:00", closed: true };
  return {
    mon: { ...weekday },
    tue: { ...weekday },
    wed: { ...weekday },
    thu: { ...weekday },
    fri: { ...weekday },
    sat: { ...saturday },
    sun: { ...sunday },
  };
}

export const DEFAULT_OPERATING_HOURS: OperatingHours = defaultOperatingHours();

/* ── Normalisers ────────────────────────────────────────────────── */

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function coerceTime(raw: unknown, fallback: string): string {
  if (typeof raw !== "string") return fallback;
  const t = raw.trim();
  return TIME_RE.test(t) ? t : fallback;
}

function coerceDay(raw: unknown): DayHours {
  if (!raw || typeof raw !== "object") {
    return { open: "10:00", close: "17:00", closed: false };
  }
  const r = raw as Record<string, unknown>;
  return {
    open: coerceTime(r.open, "10:00"),
    close: coerceTime(r.close, "17:00"),
    closed: Boolean(r.closed),
  };
}

export function normaliseOperatingHours(raw: unknown): OperatingHours {
  // v3
  if (raw && typeof raw === "object" && "mon" in raw) {
    const r = raw as Record<string, unknown>;
    const out = {} as OperatingHours;
    for (const key of DAY_ORDER) {
      out[key] = coerceDay(r[key]);
    }
    return out;
  }

  // v2
  if (raw && typeof raw === "object" && "mon_fri_open" in raw) {
    const r = raw as Record<string, unknown>;
    const weekday: DayHours = {
      open: coerceTime(r.mon_fri_open, "10:00"),
      close: coerceTime(r.mon_fri_close, "17:00"),
      closed: false,
    };
    const saturday: DayHours = {
      open: coerceTime(r.sat_open, "10:00"),
      close: coerceTime(r.sat_close, "13:00"),
      closed: false,
    };
    const sunday: DayHours = { open: "10:00", close: "13:00", closed: true };
    return {
      mon: { ...weekday },
      tue: { ...weekday },
      wed: { ...weekday },
      thu: { ...weekday },
      fri: { ...weekday },
      sat: { ...saturday },
      sun: { ...sunday },
    };
  }

  // v1 / null / garbage
  return defaultOperatingHours();
}

/* ── Display helpers ────────────────────────────────────────────── */

/**
 * "14:00" → "2 PM" · "14:30" → "2:30 PM" · "10:00" → "10 AM".
 * Matches the editorial style the storefront already uses.
 */
export function formatTime12(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return t;

  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return m === 0
    ? `${h12} ${ampm}`
    : `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function isSameDay(a: DayHours, b: DayHours): boolean {
  if (a.closed !== b.closed) return false;
  if (a.closed) return true;
  return a.open === b.open && a.close === b.close;
}

/**
 * Collapses the per-day schedule into footer-ready display lines, grouping
 * consecutive days with identical schedules:
 *
 *   Mon–Fri 10:00–17:00, Sat 10:00–13:00, Sun closed
 *     → ["Monday–Friday: 10 AM – 5 PM", "Saturday: 10 AM – 1 PM", "Sunday: Closed"]
 */
export function formatOperatingHoursLines(oh: OperatingHours): string[] {
  const lines: string[] = [];

  const emit = (startIdx: number, endExclusive: number) => {
    const day = oh[DAY_ORDER[startIdx]];
    const startLabel = DAY_LABEL[DAY_ORDER[startIdx]];
    const endLabel = DAY_LABEL[DAY_ORDER[endExclusive - 1]];
    const label =
      startIdx === endExclusive - 1 ? startLabel : `${startLabel}–${endLabel}`;

    if (day.closed) {
      lines.push(`${label}: Closed`);
    } else {
      lines.push(
        `${label}: ${formatTime12(day.open)} – ${formatTime12(day.close)}`,
      );
    }
  };

  let runStart = 0;
  for (let i = 1; i <= DAY_ORDER.length; i++) {
    const isEnd = i === DAY_ORDER.length;
    const same = !isEnd && isSameDay(oh[DAY_ORDER[i - 1]], oh[DAY_ORDER[i]]);

    if (isEnd || !same) {
      emit(runStart, i);
      runStart = i;
    }
  }

  return lines;
}

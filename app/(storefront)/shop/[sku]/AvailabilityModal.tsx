"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { getSkuAvailabilityMap } from "@/app/actions/storefront";

interface Accessory {
  sku: string;
  name: string;
  rentalPrice: number;
  image: string | null;
}

interface LeadTime {
  prefix: string;
  region: string;
  days: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sku: string;
  name: string;
  rentalPrice: number;
  accessories: Accessory[];
  deliveryLeadTimes: LeadTime[];
  onAdded: (payload: {
    sku: string;
    rentalStart: string;
    rentalEnd: string;
    eventStart: string;
    eventEnd: string;
    /** Number of event days — multiplies rentalPrice. */
    eventDays: number;
    postalCode: string;
    accessories: string[];
  }) => void;
}

const BASE_PREP_DAYS = 3;

/* ── Date helpers ────────────────────────────────────────────────── */

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
function cmpISO(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
function fmtShort(s: string): string {
  const [y, m, d] = s.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}
function fmtRupiah(n: number): string {
  return `Rp ${n.toLocaleString("id-ID")}`;
}
function nextMonth(y: number, m: number): { y: number; m: number } {
  return m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
}
function prevMonth(y: number, m: number): { y: number; m: number } {
  return m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
}
function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}
function monthLabel(y: number, m: number): string {
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}
function diffDays(a: string, b: string): number {
  return Math.round(
    (parseISO(b).getTime() - parseISO(a).getTime()) / 86400000,
  );
}
function isoOf(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/* ── Lead-time resolver ──────────────────────────────────────────── */

function resolveLead(
  postalCode: string,
  leadTimes: LeadTime[],
): { region: string; days: number } | null {
  if (!postalCode || postalCode.length < 5) return null;
  const p2 = postalCode.slice(0, 2);

  for (const lt of leadTimes) {
    if (lt.prefix.includes("-")) {
      const [s, e] = lt.prefix.replace("xxx", "").split("-");
      if (p2 >= s && p2 <= e) {
        return { region: lt.region, days: Number(lt.days) };
      }
    } else if (lt.prefix.startsWith(p2)) {
      return { region: lt.region, days: Number(lt.days) };
    }
  }

  const other = leadTimes.find((l) => l.prefix === "other");
  if (other) return { region: other.region, days: Number(other.days) };
  return { region: "Indonesia", days: 2 };
}

/* ── Calendar cell model ─────────────────────────────────────────── */

type CellOwner = "prev" | "current" | "next";

interface Cell {
  date: string;
  dayNum: number;
  owner: CellOwner;
  interactive: boolean;
}

function buildCells(year: number, month: number): Cell[] {
  const total = daysInMonth(year, month);
  const firstOfMonth = new Date(year, month - 1, 1);
  const firstDow = firstOfMonth.getDay();
  const offset = firstDow === 0 ? 6 : firstDow - 1;

  const prev = prevMonth(year, month);
  const prevTotal = daysInMonth(prev.y, prev.m);
  const next = nextMonth(year, month);

  const cells: Cell[] = [];

  for (let i = offset - 1; i >= 0; i--) {
    const d = prevTotal - i;
    cells.push({
      date: isoOf(prev.y, prev.m, d),
      dayNum: d,
      owner: "prev",
      interactive: false,
    });
  }

  for (let d = 1; d <= total; d++) {
    cells.push({
      date: isoOf(year, month, d),
      dayNum: d,
      owner: "current",
      interactive: true,
    });
  }

  const remainder = cells.length % 7;
  const trailingCount = remainder === 0 ? 0 : 7 - remainder;
  for (let d = 1; d <= trailingCount; d++) {
    cells.push({
      date: isoOf(next.y, next.m, d),
      dayNum: d,
      owner: "next",
      interactive: true,
    });
  }

  return cells;
}

/* ── Component ───────────────────────────────────────────────────── */

export default function AvailabilityModal({
  isOpen,
  onClose,
  sku,
  name,
  rentalPrice,
  accessories,
  deliveryLeadTimes,
  onAdded,
}: Props) {
  const todayISO = useMemo(() => toISO(new Date()), []);

  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);

  const [availCurrent, setAvailCurrent] = useState<Record<string, boolean>>({});
  const [availNext, setAvailNext] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  const [eventStart, setEventStart] = useState<string | null>(null);
  const [eventEnd, setEventEnd] = useState<string | null>(null);

  const [dragAnchor, setDragAnchor] = useState<string | null>(null);
  const [dragHover, setDragHover] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [postalCode, setPostalCode] = useState("");
  const [addedAccessories, setAddedAccessories] = useState<string[]>([]);
  const [rangeError, setRangeError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setEventStart(null);
    setEventEnd(null);
    setDragAnchor(null);
    setDragHover(null);
    setIsDragging(false);
    setPostalCode("");
    setAddedAccessories([]);
    setRangeError(null);
    const t = new Date();
    setYear(t.getFullYear());
    setMonth(t.getMonth() + 1);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    const next = nextMonth(year, month);
    (async () => {
      const [a1, a2] = await Promise.all([
        getSkuAvailabilityMap(sku, year, month),
        getSkuAvailabilityMap(sku, next.y, next.m),
      ]);
      if (!cancelled) {
        setAvailCurrent(a1);
        setAvailNext(a2);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, sku, year, month]);

  const availability = useMemo(
    () => ({ ...availCurrent, ...availNext }),
    [availCurrent, availNext],
  );

  const resolvedLead = useMemo(
    () => resolveLead(postalCode, deliveryLeadTimes),
    [postalCode, deliveryLeadTimes],
  );

  const earliestReceipt = useMemo(() => {
    const base = addDays(todayISO, BASE_PREP_DAYS);
    if (!resolvedLead) return base;
    return addDays(base, resolvedLead.days);
  }, [todayISO, resolvedLead]);

  const earliestEventStart = useMemo(
    () => addDays(earliestReceipt, 1),
    [earliestReceipt],
  );

  const previewRange = useMemo(() => {
    if (!isDragging || !dragAnchor || !dragHover) return null;
    const lo = cmpISO(dragAnchor, dragHover) <= 0 ? dragAnchor : dragHover;
    const hi = cmpISO(dragAnchor, dragHover) <= 0 ? dragHover : dragAnchor;
    return { lo, hi };
  }, [isDragging, dragAnchor, dragHover]);

  const committed = useMemo(() => {
    if (!eventStart || !eventEnd) return null;
    const lo = cmpISO(eventStart, eventEnd) <= 0 ? eventStart : eventEnd;
    const hi = cmpISO(eventStart, eventEnd) <= 0 ? eventEnd : eventStart;
    return { lo, hi };
  }, [eventStart, eventEnd]);

  const displayRange = previewRange || committed;

  const isSelectable = useCallback(
    (dateStr: string) => {
      if (dateStr < todayISO) return false;
      if (dateStr < earliestEventStart) return false;
      if (availability[dateStr] === false) return false;
      return true;
    },
    [todayISO, earliestEventStart, availability],
  );

  const validateRange = useCallback(
    (lo: string, hi: string): { ok: boolean; reason?: string } => {
      const deliv = addDays(lo, -1);
      const ret = addDays(hi, 2);

      if (deliv < earliestReceipt) {
        return {
          ok: false,
          reason: `Earliest delivery is ${fmtShort(earliestReceipt)} — pick a later event day.`,
        };
      }

      let cursor = deliv;
      while (cmpISO(cursor, ret) <= 0) {
        if (availability[cursor] === false) {
          return {
            ok: false,
            reason: `${fmtShort(cursor)} is already booked. Try a different window.`,
          };
        }
        cursor = addDays(cursor, 1);
      }
      return { ok: true };
    },
    [availability, earliestReceipt],
  );

  const commitDrag = useCallback(() => {
    if (!dragAnchor || !dragHover) {
      setIsDragging(false);
      setDragAnchor(null);
      setDragHover(null);
      return;
    }
    const lo = cmpISO(dragAnchor, dragHover) <= 0 ? dragAnchor : dragHover;
    const hi = cmpISO(dragAnchor, dragHover) <= 0 ? dragHover : dragAnchor;

    const v = validateRange(lo, hi);
    if (!v.ok) {
      setRangeError(v.reason || "That range is unavailable.");
      setTimeout(() => setRangeError(null), 5000);
    } else {
      setEventStart(lo);
      setEventEnd(hi);
      setRangeError(null);
    }

    setIsDragging(false);
    setDragAnchor(null);
    setDragHover(null);
  }, [dragAnchor, dragHover, validateRange]);

  useEffect(() => {
    if (!isDragging) return;
    const onUp = () => commitDrag();
    window.addEventListener("pointerup", onUp);
    return () => window.removeEventListener("pointerup", onUp);
  }, [isDragging, commitDrag]);

  const handlePointerDown = (dateStr: string) => {
    if (!isSelectable(dateStr)) return;
    setDragAnchor(dateStr);
    setDragHover(dateStr);
    setIsDragging(true);
    setRangeError(null);
  };

  const handlePointerEnter = (dateStr: string) => {
    if (!isDragging) return;
    setDragHover(dateStr);
  };

  type CellState =
    | "past"
    | "disabled-earliest"
    | "unavailable"
    | "delivery"
    | "event"
    | "rest"
    | "return"
    | "available";

  const getCellState = (dateStr: string): CellState => {
    if (dateStr < todayISO) return "past";

    if (displayRange) {
      const deliv = addDays(displayRange.lo, -1);
      const rest = addDays(displayRange.hi, 1);
      const ret = addDays(displayRange.hi, 2);

      if (dateStr === deliv) return "delivery";
      if (
        cmpISO(dateStr, displayRange.lo) >= 0 &&
        cmpISO(dateStr, displayRange.hi) <= 0
      )
        return "event";
      if (dateStr === rest) return "rest";
      if (dateStr === ret) return "return";
    }

    if (dateStr < earliestEventStart) return "disabled-earliest";
    if (availability[dateStr] === false) return "unavailable";
    return "available";
  };

  const infoDelivery = committed ? addDays(committed.lo, -1) : null;
  const infoRest = committed ? addDays(committed.hi, 1) : null;
  const infoReturn = committed ? addDays(committed.hi, 2) : null;
  const infoEventCount = committed ? diffDays(committed.lo, committed.hi) + 1 : 0;

  // Rental total = per-day rate × event-day count.
  const lineTotal = infoEventCount > 0 ? rentalPrice * infoEventCount : 0;

  const selectionStillValid = useMemo(() => {
    if (!committed) return false;
    return committed.lo >= earliestEventStart;
  }, [committed, earliestEventStart]);

  const canAddToCart = Boolean(
    committed && selectionStillValid && postalCode.length >= 5,
  );

  const handleAddToCart = () => {
    if (!canAddToCart || !committed || !infoDelivery || !infoReturn) return;
    onAdded({
      sku,
      rentalStart: infoDelivery,
      rentalEnd: infoReturn,
      eventStart: committed.lo,
      eventEnd: committed.hi,
      eventDays: infoEventCount,
      postalCode,
      accessories: addedAccessories,
    });
  };

  const toggleAccessory = (a: string) =>
    setAddedAccessories((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a],
    );

  const cells = useMemo(() => buildCells(year, month), [year, month]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden
      />
      <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 overflow-y-auto">
        <div className="bg-store-bg w-full max-w-[1100px] my-8 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-6 top-6 text-store-fg-muted hover:text-store-fg cursor-pointer z-10"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <h2 className="font-serif text-[32px] sm:text-[40px] text-store-accent text-center pt-10 pb-8">
            Check Availability
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-6 sm:px-10 pb-8">
            {/* ── LEFT: Calendar + info panel ────────────────────────── */}
            <div className="space-y-4">
              <div className="border border-store-border-strong p-6">
                <div className="flex items-center justify-between mb-5">
                  <button
                    type="button"
                    onClick={() => {
                      const p = prevMonth(year, month);
                      setYear(p.y);
                      setMonth(p.m);
                    }}
                    className="text-store-fg-muted hover:text-store-fg cursor-pointer p-1"
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="font-serif text-[19px] text-store-fg">
                    {monthLabel(year, month)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const n = nextMonth(year, month);
                      setYear(n.y);
                      setMonth(n.m);
                    }}
                    className="text-store-fg-muted hover:text-store-fg cursor-pointer p-1"
                    aria-label="Next month"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-7 text-center text-[11px] tracking-widest uppercase text-store-fg-muted mb-2">
                  {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                    <div key={i}>{d}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {cells.map((cell) => {
                    const state = getCellState(cell.date);
                    const selectable =
                      cell.interactive && isSelectable(cell.date);

                    const base =
                      "aspect-square flex items-center justify-center text-[13.5px] rounded-sm transition-colors select-none";

                    let cls = "";
                    switch (state) {
                      case "past":
                        cls = "text-store-fg-subtle/30 cursor-default";
                        break;
                      case "disabled-earliest":
                        cls = "text-store-fg-subtle/60 cursor-not-allowed";
                        break;
                      case "unavailable":
                        cls =
                          "bg-[#D6D3C9] text-store-fg-subtle cursor-not-allowed";
                        break;
                      case "delivery":
                        cls = "bg-store-accent/35 text-store-fg font-medium";
                        break;
                      case "event":
                        cls = "bg-[#C69B32] text-white font-semibold";
                        break;
                      case "rest":
                        cls = "bg-store-accent text-white font-semibold";
                        break;
                      case "return":
                        cls =
                          "bg-store-accent text-white font-semibold ring-1 ring-store-fg/30 ring-inset";
                        break;
                      case "available":
                      default:
                        cls =
                          "text-store-fg hover:bg-store-hover cursor-pointer";
                        break;
                    }

                    const isPaddingMuted =
                      cell.owner !== "current" &&
                      state === "available" &&
                      !selectable;
                    if (isPaddingMuted) {
                      cls = "text-store-fg-subtle/60 cursor-not-allowed";
                    }

                    return (
                      <button
                        key={cell.date}
                        type="button"
                        disabled={!selectable}
                        onPointerDown={() =>
                          selectable && handlePointerDown(cell.date)
                        }
                        onPointerEnter={() =>
                          selectable && handlePointerEnter(cell.date)
                        }
                        className={`${base} ${cls}`}
                        style={{ touchAction: "none" }}
                        aria-label={cell.date}
                      >
                        {cell.dayNum}
                      </button>
                    );
                  })}
                </div>

                {cells[cells.length - 1]?.owner === "next" && (
                  <p className="text-[10.5px] text-store-fg-muted text-center mt-3">
                    Faded trailing dates belong to{" "}
                    {monthLabel(
                      nextMonth(year, month).y,
                      nextMonth(year, month).m,
                    )}
                    — drag onto them to extend your selection across the month.
                  </p>
                )}

                <div className="flex flex-wrap gap-x-4 gap-y-2 mt-6 text-[11px] text-store-fg-muted">
                  <LegendSwatch color="#D6D3C9" label="Unavailable Date" />
                  <LegendSwatch color="#C69B32" label="Event Date" />
                  <LegendSwatch color="#64765B" label="Rental Date" />
                  <LegendSwatch
                    color="#64765B"
                    opacity={0.35}
                    label="Delivery"
                  />
                </div>

                {rangeError && (
                  <div className="mt-4 p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-md text-[11.5px]">
                    {rangeError}
                  </div>
                )}
              </div>

              {/* Info panel */}
              <div className="p-5 bg-[#F1EFE1] border border-store-border">
                {!committed ? (
                  <p className="text-[12.5px] text-store-fg-muted leading-relaxed">
                    Drag across the calendar to select your event day(s) — drag
                    onto the faded trailing dates to cross into next month.
                    Your delivery, rest day, and return deadline will appear
                    here.
                  </p>
                ) : (
                  <div>
                    <InfoRow
                      n="1"
                      color="#64765B"
                      date={infoDelivery ? fmtShort(infoDelivery) : "—"}
                      text="Penerima menerima paket baju"
                    />
                    <InfoRow
                      n="2"
                      color="#C69B32"
                      date={
                        infoEventCount > 1
                          ? `${fmtShort(committed.lo)} – ${fmtShort(committed.hi)}`
                          : fmtShort(committed.lo)
                      }
                      suffix={
                        infoEventCount > 1
                          ? `(${infoEventCount} hari)`
                          : undefined
                      }
                      text="Hari-H acara"
                    />
                    <InfoRow
                      n="3"
                      color="#64765B"
                      date={infoRest ? fmtShort(infoRest) : "—"}
                      text="REST & CHILL — kita sarankan penyewa untuk mengembalikan baju di hari ini untuk menghindari keterlambatan"
                    />
                    <InfoRow
                      n="4"
                      color="#64765B"
                      date={infoReturn ? fmtShort(infoReturn) : "—"}
                      text="Deadline baju harus sudah dikembalikan — kirimkan resi ke admin sebelum jam 6 sore"
                      last
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ── RIGHT: summary + postal + estimation + accessories ─── */}
            <div className="space-y-5">
              <div>
                <label className="block text-[13px] text-store-fg mb-2">
                  Rental Date
                </label>
                <div className="border border-store-border-strong px-4 py-3 text-[13.5px] text-store-fg">
                  {committed && infoDelivery && infoReturn
                    ? `${fmtShort(infoDelivery)} – ${fmtShort(infoReturn)}`
                    : "Select event days to see your rental range"}
                </div>
              </div>

              {/* Price panel — always visible, multiplies by event day count */}
              <div className="p-4 bg-[#F1EFE1] border border-store-border space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-semibold tracking-[0.14em] uppercase text-store-fg">
                    Rental Price
                  </span>
                  <span className="text-[11px] text-store-fg-muted font-mono">
                    {infoEventCount > 0
                      ? `${infoEventCount} event day${infoEventCount === 1 ? "" : "s"}`
                      : "—"}
                  </span>
                </div>
                {infoEventCount > 0 ? (
                  <>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[12.5px] text-store-fg-muted">
                        {fmtRupiah(rentalPrice)} × {infoEventCount}
                      </span>
                      <span className="text-[17px] font-semibold text-store-fg">
                        {fmtRupiah(lineTotal)}
                      </span>
                    </div>
                    <p className="text-[11px] text-store-fg-muted leading-relaxed border-t border-[#DBD7C6] pt-2">
                      Your rental is priced per event day. Every additional day
                      you keep the piece multiplies the base rate.
                    </p>
                  </>
                ) : (
                  <p className="text-[12px] text-store-fg-muted leading-relaxed">
                    Select your event day(s) on the calendar to see the rental
                    total. Pricing is {fmtRupiah(rentalPrice)} per event day.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[13px] text-store-fg mb-2">
                  Postal Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  value={postalCode}
                  onChange={(e) =>
                    setPostalCode(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="e.g. 12180"
                  className="w-full border border-store-border-strong px-4 py-3 text-[13.5px] text-store-fg bg-transparent focus:outline-none focus:border-store-accent font-mono"
                />
              </div>

              {/* Delivery estimation — ALWAYS visible */}
              <div className="p-4 bg-[#F1EFE1] border border-store-border space-y-3">
                <div className="flex items-center gap-2">
                  <MapPin
                    className="w-3.5 h-3.5 text-store-accent"
                    strokeWidth={1.6}
                  />
                  <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-store-fg">
                    Delivery Estimation
                  </p>
                </div>

                {!resolvedLead ? (
                  <>
                    <div className="space-y-1.5 text-[12.5px] text-store-fg">
                      <div className="flex justify-between gap-3">
                        <span className="text-store-fg-muted">
                          Postal code
                        </span>
                        <span className="font-mono text-store-fg-muted">
                          — not set —
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-store-fg-muted">
                          Courier lead time
                        </span>
                        <span className="text-store-fg-muted">pending</span>
                      </div>
                      <div className="flex justify-between gap-3 pt-1.5 border-t border-[#DBD7C6]">
                        <span className="text-store-fg-muted">
                          Earliest delivery (min)
                        </span>
                        <span className="font-semibold text-store-accent">
                          {fmtShort(earliestReceipt)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-store-fg-muted">
                          Earliest event day
                        </span>
                        <span className="font-medium">
                          {fmtShort(earliestEventStart)}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-store-fg-muted leading-relaxed border-t border-[#DBD7C6] pt-2">
                      Enter your 5-digit postal code above to add the courier
                      transit and unlock the exact calendar window for your
                      area.
                    </p>
                  </>
                ) : (
                  <div className="space-y-1.5 text-[12.5px] text-store-fg">
                    <div className="flex justify-between gap-3">
                      <span className="text-store-fg-muted">Postal code</span>
                      <span className="font-mono font-medium">
                        {postalCode}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-store-fg-muted">Region</span>
                      <span className="font-medium">
                        {resolvedLead.region}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-store-fg-muted">
                        Courier lead time
                      </span>
                      <span className="font-medium">
                        {resolvedLead.days} day
                        {resolvedLead.days === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3 pt-1.5 border-t border-[#DBD7C6]">
                      <span className="text-store-fg-muted">
                        Earliest delivery
                      </span>
                      <span className="font-semibold text-store-accent">
                        {fmtShort(earliestReceipt)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-store-fg-muted">
                        Earliest event day
                      </span>
                      <span className="font-medium">
                        {fmtShort(earliestEventStart)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {committed && !selectionStillValid && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-md text-[11.5px] leading-relaxed">
                  Your postal code shifted the earliest delivery to{" "}
                  <strong>{fmtShort(earliestReceipt)}</strong>. Please re-select
                  your event days.
                </div>
              )}

              {accessories.length > 0 && (
                <div>
                  <h3 className="font-serif text-[17px] text-store-fg mb-2">
                    Complete Your Look
                  </h3>
                  <p className="text-[12px] text-store-fg-muted mb-4 leading-relaxed">
                    The accessories listed below are confirmed available for
                    the selected date, and the price reflects the same duration
                    as the dress rental.
                  </p>
                  <div className="space-y-3">
                    {accessories.map((a) => {
                      const added = addedAccessories.includes(a.sku);
                      const accTotal =
                        infoEventCount > 0
                          ? a.rentalPrice * infoEventCount
                          : a.rentalPrice;
                      return (
                        <div key={a.sku} className="flex items-center gap-3">
                          <div className="w-12 h-12 flex-shrink-0 bg-[#E2E0D6] overflow-hidden">
                            {a.image && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={a.image}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] text-store-fg truncate">
                              {a.sku}-{a.name}
                            </p>
                            <p className="text-[11.5px] text-store-fg-muted">
                              {infoEventCount > 1
                                ? `${fmtRupiah(a.rentalPrice)} × ${infoEventCount} = ${fmtRupiah(accTotal)}`
                                : fmtRupiah(accTotal)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleAccessory(a.sku)}
                            className={`flex-shrink-0 px-4 py-1.5 text-[10px] tracking-[0.18em] uppercase border transition-colors cursor-pointer ${
                              added
                                ? "border-store-accent bg-store-accent text-white"
                                : "border-store-border-strong text-store-fg-muted hover:border-store-fg hover:text-store-fg"
                            }`}
                          >
                            {added ? "Added" : "Add Item"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Add to cart — with a prominent rental total to the left */}
          <div className="px-6 sm:px-10 pb-12 pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-store-border mt-2 pt-6">
            <div className="text-left sm:text-left text-center">
              <p className="text-[11px] tracking-[0.14em] uppercase text-store-fg-muted mb-1">
                Rental Total
              </p>
              <p className="text-[22px] font-semibold text-store-fg leading-none">
                {infoEventCount > 0 ? fmtRupiah(lineTotal) : "—"}
              </p>
              {infoEventCount > 1 && (
                <p className="text-[11px] text-store-fg-muted mt-1">
                  {fmtRupiah(rentalPrice)} × {infoEventCount} days
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={!canAddToCart}
              onClick={handleAddToCart}
              className={`px-10 py-3 text-[11px] tracking-[0.2em] uppercase font-medium transition-colors cursor-pointer ${
                canAddToCart
                  ? "bg-store-accent text-white hover:bg-store-accent-hover"
                  : "bg-[#C5C5C5] text-white cursor-not-allowed"
              }`}
            >
              Add to Cart
            </button>
          </div>

          {loading && (
            <div className="absolute inset-0 bg-store-bg/40 backdrop-blur-[1px] flex items-center justify-center pointer-events-none" />
          )}
        </div>
      </div>
    </>
  );
}

/* ── Sub-components ──────────────────────────────────────────────── */

function LegendSwatch({
  color,
  label,
  opacity = 1,
}: {
  color: string;
  label: string;
  opacity?: number;
}) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="w-3.5 h-3.5 inline-block"
        style={{ backgroundColor: color, opacity }}
      />
      {label}
    </span>
  );
}

function InfoRow({
  n,
  color,
  date,
  suffix,
  text,
  last,
}: {
  n: string;
  color: string;
  date: string;
  suffix?: string;
  text: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex gap-3 py-2.5 ${last ? "" : "border-b border-[#DBD7C6]"}`}
    >
      <span
        className="w-7 h-7 flex-shrink-0 flex items-center justify-center text-white text-[12px] font-medium rounded-sm"
        style={{ backgroundColor: color }}
      >
        {n}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5 flex-wrap">
          <span className="text-[12px] font-mono font-medium text-store-fg">
            {date}
          </span>
          {suffix && (
            <span className="text-[10.5px] text-store-fg-muted">{suffix}</span>
          )}
        </div>
        <p className="text-[12.5px] text-store-fg leading-snug">{text}</p>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getWeekSlots, type WeekGrid } from "@/app/actions/storefront";

export interface SlotSelection {
  date: string;
  slot: string;
}

interface Props {
  value: SlotSelection | null;
  onChange: (v: SlotSelection | null) => void;
  excludeFittingId?: string;
}

const ALL_ROWS = [
  ["10:00", "11:00"],
  ["11:00", "12:00"],
  ["12:00", "13:00"],
  ["13:00", "14:00"],
  ["14:00", "15:00"],
  ["15:00", "16:00"],
  ["16:00", "17:00"],
  ["17:00", "18:00"],
] as const;

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseISO(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDays(s: string, n: number) {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}
function startOfWeekMonday(dateStr: string) {
  const d = parseISO(dateStr);
  const dow = d.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + offset);
  return toISO(d);
}

function getInitialWeekStart(): string {
  const todayStr = toISO(new Date());
  const thisWeek = startOfWeekMonday(todayStr);
  const hasFutureDay = Array.from({ length: 7 }, (_, i) =>
    addDays(thisWeek, i),
  ).some((d) => d > todayStr);
  return hasFutureDay ? thisWeek : addDays(thisWeek, 7);
}

const DESKTOP_GRID =
  "grid grid-cols-[40px_repeat(7,minmax(72px,1fr))_40px] items-center gap-2";

export default function WeekSlotPicker({
  value,
  onChange,
  excludeFittingId,
}: Props) {
  const [weekStart, setWeekStart] = useState(getInitialWeekStart);
  const [grid, setGrid] = useState<WeekGrid>({});
  const [loading, setLoading] = useState(false);

  // Mobile: single-day selection state. Defaults to the first day in the
  // visible week that has bookable slots (falls back to Monday).
  const [mobileDay, setMobileDay] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const g = await getWeekSlots(weekStart, excludeFittingId);
      if (!cancelled) {
        setGrid(g);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [weekStart, excludeFittingId]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  // Re-pick mobile day whenever the week changes (or the current
  // selection isn't in the newly-shown week).
  useEffect(() => {
    if (mobileDay && weekDays.includes(mobileDay)) return;
    const firstWithSlots = weekDays.find((d) => (grid[d] || []).length > 0);
    setMobileDay(firstWithSlots || weekDays[0]);
  }, [weekDays, grid, mobileDay]);

  const goPrevWeek = () => setWeekStart((w) => addDays(w, -7));
  const goNextWeek = () => setWeekStart((w) => addDays(w, 7));

  return (
    <div className="border border-store-border-strong p-4 sm:p-5 relative">
      {/* ── MOBILE LAYOUT (< md) ────────────────────────────────────────
          One day at a time. Day pills across the top, slots stacked below. */}
      <div className="md:hidden">
        {/* Week navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={goPrevWeek}
            className="text-store-fg-muted hover:text-store-fg cursor-pointer p-1"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-serif text-[15px] text-store-fg">
            {fmtWeekRange(weekStart)}
          </span>
          <button
            type="button"
            onClick={goNextWeek}
            className="text-store-fg-muted hover:text-store-fg cursor-pointer p-1"
            aria-label="Next week"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Day selector — horizontal scroll if needed for very narrow screens */}
        <div className="overflow-x-auto -mx-4 px-4 mb-5">
          <div className="flex gap-2 min-w-max">
            {weekDays.map((d) => {
              const dt = parseISO(d);
              const dow = dt.toLocaleDateString("en-GB", { weekday: "short" });
              const dayNum = String(dt.getDate()).padStart(2, "0");
              const isActive = mobileDay === d;
              const daySlots = grid[d] || [];
              const hasAnyAvailable = daySlots.some((s) => s.available);
              const isEmpty = daySlots.length === 0;

              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setMobileDay(d)}
                  className={`flex-shrink-0 w-[68px] py-2.5 rounded-lg border text-center transition-colors cursor-pointer ${
                    isActive
                      ? "border-store-accent bg-store-accent text-white"
                      : isEmpty
                        ? "border-store-border text-store-fg-subtle opacity-50"
                        : hasAnyAvailable
                          ? "border-store-border-strong text-store-fg hover:border-store-fg"
                          : "border-store-border-strong text-store-fg-muted"
                  }`}
                >
                  <span className="block text-[10px] tracking-[0.14em] uppercase opacity-80">
                    {dow}
                  </span>
                  <span className="block font-serif text-[16px] mt-0.5">
                    {dayNum}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Slots for the selected day */}
        <div className="space-y-2">
          {mobileDay && (grid[mobileDay] || []).length === 0 ? (
            <p className="text-[12.5px] text-store-fg-muted text-center py-8">
              No sessions available on this day.
            </p>
          ) : (
            (
              grid[mobileDay || ""] ||
              ALL_ROWS.map(([s, e]) => ({
                slot: s,
                end: e,
                available: false,
                isAfterHours: false,
                fee: 0,
              }))
            ).map((s) => {
              const isSelected =
                value?.date === mobileDay && value?.slot === s.slot;
              const disabled = !s.available;

              return (
                <button
                  key={s.slot}
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    !disabled &&
                    mobileDay &&
                    onChange({ date: mobileDay, slot: s.slot })
                  }
                  className={`w-full rounded-lg border py-3 text-[13px] tracking-wide transition-colors ${
                    disabled
                      ? "bg-[#D6D3C9] text-transparent border-transparent cursor-not-allowed"
                      : isSelected
                        ? "bg-store-accent text-white border-store-accent cursor-pointer"
                        : "border-store-border-strong text-store-fg hover:border-store-fg cursor-pointer"
                  }`}
                >
                  {s.slot} – {s.end}
                  {s.isAfterHours && (
                    <span className="ml-1 opacity-80">* (+Rp100k)</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── DESKTOP LAYOUT (≥ md) ───────────────────────────────────────
          Existing 7-day week grid. Unchanged. */}
      <div className="hidden md:block">
        <div className={`${DESKTOP_GRID} mb-4`}>
          <button
            type="button"
            onClick={goPrevWeek}
            className="text-store-fg-muted hover:text-store-fg cursor-pointer flex items-center justify-center"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          {weekDays.map((d) => {
            const dt = parseISO(d);
            const dow = dt.toLocaleDateString("en-GB", { weekday: "short" });
            return (
              <div key={d} className="text-center">
                <p className="text-[11px] tracking-widest uppercase text-store-fg-muted mb-1">
                  {dow}
                </p>
                <p className="font-serif text-[18px] text-store-fg">
                  {String(dt.getDate()).padStart(2, "0")}
                </p>
              </div>
            );
          })}
          <button
            type="button"
            onClick={goNextWeek}
            className="text-store-fg-muted hover:text-store-fg cursor-pointer flex items-center justify-center"
            aria-label="Next week"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className={`${DESKTOP_GRID} gap-2`}>
          {ALL_ROWS.map(([slotStart, slotEnd]) => (
            <SlotRow
              key={slotStart}
              slotStart={slotStart}
              slotEnd={slotEnd}
              weekDays={weekDays}
              grid={grid}
              selected={value}
              onSelect={(date) => onChange({ date, slot: slotStart })}
            />
          ))}
        </div>
      </div>

      {/* Legend (shared) */}
      <div className="flex flex-wrap items-center gap-5 text-[11px] text-store-fg-muted mt-5">
        <span className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 bg-[#C5C5C5] inline-block" /> Unavailable
          Session
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 bg-store-accent inline-block" /> Selected
          Session
        </span>
        <span className="text-store-fg-subtle">
          * : After Working Hours (additional fee: 100k/item)
        </span>
      </div>

      <p className="text-[11px] text-store-fg-muted mt-3">
        Earliest available session is tomorrow (H-1). Same-day bookings are not
        offered.
      </p>

      {loading && (
        <div className="absolute inset-0 bg-store-bg/40 backdrop-blur-[1px] flex items-center justify-center pointer-events-none" />
      )}
    </div>
  );
}

function SlotRow({
  slotStart,
  slotEnd,
  weekDays,
  grid,
  selected,
  onSelect,
}: {
  slotStart: string;
  slotEnd: string;
  weekDays: string[];
  grid: WeekGrid;
  selected: SlotSelection | null;
  onSelect: (date: string) => void;
}) {
  return (
    <>
      <div />
      {weekDays.map((d) => {
        const slots = grid[d] || [];
        const match = slots.find((s) => s.slot === slotStart);
        if (!match) return <div key={d} />;

        const isSelected = selected?.date === d && selected?.slot === slotStart;
        const disabled = !match.available;

        return (
          <button
            key={d}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onSelect(d)}
            className={`rounded-full border text-[11.5px] py-2 whitespace-nowrap transition-colors ${
              disabled
                ? "bg-[#D6D3C9] text-transparent border-transparent cursor-not-allowed"
                : isSelected
                  ? "bg-store-accent text-white border-store-accent cursor-pointer"
                  : "border-store-border-strong text-store-fg hover:border-store-fg cursor-pointer"
            }`}
          >
            {slotStart} – {slotEnd}
            {match.isAfterHours && <span className="ml-0.5">*</span>}
          </button>
        );
      })}
      <div />
    </>
  );
}

function fmtWeekRange(weekStart: string) {
  const start = parseISO(weekStart);
  const end = parseISO(addDays(weekStart, 6));
  const sameMonth =
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
  const endLabel = end.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return sameMonth
    ? `${start.getDate()} – ${endLabel}`
    : `${startLabel} – ${endLabel}`;
}

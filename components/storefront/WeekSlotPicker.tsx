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

export default function WeekSlotPicker({ value, onChange, excludeFittingId }: Props) {
  const todayStr = toISO(new Date());
  const [weekStart, setWeekStart] = useState(startOfWeekMonday(todayStr));
  const [grid, setGrid] = useState<WeekGrid>({});
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="border border-store-border-strong p-5 relative">
      <div className="grid grid-cols-[40px_repeat(7,1fr)_40px] items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => setWeekStart((w) => addDays(w, -7))}
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
          onClick={() => setWeekStart((w) => addDays(w, 7))}
          className="text-store-fg-muted hover:text-store-fg cursor-pointer flex items-center justify-center"
          aria-label="Next week"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-[40px_repeat(7,1fr)_40px] gap-2">
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

      <div className="flex flex-wrap items-center gap-5 text-[11px] text-store-fg-muted mt-6">
        <span className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 bg-[#C5C5C5] inline-block" /> Unavailable Session
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 bg-store-accent inline-block" /> Selected Session
        </span>
        <span className="text-store-fg-subtle">
          * : After Working Hours (additional fee: 100k/item)
        </span>
      </div>

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

        const isSelected =
          selected?.date === d && selected?.slot === slotStart;
        const disabled = !match.available;

        return (
          <button
            key={d}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onSelect(d)}
            className={`rounded-full border text-[11.5px] py-2 transition-colors ${
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

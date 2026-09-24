"use client";

import { useState, useEffect, useMemo } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { getWeekSlots, type WeekGrid } from "@/app/actions/storefront";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sku: string;
  onAdded: (payload: { date: string; slot: string; sku: string }) => void;
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseISO(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function startOfWeekMonday(dateStr: string) {
  const d = parseISO(dateStr);
  const dow = d.getDay(); // 0=Sun
  const offset = dow === 0 ? -6 : 1 - dow; // shift to Monday
  d.setDate(d.getDate() + offset);
  return toISO(d);
}
function addDays(s: string, n: number) {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
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

export default function FittingModal({ isOpen, onClose, sku, onAdded }: Props) {
  const todayStr = toISO(new Date());
  const [weekStart, setWeekStart] = useState(startOfWeekMonday(todayStr));
  const [grid, setGrid] = useState<WeekGrid>({});
  const [selected, setSelected] = useState<{ date: string; slot: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) setSelected(null);
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
    (async () => {
      const g = await getWeekSlots(weekStart);
      if (!cancelled) {
        setGrid(g);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, weekStart]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const prevWeek = () => setWeekStart((w) => addDays(w, -7));
  const nextWeek = () => setWeekStart((w) => addDays(w, 7));

  if (!isOpen) return null;

  const hasSelection = Boolean(selected);

  const handleAdd = () => {
    if (!selected) return;
    onAdded({ date: selected.date, slot: selected.slot, sku });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} aria-hidden />
      <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 overflow-y-auto">
        <div className="bg-store-bg w-full max-w-[1280px] my-8 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-6 top-6 text-store-fg-muted hover:text-store-fg cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <h2 className="font-serif text-[32px] sm:text-[40px] text-store-accent text-center pt-10 pb-8">
            Book Fitting Session
          </h2>

          <div className="px-6 sm:px-10 pb-6">
            <div className="border border-store-border-strong p-5">
              {/* Header row */}
              <div className="grid grid-cols-[40px_repeat(7,1fr)_40px] items-center gap-2 mb-4">
                <button
                  type="button"
                  onClick={prevWeek}
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
                  onClick={nextWeek}
                  className="text-store-fg-muted hover:text-store-fg cursor-pointer flex items-center justify-center"
                  aria-label="Next week"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Slot grid */}
              <div className="grid grid-cols-[40px_repeat(7,1fr)_40px] gap-2">
                {ALL_ROWS.map(([slotStart, slotEnd]) => (
                  <SlotRow
                    key={slotStart}
                    slotStart={slotStart}
                    slotEnd={slotEnd}
                    weekDays={weekDays}
                    grid={grid}
                    selected={selected}
                    onSelect={(date) => setSelected({ date, slot: slotStart })}
                  />
                ))}
              </div>

              {/* Legend */}
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
            </div>
          </div>

          <div className="flex justify-center pb-12">
            <button
              type="button"
              disabled={!hasSelection}
              onClick={handleAdd}
              className={`px-10 py-3 text-[11px] tracking-[0.2em] uppercase font-medium transition-colors cursor-pointer ${
                hasSelection
                  ? "bg-store-accent text-white hover:bg-store-accent-hover"
                  : "bg-[#C5C5C5] text-white cursor-not-allowed"
              }`}
            >
              Add to Book Fitting Cart
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

/* ── Row renderer ─────────────────────────────────────────────────── */

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
  selected: { date: string; slot: string } | null;
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
            className={`rounded-full border text-[11.5px] py-2 transition-colors ${
              disabled
                ? "bg-[#D6D3C9] text-transparent border-transparent cursor-not-allowed"
                : isSelected
                  ? "bg-store-accent text-white border-store-accent cursor-pointer"
                  : "border-store-border-strong text-store-fg hover:border-store-fg cursor-pointer"
            }`}
          >
            {slotStart} – {slotEnd}
            {match.isAfterHours && !isSelected && <span className="ml-0.5">*</span>}
            {match.isAfterHours && isSelected && <span className="ml-0.5">*</span>}
          </button>
        );
      })}
      <div />
    </>
  );
}

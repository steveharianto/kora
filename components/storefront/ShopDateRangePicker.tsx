"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

export interface DateRange {
  /** ISO "YYYY-MM-DD". */
  start: string;
  /** ISO "YYYY-MM-DD" — may equal start for a single-day selection. */
  end: string;
}

interface Props {
  value: DateRange | null;
  onChange: (value: DateRange | null) => void;
  placeholder?: string;
  /** ISO date — days before this are disabled. */
  min?: string;
  /** ISO date — days after this are disabled. */
  max?: string;
  className?: string;
}

/* ── Date helpers (local, no deps) ────────────────────────────────── */
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}
function nextMonth(y: number, m: number): { y: number; m: number } {
  return m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
}
function prevMonth(y: number, m: number): { y: number; m: number } {
  return m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
}
function monthLabel(y: number, m: number): string {
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}
function isoOf(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function fmtSingle(s: string): string {
  return parseISO(s).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
/** "14 Oct 2026" | "14 – 18 Oct 2026" | "14 Oct – 18 Nov 2026" */
function fmtRange(range: DateRange): string {
  const a = parseISO(range.start);
  const b = parseISO(range.end);
  if (range.start === range.end) return fmtSingle(range.start);
  const sameMonth =
    a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  const sameYear = a.getFullYear() === b.getFullYear();
  const dayA = String(a.getDate()).padStart(2, "0");
  const dayB = String(b.getDate()).padStart(2, "0");
  const monthA = a.toLocaleDateString("en-GB", { month: "short" });
  const monthB = b.toLocaleDateString("en-GB", { month: "short" });
  if (sameMonth) {
    return `${dayA} – ${dayB} ${monthA} ${a.getFullYear()}`;
  }
  if (sameYear) {
    return `${dayA} ${monthA} – ${dayB} ${monthB} ${a.getFullYear()}`;
  }
  return `${dayA} ${monthA} ${a.getFullYear()} – ${dayB} ${monthB} ${b.getFullYear()}`;
}

type CellOwner = "prev" | "current" | "next";
interface Cell {
  date: string;
  dayNum: number;
  owner: CellOwner;
}
/** Monday-first grid with leading/trailing padding from adjacent months. */
function buildCells(year: number, month: number): Cell[] {
  const total = daysInMonth(year, month);
  const firstDow = new Date(year, month - 1, 1).getDay();
  const offset = firstDow === 0 ? 6 : firstDow - 1;
  const prev = prevMonth(year, month);
  const prevTotal = daysInMonth(prev.y, prev.m);
  const next = nextMonth(year, month);
  const cells: Cell[] = [];
  for (let i = offset - 1; i >= 0; i--) {
    const d = prevTotal - i;
    cells.push({ date: isoOf(prev.y, prev.m, d), dayNum: d, owner: "prev" });
  }
  for (let d = 1; d <= total; d++) {
    cells.push({ date: isoOf(year, month, d), dayNum: d, owner: "current" });
  }
  const remainder = cells.length % 7;
  const trailing = remainder === 0 ? 0 : 7 - remainder;
  for (let d = 1; d <= trailing; d++) {
    cells.push({ date: isoOf(next.y, next.m, d), dayNum: d, owner: "next" });
  }
  return cells;
}

/* ── Component ────────────────────────────────────────────────────── */
export default function ShopDateRangePicker({
  value,
  onChange,
  placeholder = "DD/MM/YYYY – DD/MM/YYYY",
  min,
  max,
  className = "",
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  // Drag state — set on pointerdown, updated on pointerenter / pointermove
  // hit-testing, committed on window pointerup. Because a click is a
  // zero-length drag, single-day selection comes for free (anchor === hover).
  const [isDragging, setIsDragging] = useState(false);
  const [dragAnchor, setDragAnchor] = useState<string | null>(null);
  const [dragHover, setDragHover] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const today = useMemo(() => new Date(), []);
  const todayISO = useMemo(() => toISO(today), [today]);
  const [viewYear, setViewYear] = useState(() => {
    const anchor = value?.start ? parseISO(value.start) : today;
    return anchor.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const anchor = value?.start ? parseISO(value.start) : today;
    return anchor.getMonth() + 1;
  });

  /* Re-anchor the visible month to the current value every time we open. */
  useEffect(() => {
    if (!isOpen) return;
    const anchor = value?.start ? parseISO(value.start) : today;
    setViewYear(anchor.getFullYear());
    setViewMonth(anchor.getMonth() + 1);
  }, [isOpen, value, today]);

  /* Click outside closes the popover. */
  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [isOpen]);

  /* Escape closes the popover and cancels any in-flight drag. */
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsDragging(false);
        setDragAnchor(null);
        setDragHover(null);
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const cells = useMemo(
    () => buildCells(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const isDisabled = useCallback(
    (date: string) => {
      if (min && date < min) return true;
      if (max && date > max) return true;
      return false;
    },
    [min, max],
  );

  /* What the calendar paints: the in-flight drag if any, otherwise the
     committed value. Preview uses the same shape so the styling code
     doesn't branch. */
  const displayRange: DateRange | null = useMemo(() => {
    if (isDragging && dragAnchor && dragHover) {
      const lo = dragAnchor < dragHover ? dragAnchor : dragHover;
      const hi = dragAnchor < dragHover ? dragHover : dragAnchor;
      return { start: lo, end: hi };
    }
    return value;
  }, [isDragging, dragAnchor, dragHover, value]);

  /* ── Touch drag support ────────────────────────────────────────────
     Touch pointers are implicitly captured by the element that received
     pointerdown, so sibling day cells never fire pointerenter on mobile.
     While dragging we listen to pointermove on window and hit-test the
     finger position with elementFromPoint against the cell's data-date
     attribute — restoring drag-to-select-range on touch devices.

     Declared ABOVE the useEffect that registers it as a listener, so the
     reference in that effect's body and deps array is not in the TDZ.
     (TS2448 — "Block-scoped variable used before its declaration".)
     Matches the ordering used in AvailabilityModal. */
  const handlePointerMove = useCallback((e: PointerEvent) => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const cell = (el as HTMLElement | null)?.closest?.(
      "button[data-date]",
    ) as HTMLElement | null;
    if (!cell || cell.dataset.selectable !== "true") return;
    const dateStr = cell.dataset.date;
    if (dateStr) setDragHover(dateStr);
  }, []);

  /* Commit on window pointerup — works even if the pointer releases
     outside the calendar or outside the button it started on. */
  useEffect(() => {
    if (!isDragging) return;
    const onUp = () => {
      if (dragAnchor && dragHover) {
        const lo = dragAnchor < dragHover ? dragAnchor : dragHover;
        const hi = dragAnchor < dragHover ? dragHover : dragAnchor;
        onChange({ start: lo, end: hi });
      }
      setIsDragging(false);
      setDragAnchor(null);
      setDragHover(null);
    };
    const onCancel = () => {
      setIsDragging(false);
      setDragAnchor(null);
      setDragHover(null);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging, dragAnchor, dragHover, onChange, handlePointerMove]);

  const goPrev = () => {
    const p = prevMonth(viewYear, viewMonth);
    setViewYear(p.y);
    setViewMonth(p.m);
  };
  const goNext = () => {
    const n = nextMonth(viewYear, viewMonth);
    setViewYear(n.y);
    setViewMonth(n.m);
  };
  const handlePointerDown = (date: string) => {
    if (isDisabled(date)) return;
    setDragAnchor(date);
    setDragHover(date);
    setIsDragging(true);
  };
  const handlePointerEnter = (date: string) => {
    if (!isDragging) return;
    setDragHover(date);
  };
  const handleClear = () => {
    onChange(null);
    setIsOpen(false);
  };
  const handleToday = () => {
    if (isDisabled(todayISO)) return;
    onChange({ start: todayISO, end: todayISO });
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger — button, not a native date input, so no browser picker */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="w-full h-11 flex items-center justify-between text-[12px] tracking-wider bg-transparent border border-store-border-strong pl-3.5 pr-3.5 text-store-fg focus:outline-none focus:border-store-accent transition-colors duration-150 cursor-pointer"
      >
        <span className={`truncate ${value ? "" : "text-[#B4B8A8] uppercase"}`}>
          {value ? fmtRange(value) : placeholder}
        </span>
        <Calendar
          className="w-4 h-4 text-store-fg-muted flex-shrink-0 ml-2"
          strokeWidth={1.5}
        />
      </button>
      {/* Popover calendar */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Choose a date range"
          className="absolute z-50 mt-2 left-0 bg-[#FBFBF9] border border-store-border-strong shadow-[0_8px_24px_rgba(0,0,0,0.08)] p-4 w-[320px]"
        >
          {/* Month header */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous month"
              className="w-7 h-7 flex items-center justify-center text-store-fg-muted hover:text-store-fg hover:bg-store-hover/60 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={1.6} />
            </button>
            <span className="font-serif text-[15px] text-store-fg tracking-[0.005em]">
              {monthLabel(viewYear, viewMonth)}
            </span>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next month"
              className="w-7 h-7 flex items-center justify-center text-store-fg-muted hover:text-store-fg hover:bg-store-hover/60 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" strokeWidth={1.6} />
            </button>
          </div>
          {/* Weekday row — Monday first */}
          <div className="grid grid-cols-7 mb-1">
            {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
              <div
                key={d}
                className="text-center text-[10px] tracking-[0.14em] uppercase text-store-fg-subtle py-1"
              >
                {d}
              </div>
            ))}
          </div>
          {/* Day grid — no gap so range bands connect across cells */}
          <div className="grid grid-cols-7 select-none">
            {cells.map((cell, i) => {
              const isStart = displayRange?.start === cell.date;
              const isEnd = displayRange?.end === cell.date;
              const isEdge = isStart || isEnd;
              const isBetween =
                !!displayRange &&
                cell.date > displayRange.start &&
                cell.date < displayRange.end;
              const col = i % 7;
              const rowStart = col === 0;
              const rowEnd = col === 6;
              /* Rounding: true edge cells round their outer side; between
                 cells round when they're at a row boundary so the band
                 looks continuous across week wraps. */
              const roundLeft = isStart || (isBetween && rowStart);
              const roundRight = isEnd || (isBetween && rowEnd);
              const disabled = isDisabled(cell.date);
              const isOutside = cell.owner !== "current";
              const isToday = cell.date === todayISO;
              let cls =
                "absolute top-1 bottom-1 left-0 right-0 flex items-center justify-center text-[12.5px] transition-colors duration-100";
              if (roundLeft && roundRight) cls += " rounded-sm";
              else if (roundLeft) cls += " rounded-l-sm";
              else if (roundRight) cls += " rounded-r-sm";
              if (disabled) {
                cls += " text-store-fg-subtle/40 cursor-not-allowed";
              } else if (isEdge) {
                cls +=
                  " bg-store-accent text-white font-medium cursor-pointer z-10";
              } else if (isBetween) {
                cls +=
                  " bg-store-accent/15 text-store-fg hover:bg-store-accent/25 cursor-pointer";
              } else if (isOutside) {
                cls +=
                  " text-store-fg-subtle/50 hover:bg-store-hover/60 cursor-pointer";
              } else if (isToday) {
                cls +=
                  " text-store-fg font-medium ring-1 ring-store-accent/40 ring-inset hover:bg-store-hover cursor-pointer";
              } else {
                cls += " text-store-fg hover:bg-store-hover cursor-pointer";
              }
              return (
                <div key={cell.date} className="relative aspect-square">
                  <button
                    type="button"
                    disabled={disabled}
                    data-date={cell.date}
                    data-selectable={!disabled ? "true" : "false"}
                    onPointerDown={() => handlePointerDown(cell.date)}
                    onPointerEnter={() => handlePointerEnter(cell.date)}
                    className={cls}
                    style={{ touchAction: "none" }}
                    aria-label={cell.date}
                    aria-pressed={isEdge}
                  >
                    {cell.dayNum}
                  </button>
                </div>
              );
            })}
          </div>
          {/* Hint row */}
          <p className="mt-2 text-[10.5px] text-store-fg-subtle leading-snug">
            Click a day, or drag across days to select a range.
          </p>
          {/* Footer — clear / today */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-store-border">
            <button
              type="button"
              onClick={handleClear}
              className="text-[10.5px] tracking-[0.16em] uppercase text-store-fg-muted hover:text-store-fg transition-colors cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleToday}
              disabled={isDisabled(todayISO)}
              className="text-[10.5px] tracking-[0.16em] uppercase text-store-accent hover:text-store-accent-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

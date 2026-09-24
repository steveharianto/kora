"use client";

import { useState, useEffect } from "react";
import { X, ChevronDown } from "lucide-react";

export interface FilterState {
  brands: string[];
  sizes: string[];
  colors: string[];
  occasions: string[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  facets: { brands: string[]; sizes: string[]; colors: string[] };
  value: FilterState;
  onApply: (next: FilterState) => void;
  onClearAll: () => void;
}

const OCCASIONS = [
  "Birthday Party",
  "Baby Shower",
  "New Year's Eve",
  "Anniversary Event",
  "Wedding Celebration",
  "Graduation Bash",
  "Halloween Gathering",
];

const COLOR_SWATCHES: Record<string, string> = {
  red: "#EF4444",
  blue: "#2563EB",
  green: "#16A34A",
  yellow: "#EAB308",
  purple: "#A855F7",
  orange: "#F97316",
  cyan: "#06B6D4",
  black: "#1A1A1A",
  white: "#F5F5F5",
  cream: "#ECEBE4",
  beige: "#D9CFBD",
  brown: "#8B6F47",
  pink: "#EC4899",
  grey: "#9CA3AF",
  gray: "#9CA3AF",
  navy: "#1E3A8A",
  gold: "#B58E3A",
  silver: "#C0C0C0",
  maroon: "#7F1D1D",
  sage: "#64765B",
};

function swatchFor(color: string): string {
  return COLOR_SWATCHES[color.toLowerCase()] || "#D0D0D0";
}

export default function FilterDrawer({
  isOpen,
  onClose,
  facets,
  value,
  onApply,
  onClearAll,
}: Props) {
  const [draft, setDraft] = useState<FilterState>(value);

  // Sync draft from applied state on open.
  useEffect(() => {
    if (isOpen) setDraft(value);
  }, [isOpen, value]);

  const [openSections, setOpenSections] = useState({
    brand: true,
    size: true,
    color: true,
    occasion: true,
    rental: true,
    fitting: true,
  });

  const toggleSection = (k: keyof typeof openSections) =>
    setOpenSections((s) => ({ ...s, [k]: !s[k] }));

  const toggleArray = (key: keyof FilterState, v: string) =>
    setDraft((d) => {
      const cur = d[key];
      const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
      return { ...d, [key]: next };
    });

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <aside className="fixed top-0 right-0 bottom-0 w-full max-w-[520px] bg-store-bg z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-7 pb-5">
          <h2 className="font-serif text-[28px] tracking-[0.02em] text-store-fg">Filter</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filter"
            className="text-store-fg-muted hover:text-store-fg transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-7 pb-6">
          <Section
            title={`Brand (${facets.brands.length})`}
            open={openSections.brand}
            onToggle={() => toggleSection("brand")}
          >
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {facets.brands.map((b) => (
                <Checkbox
                  key={b}
                  label={b}
                  checked={draft.brands.includes(b)}
                  onChange={() => toggleArray("brands", b)}
                />
              ))}
            </div>
          </Section>

          <Section
            title={`Size (${facets.sizes.length})`}
            open={openSections.size}
            onToggle={() => toggleSection("size")}
          >
            <div className="flex flex-col gap-3">
              {facets.sizes.map((s) => (
                <Checkbox
                  key={s}
                  label={s}
                  checked={draft.sizes.includes(s)}
                  onChange={() => toggleArray("sizes", s)}
                />
              ))}
            </div>
          </Section>

          <Section
            title={`Color (${facets.colors.length})`}
            open={openSections.color}
            onToggle={() => toggleSection("color")}
          >
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {facets.colors.map((c) => (
                <label key={c} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={draft.colors.includes(c)}
                    onChange={() => toggleArray("colors", c)}
                    className="sr-only"
                  />
                  <span
                    className={`w-4 h-4 border transition-colors flex-shrink-0 ${
                      draft.colors.includes(c)
                        ? "bg-store-accent border-store-accent"
                        : "border-store-border-strong group-hover:border-store-accent"
                    }`}
                  />
                  <span className="text-[14px] text-store-fg flex-1">{c}</span>
                  <span
                    className="w-4 h-4 rounded-full border border-black/10 flex-shrink-0"
                    style={{ backgroundColor: swatchFor(c) }}
                  />
                </label>
              ))}
            </div>
          </Section>

          <Section
            title={`Occasion (${OCCASIONS.length})`}
            open={openSections.occasion}
            onToggle={() => toggleSection("occasion")}
          >
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {OCCASIONS.map((o) => (
                <Checkbox
                  key={o}
                  label={o}
                  checked={draft.occasions.includes(o)}
                  onChange={() => toggleArray("occasions", o)}
                />
              ))}
            </div>
          </Section>

          <Section
            title="Rental Date"
            open={openSections.rental}
            onToggle={() => toggleSection("rental")}
          >
            <input
              type="date"
              className="w-full border border-store-border-strong bg-transparent text-[13px] tracking-wider px-3.5 py-3 text-store-fg focus:outline-none focus:border-store-accent"
              placeholder="MM/DD/YYYY"
            />
          </Section>

          <Section
            title="Book Fitting Session"
            open={openSections.fitting}
            onToggle={() => toggleSection("fitting")}
          >
            <select
              className="w-full border border-store-border-strong bg-transparent text-[12px] tracking-[0.16em] uppercase px-3.5 py-3 text-store-fg focus:outline-none focus:border-store-accent cursor-pointer"
              defaultValue=""
            >
              <option value="">Select session</option>
              <option value="10:00">10:00</option>
              <option value="11:00">11:00</option>
              <option value="13:00">13:00</option>
              <option value="14:00">14:00</option>
              <option value="15:00">15:00</option>
              <option value="16:00">16:00</option>
            </select>
          </Section>
        </div>

        {/* Sticky bottom bar */}
        <div className="border-t border-store-border px-7 py-5 flex gap-3">
          <button
            type="button"
            onClick={() => { onClearAll(); setDraft({ brands: [], sizes: [], colors: [], occasions: [] }); }}
            className="flex-1 py-3.5 border border-store-fg text-[11px] tracking-[0.2em] uppercase font-medium text-store-fg hover:bg-store-hover/40 transition-colors cursor-pointer"
          >
            Clear All
          </button>
          <button
            type="button"
            onClick={() => onApply(draft)}
            className="flex-1 py-3.5 bg-store-accent text-store-accent-fg text-[11px] tracking-[0.2em] uppercase font-medium hover:bg-store-accent-hover transition-colors cursor-pointer"
          >
            Apply Filter
          </button>
        </div>
      </aside>
    </>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────── */

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-store-border py-6 first:pt-2">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left cursor-pointer group"
      >
        <span className="text-[15px] tracking-[0.06em] uppercase text-store-fg font-normal">
          {title}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-store-fg-muted transition-transform group-hover:text-store-fg ${
            open ? "" : "-rotate-90"
          }`}
        />
      </button>
      {open && <div className="mt-5">{children}</div>}
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <span
        className={`w-4 h-4 border transition-colors flex-shrink-0 ${
          checked
            ? "bg-store-accent border-store-accent"
            : "border-store-border-strong group-hover:border-store-accent"
        }`}
      />
      <span className="text-[14px] text-store-fg">{label}</span>
    </label>
  );
}

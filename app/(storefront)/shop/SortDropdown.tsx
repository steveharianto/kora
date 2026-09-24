"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

const OPTIONS = [
  { value: "date-desc", label: "Newest" },
  { value: "alpha-asc", label: "Alphabetically, A–Z" },
  { value: "alpha-desc", label: "Alphabetically, Z–A" },
  { value: "price-asc", label: "Price, Low to High" },
  { value: "price-desc", label: "Price, High to Low" },
];

export default function SortDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const current = OPTIONS.find((o) => o.value === value) || OPTIONS[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="flex items-center gap-1.5 hover:text-store-fg transition-colors cursor-pointer"
      >
        <span>Sort by</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-store-bg border border-store-border-strong shadow-lg z-40 py-1">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setIsOpen(false);
              }}
              className={`block w-full text-left px-4 py-2.5 text-[11px] tracking-[0.16em] uppercase transition-colors cursor-pointer ${
                o.value === value
                  ? "text-store-accent"
                  : "text-store-fg-muted hover:text-store-fg hover:bg-store-hover/40"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

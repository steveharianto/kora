"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { COUNTRY_CODES, flagEmoji, findCountryByIso2 } from "@/lib/countryCodes";

interface Props {
  /** ISO2 code of the selected country (e.g. "ID"). */
  value: string;
  /** Fires with the newly selected ISO2 code. */
  onChange: (iso2: string) => void;
  disabled?: boolean;
}

export default function CountryCodeSelect({ value, onChange, disabled }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selected = useMemo(
    () => findCountryByIso2(value) || COUNTRY_CODES[0],
    [value],
  );

  // Filter list on query — match against name, dial code (with/without "+"),
  // and ISO2 (case-insensitive).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRY_CODES;
    const qDigits = q.replace(/\D/g, "");

    return COUNTRY_CODES.filter((c) => {
      if (c.name.toLowerCase().includes(q)) return true;
      if (c.iso2.toLowerCase() === q) return true;
      if (qDigits && c.dialCode.startsWith(qDigits)) return true;
      if (qDigits && c.dialCode === qDigits) return true;
      return false;
    });
  }, [query]);

  // Reset the highlighted option when the query changes.
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Focus the search input when the dropdown opens.
  useEffect(() => {
    if (isOpen) {
      // Small delay to let the DOM mount before focusing.
      const t = setTimeout(() => searchInputRef.current?.focus(), 10);
      return () => clearTimeout(t);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  // Close on click outside.
  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [isOpen]);

  // Keep the highlighted row in view as the user arrows through.
  useEffect(() => {
    if (!isOpen) return;
    const el = itemRefs.current[activeIndex];
    if (el && listRef.current?.contains(el)) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, isOpen]);

  const commit = (iso2: string) => {
    onChange(iso2);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[activeIndex]) commit(filtered[activeIndex].iso2);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === "Tab") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`h-full w-full flex items-center gap-1.5 text-[13.5px] text-store-fg bg-transparent border border-store-border-strong px-3 py-3 focus:outline-none focus:border-store-accent transition-colors cursor-pointer ${
          disabled ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        <span className="text-[16px] leading-none" aria-hidden>
          {flagEmoji(selected.iso2)}
        </span>
        <span className="font-mono text-[13px]">+{selected.dialCode}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 ml-auto text-store-fg-muted transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          strokeWidth={1.6}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 top-full left-0 mt-1 w-[320px] bg-white border border-store-border-strong shadow-xl">
          <div className="p-2 border-b border-store-border">
            <div className="relative">
              <Search
                className="w-3.5 h-3.5 text-store-fg-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                strokeWidth={1.6}
              />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search country or code…"
                className="w-full text-[12.5px] text-store-fg bg-transparent border border-store-border-strong pl-8 pr-2.5 py-1.5 focus:outline-none focus:border-store-accent"
              />
            </div>
          </div>

          <ul
            ref={listRef}
            role="listbox"
            className="max-h-[280px] overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-[12px] text-store-fg-muted">
                No country matches “{query}”.
              </li>
            ) : (
              filtered.map((c, i) => {
                const isSelected = c.iso2 === value;
                const isActive = i === activeIndex;
                return (
                  <li key={c.iso2} role="option" aria-selected={isSelected}>
                    <button
                      ref={(el) => {
                        itemRefs.current[i] = el;
                      }}
                      type="button"
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => commit(c.iso2)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-[12.5px] transition-colors cursor-pointer ${
                        isActive
                          ? "bg-store-hover/60"
                          : "hover:bg-store-hover/40"
                      } ${isSelected ? "font-medium" : ""}`}
                    >
                      <span className="text-[16px] leading-none" aria-hidden>
                        {flagEmoji(c.iso2)}
                      </span>
                      <span className="flex-1 min-w-0 truncate text-store-fg">
                        {c.name}
                      </span>
                      <span className="font-mono text-[12px] text-store-fg-muted whitespace-nowrap">
                        +{c.dialCode}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

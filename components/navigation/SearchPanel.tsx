"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { SearchIcon } from "@/components/icons";
import {
  searchProductsAndPages,
  type SearchProductHit,
  type SearchPageHit,
} from "@/app/actions/storefront";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Inline header search bar.
 *
 * Renders inside the sticky <header> (see StorefrontHeader) directly below
 * the main nav row. When a query of ≥2 chars yields results, a full-width
 * dropdown overlays the page content underneath.
 *
 * Layout mirrors the Figma:
 *   [ 🔍 ]  SEARCH SOMETHING (placeholder, uppercase)            [ SEARCH ]
 *   ──────────────────────────────────────────────────────────────────────
 */
export default function SearchPanel({ isOpen, onClose }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<SearchProductHit[]>([]);
  const [pages, setPages] = useState<SearchPageHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  /* Focus on open; reset everything on close. */
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
    setQuery("");
    setProducts([]);
    setPages([]);
    setLoading(false);
    setShowResults(false);
  }, [isOpen]);

  /* Escape closes the bar. */
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  /* Click outside collapses only the results dropdown — the bar stays open. */
  useEffect(() => {
    if (!isOpen || !showResults) return;
    const onDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [isOpen, showResults]);

  /* Debounced server search. */
  useEffect(() => {
    if (!isOpen) return;
    const q = query.trim();
    if (q.length < 2) {
      setProducts([]);
      setPages([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await searchProductsAndPages(q);
        if (cancelled) return;
        setProducts(res.products);
        setPages(res.pages);
        setShowResults(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, isOpen]);

  const trimmed = query.trim();

  const submitSearch = () => {
    if (!trimmed) return;
    router.push(`/shop?q=${encodeURIComponent(trimmed)}`);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitSearch();
    }
  };

  if (!isOpen) return null;

  const noResults =
    !loading &&
    trimmed.length >= 2 &&
    products.length === 0 &&
    pages.length === 0;

  return (
    <div ref={containerRef} className="relative border-t border-[#DFDDD4]">
      {/* ── Search row ─────────────────────────────────────────────── */}
      <div className="max-w-[1512px] mx-auto px-6 sm:px-10 py-3 flex items-center gap-4">
        <SearchIcon className="w-[18px] h-[18px] text-[#7A8471] flex-shrink-0" />

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => trimmed.length >= 2 && setShowResults(true)}
          placeholder="SEARCH SOMETHING"
          autoComplete="off"
          className="flex-1 min-w-0 bg-transparent border-0 text-[12px] tracking-[0.16em] text-[#3B4736] placeholder:text-[#B4B8A8] placeholder:tracking-[0.16em] focus:outline-none py-2"
        />

        <button
          type="button"
          onClick={submitSearch}
          disabled={!trimmed}
          className="flex-shrink-0 bg-[#64765B] hover:bg-[#52624B] text-white text-[10.5px] tracking-[0.22em] uppercase font-medium px-7 sm:px-9 py-2.5 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Search
        </button>
      </div>

      {/* ── Results dropdown ───────────────────────────────────────── */}
      {showResults && trimmed.length >= 2 && (
        <div className="absolute top-full left-0 right-0 bg-store-bg border-b border-[#DFDDD4] shadow-lg max-h-[70vh] overflow-y-auto z-40">
          <div className="max-w-[1512px] mx-auto px-6 sm:px-10 py-8">
            {loading && products.length === 0 && pages.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-10 text-[12.5px] text-[#7A8471]">
                <Loader2 className="w-4 h-4 animate-spin" />
                Searching…
              </div>
            ) : noResults ? (
              <p className="text-center py-10 text-[12.5px] text-[#7A8471]">
                No results for &ldquo;{trimmed}&rdquo;.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {products.length > 0 && (
                  <section>
                    <h3 className="font-serif text-[16px] text-[#3B4736] mb-4 font-normal">
                      Products
                    </h3>
                    <ul className="space-y-4">
                      {products.map((p) => (
                        <li key={p.sku}>
                          <Link
                            href={`/shop/${p.sku.toLowerCase()}`}
                            onClick={onClose}
                            className="flex items-start gap-3 group"
                          >
                            <div className="relative w-12 aspect-[3/4] flex-shrink-0 bg-[#E2E0D6] overflow-hidden">
                              {p.coverImage ? (
                                <Image
                                  src={p.coverImage}
                                  alt={p.name}
                                  fill
                                  sizes="48px"
                                  className="object-cover"
                                />
                              ) : null}
                            </div>
                            <div className="flex-1 min-w-0 pt-0.5">
                              <p className="font-serif text-[14px] text-[#3B4736] group-hover:text-[#64765B] transition-colors leading-snug">
                                {p.sku}-{p.name}
                              </p>
                              {p.brand && (
                                <p className="text-[11.5px] text-[#7A8471] mt-0.5">
                                  Brand: {p.brand}
                                </p>
                              )}
                              {p.snippet && (
                                <p className="text-[11px] text-[#9AA192] mt-0.5 line-clamp-1">
                                  {p.snippet}
                                </p>
                              )}
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {pages.length > 0 && (
                  <section>
                    <h3 className="font-serif text-[16px] text-[#3B4736] mb-4 font-normal">
                      Other Pages
                    </h3>
                    <ul className="space-y-3">
                      {pages.map((pg) => (
                        <li key={pg.href}>
                          <Link
                            href={pg.href}
                            onClick={onClose}
                            className="block group"
                          >
                            <p className="text-[13px] text-[#3B4736] group-hover:text-[#64765B] transition-colors">
                              {pg.title}
                            </p>
                            <p className="text-[11.5px] text-[#7A8471] mt-0.5 line-clamp-1">
                              {pg.subtitle}
                            </p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

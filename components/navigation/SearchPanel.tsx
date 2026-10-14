"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Search as SearchIcon, X } from "lucide-react";
import {
  searchProductsAndPages,
  getTrendingProducts,
  type SearchProductHit,
  type SearchPageHit,
} from "@/app/actions/storefront";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Floating header search dropdown.
 *
 * Renders as an absolutely-positioned panel anchored under the header's
 * right edge (see StorefrontHeader). Behaviour:
 *
 *   • Opens on click of the header's search icon.
 *   • On first open, fetches and caches a "Trending Products" list.
 *   • As the user types, a debounced server call runs on every keystroke
 *     (≥2 chars) and the panel swaps to live results.
 *   • Query < 2 chars → falls back to Trending.
 *   • Enter or the "See all results" CTA routes to /shop?q=… .
 *   • Escape / outside click / clearing the input closes the panel.
 */
export default function SearchPanel({ isOpen, onClose }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<SearchProductHit[]>([]);
  const [pages, setPages] = useState<SearchPageHit[]>([]);
  const [loading, setLoading] = useState(false);

  // Trending — fetched lazily once per session when the panel first opens.
  const [trending, setTrending] = useState<SearchProductHit[]>([]);
  const [trendingLoaded, setTrendingLoaded] = useState(false);

  /* ── Focus on open; reset transient state on close ─────────────── */
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
    setQuery("");
    setProducts([]);
    setPages([]);
    setLoading(false);
  }, [isOpen]);

  /* ── Load trending once, first time the panel opens ────────────── */
  useEffect(() => {
    if (!isOpen || trendingLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getTrendingProducts(5);
        if (!cancelled) setTrending(res);
      } finally {
        if (!cancelled) setTrendingLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, trendingLoaded]);

  /* ── Debounced live search ─────────────────────────────────────── */
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
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, isOpen]);

  /* ── Escape closes the panel ───────────────────────────────────── */
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  /* ── Click outside closes the panel ────────────────────────────── */
  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [isOpen, onClose]);

  /* ── Derived view state ────────────────────────────────────────── */
  const trimmed = query.trim();
  const showTrending = trimmed.length < 2;
  const visibleProducts = showTrending ? trending : products;

  const submit = () => {
    if (!trimmed) return;
    router.push(`/shop?q=${encodeURIComponent(trimmed)}`);
    onClose();
  };

  if (!isOpen) return null;

  const showEmptyTrending =
    showTrending && trending.length === 0 && trendingLoaded;
  const showNoResults =
    !showTrending && !loading && products.length === 0 && pages.length === 0;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label="Product search"
      className="absolute top-full right-4 sm:right-10 mt-2 w-[min(420px,calc(100vw-2rem))] bg-[#F5F2EA] border border-[#DDD9CE] shadow-[0_12px_36px_rgba(45,56,40,0.14)] z-50"
    >
      {/* ── Search input row ─────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[#DDD9CE]">
        <SearchIcon
          className="w-[15px] h-[15px] text-[#6A7563] flex-shrink-0"
          strokeWidth={2}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="What are you looking for?"
          autoComplete="off"
          spellCheck={false}
          className="flex-1 min-w-0 bg-transparent border-0 text-[13px] text-[#2D3828] placeholder:text-[#A8AC9E] focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="text-[#A8AC9E] hover:text-[#2D3828] transition-colors cursor-pointer flex-shrink-0 p-0.5"
          >
            <X className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        )}
      </div>

      {/* ── Body ──────────────────────────────────────────────────── */}
      <div className="px-5 py-4 max-h-[min(520px,calc(100vh-180px))] overflow-y-auto">
        <div className="flex items-center justify-between mb-3 h-4">
          <h3 className="text-[10px] tracking-[0.18em] uppercase text-[#6A7563] font-medium">
            {showTrending ? "Trending Products" : "Results"}
          </h3>
          {loading && !showTrending && (
            <Loader2
              className="w-3.5 h-3.5 text-[#6A7563] animate-spin"
              strokeWidth={2}
            />
          )}
        </div>

        {showEmptyTrending ? (
          <p className="text-[12px] text-[#6A7563] py-4 text-center">
            Nothing to show right now.
          </p>
        ) : showNoResults ? (
          <p className="text-[12px] text-[#6A7563] py-4 text-center">
            No results for &ldquo;{trimmed}&rdquo;.
          </p>
        ) : (
          <ul className="space-y-3">
            {visibleProducts.map((p) => (
              <li key={p.sku}>
                <Link
                  href={`/shop/${p.sku.toLowerCase()}`}
                  onClick={onClose}
                  className="flex items-center gap-3 group"
                >
                  <div className="w-12 h-16 flex-shrink-0 bg-[#E2E0D6] overflow-hidden">
                    {p.coverImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.coverImage}
                        alt={p.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] text-[#2D3828] font-medium leading-snug truncate group-hover:text-[#64765B] transition-colors">
                      {p.sku} -{p.name}
                    </p>
                    <p className="text-[11px] text-[#6A7563] mt-0.5 truncate">
                      Brand: {p.brand || "—"}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* Page hits — shown inline when the query matches a static route. */}
        {!showTrending && pages.length > 0 && (
          <div className="mt-5 pt-4 border-t border-[#DDD9CE]">
            <h3 className="text-[10px] tracking-[0.18em] uppercase text-[#6A7563] font-medium mb-3">
              Pages
            </h3>
            <ul className="space-y-2.5">
              {pages.map((pg) => (
                <li key={pg.href}>
                  <Link
                    href={pg.href}
                    onClick={onClose}
                    className="block group"
                  >
                    <p className="text-[12.5px] text-[#2D3828] group-hover:text-[#64765B] transition-colors">
                      {pg.title}
                    </p>
                    <p className="text-[11px] text-[#6A7563] mt-0.5 line-clamp-1">
                      {pg.subtitle}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA — routes to the full shop page with the query applied. */}
        {!showTrending && products.length > 0 && (
          <button
            type="button"
            onClick={submit}
            className="mt-4 w-full text-[11px] tracking-[0.18em] uppercase text-[#64765B] font-medium hover:text-[#52624B] transition-colors text-center py-2 cursor-pointer"
          >
            See all results →
          </button>
        )}
      </div>
    </div>
  );
}

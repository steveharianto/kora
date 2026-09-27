"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X, Loader2, ArrowRight } from "lucide-react";
import {
  searchProductsAndPages,
  type SearchProductHit,
  type SearchPageHit,
} from "@/app/actions/storefront";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchPanel({ isOpen, onClose }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<SearchProductHit[]>([]);
  const [pages, setPages] = useState<SearchPageHit[]>([]);
  const [loading, setLoading] = useState(false);

  // Focus the input when opening; reset state when closing.
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    setQuery("");
    setProducts([]);
    setPages([]);
    setLoading(false);
  }, [isOpen]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  // Debounced search.
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

  const trimmed = query.trim();
  const showEmptyState =
    !loading && trimmed.length >= 2 && products.length === 0 && pages.length === 0;

  const submitSearchAll = () => {
    if (!trimmed) return;
    router.push(`/shop?q=${encodeURIComponent(trimmed)}`);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitSearchAll();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[80] bg-black/30"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel — top-anchored, full width, capped height */}
      <div className="fixed top-0 left-0 right-0 z-[90] bg-store-bg shadow-2xl max-h-[88vh] flex flex-col">
        <div className="max-w-[720px] w-full mx-auto px-6 py-6 flex flex-col min-h-0">
          {/* Search input row */}
          <div className="flex items-center gap-3 border-b border-store-border-strong pb-4">
            <Search
              className="w-5 h-5 text-store-fg-muted flex-shrink-0"
              strokeWidth={1.8}
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search dresses, brands, pages…"
              className="flex-1 text-[15px] text-store-fg bg-transparent border-none outline-none placeholder-store-fg-subtle"
            />
            {loading && (
              <Loader2 className="w-4 h-4 text-store-fg-muted animate-spin flex-shrink-0" />
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close search"
              className="text-store-fg-muted hover:text-store-fg transition-colors p-1 cursor-pointer flex-shrink-0"
            >
              <X className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </div>

          {/* Results */}
          <div className="overflow-y-auto pt-6 -mx-1">
            {trimmed.length < 2 ? (
              <p className="text-[13px] text-store-fg-muted text-center py-12">
                Type at least 2 characters to search.
              </p>
            ) : showEmptyState ? (
              <p className="text-[13px] text-store-fg-muted text-center py-12">
                No results for &ldquo;{trimmed}&rdquo;.
              </p>
            ) : (
              <div className="space-y-8 pb-2">
                {/* Products */}
                {products.length > 0 && (
                  <section>
                    <h3 className="font-serif text-[18px] text-store-fg mb-4 font-normal">
                      Products
                    </h3>
                    <ul className="space-y-4">
                      {products.map((p) => (
                        <li key={p.sku}>
                          <Link
                            href={`/shop/${p.sku.toLowerCase()}`}
                            onClick={onClose}
                            className="flex items-start gap-4 group"
                          >
                            <div className="relative w-14 aspect-[3/4] flex-shrink-0 bg-[#E2E0D6] overflow-hidden">
                              {p.coverImage ? (
                                <Image
                                  src={p.coverImage}
                                  alt={p.name}
                                  fill
                                  sizes="56px"
                                  className="object-cover"
                                />
                              ) : null}
                            </div>
                            <div className="flex-1 min-w-0 pt-0.5">
                              <p className="font-serif text-[15px] text-store-fg group-hover:text-store-accent transition-colors leading-snug">
                                {p.sku}-{p.name}
                              </p>
                              {p.brand && (
                                <p className="text-[12px] text-store-fg-muted mt-0.5">
                                  Brand: {p.brand}
                                </p>
                              )}
                              {p.snippet && (
                                <p className="text-[11.5px] text-store-fg-subtle mt-0.5 line-clamp-1">
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

                {/* Pages */}
                {pages.length > 0 && (
                  <section>
                    <h3 className="font-serif text-[18px] text-store-fg mb-4 font-normal">
                      Other Pages
                    </h3>
                    <ul className="space-y-4">
                      {pages.map((pg) => (
                        <li key={pg.href}>
                          <Link
                            href={pg.href}
                            onClick={onClose}
                            className="block group"
                          >
                            <p className="text-[14px] text-store-fg group-hover:text-store-accent transition-colors">
                              {pg.title}
                            </p>
                            <p className="text-[12px] text-store-fg-muted mt-0.5 line-clamp-1">
                              {pg.subtitle}
                            </p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* Search all fallback */}
                {trimmed.length >= 2 && (
                  <button
                    type="button"
                    onClick={submitSearchAll}
                    className="w-full flex items-center gap-3 py-3 border-t border-store-border text-left text-[13px] text-store-fg-muted hover:text-store-fg transition-colors cursor-pointer group"
                  >
                    <Search
                      className="w-4 h-4 flex-shrink-0"
                      strokeWidth={1.8}
                    />
                    <span className="flex-1">
                      Search all &ldquo;
                      <strong className="font-medium text-store-fg">
                        {trimmed}
                      </strong>
                      &rdquo;
                    </span>
                    <ArrowRight
                      className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"
                      strokeWidth={1.8}
                    />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

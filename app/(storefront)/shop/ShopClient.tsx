"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Plus, ChevronDown } from "lucide-react";
import ProductCard from "./ProductCard";
import SortDropdown from "./SortDropdown";
import FilterDrawer, { type FilterState } from "./FilterDrawer";

interface Item {
  sku: string;
  name: string;
  brand: string;
  size: string;
  color: string;
  rentalPrice: number;
  status: string;
  tags: string[];
  coverImage: string | null;
  dateAdded: string;
  category: string;
}

interface Props {
  items: Item[];
  facets: { brands: string[]; sizes: string[]; colors: string[] };
  initial: {
    q: string;
    category: string;
    filter: string;
    sort: string;
    brand: string;
    size: string;
    color: string;
  };
}

const PAGE_SIZE = 12;

export default function ShopClient({ items, facets, initial }: Props) {
  const router = useRouter();

  // ── State ────────────────────────────────────────────────────────────
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState(initial.sort || "date-desc");
  const [category, setCategory] = useState(initial.category);
  const [presetFilter, setPresetFilter] = useState(initial.filter);
  const [query] = useState(initial.q);
  const [rentOnDate, setRentOnDate] = useState("");
  const [fittingSession, setFittingSession] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [filters, setFilters] = useState<FilterState>({
    brands: initial.brand ? initial.brand.split(",").filter(Boolean) : [],
    sizes: initial.size ? initial.size.split(",").filter(Boolean) : [],
    colors: initial.color ? initial.color.split(",").filter(Boolean) : [],
    occasions: [],
  });

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (isFilterOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isFilterOpen]);

  // Reset visible window whenever the filter inputs change.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [sortBy, category, presetFilter, filters, query]);

  // Sync URL when the meaningful state changes — makes filters shareable.
  const syncUrl = useCallback(
    (next: Partial<{
      sort: string;
      category: string;
      filter: string;
      brand: string;
      size: string;
      color: string;
    }>) => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      const cat = next.category ?? category;
      const flt = next.filter ?? presetFilter;
      const srt = next.sort ?? sortBy;
      const br = next.brand ?? filters.brands.join(",");
      const sz = next.size ?? filters.sizes.join(",");
      const cl = next.color ?? filters.colors.join(",");
      if (cat) params.set("category", cat);
      if (flt) params.set("filter", flt);
      if (srt && srt !== "date-desc") params.set("sort", srt);
      if (br) params.set("brand", br);
      if (sz) params.set("size", sz);
      if (cl) params.set("color", cl);
      const qs = params.toString();
      router.replace(qs ? `/shop?${qs}` : "/shop", { scroll: false });
    },
    [query, category, presetFilter, sortBy, filters, router],
  );

  // ── Derived ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = items.slice();

    if (category) list = list.filter((i) => i.category === category);

    if (presetFilter === "new") {
      // Already sorted by date_added desc from server, but ensure stable.
      list.sort((a, b) => (b.dateAdded || "").localeCompare(a.dateAdded || ""));
    } else if (presetFilter === "available-now") {
      // "Available this week" — for now same as the server `status='Available'` filter.
      // Phase 2: intersect with fitting-session availability.
    }

    if (query) {
      const q = query.toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.sku.toLowerCase().includes(q) ||
          i.brand.toLowerCase().includes(q),
      );
    }

    if (filters.brands.length) {
      const set = new Set(filters.brands);
      list = list.filter((i) => set.has(i.brand));
    }
    if (filters.sizes.length) {
      const set = new Set(filters.sizes.map((s) => s.toUpperCase()));
      list = list.filter((i) => set.has((i.size || "").toUpperCase()));
    }
    if (filters.colors.length) {
      const set = new Set(filters.colors.map((c) => c.toLowerCase()));
      list = list.filter((i) => set.has((i.color || "").toLowerCase()));
    }

    // Sort
    switch (sortBy) {
      case "alpha-asc":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "alpha-desc":
        list.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "price-asc":
        list.sort((a, b) => a.rentalPrice - b.rentalPrice);
        break;
      case "price-desc":
        list.sort((a, b) => b.rentalPrice - a.rentalPrice);
        break;
      case "date-desc":
      default:
        list.sort((a, b) => (b.dateAdded || "").localeCompare(a.dateAdded || ""));
        break;
    }

    return list;
  }, [items, category, presetFilter, query, filters, sortBy]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  // Heading + subtitle switch on category.
  const { heading, subtitle } = useMemo(() => {
    if (category === "traditional") return { heading: "Traditional", subtitle: "Kebaya, kaftan, and heritage pieces." };
    if (category === "accessories") return { heading: "Accessories", subtitle: "The finishing touches." };
    if (presetFilter === "new") return { heading: "New Arrivals", subtitle: "Fresh in, ready to rent." };
    if (presetFilter === "available-now") return { heading: "Available This Week", subtitle: "Got an event coming up? These pieces are ready for you." };
    return { heading: "All Dresses", subtitle: "Every piece, ready to rent." };
  }, [category, presetFilter]);

  const activeFilterCount =
    filters.brands.length + filters.sizes.length + filters.colors.length + filters.occasions.length;

  const applyFilters = (next: FilterState) => {
    setFilters(next);
    setIsFilterOpen(false);
    syncUrl({ brand: next.brands.join(","), size: next.sizes.join(","), color: next.colors.join(",") });
  };

  const clearAll = () => {
    const empty: FilterState = { brands: [], sizes: [], colors: [], occasions: [] };
    setFilters(empty);
    syncUrl({ brand: "", size: "", color: "" });
  };

  return (
    <div className="w-full">
      <div className="max-w-[1512px] mx-auto px-6 sm:px-12 py-10 sm:py-14">
        {/* ── Title ─────────────────────────────────────────────────── */}
        <div className="mb-8">
          <h1 className="font-serif text-[34px] sm:text-[46px] font-normal tracking-[0.01em] text-store-fg leading-tight">
            {heading}
          </h1>
          <p className="text-[13px] text-store-fg-muted mt-2">{subtitle}</p>
        </div>

        {/* ── Toolbar: dates + filter / sort ───────────────────────── */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div>
              <label className="block text-[10px] tracking-[0.18em] uppercase text-store-fg-muted mb-1.5">
                I want rent on
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={rentOnDate}
                  onChange={(e) => setRentOnDate(e.target.value)}
                  className="w-[190px] text-[12px] tracking-wider uppercase bg-transparent border border-store-border-strong px-3 py-2.5 pr-9 text-store-fg focus:outline-none focus:border-store-accent"
                  placeholder="MM/DD/YYYY"
                />
                <Calendar className="w-4 h-4 text-store-fg-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] tracking-[0.18em] uppercase text-store-fg-muted mb-1.5">
                I want book fitting on
              </label>
              <div className="relative">
                <select
                  value={fittingSession}
                  onChange={(e) => setFittingSession(e.target.value)}
                  className="w-[190px] text-[12px] tracking-wider uppercase bg-transparent border border-store-border-strong px-3 py-2.5 pr-9 text-store-fg focus:outline-none focus:border-store-accent cursor-pointer appearance-none"
                >
                  <option value="">Select session</option>
                  <option value="10:00">10:00</option>
                  <option value="11:00">11:00</option>
                  <option value="13:00">13:00</option>
                  <option value="14:00">14:00</option>
                  <option value="15:00">15:00</option>
                  <option value="16:00">16:00</option>
                </select>
                <ChevronDown className="w-4 h-4 text-store-fg-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 text-[11px] tracking-[0.18em] uppercase text-store-fg-muted">
            <button
              type="button"
              onClick={() => setIsFilterOpen(true)}
              className="flex items-center gap-1.5 hover:text-store-fg transition-colors cursor-pointer"
            >
              <span>Filter</span>
              <Plus className="w-3.5 h-3.5" />
              {activeFilterCount > 0 && (
                <span className="ml-1 w-4 h-4 flex items-center justify-center rounded-full bg-store-accent text-white text-[9px] font-bold tracking-normal">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <SortDropdown value={sortBy} onChange={(v) => { setSortBy(v); syncUrl({ sort: v }); }} />
          </div>
        </div>

        {/* ── Grid ─────────────────────────────────────────────────── */}
        {visible.length === 0 ? (
          <div className="py-24 text-center">
            <p className="font-serif text-[20px] text-store-fg mb-2">Nothing here yet</p>
            <p className="text-[13px] text-store-fg-muted">
              Try removing a filter or checking back soon.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-10">
            {visible.map((item) => (
              <ProductCard key={item.sku} item={item} />
            ))}
          </div>
        )}

        {/* ── View more ───────────────────────────────────────────── */}
        {hasMore && (
          <div className="flex justify-center mt-14">
            <button
              type="button"
              onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
              className="px-10 py-3 bg-store-accent text-store-accent-fg text-[11px] tracking-[0.2em] uppercase font-medium hover:bg-store-accent-hover transition-colors cursor-pointer"
            >
              View More
            </button>
          </div>
        )}
      </div>

      {/* ── Filter drawer ────────────────────────────────────────── */}
      <FilterDrawer
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        facets={facets}
        value={filters}
        onApply={applyFilters}
        onClearAll={clearAll}
      />
    </div>
  );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  PAGE_SIZE_SESSION_KEY,
} from "@/lib/pagination";

interface PaginationBarProps {
  /** Total row count for the current view (post-filter). */
  total: number;
  /** Current page number (already clamped by slicePage). */
  page: number;
  /** Rows per page currently in effect. */
  perPage: number;
  /** 0-based inclusive start index of the current page. */
  start: number;
  /** 0-based exclusive end index of the current page. */
  end: number;
  /**
   * Preserved filter/search/tab params EXCLUDING `page` and `perPage`.
   * Must be a plain serializable object — the client component builds
   * every href from these + the current pathname.
   */
  queryParams?: Record<string, string>;
  /** Optional noun shown after the count, e.g. "orders". */
  itemLabel?: string;
}

/**
 * Shared admin pagination bar (client).
 *
 * Server pages pass only serializable props — no function props, per the
 * App Router boundary rule. Hrefs are reconstructed client-side from
 * `pathname` + `queryParams`, with `page` and `perPage` appended.
 *
 * Behaviour:
 *   • Renders "Rows [25 ▾] X–Y of Z" on the left, prev/page/next on the right.
 *   • If the URL lacks `perPage`, the stored sessionStorage preference is
 *     applied via a silent `router.replace` (no history pollution).
 *   • Changing the dropdown writes to sessionStorage and pushes a new URL
 *     with `page` reset to 1.
 */
export default function PaginationBar({
  total,
  page,
  perPage,
  start,
  end,
  queryParams = {},
  itemLabel,
}: PaginationBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchString = searchParams.toString();

  const buildHref = (
    targetPage: number,
    targetPerPage: number = perPage,
  ): string => {
    const params = new URLSearchParams(queryParams);
    if (targetPerPage !== DEFAULT_PAGE_SIZE) {
      params.set("perPage", String(targetPerPage));
    }
    if (targetPage > 1) {
      params.set("page", String(targetPage));
    }
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  // Re-apply the stored page-size preference when the URL doesn't
  // already declare one. URL always wins when explicit.
  useEffect(() => {
    if (searchParams.get("perPage")) return;

    const stored = window.sessionStorage.getItem(PAGE_SIZE_SESSION_KEY);
    if (!stored) return;

    const n = parseInt(stored, 10);
    if (!(PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) return;
    if (n === DEFAULT_PAGE_SIZE) return;

    const params = new URLSearchParams(queryParams);
    params.set("perPage", String(n));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchString]);

  const handleChangePerPage = (next: number) => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(PAGE_SIZE_SESSION_KEY, String(next));
    }
    router.push(buildHref(1, next), { scroll: false });
  };

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const countLabel =
    total === 0
      ? itemLabel
        ? `0 of 0 ${itemLabel}`
        : "0 of 0"
      : itemLabel
        ? `${start + 1}–${end} of ${total} ${itemLabel}`
        : `${start + 1}–${end} of ${total}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-3 text-xs text-muted">
      <div className="flex items-center gap-2">
        <span className="text-[11px] tracking-[0.14em] uppercase font-medium">
          Rows
        </span>
        <select
          value={perPage}
          onChange={(e) => handleChangePerPage(parseInt(e.target.value, 10))}
          aria-label="Rows per page"
          className="px-2.5 py-1 rounded-lg border border-line bg-card text-ink text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-wine"
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="tabular-nums">{countLabel}</span>
      </div>

      <div className="flex items-center gap-1">
        <Link
          href={buildHref(Math.max(1, page - 1))}
          aria-label="Previous page"
          aria-disabled={!canPrev}
          tabIndex={canPrev ? 0 : -1}
          className={`w-6 h-6 flex items-center justify-center border border-line rounded bg-card hover:bg-[#F6F4EF] transition ${
            !canPrev ? "pointer-events-none opacity-40" : ""
          }`}
        >
          ‹
        </Link>
        <span className="px-2 text-[11px] tabular-nums">
          {page} / {totalPages}
        </span>
        <Link
          href={buildHref(Math.min(totalPages, page + 1))}
          aria-label="Next page"
          aria-disabled={!canNext}
          tabIndex={canNext ? 0 : -1}
          className={`w-6 h-6 flex items-center justify-center border border-line rounded bg-card hover:bg-[#F6F4EF] transition ${
            !canNext ? "pointer-events-none opacity-40" : ""
          }`}
        >
          ›
        </Link>
      </div>
    </div>
  );
}

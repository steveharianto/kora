/**
 * Shared pagination constants + helpers for admin list pages.
 *
 * Page size is user-configurable (default 25) and persisted in
 * sessionStorage so the preference follows the admin across every
 * list page for the duration of their browser session. The URL
 * carries `?perPage=N` as the source of truth for a given render —
 * see `components/admin/PaginationBar.tsx` for the sync logic.
 */

export const DEFAULT_PAGE_SIZE = 25;

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

/** sessionStorage key for the per-page preference. */
export const PAGE_SIZE_SESSION_KEY = "kora_admin_page_size";

/**
 * Normalises the raw `searchParams.perPage` value into a valid option.
 * Falls back to DEFAULT_PAGE_SIZE for missing / malformed / disallowed
 * values so a bad URL can never blow up the query.
 */
export function resolvePageSize(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = parseInt(value || "", 10);
  if (!Number.isNaN(n) && (PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) {
    return n;
  }
  return DEFAULT_PAGE_SIZE;
}

export interface PageSlice<T> {
  pageItems: T[];
  total: number;
  totalPages: number;
  currentPage: number;
  /** 0-based inclusive index of the first item on this page. */
  start: number;
  /** 0-based exclusive index after the last item on this page. */
  end: number;
}

/**
 * Slices `items` into a page. `rawPage` is the URL's `searchParams.page`
 * (string or string[]) — it's clamped to `[1, totalPages]` so an
 * out-of-range value (e.g. after a filter reduces the row count) lands
 * on the last valid page instead of rendering an empty table.
 */
export function slicePage<T>(
  items: T[],
  rawPage: string | string[] | undefined,
  perPage: number,
): PageSlice<T> {
  const pageInput = Array.isArray(rawPage) ? rawPage[0] : rawPage;
  const requestedPage = Math.max(1, parseInt(pageInput || "1", 10) || 1);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(requestedPage, totalPages);
  const start = (currentPage - 1) * perPage;
  const end = Math.min(start + perPage, total);

  return {
    pageItems: items.slice(start, end),
    total,
    totalPages,
    currentPage,
    start,
    end,
  };
}

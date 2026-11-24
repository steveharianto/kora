const DEFAULT_PAGE_SIZE = 1000;

export interface PaginatedResult<T> {
  data: T[];
  error: { message: string } | null;
}

/**
 * Fetches all rows from a Supabase PostgREST query by paging in chunks of 1,000,
 * working around Supabase's default `max_rows = 1000` response cap.
 *
 * IMPORTANT: The query inside `buildPage` MUST include a deterministic `.order(...)`
 * ending with a unique tie-breaker column (e.g. `id` or `sku`) so rows are never
 * skipped or duplicated across page boundaries.
 */
export async function fetchAllRows<T>(
  buildPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<PaginatedResult<T>> {
  const all: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await buildPage(from, from + pageSize - 1);
    if (error) {
      return { data: [], error };
    }
    const batch = data ?? [];
    all.push(...batch);
    if (batch.length < pageSize) {
      break;
    }
    from += pageSize;
  }

  return { data: all, error: null };
}

/**
 * Converts a YYYY-MM-DD calendar date into an inclusive Jakarta-timezone
 * timestamp bound for filtering `timestamptz` columns (`requested_at`,
 * `refunded_at`, `created_at`). Passes through values that already include a time.
 */
export function toWibStart(dateStr: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
    ? `${dateStr}T00:00:00+07:00`
    : dateStr;
}

export function toWibEnd(dateStr: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
    ? `${dateStr}T23:59:59.999+07:00`
    : dateStr;
}

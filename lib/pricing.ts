/**
 * Shared rental pricing helpers.
 *
 * Tiered default for the per-dress additional-day rate, keyed on Day 1
 * base rental price:
 *
 *   base <  500.000   →  50.000
 *   base < 1.000.000  →  70.000
 *   base < 2.000.000  → 100.000
 *   base >= 2.000.000 → 200.000
 */

export function defaultAddOnForBase(
  base: number | string | null | undefined,
): number | "" {
  const n = Number(base);
  if (!n || !isFinite(n) || n <= 0) return "";
  if (n < 500_000) return 50_000;
  if (n < 1_000_000) return 70_000;
  if (n < 2_000_000) return 100_000;
  return 200_000;
}

/**
 * Resolves the effective per-extra-day rate for an item.
 *
 * - An explicit non-negative numeric `addOnPrice` (including `0` for free
 *   extra days) is returned as-is.
 * - Otherwise (`null`, `undefined`, `""`, NaN, or negative), falls back to
 *   the tiered default for `basePrice` (or `0` when `basePrice <= 0`).
 */
export function resolveAddOnPrice(
  addOnPrice: number | string | null | undefined,
  basePrice: number | string | null | undefined,
): number {
  if (addOnPrice !== null && addOnPrice !== undefined && addOnPrice !== "") {
    const parsed = Number(addOnPrice);
    if (isFinite(parsed) && parsed >= 0) return parsed;
  }
  const fallback = defaultAddOnForBase(basePrice);
  return typeof fallback === "number" ? fallback : 0;
}

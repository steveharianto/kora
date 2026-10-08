// lib/promo.ts
//
// Hardcoded promo codes — no DB table.
// Percent is applied to the RENTAL SUBTOTAL only (not deposits, shipping,
// or store credit). Codes are case-insensitive and trimmed on lookup.

export const PROMO_CODES: Record<string, number> = {
  KORAWEB: 5,
};

/**
 * Returns the discount percent (0–100) for a given code.
 * Returns 0 for empty / unknown codes so callers can apply unconditionally.
 */
export function getPromoDiscountPercent(
  code: string | null | undefined,
): number {
  if (!code) return 0;
  const key = code.trim().toUpperCase();
  return PROMO_CODES[key] || 0;
}

/** Normalises a code for storage / display — uppercase, trimmed. */
export function normalizePromoCode(code: string | null | undefined): string {
  return (code || "").trim().toUpperCase();
}

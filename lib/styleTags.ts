/**
 * Canonical style tags — the only tags KORA recognises on a garment.
 *
 * These are used in three places and MUST stay in sync:
 *   1. Admin inventory item form (the tag picker)
 *   2. Storefront catalog filter drawer (the "Style" section)
 *   3. Shop facet computation (only these surface as filter options)
 *
 * Order matters — it drives the display order everywhere.
 */
export const STYLE_TAGS = ["Mini", "Midi", "Maxi", "Hijab Friendly"] as const;

export type StyleTag = (typeof STYLE_TAGS)[number];

/**
 * Normalises an arbitrary array of raw tag strings to the canonical set.
 * - Drops anything not in STYLE_TAGS
 * - Canonicalises casing ("hijab friendly" → "Hijab Friendly")
 * - Deduplicates
 * - Returns in STYLE_TAGS order
 */
export function normalizeStyleTags(raw: unknown): StyleTag[] {
  if (!Array.isArray(raw)) return [];
  const lowered = new Set(
    raw
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim().toLowerCase()),
  );
  return STYLE_TAGS.filter((s) => lowered.has(s.toLowerCase()));
}

/** Case-insensitive membership test for a single tag value. */
export function isCanonicalStyleTag(value: unknown): value is StyleTag {
  if (typeof value !== "string") return false;
  const lower = value.trim().toLowerCase();
  return STYLE_TAGS.some((s) => s.toLowerCase() === lower);
}

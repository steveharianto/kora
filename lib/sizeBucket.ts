// lib/sizeBucket.ts
//
// Canonical size bucketing for storefront filtering.
//
// The raw `items.size` field is inconsistent — it mixes letter sizes
// (XS/S/M/L), Zimmermann numeric (Size 0-3, OP), UK/AUS/US numeric
// (UK 10 US 6), and compound labels ("Top M Pants M"). Customers can't
// meaningfully filter on that. This module derives a single bucket in
// {XS, S, M, L, XL, Free Size} per item, using the label when reliable
// and the outer-bust measurement as fallback.
//
// Nothing is persisted — the derivation runs at query time in the shop
// server component. ~230 items makes this free.

export const SIZE_BUCKETS = [
  'XS',
  'S',
  'M',
  'L',
  'XL',
  'Free Size',
] as const;

export type SizeBucket = (typeof SIZE_BUCKETS)[number];

/** Ordered list for UI — the order the drawer should render in. */
export const SIZE_BUCKET_ORDER: SizeBucket[] = [...SIZE_BUCKETS];

/** Shown to the customer when we truly can't determine a bucket. */
export const UNKNOWN_BUCKET_LABEL = 'See measurements';

/* ── Measurement parsing ──────────────────────────────────────────── */

/**
 * Parses a raw measurement string into a numeric value.
 *
 *   "90"          → 90
 *   "80-110"      → 95          (midpoint of the range)
 *   "up to 140"   → null        (caller treats as free size)
 *   "ALL SIZE"    → null
 *   "free size"   → null
 *   "-" / ""      → null
 */
export function parseNumericOrRange(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim().toLowerCase();
  if (!s || s === '-') return null;

  if (
    s.includes('all size') ||
    s.includes('free size') ||
    s.includes('freesize') ||
    s.includes('up to') ||
    s.includes('upto')
  ) {
    return null;
  }

  const rangeMatch = s.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/);
  if (rangeMatch) {
    const lo = parseFloat(rangeMatch[1]);
    const hi = parseFloat(rangeMatch[2]);
    if (!isNaN(lo) && !isNaN(hi)) {
      // A range wider than ~25 cm almost always means "stretchy / wraps
      // to fit most" — bucket as Free Size rather than midpoint.
      if (hi - lo > 25) return null;
      return (lo + hi) / 2;
    }
  }

  const numMatch = s.match(/^(\d+(?:\.\d+)?)/);
  if (numMatch) {
    const n = parseFloat(numMatch[1]);
    return isNaN(n) ? null : n;
  }

  return null;
}

/** Detects explicit free-size markers. */
export function isFreeSizeMarker(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const s = String(value).trim().toLowerCase();
  return (
    s.includes('all size') ||
    s.includes('free size') ||
    s.includes('freesize') ||
    s.includes('up to') ||
    s.includes('upto')
  );
}

/**
 * Converts an outer bust (cm) into a canonical bucket. Thresholds align
 * with the letter labels already in the DB — a Self Portrait UK 8 (S)
 * has bust ~82–84; a Zimmermann Size 1 (S) has bust ~84–86.
 */
export function bustToBucket(bust: number | null): SizeBucket | null {
  if (bust === null) return null;
  if (bust <= 80) return 'XS';
  if (bust <= 86) return 'S';
  if (bust <= 92) return 'M';
  if (bust <= 98) return 'L';
  if (bust <= 106) return 'XL';
  return 'Free Size';
}

/* ── Label parsing ────────────────────────────────────────────────── */

function parseLetterLabel(s: string): SizeBucket | null {
  const clean = s.trim().toUpperCase();
  if (clean === 'XS' || clean === 'XS/S') return 'XS';
  if (clean === 'S' || clean === 'SMALL') return 'S';
  if (clean === 'M' || clean === 'MEDIUM') return 'M';
  if (clean === 'L' || clean === 'LARGE') return 'L';
  if (['XL', 'XXL', 'XXXL', '2XL', '3XL'].includes(clean)) return 'XL';
  return null;
}

/**
 * Zimmermann numeric labels. Runs small — Size 0/OP is XS, Size 1 is S,
 * etc. This is Zimmermann's own published scale.
 */
function parseZimmermannLabel(s: string): SizeBucket | null {
  const lower = s.trim().toLowerCase();
  if (
    /^(size\s*)?0p$/.test(lower) ||
    /^(size\s*)?op$/.test(lower) ||
    /^size\s*0$/.test(lower)
  ) {
    return 'XS';
  }
  if (/^size\s*1$/.test(lower)) return 'S';
  if (/^size\s*2$/.test(lower)) return 'M';
  if (/^size\s*3$/.test(lower)) return 'L';
  if (/^size\s*4$/.test(lower)) return 'XL';
  return null;
}

/**
 * UK / AUS / US labels. Prefer UK as the anchor since Self Portrait,
 * Maje, Needle & Thread, and Misha all list UK first when multiple
 * systems appear.
 */
function parseInternationalLabel(s: string): SizeBucket | null {
  const lower = s.toLowerCase();

  const numbers: { system: string; value: number }[] = [];
  const re = /\b(uk|us|aus)\s*(\d+)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(lower)) !== null) {
    numbers.push({ system: m[1], value: parseInt(m[2], 10) });
  }
  if (numbers.length === 0) return null;

  const uk = numbers.find((n) => n.system === 'uk');
  if (uk) {
    if (uk.value <= 6) return 'XS';
    if (uk.value <= 8) return 'S';
    if (uk.value <= 10) return 'M';
    if (uk.value <= 12) return 'L';
    return 'XL';
  }

  const aus = numbers.find((n) => n.system === 'aus');
  if (aus) {
    if (aus.value <= 6) return 'XS';
    if (aus.value <= 8) return 'S';
    if (aus.value <= 10) return 'M';
    if (aus.value <= 12) return 'L';
    return 'XL';
  }

  const us = numbers.find((n) => n.system === 'us');
  if (us) {
    if (us.value <= 2) return 'XS';
    if (us.value <= 4) return 'S';
    if (us.value <= 6) return 'M';
    if (us.value <= 8) return 'L';
    return 'XL';
  }
  return null;
}

/**
 * Compound set labels: "Top M Pants M", "Top S-M Pants M", "Top M Pants S".
 * The Top is the anchor — fit for the torso is the more sensitive
 * dimension for filtering.
 */
function parseCompoundLabel(s: string): SizeBucket | null {
  const lower = s.toLowerCase();
  if (!lower.includes('top') || !lower.includes('pants')) return null;

  const beforePants = s.split(/pants/i)[0];
  const letters = beforePants.match(/\b(XS|XXL|XL|S|M|L)\b/i);
  if (!letters) return null;
  return parseLetterLabel(letters[1]);
}

/**
 * Parses the display `size` field into a bucket. Returns null when the
 * label is missing or unrecognised — the caller falls back to the
 * measurement-derived bucket.
 */
export function parseLabel(size: unknown): SizeBucket | null {
  if (!size) return null;
  const s = String(size).trim();
  if (!s || s === '-' || s.toLowerCase() === 'n/a') return null;

  const lower = s.toLowerCase();
  if (
    lower === 'free size' ||
    lower === 'freesize' ||
    lower === 'all size' ||
    lower === 'one size'
  ) {
    return 'Free Size';
  }

  return (
    parseCompoundLabel(s) ??
    parseZimmermannLabel(s) ??
    parseInternationalLabel(s) ??
    parseLetterLabel(s)
  );
}

/* ── Top-level derivation ─────────────────────────────────────────── */

export interface BucketInput {
  size?: string | null;
  measurements?: Record<string, any> | null;
}

/**
 * Derives the canonical size bucket for an item.
 *
 * Priority:
 *   1. Recognised label (brand-authoritative)
 *   2. Free-size marker in outer_bust
 *   3. Outer-bust numeric → bucket
 *   4. Free-size marker in inner_bust / skirt (rare)
 *   5. null — caller shows "See measurements"
 */
export function deriveSizeBucket(input: BucketInput): SizeBucket | null {
  const { size, measurements } = input;

  // 1. Label wins — it's what the brand published and what the customer
  //    expects when they see the item in the drawer.
  const labelBucket = parseLabel(size);
  if (labelBucket) return labelBucket;

  const outer = (measurements as any)?.outer || {};

  // 2. Free-size marker in outer_bust
  if (isFreeSizeMarker(outer.bust)) return 'Free Size';

  // 3. Numeric outer_bust → bucket
  const bustNum = parseNumericOrRange(outer.bust);
  const bustBucket = bustToBucket(bustNum);
  if (bustBucket) return bustBucket;

  // 4. Inner-bust fallback (rare — mostly for two-piece sets where the
  //    outer is a cape and only the inner is fitted)
  const inner = (measurements as any)?.inner || {};
  if (isFreeSizeMarker(inner.bust)) return 'Free Size';
  const innerBustNum = parseNumericOrRange(inner.bust);
  const innerBustBucket = bustToBucket(innerBustNum);
  if (innerBustBucket) return innerBustBucket;

  return null;
}

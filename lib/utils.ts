import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a number as Indonesian Rupiah per EYD / PUEBI rules:
 *   • Symbol "Rp" — capital R, lowercase p
 *   • No period after "Rp"
 *   • No space between symbol and number
 *   • Dot (.) as thousands separator
 *
 *   formatRupiah(12500000) → "Rp12.500.000"
 *   formatRupiah(0)        → "Rp0"
 */
export function formatRupiah(amount: number): string {
  const n = Math.round(Number(amount) || 0);
  return `Rp${n.toLocaleString("id-ID")}`;
}

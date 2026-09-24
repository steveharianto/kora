/* KTP verification record — pure localStorage for now.
   When auth lands, swap these three functions for a customer record read/write. */

export type KtpStatus = "pending" | "verified" | "rejected";

export interface KtpRecord {
  url: string;
  uploadedAt: string; // ISO timestamp
  status: KtpStatus;
}

const KEY = "kora_ktp";
const EVENT = "kora-cart-updated";

export function readKtpRecord(): KtpRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.url !== "string") return null;
    return parsed as KtpRecord;
  } catch {
    return null;
  }
}

export function writeKtpRecord(record: KtpRecord): void {
  localStorage.setItem(KEY, JSON.stringify(record));
  window.dispatchEvent(new Event(EVENT));
}

export function clearKtpRecord(): void {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
}

/** True if the customer has a KTP on file that permits checkout. */
export function hasValidKtp(): boolean {
  const r = readKtpRecord();
  return Boolean(r && (r.status === "pending" || r.status === "verified"));
}

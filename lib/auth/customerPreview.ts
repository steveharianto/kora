// Cosmetic customer preview stored in a non-httpOnly cookie so the
// storefront layout can render the header without a DB round-trip.
//
// NEVER trust this cookie for authorization decisions — the httpOnly
// `kora_customer_session` cookie remains the source of truth for
// server-side checks.

export const CUSTOMER_PREVIEW_COOKIE = "kora_customer_preview";

export interface CustomerPreview {
  firstName: string;
  lastName: string | null;
}

export function parseCustomerPreview(
  raw: string | undefined,
): CustomerPreview | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.firstName === "string" && parsed.firstName) {
      return {
        firstName: parsed.firstName,
        lastName:
          typeof parsed.lastName === "string" && parsed.lastName
            ? parsed.lastName
            : null,
      };
    }
  } catch {
    /* fall through */
  }
  return null;
}

export function serializeCustomerPreview(p: CustomerPreview): string {
  return JSON.stringify({
    firstName: p.firstName,
    lastName: p.lastName || null,
  });
}

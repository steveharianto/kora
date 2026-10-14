// lib/business/contactInfo.ts
//
// Hardcoded business constants — the single source of truth for the
// showroom address, contact numbers, and social URLs that appear on the
// storefront (footer, about page, etc.).
//
// These used to live in `app_settings.business_info` where they were
// editable but never read. Changing them in Settings mutated a DB row
// that no consumer looked at, so the storefront always rendered the
// hardcoded values anyway. That indirection has been removed.
//
// To change any of these values: edit this file and redeploy.

export const BRAND_NAME = "KORA";

/**
 * Showroom display address. Rendered with preserved line breaks in the
 * footer. Linked to `GOOGLE_MAPS_URL` — clicking it opens the pin.
 */
export const SHOWROOM_ADDRESS =
  "Jl. Darmawangsa VI No. 42 Pulo,\nKebayoran Baru, South Jakarta 12160";

export const GOOGLE_MAPS_URL = "https://maps.app.goo.gl/YKkwsJQkRBMXixe26";

export interface WhatsAppAdmin {
  /** "Admin 1", "Admin 2" — a stable way to reference the contact. */
  label: string;
  /** First name for the compact footer label. */
  name: string;
  /** Human-readable phone shown in the About page. */
  display: string;
  /** Deep link — https://wa.me/<digits-only>. */
  waUrl: string;
}

export const WHATSAPP_ADMINS: WhatsAppAdmin[] = [
  {
    label: "Admin 1",
    name: "Sheha",
    display: "+62 895-6234-40010",
    waUrl: "https://wa.me/62895623440010",
  },
  {
    label: "Admin 2",
    name: "Dilla",
    display: "+62 895-3186-0386",
    waUrl: "https://wa.me/6289531860386",
  },
];

export const INSTAGRAM_URL = "https://instagram.com/daysinkora";
export const TIKTOK_URL = "https://www.tiktok.com/@daysinkora";
export const CONTACT_EMAIL = "daysinkora@gmail.com";

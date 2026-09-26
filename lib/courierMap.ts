export interface CourierCode {
  company: string;
  type: string;
}

// Display-name alias → Biteship company code.
// Lowercased, spaces stripped before lookup.
const COMPANY_ALIASES: Record<string, string> = {
  jne: "jne",
  sicepat: "sicepat",
  gosend: "gojek",
  gojek: "gojek",
  paxel: "paxel",
  grab: "grab",
  grabexpress: "grab",
  anteraja: "anteraja",
  ninja: "ninja",
  ninjaxpress: "ninja",
  pos: "pos",
  posindonesia: "pos",
  tiki: "tiki",
  lion: "lion",
  lionparcel: "lion",
  wahana: "wahana",
  sentral: "sentral",
  rpx: "rpx",
  ide: "ide",
  idx: "ide",
  idexpress: "ide",
  jet: "jet",
  jetexpress: "jet",
  sap: "sap",
  sapexpress: "sap",
  ncs: "ncs",
  rex: "rex",
  royale: "rex",
  royaleexpress: "rex",
  star: "star",
  starcargo: "star",
};

/**
 * Canonical label → code map. The order of keys here drives the admin
 * dropdown and the outward-facing display names. Any Biteship response
 * whose company|type isn't listed here is still accepted — it just gets a
 * dynamically formatted label (see labelForCourier in checkout.ts).
 */
export const OUTBOUND_COURIER_MAP: Record<string, CourierCode> = {
  "JNE - REG": { company: "jne", type: "reg" },
  "JNE - YES": { company: "jne", type: "yes" },
  "SiCepat - REG": { company: "sicepat", type: "reg" },
  "SiCepat - BEST": { company: "sicepat", type: "best" },
  "Gosend - Instant": { company: "gojek", type: "instant" },
  "Gosend - Same Day": { company: "gojek", type: "sameday" },
  "Paxel - Small": { company: "paxel", type: "small" },
  "Paxel - Medium": { company: "paxel", type: "medium" },
  "Paxel - Large": { company: "paxel", type: "large" },
  "Paxel - Regular": { company: "paxel", type: "regular" },
  "Paxel - Instant": { company: "paxel", type: "instant" },
  "GrabExpress - Instant": { company: "grab", type: "instant" },
  "GrabExpress - Same Day": { company: "grab", type: "sameday" },
  "Anteraja - REG": { company: "anteraja", type: "reg" },
  "Anteraja - Same Day": { company: "anteraja", type: "sameday" },
  "Ninja Xpress - Standard": { company: "ninja", type: "standard" },
  "Pos Indonesia - Reguler": { company: "pos", type: "reg" },
  "TIKI - REG": { company: "tiki", type: "reg" },
  "Lion Parcel - REG": { company: "lion", type: "reg" },
};

/** Ordered list — used to render the admin courier dropdown. */
export const OUTBOUND_COURIER_LABELS: string[] = Object.keys(
  OUTBOUND_COURIER_MAP,
);

export const RETURN_COURIER_MAP: Record<string, CourierCode> = {
  "paxel - regular": { company: "paxel", type: "medium" },
  "paxel - medium": { company: "paxel", type: "medium" },
  "paxel - instant": { company: "paxel", type: "instant" },
  "jne - reg": { company: "jne", type: "reg" },
  "jne - yes": { company: "jne", type: "yes" },
  "gosend - instant": { company: "gojek", type: "instant" },
  "grab - instant": { company: "grab", type: "instant" },
  "sicepat - reg": { company: "sicepat", type: "reg" },
  "anteraja - reg": { company: "anteraja", type: "reg" },
};

function parseLabelFallback(method: string): CourierCode | null {
  // Accept "Paxel - Regular", "paxel – medium", "JNE — YES", etc.
  const parts = method.split(/\s*[-–—]\s*/);
  if (parts.length < 2) return null;

  const alias = parts[0].toLowerCase().replace(/\s+/g, "");
  const company = COMPANY_ALIASES[alias];
  const type = parts
    .slice(1)
    .join("-")
    .toLowerCase()
    .replace(/\s+/g, "");
  if (company && type) return { company, type };
  return null;
}

export function resolveOutboundCourier(method: string): CourierCode {
  const key = (method || "").trim();

  // 1. Exact match
  const exact = OUTBOUND_COURIER_MAP[key];
  if (exact) return exact;

  // 2. Case-insensitive match against curated labels
  const lowerKey = key.toLowerCase();
  for (const [label, code] of Object.entries(OUTBOUND_COURIER_MAP)) {
    if (label.toLowerCase() === lowerKey) return code;
  }

  // 3. Fallback: parse "<Display Name> - <Type>"
  const parsed = parseLabelFallback(key);
  if (parsed) return parsed;

  throw new Error(
    `Unrecognized courier method "${method}". Add it to OUTBOUND_COURIER_MAP in lib/courierMap.ts.`,
  );
}

export function resolveReturnCourier(choice: string): CourierCode {
  const key = (choice || "").trim().toLowerCase();

  const mapped = RETURN_COURIER_MAP[key];
  if (mapped) return mapped;

  const parsed = parseLabelFallback(choice || "");
  if (parsed) return parsed;

  throw new Error(
    `Unrecognized return courier "${choice}". Valid options: ${Object.keys(RETURN_COURIER_MAP).join(", ")}`,
  );
}

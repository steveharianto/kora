const BITESHIP_API_URL = "https://api.biteship.com/v1";
const BITESHIP_TIMEOUT_MS = 20_000;

/* ── Error normalization ─────────────────────────────────────────── */

/**
 * Node's built-in fetch (undici) surfaces network failures as a bland
 * `TypeError: fetch failed` with the real reason tucked into `.cause`.
 * This unwraps it so we get something actionable — `getaddrinfo ENOTFOUND`,
 * `ECONNREFUSED`, `Connect Timeout Error`, `certificate has expired`, etc.
 */
function describeFetchError(err: any): string {
  if (!err) return "Unknown network error.";

  const cause = err.cause;
  const deeperCause = cause?.cause;

  const parts: string[] = [];

  if (err.message) parts.push(err.message);

  if (cause) {
    const code = cause.code ? ` [${cause.code}]` : "";
    const msg = cause.message || String(cause);
    parts.push(`${msg}${code}`);
  }

  if (deeperCause && deeperCause !== cause) {
    const code = deeperCause.code ? ` [${deeperCause.code}]` : "";
    const msg = deeperCause.message || String(deeperCause);
    parts.push(`${msg}${code}`);
  }

  const unique = Array.from(new Set(parts));
  return unique.join(" — ");
}

/* ── Shared fetch wrapper ────────────────────────────────────────── */

async function biteshipFetch(
  url: string,
  init: RequestInit,
): Promise<{ ok: boolean; status: number; data: any; error?: string }> {
  const apiKey = process.env.BITESHIP_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      status: 0,
      data: null,
      error:
        "Biteship API key is missing. Add BITESHIP_API_KEY to your .env.local file.",
    };
  }

  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
      signal: AbortSignal.timeout(BITESHIP_TIMEOUT_MS),
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    return { ok: res.ok, status: res.status, data };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: `Network error contacting Biteship: ${describeFetchError(err)}`,
    };
  }
}

/* ── Types ───────────────────────────────────────────────────────── */

export interface BiteshipAddress {
  name: string;
  phone: string;
  address: string;
  city?: string;
  postal_code?: string;
  coordinate?: {
    latitude: number;
    longitude: number;
  };
}

export interface BiteshipItem {
  name: string;
  description?: string;
  value: number;
  quantity: number;
  weight: number;
}

export interface CreateBiteshipOrderPayload {
  origin: BiteshipAddress;
  destination: BiteshipAddress;
  courier_company: string;
  courier_type: string;
  delivery_type: "now" | "scheduled" | "later";
  delivery_date?: string;
  delivery_time?: string;
  items: BiteshipItem[];
  reference_id?: string;
  note?: string;
}

export interface BiteshipOrderResponse {
  success: boolean;
  id?: string;
  tracking_id?: string;
  waybill_id?: string;
  courier?: {
    tracking_id: string;
    waybill_id: string;
    company: string;
    name: string;
    type: string;
    link: string;
  };
  price?: number;
  status?: string;
  error?: string;
}

/* ── Create order ────────────────────────────────────────────────── */

export async function createBiteshipOrder(
  payload: CreateBiteshipOrderPayload,
): Promise<BiteshipOrderResponse> {
  const res = await biteshipFetch(`${BITESHIP_API_URL}/orders`, {
    method: "POST",
    body: JSON.stringify({
      origin_contact_name: payload.origin.name,
      origin_contact_phone: payload.origin.phone,
      origin_address: payload.origin.address,
      origin_postal_code: payload.origin.postal_code,
      origin_coordinate: payload.origin.coordinate,

      destination_contact_name: payload.destination.name,
      destination_contact_phone: payload.destination.phone,
      destination_address: payload.destination.address,
      destination_postal_code: payload.destination.postal_code,
      destination_coordinate: payload.destination.coordinate,

      courier_company: payload.courier_company.toLowerCase(),
      courier_type: payload.courier_type.toLowerCase(),
      delivery_type: payload.delivery_type,
      delivery_date: payload.delivery_date,
      delivery_time: payload.delivery_time,
      reference_id: payload.reference_id,
      items: payload.items,
      note: payload.note || "KORA Designer Rental Package",
    }),
  });

  if (res.error) {
    return { success: false, error: res.error };
  }

  const data = res.data;
  if (!res.ok || !data?.success) {
    return {
      success: false,
      error:
        data?.message ||
        data?.error ||
        `Biteship order creation failed (HTTP ${res.status}).`,
    };
  }

  return {
    success: true,
    id: data.id,
    tracking_id: data.courier?.tracking_id || data.tracking_id,
    waybill_id: data.courier?.waybill_id || data.waybill_id || data.id,
    courier: data.courier,
    price: data.price,
    status: data.status,
  };
}

/* ── Tracking lookup ─────────────────────────────────────────────── */

export async function getBiteshipTracking(
  waybillId: string,
  courierCode: string,
) {
  const res = await biteshipFetch(
    `${BITESHIP_API_URL}/trackings/${waybillId}/couriers/${courierCode}`,
    { method: "GET" },
  );
  if (res.error) return { error: res.error };
  return res.data;
}

/* ── Rate quotes ─────────────────────────────────────────────────── */

export interface BiteshipRateRequest {
  origin_postal_code: string;
  destination_postal_code: string;
  couriers: string;
  items: BiteshipItem[];
  /** Required for instant couriers (Paxel, Gojek, Grab, Lalamove, Borzo). */
  origin_coordinate?: { latitude: number; longitude: number };
  /** Required for instant couriers. */
  destination_coordinate?: { latitude: number; longitude: number };
}

export interface BiteshipRateOption {
  courier_company: string;
  courier_type: string;
  courier_name?: string;
  price: number;
  etd?: string;
  duration?: string;
}

export async function getBiteshipRates(
  payload: BiteshipRateRequest,
): Promise<{ success: boolean; rates?: BiteshipRateOption[]; error?: string }> {
  const res = await biteshipFetch(`${BITESHIP_API_URL}/rates/couriers`, {
    method: "POST",
    body: JSON.stringify({
      origin_postal_code: payload.origin_postal_code,
      destination_postal_code: payload.destination_postal_code,
      couriers: payload.couriers,
      items: payload.items,
      // Forward coordinates when present — instant couriers won't quote without them.
      ...(payload.origin_coordinate
        ? { origin_coordinate: payload.origin_coordinate }
        : {}),
      ...(payload.destination_coordinate
        ? { destination_coordinate: payload.destination_coordinate }
        : {}),
    }),
  });

  if (res.error) return { success: false, error: res.error };

  const data = res.data;
  if (!res.ok || !data?.success) {
    return {
      success: false,
      error:
        data?.error ||
        data?.message ||
        `Biteship rate lookup failed (HTTP ${res.status}).`,
    };
  }

  return {
    success: true,
    rates: (data.pricing || []).map((r: any) => ({
      courier_company: r.courier_code || r.courier_company || "",
      courier_type: r.courier_service_code || r.courier_type || "",
      courier_name:
        r.courier_name || r.courier_service_name || r.courier_code || "",
      price: Number(r.price) || 0,
      etd:
        r.shipment_duration_range && r.shipment_duration_unit
          ? `${r.shipment_duration_range} ${r.shipment_duration_unit}`
          : r.duration || r.etd || "",
      duration: r.duration,
    })),
  };
}

/* ── Diagnostic ──────────────────────────────────────────────────── */

/**
 * Lightweight connectivity test against Biteship. Returns the raw outcome so
 * an admin route or CLI script can print exactly why outbound calls fail
 * (DNS, TLS, timeout, auth, etc.).
 */
export async function debugBiteshipConnection(): Promise<{
  apiKeyPresent: boolean;
  url: string;
  ok: boolean;
  status?: number;
  error?: string;
  sampleData?: any;
}> {
  const apiKeyPresent = Boolean(process.env.BITESHIP_API_KEY);

  if (!apiKeyPresent) {
    return {
      apiKeyPresent: false,
      url: BITESHIP_API_URL,
      ok: false,
      error: "BITESHIP_API_KEY is not set in the runtime environment.",
    };
  }

  const res = await biteshipFetch(`${BITESHIP_API_URL}/rates/couriers`, {
    method: "POST",
    body: JSON.stringify({
      origin_postal_code: "12180",
      destination_postal_code: "12180",
      couriers: "jne",
      items: [{ name: "ping", value: 1, quantity: 1, weight: 100 }],
    }),
  });

  return {
    apiKeyPresent: true,
    url: BITESHIP_API_URL,
    ok: res.ok,
    status: res.status,
    error: res.error,
    sampleData: res.data,
  };
}

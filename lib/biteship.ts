const BITESHIP_API_URL = 'https://api.biteship.com/v1';

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
  weight: number; // in grams
}

export interface CreateBiteshipOrderPayload {
  origin: BiteshipAddress;
  destination: BiteshipAddress;
  courier_company: string; // e.g. 'paxel', 'gojek', 'jne', 'sicepat'
  courier_type: string; // e.g. 'regular', 'instant'
  delivery_type: 'now' | 'scheduled' | 'later';
  delivery_date?: string; // YYYY-MM-DD
  delivery_time?: string; // HH:mm
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

export async function createBiteshipOrder(
  payload: CreateBiteshipOrderPayload
): Promise<BiteshipOrderResponse> {
  const apiKey = process.env.BITESHIP_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: 'Biteship API key is missing. Add BITESHIP_API_KEY to your .env.local file.',
    };
  }

  try {
    const res = await fetch(`${BITESHIP_API_URL}/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
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
        note: payload.note || 'KORA Designer Rental Package',
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.message || data.error || 'Failed to create Biteship booking.',
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
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Network error connecting to Biteship API.',
    };
  }
}

export async function getBiteshipTracking(waybillId: string, courierCode: string) {
  const apiKey = process.env.BITESHIP_API_KEY;
  if (!apiKey) return { error: 'BITESHIP_API_KEY not set' };

  try {
    const res = await fetch(
      `${BITESHIP_API_URL}/trackings/${waybillId}/couriers/${courierCode}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );
    return await res.json();
  } catch (err: any) {
    return { error: err.message };
  }
}

/* ── Shipping rate quotes ────────────────────────────────────────── */

export interface BiteshipRateRequest {
  origin_postal_code: string;
  destination_postal_code: string;
  couriers: string; // comma-separated lowercase codes
  items: BiteshipItem[];
}

export interface BiteshipRateOption {
  courier_company: string; // "jne" | "sicepat" | "gojek" | "paxel" | ...
  courier_type: string;    // "reg" | "yes" | "instant" | "medium" | ...
  courier_name?: string;
  price: number;
  etd?: string;            // "1-2 days", "2 hours", etc.
  duration?: string;
}

export async function getBiteshipRates(
  payload: BiteshipRateRequest,
): Promise<{ success: boolean; rates?: BiteshipRateOption[]; error?: string }> {
  const apiKey = process.env.BITESHIP_API_KEY;
  if (!apiKey) {
    return { success: false, error: "BITESHIP_API_KEY is not configured." };
  }

  try {
    const res = await fetch(`${BITESHIP_API_URL}/rates/couriers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        origin_postal_code: payload.origin_postal_code,
        destination_postal_code: payload.destination_postal_code,
        couriers: payload.couriers,
        items: payload.items,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      return {
        success: false,
        error:
          data?.error ||
          data?.message ||
          "Failed to fetch Biteship rates.",
      };
    }

    // Biteship /rates/couriers returns `courier_code` and
    // `courier_service_code`, which differ from the /orders response shape.
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
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Network error contacting Biteship.",
    };
  }
}
